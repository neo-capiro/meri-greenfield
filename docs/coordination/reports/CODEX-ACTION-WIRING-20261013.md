# Runnable recommendation application and frontend handoff

**ACCEPT_SOURCE.** The local user flow now runs through an implemented Fetch application and current synthetic session/policy wiring: query recommendations, select and edit a draft, prepare an immutable proposal, observe refusal before approval, explicitly approve through the separate fixture control, execute once and replay without another effect. This continues PR41 `a385fed03b6700bbccb158643793d0be29ccc5ed`; it does not change the frozen frontend shipping candidate.

From a checkout with the existing pinned Node24/root lock dependencies, run:

```sh
node scripts/local-followthrough/run.mjs --run
```

The [portable local README](../../../apps/control/action-application/local/README.md) gives exact prerequisites, `--help`, exit codes and ownership. This executes actual Fetch Requests/Responses in one process. It starts no HTTP listener, SQL engine, model or cloud service. The synthetic source and SQL boundaries are explicitly local; the application, current gateway authority, durable invocation algorithms, retained lookup/read, metadata owner/store and existing command approval/execution/journal are actual source modules.

## Implemented ownership and acceptance

The application entry composes existing owners; its HTTP module owns bounded streaming JSON, route/header admission and content-free responses, while its session module validates fresh trusted context and clips deadlines. It performs no domain authorization or approval policy of its own. The separate local composition owns opaque process-local session credentials, current synthetic policy, explicit fixture-only approval and cleanup. The CLI is an inert entry until `--run`; production application imports do not pull in the local fixtures.

| Source | Accepted freeze | Independent review | Result |
| --- | --- | --- | --- |
| Application `index/http/session.mjs` | `7cea5042a57f3fa9202d87b0c3ba433d7c77a9dd` | `8f12bd58eb019323a32b614b4039c0333c6c8b70` | 15 author + 36 independent pass |
| Local `demo/flow.mjs` and CLI | `5fed7fcf558fa74f3b368fb81f3245847a552ee5`, composed with exact repaired application | `48c98ab525444724c69c022e11683857a86029bb` | 10 author + 44 independent pass, including repeated query |

Root integrated only accepted source. The author/reviewer dependency copies were excluded where necessary; original branches and complete evidence remain preserved. All six runnable files exactly match the accepted pins. All **10,377 PR41 entries** retain their original mode/blob; worker audits also preserve the additional root task outline at their 10,378-entry base. All **112** members of five component manifests verify. Public0.1/private0.2 contracts, tests, lockfiles, canonical registry and original139 capability ledger remain unchanged (96 selected/43 deferred). All97 operation descriptors retain null handlers, pending qualification and zero retries.

## Executed integrated checks

All captures bind source **`2ae35e9ad02f990d3c4ba284170589a87ac8b773`**, with zero source diff:

- **105/105 combined checks pass**, zero skips/cancellation/failures, 16.701 seconds. Coverage includes strict request admission, body/deadline bounds, fresh auth/expiry/revocation, cross-session isolation, actual composed workflow, approval refusal, execution/replay and cleanup.
- **Actual one-shot CLI passes**, 3.323 seconds: one synthetic source read, one metadata record, one retained lookup, one command journal record and one task effect; replay returns the same observed result. Cleanup closes the identity and clears approvals.
- **Two concrete uncertainty wire captures pass**, 3.098 seconds: actual metadata-store boundary with lost insertion acknowledgment yields `UNKNOWN`; release-policy denial after insertion yields `STORED_NOT_RELEASED`. Both retain one synthetic metadata row and zero task effects. Neither permits automatic retry.
- Source preservation, exact accepted file hashes, five component manifests, pilot arithmetic and authored source whitespace pass. Earlier PR41's 514/514 evidence remains its own record and was not rerun or reattributed.

See [`integration/`](../../qualification/candidates/action-wiring-20261013/integration/) for exact commands, raw streams, source audit, cleanup and manifest. Owned process groups448664/448695/448713 were absent without timeout or kill. Temporary root dependency links are removed during closeout; borrowed dependencies and the previously materialized official pg driver remain with their owners.

The original application failures remain visible: a stored query followed by denied reread could incorrectly become `NOT_DISPATCHED`; error sanitization invoked hostile Proxy/getter behavior; and a real metadata owner `STORED_NOT_RELEASED` could lose its disposition. Independent controls reproduced these before the narrow new-adapter repair. Ambiguous insertion already preserved `UNKNOWN`. Author syntax/reused-event-slot and reviewer sparse/audit setup failures are retained separately; fixture corrections did not weaken product assertions. There were no local-composition production defects and no failed root integrated checks.

