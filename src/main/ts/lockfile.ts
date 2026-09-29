import {
  detect,
  LockfileError,
  parse as lfParse,
  refurbish as lfRefurbish,
  stringify as lfStringify,
} from 'lockgraph'
import type { FormatId, Graph, NodeId, OverrideConstraint } from 'lockgraph'
import sv from 'semver'

import {
  buildRegistry,
  buildTarballSource,
  ecosystemFor,
} from './audit/adapter'
import {
  collectManifestFiles,
  manifestDirectRanges,
  manifestsByWorkspace,
} from './audit/manifest'
import { packumentLookups } from './audit/packuments'
import { toPolicy } from './audit/overrides'
import { resolvePolicy } from './audit/policy'
import { parsePackageRules } from './audit/filter'
import { retargetDeclarations } from './audit/gates'
import { remediate } from './audit/remediate'
import type { ApplyDeps } from './audit/apply'
import { buildSummary, deferredReasons, renderReport } from './audit/report'
import type { ConstraintSkip, Ledger, Plan } from './audit/report'
import { auditViaRegistry } from './audit/registry'
import {
  TAuditReport,
  TContext,
  TLockfileObject,
  TLockfileType,
  TManifestEdit,
} from './ifaces'

export const getLockfileType = (lockfile: string): TLockfileType =>
  detect(lockfile)

export const _parse = (
  lockfile: string,
  lockfileType: TLockfileType,
  workspaceRoot?: string,
  manifest?: Record<string, any>,
  onDiagnostic?: (d: { code?: string; message?: string }) => void,
): TLockfileObject => {
  if (lockfileType === undefined) {
    throw new Error('Unsupported lockfile format')
  }
  // cwd lets the berry adapter resolve builtin patch hashes; without it, re-serialised
  // patch entries break `yarn install`. `sources.policy` supplies the project's declared
  // overrides/resolutions so the graph carries them (Bug #99: the yarn family also needs
  // them at parse to bind a `resolutions`-pinned edge before completion runs).
  const policy = toPolicy(manifest, ecosystemFor(lockfileType))
  return lfParse(lockfile, lockfileType as FormatId, {
    cwd: workspaceRoot,
    // Anchors exist for the one format that needs them: a yarn v1 lock has no entry for
    // the root or its workspaces, so only a manifest can tell a root-held descriptor from
    // a stale one. Every other format carries its root in the lock, and an empty or
    // partial manifest would just prune live entries.
    manifests:
      manifest && lockfileType === 'yarn-classic'
        ? manifestsByWorkspace(workspaceRoot, manifest)
        : undefined,
    sources: policy ? { policy } : undefined,
    onDiagnostic,
  })
}

export const _format = (
  lockfile: TLockfileObject,
  lockfileType: TLockfileType,
): string => {
  if (lockfileType === undefined) {
    throw new Error('Unsupported lockfile format')
  }
  // The project's declared overrides re-emit automatically from the graph (0.6.1 carries
  // them through parse→mutate), so a PM that stores them in the lock (pnpm's `overrides:`)
  // round-trips clean — no explicit option needed (stringify dropped it).
  try {
    // stringify is STRICT by default: a projection loss fails closed instead of silently
    // emitting a frozen-invalid lock. Keep that net.
    return lfStringify(lockfile as Graph, lockfileType as FormatId)
  } catch (e) {
    // The one loss yaf accepts: `ENRICH_REQUIRED` means every loss is *recoverable*
    // — a berry-zip `checksum` `refurbish` couldn't fill or prove (see its
    // `data.reason`). That's yaf's documented deferred-checksum model: emit
    // the lock and let the user finish with `yarn install` (`refurbish` already
    // reported it). Any other error (e.g. `IRREDUCIBLE_LOSS`) still fails closed.
    //
    // The retry is `strict: false`, which silences EVERY loss — so check the list,
    // not the code alone. A meaningful loss riding along on an `ENRICH_REQUIRED`
    // would otherwise be emitted silently, which is how a real projection defect
    // can hide behind a deferred checksum.
    if (
      e instanceof LockfileError &&
      e.code === 'ENRICH_REQUIRED' &&
      !(e.losses ?? []).some((l) => l.class === 'inherent-meaningful')
    )
      return lfStringify(lockfile as Graph, lockfileType as FormatId, {
        strict: false,
      })
    throw e
  }
}

