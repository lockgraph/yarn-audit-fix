import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sv from 'semver'

import { TAuditReport, TContext } from '../../main/ts/ifaces'
import {
  format,
  getLockfileType,
  parse,
  patch,
  refurbish,
} from '../../main/ts/lockfile'
import { applyManifestEdit } from '../../main/ts/util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- helpers ----------------------------------------------------------------

// name -> version -> {dep: range}
type Spec = Record<string, Record<string, Record<string, string>>>

// A minimal `lockgraph` RegistryAdapter backed by a canned spec, so
// the patch flow (replaceVersion + completeTransitives) stays offline + hermetic.
const mockRegistry = (spec: Spec) =>
  ({
    packument: async (name: string) => {
      const versions = spec[name]
      if (!versions) return undefined
      return {
        name,
        distTags: { latest: Object.keys(versions).sort(sv.compare).at(-1)! },
        versions: Object.fromEntries(
          Object.entries(versions).map(([v, dependencies]) => [
            v,
            { name, version: v, dependencies },
          ]),
        ),
      }
    },
    resolve: async (name: string, range: string) => {
      const versions = spec[name]
      if (!versions) return undefined
      const match = versions[range]
        ? range
        : Object.keys(versions)
            .filter((v) => sv.satisfies(v, range))
            .sort(sv.compare)
            .at(-1)
      return match
        ? { name, version: match, dependencies: versions[match] }
        : undefined
    },
  }) as any

// Build a minimal yarn-classic lockfile. `entries[].id` is the descriptor key
// (e.g. `glob@^10.0.0`); `version` the resolved version; `deps` the declared deps.
const B64 = 'A'.repeat(86) + '=='
const lock = (
  entries: { id: string; version: string; deps?: Record<string, string> }[],
): string =>
  '# yarn lockfile v1\n\n\n' +
  entries
    .map((e) => {
      const deps =
        e.deps && Object.keys(e.deps).length > 0
          ? '\n  dependencies:\n' +
            Object.entries(e.deps)
              .map(([n, r]) => `    "${n}" "${r}"`)
              .join('\n')
          : ''
      return (
        `"${e.id}":\n` +
        `  version "${e.version}"\n` +
        `  resolved "https://registry.yarnpkg.com/x/-/x-${e.version}.tgz#${e.version.replace(/\W/g, '')}"\n` +
        `  integrity sha512-${B64}${deps}`
      )
    })
    .join('\n\n') +
  '\n'

const ctx = (flags: Record<string, any>, registry: any): TContext =>
  ({ flags, registry, cwd: process.cwd() }) as unknown as TContext

const run = async (
  lockfile: string,
  report: TAuditReport,
  flags: Record<string, any>,
  spec: Spec,
): Promise<string> => {
  const fmt = getLockfileType(lockfile)
  const graph = parse(lockfile, fmt)
  const patched = await patch(
    graph,
    report,
    ctx(flags, mockRegistry(spec)),
    fmt,
  )
  return format(patched, fmt)
}

const advisory = (vulnerable: string, patched: string) => ({
  module_name: 'x',
  vulnerable_versions: vulnerable,
  patched_versions: patched,
})

// ---- tests ------------------------------------------------------------------

