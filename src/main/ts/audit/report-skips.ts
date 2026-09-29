import path from 'node:path'

import type { Ledger } from './report'
import { TContext } from '../ifaces'

/** Where a manifest lives, relative to cwd — omitted for the root package.json. */
const manifestWhere = (file: string, cwd?: string): string => {
  if (!cwd) return ''
  const rel = path.relative(cwd, file)
  return rel === 'package.json' || rel === '' ? '' : ` in ${rel}`
}

/** The fix falls outside a surviving consumer's declared range. */
export const printConsumerSkips = (
  warn: (s: string) => void,
  incompatible: Ledger['incompatible'],
): void => {
  if (incompatible.size === 0) return
  warn(
    "Skipped (fix breaks a consumer's declared range; re-run with --force to apply):",
  )
  for (const [spec, consumers] of [...incompatible].sort()) {
    warn(`  ${spec}`)
    for (const c of [...consumers].sort()) warn(`    - ${c}`)
  }
}

/** A declared override/resolution pins the package where the fix can't reach. */
export const printOverrideSkips = (
  warn: (s: string) => void,
  pinned: Ledger['pinned'],
): void => {
  if (pinned.size === 0) return
  warn(
    "Skipped (pinned by an override/resolution the fix can't satisfy; update the override to remediate):",
  )
  for (const [spec, to] of [...pinned].sort())
    warn(`  ${spec} (pinned → ${to})`)
}

/** A package.json range too narrow for the fix, in the root or a workspace. */
export const printManifestSkips = (
  warn: (s: string) => void,
  manifestPinned: Ledger['manifestPinned'],
  cwd: string | undefined,
): void => {
  if (manifestPinned.size === 0) return
  warn(
    "Skipped (package.json pins these to a range the fix can't satisfy; re-run with --force to update package.json, or widen the range yourself):",
  )
  for (const [name, decls] of [...manifestPinned].sort())
    for (const d of decls)
      warn(`  ${name} (pinned → "${d.range}"${manifestWhere(d.file, cwd)})`)
}

/** The engines/license policy left no version that completes the closure. */
export const printConstraintSkips = (
  warn: (s: string) => void,
  constraintSkipped: Ledger['constraintSkipped'],
  constraintSummary: string,
  verbose: boolean,
): void => {
  if (constraintSkipped.size === 0) return
  warn(
    `Skipped (constraints — no fix keeps the closure within the policy [${constraintSummary}]; relax it, --exclude the package, or accept the newer dep):`,
  )
  for (const [head, data] of [...constraintSkipped].sort()) {
    const need = data.seed
      ? ' — the fix version itself is not permitted'
      : data.depName
        ? ` — needs ${data.depName}${data.range ? `@${data.range}` : ''}`
        : ''
    warn(`  ${head}${need}`)
    if (verbose && data.rejected?.length)
      for (const r of data.rejected)
        warn(
          `    - ${data.depName}@${r.version}: ${r.reason ?? r.condition ?? r.by}`,
        )
  }
}

/** Ranges `--force` rewrote, and in which manifest. */
export const printManifestEdits = (
  log: (s: string) => void,
  manifestEdits: Ledger['manifestEdits'],
  cwd: string | undefined,
): void => {
  if (manifestEdits.length === 0) return
  log('Updated package.json ranges (--force):')
  for (const e of [...manifestEdits].sort((a, b) =>
    a.name.localeCompare(b.name),
  ))
    log(`  ${e.name}: "${e.from}" → "${e.to}"${manifestWhere(e.file, cwd)}`)
}

/**
 * A bump an earlier upgrade in the same run made moot: the fix re-derived its own
 * deps, so the node this one targeted is no longer in the tree. Nothing to act on —
 * but the line would otherwise vanish from the report without explanation.
 */
export const printSupersededSkips = (
  log: (s: string) => void,
  superseded: Ledger['superseded'],
): void => {
  if (superseded.size === 0) return
  log('Superseded (an earlier upgrade already replaced these):')
  for (const [spec, causes] of [...superseded].sort()) {
    log(`  ${spec}`)
    for (const c of [...causes].sort()) log(`    - by ${c}`)
  }
}

/**
 * Parents moved up so a pinned transitive fix could land. Not a skip — but the user did
 * not ask for these versions, so each one names the dep it was raised for.
 */
export const printRaises = (
  log: (s: string) => void,
  raised: Ledger['raised'],
): void => {
  if (raised.size === 0) return
  log('Raised past its own fix, to clear a dep it pinned:')
  for (const [spec, deps] of [...raised].sort())
    log(`  ${spec} — to clear ${[...deps].sort().join(', ')}`)
}

/**
 * Descriptors the anchored parse dropped because no package.json requests them. Usually
 * housekeeping yarn would do anyway — but if a workspace manifest was unreadable, this is
 * where its dependencies quietly went, so the count is never hidden.
 */
export const printPrunedDescriptors = (
  warn: (s: string) => void,
  pruned: readonly string[] | undefined,
  verbose: boolean,
): void => {
  if (!pruned?.length) return
  warn(
    `Dropped ${pruned.length} lockfile descriptor(s) no package.json requests${verbose ? ':' : ' (--verbose to list)'}`,
  )
  // lockgraph phrases these as full sentences; the descriptor is the useful part.
  const descriptors = pruned.map((line) => /"([^"]+)"/.exec(line)?.[1] ?? line)
  if (verbose) for (const d of [...descriptors].sort()) warn(`  ${d}`)
}

/** Skips the engineer has to act on — each names what to change to remediate. */
export const printActionableSkips = (
  log: (s: string) => void,
  warn: (s: string) => void,
  ctx: TContext,
  ledger: Ledger,
  constraintSummary: string,
): void => {
  printPrunedDescriptors(warn, ctx.prunedDescriptors, !!ctx.flags.verbose)
  printRaises(log, ledger.raised)
  printSupersededSkips(log, ledger.superseded)
  printConsumerSkips(warn, ledger.incompatible)
  printOverrideSkips(warn, ledger.pinned)
  printManifestSkips(warn, ledger.manifestPinned, ctx.cwd)
  printConstraintSkips(
    warn,
    ledger.constraintSkipped,
    constraintSummary,
    !!ctx.flags.verbose,
  )
  printManifestEdits(log, ledger.manifestEdits, ctx.cwd)
}
