import { describe, expect, it, vi } from 'vitest'

import { printRuntimeDigest } from '../../main/ts/stages'

const digest = (flags: Record<string, any>): string => {
  const lines: string[] = []
  const spy = vi
    .spyOn(console, 'log')
    .mockImplementation((s) => void lines.push(String(s)))
  printRuntimeDigest({
    cwd: '/repo',
    flags,
    versions: { yaf: '1.0.0', yafLatest: '1.0.0' },
    manifest: {},
  } as any)
  spy.mockRestore()
  return lines.join('\n')
}

describe('printRuntimeDigest', () => {
  it('never prints credentials embedded in a registry URL', () => {
    const out = digest({
      registry: 'https://alice:s3cr3t@reg.internal/npm/',
      force: true,
    })
    expect(out).not.toContain('s3cr3t')
    expect(out).not.toContain('alice')
    expect(out).toContain('***')
    expect(out).toContain('reg.internal')
    expect(out).toContain('force')
  })

  it('leaves credential-free values untouched', () => {
    const out = digest({
      registry: 'https://registry.npmjs.org/',
      workspace: 'core',
    })
    expect(out).toContain('registry.npmjs.org')
    expect(out).not.toContain('***')
    expect(out).toContain('core')
  })

  it('passes non-string flags through', () => {
    expect(digest({ force: true, verbose: false })).toContain('force')
  })

  // Masking lives in the printer, not in a per-field scrub, so it has to hold for
  // any value the digest is handed — including ones nested below the top level.
  it('masks credentials nested anywhere in the printed object', () => {
    const out = digest({
      nested: { deep: ['https://bob:hunter2@reg.internal/'] },
    } as any)
    expect(out).not.toContain('hunter2')
    expect(out).not.toContain('bob')
    expect(out).toContain('***')
  })

  it('prints nothing under --silent', () => {
    expect(digest({ silent: true, registry: 'https://a:b@x.io/' })).toBe('')
  })
})

describe('--json stdout contract', () => {
  // `yaf --json | jq` has to work: the summary must be the only thing on stdout,
  // so the human digest is suppressed the same way `--silent` suppresses it.
  it('prints no digest under --json', () => {
    expect(digest({ json: true, registry: 'https://a:b@x.io/' })).toBe('')
  })

  it('still prints the digest without --json', () => {
    expect(digest({ force: true })).toContain('force')
  })
})
