import type { Graph, OverrideConstraint } from 'lockgraph'

import type { TAuditReport, TContext } from '../ifaces'
import { type ApplyDeps, applyBatch, applyConstrained } from './apply'
import { gateByConsumers } from './consumer-gate'
import { gateByManifest } from './gates'
import type { TManifestFile } from './manifest'
import { planUpgrades } from './plan'
import type { ConstraintSkip, Ledger, Plan } from './report'
import { resolveScope } from './scope'

/**
 * A fix can pull in a closure that is itself vulnerable: express@4.22.0 clears
 * body-parser but pins `qs ~6.14.0`, which has its own advisory. One pass leaves that
 * behind, so remediation runs to a fixpoint — plan, apply, then audit the result and go
 * again — until a pass finds nothing left to do. The cap is a backstop: each round has to
 * land at least one bump to continue, so a graph that stops changing ends the loop.
 */
const MAX_ROUNDS = 5

export type RemediateInput = {
  graph: Graph
  report: TAuditReport
  ctx: TContext
  overrides: readonly OverrideConstraint[]
  excludeRules: ReturnType<typeof import('./filter').parsePackageRules>
  manifestFiles: TManifestFile[]
  directRanges: Map<string, { range: string; file: string }[]>
  ledger: Ledger
  lookups: {
    lowestFix: Parameters<typeof planUpgrades>[0]['lowestFix']
    declaredRange: Parameters<typeof gateByConsumers>[4]
    versionsAdmitting: Parameters<
      typeof gateByConsumers
    >[5]['versionsAdmitting']
  }
  policy: {
    constraints: readonly Parameters<
      typeof applyConstrained
    >[3]['constraints'][number][]
    constraintSummary: string
    onConflict: 'skip' | 'stop'
  }
  applyDeps: ApplyDeps
  constraintSkipped: Map<string, ConstraintSkip>
}

export type RemediateResult = {
  graph: Graph
  applied: Plan[]
  diagnostics: { severity: string; code: string; message: string }[]
  inScope: ReturnType<typeof resolveScope>
}

/**
 * Buckets that answer "what is still not fixed, and why". They are rebuilt from scratch
 * every round, so the report describes the FINAL state: a line skipped in round one and
 * fixed in round two must not still read as skipped.
 */
const resetPerRound = (ledger: Ledger): void => {
  ledger.excluded.clear()
  ledger.noFix.clear()
  ledger.scopeSkipped.clear()
  ledger.pinned.clear()
  ledger.incompatible.clear()
  ledger.manifestPinned.clear()
  ledger.constraintSkipped.clear()
}

/** One plan → gate → apply pass over the current graph. */
const round = async (
  graph: Graph,
  input: RemediateInput,
): Promise<{
  graph: Graph
  applied: Plan[]
  diagnostics: RemediateResult['diagnostics']
  superseded: Map<string, Set<string>>
  inScope: ReturnType<typeof resolveScope>
}> => {
  const { ctx, ledger, lookups, policy, report } = input
  const { flags } = ctx
  const empty = {
    graph,
    applied: [] as Plan[],
    diagnostics: [] as RemediateResult['diagnostics'],
    superseded: new Map<string, Set<string>>(),
  }
  // Node ids change with every applied bump, so the scope has to be re-derived against
  // the graph this round actually sees.
  const inScope = resolveScope(flags, graph, input.manifestFiles, ctx.cwd)
  const plans = await planUpgrades({
    graph,
    report,
    ctx,
    overrides: input.overrides,
    inScope,
    excludeRules: input.excludeRules,
    lowestFix: lookups.lowestFix,
    ledger,
  })
  if (plans.length === 0) return { ...empty, inScope }

  const gated = gateByManifest(plans, input.directRanges, flags, ledger)
  const upgrades = await gateByConsumers(
    graph,
    gated,
    flags,
    ledger,
    lookups.declaredRange,
    {
      versionsAdmitting: lookups.versionsAdmitting,
      directRanges: input.directRanges,
      report,
      force: flags.force,
    },
  )
  if (upgrades.length === 0) return { ...empty, inScope }

  const outcome =
    policy.constraints.length === 0
      ? await applyBatch(graph, upgrades, input.applyDeps)
      : await applyConstrained(
          graph,
          upgrades,
          input.applyDeps,
          policy,
          input.constraintSkipped,
        )
  return { ...outcome, inScope }
}

/** Drop a line a later round actually applied — the moot-skip was only true then. */
const stillMoot = (
  superseded: Map<string, Set<string>>,
  applied: readonly Plan[],
): Map<string, Set<string>> => {
  const landed = new Set(
    applied.flatMap((p) => p.froms.map((f) => `${p.name}@${f.version} → `)),
  )
  return new Map(
    [...superseded].filter(
      ([spec]) => ![...landed].some((head) => spec.startsWith(head)),
    ),
  )
}

/**
 * Collapse a package bumped over several rounds into the one line the user cares about:
 * `express@4.18.2 → 4.22.3`, not that plus `express@4.22.0 → 4.22.3`. A plan whose every
 * source version was itself produced by another round's fix is the tail of a chain.
 */
const collapseChains = (applied: readonly Plan[]): Plan[] => {
  const fixes = new Map<string, Set<string>>()
  for (const p of applied)
    fixes.set(p.name, (fixes.get(p.name) ?? new Set()).add(p.fix))
  return applied.filter(
    (p) => !p.froms.every((f) => fixes.get(p.name)?.has(f.version)),
  )
}

/** Remediate to a fixpoint: see MAX_ROUNDS. */
export const remediate = async (
  input: RemediateInput,
): Promise<RemediateResult> => {
  let graph = input.graph
  const applied: Plan[] = []
  const diagnostics: RemediateResult['diagnostics'] = []
  const superseded = new Map<string, Set<string>>()
  let inScope: RemediateResult['inScope']

  for (let n = 0; n < MAX_ROUNDS; n++) {
    resetPerRound(input.ledger)
    const pass = await round(graph, input)
    inScope = pass.inScope
    diagnostics.push(...pass.diagnostics)
    for (const [spec, causes] of pass.superseded) superseded.set(spec, causes)
    if (pass.applied.length === 0) break // nothing landed ⇒ no progress to build on
    graph = pass.graph
    applied.push(...pass.applied)
  }

  for (const [spec, causes] of stillMoot(superseded, applied))
    input.ledger.superseded.set(spec, causes)
  return { graph, applied: collapseChains(applied), diagnostics, inScope }
}
