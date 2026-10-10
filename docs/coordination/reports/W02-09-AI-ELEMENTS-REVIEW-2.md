# W02-09 AI Elements — independent Hermes review 2 (REPORT-ONLY)

Reviewer: independent actual Hermes review session `20261009_213211_6db5bf`
Worktree: `C:/dev/main/meri-greenfield-worktrees/w02-ai-elements-review-2`
Branch: `review/w02-ai-elements-2`
Reviewed HEAD/base: `8d2cd17584f85fd87e010d1592dc13dc7e8aa27a`
Initial source adoption base: `8e65b9603b1c9356b7f8b750f7dd25f424a634c8`
Initial owner source candidate: `636bf8749cde1a5e70ddc87990a8f9e2cf7e1ab5`

Disposition: REPORT-ONLY. No acceptance, no gate promotion, no repair. Codex owns acceptance, contracts,
dependencies and deployments. A passing local canonical check is not acceptance and not a deployment gate.

## 1. Authority, scope and method

Bounded review of an UNACCEPTED source candidate. Only writable tracked path is this report. Scratch was
ignored `.task-inputs/` in this worktree only. No dependency install, no network/provenance fetch, no
AWS/cloud/provider call, no browser/DOM/server/socket/native-addon/Wasm execution, no other agent/session,
no push, no deployment. The sole execution performed was the ONE canonical check reached through the
existing bounded Node SSR child (Section 5). No standalone SSR child or alternate render was invoked.

Attribution (honest): the initial scaffolding was a closed Hermes partial (session `20261009_201126_24c214`,
40 turns, exit0, no commit, result remained base `8e65b96`). The finished source candidate is a Codex owner
completion (`636bf874`). The harness repair (`8d2cd175`) is Codex owner work. This review did not author,
repair or accept any of it.

## 2. HEAD/branch, tree state and exact source scope

- HEAD `8d2cd175...`, branch `review/w02-ai-elements-2`; worktree clean at start (only this new report untracked).
- `git diff --name-status 8e65b96..HEAD` = exactly 30 added files (29 package files + the adoption report);
  no root/existing UI/shared-contract change.
- `git diff --name-status 636bf874..HEAD` = exactly three paths: `qualification.test.mjs`,
  `component-pins.json`, `docs/coordination/reports/W02-09-AI-ELEMENTS-ADOPTION.md`. Nothing else.
- The two originally misplaced root license files are ABSENT at the worktree root (`ls LICENSE*` -> no such
  file). Root contains only `AGENTS.md`, `README.md` and the expected repo tree.
- Package inventory: 29 files = 12 top-level (`.gitignore`, both LICENSE files, `README.md`,
  `THIRD-PARTY-NOTICES.md`, `component-pins.json`, `fixture.tsx`, `package-lock.json`, `package.json`,
  `qualification.test.mjs`, `styles.css`, `tsconfig.json`) + 3 `vendor/ai-elements/*.tsx` + 13
  `vendor/shadcn-ui/components/ui/*.tsx` + 1 `vendor/shadcn-ui/lib/utils.ts` = 17 vendor sources.

## 3. Independently recomputed byte/hash evidence

Recomputed with coreutils `sha256sum`/`stat` against the actual candidate bytes (not trusted from pins):

- All 28 declared `artifacts` entries: byte length AND SHA256 match (28/28).
- All 17 `sources` entries: `localBytes` and `localSha256` match (17/17).
- `THIRD-PARTY-NOTICES.md` SHA256 matches `pins.noticesSha256`
  `426839e3d05bd6959adeff7cc7081c8e1e8aee6a4dda7668ec9ede77361ad0c1`.
- `package-lock.json` SHA256 matches `pins.packageLockSha256`
  `104a48c4c68bcb5a3c3bb1f2d5000225a10dcf571c483a2d0dd4bb65ad5b5713`; lock `lockfileVersion` 3; 367
  `packages` entries (excluding root).
- Lock inventory: every entry `resolved` is `https://registry.npmjs.org/...`, every `integrity` is
  `sha512-...`, no `link:true`, no `hasInstallScript:true`. Installed manifests in the byte-identical
  sibling match lock versions for all 367 entries (read-only inspection).

Provenance limitation (stated plainly): the `sha512-...` integrities are RETAINED OWNER-SUPPLIED bytes
recorded in the nested lock. This review did NOT fetch npm/GitHub and therefore does NOT independently
re-verify those registry integrities against a fresh registry download. Lock integrity equality is not a
new independent registry provenance verification.

