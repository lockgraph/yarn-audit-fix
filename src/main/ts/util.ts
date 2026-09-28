import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import fg, { Options as GlobOptions } from 'fast-glob'

import { TFlags, TManifestEdit } from './ifaces'

const glob = fg.sync
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// chalk.bold stand-in: SGR bold on a TTY (or FORCE_COLOR), off under NO_COLOR.
const colorize =
  !('NO_COLOR' in process.env) &&
  (!!process.stdout.isTTY || 'FORCE_COLOR' in process.env)

export const bold = (s: string): string =>
  colorize ? `\u001B[1m${s}\u001B[22m` : s

// https://gist.github.com/nblackburn/875e6ff75bc8ce171c758bf75f304707
const camelToKebab = (string: string): string =>
  string.replace(/([\da-z]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()

export const normalizeFlags = (flags: TFlags): TFlags =>
  Object.keys(flags).reduce<TFlags>((m, key) => {
    m[camelToKebab(key)] = flags[key]
    return m
  }, {})

export const getWorkspaces = (
  cwd: string,
  manifest: Record<string, any>,
): string[] => {
  let packages = manifest.workspaces
  if (packages && packages.packages) {
    packages = packages.packages
  }

  if (!packages || packages.length === 0) {
    return []
  }

  // Turn workspaces into list of package.json files.
  return glob(
    packages.map((p: string) => p.replace(/\/?$/, '/package.json')),
    {
      cwd,
      onlyFiles: true,
      absolute: true,
      gitignore: true,
    } as GlobOptions,
  )
}

export const readJson = (path: string): any =>
  JSON.parse(fs.readFileSync(path).toString('utf-8').trim())

/**
 * Rewrite one direct-dep range in raw package.json TEXT, preserving the file's
 * formatting (a surgical string edit, not a JSON round-trip that would reflow the
 * whole file). Matches the exact `"<name>": "<from>"` pair — both escaped — so it
 * can't touch an unrelated key; replaces every field it appears in (a dep pinned
 * the same in `dependencies` + `devDependencies` → both updated, which is correct).
 */
export const applyManifestEdit = (
  pkgJson: string,
  { name, from, to }: TManifestEdit,
): string => {
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`("${esc(name)}"\\s*:\\s*")${esc(from)}(")`, 'g')
  return pkgJson.replace(re, `$1${to}$2`)
}

export const attempt = <T>(f: () => T): T | null => {
  try {
    return f()
  } catch {
    return null // eslint-disable-line
  }
}

export const getSelfManifest = () =>
  readJson(findClosest('package.json') as string)

const findParent = (dir: string, target: string): string | null => {
  if (fs.existsSync(path.join(dir, target))) {
    return dir
  }
  const parentDir = path.resolve(dir, '..')

  return dir === parentDir ? null : findParent(parentDir, target)
}

const findClosest = (target: string, cwd = __dirname): string | null => {
  const found = findParent(cwd, target)

  return found ? path.join(found, target) : null
}

/**
 * Strip the userinfo out of any URL in a string. A registry URL legitimately carries
 * basic-auth (`https://user:token@host`, via `--registry` / `YAF_REGISTRY`), and it
 * reaches stdout by two routes: the runtime digest, and — less obviously — error text,
 * where a failed request quotes the URL it tried. Apply this at every print of text
 * yaf did not compose itself.
 */
export const maskUrlCreds = (text: string): string =>
  text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, '$1***@')
