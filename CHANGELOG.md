## [11.1.0](https://github.com/lockgraph/yarn-audit-fix/compare/v11.0.5...v11.1.0) (2026-09-29)

### Features
* feat: remediate to a fixpoint, raise pinning parents, adopt lockgraph 0.9.0 ([9c16da1](https://github.com/lockgraph/yarn-audit-fix/commit/9c16da1c9eb5d2f2ec5cf67cf39f8d11ff877781))

## [11.0.5](https://github.com/lockgraph/yarn-audit-fix/compare/v11.0.4...v11.0.5) (2026-09-28)

### Fixes & improvements
* fix: update lockgraph to 0.8.1 to fix bin map issues (#402) ([53ad172](https://github.com/lockgraph/yarn-audit-fix/commit/53ad1728b119f7615277ad074a8bec1aefd8aaea))

## [11.0.4](https://github.com/lockgraph/yarn-audit-fix/compare/v11.0.3...v11.0.4) (2026-09-03)

### Fixes & improvements
* refactor: split the audit pipeline into focused modules ([bcf22a2](https://github.com/lockgraph/yarn-audit-fix/commit/bcf22a23d95c8cdac8149e79fc1753f1c42030d0))

## [11.0.3](https://github.com/lockgraph/yarn-audit-fix/compare/v11.0.2...v11.0.3) (2026-09-03)

### Fixes & improvements
* refactor(lockfile): split the patch pipeline into plan/apply/report ([82e6274](https://github.com/lockgraph/yarn-audit-fix/commit/82e6274a6cab50efeac2748a038367456f26cd75))

## [11.0.2](https://github.com/lockgraph/yarn-audit-fix/compare/v11.0.1...v11.0.2) (2026-09-01)

### Fixes & improvements
* refactor: simplify internals ([266b797](https://github.com/lockgraph/yarn-audit-fix/commit/266b797e276bcfc2c60507af93d65bfc2e9c27b8))
* docs: update migration notes ([0583363](https://github.com/lockgraph/yarn-audit-fix/commit/058336323e5eb58974982a0e90a9658dc89844a1))

## [11.0.1](https://github.com/lockgraph/yarn-audit-fix/compare/v11.0.0...v11.0.1) (2026-09-01)

### Fixes & improvements
* fix: restore gh registry grants ([def353e](https://github.com/lockgraph/yarn-audit-fix/commit/def353e11490e4de2c2b5bc530e92948577030f2))

## [11.0.0](https://github.com/lockgraph/yarn-audit-fix/compare/v10.1.1...v11.0.0) (2026-09-01)

### Features
* feat(cli): `--json` machine-readable remediation outcome ([ab9b0dc](https://github.com/lockgraph/yarn-audit-fix/commit/ab9b0dcc69d4c454ef4cb91a64ccda0331c92972))
* feat(audit): scope fixes to production deps / selected workspaces ([8f6764f](https://github.com/lockgraph/yarn-audit-fix/commit/8f6764f0cae5971208b2fdbe420203fbce886690))
* feat(audit): package-type (cjs) constraint + --safe bundle ([8975216](https://github.com/lockgraph/yarn-audit-fix/commit/89752165528801afaf6828dc42c34f6400eaae28))
* feat(audit): --engines.<engine>=floor scans workspace manifests too ([58c8264](https://github.com/lockgraph/yarn-audit-fix/commit/58c8264c49741b9ee3770632f9e3e56a5a2fbc32))
* feat(audit): monorepo-aware manifest gate ([c9bfa92](https://github.com/lockgraph/yarn-audit-fix/commit/c9bfa9264fb2f0f7bf94850d1af262d270ef6051))
* feat(audit): --engines.<engine>=floor infers the target from the tree ([e537628](https://github.com/lockgraph/yarn-audit-fix/commit/e537628f92fe9c4e4c881cf508cc9a043e5f80be))
* feat(audit): gate the fix version itself, not just its closure ([45de57a](https://github.com/lockgraph/yarn-audit-fix/commit/45de57a1f4c99f196f262e59bb390e6d308664ad))
* feat(audit): license allow/deny constraint for remediation ([0aafc8b](https://github.com/lockgraph/yarn-audit-fix/commit/0aafc8bc245ddcc58bff8f16f1ac837a2afc3aab))
* feat(audit): opt-in engine constraints for remediation ([b9ec4c8](https://github.com/lockgraph/yarn-audit-fix/commit/b9ec4c81596b96db25b832fdf8414e5b7ca023b8))
* feat(audit): pin berry cache checksums across all yarn generations ([af49c96](https://github.com/lockgraph/yarn-audit-fix/commit/af49c9679eeb24c6b57dda36f3c44af87f41b262))
* feat(audit): overrides/resolutions during remediation imprs ([7ab7b0c](https://github.com/lockgraph/yarn-audit-fix/commit/7ab7b0c386a09502c2fa2578dc3956ba8e6be994))
* feat(audit): honor package overrides/resolutions during remediation ([52733fa](https://github.com/lockgraph/yarn-audit-fix/commit/52733fadbbbfa169196e5915fdf50711bb6ee7cf))
* feat: live progress for the resolve/complete phase ([9975233](https://github.com/lockgraph/yarn-audit-fix/commit/99752337a23779e92af9f5650103926e7601684d))
* feat: cooperative sigint — AbortSignal cancels in-flight registry HTTP ([6e8f2e9](https://github.com/lockgraph/yarn-audit-fix/commit/6e8f2e9758d8d46bda25affc896b76aa3be63ef9))
* feat: complete install-free patch (lockfile .73) + progress spinner ([2eba1af](https://github.com/lockgraph/yarn-audit-fix/commit/2eba1afe35b7dc375cd081faa26ee071998525b5))
* feat: apply --exclude/--ignore client-side (package globs / advisory ids) ([5800983](https://github.com/lockgraph/yarn-audit-fix/commit/580098326d7ce3b837f2b65db32e3b6d29250e3d))
* feat(audit): annotate each upgrade with severity, CVSS and CVE/GHSA refs ([b02c61f](https://github.com/lockgraph/yarn-audit-fix/commit/b02c61f6fd288309ecb7d5d361ee0e01e2038691))
* feat(audit): yarn 4+ support ([47875a0](https://github.com/lockgraph/yarn-audit-fix/commit/47875a0f74171ffda64a01b080dc3c4f421013b5))

### Fixes & improvements
* perf(audit): bound registry concurrency + cache packument GETs ([ecc6ad6](https://github.com/lockgraph/yarn-audit-fix/commit/ecc6ad6896846c3ceb2b57ddbe21f53c1f77bb81))
* fix(audit): correct yarn-classic resolved host + sha1 in remediation output ([9ec30bf](https://github.com/lockgraph/yarn-audit-fix/commit/9ec30bf8696e3df4a0df6db9ce2927ac0476fa20))
* refactor(audit): drop the in-house registry client — delegate to @antongolub/lockfile ([c2b79ac](https://github.com/lockgraph/yarn-audit-fix/commit/c2b79acf8480718d29b2a15c51788b9a3369e514))
* fix(audit): yarn-berry .yarnrc.yml npmAuthToken was silently dropped ([fb42cf6](https://github.com/lockgraph/yarn-audit-fix/commit/fb42cf60cec17c41ca543007ed254395e473b168))
* refactor: remove dead code — spawn-era flag helpers ([2e9b630](https://github.com/lockgraph/yarn-audit-fix/commit/2e9b6307e031c8958e0dbbd7d53261763eab23ae))
* refactor: drop the PM-CLI audit-output parsers ([a726924](https://github.com/lockgraph/yarn-audit-fix/commit/a726924da80bd66ac6e7a7dfabea431a547a9e2c))
* fix(deps): bump @antongolub/lockfile to 0.0.0-snapshot.80 + preserve base danglers on prune ([0ae1fcc](https://github.com/lockgraph/yarn-audit-fix/commit/0ae1fcc68aa4ad5d667a0438cd830b134b570bf6))
* refactor: drop the yarn/npm binaries entirely — spawn-free, registry-only ([e87361e](https://github.com/lockgraph/yarn-audit-fix/commit/e87361ef9efccfa27fc8c6f19ec622e985e070da))
* refactor: drop npm/yarn bins + versions from the runtime digest ([c559507](https://github.com/lockgraph/yarn-audit-fix/commit/c5595075366addeabb654f3d32b706aa32b76cfa))
* fix(deps): bump @antongolub/lockfile to 0.0.0-snapshot.76 (yarn-3 refurbish) ([dfce044](https://github.com/lockgraph/yarn-audit-fix/commit/dfce044cb5e9618e6494cf91af805fc8e085aa93))
* fix(deps): bump @antongolub/lockfile to 0.0.0-snapshot.69; regen goldens ([1864cc9](https://github.com/lockgraph/yarn-audit-fix/commit/1864cc94a99c351d50d828d623d6eb01e9fec104))
* fix: handle Ctrl+C/SIGINT gracefully ([9592d71](https://github.com/lockgraph/yarn-audit-fix/commit/9592d718ab6692c247eca8d27b9fde8492fa7757))
* refactor: replace commander with a tiny minimist-based CLI parser ([8daf188](https://github.com/lockgraph/yarn-audit-fix/commit/8daf188722b96c3ff961cecf223e44ef305f78c2))
* docs: v11 announce ([f54a8ed](https://github.com/lockgraph/yarn-audit-fix/commit/f54a8ed953e03bc1fd68a58fea58bd56fa482ba4))
* docs: tighten code comments and README ([64078e9](https://github.com/lockgraph/yarn-audit-fix/commit/64078e9adfde0ac34859b38b8ce4732249dacc83))
* fix: enhance semver range protection ([ccd46ec](https://github.com/lockgraph/yarn-audit-fix/commit/ccd46ec19a888a440429552c2276558be950d9e1))
* fix(patch): phase graph mutation so parent+child upgrades never reject ([ac9177c](https://github.com/lockgraph/yarn-audit-fix/commit/ac9177cee1ec2a70198930b28c8b73d980ba0b29))
* fix(patch): handle vulnerable parent + child in one upgrade pass ([e022b80](https://github.com/lockgraph/yarn-audit-fix/commit/e022b80b205c73b8cfe382242b276959334e2d89))
* refactor: separate v4 advisory flow ([a715a62](https://github.com/lockgraph/yarn-audit-fix/commit/a715a62f0ba6570aea94edfbb265c9a0f5bc77c4))
* fix(audit): resolve fix versions against the registry; idempotent yarn 4 runs ([491985f](https://github.com/lockgraph/yarn-audit-fix/commit/491985fff5ddefb2a4ccdb2a7cd939cc1d0c746b))

### BREAKING CHANGES
* significant parts have replaced via `@antongolub/lockfile`, backward compatibility cannot be guaranteed ([47875a0](https://github.com/lockgraph/yarn-audit-fix/commit/47875a0f74171ffda64a01b080dc3c4f421013b5))

## [10.1.1](https://github.com/antongolub/yarn-audit-fix/compare/v10.1.0...v10.1.1) (2024-11-29)

### Fixes & improvements
* fix: up deps to fix cross-spawn vuln ([faafdeb](https://github.com/antongolub/yarn-audit-fix/commit/faafdeba429338c0c1e1f3b162deac116158ac43))

## [10.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.9...v10.1.0) (2024-10-26)

### Features
* feat: use "exclude" and "ignore" CLI options when running `yarn npm audit` command ([015a4b9](https://github.com/antongolub/yarn-audit-fix/commit/015a4b919a73279d1415466b6879e79cd8364ce7))
* feat: support multi-value CLI options ([2664c66](https://github.com/antongolub/yarn-audit-fix/commit/2664c66c0b83aa7250df715e7ac6beef8b17646c))

## [10.0.9](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.8...v10.0.9) (2024-08-21)

### Fixes & improvements
* fix(deps): update dependency commander to v12 ([3fe23a1](https://github.com/antongolub/yarn-audit-fix/commit/3fe23a105170846317187980760b850f1acc7149))

## [10.0.8](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.7...v10.0.8) (2024-08-06)

### Fixes & improvements
* fix: apply object key sort to npm view deps output (#336) ([106229b](https://github.com/antongolub/yarn-audit-fix/commit/106229b7a187eac94fa1aaa88aa4e9a4d9c6ca78))
* fix: set shell true to handle sec fix for windows (#335) ([6a29f1c](https://github.com/antongolub/yarn-audit-fix/commit/6a29f1c204a3cc0245059c91ae9fb2bf3c6c2b53))

## [10.0.7](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.6...v10.0.7) (2023-11-23)

### Fixes & improvements
* fix(deps): update dependency commander to v11 ([1cd29fa](https://github.com/antongolub/yarn-audit-fix/commit/1cd29fac31128167b29f4dc098d0df9b10cc6184))

## [10.0.6](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.5...v10.0.6) (2023-11-22)

### Fixes & improvements
* refactor: use os.temp() instead of find-cache-dir ([85776a0](https://github.com/antongolub/yarn-audit-fix/commit/85776a013e00402e966a715747859c2a1be654ab))
* fix: rm find-up and pkg-dir from deps to bring back nodejs 16 support ([5ac29c1](https://github.com/antongolub/yarn-audit-fix/commit/5ac29c172c333df2ce7716f2face54ecfb383c3e))

## [10.0.5](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.4...v10.0.5) (2023-11-16)

### Fixes & improvements
* fix(deps): update dependency find-up to v7 ([284fb63](https://github.com/antongolub/yarn-audit-fix/commit/284fb632660dc0f90e02e123a9e809671246d6b1))

## [10.0.4](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.3...v10.0.4) (2023-11-04)

### Fixes & improvements
* fix(deps): update dependency pkg-dir to v8 ([9b5feac](https://github.com/antongolub/yarn-audit-fix/commit/9b5feacb174fe83a5700a1b85cc475717e19cedd))

## [10.0.3](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.2...v10.0.3) (2023-11-02)

### Fixes & improvements
* docs: fix docs ([a346796](https://github.com/antongolub/yarn-audit-fix/commit/a3467962162e59c2a5de7892e791aa4fd39f4287))

## [10.0.2](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.1...v10.0.2) (2023-11-02)

### Fixes & improvements
* docs: mention presentation at HolyJS 2022 ([b1641f0](https://github.com/antongolub/yarn-audit-fix/commit/b1641f0f4dfb1453f6c9d028fbf300a3f2d6306d))

## [10.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v10.0.0...v10.0.1) (2023-08-25)

### Fixes & improvements
* fix(deps): update dependency find-cache-dir to v5 ([0c7a0eb](https://github.com/antongolub/yarn-audit-fix/commit/0c7a0ebec84b48d8c6a4f97b1c3872eaba1dd955))

## [10.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.12...v10.0.0) (2023-08-05)

### Fixes & improvements
* perf: deps revision ([5ec15c0](https://github.com/antongolub/yarn-audit-fix/commit/5ec15c0ec2c90cbed9ae5aa585f35b5feeb2f453))
* perf: improve exceptions logging on empty stderr ([ea3e501](https://github.com/antongolub/yarn-audit-fix/commit/ea3e501fed4479b1e9d415a871466ea446d10ecc))

### BREAKING CHANGES
* following the deps, require Node.js v14 ([5ec15c0](https://github.com/antongolub/yarn-audit-fix/commit/5ec15c0ec2c90cbed9ae5aa585f35b5feeb2f453))

## [9.3.12](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.11...v9.3.12) (2023-06-16)


### Bug Fixes

* rollback commander, fix some sonar issues ([f1a9893](https://github.com/antongolub/yarn-audit-fix/commit/f1a9893580249e112cecdb1a615a13517f639b37))

## [9.3.11](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.10...v9.3.11) (2023-06-16)


### Bug Fixes

* **deps:** update dependency commander to v11 ([2e8aa88](https://github.com/antongolub/yarn-audit-fix/commit/2e8aa8865dc945a0ebd7609f1b947f509ae37400))

## [9.3.10](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.9...v9.3.10) (2023-03-21)


### Bug Fixes

* do no mutate __metadata ([97c5706](https://github.com/antongolub/yarn-audit-fix/commit/97c5706d36c9761dfa6e3d7545c40d8a6116c0ab)), closes [#287](https://github.com/antongolub/yarn-audit-fix/issues/287)

## [9.3.9](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.8...v9.3.9) (2023-02-21)

## [9.3.6](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.5...v9.3.6) (2022-09-22)


### Performance Improvements

* up deps ([ccb7c96](https://github.com/antongolub/yarn-audit-fix/commit/ccb7c96d3c391f0bd51748af51cf91edf3e29fe9))

## [9.3.5](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.4...v9.3.5) (2022-08-11)

## [9.3.4](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.3...v9.3.4) (2022-08-11)


### Performance Improvements

* update deps ([e2a7224](https://github.com/antongolub/yarn-audit-fix/commit/e2a722495e1ad9f811dc75d7e884990ff9cf2829))

## [9.3.3](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.2...v9.3.3) (2022-07-27)


### Performance Improvements

* up deps ([f3ccfc6](https://github.com/antongolub/yarn-audit-fix/commit/f3ccfc6241179817d0e8428b6a968941ea87fef6))

## [9.3.2](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.1...v9.3.2) (2022-06-20)


### Performance Improvements

* up deps ([ad94f27](https://github.com/antongolub/yarn-audit-fix/commit/ad94f279173962f143892ca9940b8853a3e2e061))

## [9.3.1](https://github.com/antongolub/yarn-audit-fix/compare/v9.3.0...v9.3.1) (2022-04-25)


### Performance Improvements

* update tslib, update jest ([0a96659](https://github.com/antongolub/yarn-audit-fix/commit/0a96659c7d18dba34805ee4b9818f8ae679e133c))

# [9.3.0](https://github.com/antongolub/yarn-audit-fix/compare/v9.2.4...v9.3.0) (2022-04-21)


### Features

* support nodejs v18 ([b20fd96](https://github.com/antongolub/yarn-audit-fix/commit/b20fd96dd820e753c88b7353b50460253dadc4a8))

## [9.2.4](https://github.com/antongolub/yarn-audit-fix/compare/v9.2.3...v9.2.4) (2022-04-15)


### Bug Fixes

* fix gh-pages publishing ([1179475](https://github.com/antongolub/yarn-audit-fix/commit/117947571fc8997162ff748b4af5868df4e350d7))

## [9.2.3](https://github.com/antongolub/yarn-audit-fix/compare/v9.2.2...v9.2.3) (2022-04-15)


### Performance Improvements

* update deps ([#241](https://github.com/antongolub/yarn-audit-fix/issues/241)) ([fb940b5](https://github.com/antongolub/yarn-audit-fix/commit/fb940b5c37e7482d3379ff0177b5a5439e9b7256))

## [9.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v9.2.1...v9.2.2) (2022-04-03)

## [9.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v9.2.0...v9.2.1) (2022-03-20)


### Performance Improvements

* up deps ([d533180](https://github.com/antongolub/yarn-audit-fix/commit/d5331809004426df158d1d448984701f17e27c16))

# [9.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v9.1.3...v9.2.0) (2022-03-14)


### Features

* print version via `-v` and `--version` flags ([fc2fe73](https://github.com/antongolub/yarn-audit-fix/commit/fc2fe737a25c8ed6ab48ec567e74d24342e72a27))

## [9.1.3](https://github.com/antongolub/yarn-audit-fix/compare/v9.1.2...v9.1.3) (2022-03-14)


### Performance Improvements

* update deps ([c4f0178](https://github.com/antongolub/yarn-audit-fix/commit/c4f0178c40cefce031c1e204000082a0dffc8664))

## [9.1.2](https://github.com/antongolub/yarn-audit-fix/compare/v9.1.1...v9.1.2) (2022-02-20)


### Performance Improvements

* impr stderr logging ([33e9770](https://github.com/antongolub/yarn-audit-fix/commit/33e9770a1ae6fdc092648ea3ac0d7d5287693e4e))

## [9.1.1](https://github.com/antongolub/yarn-audit-fix/compare/v9.1.0...v9.1.1) (2022-02-20)


### Performance Improvements

* tweak up error logging ([88ccb5d](https://github.com/antongolub/yarn-audit-fix/commit/88ccb5dfd6d8d4b277b46292029a7cff568ad43d))

# [9.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.11...v9.1.0) (2022-02-20)


### Features

* improve logging for cp.spawn errors ([b6ef812](https://github.com/antongolub/yarn-audit-fix/commit/b6ef812498876efc00c12efab6259e06da52de12))

## [9.0.11](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.10...v9.0.11) (2022-02-11)


### Bug Fixes

* re-add flow-typings, update deps ([f8efc83](https://github.com/antongolub/yarn-audit-fix/commit/f8efc83b58b42521ae0a0de9059e8099bc6396fb))

## [9.0.10](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.9...v9.0.10) (2022-01-29)


### Bug Fixes

* **deps:** update dependency commander to v9 ([a943204](https://github.com/antongolub/yarn-audit-fix/commit/a9432045b741a34ff7b3660cf0c4863fe3b18a2e))

## [9.0.9](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.8...v9.0.9) (2022-01-24)


### Bug Fixes

* **deps:** update dependency globby to v13 ([b991173](https://github.com/antongolub/yarn-audit-fix/commit/b9911734f4967575e9e336d0a5b917d6ff20b9ca))

## [9.0.8](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.7...v9.0.8) (2022-01-20)

## [9.0.7](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.6...v9.0.7) (2022-01-18)


### Bug Fixes

* update deps, fix some vuls ([9f0b743](https://github.com/antongolub/yarn-audit-fix/commit/9f0b743dda0b5490e09a1867b398ff5dc4493e40))

## [9.0.6](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.5...v9.0.6) (2022-01-11)

## [9.0.5](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.4...v9.0.5) (2022-01-10)

## [9.0.4](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.3...v9.0.4) (2021-12-15)


### Bug Fixes

* do not require node_modules (yarn pnp) ([e3d333a](https://github.com/antongolub/yarn-audit-fix/commit/e3d333ab60ebe8568a5374aa9c2def11ed0f42e2))

## [9.0.3](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.2...v9.0.3) (2021-12-13)


### Bug Fixes

* raise an error if v2 audit report fails ([b04900b](https://github.com/antongolub/yarn-audit-fix/commit/b04900b767caf949d6b183874719d23c4c50d4e6))

## [9.0.2](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.1...v9.0.2) (2021-12-13)


### Bug Fixes

* add a symlink for .yarn assets ([7898410](https://github.com/antongolub/yarn-audit-fix/commit/7898410e2c4ba5154998e8c7935df559b201491d))

## [9.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v9.0.0...v9.0.1) (2021-12-13)

# [9.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v8.1.0...v9.0.0) (2021-12-11)


* feat(v9)!: release v9 ([0584883](https://github.com/antongolub/yarn-audit-fix/commit/0584883166406ad90ee30935f0261d3c283d29e9))


### BREAKING CHANGES

* `enabled experimental Yarn 2+ lockfiles support

# [9.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v8.0.1...v9.0.0) (2021-12-11)


### Documentation

* **readme:** mention v9 changes ([6c0ae5c](https://github.com/antongolub/yarn-audit-fix/commit/6c0ae5ca5ba1b2d04f03734e300cf32cfe286a40))


### Features

* provide experimental lockfile v2 (yarn berry) support ([0243562](https://github.com/antongolub/yarn-audit-fix/commit/024356239ad158b5e71eceef63cda8addba8d18e))
* use yarn2 if exists as audit provider ([0f1537b](https://github.com/antongolub/yarn-audit-fix/commit/0f1537b1aac184142403cb6bcce8c4efb9972f8a))


### BREAKING CHANGES

* **readme:** enabled experimental Yarn 2+ lockfiles support

## [8.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v8.0.0...v8.0.1) (2021-12-02)

# [8.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v7.2.3...v8.0.0) (2021-12-02)


### Bug Fixes

* fix npm-path cli default option value ([2c58a9b](https://github.com/antongolub/yarn-audit-fix/commit/2c58a9b8e52e596289aec2f8229f38af06bf8864))


### Features

* use system npm bin by default ([9b21933](https://github.com/antongolub/yarn-audit-fix/commit/9b21933674353090a8fc49c73aa3da3973d9aa95)), closes [#200](https://github.com/antongolub/yarn-audit-fix/issues/200) [#199](https://github.com/antongolub/yarn-audit-fix/issues/199)


### BREAKING CHANGES

* dropped npm dependency

## [7.2.3](https://github.com/antongolub/yarn-audit-fix/compare/v7.2.2...v7.2.3) (2021-11-27)

## [7.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v7.2.1...v7.2.2) (2021-11-18)


### Bug Fixes

* **deps:** update dependency npm to v8.1.4 ([c9644a0](https://github.com/antongolub/yarn-audit-fix/commit/c9644a08544d9e099e1f172721b337c1859c035c))

## [7.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v7.2.0...v7.2.1) (2021-11-14)

# [7.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v7.1.5...v7.2.0) (2021-11-05)


### Bug Fixes

* **deps:** update npm to v8.1.3 ([d087c41](https://github.com/antongolub/yarn-audit-fix/commit/d087c41ce4ca1e0d1f6981c1575cf14ac4818af9))
* use cwd on temp assets generation ([ae2f7f4](https://github.com/antongolub/yarn-audit-fix/commit/ae2f7f47ddf833652d15ee470ca229cb51566227))


### Features

* verify package structure ([93b254a](https://github.com/antongolub/yarn-audit-fix/commit/93b254a3f60c74f5e86c32e8c4d820bc54fe561a))

## [7.1.5](https://github.com/antongolub/yarn-audit-fix/compare/v7.1.4...v7.1.5) (2021-11-01)


### Bug Fixes

* **lockfile:** override internal strip-ansi/ansi-regex to v5.0.1 ([2b62278](https://github.com/antongolub/yarn-audit-fix/commit/2b622785b4a114c551e98aecf811c063242eb6a1)), closes [#199](https://github.com/antongolub/yarn-audit-fix/issues/199)
* update synp to v1.9.8 ([fe13f4c](https://github.com/antongolub/yarn-audit-fix/commit/fe13f4cdcbd37097d56456aa9bd0cd1224d3cb00))

## [7.1.4](https://github.com/antongolub/yarn-audit-fix/compare/v7.1.3...v7.1.4) (2021-10-28)


### Bug Fixes

* **deps:** update dependency npm to v8.1.2 ([2c3ea93](https://github.com/antongolub/yarn-audit-fix/commit/2c3ea933cb715aa30d2bd43ffd14280c0286af2d))

## [7.1.3](https://github.com/antongolub/yarn-audit-fix/compare/v7.1.2...v7.1.3) (2021-10-23)


### Bug Fixes

* update npm to v8.1.1 ([f817dab](https://github.com/antongolub/yarn-audit-fix/commit/f817dab4fa11d498467db732819ce508aec395b1))

## [7.1.2](https://github.com/antongolub/yarn-audit-fix/compare/v7.1.1...v7.1.2) (2021-10-15)


### Bug Fixes

* **deps:** update dependency npm to v9.0.0 ([c685ade](https://github.com/antongolub/yarn-audit-fix/commit/c685adebe1e71912795023788afa9d1b5c71629a))

## [7.1.1](https://github.com/antongolub/yarn-audit-fix/compare/v7.1.0...v7.1.1) (2021-10-12)


### Bug Fixes

* **deps:** update dependency typescript to v4.4.4 ([#195](https://github.com/antongolub/yarn-audit-fix/issues/195)) ([3a4d217](https://github.com/antongolub/yarn-audit-fix/commit/3a4d2171db9f8daa3e5ab6f3267bcc66bb3ba0b7))

# [7.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.8...v7.1.0) (2021-10-11)


### Bug Fixes

* **deps:** update dependency npm to v8 ([6a07aa2](https://github.com/antongolub/yarn-audit-fix/commit/6a07aa2e5d0de987a9568b1f226e2ea015a4d095))
* **deps:** update npm to v8.0.0 ([b54cc7a](https://github.com/antongolub/yarn-audit-fix/commit/b54cc7aba6021f5fed19e4649897bca0360e559a))


### Features

* add cwd option ([4ff467b](https://github.com/antongolub/yarn-audit-fix/commit/4ff467b0aa3798684f63ff31fc3aee68d821bda7)), closes [#135](https://github.com/antongolub/yarn-audit-fix/issues/135)

## [7.0.8](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.7...v7.0.8) (2021-10-04)


### Bug Fixes

* **deps:** update dependency npm to v7.24.2 ([2c5728b](https://github.com/antongolub/yarn-audit-fix/commit/2c5728b9f01e7ff5ef23d249a05fd9c3411e18ee))

## [7.0.7](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.6...v7.0.7) (2021-10-02)

## [7.0.6](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.5...v7.0.6) (2021-10-02)


### Performance Improvements

* update pkg-dir to v6.0.0 ([3b54abb](https://github.com/antongolub/yarn-audit-fix/commit/3b54abb3854916060e24c89355f10b367b3ff08f))

## [7.0.5](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.4...v7.0.5) (2021-09-28)


### Bug Fixes

* **deps:** update dependency npm to v7.24.1 ([28cd8c0](https://github.com/antongolub/yarn-audit-fix/commit/28cd8c07fe82e6c1154ba99afadd69e6099d21ab))

## [7.0.4](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.3...v7.0.4) (2021-09-17)


### Bug Fixes

* **deps:** update dependency npm to v7.24.0 ([af0d80f](https://github.com/antongolub/yarn-audit-fix/commit/af0d80f4a7fdbf8643541b7d6815c717b356cb24))

## [7.0.3](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.2...v7.0.3) (2021-09-13)

## [7.0.2](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.1...v7.0.2) (2021-09-10)


### Bug Fixes

* **package:** add missed prod dep `find-up` ([6fa6d8f](https://github.com/antongolub/yarn-audit-fix/commit/6fa6d8fa7d971d4335bce814969e014727b7b621)), closes [#179](https://github.com/antongolub/yarn-audit-fix/issues/179)

## [7.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v7.0.0...v7.0.1) (2021-09-09)


### Bug Fixes

* **deps:** update dependency npm to v7.23.0 ([961db82](https://github.com/antongolub/yarn-audit-fix/commit/961db82a6d423bd0dda09e092468d975337fbf29))

# [7.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v6.4.4...v7.0.0) (2021-09-08)


### Features

* move to esm ([16a3e65](https://github.com/antongolub/yarn-audit-fix/commit/16a3e65f83715fc01994c0c06e3985fd4cd9632b))


### BREAKING CHANGES

* require Node.js ^12.20.0 || ^14.13.1 || >=16.0.0

## [6.4.4](https://github.com/antongolub/yarn-audit-fix/compare/v6.4.3...v6.4.4) (2021-09-02)


### Bug Fixes

* **deps:** update dependency npm to v7.22.0 ([41d96bb](https://github.com/antongolub/yarn-audit-fix/commit/41d96bbda8bfa7d460392ff4da50ee0873372940))

## [6.4.3](https://github.com/antongolub/yarn-audit-fix/compare/v6.4.2...v6.4.3) (2021-08-27)


### Bug Fixes

* **deps:** update dependency npm to v7.21.1 ([5bdd62a](https://github.com/antongolub/yarn-audit-fix/commit/5bdd62a1c9e9cee5bc8256fa0098b603214f7f1b))

## [6.4.2](https://github.com/antongolub/yarn-audit-fix/compare/v6.4.1...v6.4.2) (2021-08-19)


### Bug Fixes

* **deps:** update dependency npm to v7.21.0 ([17ac930](https://github.com/antongolub/yarn-audit-fix/commit/17ac9302ea76bc525fdad06fd73712cf4546fa55))

## [6.4.1](https://github.com/antongolub/yarn-audit-fix/compare/v6.4.0...v6.4.1) (2021-08-12)


### Bug Fixes

* **deps:** update dependency npm to v7.20.6 ([466d90c](https://github.com/antongolub/yarn-audit-fix/commit/466d90cf1c7f6b7711a97c4c1c1c39b7663c0b6b))

# [6.4.0](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.11...v6.4.0) (2021-08-11)


### Features

* add --ignore-engines flag ([3476e8d](https://github.com/antongolub/yarn-audit-fix/commit/3476e8d971846dc1016d788bb99e63c47fede441)), closes [#166](https://github.com/antongolub/yarn-audit-fix/issues/166)

## [6.3.11](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.10...v6.3.11) (2021-08-05)


### Bug Fixes

* **deps:** update dependency npm to v7.20.5 ([20139ae](https://github.com/antongolub/yarn-audit-fix/commit/20139aee1eea31ec0abd3069d922db6f2e141e19))

## [6.3.10](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.9...v6.3.10) (2021-08-05)


### Bug Fixes

* **deps:** update dependency npm to v7.20.4 ([fc22980](https://github.com/antongolub/yarn-audit-fix/commit/fc22980db78829ad0c4628f45462ac9a2d376b0e))

## [6.3.9](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.8...v6.3.9) (2021-08-05)


### Bug Fixes

* **deps:** update dependency npm to v7.20.3 ([51efa05](https://github.com/antongolub/yarn-audit-fix/commit/51efa052d2686025bb5f1efdc7ed658c80615d8e))

## [6.3.8](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.7...v6.3.8) (2021-07-27)


### Bug Fixes

* **deps:** update dependency npm to v7.20.2 ([0a4bbb8](https://github.com/antongolub/yarn-audit-fix/commit/0a4bbb88c398f98f9b97602b9be815994668d547))

## [6.3.7](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.6...v6.3.7) (2021-07-22)


### Bug Fixes

* **deps:** update dependency npm to v7.20.1 ([7c3d340](https://github.com/antongolub/yarn-audit-fix/commit/7c3d340c56a4e3685957e307f6232ac2e86be665))

## [6.3.6](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.5...v6.3.6) (2021-07-15)


### Bug Fixes

* **deps:** update dependency npm to v7.20.0 ([32782c6](https://github.com/antongolub/yarn-audit-fix/commit/32782c6fc7ca4cb7fd1d9e56a135fb72f3936bcb))

## [6.3.5](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.4...v6.3.5) (2021-07-01)


### Bug Fixes

* **deps:** update dependency npm to v7.19.1 ([874c4bb](https://github.com/antongolub/yarn-audit-fix/commit/874c4bb1095d5acd86735f0a87d707a28dc218d7))

## [6.3.4](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.3...v6.3.4) (2021-06-25)


### Bug Fixes

* **deps:** update dependency commander to v8 ([9089a71](https://github.com/antongolub/yarn-audit-fix/commit/9089a7122e240ad531d3eeaf8c55992eac09e718))

## [6.3.3](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.2...v6.3.3) (2021-06-24)


### Bug Fixes

* **deps:** update dependency npm to v7.19.0 ([a8d93f9](https://github.com/antongolub/yarn-audit-fix/commit/a8d93f94239eefc920a9a326dee77a2e2d490e05))

## [6.3.2](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.1...v6.3.2) (2021-06-17)


### Bug Fixes

* **deps:** update dependency npm to v7.18.1 ([ca918be](https://github.com/antongolub/yarn-audit-fix/commit/ca918be305dc01c77bbd8541aa182a2c1469e86d))

## [6.3.1](https://github.com/antongolub/yarn-audit-fix/compare/v6.3.0...v6.3.1) (2021-06-12)

# [6.3.0](https://github.com/antongolub/yarn-audit-fix/compare/v6.2.3...v6.3.0) (2021-06-12)


### Bug Fixes

* avoid ERR_UNHANDLED_REJECTION for CLI ([a397a7a](https://github.com/antongolub/yarn-audit-fix/commit/a397a7a85ee5cb0803a2c9ed5722ca146eba649e))


### Features

* handle --dry-run option in --flow=patch mode ([8fc5db6](https://github.com/antongolub/yarn-audit-fix/commit/8fc5db6e7a9ae36e12cc6fdef78985761ee10831))

## [6.2.3](https://github.com/antongolub/yarn-audit-fix/compare/v6.2.2...v6.2.3) (2021-06-10)


### Bug Fixes

* **deps:** update dependency npm to v7.17.0 ([051d19c](https://github.com/antongolub/yarn-audit-fix/commit/051d19c2f8b3d1abd19d52218627ebefd71b3688))

## [6.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v6.2.1...v6.2.2) (2021-06-07)


### Bug Fixes

* apply yarn install step to cwd not tmp ([61bd639](https://github.com/antongolub/yarn-audit-fix/commit/61bd6391c8268d92a2bc1418effeac4ddd49f9e1))

## [6.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v6.2.0...v6.2.1) (2021-06-06)


### Bug Fixes

* yarn install cmd ([2328203](https://github.com/antongolub/yarn-audit-fix/commit/23282038d0ace9db559b5ffe8a2aa163937918e6))

# [6.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v6.1.0...v6.2.0) (2021-06-06)


### Features

* `force` option for patch flow ([0bfc6bc](https://github.com/antongolub/yarn-audit-fix/commit/0bfc6bc3726a0f17df095a990b1863d2d509b201))
* **runner:** provide custom flows execution ([bf8be9c](https://github.com/antongolub/yarn-audit-fix/commit/bf8be9c97a33942569339c051975cceb2da14aa3))

# [6.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v6.0.0...v6.1.0) (2021-06-06)


### Bug Fixes

* set `patch` flow as default for getFlow helper ([517b71b](https://github.com/antongolub/yarn-audit-fix/commit/517b71b167a05c22cb2bc12a264ee98d0b155fe1))


### Features

* export all inners ([4794e2d](https://github.com/antongolub/yarn-audit-fix/commit/4794e2d165b9569427537864ff0af3d4ebdbf89d))

# [6.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v5.0.5...v6.0.0) (2021-06-06)


### Bug Fixes

* fix dry-run env flag ([4d79a4b](https://github.com/antongolub/yarn-audit-fix/commit/4d79a4b0cc774d1751cd36cb4c4270369a19175f))


### Features

* add lockfile patching flow ([b01dd0d](https://github.com/antongolub/yarn-audit-fix/commit/b01dd0d30dc7534cc56e420b3dc9843dfd2f1893))
* add npm-yarn flag mapping ([a6f942b](https://github.com/antongolub/yarn-audit-fix/commit/a6f942b935b44d349b89a89d8432f95906806179))
* set `patch` flow as default ([ed22952](https://github.com/antongolub/yarn-audit-fix/commit/ed22952b445856099725e592c443965a6d7f4edd))


### BREAKING CHANGES

* yaf uses `yarn audit json` data by default, see `--flow` option notes for details

## [5.0.5](https://github.com/antongolub/yarn-audit-fix/compare/v5.0.4...v5.0.5) (2021-06-03)


### Bug Fixes

* **deps:** update dependency npm to v7.16.0 ([5410407](https://github.com/antongolub/yarn-audit-fix/commit/54104076e67b5f17d8c8c73ea91b1944a591168a))

## [5.0.4](https://github.com/antongolub/yarn-audit-fix/compare/v5.0.3...v5.0.4) (2021-06-01)


### Bug Fixes

* **deps:** update dependency npm to v7.15.1 ([1077fdb](https://github.com/antongolub/yarn-audit-fix/commit/1077fdba50b33299096484648b91775b5202a5eb))

## [5.0.3](https://github.com/antongolub/yarn-audit-fix/compare/v5.0.2...v5.0.3) (2021-05-27)


### Bug Fixes

* **deps:** update dependency npm to v7.15.0 ([a3f32bc](https://github.com/antongolub/yarn-audit-fix/commit/a3f32bcb95bee829c90e93adb66833dfa57361d1))

## [5.0.2](https://github.com/antongolub/yarn-audit-fix/compare/v5.0.1...v5.0.2) (2021-05-25)


### Performance Improvements

* **pkg:** up deps ([6a3316e](https://github.com/antongolub/yarn-audit-fix/commit/6a3316e57626b28170ef17ea81273f14448ae6b9))

## [5.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v5.0.0...v5.0.1) (2021-05-20)


### Bug Fixes

* **deps:** update dependency npm to v7.14.0 ([0244d5f](https://github.com/antongolub/yarn-audit-fix/commit/0244d5f6eff9e482e8e1aa60f17628c0105ad404))

# [5.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.6...v5.0.0) (2021-05-16)


### chore

* catch breaking change ([#121](https://github.com/antongolub/yarn-audit-fix/issues/121)) ([f6d683c](https://github.com/antongolub/yarn-audit-fix/commit/f6d683c00805370d45f65ef6a51127d580f89d9d))


### BREAKING CHANGES

* 'junction' is default symlink type for Windows, use `--symlink` flag to override

## [4.3.6](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.5...v4.3.6) (2021-05-14)


### Bug Fixes

* handle symlink CLI option ([ef225ca](https://github.com/antongolub/yarn-audit-fix/commit/ef225ca8221e325103e38e8805dd9242daa7ed2e))

## [4.3.5](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.4...v4.3.5) (2021-05-13)


### Bug Fixes

* **deps:** update dependency npm to v7.13.0 ([f30d2be](https://github.com/antongolub/yarn-audit-fix/commit/f30d2be42e6ae1aa23918ba94ba222b500bea937))

## [4.3.4](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.3...v4.3.4) (2021-05-10)


### Bug Fixes

* **deps:** update dependency npm to v7.12.1 ([7a8a7e7](https://github.com/antongolub/yarn-audit-fix/commit/7a8a7e7886c60bf15ff3780e56f07f32cce0717e))

## [4.3.3](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.2...v4.3.3) (2021-05-08)


### Bug Fixes

* **deps:** update npm to v7.12.0 ([d8d0eb5](https://github.com/antongolub/yarn-audit-fix/commit/d8d0eb5de8a122e2a5d752088a92908791ff4da6))

## [4.3.2](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.1...v4.3.2) (2021-05-04)

## [4.3.1](https://github.com/antongolub/yarn-audit-fix/compare/v4.3.0...v4.3.1) (2021-05-03)


### Bug Fixes

* **deps:** update dependency fs-extra to v10 ([96cb87a](https://github.com/antongolub/yarn-audit-fix/commit/96cb87af17b84842a42612ee6e5765b779f2ab0e))

# [4.3.0](https://github.com/antongolub/yarn-audit-fix/compare/v4.2.4...v4.3.0) (2021-05-01)


### Bug Fixes

* **deps:** update dependency npm to v7.11.2 ([b794cb5](https://github.com/antongolub/yarn-audit-fix/commit/b794cb59d0c6e51fab5480e0949da0c3e869061b))


### Features

* provide configurable npmPath ([5e29c23](https://github.com/antongolub/yarn-audit-fix/commit/5e29c239d964ee8d652326e77d0f6ad24d517ff9)), closes [#107](https://github.com/antongolub/yarn-audit-fix/issues/107)

## [4.2.4](https://github.com/antongolub/yarn-audit-fix/compare/v4.2.3...v4.2.4) (2021-04-24)


### Bug Fixes

* **deps:** update dependency npm to v7.11.1 ([7c40684](https://github.com/antongolub/yarn-audit-fix/commit/7c406842c95d178315ebbd8280e088f9a56c2250))

## [4.2.3](https://github.com/antongolub/yarn-audit-fix/compare/v4.2.2...v4.2.3) (2021-04-23)


### Bug Fixes

* rollback to npm 7.10.0 ([a8fbdf7](https://github.com/antongolub/yarn-audit-fix/commit/a8fbdf7fcb698f3a6ca6ace831828ab43701f22e)), closes [#111](https://github.com/antongolub/yarn-audit-fix/issues/111)

## [4.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v4.2.1...v4.2.2) (2021-04-23)


### Bug Fixes

* **deps:** update dependency npm to v7.11.0 ([65cc1d5](https://github.com/antongolub/yarn-audit-fix/commit/65cc1d528c1e18a0399128bc8e0923f21745ce70))

## [4.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v4.2.0...v4.2.1) (2021-04-15)


### Bug Fixes

* **deps:** update dependency npm to v7.10.0 ([8732f1d](https://github.com/antongolub/yarn-audit-fix/commit/8732f1dff5a964a5dc509b71b7546f9e47812d9c))

# [4.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.9...v4.2.0) (2021-04-11)


### Features

* clear temp dir on error ([01e4f63](https://github.com/antongolub/yarn-audit-fix/commit/01e4f63d21699dfada667ace1ee18ce21d7bdb5e)), closes [#102](https://github.com/antongolub/yarn-audit-fix/issues/102)

## [4.1.9](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.8...v4.1.9) (2021-04-08)


### Bug Fixes

* **deps:** update dependency npm to v7.9.0 ([509ca55](https://github.com/antongolub/yarn-audit-fix/commit/509ca55d5a80016f126814cab96d7618c7bb45b9))

## [4.1.8](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.7...v4.1.8) (2021-04-08)

## [4.1.7](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.6...v4.1.7) (2021-04-01)


### Bug Fixes

* **deps:** update dependency npm to v7.8.0 ([3f1cb9c](https://github.com/antongolub/yarn-audit-fix/commit/3f1cb9c299ee748e798101e6577f1c4a365f749c))

## [4.1.6](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.5...v4.1.6) (2021-04-01)


### Bug Fixes

* fix older version detection ([81bbce8](https://github.com/antongolub/yarn-audit-fix/commit/81bbce871e652b07df829b43cbb201bd72785d6a)), closes [#96](https://github.com/antongolub/yarn-audit-fix/issues/96)


### Performance Improvements

* **deps:** up npm to v7.7.6 ([05be662](https://github.com/antongolub/yarn-audit-fix/commit/05be6628d926e1f1c8e3314a35154b8edd790bfd)), closes [#94](https://github.com/antongolub/yarn-audit-fix/issues/94)

## [4.1.5](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.4...v4.1.5) (2021-03-30)


### Bug Fixes

* **deps:** update dependency npm to v7.7.6 ([5258e82](https://github.com/antongolub/yarn-audit-fix/commit/5258e8283c7475f9e1c64581b7370a4a3914315d))

## [4.1.4](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.3...v4.1.4) (2021-03-26)


### Bug Fixes

* up npm to 7.7.5 ([596d2c9](https://github.com/antongolub/yarn-audit-fix/commit/596d2c9478ca28a419f14acbe4def3321bcad370))

## [4.1.3](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.2...v4.1.3) (2021-03-26)


### Bug Fixes

* **deps:** update dependency npm to v7.7.5 ([5495c19](https://github.com/antongolub/yarn-audit-fix/commit/5495c190f0f9eff6891c5946be4037e950cec2ea))

## [4.1.2](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.1...v4.1.2) (2021-03-25)


### Bug Fixes

* **deps:** rollback npm to 7.7.3 ([04b0f63](https://github.com/antongolub/yarn-audit-fix/commit/04b0f6323d1261feb211e3020efd3933078ce7ec))

## [4.1.1](https://github.com/antongolub/yarn-audit-fix/compare/v4.1.0...v4.1.1) (2021-03-25)


### Performance Improvements

* **deps:** up npm to v7.7.4 ([cd31155](https://github.com/antongolub/yarn-audit-fix/commit/cd311556421d1ce7b37be16c512fd38c9a990574))

# [4.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v4.0.0...v4.1.0) (2021-03-24)


### Features

* warn if yaf is out of date ([6ac2bd1](https://github.com/antongolub/yarn-audit-fix/commit/6ac2bd16f7640aa6b13e1007a7478e03d576522e)), closes [#82](https://github.com/antongolub/yarn-audit-fix/issues/82)

# [4.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v3.3.3...v4.0.0) (2021-03-24)


### Bug Fixes

* **cli:** fix env options resolution ([2adb481](https://github.com/antongolub/yarn-audit-fix/commit/2adb48172bb0b9a4175ae65d5ad76e5a9d2e2394))
* rm duplicated cli options ([481ce14](https://github.com/antongolub/yarn-audit-fix/commit/481ce1421d24a9a2f9f9827ba224af75cddc6562))


### Features

* add cli guard ([7eb3034](https://github.com/antongolub/yarn-audit-fix/commit/7eb303450e28ab1c0eb936c2c0aa88d1d54f302f))
* provide env directives ([6a61668](https://github.com/antongolub/yarn-audit-fix/commit/6a6166817cc834e5adbec160e2db42c6adf02bce))
* use npm v7 by default, introduce `npm-path` flag ([7b723d1](https://github.com/antongolub/yarn-audit-fix/commit/7b723d171d895805636ecfde4f58cdfd0e6d26a5))


### BREAKING CHANGES

* unsupported flag raises an error. See v3 to v4 migration guide in README.md
* `--npm-v7` directive is no longer supported. Follow v3 to v4 migration guide in README.md

## [3.3.3](https://github.com/antongolub/yarn-audit-fix/compare/v3.3.2...v3.3.3) (2021-03-22)


### Bug Fixes

* **deps:** up deps, fix vuls ([8fe3bbf](https://github.com/antongolub/yarn-audit-fix/commit/8fe3bbf97816e4cbb5aa1ae58712dedb1a18f0ea))

## [3.3.2](https://github.com/antongolub/yarn-audit-fix/compare/v3.3.1...v3.3.2) (2021-03-14)


### Performance Improvements

* **deps:** update npm to v7.6.3 ([cdb5bae](https://github.com/antongolub/yarn-audit-fix/commit/cdb5baed0f537ea282d7421e185754b322e038b4))

## [3.3.1](https://github.com/antongolub/yarn-audit-fix/compare/v3.3.0...v3.3.1) (2021-03-03)


### Performance Improvements

* **package:** up npm to v7.6.0 ([49e3851](https://github.com/antongolub/yarn-audit-fix/commit/49e38519a80fddbc34cb1f6616ef78241e645f1d))

# [3.3.0](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.16...v3.3.0) (2021-02-21)


### Features

* replace bash-glob with globby (do not require bash to be installed) ([c2999ee](https://github.com/antongolub/yarn-audit-fix/commit/c2999eece1795f1722ebf73a66bc39f5d50b603b))
* use separate temp dir for each exec context ([7f24b51](https://github.com/antongolub/yarn-audit-fix/commit/7f24b51833d27e87b75b08f08fd23b99b210709b)), closes [#45](https://github.com/antongolub/yarn-audit-fix/issues/45)

## [3.2.16](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.15...v3.2.16) (2021-02-13)


### Performance Improvements

* **package:** up deps ([b18bb07](https://github.com/antongolub/yarn-audit-fix/commit/b18bb07439d1571f1662ae606478ed3ecb3961e4))

## [3.2.15](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.14...v3.2.15) (2021-02-10)


### Performance Improvements

* **package:** up npm ([d12ce69](https://github.com/antongolub/yarn-audit-fix/commit/d12ce69c06760da83a6099a2c243d90b2932e955))

## [3.2.14](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.13...v3.2.14) (2021-02-06)


### Performance Improvements

* **package:** up deps, fix vuls ([dd62654](https://github.com/antongolub/yarn-audit-fix/commit/dd6265482886221dbba3dabc1369857cb474931f))

## [3.2.13](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.12...v3.2.13) (2020-12-08)


### Performance Improvements

* **package:** up deps, fix known vuls ([972d883](https://github.com/antongolub/yarn-audit-fix/commit/972d8838b34dad0856f92ec88625793b9a33ee82))

## [3.2.12](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.11...v3.2.12) (2020-10-30)


### Bug Fixes

* **package:** up deps, fix vuls ([067b03c](https://github.com/antongolub/yarn-audit-fix/commit/067b03c55b350f635f0699de4b7cac5fef08a146))

## [3.2.11](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.10...v3.2.11) (2020-10-17)


### Bug Fixes

* **package:** up deps ([7b9e6a6](https://github.com/antongolub/yarn-audit-fix/commit/7b9e6a6470b5d0362f95c95eefbcd28520b7264c))

## [3.2.10](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.9...v3.2.10) (2020-10-16)


### Bug Fixes

* **deps:** update dependency npm to v7.0.1 ([57317f2](https://github.com/antongolub/yarn-audit-fix/commit/57317f2638ae524a7a519ae83a52b2f0387af54b))

## [3.2.9](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.8...v3.2.9) (2020-10-13)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0 ([124a1ce](https://github.com/antongolub/yarn-audit-fix/commit/124a1ce54691402a7164a9ea24873c1b0876c116))

## [3.2.8](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.7...v3.2.8) (2020-10-10)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-rc.4 ([294716a](https://github.com/antongolub/yarn-audit-fix/commit/294716a0fe99087b54b77d0183b32d4646c9c543))

## [3.2.7](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.6...v3.2.7) (2020-10-07)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-rc.3 ([c23fc56](https://github.com/antongolub/yarn-audit-fix/commit/c23fc56210ef4b6a1e52c874282ffdd33306705a))

## [3.2.6](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.5...v3.2.6) (2020-10-03)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-rc.2 ([5ae4cf4](https://github.com/antongolub/yarn-audit-fix/commit/5ae4cf48b380fc658dd264a26156f872e65df680))

## [3.2.5](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.4...v3.2.5) (2020-10-02)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-rc.1 ([4a16e51](https://github.com/antongolub/yarn-audit-fix/commit/4a16e51f21ad6f906cec40f10b86386d86bc9fdf))

## [3.2.4](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.3...v3.2.4) (2020-10-01)


### Bug Fixes

* **deps:** up npm ([c0123cd](https://github.com/antongolub/yarn-audit-fix/commit/c0123cdbf16a63bce421a36864320a08ab83167c))
* **deps:** up synp to the latest ([6afdf87](https://github.com/antongolub/yarn-audit-fix/commit/6afdf87096e02ccdd49aa0a5c214c3cec7c3cb88))

## [3.2.3](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.2...v3.2.3) (2020-09-30)


### Bug Fixes

* check bash to be installed (required by bash-glob) ([#47](https://github.com/antongolub/yarn-audit-fix/issues/47)) ([278cef8](https://github.com/antongolub/yarn-audit-fix/commit/278cef808b5ebfc261df04440f28a55e7d720447))

## [3.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.1...v3.2.2) (2020-09-29)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-beta.13 ([#46](https://github.com/antongolub/yarn-audit-fix/issues/46)) ([f794c49](https://github.com/antongolub/yarn-audit-fix/commit/f794c491705a83de35e988068c55e5513c1d0234))

## [3.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v3.2.0...v3.2.1) (2020-09-27)


### Bug Fixes

* up synp, fix consistency issues ([5cc1e15](https://github.com/antongolub/yarn-audit-fix/commit/5cc1e1581d23537b0348fdfa2a387f984ad64ae8))

# [3.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v3.1.0...v3.2.0) (2020-09-26)


### Features

* provide temp dir customization ([d3eda24](https://github.com/antongolub/yarn-audit-fix/commit/d3eda242f457f2a9fff1cb9008dd53251e4fbf95)), closes [#42](https://github.com/antongolub/yarn-audit-fix/issues/42)

# [3.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v3.0.4...v3.1.0) (2020-09-26)


### Features

* handle .npmrc .yarnrc if exist ([55340c3](https://github.com/antongolub/yarn-audit-fix/commit/55340c381ee8a80c7c39938041d30b02c134c0a0)), closes [#34](https://github.com/antongolub/yarn-audit-fix/issues/34)
* handle registry flag ([71d9ba1](https://github.com/antongolub/yarn-audit-fix/commit/71d9ba1c1f46c7a61dd7dad008614ac7e2238a64)), closes [#34](https://github.com/antongolub/yarn-audit-fix/issues/34)
* let --npm-v7 flag be applied to regular repos ([2e648fd](https://github.com/antongolub/yarn-audit-fix/commit/2e648fd7005739286b718f1b3c97e1fd970f0f22))

## [3.0.4](https://github.com/antongolub/yarn-audit-fix/compare/v3.0.3...v3.0.4) (2020-09-22)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-beta.12 ([0cc556c](https://github.com/antongolub/yarn-audit-fix/commit/0cc556c145127e66cc97500a205d4324a17b0383))

## [3.0.3](https://github.com/antongolub/yarn-audit-fix/compare/v3.0.2...v3.0.3) (2020-09-17)


### Performance Improvements

* **deps:** up deps ([8653cba](https://github.com/antongolub/yarn-audit-fix/commit/8653cba6d6aec2c2b60aa5cd446207e010273ec0))

## [3.0.2](https://github.com/antongolub/yarn-audit-fix/compare/v3.0.1...v3.0.2) (2020-09-16)


### Bug Fixes

* **deps:** update dependency npm to v7.0.0-beta.11 ([761b3f1](https://github.com/antongolub/yarn-audit-fix/commit/761b3f122be7897170842fd27b7224d6154b3d35))

## [3.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v3.0.0...v3.0.1) (2020-09-12)


### Bug Fixes

* fix npm finder ([32b7778](https://github.com/antongolub/yarn-audit-fix/commit/32b77782237430c1d36a1d4c6fd552626690304e))

# [3.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v2.3.0...v3.0.0) (2020-09-12)


### Bug Fixes

* fix npm resolving when launched through npx ([e1339e2](https://github.com/antongolub/yarn-audit-fix/commit/e1339e2eee157dbe3765fc5ad68b960316dc91a4)), closes [#32](https://github.com/antongolub/yarn-audit-fix/issues/32)


### Features

* print runtime digest ([631897e](https://github.com/antongolub/yarn-audit-fix/commit/631897e92fff8bca3dfece15a768d13e2648e1f4))


### BREAKING CHANGES

* --inherit-npm flag was replaced with --npm-v7

# [2.3.0](https://github.com/antongolub/yarn-audit-fix/compare/v2.2.4...v2.3.0) (2020-09-12)


### Features

* add debug point ([53b335b](https://github.com/antongolub/yarn-audit-fix/commit/53b335b8d9f97fc6a900d249daa290d4a35c07e8))

## [2.2.4](https://github.com/antongolub/yarn-audit-fix/compare/v2.2.3...v2.2.4) (2020-09-08)


### Performance Improvements

* **deps:** up npm to 7.0.0-beta.10 ([84ff0a8](https://github.com/antongolub/yarn-audit-fix/commit/84ff0a8fd568fba85a1336c436a1efa1eab57b8f))

## [2.2.3](https://github.com/antongolub/yarn-audit-fix/compare/v2.2.2...v2.2.3) (2020-09-04)


### Performance Improvements

* **package:** up deps ([f53d564](https://github.com/antongolub/yarn-audit-fix/commit/f53d564e1983ff7e373f5ddbd89ac36d692c7c50))

## [2.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v2.2.1...v2.2.2) (2020-09-02)


### Performance Improvements

* **package:** up npm ([da01817](https://github.com/antongolub/yarn-audit-fix/commit/da01817dfbbd3660c0763f0f43b0a9a15b683857))

## [2.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v2.2.0...v2.2.1) (2020-09-01)


### Bug Fixes

* **package:** up deps ([c3dfa88](https://github.com/antongolub/yarn-audit-fix/commit/c3dfa881c2497993de59ba204bd66619bbcac37d)), closes [#22](https://github.com/antongolub/yarn-audit-fix/issues/22)

# [2.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v2.1.1...v2.2.0) (2020-08-27)


### Features

* enable package-lock-only by default ([d927735](https://github.com/antongolub/yarn-audit-fix/commit/d927735d40fb4d40cc3a8d11f151fb0cc6ba6435)), closes [#23](https://github.com/antongolub/yarn-audit-fix/issues/23)

## [2.1.1](https://github.com/antongolub/yarn-audit-fix/compare/v2.1.0...v2.1.1) (2020-08-25)


### Performance Improvements

* **package:** up deps ([8da9fec](https://github.com/antongolub/yarn-audit-fix/commit/8da9fec1bd8ec0003776c0de1618f782447528bb))

# [2.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v2.0.5...v2.1.0) (2020-08-22)


### Features

* introduce --inherit-npm flag ([b54ded4](https://github.com/antongolub/yarn-audit-fix/commit/b54ded4a1d5f5225676a0f7b9faf81f3bbad6e08))

## [2.0.5](https://github.com/antongolub/yarn-audit-fix/compare/v2.0.4...v2.0.5) (2020-08-22)


### Performance Improvements

* rm npm bins before semrel start, tech release ([3ce0106](https://github.com/antongolub/yarn-audit-fix/commit/3ce0106600b3f2626c0c1f832ce30e3ef753d146))

## [2.0.4](https://github.com/antongolub/yarn-audit-fix/compare/v2.0.3...v2.0.4) (2020-08-22)


### Bug Fixes

* fix workspaces detection ([f766f5d](https://github.com/antongolub/yarn-audit-fix/commit/f766f5dee18e436d9d628b55189f109e467f2fa9))

## [2.0.3](https://github.com/antongolub/yarn-audit-fix/compare/v2.0.2...v2.0.3) (2020-08-22)


### Performance Improvements

* add manifest to cxt ([b8761e7](https://github.com/antongolub/yarn-audit-fix/commit/b8761e7c6c11490a09c6a31fbc96c104aaced109))

## [2.0.1](https://github.com/antongolub/yarn-audit-fix/compare/v2.0.0...v2.0.1) (2020-08-22)


### Performance Improvements

* tech release ([9cbdbe8](https://github.com/antongolub/yarn-audit-fix/commit/9cbdbe898fc94c0c2134b2576f32bd97a1a1cdef))

# [2.0.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.6.1...v2.0.0) (2020-08-22)


### Bug Fixes

* adapt yarn cmd invocation to win runtime ([d02d69f](https://github.com/antongolub/yarn-audit-fix/commit/d02d69f74cbaf5e12af6e1263df2d68af4f1e0b5))
* fix checksums ([d2a280d](https://github.com/antongolub/yarn-audit-fix/commit/d2a280d4036c81fd5bd89f15475a3700d397d9b5))


### Features

* **cli:** let --package-lock-only be configurable ([c457a18](https://github.com/antongolub/yarn-audit-fix/commit/c457a1859f3cf12d17eba169319d0e1250269b09))
* provide workspaces deps update ([a64fc95](https://github.com/antongolub/yarn-audit-fix/commit/a64fc95496998607cc8c50b5de73e4326c457c4e)), closes [#16](https://github.com/antongolub/yarn-audit-fix/issues/16)
* support custom workspace paths ([96bde5d](https://github.com/antongolub/yarn-audit-fix/commit/96bde5d7ad237bc9bc56c7820d9a1529fded6e02))


### Performance Improvements

* deps revision ([c35b253](https://github.com/antongolub/yarn-audit-fix/commit/c35b253b08a9e2592e0cf963a13b5bd32b1c4b67))
* tweak up npm audit invoker ([197ca96](https://github.com/antongolub/yarn-audit-fix/commit/197ca96f91a1c8d93e55afa3e9b6a957c72e51fe))


### BREAKING CHANGES

* --package-lock-only is disabled by default

## [1.6.1](https://github.com/antongolub/yarn-audit-fix/compare/v1.6.0...v1.6.1) (2020-08-17)


### Performance Improvements

* **package:** tech release ([1243032](https://github.com/antongolub/yarn-audit-fix/commit/12430323b881c2067b249e19cc2a55b9247376bc))

# [1.6.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.5.1...v1.6.0) (2020-08-10)


### Bug Fixes

* discard flags after -- break ([4ee89e0](https://github.com/antongolub/yarn-audit-fix/commit/4ee89e03d59bd928e577859302689339ba666687))
* **cli:** handle `silent` flag at the top level promise ([08534ed](https://github.com/antongolub/yarn-audit-fix/commit/08534ed93091ea795d9d015c6eeb34224d4c7d89))


### Features

* **cli:** add symlink type customization ([bfb2747](https://github.com/antongolub/yarn-audit-fix/commit/bfb2747dbde5f1bceb6e9c9cbd3d915cb4a84dc6)), closes [#13](https://github.com/antongolub/yarn-audit-fix/issues/13)
* **cli:** pass optional flags to npm/yarn invocations ([cd2efab](https://github.com/antongolub/yarn-audit-fix/commit/cd2efab225261d07e4f193c29bd8cf6db91f9e32)), closes [#12](https://github.com/antongolub/yarn-audit-fix/issues/12)
* **cli:** provide `silent` flag support ([2a646bc](https://github.com/antongolub/yarn-audit-fix/commit/2a646bca6ef6b4918f3a3c56e94b2e98a9e9af46))

## [1.5.1](https://github.com/antongolub/yarn-audit-fix/compare/v1.5.0...v1.5.1) (2020-08-07)


### Bug Fixes

* **readme:** update usage example ([8d25680](https://github.com/antongolub/yarn-audit-fix/commit/8d256800d3542ee0d9ff60d1d72be6232bb7a2fc))
* print invoke cmd before its output ([dfe82fb](https://github.com/antongolub/yarn-audit-fix/commit/dfe82fb4de711dcddc0feb497c7ade66d4ef717d))

# [1.5.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.4.1...v1.5.0) (2020-08-07)


### Features

* highlight steps in the output for better readability ([7abff28](https://github.com/antongolub/yarn-audit-fix/commit/7abff2850a3cfe8ffaa99fd97bec3b2f8c45a3af))

## [1.4.1](https://github.com/antongolub/yarn-audit-fix/compare/v1.4.0...v1.4.1) (2020-08-06)


### Bug Fixes

* exit with non-zero if anything fails ([#11](https://github.com/antongolub/yarn-audit-fix/issues/11)) ([3e7eb93](https://github.com/antongolub/yarn-audit-fix/commit/3e7eb931816c18eaa781565a25624599aef94f69)), closes [#10](https://github.com/antongolub/yarn-audit-fix/issues/10)

# [1.4.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.3.0...v1.4.0) (2020-08-03)


### Features

* add async handlers support ([71eab4e](https://github.com/antongolub/yarn-audit-fix/commit/71eab4e8ac2c3bcedc985244f1845dedd967ca2a))
* perform most operations on temporary entities ([213b4f5](https://github.com/antongolub/yarn-audit-fix/commit/213b4f5086b9a3572994ce5f311acf7d6b09d84e)), closes [#6](https://github.com/antongolub/yarn-audit-fix/issues/6)

# [1.3.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.2.2...v1.3.0) (2020-07-13)


### Features

* print invocation details to stdout ([f92b18a](https://github.com/antongolub/yarn-audit-fix/commit/f92b18a70498ad3aa03ba853260e84de675920a2))

## [1.2.2](https://github.com/antongolub/yarn-audit-fix/compare/v1.2.1...v1.2.2) (2020-07-10)


### Bug Fixes

* fix worlspaces issue ([221f17b](https://github.com/antongolub/yarn-audit-fix/commit/221f17b8f922c46efb0012c3acb8969dda15b711)), closes [#2](https://github.com/antongolub/yarn-audit-fix/issues/2) [#3](https://github.com/antongolub/yarn-audit-fix/issues/3)

## [1.2.1](https://github.com/antongolub/yarn-audit-fix/compare/v1.2.0...v1.2.1) (2020-07-09)


### Bug Fixes

* raplace yarm import to synp converter to handle workspaces issue ([c921179](https://github.com/antongolub/yarn-audit-fix/commit/c9211797bb3ab7fc346fff99e0215026f503664d))

# [1.2.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.1.1...v1.2.0) (2020-07-09)


### Features

* use yarn import for package-lock converting ([e9fccd8](https://github.com/antongolub/yarn-audit-fix/commit/e9fccd8798be6c2570c46ddc086c23bc1e69f854))

## [1.1.1](https://github.com/antongolub/yarn-audit-fix/compare/v1.1.0...v1.1.1) (2020-07-09)


### Bug Fixes

* fix synp source arg, apply audit fix to lockfile only ([#1](https://github.com/antongolub/yarn-audit-fix/issues/1)) ([c2bd0fc](https://github.com/antongolub/yarn-audit-fix/commit/c2bd0fce3a61a0c3c46d1601b7aa75120760cbd4))

# [1.1.0](https://github.com/antongolub/yarn-audit-fix/compare/v1.0.0...v1.1.0) (2020-07-08)


### Features

* replace npm i with synp convertion ([7272a9c](https://github.com/antongolub/yarn-audit-fix/commit/7272a9ce6f241e37fa23955806ca3b7dc041b498))

# 1.0.0 (2020-07-08)


### Bug Fixes

* fix rimraf bin path ([69df2aa](https://github.com/antongolub/yarn-audit-fix/commit/69df2aa7cf66d73de6f4e63937a52ec87453e39d))


### Features

* add audit fix cmd queue ([7fc519d](https://github.com/antongolub/yarn-audit-fix/commit/7fc519d4b4925cf6e3760837b0c051d02c85212e))
* replace rm with rimraf ([67d9d16](https://github.com/antongolub/yarn-audit-fix/commit/67d9d16466360afcf1a246b17433fc8740e745bc))