## 4. Source, pin identity and the single adaptation

Pin identity reproduced from retained candidate facts (no new provenance fetch authorized or needed):

- tag `ai-elements@1.9.0`; annotated tag object `e4289305573b338dfcfb0836b8e97a5699cb34a6`;
  resolved commit `bc871264341cf54a7ea1fee36d951688ed2a1ff7`; `tagSignatureVerified: false`.
  The tag is UNSIGNED — byte/object identity is NOT a signature verification. Caveat preserved.
- 17 sources, exactly 1 adaptation, 16 byte-exact to upstream. The only `localSha256 != upstreamSha256`
  entry is `vendor/shadcn-ui/components/ui/dropdown-menu.tsx`.
- Inverse adaptation reproduced exactly: the file contains the owner notice once and
  `{...(checked === undefined ? {} : { checked })}` once; removing the owner header and restoring
  `checked={checked}` yields 8432 bytes, SHA256
  `9384b044d08c59be883888a3dd66c3816156316f8debbcf107ef90b1e383d022`, Git blob
  `7e65814fad700640bc6d447ebfb3a497d0e85a0f` — exactly the declared upstream bytes/hash/blob. Import and
  export lines are identical between adapted and restored text (imports/exports preserved). The adaptation
  is a strict-`exactOptionalPropertyTypes` conditional spread, not a behavior change.
- Import graph: all external specifiers in the 17 files resolve to declared dependencies
  (`react`, `radix-ui`, `lucide-react`, `class-variance-authority`, `use-stick-to-bottom`,
  `tailwind-merge`, `streamdown`, `@streamdown/{cjk,code,math,mermaid}`, `nanoid`, `cmdk`, `clsx`) plus
  internal `@repo/shadcn-ui/*` aliases resolved via tsconfig `paths`. All three `ai` imports are
  `import type` (type-only). Dormant upstream exports (`MessageResponse`, `messagesToMarkdown`,
  `ConversationDownload`, `PromptInputActionAddScreenshot`, ...) are retained, not trimmed.
