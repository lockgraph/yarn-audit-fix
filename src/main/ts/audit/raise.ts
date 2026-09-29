import sv from 'semver'

import type { Graph, NodeId } from 'lockgraph'

import type { TAuditReport } from '../ifaces'
import { normalizeRange } from './plan'

export type RaiseDeps = {
  /** Versions of `name` above `floor`, lowest first, whose range for `dep` admits `fix`. */
  versionsAdmitting: (
    name: string,
    dep: string,
    fix: string,
    floor: string,
  ) => Promise<string[]>
  directRanges: Map<string, { range: string; file: string }[]>
  report: TAuditReport
  force?: boolean
}

/**
 * The parent that pins a dep away from its fix, as the consumer gate found it. `version`
 * is the one whose declaration blocks — its planned fix when it is being bumped already,
 * else what the lock holds — while `nodeVersion` is always the lock's, because that is
 * what a plan's selector has to match.
 */
export type Pinner = {
  id: NodeId
  name: string
  version: string
  nodeVersion: string
}

/**
 * The lowest raise of a pinning parent that lets a transitive fix through, or undefined
 * when none exists. `npm audit fix` does the same: it will not break a parent's pin, but
 * it will move the parent itself once a newer one stops pinning the vulnerable version
 * (arborist's non-major `fixAvailable` path).
 *
 * Bounded three ways, because a raise nobody asked for must not be a surprise: every
 * range that points AT the parent has to admit it (including a root/workspace
 * package.json declaration), the parent's major may not change without `--force`, and a
 * version that is itself vulnerable is never chosen.
 */
export const raiseFor = async (
  graph: Graph,
  pinner: Pinner,
  dep: string,
  fix: string,
  deps: RaiseDeps,
): Promise<string | undefined> => {
  const vulnerable = deps.report[pinner.name]?.vulnerable_versions
  for (const candidate of await deps.versionsAdmitting(
    pinner.name,
    dep,
    fix,
    pinner.version,
  )) {
    if (!deps.force && sv.major(candidate) !== sv.major(pinner.version))
      continue
    if (vulnerable && sv.satisfies(candidate, vulnerable)) continue
    if (accepted(graph, pinner, candidate, deps)) return candidate
  }
  return undefined
}

/** Every declared range that points at this parent must admit the raise. */
const accepted = (
  graph: Graph,
  pinner: Pinner,
  candidate: string,
  deps: RaiseDeps,
): boolean => {
  for (const edge of graph.in(pinner.id)) {
    const range = normalizeRange(edge.attributes?.range)
    if (range && !sv.satisfies(candidate, range)) return false
  }
  for (const declared of deps.directRanges.get(pinner.name) ?? [])
    if (
      sv.validRange(declared.range) &&
      !sv.satisfies(candidate, declared.range)
    )
      return false
  return true
}