describe('patch', () => {
  it('bumps a vulnerable package to the lowest published fix', async () => {
    const out = await run(
      lock([{ id: 'lodash@^4.17.0', version: '4.17.20' }]),
      { lodash: advisory('<4.17.21', '>=4.17.21') },
      { silent: true },
      { lodash: { '4.17.20': {}, '4.17.21': {}, '4.17.22': {} } },
    )
    expect(out).toContain('version "4.17.21"') // lowest satisfying, not latest
    expect(out).not.toContain('version "4.17.22"')
  })

  // npm parity: advisories are split per major line now, so a package can carry one
  // GHSA for 1.x and another for 2.x. Merging their patched ranges with AND admits
  // only the newest major and forces a breaking upgrade over a safe in-line one.
  it('takes the in-line fix instead of crossing a major', async () => {
    const out = await run(
      lock([{ id: 'brace-expansion@^1.1.7', version: '1.1.11' }]),
      {
        'brace-expansion': {
          module_name: 'brace-expansion',
          // what toReport produces from two per-major advisories
          vulnerable_versions: '>=1.0.0 <1.1.12 || >=2.0.0 <2.1.4',
          patched_versions: '>=1.1.12 >=2.1.4',
        },
      },
      { silent: true },
      {
        'brace-expansion': {
          '1.1.11': {},
          '1.1.18': {},
          '2.0.1': {},
          '2.1.4': {},
        },
      },
    )
    expect(out).toContain('version "1.1.18"') // lowest 1.x clear of every advisory
    expect(out).not.toContain('version "2.1.4"') // no forced major bump
  })

  // Two vulnerable lines in one lock get one fix each, not a single shared one.
  it('fixes each version line on its own', async () => {
    const out = await run(
      lock([
        { id: 'brace-expansion@^1.1.7', version: '1.1.11' },
        { id: 'brace-expansion@^2.0.1', version: '2.0.1' },
      ]),
      {
        'brace-expansion': {
          module_name: 'brace-expansion',
          vulnerable_versions: '>=1.0.0 <1.1.12 || >=2.0.0 <2.1.4',
          patched_versions: '>=1.1.12 >=2.1.4',
        },
      },
      { silent: true },
      {
        'brace-expansion': {
          '1.1.11': {},
          '1.1.18': {},
          '2.0.1': {},
          '2.1.4': {},
        },
      },
    )
    expect(out).toContain('version "1.1.18"')
    expect(out).toContain('version "2.1.4"')
  })

  it('completes the new transitive closure of an upgraded package', async () => {
    const out = await run(
      lock([{ id: 'vuln@^1.0.0', version: '1.0.0' }]),
      { vuln: advisory('<2.0.0', '>=2.0.0') },
      { silent: true },
      {
        vuln: { '1.0.0': {}, '2.0.0': { 'new-dep': '^1.0.0' } },
        'new-dep': { '1.0.0': { 'deep-dep': '^1.0.0' } },
        'deep-dep': { '1.0.0': {} },
      },
    )
    expect(out).toContain('version "2.0.0"') // vuln bumped
    expect(out).toContain('new-dep@') // direct new dep pulled in
    expect(out).toContain('deep-dep@') // transitive new dep pulled in
  })

  // Regression guard: `mockRegistry` above returns a MINIMAL packument version
  // ({name, version, dependencies}), but a real `liveRegistry` packument carries the
  // full npm document — `funding`, `license`, `engines`, `deprecated`… A yarn lock
  // can't store most of those, and the fix's tarball payload inherits them, so strict
  // `stringify` must not treat that as an irreducible loss. Without this test the
  // whole suite is blind to it: every canned fixture is trimmed, so the goldens pass
  // while production hard-fails on the first bump of a package that lists `funding`
  // (browserslist, chalk, postcss… i.e. most of npm).
  it('survives registry metadata a yarn lock cannot store (funding, license, …)', async () => {
    const rich = {
      packument: async (name: string) =>
        name === 'vuln'
          ? {
              name,
              distTags: { latest: '2.0.0' },
              versions: {
                '1.0.0': { name, version: '1.0.0', dependencies: {} },
                '2.0.0': {
                  name,
                  version: '2.0.0',
                  dependencies: {},
                  funding: {
                    type: 'opencollective',
                    url: 'https://opencollective.com/vuln',
                  },
                  license: 'MIT',
                  engines: { node: '>=12' },
                  deprecated: 'use 3.x',
                  hasInstallScript: false,
                },
              },
            }
          : undefined,
      resolve: async (name: string, range: string) =>
        name === 'vuln' && sv.satisfies('2.0.0', range)
          ? {
              name,
              version: '2.0.0',
              dependencies: {},
              funding: {
                type: 'opencollective',
                url: 'https://opencollective.com/vuln',
              },
              license: 'MIT',
              engines: { node: '>=12' },
            }
          : undefined,
    } as any

    const lf = lock([{ id: 'vuln@^1.0.0', version: '1.0.0' }])
    const fmt = getLockfileType(lf)
    const out = format(
      await patch(
        parse(lf, fmt),
        { vuln: advisory('<2.0.0', '>=2.0.0') },
        ctx({ silent: true }, rich),
        fmt,
      ),
      fmt,
    )
    expect(out).toContain('version "2.0.0"')
    expect(out).not.toContain('funding') // dropped, not emitted into the lock
  })

  // When the fix version is already in the lock, `replaceVersion` merges into it
  // rather than creating a node, so `frontier.added` comes back empty. Completion
  // seeds off that set — if it no-ops, a dep the surviving node declares but the
  // lock lacks is never pulled in and the emitted lock references a missing entry.
  it('completes the closure when the fix version already exists in the lock', async () => {
    const out = await run(
      lock([
        { id: 'vuln@^1.0.0', version: '1.0.0', deps: { 'old-dep': '^1.0.0' } },
        {
          id: 'vuln@^2.0.0',
          version: '2.0.0',
          deps: { 'missing-dep': '^1.0.0' },
        },
        { id: 'old-dep@^1.0.0', version: '1.0.0' },
      ]),
      { vuln: advisory('<2.0.0', '>=2.0.0') },
      { silent: true },
      {
        vuln: {
          '1.0.0': { 'old-dep': '^1.0.0' },
          '2.0.0': { 'missing-dep': '^1.0.0' },
        },
        'old-dep': { '1.0.0': {} },
        'missing-dep': { '1.0.0': { 'missing-deep': '^1.0.0' } },
        'missing-deep': { '1.0.0': {} },
      },
    )
    expect(out).not.toContain('old-dep@') // stranded old closure pruned (this part works)
    expect(out).toContain('missing-dep@') // declared by the surviving node — must resolve
    expect(out).toContain('missing-deep@') // and its own transitive
  })

  it('honors a declared resolutions pin when completing a new transitive (verbatim, even out of range)', async () => {
    const spec = {
      vuln: { '1.0.0': {}, '2.0.0': { 'new-dep': '^1.0.0' } },
      'new-dep': { '1.0.0': {}, '1.5.0': {}, '2.0.0': {} },
    }
    const report = { vuln: advisory('<2.0.0', '>=2.0.0') }
    const lf = lock([{ id: 'vuln@>=1.0.0', version: '1.0.0' }])
    const fmt = getLockfileType(lf)

    // Control — no override: the newly-pulled transitive resolves to the highest
    // version IN its declared range (`new-dep@^1.0.0` → 1.5.0), never 2.0.0.
    const bare = format(
      await patch(
        parse(lf, fmt),
        report,
        ctx({ silent: true }, mockRegistry(spec)),
        fmt,
      ),
      fmt,
    )
    expect(bare).toContain('version "1.5.0"')

    // With a `resolutions` pin: `new-dep` is forced to 2.0.0 — OUTSIDE `^1.0.0`
    // (override replaces the range, not constrains it). Capture mirrors the runtime
    // wiring: parse(manifest) → graph.overrides() → patch(overrides).
    const graph = parse(lf, fmt, undefined, {
      dependencies: { vuln: '>=1.0.0' },
      resolutions: { 'new-dep': '2.0.0' },
    })
    const overrides = graph.overrides()
    expect(overrides.map((o) => `${o.name}@${o.to}`)).toEqual(['new-dep@2.0.0'])

    const pinned = format(
      await patch(
        graph,
        report,
        ctx({ silent: true }, mockRegistry(spec)),
        fmt,
        overrides,
      ),
      fmt,
    )
    expect(pinned).toContain('new-dep@')
    expect(pinned).toMatch(/new-dep@[\s\S]*?version "2\.0\.0"/) // pinned target won
    expect(pinned).not.toContain('version "1.5.0"') // in-range highest overridden
  })

  // `npm audit fix --force` parity: a user's override is authoritative — npm leaves
  // a pin holding a vulnerable version in place (never rewrites it), so yaf does too.
  describe('override authority (npm audit fix --force parity)', () => {
    const report = { vuln: advisory('<2.0.0', '>=2.0.0') }
    const spec = { vuln: { '1.0.0': {}, '2.0.0': {} } }
    // The declared range admits the fix, so the manifest gate stays out of it and each
    // test measures what it is about: the override's authority. With anchors the root's
    // declaration is a real edge, so it has to be the lock's own descriptor.
    const lf = lock([{ id: 'vuln@>=1.0.0', version: '1.0.0' }])
    const fmt = getLockfileType(lf)
    const runOvr = async (
      resolutions: Record<string, string>,
      flags: Record<string, any> = {},
    ): Promise<string> => {
      const g = parse(lf, fmt, undefined, {
        dependencies: { vuln: '>=1.0.0' },
        resolutions,
      })
      const out = await patch(
        g,
        report,
        ctx({ silent: true, ...flags }, mockRegistry(spec)),
        fmt,
        g.overrides(),
      )
      return format(out, fmt)
    }

    it('leaves a package pinned to a vulnerable version — even with --force', async () => {
      const out = await runOvr({ vuln: '1.0.0' }, { force: true })
      expect(out).toContain('version "1.0.0"') // left at the pinned (vuln) version
      expect(out).not.toContain('version "2.0.0"') // NOT bumped, NOT rewritten
    })

    it('still fixes when the pin is a range that admits the fix', async () => {
      const out = await runOvr({ vuln: '>=1.0.0' })
      expect(out).toContain('version "2.0.0"') // bump stays within the pin
    })

    // `toPolicy` normalises declared overrides per ecosystem: npm nests, pnpm splits
    // on `>`, yarn on `/` — and `@scope/pkg` must survive the split as one segment.
    it('normalises declared overrides across ecosystems (npm nesting, pnpm `>`, scoped keys)', () => {
      // npm: nested blocks flatten to one constraint per leaf, parents accumulated
      const npmLock = JSON.stringify({
        name: 'root',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            name: 'root',
            version: '1.0.0',
            dependencies: { vuln: '^1.0.0' },
          },
          'node_modules/vuln': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/vuln/-/vuln-1.0.0.tgz',
            integrity: `sha512-${'A'.repeat(86)}==`,
          },
        },
      })
      const npmOvr = parse(npmLock, getLockfileType(npmLock), undefined, {
        overrides: { top: '3.0.0', parent: { vuln: '2.0.0' } },
      }).overrides()
      expect(npmOvr).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'top',
            to: '3.0.0',
            origin: 'npm',
            parentPath: [],
          }),
          expect.objectContaining({
            name: 'vuln',
            to: '2.0.0',
            origin: 'npm',
            parentPath: ['parent'],
          }),
        ]),
      )

      // pnpm: flat block, `>` separator
      const pnpmLock = `lockfileVersion: '9.0'
importers:
  .:
    dependencies:
      vuln:
        specifier: ^1.0.0
        version: 1.0.0
packages:
  vuln@1.0.0:
    resolution: {integrity: sha512-${'A'.repeat(86)}==}
snapshots:
  vuln@1.0.0: {}
`
      const pnpmOvr = parse(pnpmLock, getLockfileType(pnpmLock), undefined, {
        pnpm: { overrides: { 'parent>vuln': '2.0.0' } },
      }).overrides()
      expect(pnpmOvr).toEqual([
        expect.objectContaining({
          name: 'vuln',
          to: '2.0.0',
          origin: 'pnpm',
          parentPath: ['parent'],
        }),
      ])

      // yarn: `/` separator, and a scoped parent stays ONE segment. `**` is dropped.
      const yarnOvr = parse(lf, fmt, undefined, {
        dependencies: { vuln: '^1.0.0' },
        resolutions: { '**/@scope/parent/vuln': '2.0.0' },
      }).overrides()
      expect(yarnOvr).toEqual([
        expect.objectContaining({
          name: 'vuln',
          to: '2.0.0',
          origin: 'yarn',
          parentPath: ['@scope/parent'],
        }),
      ])
    })

    it('leaves a package under a DEEP-scope override untouched (v1 under-match guard)', async () => {
      const g = parse(lf, fmt, undefined, {
        dependencies: { vuln: '^1.0.0' },
        resolutions: { 'a/b/vuln': '2.0.0' },
      })
      // ≥2 ancestors → the lib's single-level matcher under-matches, so we can't
      // prove which subtree it governs → leave the package be (conservative).
      expect(g.overrides().some((o) => (o.parentPath?.length ?? 0) >= 2)).toBe(
        true,
      )
      const out = format(
        await patch(
          g,
          report,
          ctx({ silent: true }, mockRegistry(spec)),
          fmt,
          g.overrides(),
        ),
        fmt,
      )
      expect(out).toContain('version "1.0.0"') // untouched
      expect(out).not.toContain('version "2.0.0"') // not bumped
    })
  })

  it('leaves a package matched by --exclude untouched', async () => {
    const spec = { vuln: { '1.0.0': {}, '2.0.0': {} } }
    const report = { vuln: advisory('<2.0.0', '>=2.0.0') }
    const lf = lock([{ id: 'vuln@^1.0.0', version: '1.0.0' }])

    expect(await run(lf, report, { silent: true }, spec)).toContain(
      'version "2.0.0"',
    )
    const excluded = await run(
      lf,
      report,
      { silent: true, exclude: 'vuln' },
      spec,
    )
    expect(excluded).toContain('version "1.0.0"')
    expect(excluded).not.toContain('version "2.0.0"')
  })

  it('skips a fix that breaks a surviving consumer range unless --force', async () => {
    const spec = {
      vuln: { '1.0.0': {}, '2.0.0': {} },
      consumer: { '1.0.0': {} },
    }
    const report = { vuln: advisory('<2.0.0', '>=2.0.0') }
    const lf = lock([
      { id: 'consumer@^1.0.0', version: '1.0.0', deps: { vuln: '^1.0.0' } },
      { id: 'vuln@^1.0.0', version: '1.0.0' },
    ])

    // default: consumer still wants vuln@^1.0.0 → cross-major bump skipped
    const guarded = await run(lf, report, { silent: true }, spec)
    expect(guarded).toContain('version "1.0.0"')
    expect(guarded).not.toContain('version "2.0.0"')

    // --force: gate bypassed
    const forced = await run(lf, report, { silent: true, force: true }, spec)
    expect(forced).toContain('version "2.0.0"')
  })

  // The planned fix is only a floor: a bumped parent re-derives its dep edge and the
  // completion resolves that to the HIGHEST match, so the lock can land above the fix.
  // Whatever the pipeline settles on, the report has to name the version in the lock.
  it('reports the version the lock bound, not the planned fix', async () => {
    const spec = {
      parent: { '1.0.0': { x: '^1.0.0' }, '2.0.0': { x: '^1.0.0' } },
      x: { '1.0.0': {}, '1.0.1': {}, '1.0.5': {} },
    }
    // `x` first, so its bump lands and the parent's re-derived edge then re-resolves it.
    const report = {
      x: advisory('<1.0.1', '>=1.0.1'),
      parent: advisory('<2.0.0', '>=2.0.0'),
    }
    const c = ctx({ silent: true }, mockRegistry(spec))
    const lf = lock([
      { id: 'parent@^1.0.0', version: '1.0.0', deps: { x: '^1.0.0' } },
      { id: 'x@^1.0.0', version: '1.0.0' },
    ])
    const fmt = getLockfileType(lf)
    const out = format(await patch(parse(lf, fmt), report, c, fmt), fmt)

    // The bumped parent re-derives `x@^1.0.0`, and an entry already answers that exact
    // descriptor — so yarn reuses it rather than re-resolving to the highest in range
    // (measured with yarn 1.22.22), and the plan's own fix is what lands.
    expect(out).toContain('version "1.0.1"')
    expect(out).not.toContain('version "1.0.5"')
    expect(c.summary?.upgraded).toEqual(
      expect.arrayContaining([{ name: 'x', from: '1.0.0', to: '1.0.1' }]),
    )
    // The general invariant: nothing is reported that the lock does not hold.
    for (const u of c.summary?.upgraded ?? [])
      expect(out, `${u.name}@${u.from} → ${u.to}`).toContain(
        `version "${u.to}"`,
      )
  })

  // Plan order decides this one. Bumping `core` first re-derives its deps, which
  // strands the old `helpers` node — and the `helpers` plan then targets a node
  // nothing points at any more. Rebinding it mints a replacement that is unreachable
  // from birth: it never enters `frontier.orphaned`, so the seeded prune cannot see
  // it, and the lock keeps an entry `yarn install` then wants to delete (YN0028).
  it('skips a bump whose target an earlier bump in the same batch stranded', async () => {
    // `core@7.29.6` drops `helpers` altogether, so the consumer gate has nothing to
    // object to and the bump reaches the apply phase — where its target is already
    // stranded. (When the new version still declares the dep, the gate catches it
    // first, by range.)
    const spec = {
      core: { '7.25.7': { helpers: '^7.25.7' }, '7.29.6': {} },
      helpers: { '7.25.7': {}, '7.26.10': {}, '7.29.0': {} },
    }
    // `core` first — the order that strands `helpers`.
    const report = {
      core: advisory('<7.29.6', '>=7.29.6'),
      helpers: advisory('<7.26.10', '>=7.26.10'),
    }
    const lf = lock([
      { id: 'core@^7.11.6', version: '7.25.7', deps: { helpers: '^7.25.7' } },
      { id: 'helpers@^7.25.7', version: '7.25.7' },
    ])
    const c = ctx({ silent: true }, mockRegistry(spec))
    const fmt = getLockfileType(lf)
    const out = format(await patch(parse(lf, fmt), report, c, fmt), fmt)

    // `core` moves and leaves `helpers` behind; the stranded 7.25.7 is pruned and the
    // moot 7.26.10 bump never happens — no entry left over for yarn to remove.
    expect(out).toContain('version "7.29.6"')
    expect(out).not.toContain('version "7.26.10"')
    expect(out).not.toContain('version "7.25.7"')
    // …and the dropped bump is accounted for rather than silently missing.
    expect(c.summary?.skipped).toEqual(
      expect.arrayContaining([
        { package: 'helpers@7.25.7 → 7.26.10', reason: 'superseded' },
      ]),
    )
  })

  // A fix can pull in a closure that is itself vulnerable, and the vulnerable node did not
  // exist when the run planned: express@4.22.0 clears body-parser but pins `qs ~6.14.0`,
  // which has its own advisory. So remediation re-audits its own result and goes again.
  it('re-audits its own output until nothing is left to fix', async () => {
    const spec = {
      p: {
        '1.0.0': {},
        '2.0.0': { dep: '1.0.0' }, // its own fix drags in a vulnerable dep, pinned exactly
        '2.1.0': { dep: '^2.0.0' },
      },
      dep: { '1.0.0': {}, '2.0.0': {} },
    }
    const report = {
      p: advisory('<2.0.0', '>=2.0.0'),
      dep: advisory('<2.0.0', '>=2.0.0'),
    }
    const c = ctx({ silent: true }, mockRegistry(spec))
    const lf = lock([{ id: 'p@^1.0.0', version: '1.0.0' }]) // `dep` is not in the lock yet
    const fmt = getLockfileType(lf)
    const out = format(await patch(parse(lf, fmt), report, c, fmt), fmt)

    // Round 1 bumps `p` and pulls dep@1.0.0; round 2 sees that dep is vulnerable, finds it
    // pinned exactly, and raises `p` again to the version that admits the fix.
    expect(out).toContain('version "2.1.0"')
    expect(out).toContain('version "2.0.0"')
    expect(out).not.toContain('version "1.0.0"')
    // The chain collapses into one line: what the user had, and what they ended up with.
    expect(c.summary?.upgraded).toEqual(
      expect.arrayContaining([{ name: 'p', from: '1.0.0', to: '2.1.0' }]),
    )
    expect(c.summary?.upgraded.filter((u) => u.name === 'p')).toHaveLength(1)
  })

  // A consumer being bumped is exempt because it re-derives its deps — unless its own
  // next version carries the same pin forward. serve-static@1.16.0 still declares
  // `send: "0.18.0"` exactly; only 1.16.2 moves off it. So the fix for `send` is not
  // abandoned: the parent that pins it is raised, which is what `npm audit fix` does
  // (never break a pin, but move the parent) — and the raise is reported, since the user
  // did not ask for that version.
  const sendCase = (serveStatic: Record<string, Record<string, string>>) => ({
    spec: { send: { '0.18.0': {}, '0.19.0': {} }, 'serve-static': serveStatic },
    report: {
      send: advisory('<0.19.0', '>=0.19.0'),
      'serve-static': advisory('<1.16.0', '>=1.16.0'),
    },
    lf: lock([
      {
        id: 'serve-static@^1.15.0',
        version: '1.15.0',
        deps: { send: '0.18.0' },
      },
      { id: 'send@0.18.0', version: '0.18.0' },
    ]),
  })

  it('raises the parent that pins a fix away, in range, and says so', async () => {
    const { spec, report, lf } = sendCase({
      '1.15.0': { send: '0.18.0' },
      '1.16.0': { send: '0.18.0' }, // the npm-parity fix — still pinned
      '1.16.2': { send: '^0.19.0' }, // the lowest that lets send move
    })
    const c = ctx({ silent: true }, mockRegistry(spec))
    const fmt = getLockfileType(lf)
    const out = format(await patch(parse(lf, fmt), report, c, fmt), fmt)

    expect(out).toContain('version "1.16.2"') // raised past its own minimal fix
    expect(out).toContain('version "0.19.0"') // …so send is actually fixed
    expect(c.summary?.upgraded).toEqual(
      expect.arrayContaining([{ name: 'send', from: '0.18.0', to: '0.19.0' }]),
    )

    // The raise is the user's business: they get told which version moved and why.
    const printed = await capture(() =>
      patch(
        parse(lf, fmt),
        report,
        ctx({ silent: false }, mockRegistry(spec)),
        fmt,
      ),
    )
    expect(printed).toMatch(/Raised past its own fix/)
    expect(printed).toContain('serve-static@1.16.0 — to clear send')
  })

  // The floor when no raise is reachable: 2.0.0 would clear it, but crossing a major on
  // a package the user never mentioned is not ours to do without --force.
  it('skips the fix when the only parent that clears it is a major away', async () => {
    const { spec, report, lf } = sendCase({
      '1.15.0': { send: '0.18.0' },
      '1.16.0': { send: '0.18.0' },
      '2.0.0': { send: '^0.19.0' },
    })
    const c = ctx({ silent: true }, mockRegistry(spec))
    const fmt = getLockfileType(lf)
    const out = format(await patch(parse(lf, fmt), report, c, fmt), fmt)

    expect(out).toContain('version "1.16.0"') // serve-static still gets its own fix
    expect(out).not.toContain('version "0.19.0"') // send does not move
    expect(c.summary?.skipped).toEqual(
      expect.arrayContaining([
        { package: 'send@0.18.0 → 0.19.0', reason: 'consumer-range' },
      ]),
    )
  })

  // The exemption trusts the other plans: `inner`'s only consumer is `mid`, which is
  // itself planned, so `mid`'s range is waived. But `mid`'s own bump is then skipped
  // by this very gate — and `inner` is left bumped past a consumer that never moved.
  it('withdraws a fix whose exemption came from a plan the gate then skips', async () => {
    const spec = {
      outer: { '1.0.0': { mid: '^1.0.0' } },
      mid: { '1.0.0': { inner: '^1.0.0' }, '2.0.0': { inner: '^2.0.0' } },
      inner: { '1.0.0': {}, '2.0.0': {} },
    }
    const report = {
      mid: advisory('<2.0.0', '>=2.0.0'),
      inner: advisory('<2.0.0', '>=2.0.0'),
    }
    const lf = lock([
      { id: 'outer@^1.0.0', version: '1.0.0', deps: { mid: '^1.0.0' } },
      { id: 'mid@^1.0.0', version: '1.0.0', deps: { inner: '^1.0.0' } },
      { id: 'inner@^1.0.0', version: '1.0.0' },
    ])

    // `outer` pins `mid@^1.0.0`, so `mid` is skipped — and `inner` goes with it.
    expect(await run(lf, report, { silent: true }, spec)).not.toContain(
      'version "2.0.0"',
    )
  })

  it('is a no-op when the installed version already clears the advisory', async () => {
    const out = await run(
      lock([{ id: 'vuln@^2.0.0', version: '2.0.0' }]),
      { vuln: advisory('<3.0.0', '>=2.0.0') },
      { silent: true },
      { vuln: { '2.0.0': {} } },
    )
    expect(out).toContain('version "2.0.0"') // already at fix → unchanged
  })

  it('makes no change when nothing published clears the advisory', async () => {
    const out = await run(
      lock([{ id: 'vuln@^1.0.0', version: '1.0.0' }]),
      { vuln: advisory('<99.0.0', '>=99.0.0') },
      { silent: true },
      { vuln: { '1.0.0': {}, '2.0.0': {} } },
    )
    expect(out).toContain('version "1.0.0"') // no published fix → left as-is
    expect(out).not.toContain('version "2.0.0"')
  })

  // Capture stdout+stderr around a non-silent patch.
  const capture = async (fn: () => Promise<unknown>): Promise<string> => {
    const out: string[] = []
    const orig = { log: console.log, warn: console.warn }
    console.log = (...a: any[]) => void out.push(a.join(' '))
    console.warn = (...a: any[]) => void out.push(a.join(' '))
    try {
      await fn()
    } finally {
      console.log = orig.log
      console.warn = orig.warn
    }
    return out.join('\n')
  }

  it('prints the non-silent summary (upgraded / excluded / no-fix / skipped)', async () => {
    const out = await capture(() =>
      run(
        lock([
          {
            id: 'consumer@^1.0.0',
            version: '1.0.0',
            deps: { skipme: '^1.0.0' },
          },
          { id: 'skipme@^1.0.0', version: '1.0.0' }, // cross-major fix → gate skips
          { id: 'up@^1.0.0', version: '1.0.0' }, // in-range fix → upgraded
          { id: 'exme@^1.0.0', version: '1.0.0' }, // --exclude
          { id: 'nofixme@^1.0.0', version: '1.0.0' }, // no published fix
        ]),
        {
          skipme: advisory('<2.0.0', '>=2.0.0'),
          up: advisory('<1.5.0', '>=1.5.0'),
          exme: advisory('<2.0.0', '>=2.0.0'),
          nofixme: advisory('<99.0.0', '>=99.0.0'),
        },
        { silent: false, exclude: 'exme' },
        {
          consumer: { '1.0.0': {} },
          skipme: { '1.0.0': {}, '2.0.0': {} },
          up: { '1.0.0': {}, '1.5.0': {} },
          exme: { '1.0.0': {}, '2.0.0': {} },
          nofixme: { '1.0.0': {} },
        },
      ),
    )
    expect(out).toMatch(/Upgraded deps \(1\):/)
    expect(out).toMatch(/up@1\.0\.0 → 1\.5\.0/)
    expect(out).toMatch(/Excluded \(per --exclude\): exme@1\.0\.0/)
    expect(out).toMatch(/No fix available: nofixme/)
    expect(out).toMatch(/Skipped \(fix breaks/)
    expect(out).toMatch(/skipme@1\.0\.0 → 2\.0\.0/)
  })

  it('reports "no issues" + leaves the lockfile alone for an empty report', async () => {
    const input = lock([{ id: 'lodash@^4.17.0', version: '4.17.20' }])
    const out = await capture(() => run(input, {}, { silent: false }, {}))
    expect(out).toMatch(/Audit check found no issues/)
  })

  it('reports a package left pinned by an override (no rewrite)', async () => {
    const g = parse(
      lock([{ id: 'vuln@^1.0.0', version: '1.0.0' }]),
      'yarn-classic',
      undefined,
      { dependencies: { vuln: '^1.0.0' }, resolutions: { vuln: '1.0.0' } }, // exact pin
    )
    const out = await capture(() =>
      patch(
        g,
        { vuln: advisory('<2.0.0', '>=2.0.0') },
        ctx(
          { silent: false },
          mockRegistry({ vuln: { '1.0.0': {}, '2.0.0': {} } }),
        ),
        'yarn-classic',
        g.overrides(),
      ),
    )
    expect(out).toMatch(/Skipped \(pinned by an override/)
    expect(out).toContain('vuln@1.0.0 (pinned → 1.0.0)')
  })

  describe('scope (--production / --workspace)', () => {
    // In-range fixes (1.0.0 → 1.5.0, admitted by the declared ^1.0.0) so the ONLY
    // filter under test is scope — not the compat/manifest gate.
    const spec = {
      prodvuln: { '1.0.0': {}, '1.5.0': {} },
      devvuln: { '1.0.0': {}, '1.5.0': {} },
    }
    const report = {
      prodvuln: advisory('<1.5.0', '>=1.5.0'),
      devvuln: advisory('<1.5.0', '>=1.5.0'),
    }
    const lf = lock([
      { id: 'prodvuln@^1.0.0', version: '1.0.0' },
      { id: 'devvuln@^1.0.0', version: '1.0.0' },
    ])
    const manifest = {
      dependencies: { prodvuln: '^1.0.0' },
      devDependencies: { devvuln: '^1.0.0' },
    }
    const scopeCtx = (flags: Record<string, any>): TContext =>
      ({
        flags,
        registry: mockRegistry(spec),
        manifest,
        cwd: process.cwd(),
      }) as unknown as TContext
    // Resolved version of a package in a yarn-classic lock (order-independent;
    // the reformatted key is unquoted, e.g. `prodvuln@^1.0.0:`).
    const ver = (text: string, name: string): string | undefined =>
      new RegExp(`${name}@[^\\n]*:\\n  version "([^"]+)"`).exec(text)?.[1]

    it('--production fixes prod-reachable vulns and leaves dev-only ones', async () => {
      const out = format(
        await patch(
          parse(lf, 'yarn-classic'),
          report,
          scopeCtx({ silent: true, production: true }),
          'yarn-classic',
        ),
        'yarn-classic',
      )
      expect(ver(out, 'prodvuln')).toBe('1.5.0') // prod-reachable → bumped
      expect(ver(out, 'devvuln')).toBe('1.0.0') // dev-only → left for an unscoped run
    })

    it('without a scope flag, both are fixed (scope is opt-in, unchanged default)', async () => {
      const out = format(
        await patch(
          parse(lf, 'yarn-classic'),
          report,
          scopeCtx({ silent: true }),
          'yarn-classic',
        ),
        'yarn-classic',
      )
      expect(ver(out, 'prodvuln')).toBe('1.5.0')
      expect(ver(out, 'devvuln')).toBe('1.5.0')
    })

    it('reports the scope + out-of-scope skips (count by default, list under --verbose)', async () => {
      const summary = await capture(() =>
        patch(
          parse(lf, 'yarn-classic'),
          report,
          scopeCtx({ silent: false, production: true }),
          'yarn-classic',
        ),
      )
      expect(summary).toMatch(/Scope: production/)
      expect(summary).toMatch(
        /Skipped 1 package\(s\) outside production scope \(--verbose to list\)/,
      )

      const verbose = await capture(() =>
        patch(
          parse(lf, 'yarn-classic'),
          report,
          scopeCtx({ silent: false, production: true, verbose: true }),
          'yarn-classic',
        ),
      )
      expect(verbose).toMatch(
        /Skipped \(outside production scope\): devvuln@1\.0\.0/,
      )
    })
  })

  describe('--json summary (ctx.summary)', () => {
    const spec = {
      consumer: { '1.0.0': {} },
      skipme: { '1.0.0': {}, '2.0.0': {} }, // cross-major → consumer-range skip
      up: { '1.0.0': {}, '1.5.0': {} }, // in-range → upgraded
      exme: { '1.0.0': {}, '2.0.0': {} }, // --exclude
      nofixme: { '1.0.0': {} }, // no published fix
    }
    const report = {
      skipme: advisory('<2.0.0', '>=2.0.0'),
      up: advisory('<1.5.0', '>=1.5.0'),
      exme: advisory('<2.0.0', '>=2.0.0'),
      nofixme: advisory('<99.0.0', '>=99.0.0'),
    }
    const lf = lock([
      { id: 'consumer@^1.0.0', version: '1.0.0', deps: { skipme: '^1.0.0' } },
      { id: 'skipme@^1.0.0', version: '1.0.0' },
      { id: 'up@^1.0.0', version: '1.0.0' },
      { id: 'exme@^1.0.0', version: '1.0.0' },
      { id: 'nofixme@^1.0.0', version: '1.0.0' },
    ])

    it('records upgraded / skipped / excluded / no-fix on ctx.summary', async () => {
      const c = ctx({ silent: true, exclude: 'exme' }, mockRegistry(spec))
      await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic')
      const s = c.summary!
      expect(s.dryRun).toBe(false)
      expect(s.upgraded).toEqual([{ name: 'up', from: '1.0.0', to: '1.5.0' }])
      expect(s.excluded).toEqual(['exme@1.0.0'])
      expect(s.noFix).toEqual(['nofixme@1.0.0'])
      expect(s.skipped).toContainEqual({
        package: 'skipme@1.0.0 → 2.0.0',
        reason: 'consumer-range',
      })
    })

    it('flags dryRun and prints nothing human under --json', async () => {
      const c = ctx(
        { json: true, 'dry-run': true, exclude: 'exme' },
        mockRegistry(spec),
      )
      const out = await capture(() =>
        patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
      )
      expect(out).toBe('') // --json suppresses the human summary in _patch
      expect(c.summary!.dryRun).toBe(true)
      expect(c.summary!.upgraded).toEqual([
        { name: 'up', from: '1.0.0', to: '1.5.0' },
      ])
    })

    it('emits an empty-but-shaped summary when the audit finds nothing', async () => {
      const c = ctx({ silent: true }, mockRegistry({}))
      await patch(
        parse(lock([{ id: 'x@^1.0.0', version: '1.0.0' }]), 'yarn-classic'),
        {},
        c,
        'yarn-classic',
      )
      expect(c.summary).toEqual({
        dryRun: false,
        upgraded: [],
        skipped: [],
        excluded: [],
        noFix: [],
      })
    })
  })

  describe('manifest gate (direct-dep whose declared range the fix falls outside)', () => {
    const report = { lodash: advisory('<4.18.0', '>=4.18.0') }
    const spec = { lodash: { '4.17.11': {}, '4.18.0': {} } }
    const ctxM = (
      flags: Record<string, any>,
      manifest: Record<string, any>,
    ): TContext =>
      ({
        flags,
        registry: mockRegistry(spec),
        manifest,
        cwd: process.cwd(),
      }) as unknown as TContext

    it('flags + skips a non-admitting direct-dep pin by default (no bump, no rewrite)', async () => {
      const lf = lock([{ id: 'lodash@4.17.11', version: '4.17.11' }]) // exact pin
      const manifest = { dependencies: { lodash: '4.17.11' } }
      const out = await capture(() =>
        patch(
          parse(lf, 'yarn-classic'),
          report,
          ctxM({ silent: false }, manifest),
          'yarn-classic',
        ),
      )
      expect(out).toMatch(/Skipped \(package\.json pins/)
      expect(out).toContain('lodash (pinned → "4.17.11")')
      const c = ctxM({ silent: true }, manifest)
      const patched = format(
        await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(patched).toContain('version "4.17.11"') // left at the vulnerable version
      expect(patched).not.toContain('version "4.18.0"')
      expect(c.manifestEdits).toBeUndefined()
    })

    it('records the range rewrite + applies the bump under --force', async () => {
      const lf = lock([{ id: 'lodash@4.17.11', version: '4.17.11' }])
      const c = ctxM(
        { silent: true, force: true },
        { dependencies: { lodash: '4.17.11' } },
      )
      const out = format(
        await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(out).toContain('version "4.18.0"') // bumped
      expect(c.manifestEdits).toEqual([
        expect.objectContaining({
          name: 'lodash',
          from: '4.17.11',
          to: '4.18.0',
        }),
      ])
    })

    // The gate records the rewrite before the apply phase runs, and the apply phase can
    // still drop the bump. package.json must not be rewritten for a bump that never
    // landed: the declaration would demand a version the lock does not hold, and yarn
    // re-resolves and rewrites the lockfile instead of installing it.
    it('does not rewrite package.json for a bump the apply phase drops', async () => {
      const spec2 = {
        core: {
          '1.0.0': { helpers: '^1.0.0' },
          '2.0.0': { helpers: '^3.0.0' },
        },
        helpers: { '1.0.0': {}, '2.0.0': {}, '3.0.0': {} },
      }
      // `core` first: its bump re-derives helpers@^3.0.0 and strands helpers@1.0.0, so
      // the helpers bump is superseded — after its manifest rewrite was already recorded.
      const report2 = {
        core: advisory('<2.0.0', '>=2.0.0'),
        helpers: advisory('<2.0.0', '>=2.0.0'),
      }
      const c = {
        flags: { silent: true, force: true },
        registry: mockRegistry(spec2),
        manifest: { dependencies: { helpers: '1.0.0' } }, // exact pin → gate rewrites it
        cwd: process.cwd(),
      } as unknown as TContext
      const lf = lock([
        { id: 'core@^1.0.0', version: '1.0.0', deps: { helpers: '^1.0.0' } },
        { id: 'helpers@^1.0.0', version: '1.0.0' },
      ])

      const out = format(
        await patch(parse(lf, 'yarn-classic'), report2, c, 'yarn-classic'),
        'yarn-classic',
      )

      expect(c.manifestEdits ?? []).toEqual([]) // nothing to write
      // `core@2.0.0` landed and pulled helpers@3.0.0; the planned helpers 2.0.0 did not.
      const helperVersions = out
        .split('\n\n')
        .filter((b) => b.startsWith('helpers@') || b.startsWith('"helpers@'))
        .map((b) => /version "([^"]+)"/.exec(b)?.[1])
      expect(helperVersions).not.toContain('2.0.0')
      expect(c.summary?.skipped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ reason: 'superseded' }),
        ]),
      )
    })

    it('preserves the pin operator in the rewrite (~4.17.0 → ~4.18.0)', async () => {
      const lf = lock([{ id: 'lodash@~4.17.0', version: '4.17.11' }])
      const c = ctxM(
        { silent: true, force: true },
        { dependencies: { lodash: '~4.17.0' } },
      )
      await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic')
      expect(c.manifestEdits).toEqual([
        expect.objectContaining({
          name: 'lodash',
          from: '~4.17.0',
          to: '~4.18.0',
        }),
      ])
    })

    it('does NOT trip when the declared range already admits the fix (caret)', async () => {
      const lf = lock([{ id: 'lodash@^4.17.0', version: '4.17.11' }])
      const c = ctxM({ silent: true }, { dependencies: { lodash: '^4.17.0' } })
      const out = format(
        await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(out).toContain('version "4.18.0"') // ^4.17.0 admits 4.18.0 → bumped
      expect(c.manifestEdits).toBeUndefined() // no manifest change
    })

    it('flags a pin declared in devDependencies (not just dependencies)', async () => {
      const lf = lock([{ id: 'lodash@4.17.11', version: '4.17.11' }])
      const c = ctxM(
        { silent: true },
        { devDependencies: { lodash: '4.17.11' } },
      )
      const out = format(
        await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(out).toContain('version "4.17.11"') // skipped
      expect(c.manifestEdits).toBeUndefined()
    })

    it('mixes: a non-admitting pin is flagged while an admitting sibling still bumps (--force)', async () => {
      const spec2 = {
        lodash: { '4.17.11': {}, '4.18.0': {} },
        minimist: { '1.2.5': {}, '1.2.6': {} },
      }
      const lf = lock([
        { id: 'lodash@4.17.11', version: '4.17.11' },
        { id: 'minimist@^1.2.0', version: '1.2.5' },
      ])
      const report2 = {
        lodash: advisory('<4.18.0', '>=4.18.0'),
        minimist: advisory('<1.2.6', '>=1.2.6'),
      }
      const c = {
        flags: { silent: true, force: true },
        registry: mockRegistry(spec2),
        manifest: { dependencies: { lodash: '4.17.11', minimist: '^1.2.0' } },
        cwd: process.cwd(),
      } as unknown as TContext
      const out = format(
        await patch(parse(lf, 'yarn-classic'), report2, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(out).toContain('version "4.18.0"') // lodash: --force rewrote the pin → bumped
      expect(out).toContain('version "1.2.6"') // minimist: ^1.2.0 admits it → bumped, no rewrite
      expect(c.manifestEdits).toEqual([
        expect.objectContaining({
          name: 'lodash',
          from: '4.17.11',
          to: '4.18.0',
        }),
      ])
    })

    it('leaves a non-semver range (workspace:) alone — the validRange guard skips the gate', async () => {
      const lf = lock([{ id: 'lodash@4.17.11', version: '4.17.11' }])
      const c = ctxM(
        { silent: true, force: true },
        { dependencies: { lodash: 'workspace:*' } },
      )
      const out = format(
        await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(out).toContain('version "4.18.0"') // not gated → bumped via the normal path
      expect(c.manifestEdits).toBeUndefined() // never rewritten
    })

    it('a `*` range admits every fix — no trip', async () => {
      const lf = lock([{ id: 'lodash@*', version: '4.17.11' }])
      const c = ctxM({ silent: true }, { dependencies: { lodash: '*' } })
      const out = format(
        await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic'),
        'yarn-classic',
      )
      expect(out).toContain('version "4.18.0"') // bumped
      expect(c.manifestEdits).toBeUndefined()
    })

    it('widens a complex range the fix falls outside → caret of the fix', async () => {
      const lf = lock([{ id: 'lodash@>=4.0.0 <4.17.12', version: '4.17.11' }])
      const c = ctxM(
        { silent: true, force: true },
        { dependencies: { lodash: '>=4.0.0 <4.17.12' } },
      )
      await patch(parse(lf, 'yarn-classic'), report, c, 'yarn-classic')
      expect(c.manifestEdits).toEqual([
        expect.objectContaining({
          name: 'lodash',
          from: '>=4.0.0 <4.17.12',
          to: '^4.18.0',
        }),
      ])
    })

    it('applyManifestEdit rewrites the range surgically, preserving formatting', () => {
      const pkg =
        '{\n  "dependencies": {\n    "@scope/x": "1.2.3",\n    "y": "^2.0.0"\n  }\n}\n'
      expect(
        applyManifestEdit(pkg, {
          name: '@scope/x',
          from: '1.2.3',
          to: '2.0.0',
        }),
      ).toBe(
        '{\n  "dependencies": {\n    "@scope/x": "2.0.0",\n    "y": "^2.0.0"\n  }\n}\n',
      )
    })

    it('applyManifestEdit updates every field the exact pin appears in', () => {
      const pkg =
        '{"dependencies":{"x":"1.0.0"},"devDependencies":{"x":"1.0.0"}}'
      expect(
        applyManifestEdit(pkg, { name: 'x', from: '1.0.0', to: '2.0.0' }),
      ).toBe('{"dependencies":{"x":"2.0.0"},"devDependencies":{"x":"2.0.0"}}')
    })

    it('applyManifestEdit is a no-op when the exact pin is absent (never touches ^1.0.0)', () => {
      const pkg = '{"dependencies":{"x":"^1.0.0","x-extra":"1.0.0"}}'
      expect(
        applyManifestEdit(pkg, { name: 'x', from: '1.0.0', to: '2.0.0' }),
      ).toBe(pkg)
    })
  })
})

// `refurbish` fills install-required fields a patched graph still lacks — today
// the yarn-berry zip `checksum`, recomputed from the npm tarball. Tarball bytes
// come from committed `.tgz` fixtures (no network), so the recompute is asserted
// byte-for-byte against the value yarn itself wrote.
describe('refurbish', () => {
  const tarballsDir = path.resolve(__dirname, '../fixtures/tarballs')
  // Disk-backed TarballSource → hermetic, deterministic checksum recompute.
  const diskTarballs = {
    tarball: async (name: string, version: string) => {
      try {
        return new Uint8Array(
          readFileSync(path.join(tarballsDir, `${name}-${version}.tgz`)),
        )
      } catch {
        return undefined
      }
    },
  }
  const rctx = (tarballSource?: any): TContext =>
    ({
      flags: { silent: true },
      tarballSource,
      cwd: process.cwd(),
    }) as unknown as TContext

  const grabChecksum = (text: string, name: string): string | undefined =>
    new RegExp(
      `"${name}@npm:[^"]*":[\\s\\S]*?\\n  checksum: (10c0/[0-9a-f]+)`,
    ).exec(text)?.[1]

  it('recomputes the yarn-berry checksum byte-for-byte from the tarball', async () => {
    const v4 = path.resolve(__dirname, '../fixtures/lockfile/v4/yarn.lock')
    const input = readFileSync(v4, 'utf-8')
    const expected = {
      'color-name': grabChecksum(input, 'color-name'),
      'has-flag': grabChecksum(input, 'has-flag'),
    }
    expect(expected['color-name']).toBeTruthy()

    // Strip the two checksums to mimic freshly-added nodes lacking them.
    let stripped = input
    for (const cks of Object.values(expected))
      stripped = stripped.replace(`\n  checksum: ${cks}`, '')
    expect(stripped).not.toEqual(input)

    const fmt = getLockfileType(stripped)
    const out = format(
      await refurbish(parse(stripped, fmt), fmt, rctx(diskTarballs)),
      fmt,
    )

    for (const [name, cks] of Object.entries(expected))
      expect(grabChecksum(out, name)).toBe(cks)
    // Restoring exactly the two stripped fields round-trips to the original.
    expect(out).toBe(input)
  })

  // Berry entries are blank-line separated. Scope lookups to a single entry —
  // `grabChecksum`'s [\s\S]*? happily runs past the entry it was aimed at and
  // reports the NEXT one's checksum when the target has none.
  const entryBlock = (text: string, name: string): string =>
    text.split('\n\n').find((b) => b.startsWith(`"${name}@npm:`)) ?? ''
  const checksumIn = (text: string, name: string): string | undefined =>
    /\n {2}checksum: (10c0\/[0-9a-f]+)/.exec(entryBlock(text, name))?.[1]
  // Drop a whole entry, so the resulting graph lacks that node — i.e. the patch
  // "added" it.
  const dropEntry = (text: string, name: string): string =>
    text
      .split('\n\n')
      .filter((b) => !b.startsWith(`"${name}@npm:`))
      .join('\n\n')

  it('scoped to the patch: fills an added node, leaves an untouched bare one alone', async () => {
    const v4 = path.resolve(__dirname, '../fixtures/lockfile/v4/yarn.lock')
    const input = readFileSync(v4, 'utf-8')
    const added = checksumIn(input, 'color-name')! // stands in for a patch-added node
    const untouched = checksumIn(input, 'has-flag')! // bare in the input already

    // Both bare; only `color-name` is absent from the base ⇒ only it is in scope.
    const stripped = input
      .replace(`\n  checksum: ${added}`, '')
      .replace(`\n  checksum: ${untouched}`, '')
    const fmt = getLockfileType(stripped)
    const base = parse(dropEntry(stripped, 'color-name'), fmt)

    const out = format(
      await refurbish(parse(stripped, fmt), fmt, rctx(diskTarballs), base),
      fmt,
    )

    // The added node gets its checksum recomputed…
    expect(checksumIn(out, 'color-name')).toBe(added)
    // …while the one the input lock never had stays bare. Filling it would only
    // get stripped back out by the next `yarn install` (yarn records checksums
    // solely for packages it actually fetched — e.g. platform-gated optional deps
    // carry `conditions:` and no checksum).
    expect(checksumIn(out, 'has-flag')).toBeUndefined()
  })

  // A parsed node carries one integrity origin and one resolution carrier; only a
  // node MINTED from a packument (`sri`/`registry` + `#shasum`) and then repaired by
  // `refurbish` (`berry-zip`) carries two, which is what strict projection has to
  // handle. Every other fixture here is parse-derived, so this is the only one that
  // exercises it — hence the STRICT emit assertion, no `strict:false` fallback.
  it('mints a node from a packument, repairs it, and still emits strictly', async () => {
    const v4 = path.resolve(__dirname, '../fixtures/lockfile/v4/yarn.lock')
    const known = checksumIn(readFileSync(v4, 'utf-8'), 'color-name')!
    // A lock holding the OLD version, so the fix (1.1.4) has to be minted from the
    // packument — the shape a parse-derived fixture can never produce.
    const lock = `# This file is generated by running "yarn install" inside your project.
# Manual changes might be lost - proceed with caution!

__metadata:
  version: 8
  cacheKey: 10c0

"root@workspace:.":
  version: 0.0.0-use.local
  resolution: "root@workspace:."
  dependencies:
    color-name: "npm:^1.1.3"
  languageName: unknown
  linkType: soft

"color-name@npm:^1.1.3":
  version: 1.1.3
  resolution: "color-name@npm:1.1.3"
  checksum: 10c0/${'a'.repeat(128)}
  languageName: node
  linkType: hard
`
    const fmt = getLockfileType(lock)

    const tgz = readFileSync(path.join(tarballsDir, 'color-name-1.1.4.tgz'))
    const SHASUM = createHash('sha1').update(tgz).digest('hex')
    const version = {
      name: 'color-name',
      version: '1.1.4',
      dependencies: {},
      // Both non-berry hash carriers a real packument has: a registry SRI and a
      // `#shasum` fragment on the tarball url.
      integrity: `sha512-${createHash('sha512').update(tgz).digest('base64')}`,
      dist: {
        integrity: `sha512-${createHash('sha512').update(tgz).digest('base64')}`,
        shasum: SHASUM,
        tarball: `https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz#${SHASUM}`,
      },
      tarball: `https://registry.npmjs.org/color-name/-/color-name-1.1.4.tgz#${SHASUM}`,
    }
    const registry = {
      packument: async (n: string) =>
        n === 'color-name'
          ? {
              name: n,
              distTags: { latest: '1.1.4' },
              versions: { '1.1.4': version },
            }
          : undefined,
      resolve: async (n: string) => (n === 'color-name' ? version : undefined),
    }

    const patched = await patch(
      parse(lock, fmt),
      { 'color-name': advisory('<1.1.4', '>=1.1.4') },
      {
        flags: { silent: true, force: true },
        registry,
        cwd: process.cwd(),
      } as unknown as TContext,
      fmt,
    )
    const repaired = await refurbish(patched, fmt, rctx(diskTarballs))

    // The minted node now carries a berry-zip checksum AND the packument's own
    // origins. `format` is strict-by-default and only tolerates ENRICH_REQUIRED, so
    // if the extra origins are misjudged as an irreducible loss this throws.
    const out = format(repaired, fmt)
    expect(out).toContain('color-name@npm:1.1.4')
    expect(checksumIn(out, 'color-name')).toBe(known)
  })

  it('scoped to the patch: an empty diff fills nothing', async () => {
    const v4 = path.resolve(__dirname, '../fixtures/lockfile/v4/yarn.lock')
    const input = readFileSync(v4, 'utf-8')
    const cks = checksumIn(input, 'color-name')!
    const stripped = input.replace(`\n  checksum: ${cks}`, '')
    const fmt = getLockfileType(stripped)
    const graph = parse(stripped, fmt)

    // base === the patched graph ⇒ the patch introduced nothing ⇒ nothing in scope.
    // (refurbish still fetches a few *anchor* tarballs to calibrate its checksum
    // recompute against known-good ones — that's reads, not writes, so assert on
    // the output instead of on fetch count.)
    const out = format(
      await refurbish(graph, fmt, rctx(diskTarballs), graph),
      fmt,
    )

    expect(out).toBe(stripped) // byte-identical: not a single field touched
    expect(checksumIn(out, 'color-name')).toBeUndefined()
  })

  // The mirror image: a node the patch replaced in place keeps its id, so an
  // id-diff reports nothing added — while its checksum is gone. Unseeded, the lock
  // ships bare and the next `yarn install` rewrites it.
  it('scoped to the patch: refills a checksum a kept id lost', async () => {
    const v4 = path.resolve(__dirname, '../fixtures/lockfile/v4/yarn.lock')
    const input = readFileSync(v4, 'utf-8')
    const cks = checksumIn(input, 'color-name')!
    const stripped = input.replace(`\n  checksum: ${cks}`, '')
    const fmt = getLockfileType(stripped)

    const out = format(
      await refurbish(
        parse(stripped, fmt),
        fmt,
        rctx(diskTarballs),
        parse(input, fmt), // same ids on both sides — only the checksum differs
      ),
      fmt,
    )

    expect(checksumIn(out, 'color-name')).toBe(cks)
    expect(out).toBe(input)
  })

  it('is a no-op for yarn-classic (nodes already complete)', async () => {
    const input = lock([{ id: 'lodash@^4.17.0', version: '4.17.20' }])
    const fmt = getLockfileType(input)
    // No tarballSource needed: classic is skipped entirely.
    const out = format(await refurbish(parse(input, fmt), fmt, rctx()), fmt)
    expect(out).toBe(format(parse(input, fmt), fmt))
  })

  it('throws on an unrecognised lockfile format', async () => {
    await expect(refurbish({} as any, undefined, rctx())).rejects.toThrow(
      'Unsupported lockfile format',
    )
  })

  it('defers bare-era (yarn-3 / berry-v6) checksums it cannot prove — never corrupts them', async () => {
    const v3 = path.resolve(__dirname, '../fixtures/lockfile/v3/yarn.lock')
    const input = readFileSync(v3, 'utf-8')
    // strip the checksum to mimic a freshly-added node refurbish would fill
    const stripped = input.replace(/\n {2}checksum: [0-9a-f]+/, '')
    expect(stripped).not.toEqual(input)
    const fmt = getLockfileType(stripped)
    expect(fmt).toBe('yarn-berry-v6')

    const source = { tarball: async () => undefined }
    const out = format(
      await refurbish(parse(stripped, fmt), fmt, rctx(source)),
      fmt,
    )

    // yarn 2.x/3.x checksums are bare (no cacheKey prefix); the key lives in the
    // `__metadata.cacheKey` header. With no tarball bytes to rebuild the archive
    // from, refurbish must defer — leave the line out and let `yarn install`
    // self-heal — never fill a guess. Guards the snapshot.73 "fill with
    // 10c0/<hex> STORE form" lock-corruption regression.
    expect(out).not.toMatch(/10c0\//)
    expect(out).toBe(stripped)
  })

  // Capture console.warn (no ctx.progress ⇒ refurbish warns through it).
  const captureWarn = async (flags: Record<string, any>): Promise<string> => {
    const v3 = path.resolve(__dirname, '../fixtures/lockfile/v3/yarn.lock')
    const stripped = readFileSync(v3, 'utf-8').replace(
      /\n {2}checksum: [0-9a-f]+/,
      '',
    )
    const fmt = getLockfileType(stripped)
    const lines: string[] = []
    const orig = console.warn
    console.warn = (...a: any[]) => void lines.push(a.map(String).join(' '))
    try {
      const ctx = {
        flags,
        cwd: process.cwd(),
        tarballSource: { tarball: async () => undefined },
      } as unknown as TContext
      await refurbish(parse(stripped, fmt), fmt, ctx)
    } finally {
      console.warn = orig
    }
    return lines.join('\n')
  }

  it('warns about deferred checksums when not silent (collapsed count)', async () => {
    const out = await captureWarn({ silent: false })
    expect(out).toMatch(/Could not compute checksums for 1 package/)
    expect(out).toMatch(/1× ENRICH_CHECKSUM_DEFERRED/)
  })

  it('lists each deferred checksum under --verbose', async () => {
    const out = await captureWarn({ silent: false, verbose: true })
    expect(out).toMatch(/\[\w+\] ENRICH_CHECKSUM_DEFERRED:/)
  })
})