- tsconfig strictness retained: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`,
  `forceConsistentCasingInFileNames`, `noEmit`; `module` ESNext / `moduleResolution` Bundler.
  `skipLibCheck: true` is retained (dependency declarations are not fully checked) — disclosed, not relaxed
  or tightened by this review.

Fixture: renders the real `Conversation`/`ConversationContent`, `Message`/`MessageContent` and a synthetic
`PromptInput` wholly inside `<fieldset disabled>`, with disabled+readOnly textarea, disabled submit,
`globalDrop={false}`, `syncHiddenInput={false}`, `multiple={false}`, `maxFiles={0}`, and an `onSubmit`
that only calls `event.preventDefault()`. Values are literal plain React text; no Markdown/HTML/links/
diagrams/code/screenshot/speech/download render and no model transport.

## 5. License facts

- `LICENSE-AI-ELEMENTS` = 552 bytes, SHA256
  `b4f9adb7c568904834d0dd6cc98d16c390d21ca32fc17ae7a267715269bd5529`; it does NOT contain "END OF TERMS"
  — it is an attribution/header, NOT the full Apache license.
- `THIRD-PARTY-NOTICES.md` contains the complete Apache-2.0 terms block, 11358 bytes, SHA256
  `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`, including "4. Redistribution",
  "9. Accepting Warranty" and "END OF TERMS AND CONDITIONS".
- `LICENSE-SHADCN` = 1063 bytes, SHA256 `1564074e13439397221ffd522e2e504d56561994a23d371aa5e3ad43e4f5423f`,
  MIT attribution "Copyright (c) 2023 shadcn", pinned to shadcn source commit
  `2d3f1cd436b18ea12f24130de4df781355925b08`.
- Notice inventory: 367 installed manifests/root notice texts -> 121 unique LF-normalized notice texts.
  Exactly 7 disclosed gaps: missing root license/notice text in `@ai-sdk/provider-utils`, `fastdom`,
  `react-remove-scroll-bar`, `rehype-katex`, `remark-math`, `strictdom` (6) plus missing declared
  `license` metadata in `khroma` (whose actual MIT text is retained). The 7-gap claim is confirmed exactly.

Legal limitation: this is an inventory of retained package-root texts, not a legal clearance. Embedded
assets, generated bundles, fonts and nested/deeper notices have not received a complete release audit.

## 6. Owner harness repair (`636bf874..8d2cd175`)

- `component-pins.json`: the ONLY change is the `qualification.test.mjs` artifact entry
  (bytes 18316 -> 22889; sha256 `ad29b0d0...` -> `b03757c0...`). No other pin, notice, source, lock or
  dependency value changed — no weakening.
- `qualification.test.mjs`: additions are `SSR_PHASES`, `safeSSRDiagnostics`, `onceSSROutcome`, `phase()`
  instrumentation inside the child, the replacement of the local `ssr` closure with
  `onceSSROutcome(() => ...)`, and two new pure tests. Verified unchanged by the repair: the entire child
  guard block, the `20000` ms child deadline, the `25000` ms `spawnSync` timeout, the `512*1024` maxBuffer,
  the sanitized env `{PATH,SystemRoot,NODE_ENV,TZ}`, every fetch/WebSocket/EventSource/net/TLS/HTTP/server/
  subprocess/dlopen/Wasm denial path, and the original 10 test bodies (test count 10 -> 12 with the 2 new
  harness tests prepended).
- First-outcome cache reviewed: `onceSSROutcome` runs the child at most once (`started` flag) even if
  `spawnSync` errors, the child signals/exits non-zero, or `JSON.parse` throws; the FIRST error object is
  cached and rethrown by identity; a success value is cached. Malformed stdout throws inside `run()` and is
  cached as a failure, so it cannot permit a second child. The two new pure tests exercise: cached
  error/success identity across repeated calls, malformed-JSON caching, and hostile diagnostics input.
- Diagnostics filter reviewed: `safeSSRDiagnostics` slices to 8192 bytes / 64 lines, JSON-parses each line,
  requires exact key set `{elapsedMs,loaded,ssrPhase}` (sorted-joined), a phase in the fixed allowlist,
  integer `elapsedMs` in `[0,1e9]` and integer `loaded` in `[0,1e6]`, then re-serializes only the safe
  subset. Raw user HTML, payloads, absolute module paths and unexpected fields are dropped. Spawn errors are
  reported only as a bounded `[A-Z0-9_]{1,32}` code, never as a raw error object. This review did not log raw
  stderr/error objects/user HTML.

## 7. The one canonical check — exactly once, no retry

Preconditions verified before running (no retry path used):
- Sibling `C:/dev/main/meri-greenfield-worktrees/w02-ai-elements` HEAD = `8d2cd175...`, tracked tree clean.
- `diff -r --exclude=node_modules` between the sibling package and the reviewed candidate: NO DIFF — the
  29 package files are byte-identical to the candidate and Git object bytes. The adoption report is tracked
  and clean at the same commit.
- Installed pinned dependencies present: all 20 direct deps have `installed == lock == package.json` versions;
  `typescript` tsc bin and `react-dom/server` present; 367 lock entries match installed manifests.
- This review worktree has NO `node_modules` (not installed, not copied, not symlinked).

Command executed exactly once, in the byte-identical sibling:
`npm run check --prefix apps/ui/elements-qualification`

Result:
- EXIT CODE 0.
- Strict TypeScript (`tsc -p tsconfig.json`) PASS.
- Tests: 12 pass / 0 fail / 0 skipped / 0 cancelled / 0 todo. Node runner `duration_ms 20838.945`.
- Per-test timings (exact): real SSR test `18958.5609ms`; hostile-text test `0.3635ms` (served from the
  first-outcome cache); exact-lock test `1219.7398ms`; license test `325.0071ms`; import-graph test
  `52.6785ms`; CSS test `0.7374ms`; the two harness tests `1.0921ms` / `0.3875ms`.
- Success path emitted NO stderr phase/diagnostic lines (diagnostics are failure-only). The second SSR test
  reused the cached outcome, so exactly ONE child was launched for the whole run — confirming the repair's
  single-child intent.
- After the run, both tracked trees rechecked unchanged: sibling clean; review-2 clean except this new
  report. The check read installed sibling dependencies but wrote no candidate/dependency file.

## 8. Original failure history (retained; not erased by this pass)

- Review 1 (`20261009_205725_e01466`): 40 turns, exit0, empty process tree, cleanupConfirmed, clean
  candidate `636bf874`, but NO report and NO commit. Its FIRST canonical cold check failed an SSR timeout.
  Its subsequent standalone diagnostics and warm reruns are historical observations, not approval to repeat
  them. Its "environmental cause" assertion is UNPROVEN; its "widen the deadline" suggestion was not adopted.
- Parent canonical check at `636bf874`: strict TypeScript PASS; 8 pass / 2 SSR tests FAIL with ETIMEDOUT at
  `25063.9608ms` and `25177.7817ms` (total `57218.3743ms`). The parent Markdown file is a transcription,
  not a complete stdout archive.
- One later authorized instrumented diagnostic passed at `10081.6056ms`, `2334` module URLs loaded,
  import-heavy elapsed. It cannot prove the cause of the earlier failures.
- A warm success cannot erase the failed first run. An unresolved cold timeout cannot be called proven
  environmental, and this review does not label it so.

## 9. Remaining uncertainty (material)

- Thin timing margin. In this single canonical run the SSR test elapsed `18958.5609ms`, only ~1.04s under
  the child's `20000ms` self-deadline, and ~6s under the parent's `25000ms` `spawnSync` bound. The measured
  import graph is unexpectedly broad for plain text (message.tsx eagerly imports all four Streamdown plugins
  and their full closure). This is consistent with the parent's earlier ETIMEDOUT and means a slightly colder
  filesystem cache, AV scan or more contended host could push a future run past the bound.
- The child's `20000ms` timer is armed only after static TypeScript/module imports and hook/guard setup.
  Because synchronous loader/transpilation/evaluation can block the event loop, the child's own deadline may
  not fire promptly during import; the independent `25000ms` parent kill is the real hard bound. Diagnostics
  and the first-outcome cache improve failure evidence and retry control; they are NOT a cold-start/performance
  fix and NOT an OS sandbox.
- Warm-cache caveat. The sibling has been exercised by prior owner/reviewer runs, so this pass is not a
  guaranteed cold-cache run. The original failed children emitted no phase trace, so the exact failing phase
  then cannot be determined from available evidence.
- Provenance/legal caveats as stated in Sections 3 and 5 (no independent registry re-fetch; no blanket
  license clearance).

## 10. NOT RUN (out of scope; no claim made)

Browser/CSS/theme build, hydration, responsive layout, accessibility, E2E, bundle size, real transport/
product integration, Markdown/plugin runtime safety, full release license/security audit, provider/network
paths, OS sandboxing, live/policy/browser/durability/Fargate and G1. Root15 and existing-UI19/typecheck were
not rerun for this review and no other root evidence was accessed.

## 11. Bounded recommendation to Codex (no acceptance)

1. The candidate as reviewed is internally consistent: scope, hashes, pin identity, the single adaptation,
   license facts, harness repair and single-child behavior all reproduce. The one canonical check PASSED
   (exit 0, 12/12).
2. Do NOT treat this pass as acceptance. The cold-timeout history remains unresolved and the observed ~1s
   margin under the child deadline is a real residual risk. Recommend Codex decide explicitly whether to
   (a) accept the current bounds with the documented risk, or (b) commission a separately scoped, reviewed
   performance/cold-start correction (e.g. a lazy import boundary for the eager Streamdown plugin closure)
   that preserves actual exports, source and guard coverage — without a blind rerun-until-green or a
   unilateral timeout increase.
3. Preserve the honest limitations in the adoption report: unsigned tag, no independent registry
   re-verification, retained `skipLibCheck`, 7 notice gaps, and the NOT-RUN list.

## 12. Provenance of this review

Inspected: candidate package README, `component-pins.json`, `THIRD-PARTY-NOTICES.md`, both LICENSE files,
`package.json`/`package-lock.json`, `tsconfig.json`, `styles.css`, `fixture.tsx`, all 17 vendor sources,
`qualification.test.mjs`, the adoption report, and the original task brief. Diffs: `8e65b96..8d2cd175`
(30 added files) and `636bf874..8d2cd175` (three paths). Root evidence read (only the three permitted):
`docs/coordination/private-evidence/W02-ai-elements-review-1/stdout.scrubbed.txt`,
`.task-inputs/ai-ssr-timeout-diagnosis/FINDINGS.md`, `.task-inputs/AI-PARENT-CHECK-20261010.md`.

Final SHA and commit verified in Section 7 / commit message.
