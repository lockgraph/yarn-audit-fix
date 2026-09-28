#!/usr/bin/env node

import process from 'node:process'

import minimist from 'minimist'

import { TFlags } from './ifaces'
import { run } from './runner'
import { getSelfManifest, maskUrlCreds } from './util'

// Declarative option spec (keeps `parse` small and the Node floor low — see the
// v11 migration note): value-taking vs boolean flags, their `YAF_*` env-var
// fallbacks, and the allowed values for the enum-like ones.
const BOOLEAN = [
  'dry-run',
  'force',
  'json',
  'production',
  'safe',
  'silent',
  'verbose',
]
const STRING = [
  'audit-level',
  'cwd',
  'exclude',
  'ignore',
  'on-conflict',
  'package-type',
  'registry',
  'workspace',
]
const ENV: Record<string, string> = {
  'audit-level': 'YAF_AUDIT_LEVEL',
  cwd: 'YAF_CWD',
  'dry-run': 'YAF_DRY_RUN',
  exclude: 'YAF_EXCLUDE',
  force: 'YAF_FORCE',
  ignore: 'YAF_IGNORE',
  json: 'YAF_JSON',
  'on-conflict': 'YAF_ON_CONFLICT',
  'package-type': 'YAF_PACKAGE_TYPE',
  production: 'YAF_PRODUCTION',
  registry: 'YAF_REGISTRY',
  safe: 'YAF_SAFE',
  silent: 'YAF_SILENT',
  verbose: 'YAF_VERBOSE',
  workspace: 'YAF_WORKSPACE',
}
const CHOICES: Record<string, string[]> = {
  'audit-level': ['low', 'moderate', 'high', 'critical'],
  'on-conflict': ['skip', 'stop'],
  'package-type': ['cjs'],
}

const HELP = `Usage: yarn-audit-fix [options]

Options:
  --audit-level <level>   Min severity to fix: low | moderate | high | critical
  --cwd <path>            Working directory (defaults to process.cwd())
  --dry-run               Print what would change without writing
  --engines.<engine>      Only accept fixes whose completed dependency closure
                          runs on the given engine: --engines.node='>=18',
                          =floor (infer from the installed tree), or bare
                          (the Node running the CLI). Repeatable per engine
  --exclude <rules>       Packages to skip updating: comma-sep glob[@range]
                          (e.g. lodash,@scope/*@>=2 <3)
  --force                 Apply semver-major upgrades, not just compatible ones
  --ignore <ids>          Advisory ids to ignore: comma-sep globs (GHSA or npm id)
  --json                  Print the outcome as JSON (upgraded / skipped / excluded /
                          no-fix) instead of the human summary; pairs with --dry-run
  --license.allow <spdx>  Only accept fixes whose closure has these SPDX licenses
                          (comma-sep). --license.deny <spdx> flags forbidden ones.
                          A bare --license=<spdx,...> is an allow list
  --on-conflict <policy>  When a fix can't satisfy the engine/license constraints:
                          skip (default, leave it + report) | stop (error)
  --package-type <t>      Only accept fixes whose closure stays require-able:
                          cjs (reject an ESM-only dep a CommonJS tree can't require)
  --production, --prod    Fix only advisories reachable from production deps
                          (dependencies/optional/peer); leave dev-only ones
  --registry <url>        Custom registry url
  --safe                  Fix only what's safe on every automatable axis (the
                          opposite of --force): don't raise the tree's engine floor,
                          don't introduce an ESM-only dep in a CommonJS project.
                          Bundles --engines.node=floor + --package-type=cjs
  --silent                Disable log output
  --verbose               Verbose/debug logging
  --workspace <globs>     Monorepo: fix only these workspaces' closures — comma-sep
                          globs on workspace name / path / basename (e.g.
                          @scope/core, packages/*, core,cli)
  -v, --version           Print version
  -h, --help              Print this help

Every flag also reads a YAF_<FLAG> env var (e.g. YAF_AUDIT_LEVEL).`

