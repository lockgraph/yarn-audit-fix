export type TFlags = Record<string, any>

export type TContext = {
  ctx: TContext
  cwd: string
  flags: TFlags
  manifest: Record<string, any>
  versions: Record<string, string>
  err?: any
  // Optional `lockgraph` RegistryAdapter override — tests inject a
  // mock here; production builds a live, scope-aware one via `buildRegistry`.
  registry?: any
  // Optional `refurbish` TarballSource override — tests inject canned tarball
  // bytes here; production builds a live one via `buildTarballSource`.
  tarballSource?: any
  // Optional progress reporter (spinner) for the network-bound patch phases;
  // set by `patchLockfile`. Absent in direct/test calls. See `ui.createProgress`.
  progress?: any
  // Optional AbortSignal — set by `run` so Ctrl+C/SIGTERM cancel in-flight
  // registry HTTP cooperatively (advisory POST, tarball GET). Absent in
  // direct/test calls.
  signal?: any
  // Optional `fetch` override — tests inject a stub so the registry audit stays
  // offline; production wires the AbortSignal through the global fetch.
  fetch?: any
  // Direct-dep range rewrites for package.json, recorded by `_patch` under --force
  // when a declared range can't admit the fix (`npm audit fix --force` parity);
  // applied to the manifest by `patchLockfile`. Absent = no manifest change.
  manifestEdits?: TManifestEdit[]
  // Machine-readable remediation outcome, recorded by `_patch`; emitted by the CLI
  // path under `--json`. Absent until `_patch` runs.
  summary?: TPatchSummary
  // Root/workspace descriptors the anchored yarn-classic parse dropped because no
  // manifest requests them any more, recorded by `patchLockfile`. Surfaced in the report
  // so a prune is never silent: an incomplete manifest set (an unreadable or gitignored
  // workspace package.json) would otherwise take live entries out without a word.
  prunedDescriptors?: string[]
}

// A package.json direct-dep range rewrite: `"<name>": "<from>"` → `"<name>": "<to>"`,
// in the manifest `file` that declared it (the root or a workspace package.json).
export type TManifestEdit = {
  name: string
  from: string
  to: string
  file: string
}

// Machine-readable remediation outcome for `--json` — what was (or, under
// `--dry-run`, would be) upgraded, and what was skipped and why. Built by `_patch`
// onto `ctx.summary`; emitted as JSON by the CLI path.
export type TPatchSummary = {
  dryRun: boolean
  upgraded: { name: string; from: string; to: string; severity?: string }[]
  // `reason`: consumer-range | override-pin | superseded | manifest-pin | constraint | out-of-scope
  skipped: { package: string; reason: string }[]
  excluded: string[]
  noFix: string[]
}

export type TCallback = (cxt: TContext) => void | Promise<void>

// Normalized advisory used across the patch pipeline. Metadata fields are
// optional — yarn 4's NDJSON carries no CVE/CVSS, only severity + a GHSA url.
export type TAuditAdvisory = {
  module_name: string // eslint-disable-line camelcase
  vulnerable_versions: string // eslint-disable-line camelcase
  patched_versions: string // eslint-disable-line camelcase
  severity?: string
  cvss?: number
  refs?: string[] // CVE / GHSA identifiers
  url?: string
}

export type TAuditReport = {
  [versionInfo: string]: TAuditAdvisory
}

import type { FormatId, Graph } from 'lockgraph'

// Graph from lockgraph; all operations go through ./lockfile.
export type TLockfileObject = Graph

// FormatId from lockgraph (e.g. 'yarn-classic', 'yarn-berry-v8').
// `undefined` retained for the "format not recognised" sentinel.
export type TLockfileType = FormatId | undefined
