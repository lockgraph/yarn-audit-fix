import path from 'node:path'

import { TContext, TFlags } from './ifaces'
import {
  exit,
  patchLockfile,
  printRuntimeDigest,
  resolveBins,
  verify,
} from './stages'
import {
  bold,
  getSelfManifest,
  maskUrlCreds,
  normalizeFlags,
  readJson,
} from './util'

/**
 * Collapse whatever was thrown into one readable line. Commands run with
 * inherited stdio, so a failed spawnSync result carries no captured output —
 * just `{ status, signal, output: [null, …], stdout: null, stderr: null }` —
 * which is noise to print raw (the child already streamed its error to the
 * terminal). Prefer captured output / an Error message, else a terse code.
 */
/**
 * How to describe a thrown value, most specific first: a nested cause, whatever the
 * child process printed, the signal that killed it, its exit code, then any message.
 * Each probe returns `undefined` when it doesn't apply, so the first hit wins.
 */
const ERROR_PROBES: ((r: Record<string, any>) => string | undefined)[] = [
  (r) =>
    r.error
      ? r.error instanceof Error
        ? r.error.message
        : String(r.error)
      : undefined,
  (r) =>
    r.stderr?.toString?.().trim() || r.stdout?.toString?.().trim() || undefined,
  (r) => (r.signal ? `interrupted (${r.signal})` : undefined),
  (r) =>
    'status' in r ? `command failed (exit code ${r.status ?? 1})` : undefined,
  (r) => (r.message ? String(r.message) : undefined),
]

const describeError = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (!err || typeof err !== 'object') return String(err)
  const r = err as Record<string, any>
  for (const probe of ERROR_PROBES) {
    const described = probe(r)
    if (described) return described
  }
  return String(err)
}

/** Error text is not ours — a failed request quotes the URL it tried, credentials
 *  and all — so mask before it reaches the console. */
const formatError = (err: unknown): string => maskUrlCreds(describeError(err))

/**
 * Build running context.
 */
export const getContext = (flags: TFlags = {}): TContext => {
  const cwd = flags.cwd || process.cwd()
  const manifest = readJson(path.join(cwd, 'package.json'))
  const ctx = {
    cwd,
    flags,
    manifest,
    versions: {},
  } as TContext
  ctx.ctx = ctx

  return ctx
}

/**
 * Patch yarn.lock with registry advisory data and complete it in-memory — no
 * reconcile `yarn install`. Advisories, fix resolution and the berry checksum
 * fill all run straight against the registry over HTTP (see `audit/registry`,
 * `lockfile.refurbish`), so the run is async and never spawns yarn.
 */
export const run = async (_flags: TFlags = {}): Promise<void> => {
  if (_flags.V) {
    console.log(getSelfManifest().version)
    return
  }

  const flags = normalizeFlags(_flags)
  const ctx = getContext(flags)
  const log = (note: string) =>
    !flags.silent && !flags.json && console.log(bold(note))

  // Cooperative Ctrl+C / kill. An AbortSignal is threaded into the registry HTTP
  // (advisory POST, tarball GET — see `audit/registry`) so the first interrupt
  // *cancels the in-flight request* and lets the run unwind cleanly with exit
  // 128+signal. A second interrupt, or a 1s stall (e.g. blocked in a sync phase
  // a signal can't preempt), force-exits — so it can never hang. AbortController
  // is feature-detected to keep the Node ≥14.18 floor.
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : undefined
  ctx.signal = controller?.signal

  let aborting = false
  const onAbort = (signal: NodeJS.Signals): void => {
    if (aborting) process.exit(process.exitCode || 130) // impatient 2nd Ctrl+C
    aborting = true
    ctx.err = { signal }
    ctx.progress?.stop() // clear the spinner line before the message
    !flags.silent && console.error(bold(`\nAborted (${signal}) — cancelling…`))
    exit(ctx) // set exit code 130 now (the unwind error won't carry the signal)
    controller?.abort() // cancel in-flight registry requests → pipeline rejects
    // Guaranteed exit if cancellation can't unwind in time. unref'd so a clean
    // cooperative unwind exits first.
    setTimeout(() => process.exit(process.exitCode || 130), 1000).unref?.()
  }
  process.on('SIGINT', onAbort)
  process.on('SIGTERM', onAbort)

  try {
    log('Resolve bins')
    await resolveBins(ctx)
    log('Runtime digest')
    printRuntimeDigest(ctx)
    log('Verifying package structure...')
    verify(ctx)
    log('Patching yarn.lock with audit data...')
    await patchLockfile(ctx)
    log('Done')
  } catch (err: any) {
    // On abort, onAbort already printed + set the exit code; just unwind quietly.
    if (aborting) throw err
    ctx.err = err
    !flags.silent && console.error(formatError(err))
    log('Failure!')
    exit(ctx)
    throw err
  } finally {
    process.removeListener('SIGINT', onAbort)
    process.removeListener('SIGTERM', onAbort)
  }
}