/**
 * Parse argv into a flags object. Explicit flags win (first occurrence wins, in
 * first-seen order, for deterministic precedence); `YAF_*` env vars fill the
 * rest. `--version` / `--help` short-circuit.
 * Throws on an out-of-range `choices` value.
 */
/** Explicit flags, in first-seen order; a `--no-x` / `--x=false` boolean is off. */
const collectExplicit = (
  flags: TFlags,
  argv: string[],
  raw: Record<string, any>,
  known: Set<string>,
): void => {
  for (const token of argv) {
    if (!token.startsWith('--')) continue
    const key = token.replace(/^--(no-)?/, '').split('=')[0]
    if (known.has(key) && !(key in flags) && raw[key] !== false)
      flags[key] = raw[key]
  }
}

/** `YAF_*` fallback for whatever the argv pass left unset. */
const applyEnvFallback = (
  flags: TFlags,
  env: NodeJS.ProcessEnv,
  known: Set<string>,
): void => {
  for (const key of known) {
    const name = ENV[key]
    if (name && !(key in flags) && env[name] !== undefined)
      flags[key] = env[name]
  }
}

/**
 * Flags minimist nests natively, which the token-keyed allowlist above cannot see:
 * `--engines.<engine>[=<range>|runtime|floor]`, `--license.allow/.deny` (or a bare
 * `--license=MIT,ISC`), and `--prod`, which is aliased to `--production` by minimist
 * but never appears as the literal token. Values are validated later — by
 * `resolveEngineTargets` (which also guards the keys against proto-pollution) and
 * `resolveLicensePolicy`.
 */
const liftNestedFlags = (flags: TFlags, raw: Record<string, any>): void => {
  if (
    raw.engines &&
    typeof raw.engines === 'object' &&
    !Array.isArray(raw.engines)
  )
    flags.engines = raw.engines
  if (raw.license !== undefined && raw.license !== false)
    flags.license = raw.license
  if (raw.production === true && !('production' in flags))
    flags.production = true
}

/** Reject a value outside the flag's documented choices. */
const assertChoices = (flags: TFlags): void => {
  for (const [key, allowed] of Object.entries(CHOICES)) {
    const value = flags[key]
    if (value !== undefined && !allowed.includes(String(value)))
      throw new Error(
        `Invalid value for --${key}: "${value}". Expected one of: ${allowed.join(', ')}`,
      )
  }
}

export const parse = (
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): TFlags => {
  const raw = minimist(argv, {
    boolean: BOOLEAN,
    string: STRING,
    alias: { v: 'version', h: 'help', prod: 'production' },
  })
  if (raw.version) return { version: true }
  if (raw.help) return { help: true }

  const known = new Set([...BOOLEAN, ...STRING])
  const flags: TFlags = {}
  collectExplicit(flags, argv, raw, known)
  applyEnvFallback(flags, env, known)
  liftNestedFlags(flags, raw)
  assertChoices(flags)
  return flags
}

// Async IIFE rather than top-level await: the bundle targets ES2020 (the Node
// 14 floor) where TLA isn't available. Failures are handled here, not by a caller.
// Entry-point glue — `parse()` is unit-tested and `run()` via the runner suite —
// so exclude the bootstrap from coverage rather than chase its import-time branch.
/* c8 ignore start */
// eslint-disable-next-line unicorn/prefer-top-level-await
void (async () => {
  try {
    const opts = parse()

    if (opts.version) console.log(getSelfManifest().version)
    else if (opts.help) console.log(HELP)
    else await run(opts)
  } catch (err) {
    // `parse` throws on invalid CLI input; `run` already printed its own report
    // and set process.exitCode — surface only a parse message, then ensure 1.
    if (process.exitCode === undefined && err instanceof Error)
      console.error(maskUrlCreds(err.message))
    process.exitCode ||= 1
  }
})()
/* c8 ignore stop */
