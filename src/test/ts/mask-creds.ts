import { describe, expect, it } from 'vitest'

import { maskUrlCreds } from '../../main/ts/util'

describe('maskUrlCreds', () => {
  // The live case: a failed registry request quotes the URL it tried, credentials
  // and all, and yaf prints that error text verbatim.
  it('masks credentials quoted inside error text', () => {
    const msg =
      'Request cannot be constructed from a URL that includes credentials: ' +
      'https://alice:s3cr3t@reg.internal/-/npm/v1/security/advisories/bulk'
    const out = maskUrlCreds(msg)
    expect(out).not.toContain('s3cr3t')
    expect(out).not.toContain('alice')
    expect(out).toContain('https://***@reg.internal/')
    expect(out).toContain('advisories/bulk') // the useful part survives
  })

  it('masks a user-only URL and every occurrence in one string', () => {
    expect(maskUrlCreds('a https://u@x.io/ b http://u:p@y.io/ c')).toBe(
      'a https://***@x.io/ b http://***@y.io/ c',
    )
  })

  it('leaves credential-free text alone', () => {
    for (const s of [
      'nothing to see here',
      'https://registry.npmjs.org/lodash',
      'see user@example.com for details', // not a URL userinfo
      'scp-like git@github.com:org/repo.git', // no scheme → untouched
    ])
      expect(maskUrlCreds(s)).toBe(s)
  })

  it('handles non-http schemes', () => {
    expect(maskUrlCreds('git+ssh://u:p@host/r.git')).toBe('git+ssh://***@host/r.git')
  })
})