/** Report suffix naming the manifest file — empty for the root, `in <rel>` for a
 *  workspace, so a monorepo skip/rewrite says which package.json it means. */

/**
 * Upgrade every vulnerable node to the lowest published version that clears its
 * advisory — then pull in that version's *new* transitive dependency closure so
 * the lockfile stays complete. Versions resolve from the registry packument
 * (no shell-out); `replaceVersion` rebinds, `completeTransitives` fills the new
 * deps, `pruneOrphans` retires the old closure the upgrade stranded. Async since
 * the registry is hit over HTTP.
 */

export const _patch = async (
  lockfile: TLockfileObject,
  report: TAuditReport,
  ctx: TContext,
  lockfileType: TLockfileType,
  overrides: readonly OverrideConstraint[] = [],
): Promise<TLockfileObject> => {
  const { flags } = ctx
  const { constraints, constraintSummary, engineTargets, onConflict } =
    resolvePolicy(ctx)
  if (Object.keys(report).length === 0) {
    ctx.summary = {
      dryRun: !!flags['dry-run'],
      upgraded: [],
      skipped: [],
      excluded: [],
      noFix: [],
    }
    !flags.silent && !flags.json && console.log('Audit check found no issues')
    return lockfile
  }

  let graph = lockfile as Graph
  const registry = buildRegistry(ctx, ecosystemFor(lockfileType))
  const excludeRules = parsePackageRules(flags.exclude)
  const excluded = new Set<string>()
  const noFix = new Set<string>()
  const incompatible = new Map<string, Set<string>>()
  // A root override/resolution the fix can't satisfy is authoritative: mirror
  // `npm audit fix --force`, which leaves such a pin untouched (never rewrites it)
  // and leaves the package flagged. spec → the pinned target (for the report).
  const pinned = new Map<string, string>()
  // A DIRECT dep (declared in the root OR a workspace package.json) whose range
  // can't admit the fix. Default → flag it (`manifestPinned`: name → the blocking
  // declarations). --force → rewrite the range in each declaring file
  // (`manifestEdits`, applied per-file by patchLockfile).
  const manifestFiles = collectManifestFiles(ctx.cwd, ctx.manifest)
  const directRanges = manifestDirectRanges(manifestFiles)
  // Fix scope (`--production` / `--workspace`) is re-derived inside each remediation
  // round, since node ids move with every applied bump.
  const scopeSkipped = new Set<string>()
  const manifestPinned = new Map<string, { range: string; file: string }[]>()
  const manifestEdits: TManifestEdit[] = []
  // A fix skipped because its completed closure can't satisfy an active constraint
  // (engines or license) for some new transitive (COMPLETION_NO_CANDIDATE). Keyed
  // by "name@ver → fix", value = the diagnostic payload (depName / range / rejected).
  const constraintSkipped = new Map<string, ConstraintSkip>()

  const ledger: Ledger = {
    excluded,
    noFix,
    scopeSkipped,
    pinned,
    incompatible,
    manifestPinned,
    constraintSkipped,
    manifestEdits,
    // Filled by the apply phase: a bump an earlier one in the same batch made moot.
    superseded: new Map(),
    // Parents this run moved up so a pinned transitive fix could land.
    raised: new Map(),
  }

  const { lowestFix, declaredRange, versionsAdmitting } =
    packumentLookups(registry)

  // Live count of nodes pulled in (the slow part — a packument fetch each).
  let completed = 0
  const onCompletionDiag = (d: { code?: string }): void => {
    if (d.code === 'COMPLETION_NODE_ADDED')
      ctx.progress?.label(`Completing the tree… ${++completed}`)
  }

  const applyDeps: ApplyDeps = {
    target: lockfileType as FormatId,
    registry,
    overrideList: [...overrides],
    onCompletionDiag,
  }
  const outcome = await remediate({
    graph,
    report,
    ctx,
    overrides,
    excludeRules,
    manifestFiles,
    directRanges,
    ledger,
    lookups: { lowestFix, declaredRange, versionsAdmitting },
    policy: { constraints, constraintSummary, onConflict },
    applyDeps,
    constraintSkipped,
  })
  graph = outcome.graph
  const applied: Plan[] = outcome.applied
  const completionDiagnostics = outcome.diagnostics
  const inScope = outcome.inScope

  // A gate let the bump through, but the apply phase can still drop it — a constraint
  // rejects its closure, or an earlier bump in the batch supersedes it. Rewriting
  // package.json for a bump that never landed would leave the declaration demanding a
  // version the lock does not hold, which is the one thing yarn refuses to install
  // around: it re-resolves and rewrites the lockfile. So keep only the landed edits,
  // and keep the ledger in step so the report names what is actually on disk.
  const landed = new Set(applied.map((p) => p.name))
  const dropped = manifestEdits.filter((e) => !landed.has(e.name))
  if (dropped.length > 0)
    manifestEdits.splice(
      0,
      manifestEdits.length,
      ...manifestEdits.filter((e) => landed.has(e.name)),
    )
  if (manifestEdits.length > 0) ctx.manifestEdits = manifestEdits

  // `--force` just rewrote declared ranges in package.json; bring the lockfile's own
  // declarations along so yarn doesn't re-resolve and reject the result. After the apply
  // phase the bumped version is already in the graph, so each declaration binds to it at
  // once — no pending state, no second completion.
  graph = await retargetDeclarations(
    graph,
    manifestEdits,
    lockfileType as FormatId,
    ctx.cwd,
  )

  // Report what the user GETS, not what we asked for: the planned fix is a floor,
  // and completion resolves each descriptor to the highest match — so `^1.1.18`
  // lands on 1.1.21. Reading it back off the final graph keeps both the printed
  // report and the `--json` contract honest.
  const settled = applied.map((u) => ({
    ...u,
    fix: deliveredFix(graph as Graph, u.name, u.fix),
  }))

  ctx.summary = buildSummary(!!flags['dry-run'], ledger, settled, report)

  if (!flags.silent && !flags.json)
    renderReport({
      ctx,
      policy: { constraintSummary, engineTargets },
      ledger,
      applied: settled,
      report,
      inScope,
      completionDiagnostics,
    })

  return graph
}

