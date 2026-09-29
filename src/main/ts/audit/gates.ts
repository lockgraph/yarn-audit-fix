import sv from 'semver'

import { modify } from 'lockgraph'
import type { FormatId, Graph, NodeId } from 'lockgraph'

import type { Ledger, Plan } from './report'
import { workspaceKey } from './manifest'

import type { TContext, TManifestEdit } from '../ifaces'

/** Widen a declared range to admit `fix`, preserving the pin operator
 * (`^`/`~`/exact; anything else → caret): `4.17.11`→`4.18.0`, `~4.1`→`~4.18.0`. */
const widenRange = (declared: string, fix: string): string => {
  const t = declared.trim()
  const op = t.startsWith('^')
    ? '^'
    : t.startsWith('~')
      ? '~'
      : /^\d/.test(t)
        ? ''
        : '^'
  return op + fix
}

/**
 * A DIRECT dep whose declared package.json range can't admit the fix. Default →
 * flag + skip (surface it, the engineer widens the range); `--force` → rewrite the
 * range in each declaring manifest and let the bump proceed.
 */
export const gateByManifest = (
  plans: readonly Plan[],
  directRanges: Map<string, { range: string; file: string }[]>,
  flags: TContext['flags'],
  ledger: Ledger,
): Plan[] => {
  const { manifestPinned, manifestEdits } = ledger
  // Manifest gate: a DIRECT dep whose declared package.json range can't admit the
  // fix. Default → flag + skip (like `npm audit fix` without --force: surface it,
  // the engineer widens the range). --force → rewrite the range in package.json
  // (npm audit fix --force parity) + let the bump proceed. Works for EVERY format:
  // a yarn-classic lock has no root edge, so Pass 2's edge gate can't see direct
  // deps — this can. Non-semver ranges (workspace:/npm:alias/git/file) skip via the
  // validRange guard; `*` admits every fix so it never trips.
  const gatedPlans: Plan[] = []
  for (const p of plans) {
    // Every declaration (root + workspaces) whose declared range can't admit the
    // fix — a semver-major bump outside a `^`/exact pin, in any manifest.
    const blocking = (directRanges.get(p.name) ?? []).filter(
      (d) => sv.validRange(d.range) && !sv.satisfies(p.fix, d.range),
    )
    if (blocking.length > 0) {
      if (!flags.force) {
        manifestPinned.set(p.name, blocking)
        continue
      }
      for (const d of blocking)
        manifestEdits.push({
          name: p.name,
          from: d.range,
          to: widenRange(d.range, p.fix),
          file: d.file,
        })
    }
    gatedPlans.push(p)
  }
  return gatedPlans
}

/**
 * `--force` just rewrote a declared range in package.json; move the lockfile's own
 * declaration with it, or yarn re-resolves that dep, finds no entry for the new range
 * and rejects the lock under `--immutable` (YN0028). `replaceRange` is the modify op for
 * a DECLARED range, as `replaceVersion` is for a resolved version, and it takes the one
 * root/workspace node that declares it — so a rewrite in one workspace leaves its
 * siblings alone.
 *
 * Runs after the apply phase, over the edits whose bump actually landed. The bumped
 * version is in the graph by then, so the new range binds immediately and nothing is
 * left pending; a bump the apply phase withdrew never gets here, so there is nothing to
 * undo. `from` guards against rewriting a declaration that has since moved — lockgraph
 * ignores the optional `npm:` prefix on both sides, so the yarn spelling is safe.
 */
export const retargetDeclarations = async (
  graph: Graph,
  edits: readonly TManifestEdit[],
  target: FormatId,
  cwd: string | undefined,
): Promise<Graph> => {
  let next = graph
  for (const edit of edits) {
    const parent = declaringNode(next, edit.file, cwd)
    if (parent === undefined) continue
    const res = await modify(
      next,
      {
        kind: 'replaceRange',
        parent,
        name: edit.name,
        to: edit.to,
        from: edit.from,
      },
      { target },
    )
    next = res.graph
  }
  return next
}

/** The root/workspace node that owns a manifest file, found by its `workspacePath`. */
const declaringNode = (
  graph: Graph,
  file: string,
  cwd: string | undefined,
): NodeId | undefined => {
  const want = workspaceKey(file, cwd)
  for (const node of graph.nodes())
    if (node.workspacePath === want) return node.id as NodeId
  return undefined
}
