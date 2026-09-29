import cp from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const lf = (await import('../../main/ts/lockfile'))._internal
const { getContext, run } = await import('../../main/ts')
const adapter = await import('../../main/ts/audit/adapter')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Captured before the fs spies are installed; vitest lazily reads module
// sources through fs.readFileSync, so the mock must delegate real reads.
const realReadFileSync = fs.readFileSync
const noop = () => {
  /* noop */
}
const fixtures = path.resolve(__dirname, '../fixtures/')
const registryUrl = 'https://example.com'
const dependency = 'example-package'
const scopedDependency = '@scope/package'
const readFixture = (name: string): string =>
  fs.readFileSync(path.resolve(fixtures, name), { encoding: 'utf-8' })
const yarnLockBefore = readFixture('lockfile/legacy/yarn.lock.before')
// `_audit` / `_patch` hit the registry over HTTP now; stub them so this flow
// test stays offline + deterministic. Patch correctness lives in lockfile.ts.
// The report is the normalized TAuditReport yaf consumes from the registry.
const auditReport = JSON.parse(readFixture('lockfile/legacy/audit-report.json'))

const cwd = process.cwd()

const lfAudit = vi.spyOn(lf, '_audit')
const lfParse = vi.spyOn(lf, '_parse')
const lfPatch = vi.spyOn(lf, '_patch')
const lfRefurbish = vi.spyOn(lf, '_refurbish')
const lfFormat = vi.spyOn(lf, '_format')

const projectManifest = JSON.stringify({
  version: '1.0.0',
  devDependencies: {
    '@antongolub/repeater': '^1.4.0',
    '@qiwi/libdefkit': '^2.1.8',
    '@qiwi/substrate': '^1.20.6',
    '@swissquote/crafty-preset-jest': '^1.14.0',
    '@types/jest': '^26.0.22',
    coveralls: '^3.1.0',
    eslint: '^7.24.0',
    'eslint-config-prettier': '^8.2.0',
    'eslint-config-qiwi': '^1.10.8',
    jest: '26.6.3',
    rollup: '^2.45.2',
    'rollup-plugin-commonjs': '^10.1.0',
    'rollup-plugin-node-resolve': '^5.2.0',
    terser: '^5.6.1',
    'ts-jest': '^26.5.5',
    typedoc: '^0.20.35',
    typescript: '^4.2.4',
  },
})

