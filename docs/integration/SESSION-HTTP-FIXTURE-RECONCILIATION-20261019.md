# Session HTTP fixture reconciliation

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
Receiving source inspected read-only: `5572d9c9c2448d4577e5051c35e370f0c8a5721b` at `/dev/shm/meri-writes-root`.
No production source, session owner, approval assertion, Core/frontend file, frozen build input or deployment changed in this slice.

## Reproduction and cause

The two combined-run failures were:

- `apps/control/action-host/session/http-independent.test.mjs`: independent actual HTTP opaque issuance reaches the accepted graph/proposal.
- `apps/control/action-host/session/session.test.mjs`: actual HTTP session issuance composes shared-pool query/draft/prepare/approved execute.

Both fail at the **first query** assertion, after session issuance already returned HTTP 200. A direct invocation returned `{error:{code:'LOOKUP_UNAVAILABLE',outcome:'UNKNOWN'}}`, HTTP 502; the fixture recorded `sourceReads:0`, `taskEffects:0`, and setup READY. These are not derived-session issuance or HTTP owner-whitelist failures.

The unchanged exact base reproduces the same failures. Both tests use `action-host/local-integration/ports.mjs`, whose synthetic read producer still returned legacy credentials and expected POST `/api/clio/tools/query_action_items` with a raw client body. Its existing local-action gateway now uses the signed `actions.query` adapter: exact `fixtureSignedActionReceipt` correlation, `CapiroMeriRead`, fixed POST `/api/clio/tools/actions.query`, and `{input,metadata}` protocol body. The adapter refused the stale credential shape before synthetic fetch.

## Minimal correction

Only `apps/control/action-host/local-integration/ports.mjs` changes. The read producer reuses `fixtureSignedActionReceipt` from the existing local-action fixture owner. It verifies current synthetic capability, operation, full binding, subject scopes, policy, selected client, request hash and fixed target; the fetch verifies exact authorization/service identity, body hash/protocol bytes, canonical correlation and client/cursor before counting a read. It rechecks the current capability before credentials and fetch.

The command credential function and command source are unchanged. Existing test assertions remain unchanged, including one effect per approved command, exact accounting, native-bearer refusal, forged-proposal refusal, revocation, fresh-pool replay and cleanup. No production source accepts fixture credentials.

## Focused commands and results

Node: `v24.19.0`. Commands ran with `TMPDIR=/dev/shm/meri-session-http-test-temp` and `MERI_REVIEW_SOURCE_ROOT` equal to the actual worktree; dependencies were borrowed read-only without installation or lockfile changes.

| Source | Command | Result |
| --- | --- | --- |
| Receiving source, before correction | `node --test apps/control/action-host/session/http-independent.test.mjs apps/control/action-host/session/session.test.mjs` | 24 cases: 22 passed, 2 failed at the first query HTTP 502 assertion. |
| Exact unchanged `98d3c96a`, separate sparse worktree | Same command | Same 24 cases: 22 passed, same 2 failed. |
| Corrected fixture on exact base | Same command | **24 passed, 0 failed, 0 skipped.** |
| Corrected fixture on exact base | `node --test apps/control/action-host/local-integration/*.test.mjs` | 22 cases: 20 passed, 2 failed in the separate unchanged `allocation-independent.test.mjs` fixture. |

The remaining two local-integration failures are `INVALID_RESULT` for read-first/command-first allocation-order cases. That test constructs its own legacy credential source directly and does not import the corrected `ports.mjs`; it is outside this slice. Its source remains byte-identical to the base. No assertion or production read path was changed to make it green.

`git diff --check` passed. No broader suite was repeated. These checks are source-local HTTP/session/durable-owner evidence over explicit identity and SQL stand-ins; they do not qualify native Core, live database/provider behavior, exact-image startup or first chat.
