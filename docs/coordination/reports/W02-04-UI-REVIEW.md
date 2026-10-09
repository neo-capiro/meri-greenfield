# W02-04 UI transport compatibility — independent Hermes exact-commit review

Status: **ACCEPT (offline transport preparation only)**. No gate passed, no deployment,
no cutover. This reviews the exact cumulative 14 owned additions plus the final owner
thin fix `7d094e1` and documentation `3c836ee`. Codex still owns acceptance.

- Reviewer session: `20261009_180714_1c878e` (separate real Hermes reviewer, distinct from implementation session `20261009_172411_d70282`).
- Reviewed SHA: `3c836eee9f4a70c9cd6314e3eac2bc35639f2177`
- Branch / worktree: `hermes/w02-ui-review`; `C:\dev\main\meri-greenfield-worktrees\w02-ui-review`
- Pinned base / merge-base: `f19afabe9b135c7b4fb4fd62ead40fede474be4d`
- Owner thin code: `7d094e12d15ab1693c8dd526808a712513c14cb9`; docs: `3c836eee9f4a70c9cd6314e3eac2bc35639f2177`
- Owned review path: `docs/coordination/reports/W02-04-UI-REVIEW.md` (this file)

## Prior-attempt bounds and deliverable incompleteness (honest record)

The first attempt of this session (limit 24 turns / 1800 s) completed all verification —
root 15, nested typecheck 0 errors, nested 19 tests, 10 independent reviewer reproductions —
but **exhausted its tool-turn budget before writing or committing this report**. No report
file was created in that attempt and no commit was made; the tree was left clean with
`.runtime` scratch removed. This bounded continuation (8 turns / 600 s) performs **only** the
report write + commit. No implementation file was changed by the reviewer at any point.

## Verified checks / counts (all on the exact reviewed tree)

- Root `npm run check`: **15 pass / 0 fail**, exit 0.
- Nested typecheck `./node_modules/.bin/tsc -p tsconfig.json` (5.9.3, noEmit): **0 errors**, exit 0.
- Nested offline tests `node --test qualification.test.mjs`: **19 tests, 19 pass / 0 fail**, exit 0.
- `git diff --check`: clean.
- Independent reviewer scratch (ignored `.runtime`, then removed): **10 / 10 pass**.
- Frozen schema unchanged: git blob `d7b3c22491ae81c5e875243754413aa7d35097e3` identical at
  `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3` and HEAD; SHA-256
  `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b`, 50043 bytes, LF.
- Range `f19afab..3c836ee` touches exactly the 14 owned files; **no** contract/root-lock/
  schema/infra/other-task/other-report change (checked by name list).

## Independent reproduction of the previously-found defects (actual exported factory + external Chat)

Driver: the real `createMeriChat` + `@ai-sdk/react` `Chat` + upstream
`createUIMessageStream`/`DefaultChatTransport`; mock fetch returning web
`Response`/`ReadableStream`; global `fetch` stubbed to throw (no network). Not helper-only.

1. Prototype-like error codes (`toString`, `constructor`, `__proto__`, `valueOf`,
   `hasOwnProperty`) return the generic safe string — via both `renderRunError` and a composed
   `run.error` event; no inherited function/object leak. (Owner `7d094e1` private-Map fix holds.)
2. Mutating caller-owned `options.view` after construction cannot split send vs reconnect
   identity: `chat.id`, the send command's `conversationId`, and the reconnect URL all remain
   the authorized view. (Owner `7d094e1` projection-snapshot fix holds.)
3. Immutable `eventId` conflict aborts **before** the chunk is forwarded/observed:
   `chat.status = 'error'`, `accepted = [1]`, cursor `1`, and no assistant `data-meri-event`
   message is built. `acceptOrReject` runs synchronously on the guarded data path.
4. Duplicate sequence bound to a different `eventId` aborts; cursor preserved at 1.
5. Out-of-scope binding (tenant mismatch) aborts the subscription.
6. Malformed `data-meri-event` and unexpected native `text-delta`/`reasoning-delta` frames are
   rejected pre-admission.
7. Canonical immutable identity: a key-reordered byte-identical redelivery is `duplicate`,
   not `conflict` (key-sorted canonical stringify).
8. `dataPartSchemas` runtime/type key mismatch reproduced at this exact pin: the typed key
   `meri-event` is ignored at runtime (malformed data reaches `onData`, 1 callback); the runtime
   key `data-meri-event` is the one consulted (0 callbacks).
9. stop/dispose on a held-open pending stream admits nothing, issues no cancellation request,
   and leaves durable run status unchanged; the transport exposes no cancellation.
10. `data-meri-event` `chunk.id` mismatch with `event.eventId` is rejected.

### Upstream facts independently confirmed in installed source (not only docs)

- `ai/dist/index.js:7098` — `schema: dataPartSchemas[chunk.type]`; runtime key is
  `data-meri-event`, while the type is keyed `meri-event`. `useChat({chat})` external path is
  therefore required; `dataPartSchemas` alone does not validate frozen events.
- `@ai-sdk/react/dist/index.js:261-268` — inline `useChat({transport})` forwards only
  `sendMessages`/`reconnectToStream`, dropping `resumeStreamIsReplay`/`close`;
  `ai/dist/index.js:20126` reads `this.transport.resumeStreamIsReplay`, so the zone is real.
  `useChat({chat})` (externally managed) preserves the transport object.

### Correctness spot-checks

- `producer.ts` emits stable `start`, one `data-meri-event` per event (`id = eventId`,
  `transient: true`), `finish`, `writer.setOutcome`; HTTP finish/ready/[DONE]/204 never set
  `isRunCompleted` — only an authoritative `run.status: completed` does.
- `types.ts` faithfully mirrors the frozen `$defs.UIEvent`: envelope required
  `contractVersion,eventId,binding,sequence,createdAt,scopes,type,data`; `RunBinding`
  `tenantId,actorId,conversationId,runId,attemptId,workerId,writerFence`; `Scope` fields; all
  10 variants. No invented fields; hash-binding constant matches the verified blob.
- Disclosures are accurate: `dataPartSchemas` mismatch, inline-transport loss, `ai-elements
  1.9.0` observed-only (CLI not executed; its pin does not freeze component source). No model
  loop, no raw error rendering, no hidden gateway dependency.

## Owner attribution

The defect fixes in `7d094e1` (private approved-error Map; projection-snapshot identity for send
and Chat id) are **Codex owner output after clean implementation-session closure**, not
`92e7d62` output; documentation `3c836ee` records the final counts. This review reproduces them
independently through the real factory rather than trusting the helper tests.

## Recommendation

**ACCEPT — offline transport preparation only.** No defects were found in the cumulative 14
owned additions, `7d094e1`, and `3c836ee` within the authorized offline scope. Frozen
contracts/schema, root locks, infra and other tasks are untouched.

## NOT RUN (explicit)

React mounting / real hook render; browser rendering, persistence, durable browser storage; real
network/SSE interop; ALB streaming/idle timeouts; authentication/authorization/revocation and
historical-access replay; approved-stop-vs-tab-close; slow-client/backpressure; real
browser-safe compiled schema; Fargate/Chromium sandbox; any AWS/cloud; `ai-elements` component
compatibility; accessibility/E2E. npm registry metadata/SRI were not re-fetched offline. Clean
status/shutdown of any supervisor process remains owner-verified. This is not a G1/W03/cutover
claim and authorizes no deployment.

## Process state

Reviewer performed research/verification only; wrote and committed this single report under the
owned path. No implementation edit, no model/provider/cloud/source/network/native execution, no
global-settings change, no delegation, no push, no amend.
