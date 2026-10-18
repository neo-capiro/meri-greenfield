# Audit repair verification and follow-up

The user authorized closure of all nine reproduced audit findings. Overlapping implementation lanes have stopped. The accepted receiving checkpoints are Meri PR179 `141f2ada6378382f2bf7462d8a2c5dc7758230d0` and frontend PR97 `a0a542d5eff162bef572564ff0397e460d74ed77`. PR175 remains unchanged at `993f52a97e5d9edcf65c9f89423c097aa52831c7`. These are committed source, not deployed repairs.

## Implementation outline and ownership

Review and reuse the seven existing backend fixes and the two existing frontend fixes before editing. Work in dedicated follow-up branches and preserve all source and release holds. No schema migration, external authority, deployment or new model loop belongs to this task.

- Lifecycle owner: verify Stop's durable-fence readback and natural successor completion through the actual continuation authority, preserving cancellation, revocation and lost-acknowledgement refusals.
- History owner: verify suppression after Core currentness and after the final awaited membership check. The generic product HTTP owner may invoke a bounded domain release check; history retains ownership of subject-specific retention decisions and filtering.
- Mail and memory owners: verify fresh decisions and recording timestamps do not reject identical continuation pages, while stable identity, scope, content, expiry and accounting remain bound.
- Selected skill owner: verify actual SDK structured-output options and the two supported canonical compilers together.
- Artifact owner: verify immutable version metadata selects Word or Excel for successful readback, with publication, retention, tenant, actor, conversation and scope checks intact.
- Frontend owner: preserve the committed transient recovery and first-ACK clearing changes; repair expiry/reconnect draft lifetime without changing request identity or discarding newer edits.

Each owner has exclusive affected paths. The integration owner commits and publishes the reviewed final diffs, independently reruns meaningful regressions, and records existing baseline or environment failures separately. Verification uses disposable local fixtures; it does not establish live provider, database, image or release qualification.

## Verification record

| Original finding | Independent disposition |
| --- | --- |
| Suppressed saved history | PR179's mid-Core fix passes. The follow-up closes the remaining awaited final-membership gap: a bounded history-owned release check now runs after membership. Three new HTTP cases failed before the change and now withhold transcript/turn results or filter the suppressed list row. Pending release deadline/cancellation preserves `RESULT_NOT_RELEASED` and never repeats admission. |
| Transient failure replaces conversation | PR97's fix is retained. Its browser regression passes alongside the expiry/reconnect follow-up. |
| Stop loses cleanup after committed cancellation | Existing PR179 event-ID fence readback is verified: lost acknowledgement plus revoked session attempts both cleanup owners; the uncommitted negative attempts neither. No new Stop implementation was added. |
| Fast natural successor completion | The journal-only repair was incomplete through the production authority and context composition. Four real-composition resume/fork × completed/failed regressions failed before the follow-up. Canonical authority now verifies a persisted DISPATCHING/APPLIED control naming the exact target; transition context checks that target without selecting/admitting a new turn. Generic authority, new admission, retirement and cancellation remain restricted. |
| Mail pagination under fresh decisions | Existing PR179 fix verified: both pages settle with rotating decision IDs; stable identity/scope/policy/binding/filter/anchor checks remain exact. A stale relevant regression fixture now supplies the required trusted invocation and signed-source receipt, preserving its original malformed-page/revocation assertions and adding explicit missing-invocation refusal. |
| Repeated memory proposal pages | Existing PR179 fix verified through the real gateway context and scripted durable journal. Later recording time alone is permitted; original durable bytes remain intact and backdating/content/expiry/scope changes refuse. |
| Selected skills omit SDK structured format | Existing PR179 fix verified against the pinned SDK's actual `--json-schema` serialization and both canonical compilers/pending-output journals. All unsupported skill/version assets refuse before native preparation. |
| XLSX read selects Word descriptor | Existing PR179 fix verified by real local Python-generated DOCX/XLSX through canonical publication/retention, Core authority and runtime HTTP inspect/download/preview. Malformed bodies, suppressed/unpublished metadata and foreign conversation custody refuse. |
| First prompt remains in composer | PR97's ordinary first-ACK fix is retained. The extra expiry/reconnect failure is fixed in the paired frontend follow-up: capture/edit state now shares the conversation draft's lifetime rather than the replaceable live-session view. |

The final combined backend run passed **585/585 tests across 25 files**, covering all seven backend findings and the follow-up composition/refusal paths. Independent focused reviews also passed mail 262/262, memory 82/82, selected-output 20/20 and history/product release 73/73; these overlap the combined run and are not additive counts. Node syntax and whitespace checks passed. The directly related authority expiry test now uses the existing injected clock, retaining an exact bound instead of relying on two separate wall-clock reads.

History and user-preferences provenance were regenerated with their existing generators. User-preferences regeneration initially selected the canonical backend, producing unrelated bundle/type formatting drift; those uncommitted outputs were restored and regenerated using the recorded Rolldown 1.2.13/TypeScript 5.9.3/json-schema-to-ts 3.1.1 backend. Only the two metadata source fingerprints changed; browser JavaScript, types, schemas and wire versions are unchanged.

The frontend follow-up independently passed **12/12 browser cases**, **58 focused unit cases** (plus root's independent 54-case run), TypeScript with a 6 GiB heap, scoped lint/format and architecture. Its production build generated **283/283 pages**. Exact PR97 live-component source failed the new expiry/reconnect regression in a temporary harness before repair. The paired frontend report records environment-only browser download/default-heap failures and the isolated test-browser workaround.

## Remaining baseline and release limits

The backend standard `npm run check` is still red: **4,357 passed / 32 failed / 4,389 total**. These remaining failures are outside the nine repaired behaviors: 23 independent action-flow fixture refusals, five obsolete package-patch expectations, the pre-existing initial-input source-provenance mismatch, one VM-module harness option, one timezone-dependent expectation and one obsolete task URL expectation. The new history provenance mismatch observed during development was resolved by canonical regeneration. No assertions were weakened to turn these baseline failures green.

Runtime and conversation-control typechecks still report the receiving branch's **3 and 18 diagnostics** in unchanged worker capability/egress files. A fresh control check initially had additional missing Node-type diagnostics because this disposable worktree lacked its development type resolution; linking the lock-matched Node types restored the known 18-error baseline. The broader selected suite still has two legacy unsigned-source fixture failures, and the broader artifact preview suite has an existing UNKNOWN-claim retry expectation failure. These do not establish green release gates and are not silently omitted.

All evidence here is local source/fixture verification. The stronger cross-owner atomic retention serving fence documented by PR179 remains a separate architectural limit; this follow-up closes the reproduced awaited authorization windows. No new source activation, migration, native build, main merge, provider request, live SQL, credential change or deployment occurred. PR175's shipping source remains unchanged. The existing deployment owner must qualify exact successor image/configuration and authenticated live behavior before release.