/**
 * The version the final lock bound for an applied fix. The planned fix is only a
 * floor: completion resolves each descriptor to the highest match (`^1.1.18` → 1.1.21),
 * and a parent's own bump can change what it asks for, retiring the line entirely
 * (a `minimatch` bump moving from `brace-expansion@^2.0.1` to `^5.0.2`). So prefer the
 * node still in the planned major, else the single higher line that replaced it, and
 * keep the planned number when neither is unambiguous — a wrong version in the report
 * is no better than a stale one.
 */
const deliveredFix = (graph: Graph, name: string, planned: string): string => {
  if (!sv.valid(planned)) return planned
  const atLeastPlanned = graph
    .byName(name)
    .map((id) => graph.getNode(id)?.version)
    .filter(
      (v): v is string => !!v && sv.valid(v) !== null && sv.gte(v, planned),
    )
  const sameMajor = atLeastPlanned.filter(
    (v) => sv.major(v) === sv.major(planned),
  )
  for (const candidates of [sameMajor, atLeastPlanned])
    if (candidates.length === 1) return candidates[0]
  return planned
}

const hasBerryChecksum = (g: Graph, id: NodeId): boolean =>
  (g.tarballOf(id)?.integrity?.hashes ?? []).some(
    (h) => h.origin === 'berry-zip',
  )

/**
 * What `refurbish` has to look at: everything the patch introduced, plus any node
 * that had a berry checksum in the input lock and no longer does. The second set
 * matters because the diff is by node id — a node re-minted from a packument at the
 * same name@version keeps its id, so it reads as untouched while its checksum is
 * gone. That absence is ours, not yarn's: a package yarn deliberately left bare
 * (platform-gated optional dep) never carried one to begin with, so it stays out.
 */
const refurbishSeed = (base: Graph, next: Graph): ReadonlySet<NodeId> => {
  const before = new Set<NodeId>()
  for (const n of base.nodes()) before.add(n.id)
  const seed = new Set<NodeId>()
  for (const n of next.nodes())
    if (
      !before.has(n.id) ||
      (hasBerryChecksum(base, n.id) && !hasBerryChecksum(next, n.id))
    )
      seed.add(n.id)
  return seed
}

