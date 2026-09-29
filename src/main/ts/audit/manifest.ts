import path from 'node:path'

import { getWorkspaces, readJson, attempt } from '../util'

/** A manifest file whose direct-dep ranges the gate consults, paired with its
 *  parsed content. `file` is where a --force rewrite lands. */
export type TManifestFile = { file: string; manifest: Record<string, any> }

/**
 * The manifest files the gate consults: the root package.json + every workspace
 * package.json (monorepo, discovered from the root `workspaces` globs). The root
 * reuses the already-parsed `ctx.manifest`; each workspace is read best-effort (an
 * unreadable one is skipped). Absent cwd (direct/test calls) → the root alone.
 */
export const collectManifestFiles = (
  cwd: string | undefined,
  rootManifest: Record<string, any> | undefined,
): TManifestFile[] => {
  const root = rootManifest ?? {}
  if (!cwd) return [{ file: 'package.json', manifest: root }]
  const files: TManifestFile[] = [
    { file: path.join(cwd, 'package.json'), manifest: root },
  ]
  for (const wf of getWorkspaces(cwd, root)) {
    const manifest = attempt(() => readJson(wf))
    if (manifest && typeof manifest === 'object')
      files.push({ file: wf, manifest })
  }
  return files
}

/**
 * Direct-dep declared ranges across the root + workspace manifests, keyed by name
 * → every `{ range, file }` that declares it (first of dependencies →
 * devDependencies → optionalDependencies → peerDependencies wins *within* one
 * manifest; separate entries *across* manifests). The gate consults these: a DIRECT
 * dep whose declared range can't admit the fix is flagged (default) or rewritten in
 * that file (--force). Non-semver ranges (`workspace:`, `npm:` alias, git/file, `*`)
 * are left alone by the caller's `sv.validRange` guard.
 */
/**
 * A manifest file's `Node.workspacePath`: `''` for the root, else its directory relative
 * to the project root in POSIX form. lockgraph keys manifests and `replaceRange` parents
 * by exactly this, and rejects a key that is absolute, escapes the root, or carries a
 * Windows separator — so normalise here and nowhere else.
 */
export const workspaceKey = (
  file: string,
  cwd: string | undefined,
): string | undefined => {
  if (!cwd) return ''
  const rel = path.relative(cwd, path.dirname(file))
  if (rel === '' || rel === '.') return ''
  const posix = rel.split(path.sep).join('/')
  return posix.startsWith('..') ? undefined : posix
}

/**
 * The manifests lockgraph anchors a yarn-classic lock against, keyed by workspace path.
 * With them a root-held descriptor is a request rather than a guess, so prune keeps what
 * the manifests reach and drops what nothing asks for — and each drop is itemised as a
 * diagnostic, so an incomplete manifest set is a visible prune, not a silent one.
 */
export const manifestsByWorkspace = (
  cwd: string | undefined,
  rootManifest: Record<string, any> | undefined,
): Record<string, Record<string, any>> => {
  const out: Record<string, Record<string, any>> = {}
  for (const { file, manifest } of collectManifestFiles(cwd, rootManifest)) {
    const key = workspaceKey(file, cwd)
    if (key !== undefined) out[key] = manifest
  }
  return out
}

export const manifestDirectRanges = (
  files: TManifestFile[],
): Map<string, { range: string; file: string }[]> => {
  const out = new Map<string, { range: string; file: string }[]>()
  for (const { file, manifest } of files) {
    const seen = new Set<string>() // first-field-wins within this manifest
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const deps = manifest?.[field]
      if (deps && typeof deps === 'object')
        for (const [name, range] of Object.entries(deps))
          if (typeof range === 'string' && !seen.has(name)) {
            seen.add(name)
            const list = out.get(name) ?? []
            list.push({ range, file })
            out.set(name, list)
          }
    }
  }
  return out
}
