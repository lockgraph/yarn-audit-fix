import type { NodeId } from 'lockgraph'

import { formatAdvisoryMeta } from './meta'
import { describeScope } from './scope'
import { printActionableSkips } from './report-skips'
import type { TEngineTargets } from './engines'
import { TAuditReport, TContext, TManifestEdit } from '../ifaces'

/** Surface real gaps from the completion; info-level noise is dropped by the caller. */
const reportDiagnostics = (
  diagnostics: readonly { severity: string; code: string; message: string }[],
  verbose: boolean,
  warn: (s: string) => void,
): void => {
  if (diagnostics.length === 0) return
  const head =
    diagnostics.length === 1
      ? '1 diagnostic'
      : `${diagnostics.length} diagnostics`
  warn(`Completion reported ${head}:`)
  for (const d of verbose ? diagnostics : diagnostics.slice(0, 5))
    warn(`  [${d.severity}] ${d.code}: ${d.message}`)
  if (!verbose && diagnostics.length > 5)
    warn(`  … ${diagnostics.length - 5} more (--verbose to list)`)
}

/**
 * ` (tarball-unavailable: 2, cache-key-unknown: 1)` — why refurbish deferred these
 * checksums, from lockgraph's `data.reason` (≥ 0.8.1). Empty when no reason is
 * carried, so an older lib keeps the plain message.
 */
