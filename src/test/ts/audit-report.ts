import { describe, expect, it } from 'vitest'

import { deferredReasons } from '../../main/ts/audit/report'

describe('deferredReasons', () => {
  it('counts each reason in first-seen order', () => {
    expect(
      deferredReasons([
        { data: { reason: 'tarball-unavailable' } },
        { data: { reason: 'cache-key-unknown' } },
        { data: { reason: 'tarball-unavailable' } },
      ]),
    ).toBe(' (tarball-unavailable: 2, cache-key-unknown: 1)')
  })

  it('is empty when no diagnostic carries a reason', () => {
    expect(deferredReasons([{}, { data: {} }, { data: { reason: 42 } }])).toBe('')
  })

  it('skips diagnostics without a reason', () => {
    expect(
      deferredReasons([{ data: { reason: 'patched' } }, { data: undefined }]),
    ).toBe(' (patched: 1)')
  })
})
