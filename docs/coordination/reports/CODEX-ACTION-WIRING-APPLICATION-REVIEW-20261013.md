# Action application independent review

**ACCEPT_SOURCE** for `7cea5042a57f3fa9202d87b0c3ba433d7c77a9dd` against `f3127d742b6b4ec556b00dba939d35e5622a9ad1`. Author packet `91c840d4582e94be28b694e878225141fc6805e2`; audit **47/47 PASS**, all **10,378** original entries unchanged, all **18** author manifest members verified (`application-review/audit.json`). Criteria were frozen at `0b401004595dd13822378ca6d93356b1103110b4` before candidate inspection. Runtime/deployment remains **HOLD**.

The three new modules separate Fetch transport, trusted session correlation, and orchestration of existing owners. Fixed POST query/draft/prepare/execute routes accept intent only. Query invokes the actual lookup and authorized retained read. Draft/preparation use the accepted follow-through and command interface; execution remains a separate call through the guarded command owner. No new approval policy, decision store, listener, automatic task acceptance, catalog activation or shared contract change is introduced.

**36/36 independent checks PASS**, zero skips/cancellations, on exact repaired production bytes. The connected positive exercises actual Request/Response, lookup delivery/Postgres store, current opaque identity authorization, follow-through, command interface/executor/journal/HTTP source, separate explicit synthetic approval, and retained replay with one observed effect. Additional tests compose the actual PostgreSQL approval metadata store and owner. SQL, HTTP, session and approval decisions remain inert test boundaries; no engine, network, customer, model, provider, native or cloud action ran.

Checks cover closed route/body authority, content type, missing/duplicate credentials, strict UTF-8/JSON, missing or false Content-Length, byte caps, parked body/session cancellation, stale/expired session receipts, shared shorter expiry through metadata, mismatched selected client, current read revocation, changed proposals, post-effect cancellation and response-size refusal, no borrowed pool disposal, and all six documented outcome values. These are observable outcome checks through canonical owners, not helper-call counts alone.

| Preserved capture | Result | Finding |
| --- | --- | --- |
| `initial`, source `bdad9a1f` | 29/30 | A saved query followed by denied reread was mislabeled NOT_DISPATCHED. |
| `actual-read-negative`, same source | 0/1 | Same failure reproduced with actual identity revocation and canonical lookup.read. |
| `error-metadata-negative`, same source | 1/4 | A rejection proxy and CommandError message getter executed; actual metadata insertion followed by release denial lost STORED_NOT_RELEASED. Ambiguous insertion UNKNOWN already passed. |
| `repaired`, source `7cea5042` | 36/36 | All original expectations pass, plus explicit NOT_STORED and READ_UNAVAILABLE controls. |

The repair admits error information through inert own descriptors after proxy refusal; application errors use private recorded facts. It preserves canonical metadata outcomes and gives acknowledged query/result state precedence over later read-local NOT_DISPATCHED. Query acknowledgement is recorded before the outer lifetime's post-await check. Original failures, exact preimages and unmodified raw streams remain available. The author's initial syntax and synthetic query-fixture failures are preserved separately and do not establish source success.

The exact source/author-packet audit verifies unchanged original Git entries, tested hashes of all three production modules, final author manifest and every independent raw stream. All 97 catalog operations remain unimplemented with null handlers and pending qualification; original 139/96/43 scope, public/private contracts, original tests, native/SDK/frontend source and locks remain unchanged. No broader suite was repeated in this review.

All four owned capture groups (444067, 444827, 445364, 446116) are freshly absent with no timeout or kill; final replay took 3.533 seconds. Only this review's seven copied dependency directories were removed after verification. Donor dependencies and other owners' resources were untouched.

The host's `resolveSession` is still responsible for authenticating opaque credentials and returning current policy/context; structural checkedAt/binding checks are not JWT or deployment attestation. Existing lookup and command owners retain authorization, durable identity, approval and source truth. The new route is unactivated, not an existing deployed endpoint. Supporting recommendation hashes are not approval-bound durable provenance. Cancellation is cooperative: a failed/withheld response does not establish physical cancellation, rollback, absence or retry permission. Durable production services, live session/approval provisioning, frontend integration and G1/runtime qualification remain separate.

Focused reproduction with existing pinned minimal dependencies: `python3 docs/qualification/candidates/action-wiring-20261013/application-review/capture-reaped.py NEW_LABEL node --test apps/control/action-application/application-independent.test.mjs`. Use a new label to preserve existing receipts.
