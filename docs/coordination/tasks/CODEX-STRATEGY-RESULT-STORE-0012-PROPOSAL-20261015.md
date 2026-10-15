# Strategy result-store0012: concrete allocation proposal

15 October2026 UTC. **PROPOSED ONLY; UNRESERVED; no SQL or runtime implementation.** Parent requested a concrete schema/responsibility/author proposal before any allocation. Contract pickup `e3bbab9c32fc7b972299a6b9dbcb301656a82045`, tree `6daf165782899d681554c2f229d73099bbb86002`, remains an isolated candidate under independent cross-repository review. This document does not freeze its wire.

## Exact proposed allocation and author

| Item | Proposal |
| --- | --- |
| Repository | `neo-capiro/meri-greenfield` |
| Namespace | Existing `meri_conversations`; no new database/schema |
| Migration | `apps/control/conversations/migrations/0012_strategy_operation_results.sql` |
| Table | `meri_conversations.strategy_operation_results` |
| New adapter | `apps/control/strategy-operations/postgres-result-store.mjs` |
| New focused tests | `apps/control/strategy-operations/test/postgres-result-store.test.mjs` |
| Recommended exclusive future SQL/adapter author | **Fable**, after explicit parent allocation and contract agreement; serialize runtime integration with Fable's existing correction queue |
| Current actual assignment | **No0012 writer is allocated.** Codex currently owns candidate schemas/distribution/tests and this proposal only. Fable's existing0011 reservation supplies no0012 authority. |

Collision inspection is against Fable `f0befe1e486cfda644f1f6170cf3d9d671e5158f`, tree `fb58adeccde7c5c7c48a5562ac3108b888a6d17e`, and central registry `e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7`, tree `d7c0052401c1390e6e627167176168078e2859a4`. Source conversations0001–0010 are occupied;0011 is centrally reserved exclusively for Fable's durable issuance journal; no0012 source/reservation was present. Recheck immediately before allocation; do not silently choose another number if it collides. The registry is unchanged.

**Concrete parent decision:** reserve the exact0012 path for Fable's single result table and focused PostgreSQL adapter/tests, conditional on contract acceptance, or return a different explicit author/path. Until then, nobody authors0012 SQL or edits shared runtime files for this result store.

## Minimal proposed relational schema

One table contains a durable claim plus its eventual immutable canonical result. Store canonical UTF-8 JSON text inline, bounded by the candidate limits, to avoid introducing a new blob service, locator or credential authority. The final schema must follow the reconciled canonical contract; these are proposed column names/types, not executable DDL.

| Columns | Proposed PostgreSQL type / invariant |
| --- | --- |
| `tenant_id`, `actor_id`, `owner_actor_id` | `text NOT NULL`; exact trusted principal |
| `client_id`, `job_id`, `request_id` | `uuid NOT NULL`; immutable original request/job/client |
| `operation` | `text NOT NULL`, closed candidate enum draft/edit/step-document; enum membership grants no authority |
| `conversation_id`, `run_id`, `attempt_id`, `worker_id` | `uuid NOT NULL`; original canonical RunBinding identity |
| `writer_fence` | `bigint NOT NULL`, integer1..9007199254740991; exact original binding fence, not a new lease |
| `candidate_version` | `text NOT NULL`; exact accepted contract version before implementation |
| `request_canonical_json` | `text NOT NULL`, valid JSON object, UTF-8 canonical request at most131072 bytes; no raw bearer/provider/grant material |
| `request_sha256`, `input_sha256`, `source_sha256`, `context_sha256` | `text NOT NULL`, lowercase64hex; exact canonical contract semantics |
| `basis_sha256` | nullable lowercase64hex; null only for draft |
| `requested_at_ms`, `original_expires_at_ms`, `absolute_expires_at_ms` | safe integer `bigint NOT NULL`; immutable originals, requested < original <= absolute |
| `state` | `text NOT NULL`: `CLAIMED`, `UNKNOWN`, `COMPLETED` |
| `row_version` | positive safe integer `bigint NOT NULL`, starts1; CAS revision only, never grants a fresh execution lease |
| `result_ref` | nullable `uuid`, unique within tenant when populated; never replaced |
| `outcome` | nullable closed result state `succeeded`, `needs-information`, `refused`, `failed`, `cancelled` |
| `completed_at_ms` | nullable safe integer `bigint`; matches trusted terminal time; succeeded outcomes must predate original expiry, while correlated failure/cancellation reports may record expiry or later |
| `result_canonical_json` | nullable `text`, canonical complete result envelope at most2097152 UTF-8 bytes |
| `payload_sha256`, `result_sha256` | nullable lowercase64hex, exact candidate canonical hash semantics |

Keys: primary key `(tenant_id, job_id, operation)`; unique `(tenant_id, request_id)`; unique `(tenant_id, conversation_id, run_id)` (one typed operation per original run, explicitly not batched); unique `(tenant_id, result_ref)`. A composite foreign key `(tenant_id, conversation_id, run_id)` references the existing `meri_conversations.runs` row, with no cascade deletion. Claim must compare the complete parent projection binding, principal and authoritative source/request mapping; the Meri operation request hash is not assumed equal to the different existing conversation request hash. If accepted integration needs multiple typed results within one run, it must revise this explicit uniqueness decision before SQL.

`COMPLETED` iff every result column is non-null; nonterminal rows have every result column null. The null payload in a non-success envelope still has a non-null payload hash. Result outcome is distinct from claim state: a valid failure/cancellation is a completed immutable outcome, not permission to start a replacement run. Database constraints/triggers must refuse changes to identity/request/hashes/deadlines and any mutation of a completed envelope. Completion must compare envelope identity/hash columns and the immutable parent binding. Canonical-byte digest checks must match the existing canonical SHA256 scheme: request hash over the full request, payload hash over payload including null, result hash over the envelope excluding its own hash. Do not substitute PostgreSQL `jsonb::text` for canonical bytes. Final SQL hash implementation/dependency must be qualified against the supported PostgreSQL version.

