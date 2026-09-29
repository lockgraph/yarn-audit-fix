import { defaultFetch } from 'lockgraph'
import type { Limiter } from 'lockgraph'

// How many registry requests may be in flight at once. The lib's default limiter
// is unbounded (`task => task()`), so on a large tree the parallel packument
// prefetch can burst hundreds of sockets at a private registry. A shared, bounded
// pool caps that without meaningfully slowing the common case. Only affects
// request *timing* — the lib resolves versions sequentially, so the lock is
// byte-identical whatever the concurrency.
export const MAX_CONCURRENCY = 16

/**
 * A `Limiter` (`<T>(task) => Promise<T>`) that runs at most `concurrency` tasks
 * concurrently, queueing the rest FIFO. One instance is shared across every
 * per-registry adapter so the bound is global, not per-host.
 */
export const createLimiter = (concurrency: number): Limiter => {
  const cap = Math.max(1, concurrency)
  let active = 0
  const queue: (() => void)[] = []
  const pump = (): void => {
    while (active < cap && queue.length > 0) {
      const run = queue.shift()
      if (!run) break
      active++
      run()
    }
  }
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            pump()
          })
      })
      pump()
    })
}

/**
 * Wrap a `fetch` with an in-memory response cache so the completion's
 * walk-then-resolve never fetches the same packument twice. Keyed by URL, **GET
 * only** — a POST (the audit bulk endpoint) always passes straight through, so no
 * request body is ever memoized and a re-audit re-queries. Each caller gets a
 * fresh `.clone()` (an un-read cached response) so bodies can be read
 * independently; error responses (`!ok`) and network failures are evicted so a
 * transient 5xx / dropped socket never poisons the rest of the run.
 */
export const cachingFetch = (
  base: typeof fetch = defaultFetch,
): typeof fetch => {
  const cache = new Map<string, Promise<Response>>()
  const wrapped = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const method = String(
      init?.method ?? (input as { method?: string })?.method ?? 'GET',
    ).toUpperCase()
    if (method !== 'GET') return base(input, init)
    const url =
      typeof input === 'string'
        ? input
        : ((input as { url?: string })?.url ?? String(input))
    let inflight = cache.get(url)
    if (!inflight) {
      inflight = base(input, init)
        .then((r) => {
          if (!r.ok) cache.delete(url) // don't memoize an error — allow a retry
          return r
        })
        .catch((e) => {
          cache.delete(url) // network failure — evict so it isn't poisoned
          throw e
        })
      cache.set(url, inflight)
    }
    return inflight.then((r) => r.clone())
  }
  return wrapped as typeof fetch
}

export type RetryOptions = {
  attempts?: number
  delayMs?: number
  sleep?: (ms: number) => Promise<void>
}

/** Worth another go: a dropped socket, a rate limit, or the registry's own 5xx. */
const retryable = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500

/**
 * Retry a registry request through a transient failure, with exponential backoff. One
 * `fetch failed` used to abort an entire run, and remediation now re-audits its own result
 * — more rounds, more requests, more chances to be unlucky. Every request yaf makes is a
 * read (packuments, tarballs, the advisory bulk query, which is a POST only because the
 * package list is too long for a URL), so replaying one is safe. A 4xx other than 408/429
 * is an answer, not a failure, and is returned as-is.
 */
export const retryingFetch = (
  base: typeof fetch = defaultFetch,
  { attempts = 3, delayMs = 200, sleep }: RetryOptions = {},
): typeof fetch => {
  const tries = Math.max(1, attempts)
  const wait =
    sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const wrapped = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    let carried: Response | undefined
    for (let n = 0; n < tries; n++) {
      if (n > 0) await wait(delayMs * 2 ** (n - 1))
      try {
        const res = await base(input, init)
        if (!retryable(res.status)) return res
        carried = res
      } catch (e) {
        if (n === tries - 1) throw e
      }
    }
    // Out of attempts with a retryable status: hand the last response back so the caller
    // reports the registry's own error rather than a synthetic one.
    return carried as Response
  }
  return wrapped as typeof fetch
}

/** Fresh shared transport (bounded pool + retry + GET cache) for one build call. */
export const buildTransport = (): { fetch: typeof fetch; limit: Limiter } => ({
  // Retry inside the cache, so a transient failure is replayed before anything is
  // memoized and one success serves every caller.
  fetch: cachingFetch(retryingFetch(defaultFetch)),
  limit: createLimiter(MAX_CONCURRENCY),
})
