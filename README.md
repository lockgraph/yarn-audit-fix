<p align="center">
  <a href="https://yarnpkg.com/">
    <img alt="Yarn audit fix" src="https://github.com/lockgraph/yarn-audit-fix/blob/master/img/yarn-audit-fix.png?raw=true" width="546">
  </a>
</p>

<h1 align="center">
  yarn-audit-fix
</h1>

[![CI](https://github.com/lockgraph/yarn-audit-fix/actions/workflows/ci.yaml/badge.svg?event=push)](https://github.com/lockgraph/yarn-audit-fix/actions/workflows/ci.yaml)
[![Maintainability](https://qlty.sh/gh/lockgraph/projects/yarn-audit-fix/maintainability.svg)](https://qlty.sh/gh/lockgraph/projects/yarn-audit-fix)
[![Code Coverage](https://qlty.sh/gh/lockgraph/projects/yarn-audit-fix/coverage.svg)](https://qlty.sh/gh/lockgraph/projects/yarn-audit-fix)
[![Known Vulnerabilities](https://snyk.io/test/github/lockgraph/yarn-audit-fix/badge.svg)](https://snyk.io/test/github/lockgraph/yarn-audit-fix)
[![Downloads](https://img.shields.io/npm/dt/yarn-audit-fix)](https://www.npmjs.com/package/yarn-audit-fix)
[![npm (tag)](https://img.shields.io/npm/v/yarn-audit-fix)](https://www.npmjs.com/package/yarn-audit-fix)

The missing `yarn audit fix`

- [Digest](#digest)
   - [Problem](#problem)
   - [Solution](#solution)
   - [Key features](#key-features)
- [Getting started](#getting-started)
   - [Requirements](#requirements)
   - [Install](#install)
   - [CLI](#cli)
   - [ENV](#env)
   - [JS API](#js-api)
- [Migration notes](#migration-notes)
   - [^11.0.0](#1100)
   - [^10.0.0](#1000)
   - [^9.0.0](#900)
   - [^8.0.0](#800)
   - [^7.0.0](#700)
   - [^6.0.0](#600)
   - [^4.0.0](#400)
- [⚠️ Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Digest
### Problem
1. `yarn audit` detects vulnerabilities but cannot fix them. The authors suggest [Dependabot](https://dependabot.com/) or [Snyk](https://snyk.io/), which is inconvenient in many setups. Discussion: [yarn/issues/7075](https://github.com/yarnpkg/yarn/issues/7075).
2. `yarn audit` does not support custom (in-house) registries — see this [issue](https://github.com/yarnpkg/yarn/issues/7012) & [PR](https://github.com/yarnpkg/yarn/pull/6484), still unmerged.

### Solution
yarn-audit-fix fetches advisories straight from the registry (the npm bulk
advisory endpoint) and patches the lockfile graph directly via [`lockgraph`](https://github.com/lockgraph/lockgraph)
(kudos to [G. Kosev](https://github.com/spion), [code reference](https://github.com/hfour/yarn-audit-fix-ng/blob/main/src/index.ts)).
Full description: [dev.to/yarn-audit-fix-for-yarn-2-berry](https://dev.to/antongolub/the-missing-yarn-audit-fix-for-yarn-2-berry-1p8)

### Key features
* Supports every yarn lockfile schema in the wild: Yarn 1 Classic, Yarn 2/3 (berry v4–v6) and **Yarn 4+** (berry v8/v9/v10), auto-detected via [`lockgraph`](https://github.com/lockgraph/lockgraph).
* Fixes vulnerabilities by patching the lockfile graph directly
* Opt-in [engine & license constraints](#constraints-engines--licenses) — only apply a fix whose dependency closure runs on your target Node and passes your license policy
* macOS / Linux / Windows
* CLI and JS API
* TypeScript typings

#### Lockfile compatibility

| Yarn  | Lockfile schema           | Supported |
|-------|---------------------------|:---------:|
| 1.x   | `yarn-classic`            | ✅        |
| 2.x   | `yarn-berry-v4`           | ✅        |
| 3.0   | `yarn-berry-v5`           | ✅        |
| 3.1+  | `yarn-berry-v6`           | ✅        |
| 4.0–4.13 | `yarn-berry-v8`        | ✅        |
| 4.14+ | `yarn-berry-v9`           | ✅        |
| 5.x dev | `yarn-berry-v10`        | ✅        |

## Getting started
### Requirements
Node.js: `>=18.12` — the highest floor in the shipped dependency closure (`@yarnpkg/libzip` / `@yarnpkg/fslib`); [`lockgraph`](https://github.com/lockgraph/lockgraph) itself needs only `>=14.18`. yaf declares no `engines` of its own.

### Install
```sh
yarn add yarn-audit-fix -D
```
or run it directly:
```sh
npm_config_yes=true npx yarn-audit-fix
```

### CLI
<pre>
$ yarn-audit-fix [--opts]

<b>Verifying package structure...</b>
<b>Patching yarn.lock with audit data...</b>
Upgraded deps (1):
  minimist@1.2.5 → 1.2.6  [critical, CVSS 9.8] GHSA-xvch-5gv4-984h
<b>Done</b>
</pre>

The lockfile is patched **in place** — the fix versions, their new transitive
dependencies, and (for yarn berry) the package checksums are all resolved
straight from the registry, so there's no reconcile `yarn install` step. A
checksum yaf can't prove (say, a package with no fetchable tarball) is left out
rather than guessed, and the run names it and why; a plain `yarn install` fills
it in without changing any resolution.

| Option                | Description                                                                                                                                                             | Default                                    |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------|
| `--audit-level`       | Include a vulnerability with a level as defined or higher. Supported values: low, moderate, high, critical                                                              | all                                      |
| `--cwd`               | Current working dir                                                                                                                                                     | `process.cwd()`                            |
| `--dry-run`           | Get an idea of what audit fix will do                                                                                                                                   |                                            |
| `--json`              | Print the outcome as JSON — `{ dryRun, upgraded, skipped, excluded, noFix }` — instead of the human summary; pairs with `--dry-run` for a machine-readable preview.       | `false`                                    |
| `--force`             | Apply cross-major fixes: bump past a consumer's declared range, and rewrite a direct-dep range in `package.json` (root or a workspace) that the fix falls outside. See [Direct-dependency pins](#direct-dependency-pins) | `false`             |
| `--help/-h`           | Print help message                                                                                                                                                      |                                            |
| `--registry`          | Custom registry url                                                                                                                                                     |                                            |
| `--silent`            | Disable log output                                                                                                                                                      | `false`                                    |
| `--verbose`           | Switch log level to verbose/debug                                                                                                                                       | `false`                                    |
| `--exclude`           | Packages to skip updating — comma-separated `glob[@range]` rules (e.g. `lodash,@scope/*@>=2 <3`); the range is matched against the installed version. Repeatable.        |                                            |
| `--ignore`            | Advisory ids to ignore — comma-separated globs matched against the GHSA id (from the advisory url) or the npm advisory id (e.g. `GHSA-*,1106913`). Repeatable.            |                                            |
| `--engines.<engine>`  | Only apply a fix whose completed dependency closure runs on the given engine — `--engines.node='>=18'`, `=floor` (infer from the installed tree), or bare `--engines.node` (the Node running the CLI). Repeatable per engine. See [Constraints](#constraints-engines--licenses). |                                            |
| `--license.allow` / `--license.deny` | Only apply a fix whose closure's SPDX licenses pass the policy — `--license.allow=MIT,ISC` (or bare `--license=MIT,ISC`) / `--license.deny=GPL-3.0`. See [Constraints](#constraints-engines--licenses).                          |                                            |
| `--package-type`      | Only apply a fix whose closure stays require-able — `cjs` rejects an ESM-only dependency a CommonJS tree can't `require()`. See [Constraints](#constraints-engines--licenses).                                                    |                                            |
| `--on-conflict`       | What to do when a fix can't satisfy the engine / license / package-type constraints: `skip` (leave it, report) or `stop` (error).                                       | `skip`                                     |
| `--safe`              | Fix only what's safe on every automatable axis (the opposite of `--force`): bundles `--engines.node=floor` + `--package-type=cjs` (the latter only in a CommonJS project). See [Constraints](#constraints-engines--licenses).      |                                            |
| `--production` / `--prod` | Fix only advisories reachable from **production** dependencies (`dependencies` / `optionalDependencies` / `peerDependencies`); dev-only ones are left and reported. See [Scope](#scope-production--workspaces).             | `false`                                    |
| `--workspace`         | Monorepo: fix only the selected workspaces' closures — comma-separated globs on a workspace's name / path / path-basename (e.g. `@scope/core`, `packages/*`, `core,cli`). See [Scope](#scope-production--workspaces).             |                                            |

#### Constraints (engines & licenses)

By default a fix is the lowest published version that clears the advisory. You can
add **opt-in acceptance gates** so a fix is only applied when its *completed
dependency closure* also satisfies a policy — otherwise the vulnerability is left
in place and reported (or, with `--on-conflict=stop`, the run errors).

- **Engines** — `--engines.node='>=18'` accepts a fix only if every new package it
  pulls in runs on Node ≥ 18. This catches the case where a security bump quietly
  drags in a transitive that needs a newer runtime than your project targets — the
  install passes, but CI/production on the old Node breaks. A bare `--engines.node`
  uses the Node running the CLI (printed in the report, since that may differ from
  your project's target); pass an explicit range to be sure, or `--engines.node=floor`
  to infer it from what your tree already requires (the highest `engines` floor
  across the root `package.json` + installed `node_modules`) — a fix is then rejected
  only if it would *raise* that floor. Any engine works (`--engines.npm='>=9'`),
  lenient by npm parity — a package that declares no `engines` is accepted.
- **Licenses** — `--license.allow=MIT,ISC,Apache-2.0` (or `--license.deny=GPL-3.0`)
  accepts a fix only if the SPDX license of every new package it pulls in passes
  the allow/deny policy. A bare `--license=MIT,ISC` is an allow list. An
  unresolvable SPDX *expression* (`(MIT OR X)`) is flagged, not silently accepted.
- **Package format** — `--package-type=cjs` accepts a fix only if every new
  package it pulls in stays require-able: a dependency that has gone **ESM-only**
  (`"type": "module"` with no CJS `main`/`exports`) would break every `require()`
  of it in a CommonJS tree, so the fix is left for you to take deliberately. It's a
  consistency check on entry points, not a runtime one — yaf can't prove your code
  runs, but it can catch a fix that flips a dependency's module format.

Every skip is attributed in the report — the axis, the blocking package, and the
versions tried — so you can widen the target, `--exclude` the package, or accept
the newer dependency:

```
Constraints: node >=18
Skipped (constraints — no fix keeps the closure within the policy [node >=18]; …):
  lodash@4.17.11 → 4.18.0 — needs some-dep@^2.0.0
```

> Constraints gate both the version a fix lands on and the dependency **closure**
> it pulls in. A fix whose own version fails the policy is skipped and reported
> as *the fix version itself is not permitted*.

**`--safe`** rolls the automatable gates into one flag — the opposite of `--force`.
It's shorthand for `--engines.node=floor` (don't raise the engine floor your tree
already stands on) plus `--package-type=cjs` in a CommonJS project (don't introduce
an ESM-only dependency). So `yarn-audit-fix --safe` means *fix everything you can
without changing what my project runs on or how it loads* — and flags the rest for
a deliberate follow-up. (License stays an explicit policy; `--safe` doesn't guess it.)

#### Direct-dependency pins

If a fix falls outside a direct dependency's declared range in `package.json` (an
exact pin like `"lodash": "4.17.11"`, or a range that can't reach the fix), the
package is **flagged and skipped** by default — the fix is never silently applied
behind a manifest that forbids it. Re-run with `--force` to rewrite that range in
place (preserving the `^` / `~` / exact operator) and apply the bump, matching
`npm audit fix --force`. In a monorepo the pin is found and rewritten in the
workspace `package.json` that declares it — the report names the file:

```
Skipped (package.json pins these to a range the fix can't satisfy; re-run with --force …):
  lodash (pinned → "4.17.11" in packages/foo/package.json)
```

#### Scope (production & workspaces)

By default every advisory in the lockfile is fixed. Two opt-in flags narrow the
fix to a subgraph — they gate *which* advisories are fixed, not *how* (the patch
and its `--immutable` reproducibility are unchanged):

- **`--production`** (`--prod`) fixes only advisories reachable from your
  **production** dependencies. `yarn.lock` carries no dev/prod marker — every edge
  is a plain dependency — so the split is read from each `package.json`: a package
  reachable only through `devDependencies` is left in place (and reported), while
  `dependencies` / `optionalDependencies` / `peerDependencies` and their closures
  are fixed. This mirrors what a `--omit=dev` production install actually ships.
- **`--workspace=<globs>`** (monorepo) fixes only the selected workspaces'
  closures. Comma-separated globs match a workspace's **name**, its **path**, or
  the path **basename** (`@scope/core`, `packages/*`, `core,cli`). A workspace
  reached as a dependency of a selected one contributes only its *production*
  deps, so one package's dev tree never leaks into another's closure. A pattern
  that matches no workspace is an error, not a silent empty run.

Combine them — `--production --workspace=packages/api` is the production closure
of `packages/api`. Out-of-scope advisories are reported (a count by default, the
full list under `--verbose`), so a reduced fix set is never a silent surprise:

```
Scope: production
Skipped 12 package(s) outside production scope (--verbose to list)
```

#### Machine-readable output (`--json`)

`--json` prints the outcome as a single JSON object instead of the human summary —
pair it with `--dry-run` for a preview a CI step can gate on (no lockfile is
written). Human logs and the spinner are suppressed, so stdout is pure JSON:

```bash
yarn-audit-fix --dry-run --json
```
```json
{
  "dryRun": true,
  "upgraded": [{ "name": "lodash", "from": "4.17.20", "to": "4.17.21", "severity": "high" }],
  "skipped": [{ "package": "some-tool@1.4.0 → 2.0.0", "reason": "constraint" }],
  "excluded": [],
  "noFix": []
}
```

`reason` is one of `consumer-range`, `override-pin`, `manifest-pin`, `constraint`,
or `out-of-scope`.

### ENV
Any CLI option can be set via a `YAF`-prefixed env var (the dot-nested
`--engines.*` / `--license.*` are flag-only). For example:
* `YAF_FORCE` — `--force`
* `YAF_AUDIT_LEVEL=high` — `--audit-level=high`
* `YAF_ON_CONFLICT=stop` — `--on-conflict=stop`
* `YAF_PRODUCTION=true` — `--production`
* `YAF_WORKSPACE='packages/*'` — `--workspace=packages/*`
* `YAF_JSON=true` — `--json`

### JS API
**yarn-audit-fix** exposes its internals, so you can tweak the steps or build your own flow.
Typedoc: [antongolub.github.io/yarn-audit-fix/modules](https://antongolub.github.io/yarn-audit-fix/modules/)

```ts
import { run } from 'yarn-audit-fix'

// async since v11 — advisories are fetched from the registry over HTTP
await run({
   verbose: true
})
```

Individual stages (`resolveBins`, `patchLockfile`, `verify`, …) are exported too, so you can compose your own pipeline if needed.

## Migration notes
### ^11.0.0
**BREAKING:** the legacy `convert` flow is removed, and so is the `--flow` switch (plus its `synp`-based two-way lockfile conversion and the now-dead `--package-lock-only` / `--legacy-peer-deps` / `--loglevel` / `--only` flags). Direct graph patching is the only flow now — it is more controllable and supports every yarn schema.

With a single flow, the flow abstraction itself is gone: `getFlow`, the `TFlow` / `TStage` types, and the optional custom-flow argument to `run` are removed. Call `run(flags)` — the patch pipeline is inlined. The individual stages are still exported if you want to assemble your own.

Adds first-class Yarn 4+ support ([#248](https://github.com/lockgraph/yarn-audit-fix/issues/248)). The bespoke v1/v2 lockfile adapters are replaced with [`lockgraph`](https://github.com/lockgraph/lockgraph), which auto-detects every yarn schema (classic + berry v4–v10). The audit parser handles both the yarn 2/3 `{advisories: …}` shape and yarn 4's NDJSON, deriving `patched_versions` from `Vulnerable Versions` when the field is absent. Each vulnerable package is upgraded graph-natively to the lowest published version that clears its advisory, and the fix version's **new transitive dependencies are pulled into the lockfile** (resolved from the registry) — so an upgrade that changes a package's dependency set no longer leaves the lockfile incomplete.

**BREAKING:** `yarn-audit-fix` no longer runs a reconcile `yarn install`. The lockfile is patched and completed entirely in place — fix versions, their new transitive closure, and (for yarn berry) the recomputed package checksums all come straight from the registry. A checksum yaf can't prove is left out and reported rather than guessed; a plain `yarn install` fills it in. yaf no longer shells out to yarn, and a `node_modules` directory is no longer required to run it.

**BREAKING:** advisories are now fetched **straight from the registry** (the npm bulk advisory endpoint) instead of spawning `yarn audit` / `npm audit`. This fixes audit against custom/in-house registries ([yarn#7012](https://github.com/yarnpkg/yarn/issues/7012)) and is faster (the lockfile graph is already parsed). The registry, per-scope registries and auth are inherited from `.npmrc` / `.yarnrc.yml` / `.yarnrc` (project then global) + env, or overridden with `--registry`. Auth tokens are bound to the host that declared them and only sent over HTTPS.

**BREAKING:** because the fetch is over HTTP, the run is now async — **`runSync` is removed**. Use `await run(flags)` (the CLI is unchanged). The exported stages are still available if you assemble your own pipeline.

**Lockfile fidelity:** checksums, integrity, `conditions` / `dependenciesMeta` /
`peerDependenciesMeta`, and `patch:` / `resolutions` / git / npm-alias entries are all
preserved — real-world locks round-trip unchanged, so a fix produces no spurious churn.

**Slimmer footprint:** `jest`→`vitest`; dropped `lodash-es` / `fs-extra` / `chalk` /
`js-yaml`; `commander`→`minimist`.

**Node floor / `engines`:** v11 no longer declares `engines.node`, so installing yarn-audit-fix never warns `EBADENGINE` on its own behalf. The effective runtime floor is **Node ≥ 18.12**, set by Yarn's zip layer (`@yarnpkg/libzip` / `@yarnpkg/fslib`) that recomputes berry checksums; [`lockgraph`](https://github.com/lockgraph/lockgraph) itself runs on ≥ 14.18. The CLI argument parser also moved off `commander` (which had been ratcheting its own Node floor up) to a tiny `minimist`-based parser — flags, env vars and `--help` are unchanged.

**CLI flags:** both `--exclude` and `--ignore` are applied client-side now (they used to be forwarded to `yarn npm audit`). `--exclude` takes comma-separated **package** rules — `glob[@range]`, e.g. `--exclude="lodash,@scope/*@>=2 <3"` — and skips updating any package whose name matches the glob (and, if a range is given, whose installed version satisfies it); handy for a manually pinned transitive you don't want bumped. `--ignore` keeps its advisory scope but now matches **advisory ids** — comma-separated globs against the GHSA id or the npm advisory id (e.g. `--ignore="GHSA-*"`), dropping matching advisories before the fix. (The npm bulk-advisory endpoint doesn't expose CVE numbers, so — like zx's audit script — matching is by GHSA / npm id.) The standalone `--ignore-engines` flag is removed — there is no longer a reconcile `yarn install` for it to apply to.

### ^10.0.0
v10 bumps the pkg deps and requires NodeJS v14.

### ^9.0.0
v9 adds experimental Yarn 2+ lockfile support and changes how lockfiles are detected (no longer via parse failure).

### ^8.0.0
From v8 the library no longer bundles **npm**, so the system default is used instead. If needed, you can:
* Install the required npm version and provide a custom path via [CLI](#cli) / [ENV](#env) / [JS API](#js-api)
* Use a pinch of **npx** magic: `npm_config_yes=true YAF_NPM_PATH=local npx -p yarn-audit-fix -p npm@8 -c yarn-audit-fix`

### ^7.0.0
Converted to ESM along with its deps, so the legacy `require` API was dropped in v7. Use `import` instead, or try [esm-hook](https://www.npmjs.com/package/@qiwi/esm). The CLI works as before.
```js
// const {run} = require('yarn-audit-fix') turns into
import {run} from 'yarn-audit-fix'
```

### ^6.0.0
Default fix strategy [has been changed](https://github.com/lockgraph/yarn-audit-fix/releases/tag/v6.0.0) to direct lockfile patching with `yarn audit --json` data. The previous _legacy_ `convert` flow was opt-in via `--flow=convert` until v11, where it was removed entirely.

### ^4.0.0
The `--npm-v7` flag is redundant. From v4.0.0 the package's own **npm** is used by default. You can still pick the system default with `--npm-path=system`, or a custom one with `--npm-path=/another/npm/bin`.

## Troubleshooting
### yarn-audit-fix version x.x.x is out of date
```
npm_config_yes=true npx yarn-audit-fix --audit-level=moderate
Runtime digest
yarn-audit-fix version 4.3.6 is out of date. Install the latest 6.0.0 for better results
```
**npx** caches previously loaded packages, so you need one of:
1. Pin the version: `npx yarn-audit-fix@6.0.0`
2. Reset the npx cache. On macOS/Linux: `rm -rf ~/.npm/_npx`

### yarn-audit-fix command not found
After installation, the binary may not be found — usually a `$PATH` issue locating `node_modules/.bin` ([npm/issues/957](https://github.com/npm/npm/issues/957)). Two easy ways around it:
* Run it through **yarn**: `yarn yarn-audit-fix`
* Invoke the script directly: `node_modules/.bin/yarn-audit-fix`

### No fix available for some advisories
Some advisories can't be auto-fixed — there's no published version that satisfies the consumer's declared range, so the bump is skipped (re-run with `--force` to apply cross-major updates anyway).
```shell
npm_config_yes=true npx yarn-audit-fix --audit-level=moderate
```
```shell
Patching yarn.lock with audit data...
Upgraded deps: <none>
No fix available: postcss@7.0.27, ws@7.2.3
Done
```
Not everything can be repaired.

### Cannot install package despite being on correct node version
yarn-audit-fix needs Node ≥ 18.12 (see [Requirements](#requirements)), but nested packages can declare their own engine requirements.
```shell
node-releases@2.0.48: The engine "node" is incompatible with this module. Expected version ">=18". Got "16.20.1"
```

yarn-audit-fix no longer runs a `yarn install`, so a vulnerable project's own transitive engine constraints can't abort the fix. If you hit this while **installing yarn-audit-fix itself** (or on a later `yarn install` of your own), update the runtime — or pass the flag:
```shell
yarn add yarn-audit-fix -D --ignore-engines
```

### Audit used to fail with a 4xx on an odd transitive

Earlier versions spawned **yarn npm audit** / **npm audit**, which could choke on an unusual `yarn.lock` entry (e.g. a transitive in `npm:` alias form) and return `400 Bad Request` ([berry#4117](https://github.com/yarnpkg/berry/issues/4117)).

v11 no longer spawns an audit subprocess — advisories are fetched straight from the registry's bulk endpoint for the parsed lockfile graph — so this failure mode is gone. If you still want to leave a specific package alone, exclude it client-side (no yarn version requirement):
```shell
npx yarn-audit-fix --exclude example-dependency
```

## Contributing
Feel free to open any issues: bugs, feature requests or other questions.
You're always welcome to suggest a PR. Just fork this repo, write some code, add some tests and push your changes.
Any feedback is appreciated.

## License
[MIT](./LICENSE)