describe('yarn-audit-fix', () => {
  beforeAll(() => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(noop)
    vi.spyOn(fs, 'existsSync').mockImplementation(() => true)
    // @ts-ignore
    vi.spyOn(fs, 'readFileSync').mockImplementation(
      (name: any, ...rest: any[]) => {
        const s = String(name)
        // Only stub the project's own files; delegate everything else (vitest
        // module sources, node_modules, etc.) to the real fs.
        if (!s.includes('node_modules')) {
          const _name = path.basename(s)
          if (_name === 'yarn.lock') return yarnLockBefore
          if (_name === 'package.json') return projectManifest
        }
        // @ts-ignore
        return realReadFileSync(name, ...rest)
      },
    )
    // yaf is spawn-free now; keep a benign spawnSync spy purely so the "never
    // shells out to `yarn install`" assertion below has something to inspect.
    // @ts-ignore
    vi.spyOn(cp, 'spawnSync').mockReturnValue({ status: 0, stdout: '' })
    // The out-of-date nudge reads the latest published version straight from the
    // registry (no `npm view`); stub it so this flow test stays offline.
    vi.spyOn(adapter, 'buildRegistry').mockReturnValue({
      packument: async () => ({ distTags: { latest: '1.0.1' } }),
    } as any)

    lfAudit.mockResolvedValue(auditReport)
    lfPatch.mockImplementation(async (graph: any) => graph)
    lfRefurbish.mockImplementation(async (graph: any) => graph)
  })
  afterEach(() => {
    vi.clearAllMocks()
    lfAudit.mockResolvedValue(auditReport)
    lfPatch.mockImplementation(async (graph: any) => graph)
    lfRefurbish.mockImplementation(async (graph: any) => graph)
  })
  afterAll(() => vi.restoreAllMocks())

  describe('runner', () => {
    it('throws error on broken package structure', async () => {
      fs.existsSync
        // @ts-ignore
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)

      await expect(run({ cwd: 'unknown' })).rejects.toEqual(
        new Error('not found: yarn.lock'),
      )
    })

    describe('`patch` flow', () => {
      it('patches + refurbishes the lockfile in place — no yarn install', async () => {
        await run({})

        // parse → audit → patch → refurbish → format, each once; the lockfile is
        // read and (re)written in place under cwd, with no reconcile install.
        expect(lfParse).toHaveBeenCalledWith(
          expect.any(String),
          'yarn-classic',
          expect.any(String),
          expect.anything(), // the project manifest (for override capture + anchors)
          expect.any(Function), // the diagnostic sink (pruned root descriptors)
        )
        expect(lfAudit).toHaveBeenCalledTimes(1)
        expect(lfPatch).toHaveBeenCalledTimes(1)
        expect(lfRefurbish).toHaveBeenCalledTimes(1)
        expect(lfFormat).toHaveBeenCalledTimes(1)
        expect(fs.writeFileSync).toHaveBeenCalledWith(
          path.join(cwd, 'yarn.lock'),
          expect.any(String),
        )
        // yaf never shells out to `yarn install` any more.
        expect(cp.spawnSync).not.toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining(['install']),
          expect.anything(),
        )
      })

      it('under --json --dry-run: emits JSON to stdout and skips the write', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(noop)
        try {
          await run({ json: true, 'dry-run': true })
          const printed = log.mock.calls
            .map((c) => String(c[0]))
            .find((s) => s.trim().startsWith('{'))
          expect(printed).toBeDefined()
          expect(() => JSON.parse(printed as string)).not.toThrow()
          expect(fs.writeFileSync).not.toHaveBeenCalled() // --dry-run → no write
        } finally {
          log.mockRestore()
        }
      })
    })

    describe('cli', () => {
      it('parses argv and drives the full patch flow', async () => {
        process.argv.push(
          '--verbose',
          `--registry=${registryUrl}`,
          `--exclude=${dependency}`,
          `--exclude=${scopedDependency}`,
        )
        await import('../../main/ts/cli')
        // cli fires run() asynchronously (fire-and-forget); let it settle.
        await new Promise((r) => setTimeout(r, 100))

        expect(lfAudit).toHaveBeenCalledTimes(1)
        expect(lfPatch).toHaveBeenCalledTimes(1)
        expect(lfRefurbish).toHaveBeenCalledTimes(1)
        expect(lfFormat).toHaveBeenCalledTimes(1)
      })

      describe('on error', () => {
        // resolveBins no longer spawns, so inject the failure at the audit
        // stage; run()'s catch maps the thrown reason to the exit code.
        const checkExit = async (reason: any): Promise<void> => {
          lfAudit.mockImplementationOnce(async () => {
            throw reason
          })
          await run({}).catch(() => {
            /* expected */
          })
        }

        it('sets code to 1 otherwise', async () => {
          await checkExit({ error: new Error('foobar') })
          expect(process.exitCode).toBe(1)
          process.exitCode = 0
        })

        it('returns exit code if passed', async () => {
          await checkExit({ status: 2 })
          expect(process.exitCode).toBe(2)
          process.exitCode = 0
        })
      })
    })
  })

  describe('signals & error reporting', () => {
    it('-V prints the version and skips the patch flow', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await run({ V: true })
        expect(log).toHaveBeenCalledWith('1.0.0') // mocked package.json version
        expect(lfAudit).not.toHaveBeenCalled()
      } finally {
        log.mockRestore()
      }
    })

    it('formatError surfaces signal / captured-output / message / primitive', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      const prev = process.exitCode
      const drive = async (reason: any): Promise<string> => {
        err.mockClear()
        lfAudit.mockImplementationOnce(async () => {
          throw reason
        })
        await run({}).catch(() => {})
        return err.mock.calls.map((c) => String(c[0])).join('\n')
      }
      try {
        expect(await drive({ signal: 'SIGINT' })).toMatch(
          /interrupted \(SIGINT\)/,
        )
        expect(
          await drive({ stderr: Buffer.from('boom from stderr') }),
        ).toMatch(/boom from stderr/)
        expect(await drive({ message: 'just a message' })).toMatch(
          /just a message/,
        )
        expect(await drive('plain string error')).toMatch(/plain string error/)
      } finally {
        err.mockRestore()
        process.exitCode = prev
      }
    })

    it('the first interrupt cancels the run and sets exit 130', async () => {
      const handlers: Record<string, any> = {}
      const onSpy = vi
        .spyOn(process, 'on')
        .mockImplementation(
          (ev: any, fn: any) => ((handlers[ev] = fn), process),
        )
      const err = vi.spyOn(console, 'error').mockImplementation(() => {})
      const prev = process.exitCode
      try {
        await run({})
        onSpy.mockRestore() // stop intercepting before invoking the captured handler
        expect(typeof handlers.SIGINT).toBe('function')
        vi.useFakeTimers() // the abort fallback schedules setTimeout(process.exit) — keep it fake
        try {
          handlers.SIGINT('SIGINT')
        } finally {
          vi.useRealTimers() // discards the pending fake timer (process.exit never fires)
        }
        expect(err).toHaveBeenCalledWith(
          expect.stringContaining('Aborted (SIGINT)'),
        )
        expect(process.exitCode).toBe(130)
      } finally {
        onSpy.mockRestore()
        err.mockRestore()
        process.exitCode = prev
      }
    })
  })

  describe('#getContext', () => {
    it('parses flags, returns ctx entry', () => {
      const cwd = '/foo/bar'
      const bar = 'baz'
      const ctx = getContext({ cwd, bar })

      expect(ctx).toEqual(
        expect.objectContaining({
          cwd,
          flags: { cwd, bar },
          manifest: expect.objectContaining({ version: '1.0.0' }),
        }),
      )
    })
  })
})
