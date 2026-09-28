import { afterEach, describe, expect, it, vi } from 'vitest'

// `format` retries with `strict: false` after an ENRICH_REQUIRED, and that retry
// silences EVERY loss — so the guard has to read the loss list, not the code alone.
// Driving that through a real graph would need a lockfile that produces a mixed loss
// set on demand; mocking `stringify` pins the decision itself.
const strict = vi.fn()
const loose = vi.fn(() => 'LOOSE OUTPUT')

vi.mock('lockgraph', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lockgraph')>()
  return {
    ...actual,
    // strict call = no options; the fallback passes `{ strict: false }`.
    stringify: (graph: unknown, fmt: unknown, opts?: { strict?: boolean }) =>
      opts?.strict === false ? loose() : strict(),
  }
})

const { format } = await import('../../main/ts/lockfile')
const { LockfileError } = await import('lockgraph')

const enrichRequired = (classes: string[]) =>
  new LockfileError({
    code: 'ENRICH_REQUIRED',
    message: 'deferred',
    losses: classes.map((c) => ({
      class: c,
      feature: 'integrity:berry-checksum',
      target: 'yarn-berry-v8',
    })),
  } as any)

afterEach(() => vi.clearAllMocks())

describe('format — strict fallback', () => {
  it('falls back when every loss is recoverable', () => {
    strict.mockImplementation(() => {
      throw enrichRequired([
        'berry-checksum',
        'enrichable',
        'structural-expected',
      ])
    })
    expect(format({} as any, 'yarn-berry-v8')).toBe('LOOSE OUTPUT')
    expect(loose).toHaveBeenCalledOnce()
  })

  // The failure mode this guards: a real projection defect riding along on a
  // deferred checksum would be emitted silently by the blanket retry.
  it('rethrows when a meaningful loss rides along on the same error', () => {
    strict.mockImplementation(() => {
      throw enrichRequired(['berry-checksum', 'inherent-meaningful'])
    })
    expect(() => format({} as any, 'yarn-berry-v8')).toThrow(/deferred/)
    expect(loose).not.toHaveBeenCalled()
  })

  it('falls back when the error carries no loss list at all', () => {
    strict.mockImplementation(() => {
      throw new LockfileError({
        code: 'ENRICH_REQUIRED',
        message: 'deferred',
      } as any)
    })
    expect(format({} as any, 'yarn-berry-v8')).toBe('LOOSE OUTPUT')
  })

  it('never retries on any other code', () => {
    strict.mockImplementation(() => {
      throw new LockfileError({
        code: 'IRREDUCIBLE_LOSS',
        message: 'nope',
      } as any)
    })
    expect(() => format({} as any, 'yarn-berry-v8')).toThrow(/nope/)
    expect(loose).not.toHaveBeenCalled()
  })
})
