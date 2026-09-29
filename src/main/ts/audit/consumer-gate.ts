import sv from 'semver'

import type { Graph, NodeId } from 'lockgraph'

import type { TContext } from '../ifaces'
import { fromRangeOf, normalizeRange } from './plan'
import { type Pinner, type RaiseDeps, raiseFor } from './raise'
import type { Ledger, Plan } from './report'

/** What a published version declares for one of its deps (from its packument). */
export type DeclaredRange = (
  name: string,
  version: string,
  dep: string,
) => Promise<string | undefined>

/** A consumer whose declared range the fix falls outside of, and why it says so. */
type Blocker = { pinner: Pinner; range: string; why: string }

/**
 * Consumers whose declared range the fix would fall outside of, for ONE vulnerable
 * node — a plan can cover several (a 1.x node and a 3.x node of the same package) and
 * only some of them may be blocked.
 *
 * A consumer that is itself being replaced is usually exempt, since its deps get
 * re-derived from the registry. Two things narrow that: the exemption is by node, because
 * a plan for a different version of the same consumer leaves this one where it is; and it
 * only holds if the consumer's planned version actually stops requiring the old range —
 * serve-static@1.16.0 still declares `send: "0.18.0"`, and only 1.16.2 moves off it.
 */
const consumersBrokenBy = async (
  graph: Graph,
  from: Plan['froms'][number],
  fix: string,
  bumped: ReadonlyMap<NodeId, Plan>,
  declaredRange: DeclaredRange,
  name: string,
): Promise<Blocker[]> => {
  const blockers: Blocker[] = []
  for (const edge of graph.in(from.id)) {
    const node = graph.getNode(edge.source)
    if (!node) continue
    const planned = bumped.get(edge.source)
    // What this consumer will still ask for once the run is done. Undefined from a planned
    // version means the dep leaves its closure altogether, so the exemption holds.
    const declared = planned
      ? await declaredRange(planned.name, planned.fix, name)
      : edge.attributes?.range
    if (planned && declared === undefined) continue
    const range = normalizeRange(declared)
    if (range && !sv.satisfies(fix, range))
      blockers.push(blockerFor(edge.source, node, planned, String(declared)))
  }
  return blockers
}

const blockerFor = (
  id: NodeId,
  node: { name: string; version: string },
  planned: Plan | undefined,
  declared: string,
): Blocker => ({
  pinner: {
    id,
    name: node.name,
    version: planned ? planned.fix : node.version,
    nodeVersion: node.version,
  },
  range: declared,
  why: planned
    ? `${planned.name}@${planned.fix} still wants "${declared}"`
    : `${id} wants "${declared}"`,
})

/** One gate pass over a plan: which of its nodes survive, and what blocks the rest. */
const reducePlan = async (
  graph: Graph,
  p: Plan,
  bumped: ReadonlyMap<NodeId, Plan>,
  declaredRange: DeclaredRange,
): Promise<{ ok: Plan['froms']; blocked: Map<string, Blocker[]> }> => {
  const blocked = new Map<string, Blocker[]>()
  const ok: Plan['froms'] = []
  for (const f of p.froms) {
    const blockers = await consumersBrokenBy(
      graph,
      f,
      p.fix,
      bumped,
      declaredRange,
      p.name,
    )
    if (blockers.length > 0) blocked.set(f.version, blockers)
    else ok.push(f)
  }
  return { ok, blocked }
}

/**
 * Raise the parents that pin this fix away, so the fix can land after all. Returns the
 * plans to add or replace — one per parent — or an empty array when no in-range raise
 * exists, in which case the caller skips the fix as before.
 */
const raisePinners = async (
  graph: Graph,
  blocked: Map<string, Blocker[]>,
  name: string,
  fix: string,
  raise: RaiseDeps,
  raised: Ledger['raised'],
): Promise<Plan[]> => {
  const plans = new Map<NodeId, Plan>()
  for (const blockers of blocked.values())
    for (const { pinner } of blockers) {
      const to = await raiseFor(graph, pinner, name, fix, raise)
      if (to === undefined) return [] // one unraisable parent is enough to give up
      const key = `${pinner.name}@${pinner.version}`
      raised.set(key, (raised.get(key) ?? new Set()).add(name))
      // One plan per node, at the HIGHEST version any of its pinned deps needs: a parent
      // blocking two fixes must end up on one version that clears both, or the two raises
      // compete and the loser is left in the lock with nothing pointing at it.
      const won = plans.get(pinner.id)
      if (won && sv.gte(won.fix, to)) continue
      // Keyed by the version the LOCK holds — the raise was cleared for this node's own
      // consumers, not for every node the pinner's existing plan covers, and `mergePlans`
      // takes it out of that plan.
      plans.set(pinner.id, {
        name: pinner.name,
        fromRange: pinner.nodeVersion,
        fix: to,
        froms: [{ id: pinner.id, version: pinner.nodeVersion }],
      })
    }
  return [...plans.values()]
}