export const deferredReasons = (
  diagnostics: readonly { data?: unknown }[],
): string => {
  const counts = new Map<string, number>()
  for (const d of diagnostics) {
    const reason = (d.data as { reason?: unknown } | undefined)?.reason
    if (typeof reason === 'string')
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  if (counts.size === 0) return ''
  return ` (${[...counts].map(([reason, n]) => `${reason}: ${n}`).join(', ')})`
}

/** One vulnerable package, its minimal fix, and the nodes to rebind. */
export type Plan = {
  name: string
  fromRange: string
  fix: string
  froms: { id: NodeId; version: string }[]
}

/** Why a fix was dropped by the engines/license gate. */
export type ConstraintSkip = {
  seed?: boolean // true = the fix version itself was rejected (not a transitive)
  depName?: string
  range?: string
  rejected?: readonly {
    version: string
    by?: string
    condition?: string
    reason?: string
  }[]
}

/** Everything the patch decided NOT to do, and why — the ledgers the report reads. */
export type Ledger = {
  excluded: Set<string>
  noFix: Set<string>
  scopeSkipped: Set<string>
  pinned: Map<string, string>
  incompatible: Map<string, Set<string>>
  manifestPinned: Map<string, { range: string; file: string }[]>
  constraintSkipped: Map<string, ConstraintSkip>
  manifestEdits: TManifestEdit[]
}

/**
 * Machine-readable outcome (`--json`): what was (or, under `--dry-run`, would be)
 * upgraded, and what was skipped and why. Built from the same ledgers `renderReport`
 * reads, so the two can never diverge.
 */
export const buildSummary = (
  dryRun: boolean,
  ledger: Ledger,
  applied: readonly Plan[],
  report: TAuditReport,
): NonNullable<TContext['summary']> => {
  const seen = new Set<string>()
  return {
    dryRun,
    upgraded: applied.flatMap((u) => {
      const head = `${u.name}@${u.froms[0].version} → ${u.fix}`
      if (seen.has(head)) return []
      seen.add(head)
      return [
        {
          name: u.name,
          from: u.froms[0].version,
          to: u.fix,
          severity: report[u.name]?.severity,
        },
      ]
    }),
    skipped: [
      ...[...ledger.incompatible.keys()].map((p) => ({
        package: p,
        reason: 'consumer-range',
      })),
      ...[...ledger.pinned.keys()].map((p) => ({
        package: p,
        reason: 'override-pin',
      })),
      ...[...ledger.manifestPinned.keys()].map((p) => ({
        package: p,
        reason: 'manifest-pin',
      })),
      ...[...ledger.constraintSkipped.keys()].map((p) => ({
        package: p,
        reason: 'constraint',
      })),
      ...[...ledger.scopeSkipped].map((p) => ({
        package: p,
        reason: 'out-of-scope',
      })),
    ].sort((a, b) => a.package.localeCompare(b.package)),
    excluded: [...ledger.excluded].sort(),
    noFix: [...ledger.noFix].sort(),
  }
}

/**
 * The human-readable outcome: what was upgraded, what was skipped and why, plus any
 * completion diagnostics. Pure output — reads the ledgers, mutates nothing.
 */
/**
 * The active constraint policy, and where an inferred engine target came from — a
 * range taken from the running process can differ from the project's own target.
 */
const printConstraints = (
  log: (s: string) => void,
  flags: TContext['flags'],
  constraintSummary: string,
  engineTargets: TEngineTargets | undefined,
): void => {
  if (constraintSummary) {
    log(`Constraints${flags.safe ? ' (--safe)' : ''}: ${constraintSummary}`)
    const runtimeEngines = engineTargets
      ? Object.keys(engineTargets).filter((e) => {
          const v = (flags.engines as Record<string, unknown> | undefined)?.[e]
          return v === true || v === 'runtime'
        })
      : []
    if (runtimeEngines.length > 0)
      log(
        `  (${runtimeEngines.join(', ')} = the running process — may differ from your project's target; pass --engines.${runtimeEngines[0]}='<range>' to pin it)`,
      )
    const floorEngines = engineTargets
      ? Object.keys(engineTargets).filter(
          (e) =>
            (flags.engines as Record<string, unknown> | undefined)?.[e] ===
            'floor',
        )
      : []
    if (floorEngines.length > 0)
      log(`  (${floorEngines.join(', ')} = inferred from the installed tree)`)
  }
}

/** Everything the run declined to fix, grouped by reason. */
/** Skips that need no action: nothing published, `--exclude`d, or out of scope. */
const printInfoSkips = (
  log: (s: string) => void,
  flags: TContext['flags'],
  ledger: Ledger,
): void => {
  const { excluded, noFix, scopeSkipped } = ledger
  if (noFix.size > 0) {
    log('No fix available: ' + [...noFix].sort().join(', '))
  }
  if (excluded.size > 0) {
    log('Excluded (per --exclude): ' + [...excluded].sort().join(', '))
  }
  // Out-of-scope advisories can be a whole dev tree — a count by default, the
  // full list only under --verbose.
  if (scopeSkipped.size > 0) {
    if (flags.verbose)
      log(
        `Skipped (outside ${describeScope(flags)} scope): ` +
          [...scopeSkipped].sort().join(', '),
      )
    else
      log(
        `Skipped ${scopeSkipped.size} package(s) outside ${describeScope(flags)} scope (--verbose to list)`,
      )
  }
}

const printSkips = (
  log: (s: string) => void,
  warn: (s: string) => void,
  ctx: TContext,
  ledger: Ledger,
  constraintSummary: string,
): void => {
  printInfoSkips(log, ctx.flags, ledger)
  printActionableSkips(log, warn, ctx, ledger, constraintSummary)
}

export type ReportInput = {
  ctx: TContext
  policy: {
    constraintSummary: string
    engineTargets: TEngineTargets | undefined
  }
  ledger: Ledger
  applied: readonly Plan[]
  report: TAuditReport
  inScope: ReadonlySet<NodeId> | undefined
  completionDiagnostics: readonly {
    severity: string
    code: string
    message: string
  }[]
}

export const renderReport = ({
  ctx,
  policy,
  ledger,
  applied,
  report,
  inScope,
  completionDiagnostics,
}: ReportInput): void => {
  const { flags } = ctx
  const { constraintSummary, engineTargets } = policy
  // Route through the spinner when one is active (clears → prints → redraws);
  // plain console otherwise (direct/test calls).
  const log = ctx.progress ? ctx.progress.log : console.log
  const warn = ctx.progress ? ctx.progress.log : console.warn
  // Surface the active constraints first — and when an engine target was inferred
  // from the running process, flag that it may differ from the project's target.
  printConstraints(log, flags, constraintSummary, engineTargets)
  // Surface the active fix scope so a reduced fix set is never a silent surprise.
  if (inScope) log(`Scope: ${describeScope(flags)}`)
  // Dedupe by from→to; annotate with severity / CVSS / CVE refs.
  const seen = new Set<string>()
  const lines: string[] = []
  for (const u of applied) {
    const head = `${u.name}@${u.froms[0].version} → ${u.fix}`
    if (seen.has(head)) continue
    seen.add(head)
    lines.push(head + formatAdvisoryMeta(report[u.name]))
  }
  lines.sort()
  if (lines.length > 0) {
    log(`Upgraded deps (${lines.length}):`)
    for (const line of lines) log(`  ${line}`)
  } else {
    log('Upgraded deps: <none>')
  }
  printSkips(log, warn, ctx, ledger, constraintSummary)
  // info-level COMPLETION_NODE_ADDED is success noise — only surface real gaps.
  reportDiagnostics(
    completionDiagnostics.filter((d) => d.severity !== 'info'),
    flags.verbose,
    warn,
  )
}

/** The shared wiring both apply paths need to reach the registry and report progress. */
