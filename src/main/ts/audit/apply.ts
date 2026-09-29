import { complete, modify, selectConstrained } from 'lockgraph'
import type {
  Condition,
  FormatId,
  Graph,
  NodeId,
  OverrideConstraint,
  RegistryAdapter,
} from 'lockgraph'

import type { ConstraintSkip, Plan } from './report'

export type ApplyDeps = {
  target: FormatId
  registry: RegistryAdapter
  overrideList: readonly OverrideConstraint[]
  onCompletionDiag: (d: { code?: string }) => void
}

export type ApplyResult = {
  graph: Graph
  applied: Plan[]
  diagnostics: { severity: string; code: string; message: string }[]
  // Bumps that became moot mid-batch, and which upgrade made them so.
  superseded: Map<string, Set<string>>
}

/**
 * Default path: rebind every fix, then ONE batch completion — fast, because the
 * parallel packument prefetch batches across all upgrades.
 */
export const applyBatch = async (
  input: Graph,
  upgrades: readonly Plan[],
  { target, registry, overrideList, onCompletionDiag }: ApplyDeps,
): Promise<ApplyResult> => {
  let graph = input
  const applied: Plan[] = []
  const diagnostics: ApplyResult['diagnostics'] = []
  // Default path: rebind every fix, then ONE batch completion — fast, and the
  // parallel packument prefetch batches across all upgrades.
  const recentlyAdded = new Set<NodeId>()
  const recentlyOrphaned = new Set<NodeId>()
  // Which upgrade stranded a node, so a skip can say what superseded it.
  const orphanedBy = new Map<NodeId, string>()
  const superseded = new Map<string, Set<string>>()
  for (const u of upgrades) {
    // An earlier bump in this batch may have stranded the very nodes this one
    // targets — a new parent no longer requests the old version. Rebinding them
    // anyway mints a replacement that is unreachable from the start: it lands in
    // `frontier.added`, never in `orphaned`, so the seeded prune cannot reach it and
    // the lock keeps an entry yarn then wants to delete (YN0028). The bump is moot
    // in that case, so skip it rather than create the orphan.
    if (u.froms.every((f) => recentlyOrphaned.has(f.id))) {
      superseded.set(
        `${u.name}@${u.froms[0].version} → ${u.fix}`,
        new Set(
          u.froms.map((f) => orphanedBy.get(f.id) ?? 'an earlier upgrade'),
        ),
      )
      continue
    }

    const res = await modify(
      graph,
      {
        kind: 'replaceVersion',
        selector: { name: u.name, fromRange: u.fromRange },
        to: u.fix,
      },
      { target, sources: { packuments: [registry] } },
    )
    graph = res.graph
    res.frontier.added.forEach((id) => recentlyAdded.add(id))
    res.frontier.orphaned.forEach((id) => {
      recentlyOrphaned.add(id)
      if (!orphanedBy.has(id)) orphanedBy.set(id, `${u.name}@${u.fix}`)
    })
    applied.push(u)
  }
  if (recentlyAdded.size > 0 || recentlyOrphaned.size > 0) {
    // `pruneOrphans` sweeps the closure a dep-changing bump stranded: a ref-counted
    // cascade off `seed.orphaned`, so it needs no workspace anchor and works on
    // rootless yarn-classic locks. `frontier.orphaned` holds only nodes that HAD
    // incoming edges and now have none, so danglers yarn keeps (fsevents patch base,
    // catalog: target) can't enter it — no preserve set needed here.
    const completion = await complete(graph, {
      target,
      sources: { packuments: [registry] },
      seed: { added: recentlyAdded, orphaned: recentlyOrphaned },
      overrides: overrideList,
      pruneOrphans: true,
      onDiagnostic: onCompletionDiag,
    })
    graph = completion.graph
    diagnostics.push(...completion.diagnostics)
  }
  return { graph, applied, diagnostics, superseded }
}

/**
 * An override forces a version a constraint vetoes — a contradiction in the user's own
 * config (npm parity holds the pin verbatim, but it breaks the target). Nothing to
 * skip here, so always fail hard.
 */