## Frontend API handoff

The [application README](../../../apps/control/action-application/README.md) freezes the implemented new unactivated adapter. [`wire-fixtures.json`](../../qualification/candidates/action-wiring-20261013/integration/wire-fixtures.json) contains six actual success/pending/denied/replay request-response steps and two separate actual uncertainty responses, bound to their raw capture hashes. Credentials are omitted. These are synthetic examples, not deployed API observations.

| POST route | Body | User-visible result |
| --- | --- | --- |
| `/api/action-followthrough/query` | `{request}` | Current-authorized retained recommendation page, coverage, result reference/hash and canonical UIEvents |
| `/api/action-followthrough/draft` | `{selection,edits?}` | Editable task intent correlated to one retained recommendation |
| `/api/action-followthrough/prepare` | `{draft}` | Exact immutable proposal awaiting separate approval; no task effect |
| `/api/action-followthrough/execute` | `{proposal}` | Existing guarded observed/indeterminate result; execution fails without current approval |

Each request requires an opaque bearer session. The trusted resolver supplies current tenant/actor/run/client/scopes, fresh check/expiry, a separate lookup credential, canonical owners and execution authorization. The browser supplies intent only. Responses are no-store JSON; `UNKNOWN`, `RESULT_NOT_RELEASED`, `STORED_NOT_RELEASED`, `NOT_STORED` and `READ_UNAVAILABLE` retain their precise owner meanings. An error or timeout is not a retry instruction. The supporting recommendation is not an approval-bound durable provenance link.

Pinned frontend discovery at PR16 `7c87678730538958ace9762f824dc3e588bf445b` identifies `packages/meri-client` as the AI SDK stream consumer and `apps/web/src/features/meri/workspace` as the disconnected workspace. The action endpoints require a separate authenticated JSON request adapter; preserve the canonical UIEvent stream validator/projection. No Approve HTTP route exists here, and the fixture-only approval method must never become browser authority. The frontend owner can wire selection/draft/pending presentation in a separate successor after agreeing the action result validation boundary. Existing frozen public package exports remain unchanged; private server modules must not be imported into the browser or mirrored as a competing schema owner. No frontend implementation or browser walkthrough was performed in this backend slice. The exact reference files/lines and handoff map are in the [pilot/frontend report](CODEX-ACTION-WIRING-EVAL-PROPOSAL-20261013.md).

## Concrete pilot and remaining activation work

The [reviewable pilot packet](../../qualification/candidates/action-wiring-20261013/eval-proposal/pilot-proposal.json) proposes **six human-authored requests, six serial SDK sessions, at most18 provider requests**, through the existing Bedrock US Sonnet4.6 route and Claude Agent SDK0.3.295. Each call is capped at8,000 total input/256 output tokens; no retry, cache, fallback, subagent or paid judge. Estimated inference is **$0.183744**; maximum token liability at the proposed admitted rates is **$0.551232**; the proposed fresh inference ceiling is **$0.75**. These are estimates using cited public reference rates, contingent on verified account rates no higher than $3.30/$16.50 per million tokens. No spend is authorized by this packet and the historical $10 remainder is not assumed.

All six literal generated prompt templates and exact gold outlines are supplied for human authorship/freeze. They cover recommendation selection, pagination, stale-source absence, ambiguity, revocation and edited pending proposal. The snapshot is synthetic, contains no customer data and permits no external source mutation; the pilot stops before task execution. Templates are not received real requests and cannot increase the original real-corpus denominator. Qualified real requests remain0. The original quality/reliability/isolation gates remain intact.

Local application/session/policy wiring is implemented and verified. Activation now requires qualified host session/source/approval bindings, actual endpoint mounting, the frontend's separate consumer integration and exact runtime/proxy admission. The proposed paid pilot additionally needs six actual human-authored requests/gold, effective account prices and explicit bounded spending authority. The native owner retains its separate PostgreSQL/SDK work; this public source packet neither repeats that work nor includes or attributes unpublished native receipts. G0 remains accepted, G1 OPEN and G2–G7 unentered.

No production source enablement, new database work, migration application, frontend edit, main merge, provider/model call, image operation, cloud/security/network/customer-data change or infrastructure spend occurred here. No further source permission is needed for the implemented slice; the remaining runtime and spending decisions belong to their exact owners.
