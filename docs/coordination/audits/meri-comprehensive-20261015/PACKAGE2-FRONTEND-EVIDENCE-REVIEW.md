# Frontend portable evidence review

Reviewed independently on 15 October 2026. Fable remains the implementation owner. Read-only Git retrieval, artifact inspection and isolated offline cloud replay only; no product edits, dependency installation, browser activation, user-computer access or deployment.

## Decision

**ACCEPT the exact-pin portable automated evidence gate**, scoped to the recorded fixture/browser checks and offline Elements SSR. The previously accepted bounded source corrections remain accepted. The former missing/uninspectable receipt blocker is closed: both receipts and all bound bytes were independently verified, and the new receipt's guarded rendering was independently replayed.

This does **not** accept mobile, clean manual accessibility, all later UI states, live authentication/authorization/persistence, full product integration, browser sandboxing, native artifacts or release/deployment gates. The manual accessibility items below remain open.

## Immutable identities and candidate delta

- Product candidate: [`c7e060007f5cd5a9b786442d0cc168a73c5565a8`](https://github.com/neo-capiro/capiro-frontend/commit/c7e060007f5cd5a9b786442d0cc168a73c5565a8), tree `e9905e0acf209cbd319166437c06ca1e112fa3de`.
- Evidence: [`59be1a24239c9c1af2c174cdddad59882b98db23`](https://github.com/neo-capiro/capiro-frontend/commit/59be1a24239c9c1af2c174cdddad59882b98db23), tree `5701e928e15a1bc80b8780aa95fab101f994c0e9`, on `meri/f34-evidence-c7e06000`.
- The [candidate delta from accepted 78b1c126](https://github.com/neo-capiro/capiro-frontend/compare/78b1c12691541a32aa82039d2518b91a5e780ce5...c7e060007f5cd5a9b786442d0cc168a73c5565a8) changes exactly three files: adoption documentation, qualification README and the README's generated pin record. No component behavior, tests, harness, manifest, lockfile or canonical UI provenance changed. The stale FileTree documentation and fifteen-versus-eighteen wording are corrected. The evidence commit adds only its evidence directory atop that candidate.

## Independently verified

### Artifact integrity and actual reporter output

An ordinary Git clone successfully supplied the binary and large-text artifacts that text-only connector endpoints could not return. The checkout remained clean. **All 255 entries in [SHA256SUMS](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/SHA256SUMS) passed independent hashing.**

Parsed the full 29,272,937-byte [raw Playwright report](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/playwright/report.json), SHA-256 `cb0d53565add201e7df2b3b0af2c80877a083595c3c1b535a408b79fb2420447`:

- **95 passed across 12 specs; zero unexpected, flaky or skipped results.** All 95 individual result records say passed with retry 0. Configuration uses one worker and zero retries.
- **22 are phone-width cases; 73 are desktop/default-viewport cases.** The earlier “95 desktop” description was too broad. This review grants no mobile acceptance.
- All **36 decoded axe JSON files match the corresponding inline raw-report attachments byte-for-byte**. Independently recomputed their violation/incomplete counts, and checked their published summary hashes/URLs.
- The report includes 61 focus screenshot attachments, both final light/dark FileTree screenshots and the recorded contrast measurements. Both FileTree images were inspected. This does not turn those screenshots into a manual accessibility audit.

The [spec/viewport ledger](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/README.md#L87-L121) accurately distinguishes the 12-spec run and its phone-width cases. The browser suite was not rerun independently here; its complete committed reporter output and attachments were inspected.

### Both receipts, dependency bytes and cross-pin refusal

Independently recomputed and matched:

- [Historical receipt](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/ssr/historical-78b1c126/receipt.json): `1d7b867567ce988514762f39dec396432f101e5bbcf562fa3aa8be28138b31e6`.
- [Current receipt](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/ssr/c7e06000/receipt.json): `4ad91e1597290a64daeb03e560dfcc0a52534cef3dfda3938cfd52ae1caacf5e`.

The compressed dependency archive was inspected before extraction: **3,155 unique regular files, 24,088,353 uncompressed bytes**, no links or escaping paths. Each extracted file's path, size and hash matched the receipt dependency inventory.

Created fresh source directories from `git archive` at each exact candidate, then populated only those verified bound dependency files. On the installed **Node v24.21.0, linux-x64**, ran the unchanged canonical `verifySSRReceipt` from each source directory:

- Current receipt at c7e06000: **PASS**.
- Historical receipt at 78b1c126: **PASS**.
- Current receipt at old source: **correctly REFUSED**, `package source pins`.
- Historical receipt at new source: **correctly REFUSED**, `package source pins`.

Each positive verification checked **67 source records, 3,155 dependency records, 2,806 mapped inputs and all three output artifacts**. The metafile additionally includes the synthetic entry, giving 2,807 compiler inputs. No receipt, verifier, version/platform guard or pin was modified.

The receipt comparison is independently confirmed. Only qualification README and promotion-pins source records differ. The complete dependency/input/tool/node identities are identical. Both receipts bind the same **20,518,628-byte fixture bundle**, SHA-256 `45f3177103cd430d39098b444edf50f1d0fc489eaa7f0ed1277d02f627350c48`, and identical LEGAL text. Metafile inputs and output entries are identical after normalizing the output-path keys. Build/discovery paths and timing envelopes differ as documented.

### Actual guarded SSR replay

Executed the unchanged current-pin `ssr-runtime.mjs` with the verified current receipt in a fresh child, enforcing the canonical 25-second parent limit and 512-KiB output bound. Then executed the exact assertion bodies of the two canonical rendering/hostile-text cases against that result. **Both passed**:

- Deterministic real Conversation, Message and PromptInput rendering; disabled controls; no active script/image/iframe/link markup or event/URL attributes.
- Hostile HTML, URLs, Markdown, diagram syntax and Unicode remain escaped literal text in all four input triples.

Observed: **756.86 ms**, eight loaded modules, 2,807 build inputs, no DOM, zero denied-operation attempts during rendering, deterministic output. The canonical guard probe also passed its seven restricted-operation checks and refused an unbound import.

This is independent receipt verification and actual guarded rendering, **not an independent rerun of the entire 18-test suite or an esbuild rebuild**. The bound archive is intentionally a receipt-input subset; it does not include the full TypeScript compiler or every file needed by all eighteen tests. The official esbuild tool files are not shipped. Neither limitation prevents validating the existing bound artifact and executing its canonical SSR runtime.

## Owner-run results now inspected, not merely quoted

The hashed logs establish the owner's complete reported run at c7e06000:

- [Elements qualification](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/logs/ssr-4-check-elements.txt#L23-L51): **18/18**, zero failed/skipped, including real-receipt drift negatives, actual SSR and hostile-text escaping; explicit command and exit 0.
- [Root units](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/logs/unit-test.txt#L123-L131): **116/116**. The earlier 52 figure is the separately logged **52/52 apps/web/test subset**, not the whole root suite.
- Typecheck and public-package checks have successful command/exit logs. Architecture JSON has `errors: []`, 503 inventoried files, 484 reviewed, 19 inherited-unreviewed and **zero blocking** findings.
- The superseded symlink-based preparation attempt and its `input escapes source roots` refusal remain visible. The real-directory preparation and all checks were rerun successfully. No failed attempt was presented as a pass.

The [environment disclosure](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/logs/environment.txt#L1-L16) records npm 11.19.0 versus the declared npm@11.9.0 and a copied existing install rather than fresh `npm ci`. This does not establish a fresh lockfile-install reproduction. It does not block this bounded receipt gate, because actual bound source/dependency/output bytes were independently checked. A small documentation overstatement remains: the typecheck log shows five workspace typecheck scripts invoked under `--if-present`; the README's “all six workspaces” should not be read as six executed typecheck scripts.

## Accessibility and acceptance limits that remain

Independent aggregation matches the [explicit disclosure](https://github.com/neo-capiro/capiro-frontend/blob/59be1a24239c9c1af2c174cdddad59882b98db23/docs/meri-figma-34-20261015/evidence/c7e06000/README.md#L123-L165):

- **36 automated axe audits, zero violations; 28 audits have incomplete results.**
- Contrast: 290 nodes across 28 audits. 289 are indeterminate gradient backgrounds; one has only non-text content.
- Two WebPreview audits leave sandboxed iframe contents untested (`frame-tested`). This is an incomplete check, not proof of an actual critical accessibility defect.
- Two Modules-home audits leave icon-label/name matching indeterminate.
- The six theme audits additionally perform rendered-contrast checks. **The other 22 audits with incompletes still need manual review** before a clean contrast/accessibility claim.
- Axe runs at the listed audit points. Later receipt/detail navigation, post-removal empty states, fullscreen/fallback states and iframe contents are not silently covered by earlier audit results.

Accordingly, this evidence closes the former inaccessible-artifact gap and supports the bounded automated checks. It does not close the comprehensive audit's broader product gates or authorize deployment. Mobile remains deferred.

## Review artifacts and execution accounting

Independent replay summaries are saved alongside this report:

- `frontend-portable-receipt-verification.log`: SHA-256 `a8bcdfb7d566149379cc172fd7b4441d6ae8d1621838cd23697e24022141c620`.
- `frontend-portable-ssr-replay-summary.json`: SHA-256 `01f38be5c751aabb676eec0cbe9758c0019f599bb7eb4b84d7388ce6934ffc2a`.

Text-only connector reads could not supply the tarball/large reporter, but ordinary authorized Git retrieval succeeded without a denial or bypass. One preliminary verifier invocation occurred before source extraction finished and failed at module loading; no test ran in that attempt. After preparation completed, both canonical positive checks and both cross-pin negatives above passed. No product source or evidence artifact was altered.