## Only four persistence responsibilities

1. **Claim once before invocation.** Use the unique keys and atomic insert/conflict protocol; a row lock on a missing row is insufficient. Compare the full immutable request and binding on conflict. Exactly one successfully acknowledged committed insert can return fresh ownership. No row lookup/timeout ever independently authorizes an SDK call. Existing durable admission/issuer owns invocation and budget; this table is neither another capability issuer nor a budget ledger.
2. **Complete once under the original fence.** Validate the reconciled closed result envelope against the trusted request/binding; CAS from CLAIMED/UNKNOWN using row_version and the same original binding. Serialize with the parent run/current suppression state and recheck current cancellation, authority and original worker expiry before committing a new result. Advance to COMPLETED exactly once. Same exact result replay returns the stored bytes/ref/hash; any difference refuses. ACK loss after commit is lookup of that committed result, never another completion/model request. Late uncommitted successful output after expiry cannot exploit retained-read permission to become a fresh successful completion. Truthful correlated failure/cancellation reporting after expiry is a separate terminal accounting path, not a product effect or worker renewal; its trusted owner/current authorization must be reviewed before implementation.
3. **Persist uncertainty across restart.** CLAIMED can become UNKNOWN; UNKNOWN cannot become a fresh CLAIMED execution. Reconciliation may complete the same known outcome with trusted proof while the original completion authority remains valid. Database unavailability or claim/SDK/completion ACK loss must report unknown; never infer ABSENT or replace identity. An unresolved row never remints a run, attempt or grant, including when the caller did not receive its initial claim ACK.
4. **Read exact completed immutable results.** Backend stores only the correlated run/attempt/resultRef+hash against its existing job and looks up that exact identity. A fresh Core retained-result-read decision may allow read after original worker expiry but within the original absolute ceiling; verify current actor/client-wall/policy/cancel and retention/suppression facts first. No worker renewal or new product persistence authority follows. Backend's existing Strategy/version/job beforeWrite/afterWrite receipt and retry-safe Planner materializer remain the only product write owners.

No default TTL, deletion job, claim reaper, lease takeover, retry dispatcher, model adapter, API route, public DTO, provider credential or product write is added by0012. Raw canonical rows contain sensitive source/result data and cannot bypass the canonical authenticated read/suppression owners. Retention integration is a blocking design dependency: preserve identity/unknown tombstones and exact result hashes during any approved payload purge; no new trigger should permanently block an already reviewed retention protocol or open an unauthorized deletion bypass. Fable must propose that protocol with the retention owner before SQL acceptance. No production cleanup/purge is enabled here.

Required local PostgreSQL qualification after allocation: independent-client first-claim races; conflicting job/request/run aliases; restart and lost ACK at each boundary; stale fence/version and concurrent completion; exact replays versus changed bytes/ref/hash; original deadline/current cancellation/suppression races; after-expiry retained reads without worker renewal; unresolved claims remaining UNKNOWN; authorized retention behavior and refused wrong-target deletion. Use disposable local PostgreSQL only; no shared migration application or live resources.

## Fable runtime correction sequence and handoffs

This supplements the [existing immutable correction pickup](https://github.com/neo-capiro/meri-greenfield/blob/e6e3016e215126dfaf4cb4aa8ed13cd5a1bee4f7/docs/coordination/reports/DOT-FABLE-PICKUP-ALLOCATION-ADDENDUM-20261015.md); it does not reorder acceptance dependencies or allocate files. Deliver through verified Git pickup/user relay, not an unverified session.

1. Fable fixes retention consistency/recovery/CAS/target/version findings first, with real concurrent local PostgreSQL refusal tests and production purge disabled. These changes establish the suppression serialization needed by future result storage.
2. Fable implements the already-reserved0011 durable S1 issuance journal and issuer full-equality corrections. Prove unique claim before generation, original binding/expiry/facts, protected material reference, restart/ACK loss and UNKNOWN-no-remint.0012 does not replace or overlap that journal.
3. Fable fixes actual S2/S3 trusted startup, authoritative allocation/facts/original expiry, per-entry transport and filesystem ownership/cleanup; then S4 bounded authorization refresh/rotation/close/readiness and actual pinned-SDK compile checks. Shared runtime edits remain serialized under Fable ownership.
4. Fable wires canonical suppression read paths only after retention acceptance. Core separately supplies named workload identity and current delegation facts. The backend first inert intent slice is owner-reported ACCEPT_SOURCE_ONLY at `215d072def7d8449ac94559e4e1a44eabf513276`, tree `a84f38c6b433e20a06a361e8aac48ed26ce3fa6a`; it has no dispatcher or protocol hookup and supplies no Meri runtime admission.
5. After cross-repository contract acceptance, explicit0012 allocation and the above persistence/authority dependencies, the assigned result-store author implements only the approved new SQL/adapter/test files. Any runtime integration file delta is separately enumerated and serialized with Fable before editing. Backend retains native verifiers, document assurance, stable Strategy/project identity and its atomic write owners.
6. Qualification trust-harness corrections remain source-only under the existing review; execution stays HOLD pending exact-script and action-time approval. Freeze product commits before Codex's generated provenance pass. Update only affected proof rows and rebuild the delivery manifest last, preserving historical manifests and unrelated proof rows.

No Fable runtime/shared files or central reservation records were edited for this proposal. Contract publication, this schema outline and source-only Core acceptance do not admit runtime functionality.
