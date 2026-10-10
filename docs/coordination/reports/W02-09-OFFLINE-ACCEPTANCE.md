# W02-09 Codex owner offline acceptance

Integration-owner decision: **ACCEPTED for offline source/pins/API/plain-text fixture preparation only**, exact candidate `8d2cd17584f85fd87e010d1592dc13dc7e8aa27a`. The integration owner directly confirmed this decision after personally reading the full separate actual Hermes review2 report, closed process evidence and new candidate parent stdout/result. Cold-start performance remains unresolved; all legal/security/browser limits remain, and **no deployment gate advances**. No substantive blocker to that narrow preparation scope was found by this support audit. This report records the owner decision and Codex support findings; it is not a separate actual Hermes review, performance resolution or product acceptance. The integration owner merged the exact source allowlist alongside this decision; a separate byte check verified all30 integrated files against their accepted Git objects without another canonical run. The result is retained at .task-inputs/ai-elements-post-integration/result.json.

## Exact candidate and separate review

Initial source base `8e65b9603b1c9356b7f8b750f7dd25f424a634c8`; initial Codex owner candidate `636bf8749cde1a5e70ddc87990a8f9e2cf7e1ab5`; thin owner harness repair `8d2cd17584f85fd87e010d1592dc13dc7e8aa27a`. The implementation Hermes session `20261009_201126_24c214` returned a closed partial with no commit; Codex completed the source and harness, with attribution retained in the adoption report.

The separate actual Hermes review is report-only commit `84d28013dca5d81a63f07e680bd49a6c1b58f6be`, whose parent is exactly the candidate and whose sole added path is `docs/coordination/reports/W02-09-AI-ELEMENTS-REVIEW-2.md`. Root process evidence binds session `20261009_213211_6db5bf`, candidate/base, review branch/worktree and returned commit. It closed `2026-10-10T01:37:09.236340+00:00`, exit0, zero remaining processes, tree empty/readers finished/cleanupConfirmed true, no capture or cleanup errors. Exit0 is lifecycle evidence, not source acceptance.

Both candidate and reviewer checkouts were clean during this audit. All30 candidate paths matched their exact Git object bytes and the corresponding review checkout bytes. Initial-base-to-candidate scope is exactly29 package additions plus the adoption report; no existing UI/root lock, contract or infrastructure changes. The harness follow-up changes exactly qualification.test.mjs, its one artifact entry in component-pins.json, and the adoption report. The two misplaced root license files are absent. Root contains other owners' active changes; this support writer writes only this new report and makes no commit.

## Independently reproduced offline facts

This audit used read-only source inspection and pure local byte/JSON/hash comparisons. It did not rerun a canonical check, launch Hermes, install dependencies, fetch provenance or execute browser/Office/cloud/provider/network paths.

- All28 non-self artifact lengths/SHA256 values match actual bytes. All17 vendor local/source lengths and hashes match, with16 byte-exact upstream identities. Removing exactly the owner header and conditional-spread adaptation from dropdown-menu.tsx restores8432 bytes, SHA256 `9384b044d08c59be883888a3dd66c3816156316f8debbcf107ef90b1e383d022`, Git blob `7e65814fad700640bc6d447ebfb3a497d0e85a0f`; imports/exports remain identical. The local adaptation is8620 bytes/SHA256 `d2d68bf1f4540baf814fcb20bfd487bfbba1fdfbcc533ef99e0ef862dfbf25a2`.
- Pin identity is retained official tag `ai-elements@1.9.0`, annotated object `e4289305573b338dfcfb0836b8e97a5699cb34a6`, resolved commit `bc871264341cf54a7ea1fee36d951688ed2a1ff7`. The tag is unsigned. Local object/hash consistency and retained owner metadata are not this audit's independent network or signature verification.
- Read-only import-graph inspection reaches all17 source files, with exactly three type-only `ai` imports. All external imports have declared dependencies; the actual fixtures preserve upstream exports and dormant helpers. API compatibility has retained actual strict-compile evidence against ai7.0.137, React/ReactDOM/types19.3.0, zod4.6.5 and TypeScript5.9.3. ESNext/Bundler and all strict flags, including exactOptionalPropertyTypes, remain enabled; initial skipLibCheck stays true and limits dependency-declaration coverage.
- All20 direct versions are exact and match lock and installed manifests. All367 locked entries have retained registry URLs/SHA512 integrity, no link/install-script flag, and matching installed versions. No first-hit pnpm extraction is relied upon. Registry tarballs were not freshly downloaded in this audit; installed files/metadata remain owner-supplied retained bytes.
- All367 license inventory manifests/root notice files match recorded raw bytes/hashes and normalized retained texts;121 distinct normalized notice hashes reproduce. The552-byte AI Elements file is an attribution/header, not the full license. The notices retain11358 bytes of complete Apache2 terms, SHA256 `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`; shadcn MIT attribution is1063 bytes/SHA256 `1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f`, pinned source `2d3f1cd436b18ea12f24130de4df781355925b08`.
- Seven explicit notice gaps remain: no root license/notice text for @ai-sdk/provider-utils, fastdom, react-remove-scroll-bar, rehype-katex, remark-math and strictdom; khroma lacks declared license metadata but retains its actual MIT text. This is no blanket legal/security clearance or complete nested/bundle/font/asset audit. Preserve the three intentional upstream trailing-space lines1492,3033,4963 in THIRD-PARTY-NOTICES.md; this audit confirmed exactly those exceptions and changed none.

