# Meri VQA status — 4 November 2026

Verification ledger for the 20 issues carried forward from the handoff. Companion frontend changes: [capiro-frontend PR #563](https://github.com/neo-capiro/capiro-frontend/pull/563), reviewed source tree `44f94639546cbc73d683670b89926a4f1f391ba3`.

**No original issue is marked closed here.** Reproduced source defects and passing local checks advance the work; the remaining acceptance below distinguishes them from the original live/native failures. New tests use synthetic authority/provider/storage boundaries unless explicitly stated otherwise.

**Status terms:** “New fix” identifies a reproduced defect corrected in these PRs; “Existing fix checked” identifies an accepted correction verified locally; “Evidence added” identifies useful coverage without a newly demonstrated product defect. Pending checks are not passes.

## Issue ledger

### VQA-001 — Preferences loading/sign-in recovery

- **New fix:** Preferences can explicitly recheck an unavailable current account; its contents remain gated on a fresh verified owner. Targeted retry and account-switch/late-reply browser coverage pass after the fixture was corrected to exercise Preferences beyond the outer account gate.
- **Remaining:** Verify an eligible conversation-to-Preferences recovery with the current authenticated owner. The original recovery-chain cause remains unclosed.

### VQA-003 — Frequent disconnect/reconnect

- **New related fix:** A renewed conversation port can read history while the retired port is still pending; retired completions cannot overwrite the current view. Both abort-aware and late-reply Chromium regressions failed before the fix and passed afterward.
- **Remaining:** Correlate an eligible fresh disconnect/HTTP failure with serving source and proxy/runtime observations. This correction and the accepted connection diagnostics do not establish the historical 502 cause.

### VQA-004 — Grant-search connectivity

- **Existing fix checked:** Merged PR #616 includes normalized query and agency UTF-16 bounds matching Core. Current grant-route and input-boundary checks pass; those fixes are preserved.
- **Remaining:** Obtain one eligible, correlated grant request/result or attributed failure. Input validation success does not establish closure of the original connectivity complaint.

### VQA-005 — Saved-title search/pagination

- **Existing fix checked:** The full application Chromium case passed title search, continuation paging over eligible synthetic chats, and clearing the query to start a fresh unfiltered list.
- **Remaining:** Repeat the intended read-only search/page acceptance on an eligible real conversation after integration; no protected historical conversation was reused.

### VQA-006 — Completed-conversation reopening/recovery

- **New related fix:** Renewed-port history recovery is verified; existing completed-status wording and unknown-command barriers remain intact. Focused reopen/currentness tests passed.
- **Remaining:** Join an eligible completed opening to the admitted session, latest run/pending turn, request lineage, and intended target. A saved answer alone cannot clear a newer uncertain command.

### VQA-007 — Research source verification/publication dates

- **Existing fix checked:** Source review confirms the accepted PR #612 remedy is present; public-web schema checks pass, including explicitly optional dates. Article evidence must identify the actual source and distinguish publication dates from other dates; discovery indexes are insufficient.
- **Remaining:** Produce fresh output with actual per-article source/read/date joins. No new model run was made, and the protected historical research attempt was not resumed.

### VQA-008 — Lost answer before publication/persistence

- **Evidence added:** Repaired stale verification fixtures now exercise actual load, publication, usage replay, terminal fencing, cancellation, and delayed/lost settlement acknowledgements; 32 selected composition cases pass.
- **Remaining:** Attribute an eligible new failure across native load, durable publication/commit, terminal state, and UI observation. The original native-load refusal remains unexplained; fixture corrections are not a production fix for it.

### VQA-009 — Artifact/file Details refusal

- **New related fix:** A mounted preview rebinds to renewed access within the same context, aborts stale reads, and preserves unknown publication state. Unit and actual-panel browser regressions pass; the renewal regression failed before the fix.
- **Remaining:** Join a same-version Details request/response to its current authorized context and UI surface. Successful preview renewal or a prior download does not establish that the original inspect refusal is resolved.

### VQA-011 — File-library availability guidance

- **Existing fix checked:** Accepted capability-specific guidance is retained; the file/Office unit group passes. Preview renewal preserves the concrete refusal guidance exposed by the available capability.
- **Remaining:** Verify the normal guidance against an eligible session's actual file-library capability and file type. No connection or artificial live fixture was created for this check.

### VQA-012 — PDF refusal explanation

- **Existing fix checked:** Actual panel/transport browser coverage confirms that renewed preview unavailability retains `PREVIEW_UNAVAILABLE` guidance and does not show an iframe; successful synthetic preview recovery is also covered.
- **Remaining:** Inspect and preview an eligible owned PDF/version through the actual capability. Synthetic PDF bytes establish receiver/UI behavior, not native PDF rendering or the original refusal's cause.

### VQA-014 — Preferences keyboard focus

- **Existing fix checked:** All 10 keyboard Chromium cases pass, including ArrowLeft, wrapping, roving focus, navigation, and superseded selection. The previously missing ArrowLeft branch now has local browser evidence.
- **Remaining:** Confirm the accepted behavior on the integrated product with an eligible Preferences session; local synthetic-page qualification is the evidence supplied here.

### VQA-016 — Native Office editor integration

- **Evidence added:** Two new General DOCX tests pass through native-session/Office application launch and runtime `CheckFileInfo`/`GetFile`, preserving null client, exact user scope, and expiry. The 100 affected WOPI/Office cases also pass.
- **Remaining:** Perform one eligible native Office launch with an attributed callback/response within its lifetime. These local composed owners use synthetic external ports; they do not prove editor/TLS/network operation or replace native Office with Tiptap.

### VQA-019 — Responsive settings overlap

- **Existing fix checked:** Full application Chromium geometry checks pass at 375px/light and 727px/light and dark, with one-column layout and controls kept within bounds.
- **Remaining:** Verify these widths on the integrated product/browser surface. No new layout correction was needed after the accepted fix.

### VQA-021 — Recurring session expiry

- **New related fixes:** Conversation history and mounted previews now adopt renewed ports without stale completion effects. Current-owner gating and explicit account recheck are retained; late preferences data cannot replace a newly verified owner.
- **Remaining:** Attribute a fresh session/HTTP failure to its current owner and serving source. Targeted Preferences retry now passes, but local renewal tests do not explain recurring production expiry.

### VQA-025 — Retention read budget

- **Existing fix checked:** All 20 synthetic PostgreSQL-watermark/budget cases pass. The exact native three-case fixture from PR #611 was preserved; PostgreSQL 16 tooling was obtained without starting a cluster.
- **Remaining / blocked:** Run real lock retry, shared-deadline, and caller-abort cases on isolated PostgreSQL under a valid non-root user. This environment runs as UID 0, cannot establish the required alternate user/namespace, and PostgreSQL refuses root. No native pass is claimed.

### VQA-028 — Stop uncertainty

- **Existing fix checked:** All 12 Stop/reopen Chromium cases pass: terminal observations retire uncertainty, unsettled/refused reads retain it, and lost Stop commands are never automatically replayed. Runtime cancellation/settlement barriers also pass locally.
- **Remaining:** Observe a safely cancellable eligible owned run through its confirmed terminal state. No old uncertain Stop was replayed or live generation started to manufacture a target.

### VQA-030 — Evidence/causal quality

- **Existing fix checked:** Accepted PR #610 rules and causal-comparison tests pass. Unknown bias direction remains unknown, and matched weekdays alone do not establish a causal design.
- **Remaining:** Obtain fresh generated output demonstrating the correction with its actual evidence. Historical pre-fix answers and local policy tests are not that witness.

### VQA-031 — Rename dialog focus

- **Existing fix checked:** All seven rename Chromium cases pass, including Escape returning focus to the exact opener, close-button behavior, and context/row changes.
- **Remaining:** Confirm the integrated behavior on an eligible terminal conversation with no rename save. The historical protected row was not touched.

### VQA-032 — Email and routine approval failures

- **Evidence added:** Six new SDK-to-public routine approval/reconciliation cases pass: retained preparation, one dispatch, lost-ack recovery without redispatch, and request/digest/actor/revocation refusal. Two full routine-flow cases pass after fixture migration; existing mail approval/recovery cases also pass.
- **Remaining:** Attribute an eligible email failure stage and a routine prepare/decision/reconcile outcome in the product. No live mail was sent or routine activated; no additional product defect was reproduced locally.

### VQA-033 — Control service availability

- **New fix:** A real shutdown exception was reproduced when Hono synchronously sent a malformed-request refusal before the runtime observer rewrote its headers. The sent-header guard passes six HTTP/drain cases and runtime typecheck; it does not establish the historical outage's cause.
- **Remaining / blocked:** Control credentials remain process-local, while current private callbacks use a shared target without owner-incarnation routing. The accepted historical C1 source/complete protocol artifacts are unavailable in this checkout/remote; exact integration and public/private affinity remain outstanding.
- **F1 facility:** Required writable owned IPC material, same-owner activation/observation, supported operator/Exec identity, bounded stdin-EOF/output/authoritative remote-exit transport, and finite drain/rollout evidence remain unqualified. Current read-only material and disabled Exec do not provide that facility; no authority weakening or rollout-percentage substitute was introduced.

## Verification record and limits

- **Runtime:** 32 repaired composition cases, 20 retention unit cases, six HTTP/drain cases, six new routine cases, and two full routine-flow cases pass. Earlier selected runtime suites contain passing restore/renewal/execution/settlement coverage; their stale-fixture failures were corrected and rerun in the named groups.
- **Tools/research/mail:** 95 existing selected checks passed across two runs; the remaining two routine-flow setup failures then passed after migration. Counts describe separate targeted runs, not one aggregate suite.
- **Office:** Two new General DOCX cases and 100 affected WOPI/Office cases pass. Core authority coverage is 15/15; frontend file/Office baseline coverage is 80/80. Native Office acceptance remains separate.
- **Frontend:** 116 focused unit cases and 29 preview unit cases pass; combined renewal browser checks are 4/4, keyboard 10/10, rename 7/7, and Stop 12/12. All 12 unique full-shell targets passed across the original run and two-case follow-up: title paging, three width/theme cases, and eight Preferences cases. These are 45 unique browser cases. The initial retry fixture failure is retained, not counted as a pass. Changed-file lint/format checks and the strict TypeScript check of all changed TypeScript entry files, the other command-gate consumer, and their imported dependencies pass.
- **Outstanding gates:** Frontend full typecheck exhausted the default heap; both 4GB retries exited 137, including the final run after browser servers exited. The narrower 17-entry TypeScript check passes with the same strict project options; it is not a full-application pass. The browser plugin timed out twice; local Chromium evidence does not establish the original signed-in acceptance.
- **Execution boundary:** No historical session was resumed, uncertain mutation replayed, model query made, email sent, live database queried, PR merged, or deployment performed. Local/native blockers and original acceptance requirements remain open for explicit follow-through.