const assertNoOverrideConflict = (
  diagnostics: readonly { code?: string }[],
  constraintSummary: string,
): void => {
  const conflict = diagnostics.find(
    (d) => d.code === 'COMPLETION_OVERRIDE_CONSTRAINT_CONFLICT',
  ) as { data?: { depName?: string; forced?: string } } | undefined
  if (conflict)
    throw new Error(
      `An override pins ${conflict.data?.depName ?? '?'}@${conflict.data?.forced ?? '?'}, which violates the active constraints (${constraintSummary}). Reconcile the override or drop the constraint.`,
    )
}

/**
 * Constrained path (opt-in: engines and/or license). Apply + complete each upgrade
 * tentatively and commit it only if its closure resolves under the constraints.
 */
export const applyConstrained = async (
  input: Graph,
  upgrades: readonly Plan[],
  { target, registry, overrideList, onCompletionDiag }: ApplyDeps,
  policy: {
    constraints: readonly Condition[]
    constraintSummary: string
    onConflict: 'skip' | 'stop'
  },
  constraintSkipped: Map<string, ConstraintSkip>,
): Promise<ApplyResult> => {
  let graph = input
  const applied: Plan[] = []
  const diagnostics: ApplyResult['diagnostics'] = []
  const { constraints, constraintSummary, onConflict } = policy
  // Constrained path (opt-in: engines and/or license). Apply + complete each
  // upgrade tentatively and commit it only if its closure resolves under the
  // constraints. A COMPLETION_NO_CANDIDATE means a new transitive has no
  // constraint-satisfying version in range → the fix's closure can't be completed
  // → skip the whole fix (leave the vuln, report it) or error under
  // --on-conflict=stop. replaceVersion/completeTransitives are immutable, so a
  // rejected upgrade's tentative graphs are simply dropped and `graph` is unchanged.
  let touched = false
  for (const u of upgrades) {
    const head = `${u.name}@${u.froms[0].version} → ${u.fix}`
    // Seed gate: the fix VERSION itself must pass the constraints. Completion
    // only gates the transitives it resolves, never the replaceVersion target, so
    // without this a fix that bumps a package TO an engine-/license-violating
    // version would slip through (only its deps would be checked).
    const seedSel = await selectConstrained(u.name, u.fix, {
      registry,
      conditions: constraints,
      onUnevaluable: 'reject',
    })
    if (!seedSel.selected) {
      if (onConflict === 'stop')
        throw new Error(
          `Constraints (${constraintSummary}): the fix ${head} itself doesn't satisfy the policy. Re-run with --on-conflict=skip to leave it, or relax the constraint.`,
        )
      constraintSkipped.set(head, {
        seed: true,
        depName: u.name,
        range: u.fix,
        rejected: seedSel.rejected,
      })
      continue
    }
    const res = await modify(
      graph,
      {
        kind: 'replaceVersion',
        selector: { name: u.name, fromRange: u.fromRange },
        to: u.fix,
      },
      { target, sources: { packuments: [registry] } },
    )
    if (res.frontier.added.size === 0 && res.frontier.orphaned.size === 0) {
      applied.push(u) // no-op bump (already at the fix); nothing to complete
      continue
    }
    const completion = await complete(res.graph, {
      target,
      sources: { packuments: [registry] },
      seed: res.frontier,
      overrides: overrideList,
      constraints,
      pruneOrphans: true,
      onDiagnostic: onCompletionDiag,
    })
    // An override forces a version a constraint vetoes — a user-config
    // contradiction (npm parity holds the pin verbatim, but it breaks the
    // target). Nothing to skip: always hard-fail.
    assertNoOverrideConflict(completion.diagnostics, constraintSummary)
    const noCandidate = completion.diagnostics.filter(
      (d: { code?: string }) => d.code === 'COMPLETION_NO_CANDIDATE',
    ) as { data?: ConstraintSkip }[]
    if (noCandidate.length > 0) {
      if (onConflict === 'stop')
        throw new Error(
          `Constraints (${constraintSummary}): no in-range version of ${noCandidate[0].data?.depName ?? '?'} satisfies the policy for ${head}. Re-run with --on-conflict=skip to leave it, or relax the constraint.`,
        )
      constraintSkipped.set(head, noCandidate[0].data ?? {})
      continue // drop u: keep the pre-u graph, leave the vuln in place
    }
    graph = completion.graph
    diagnostics.push(...completion.diagnostics)
    touched = true
    applied.push(u)
  }
  void touched // each per-upgrade completion prunes its own orphans (seed-scoped)
  return { graph, applied, diagnostics, superseded: new Map() }
}
