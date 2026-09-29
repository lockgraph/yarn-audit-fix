import { describe, expect, it } from 'vitest'

import {
  buildTransport,
  cachingFetch,
  createLimiter,
  retryingFetch,
} from '../../main/ts/audit/transport'

const tick = () => new Promise((r) => setImmediate(r))
const defer = () => {
  let resolve!: () => void
  const promise = new Promise<void>((r) => (resolve = r))
  return { promise, resolve }
}

describe('createLimiter', () => {
  it('runs at most `concurrency` tasks at once, then drains the queue', async () => {
    const limit = createLimiter(2)
    let active = 0
    let maxActive = 0
    const gates = Array.from({ length: 5 }, defer)
    const tasks = gates.map((g, i) =>
      limit(async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await g.promise
        active--
        return i
      }),
    )
    await tick()
    expect(maxActive).toBe(2) // only 2 admitted while all are blocked
    gates.forEach((g) => g.resolve())
    expect(await Promise.all(tasks)).toEqual([0, 1, 2, 3, 4]) // all ran
    expect(maxActive).toBe(2) // never exceeded the cap
  })

  it('propagates task rejections and keeps draining', async () => {
    const limit = createLimiter(1)
    const results = await Promise.allSettled([
      limit(async () => {
        throw new Error('boom')
      }),
      limit(async () => 'ok'),
    ])
    expect(results[0]).toMatchObject({ status: 'rejected' })
    expect(results[1]).toMatchObject({ status: 'fulfilled', value: 'ok' })
  })

  it('treats a non-positive concurrency as 1', async () => {
    const limit = createLimiter(0)
    expect(await limit(async () => 42)).toBe(42)
  })

  // [stress/property] many tasks, a low cap, deterministic rejections — assert the
  // invariants that matter for a registry pool: the cap is never exceeded, every
  // task settles, a rejection doesn't leak an active slot or stall the queue, and
  // admission stays FIFO. (Deterministic, no RNG: every 5th task rejects.)
  it('holds the cap across many tasks, rejections and all, without leaking or reordering', async () => {
    const cap = 3
    const N = 40
    const limit = createLimiter(cap)
    let active = 0
    let maxActive = 0
    const startOrder: number[] = []
    const tasks = Array.from({ length: N }, (_, i) =>
      limit(async () => {
        active++
        maxActive = Math.max(maxActive, active)
        startOrder.push(i)
        await tick() // yield so admitted tasks genuinely overlap and the pump churns
        await tick()
        active--
        if (i % 5 === 4) throw new Error(`boom ${i}`)
        return i
      }).catch((e) => e as Error),
    )
    const results = await Promise.all(tasks)
    expect(maxActive).toBe(cap) // reached the cap…
    expect(active).toBe(0) // …and never leaked a slot (all decremented)
    expect(startOrder).toEqual([...Array(N).keys()]) // FIFO admission
    expect(results.filter((r) => r instanceof Error)).toHaveLength(N / 5) // rejections surfaced
    expect(results.filter((r) => typeof r === 'number')).toHaveLength(N - N / 5)
    // the pool still works after the churn — no permanently-held slots
    expect(await limit(async () => 'ok')).toBe('ok')
  })
})

