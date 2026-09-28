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
import { collectManifestFiles, manifestDirectRanges } from './audit/manifest'
import { toPolicy } from './audit/overrides'
import { resolvePolicy } from './audit/policy'
import { parsePackageRules } from './audit/filter'
import { resolveScope } from './audit/scope'
import { applyBatch, applyConstrained } from './audit/apply'
import {
  gateByConsumers,
  gateByManifest,
  realignManifestDescriptors,
} from './audit/gates'
import { planUpgrades } from './audit/plan'
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
    sources: policy ? { policy } : undefined,
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
  // Fix scope (`--production` / `--workspace`): the set of node ids reachable from
  // the scoped roots. `undefined` ⇒ no scope flag ⇒ no filtering (unchanged). A
  // vulnerable node outside it is left for a deliberate, unscoped run and reported.
  const inScope = resolveScope(flags, graph, manifestFiles, ctx.cwd)
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
  }

  // Lowest published version that clears the advisory (minimal bump), read from
  // the registry packument.
  const packCache = new Map<
    string,
    Awaited<ReturnType<typeof registry.packument>>
  >()
  const lowestFix = async (
    name: string,
    range: string,
  ): Promise<string | undefined> => {
    if (!packCache.has(name))
      packCache.set(name, await registry.packument(name))
    const pack = packCache.get(name)
    if (!pack) return undefined
    return Object.keys(pack.versions)
      .filter((v) => sv.valid(v) && sv.satisfies(v, range))
      .sort(sv.compare)[0] // undefined ⇒ nothing published clears it
  }

  const plans = await planUpgrades({
    graph,
    report,
    ctx,
    overrides,
    inScope,
    excludeRules,
    lowestFix,
    ledger,
  })
  const gatedPlans = gateByManifest(plans, directRanges, flags, ledger)
  if (manifestEdits.length > 0) ctx.manifestEdits = manifestEdits
  const upgrades = gateByConsumers(graph, gatedPlans, flags, ledger)

  // Apply: rebind each vulnerable range to its fix, complete the new transitive
  // closure, then drop whatever got orphaned. `applied` is the set that actually
  // lands — identical to `upgrades` unless the engine gate below drops one.
  const applied: Plan[] = []
  const completionDiagnostics: {
    severity: string
    code: string
    message: string
  }[] = []
  // Live count of nodes pulled in (the slow part — a packument fetch each).
  let completed = 0
  const onCompletionDiag = (d: { code?: string }): void => {
    if (d.code === 'COMPLETION_NODE_ADDED')
      ctx.progress?.label(`Completing the tree… ${++completed}`)
  }
  // Honor the project's declared pins: a NEW closure edge governed by an override
  // binds the pinned target verbatim (before the registry rung), so the completed
  // tree never contradicts `overrides`/`resolutions`.
  const overrideList = [...overrides]

  const applyDeps: ApplyDeps = {
    target: lockfileType as FormatId,
    registry,
    overrideList,
    onCompletionDiag,
  }
  const outcome =
    constraints.length === 0
      ? await applyBatch(graph, upgrades, applyDeps)
      : await applyConstrained(
          graph,
          upgrades,
          applyDeps,
          { constraints, constraintSummary, onConflict },
          constraintSkipped,
        )
  graph = outcome.graph
  applied.push(...outcome.applied)
  completionDiagnostics.push(...outcome.diagnostics)
  // `--force` just rewrote declared ranges in package.json; bring the lockfile's own
  // descriptors along so yarn doesn't re-resolve and reject the result.
  graph = realignManifestDescriptors(graph, manifestEdits)

  ctx.summary = buildSummary(!!flags['dry-run'], ledger, applied, report)

  if (!flags.silent && !flags.json)
    renderReport({
      ctx,
      policy: { constraintSummary, engineTargets },
      ledger,
      applied,
      report,
      inScope,
      completionDiagnostics,
    })

  return graph
}

/** Node ids present in `next` but not in `base` — everything the patch introduced. */
const addedNodes = (base: Graph, next: Graph): ReadonlySet<NodeId> => {
  const before = new Set<NodeId>()
  for (const n of base.nodes()) before.add(n.id)
  const added = new Set<NodeId>()
  for (const n of next.nodes()) if (!before.has(n.id)) added.add(n.id)
  return added
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
      seed: base && addedNodes(base as Graph, lockfile as Graph),
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
