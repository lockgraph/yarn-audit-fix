import path from 'node:path'

import fs from 'node:fs'

import semver from 'semver'

import { buildRegistry } from './audit/adapter'
import { TCallback, TContext, TManifestEdit } from './ifaces'
import * as lf from './lockfile'
import { format, getLockfileType } from './lockfile'
import { createProgress } from './ui'
import { applyManifestEdit, getSelfManifest } from './util'

/** Resolve the runtime + yaf versions (latest yaf straight from the registry). */
export const resolveBins: TCallback = async ({ ctx }) => {
  const { name, version } = getSelfManifest()
  ctx.versions = {
    node: process.version,
    yaf: version,
    yafLatest: await latestPublished(ctx, name, version),
  }
}

/**
 * Latest published version of `name`, read straight from the configured registry
 * (the same scope-aware, host-bound-auth routing as the audit/patch HTTP) — no
 * `npm view` spawn. Best-effort: any failure (offline, 404, throttle) falls back
 * to `fallback`, so the out-of-date nudge just stays quiet instead of breaking
 * the run.
 */
const latestPublished = async (
  ctx: TContext,
  name: string,
  fallback: string,
): Promise<string> => {
  try {
    // yaf publishes to npm, so resolve its own latest via the npm ecosystem.
    const packument = await buildRegistry(ctx, 'npm').packument(name)
    return packument?.distTags?.latest ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Print the digest: JSON with the punctuation stripped, masking any URL userinfo on
 * the way out. A registry URL can carry basic-auth (`https://user:token@host`, via
 * `--registry` / `YAF_REGISTRY`), and this printer echoes whatever it is handed —
 * so it masks at serialisation, covering every value at any depth rather than one
 * field someone remembered to scrub.
 */
const printDigest = (data: Record<string, unknown>): void =>
  console.log(
    JSON.stringify(
      data,
      (_key, value) => {
        if (typeof value !== 'string') return value
        try {
          const u = new URL(value)
          if (!u.username && !u.password) return value
          u.username = '***'
          u.password = ''
          return u.toString()
        } catch {
          return value // not a URL — nothing to mask
        }
      },
      2,
    ).replace(/[",:{}]/g, ''),
  )

/** Print the runtime digest and version warnings. */
export const printRuntimeDigest: TCallback = ({
  cwd,
  flags,
  versions,
  manifest,
}) => {
  // `--json` promises the summary as the ONLY stdout, so `yaf --json | jq` works;
  // the digest is human output and would corrupt it.
  if (flags.silent || flags.json) {
    return
  }
  const isMonorepo = !!manifest.workspaces

  if (semver.gt(versions.yafLatest, versions.yaf)) {
    console.warn(
      `yarn-audit-fix version ${versions.yaf} is out of date. Install the latest ${versions.yafLatest} for better results`,
    )
  }

  printDigest({ isMonorepo, versions, cwd, flags })
}

/** Set the process exit code from the error (printing is handled by `run`). */
export const exit: TCallback = ({ err }) => {
  // POSIX convention: a signal-terminated run exits 128 + signal number.
  const bySignal: Record<string, number> = { SIGINT: 130, SIGTERM: 143 }
  process.exitCode = bySignal[err?.signal] ?? (err?.status | 0 || 1)
}

export const patchLockfile: TCallback = async ({ cwd, flags, ctx }) => {
  // Operate on the real lockfile directly — patch is pure (parse → audit →
  // patch → format), so the old copy-to-temp + symlink dance bought nothing.
  const lockfilePath = path.join(cwd, 'yarn.lock')
  const raw = fs.readFileSync(lockfilePath, 'utf-8')
  const lockfileType = getLockfileType(raw)
  // Pass cwd as workspaceRoot so the berry adapter resolves builtin patch hashes,
  // and the project manifest so the graph carries its declared overrides/resolutions.
  // With manifest anchors, a yarn-classic descriptor nothing declares is pruned. That is
  // the point of the anchors — but it must be visible, so collect those and report them.
  const pruned: string[] = []
  const lockfile = lf.parse(raw, lockfileType, cwd, ctx.manifest, (d) => {
    if (d.code === 'YARN_CLASSIC_ROOT_DESCRIPTOR_UNREQUESTED' && d.message)
      pruned.push(d.message)
  })
  if (pruned.length > 0) ctx.prunedDescriptors = pruned
  // Captured off the fresh parse because `patch` returns a different graph. Not
  // passed to `format` — lockgraph carries the override policy and re-emits it.
  const overrides = lockfile.overrides()
  // audit / patch / refurbish are all silent registry HTTP, so drive a spinner
  // to show what's happening (no-op off a TTY or under --silent). The pipeline
  // reports through ctx.progress (advisory count, checksum count, summary lines).
  const progress = createProgress(!flags.silent && !flags.json)
  ctx.progress = progress
  try {
    // audit fetches advisories; patch resolves fixes + completes the new
    // transitive closure + prunes the stranded old one.
    progress.label('Fetching advisories…')
    const report = await lf.audit(lockfile, ctx, lockfileType)
    // _patch refines this with live sub-phase counts (Resolving fixes X/Y →
    // Completing the tree N).
    progress.label('Resolving fixes…')
    const patched = await lf.patch(
      lockfile,
      report,
      ctx,
      lockfileType,
      overrides,
    )
    // Then fill any install-required field the edit left missing (the yarn-berry
    // zip checksum) straight from the registry, so the result is a complete
    // lockfile needing no reconcile `yarn install` (no-op for yarn-classic).
    // Pass the pre-patch graph so the fill is scoped to nodes the patch actually
    // introduced — a checksum the input lock never had is yarn's call, not ours.
    progress.label('Recomputing checksums…')
    const refurbished = await lf.refurbish(patched, lockfileType, ctx, lockfile)

    // If the run was aborted (Ctrl+C) during a phase that degrades to a value
    // rather than throwing (e.g. refurbish, whose tarball fetches resolve empty
    // on abort), don't persist a half-finished lockfile.
    if (ctx.signal?.aborted) throw new Error('aborted')
    // The single write lands only after a successful in-memory patch, so a
    // failure leaves the original lockfile untouched. `--dry-run` skips it.
    // Serialize even under `--dry-run`, and throw it away: `format` is strict, so
    // skipping it made the preview green for runs that cannot actually be written.
    const serialized = format(refurbished, lockfileType)
    if (!flags['dry-run']) {
      fs.writeFileSync(lockfilePath, serialized)
      // --force may have rewritten direct-dep ranges the fix fell outside of
      // (npm audit fix --force parity, recorded on ctx by `_patch`) — apply them
      // with a surgical, format-preserving string edit, grouped by the manifest
      // file they target (the root or a workspace package.json in a monorepo).
      if (ctx.manifestEdits?.length) {
        const byFile = new Map<string, TManifestEdit[]>()
        for (const edit of ctx.manifestEdits) {
          const list = byFile.get(edit.file) ?? []
          list.push(edit)
          byFile.set(edit.file, list)
        }
        for (const [file, edits] of byFile)
          fs.writeFileSync(
            file,
            edits.reduce(applyManifestEdit, fs.readFileSync(file, 'utf-8')),
          )
      }
    }
    // `--json`: emit the machine-readable outcome as the only stdout (human logs
    // and the spinner are suppressed above). `--dry-run --json` = the preview form.
    if (flags.json)
      console.log(
        JSON.stringify(ctx.summary ?? { dryRun: !!flags['dry-run'] }, null, 2),
      )
  } finally {
    progress.stop()
    ctx.progress = undefined
  }
}

/** Verify the working dir has the files we patch. */
export const verify: TCallback = ({ cwd }) => {
  // yaf only rewrites the lockfile now (no install), so `node_modules` need not
  // be present — just the two files we read.
  for (const resource of ['yarn.lock', 'package.json']) {
    if (!fs.existsSync(path.join(cwd, resource))) {
      throw new Error(`not found: ${resource}`)
    }
  }
}