describe('cachingFetch', () => {
  it('GET: collapses repeat URLs into one round-trip, bodies read independently', async () => {
    let calls = 0
    const base = (async (input: string) => {
      calls++
      return new Response(JSON.stringify({ url: String(input) }), {
        status: 200,
      })
    }) as typeof fetch
    const f = cachingFetch(base)
    const [a, b] = await Promise.all([f('https://r/pkg'), f('https://r/pkg')])
    expect(calls).toBe(1)
    expect(await a.json()).toEqual({ url: 'https://r/pkg' })
    expect(await b.json()).toEqual({ url: 'https://r/pkg' }) // independent clone
  })

  it('distinct URLs each fetch', async () => {
    let calls = 0
    const base = (async () => {
      calls++
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const f = cachingFetch(base)
    await f('https://r/a')
    await f('https://r/b')
    expect(calls).toBe(2)
  })

  it('POST is never cached (the audit bulk endpoint always re-queries)', async () => {
    let calls = 0
    const base = (async () => {
      calls++
      return new Response('{}', { status: 200 })
    }) as typeof fetch
    const f = cachingFetch(base)
    const body = JSON.stringify({ a: ['1'] })
    await f('https://r/-/npm/v1/security/advisories/bulk', {
      method: 'POST',
      body,
    })
    await f('https://r/-/npm/v1/security/advisories/bulk', {
      method: 'POST',
      body,
    })
    expect(calls).toBe(2)
  })

  it('does not memoize an error response — a later call retries', async () => {
    let calls = 0
    const base = (async () => {
      calls++
      return new Response('x', { status: calls === 1 ? 500 : 200 })
    }) as typeof fetch
    const f = cachingFetch(base)
    const first = await f('https://r/pkg')
    expect(first.status).toBe(500)
    const second = await f('https://r/pkg')
    expect(second.status).toBe(200) // re-fetched
    expect(calls).toBe(2)
  })

  it('evicts on network failure so the cache is not poisoned', async () => {
    let calls = 0
    const base = (async () => {
      calls++
      if (calls === 1) throw new Error('socket hang up')
      return new Response('ok', { status: 200 })
    }) as typeof fetch
    const f = cachingFetch(base)
    await expect(f('https://r/pkg')).rejects.toThrow('socket hang up')
    const retried = await f('https://r/pkg')
    expect(retried.status).toBe(200) // retried, not poisoned
    expect(calls).toBe(2)
  })
})

describe('retryingFetch', () => {
  // No real waiting: the backoff is injected so the test measures the policy, not the clock.
  const slept: number[] = []
  const sleep = async (ms: number) => void slept.push(ms)
  const res = (status: number) => new Response('{}', { status })

  it('replays a dropped socket and returns the eventual success', async () => {
    slept.length = 0
    let calls = 0
    const base = (async () => {
      calls++
      if (calls === 1) throw new TypeError('fetch failed')
      return res(200)
    }) as unknown as typeof fetch
    const r = await retryingFetch(base, { delayMs: 10, sleep })('https://r/x')
    expect(r.status).toBe(200)
    expect(calls).toBe(2)
    expect(slept).toEqual([10]) // backed off once before the retry
  })

  it('replays a 503 and backs off exponentially', async () => {
    slept.length = 0
    let calls = 0
    const base = (async () =>
      res(++calls < 3 ? 503 : 200)) as unknown as typeof fetch
    const r = await retryingFetch(base, { delayMs: 10, sleep })('https://r/x')
    expect(r.status).toBe(200)
    expect(slept).toEqual([10, 20])
  })

  // A 404 is the registry answering "no such package" — retrying it only wastes time.
  it('does not retry a 404', async () => {
    let calls = 0
    const base = (async () => {
      calls++
      return res(404)
    }) as unknown as typeof fetch
    expect((await retryingFetch(base, { sleep })('https://r/x')).status).toBe(
      404,
    )
    expect(calls).toBe(1)
  })

  it('gives up and rethrows once the attempts are spent', async () => {
    let calls = 0
    const base = (async () => {
      calls++
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(
      retryingFetch(base, { attempts: 2, delayMs: 1, sleep })('https://r/x'),
    ).rejects.toThrow('fetch failed')
    expect(calls).toBe(2)
  })

  // Out of attempts on a 5xx: hand back the registry's own response, not a synthetic error.
  it('returns the last response when every attempt is a 5xx', async () => {
    const base = (async () => res(502)) as unknown as typeof fetch
    const r = await retryingFetch(base, { attempts: 2, delayMs: 1, sleep })(
      'https://r/x',
    )
    expect(r.status).toBe(502)
  })
})

describe('buildTransport', () => {
  it('returns a fresh fetch + limiter pair', () => {
    const t = buildTransport()
    expect(typeof t.fetch).toBe('function')
    expect(typeof t.limit).toBe('function')
  })
})