/**
 * Fill install-required fields the patched graph still lacks, so the written
 * lockfile needs no reconcile `yarn install`. Today that's only the yarn-berry
 * zip `checksum`: `completeTransitives` resolves new nodes' `integrity` from the
 * packument, but the berry `checksum` is a hash of yarn's *own* zip, derivable
 * only from the tarball bytes — so `refurbish` fetches them and recomputes
 * (byte-identical to what `yarn install` would write). yarn-classic nodes are
 * already complete (resolved + integrity), so it's a no-op there. Async (HTTP).
 *
 * Scoped to what the patch introduced (`base` = the pre-patch graph). A checksum
 * missing from the INPUT lock is yarn's own doing, not a gap to close: yarn only
 * records checksums for packages it actually fetched, so a platform-gated optional
 * dep (`conditions: os=… & cpu=…`) is deliberately left bare. Filling those makes
 * the next `yarn install` strip them right back out — a dirty lockfile for no gain.
 * Omit `base` to refurbish every node (standalone use).
 */
export const _refurbish = async (
  lockfile: TLockfileObject,
  lockfileType: TLockfileType,
  ctx: TContext,
  base?: TLockfileObject,
): Promise<TLockfileObject> => {
  if (lockfileType === undefined) {
    throw new Error('Unsupported lockfile format')
  }
  if (!lockfileType.startsWith('yarn-berry')) return lockfile

  const source = buildTarballSource(ctx, ecosystemFor(lockfileType))
  // Live count of recomputed checksums — the tarball fetches are the slowest
  // phase, so surface progress as each one lands.
  let filled = 0
  const result = await lfRefurbish(
    lockfile as Graph,
    lockfileType as FormatId,
    source,
    {
      seed: base && refurbishSeed(base as Graph, lockfile as Graph),
      onDiagnostic: (d: { code?: string }) => {
        if (d.code === 'ENRICH_FIELD_FILLED')
          ctx.progress?.label(`Recomputing checksums… ${++filled}`)
      },
    },
  )

  if (!ctx.flags.silent) {
    const warn = ctx.progress ? ctx.progress.log : console.warn
    // `unresolved` carries *every* diagnostic, including successful fills — so
    // surface only genuine gaps: a node whose checksum couldn't be recomputed or
    // proven (no tarball bytes, an unknown cacheKey, a recipe that doesn't
    // reproduce — lockgraph names it in `data.reason`). Those still need a real
    // `yarn install` to finish the lockfile.
    const deferred = result.unresolved.filter(
      (d) => d.code === 'ENRICH_CHECKSUM_DEFERRED',
    )
    if (deferred.length > 0) {
      warn(
        `Could not compute checksums for ${deferred.length} package(s)${deferredReasons(deferred)} — run \`yarn install\` to finish the lockfile:`,
      )
      reportDiagnostics(deferred, ctx.flags.verbose, warn)
    }
  }

  return result.graph as TLockfileObject
}

/**
 * Print graph diagnostics: one count per code, or per-entry on verbose. mutate()
 * re-emits parse-time noise (hundreds of lines), so collapse it unless asked.
 */
const reportDiagnostics = (
  diagnostics: readonly { severity: string; code: string; message: string }[],
  verbose?: boolean,
  log: (line: string) => void = console.warn,
): void => {
  if (diagnostics.length === 0) return

  if (verbose) {
    for (const d of diagnostics) {
      log(`  [${d.severity}] ${d.code}: ${d.message}`)
    }
    return
  }

  const counts = new Map<string, number>()
  for (const d of diagnostics) {
    counts.set(d.code, (counts.get(d.code) ?? 0) + 1)
  }
  for (const [code, n] of counts) {
    log(`  ${n}× ${code}${n > 1 ? ' (run with --verbose for details)' : ''}`)
  }
}

/**
 * Fetch advisories straight from the registry (npm bulk endpoint) for the parsed
 * graph — no `(yarn|npm) audit` child process. Registry / scope / auth resolve
 * from `.npmrc` / `.yarnrc.yml` / `.yarnrc` + env. Async: HTTP can't be done
 * synchronously without spawning, which is exactly what we're moving away from.
 */
export const _audit = (
  graph: Graph,
  ctx: TContext,
  lockfileType: TLockfileType,
): Promise<TAuditReport> =>
  auditViaRegistry(graph, ctx, ecosystemFor(lockfileType))

// Exposed for test spies.
export const _internal = {
  _parse,
  _audit,
  _patch,
  _refurbish,
  _format,
}

export const parse: typeof _parse = (...args) => _internal._parse(...args)
export const audit: typeof _audit = (...args) => _internal._audit(...args)
export const patch: typeof _patch = (...args) => _internal._patch(...args)
export const refurbish: typeof _refurbish = (...args) =>
  _internal._refurbish(...args)
export const format: typeof _format = (...args) => _internal._format(...args)