The real typed fixture renders Conversation/ConversationContent and Message/MessageContent with plain React text. PromptInput, including its hidden file input, sits within a disabled fieldset, disabled/read-only textarea and disabled submit; maxFiles0, globalDrop false, syncHiddenInput false, callback only preventDefault. No model transport or durable command is connected. Retained screenshot/speech/fetch/download/Markdown/plugin exports are dormant and unqualified; their eager dependency closure remains. Unprocessed CSS records Tailwind4/Streamdown/theme/font inputs, not a completed styling build.

## Thin harness repair and bounded-check evidence

The full denial guard block and original10 test bodies are byte-unchanged. Only the test artifact length/hash changed in pins; every other pin value is unchanged. The first-outcome cache retains success or the same first thrown error, including malformed stdout JSON, so later tests do not silently launch another child after failure. Spawn error/nonzero/signal/JSON parse failures stay failures. Added pure fixtures cover cache identity/one invocation and hostile/unknown/malformed diagnostic fields.

Child diagnostics emit fixed phase names and numeric elapsed/load counts, capped at64 lines/8192 output bytes. The reader first slices8192 JavaScript string code units (the review's phrase “slices8192 bytes” is imprecise), then reserializes only exact allowlisted keys/integers/phases under its64-line/8192-output-byte bound. Raw stderr/error objects, user HTML and module paths are discarded. The parent's existing512KiB capture bound also remains. This distinction does not invalidate the intended payload-redaction/output bound.

The child20s timer, parent25s timeout,512KiB maxBuffer, sanitized environment and fetch/WebSocket/EventSource/net/TLS/HTTP/server/subprocess/dlopen/Wasm deny paths are unchanged. These in-process guards are not an OS sandbox, a complete network isolation proof or qualification of every dormant path. Static imports/setup precede the20s timer and synchronous loading can delay its callback. The25s outer timeout remains the hard child bound; the cache/diagnostics are not a performance repair.

Retained exact checks of the changed candidate, with no additional invocation by this audit:

| Executor / evidence | Result | Measured timing and limits |
| --- | --- | --- |
| Separate actual Hermes review2, one canonical check in the byte-compared installed sibling | Strict typecheck PASS;12 pass/0 fail/skip; exit0 | Node test runner20838.945ms; SSR test18958.5609ms; hostile-text test0.3635ms reuses cache. Wall time not separately proven. |
| Integration owner, `.task-inputs/ai-parent-check-8d2cd17/` request/result/stdout/stderr | One canonical check; strict PASS;12 pass/0 fail/skip; exit0 | Whole command5.516s; test runner2601.5931ms; SSR1873.7242ms; stderr0 bytes; coldCacheGuaranteed false. |

Review2's canonical-check.log matches the committed counts/timings. Root scrubbed process/stdout corroborates the review identity, single-check account and refusal to rerun after later generic verification nudges; the raw log was retained. The reader should not derive an exact1.04s child-timer margin from the18.958s whole-test duration: the clocks start at different points and no successful per-phase trace is retained. It still shows materially variable import/SSR elapsed time. Neither pass guarantees a cold cache or reproducible performance.

## Failure history and unresolved work

At636bf874, the parent's canonical check passed strict typecheck but had8PASS/2SSR FAIL, ETIMEDOUT at25063.9608ms and25177.7817ms, total57218.3743ms. The Markdown record is a concise transcription, not the full stdout archive. Actual reviewer1 session20261009_205725_e01466 reached40 turns, closed cleanly with no report/commit, and reported an initial cold canonical timeout followed by diagnostics/warm reruns. Its environmental-cause claim was unproven; its suggested larger bound was not adopted. The later one authorized instrumented diagnostic passed at10081.6056ms and observed2334 modules/import-heavy cost; it does not identify the prior failure's cause. Original failures remain retained and are not erased by the later passes.

The adoption report/pins intentionally remain immutable historical candidate evidence. Its pending-review/latest-failure language describes the state at8d2cd175, before completed review2 and the owner's new check. This owner acceptance record supplements that history, without rewriting it or claiming cold-start resolution. Root15/existing UI19/typecheck are unchanged and were not rerun here; earlier results remain historical.

Browser/DOM/hydration/responsive/visual/a11y/E2E, compiled CSS/themes/KaTeX fonts, bundle size, Markdown/plugin/helper safety, real UI transport/product controls, model/provider calls, full release security/license audit, OS sandbox/live policy/durability/Fargate and G1 remain NOT RUN or unaccepted. Current Meri and deployment placement are unchanged. No deployment, cutover, security waiver or performance guarantee follows from offline preparation acceptance.

Integration contains the exact source allowlist below and this owner decision; the separate actual review report is preserved unchanged at31acba1. Parent byte comparison confirms all30 source files match candidate8d2cd175 exactly; no dependency installation or extra canonical execution was needed. Keep G1 and product/release gates open and retain cold-timeout/notice/build limitations. A later consuming build or performance change needs its own bounded review and evidence; no widening, retry-until-green or source/export pruning is authorized by this offline acceptance.

## Exact30-file source allowlist and actual bytes

Paths are repository-relative. Every row was compared with exact candidate Git bytes and the review checkout; all28 declared artifact assertions were also recomputed. This table adds the self-excluded pins and handoff report hashes.

| Path | Bytes | SHA256 |
| --- | ---: | --- |
| apps/ui/elements-qualification/.gitignore | 89 | 1af48596dedcd2ffe9ecd79887925b49706bcc1b7db615c1ae0187f76ddc1a53 |
| apps/ui/elements-qualification/LICENSE-AI-ELEMENTS | 552 | b4f9adb7c568904834d0dd6cc98d16c390d21ca32fc17ae7a267715269bd5529 |
| apps/ui/elements-qualification/LICENSE-SHADCN | 1063 | 1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f |
| apps/ui/elements-qualification/README.md | 4429 | 9c62f288c34a47da6670e2c6bab969a5d9487e00795ca441107371ea990325bb |
| apps/ui/elements-qualification/THIRD-PARTY-NOTICES.md | 293686 | 426839e3d05bd6959adeff7cc7081c8e1e8aee6a4dda7668ec9ede77361ad0c1 |
| apps/ui/elements-qualification/component-pins.json | 241775 | 935f00ddbbb8fde72d9a0288b6f833f87dbb08245d95aaca9f02a18c4c28fd8b |
| apps/ui/elements-qualification/fixture.tsx | 1964 | 31aef5ebb83fc176cb9d1d582eb36a442d7e509d792e18cb377fe6bf9be2fdf5 |
| apps/ui/elements-qualification/package-lock.json | 210293 | 104a48c4c68bcb5a3c3bb1f2d5000225a10dcf571c483a2d0dd4bb65ad5b5713 |
| apps/ui/elements-qualification/package.json | 1168 | 0a105271c69413aef05b2d1ca78a40b8245c884959bce9aefe47e8a5a5815508 |
| apps/ui/elements-qualification/qualification.test.mjs | 22889 | b03757c004a76bc33761aaab9efc7e2c664022fd760b7cf3d339011a6f778c07 |
| apps/ui/elements-qualification/styles.css | 929 | ba917a42781a462a81809ad94b8321138290b94215c36c5951c87b869fba4f72 |
| apps/ui/elements-qualification/tsconfig.json | 686 | 1332f1cac4262d745381d1a0d2f8e56ae44cd688b97952eb3070956f6ecfb907 |
| apps/ui/elements-qualification/vendor/ai-elements/conversation.tsx | 4441 | d7ac46f1e7bc8e46bc49f67c768fc93aebdf17d816397cb35a40deff7173e875 |
| apps/ui/elements-qualification/vendor/ai-elements/message.tsx | 8610 | 19c7755740e116f221e4247f7b6d4f20b57a44e4c4fcf66d2db5e1f111476509 |
| apps/ui/elements-qualification/vendor/ai-elements/prompt-input.tsx | 39046 | cf43baf5baa444b4ae06d250643b3fb2efd329c85f9b31a43e3aaf481dd27305 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/button-group.tsx | 2256 | 1b0147f3d6ee8770524363f9bc9a57db83de8d2a0733c6e635e51034219e4c1e |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/button.tsx | 2175 | 208d8cf515ccd73c1ca0030a11de1ba460a9fcd6c83faafeadc000833790d22e |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/command.tsx | 4846 | 53be7fe88f0ddbb2f6d97c64c07c1b4816050494880a582c92c0c3c62117b03c |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/dialog.tsx | 3991 | c7d128632214c9c78706a91a0616659ecf3be5119492b2ca66607bd83901b802 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/dropdown-menu.tsx | 8620 | d2d68bf1f4540baf814fcb20bfd487bfbba1fdfbcc533ef99e0ef862dfbf25a2 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/hover-card.tsx | 1540 | cf19544ba82d332ce2f882f9ae64d9e848c475f13e79fa0353492f2ce7afe1ef |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/input-group.tsx | 5129 | d347e89600f0750a438f31559c85bb91833eeef51a56e70c2af5ef5d8d2acdd2 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/input.tsx | 976 | 96207e020d2624fba7241b91a1f2e5a971510003b9c0becc9d0c02a535b15067 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/select.tsx | 6304 | a0eefd67e05688a6318a3a86080a6951723c6b5d323e1fa92b9d1b7fee777995 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/separator.tsx | 708 | 47885bfbdf6468a740999cf934b5cb563ecddb709502c2c501cea524f78d5ce3 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/spinner.tsx | 345 | acf4f2aeb7fc29bd8aa22a6501b85dd4462d196e831dc5424be93ffdb49e21b4 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/textarea.tsx | 773 | 0b7fc00f5a0fa6ace377c5f61ef14a30b3d190bc2761c2728ec6886809a1a0c8 |
| apps/ui/elements-qualification/vendor/shadcn-ui/components/ui/tooltip.tsx | 1901 | f459111a16d346aaa64d1bb6557cca986f7332b150ad3a29001e8fef3aea973a |
| apps/ui/elements-qualification/vendor/shadcn-ui/lib/utils.ts | 166 | 7c8c3dfc0cdd370d44932828eb067ef771c8fe7996693221d5d4b90af6d54f2d |
| docs/coordination/reports/W02-09-AI-ELEMENTS-ADOPTION.md | 12453 | fc283e277124fb50754b678e8fc0bd04406f5450ab6511dc356089e94f0beee8 |

## Retained evidence identities

These are byte identities of the inspected local evidence, not a fresh provenance signature or deployment approval.

| Evidence | Bytes | SHA256 |
| --- | ---: | --- |
| Separate Hermes review2 report | 16463 | 2f8d917b37989fe7c3dfa3884a2ca3ef975b8ce35f3ff8e0a54dff29fb7afc98 |
| Review2 process.json | 984 | 29518210c10d250030c130ea81eebbb0ebd913a5a473fa5d46dbed207bb5ac40 |
| Review2 retained canonical-check.log | 1556 | 13f9df9281bd2db41a584d8a9ef64b9f6e7c08fa5d335a870352ee6bbc53b5ce |
| Owner8d2cd175 stdout.txt | 1552 | 3cff7f0ec42688bcd4629f56097d741b7cf4e43620d53ed387352781fa4e4647 |
| Owner8d2cd175 result.json | 300 | cb39327b36689f9f36986797563ae1c6536125f1d8a22d3e7ff73d5e73792789 |

Codex support writer CLOSED after this report. No new canonical check, launch, install, network/cloud action, commit or other file edit was performed by that support audit. The integration owner subsequently inspected the full report and exact merged bytes and records the narrow offline acceptance above.