/**
 * Fold the raises into the plan set: a raise replaces any existing plan for that node, so
 * it supersedes a smaller bump. Several fixes can each need the SAME parent raised — and
 * then it has to land on one version that clears all of them, so the highest wins.
 * Otherwise the raises compete and whichever loses leaves its version in the lock with
 * nothing pointing at it.
 */
const mergePlans = (
  survivors: readonly Plan[],
  added: readonly Plan[],
): Plan[] => {
  const highest = new Map<NodeId, Plan>()
  for (const p of added) {
    const id = p.froms[0]!.id as NodeId
    const won = highest.get(id)
    if (!won || sv.gt(p.fix, won.fix)) highest.set(id, p)
  }
  const raisedIds = new Set(highest.keys())
  return [
    ...survivors.map((p) => ({
      ...p,
      froms: p.froms.filter((f) => !raisedIds.has(f.id)),
    })),
    ...highest.values(),
  ]
    .filter((p) => p.froms.length > 0)
    .map((p) => ({ ...p, fromRange: fromRangeOf(p.froms) }))
}

/** What one pass decided about one plan. */
type Outcome =
  | { kind: 'kept'; plan: Plan }
  | { kind: 'raised'; plan: Plan; added: Plan[] }
  | { kind: 'reduced'; plan?: Plan; blocked: Map<string, Blocker[]> }

/** Gate one plan: keep it, keep it behind a parent raise, or reduce/withdraw it. */
const gateOne = async (
  graph: Graph,
  p: Plan,
  bumped: ReadonlyMap<NodeId, Plan>,
  declaredRange: DeclaredRange,
  raise: RaiseDeps,
  raised: Ledger['raised'],
): Promise<Outcome> => {
  const { ok, blocked } = await reducePlan(graph, p, bumped, declaredRange)
  if (ok.length === p.froms.length) return { kind: 'kept', plan: p }
  const added = await raisePinners(graph, blocked, p.name, p.fix, raise, raised)
  if (added.length > 0) return { kind: 'raised', plan: p, added }
  return {
    kind: 'reduced',
    plan:
      ok.length > 0
        ? { ...p, froms: ok, fromRange: fromRangeOf(ok) }
        : undefined,
    blocked,
  }
}

/** One sweep over the surviving plans: what to keep, what a raise added, did it shrink. */
const onePass = async (
  graph: Graph,
  survivors: readonly Plan[],
  declaredRange: DeclaredRange,
  raise: RaiseDeps,
  ledger: Ledger,
): Promise<{ kept: Plan[]; added: Plan[]; shrank: boolean }> => {
  const bumped = new Map<NodeId, Plan>(
    survivors.flatMap((p) => p.froms.map((f) => [f.id as NodeId, p] as const)),
  )
  const kept: Plan[] = []
  const added: Plan[] = []
  let shrank = false
  for (const p of survivors) {
    const out = await gateOne(
      graph,
      p,
      bumped,
      declaredRange,
      raise,
      ledger.raised,
    )
    if (out.kind === 'kept') kept.push(out.plan)
    else if (out.kind === 'raised') {
      kept.push(out.plan)
      added.push(...out.added)
    } else {
      shrank = true
      record(ledger, p, out.blocked)
      if (out.plan) kept.push(out.plan)
    }
  }
  return { kept, added, shrank }
}

/** Attribute the blocked LINE, not the whole plan — its other versions may still move. */
const record = (
  ledger: Ledger,
  p: Plan,
  blocked: Map<string, Blocker[]>,
): void => {
  for (const [version, blockers] of blocked)
    ledger.incompatible.set(
      `${p.name}@${version} → ${p.fix}`,
      new Set(blockers.map((b) => b.why)),
    )
}

/**
 * Pass 2 — a fix must fit every surviving consumer's declared range (unless `--force`).
 * When it doesn't, try raising the parent that pins it (npm parity: never break a pin,
 * but do move the parent); only if that fails is the fix skipped and attributed.
 *
 * This iterates for three reasons: the exemption is self-referential, so withdrawing one
 * bump can invalidate another's exemption; a plan blocked on only SOME of its nodes
 * shrinks rather than dies, which withdraws the exemption those nodes were giving; and a
 * raise adds a plan that has to face the same gate. Raises only ever move a version up
 * and skips only ever remove bumps, so the loop settles; the round cap is a backstop.
 */
export const gateByConsumers = async (
  graph: Graph,
  gatedPlans: readonly Plan[],
  flags: TContext['flags'],
  ledger: Ledger,
  declaredRange: DeclaredRange,
  raise: RaiseDeps,
): Promise<Plan[]> => {
  if (flags.force) return [...gatedPlans]
  let survivors: Plan[] = [...gatedPlans]
  for (let round = 0; round <= gatedPlans.length * 2 + 2; round++) {
    const { kept, added, shrank } = await onePass(
      graph,
      survivors,
      declaredRange,
      raise,
      ledger,
    )
    survivors = added.length > 0 ? mergePlans(kept, added) : kept
    if (added.length === 0 && !shrank) return kept
  }
  return survivors
}
