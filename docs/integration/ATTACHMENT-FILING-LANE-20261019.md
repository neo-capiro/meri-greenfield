# Attachment filing intent lane

Exact base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
Branch: `codex/meri-writes-attachments-20261019`.

## Implementation outline (before coding)

- Reuse the canonical `artifact.file` validators, `save_chat_attachments` command tool interface, current approval owner, durable command executor/journal/budget, fixed Core source and `createArtifactFilingResolver`. No separate write executor, permission issuer or model-driven file loader.
- Add one attachment metadata codec (`artifactFileKind`) for the integration owner's closed command-kind registry. Source refs remain immutable `ObjectReference`s; no model path, URL, attachment id or MIME becomes authority.
- Add an attachment-specific preparation policy adapter that validates actual artifact custody through the existing version store and artifact inspect owner before a proposal is retained or released. It binds original run/tenant/client/conversation/source refs, uses actual immutable filename/MIME/provenance, and performs no registration or filing effect.
- The integration owner generalizes the existing task metadata owner/store and owns shared registry, intent preparation/execution maps, runtime/product ports and catalogs. No migration/lockfile/contract changes in this lane.
- Tests exercise codec normalization and trusted current custody; full preparation and approved execution reuse real canonical owners with explicit stand-ins at policy/SQL/storage/HTTP boundaries. Include scope/destination/bytes/MIME/provenance drift, revoked/expired grants, cancellation, UNKNOWN ACK and duplicate/durable outcomes.
- Original Core chat uploads need an authoritative immutable object/version custody mapping before they can enter `artifact.file`; a read manifest's hash/MIME/attachment ID is insufficient. Preserve that dependency instead of fabricating references.

## Source commits and receiving order

Own source commits:

1. `f1f0df1a8432313f2f24d4bc1e201ef1b518ceed`: attachment-specific canonical metadata codec.
2. `f1633f0e8705a8cea18a8a6b06da5d9526845d9f`: current-custody preparation policy, service composition and offline preparation/approved-execution tests.

This lane tested against three explicitly received shared dependencies. Receive their original commits once, not the local cherry-pick duplicates:

| Dependency | Original commit | Local duplicate on this lane |
| --- | --- | --- |
| Memory codec, needed by closed shared command-kind registry | `300fbcc4e19adc773dc4be8bd52745ab53777724` | `fbce9287` |
| Canonical metadata owner generalized by its assigned owner | `581aa85c9f0c1ff1a0f2ba31fe883a034c53d8a5` (root receiving equivalent `4a062ac4`) | `22575271` |
| Canonical command intent preparation map | `9f72b7c4771c3b0a42d945c0222a2c6496c4aa94` | `5a449f9b` |

The root integration owner should receive the codec, the shared dependencies, the second own source commit, then this handoff/evidence commit. No shared runtime, catalog, contract, native token, policy, lockfile or migration file was edited in this lane.

## What is implemented

`save_chat_attachments@0.2.0` is the selected conversational operation; its action remains canonical `artifact.file`. The worker's `meri_intents` preparation path now has a real action-specific metadata codec and attachment preparation services to compose through the existing shared command preparer. The adapter requires actual immutable `ObjectReference`s and the trusted current client/conversation destination. Models cannot supply a path, URL, MIME, filename, source attachment ID, approval or authority field.

`artifactFileKind('artifact.file')` returns the frozen codec descriptor used by the shared static registry. Its `normalizeCommandInput` preserves both canonical normalized destination arguments and **all exact selected attachments**. Command and proposal integrity validators remain the existing contracts. `ObjectReference.versionId` (native immutable object version) remains distinct from `ArtifactVersion.versionId` (artifact publication version).

`createAttachmentFilingPreparationPolicy` decorates the supplied current preparation policy. It checks current destination-client authority, derives a current artifact read context, looks up each selected object through `versions.findByObject`, and calls the canonical `artifacts.inspect` owner. That owner rechecks current artifact authority/retention and verifies current exact bytes and publication metadata. The policy adapter compares the full selected reference, actual tenant/conversation, exact source scopes and verified byte digest/size, then rereads current policy before metadata release. Source scopes stay distinct from the destination-client grant. Filename, MIME, producer binding and evidence remain properties of the immutable source version; they are not synthesized from the model's selectors.

`createAttachmentFilingServices` composes that policy with the existing generic approval metadata owner/PostgreSQL store, canonical command tool interface and shared prepare-only intent adapter. It accepts the existing approved executor as a borrowed dependency; preparation cannot call that executor or register/file an attachment.

### Composition API

```javascript
createAttachmentFilingServices({
  metadata: { pool, preparePolicy },
  commandContext: { binding, destination: { clientId, conversationId } },
  custody: { artifacts, versions, readContext },
  executor,
  now,
  newId,
  limits: { maxRequestMs, maxFactBytes },
});
// => { commandOptions, commands, preparer }
```

All parameters are trusted composition inputs. `artifacts` supplies the canonical `inspect`; `versions` supplies the canonical `findByObject`; `readContext` supplies a current artifact context for the actual actor, source scopes and destination. `executor` must be the existing governed command executor whose source uses `createArtifactFilingResolver`, the real registration owner and `createCommandHttpSource`. No connection, lookup, registration, SQL statement or provider call occurs on constructing these new modules. Borrowed resources remain caller-owned.

## Existing execution and Core boundaries reused

The existing approved execution path is unchanged: `commands.executeApproved` rereads immutable metadata and current custody, then the command executor checks the current approval/capability/source authority, claims the durable journal and reserves the canonical budget. Only then does the existing filing resolver download the exact selected artifact bytes and ask the trusted attachment registration broker to register them for the exact destination. It reinspects all sources before releasing an attachment mapping. The fixed source request is `POST /api/clio/tools/save_chat_attachments` with `{clientId,conversationId,attachmentIds}`. `source-projection.mjs` correlates every returned attachment ID to its selected immutable reference and preserves pending/failed/indexing/extraction observations.

Core source inspected at `neo-capiro/capiro-backend@138c04373b18bb730b1ad0f8f9338342f628b8c6`: `apps/api/src/meri/meri-tools.service.ts`, `saveChatAttachments`, delegates to the established `clientFiling.saveAttachments` owner after current client visibility checks. No alternate filing endpoint or provider was introduced.

Lost metadata, registration and filing acknowledgements retain UNKNOWN liability. A repeated SDK delivery is never prepared anew; an execution replay reads its durable outcome/indeterminate state and never registers/files again. Cancellation/suppression after registration prevents success release and preserves uncertainty. A source `saved` result can still have `indexingStatus:'pending'`; pending source results remain aggregate indeterminate.

## Production dependencies: deliberately still held

| Dependency | Actual state / owner required |
| --- | --- |
| Native approved attachment capability and receiver | Meri `native-authority/execution-capability.mjs` and Core `meri-execution-capability.ts` admit `task.create` only. Core `meri-execution-receiver.service.ts` also defines `MERI_EXECUTION_TOOL='create_task'`. The attachment action needs a reviewed exact source-body/object/destination/token contract and native receiver from dot; this lane does not broaden those enums or fall back to ordinary bearer execution. |
| Native conversation approval execution route | `APPROVABLE_ACTIONS` in `intents/approval.mjs` stays task-only while the actual Core record/issuance contract lacks attachment support. Offline tests invoke the existing generic approved executor with explicit synthetic current approval/issuance facts, not a fabricated production token. |
| Trusted source registration owner | The artifact filing resolver's `attachments.register` port must be supplied by the actual authenticated host/Core owner, retaining exact object/version/hash/size, filename/MIME, original provenance, actual actor/tenant/conversation and selected destination. The new services add no fake registration broker, credential or live source authority. |
| Original chat-upload custody | Current Core attachment reads expose source attachment ID, original byte hash/size and MIME but no verified immutable `ObjectReference`/native-version mapping consumable by the artifact version owner. The current canonical filing resolver resolves generated artifact publications only. Original uploaded attachments need a genuine current custody adapter before they can enter this command; the read manifest alone cannot establish it. |
| Product startup and current metadata/artifact policy | Root owns mounting the new services only when the actual current policy, artifact context/servability, metadata database and governed executor/registration owners are available. No availability flag or production installation was changed here. |

The production worker/catalog row must reflect these current native/custody dependencies; the older reason saying only the metadata codec is missing is stale after receiving this lane. That shared row remains the integration owner's file.

## Verification

Exact source tested: own source through `f1633f0e8705a8cea18a8a6b06da5d9526845d9f` plus the shared dependencies above. Node `24.19.0`; existing exact root dependencies were borrowed read-only. No packages, locks or executable permissions changed. New modules are ordinary ESM; the focused tests import and execute them. No TypeScript source changed, and the integration owner retains affected shared type/build checks.

Final focused command:

```bash
MERI_REVIEW_SOURCE_ROOT=/dev/shm/meri-writes-attachments node --test --test-reporter=tap \
  apps/control/intents/test/attachment-filing-execution.test.mjs \
  apps/control/intents/test/attachment-filing-preparation.test.mjs \
  apps/control/commands/approval-metadata/test/artifact-file-kind.test.mjs \
  apps/control/test/commands-filing-custody.test.mjs \
  packages/contracts/test/command-artifact-file.test.mjs \
  packages/contracts/test/commands-execution-independent-filing.test.mjs
```

Result: **63/63 pass**, zero failed/skipped/cancelled. This includes 27 new codec/custody/preparation/execution cases and 36 existing focused filing/contract cases. Scrubbed output: `attachment-filing-evidence-20261019/focused.tap`, SHA256 `da5023605b40f922f391e380fc1a65772f96d80340f68acdda2783c76ff535b0`. `git diff --check` passes. The preparation policy and service composition are 85 and 30 lines respectively; no second metadata engine or executor was created.

The tests run real canonical artifact inspection/byte checks, metadata codec/store, intent replay/release/worker prepared-result validation, current approval guard, durable budget and command journal/executor, filing resolver, source/result projection and command validators. Their policy facts, registration service, SQL protocol, immutable object storage and HTTP response are explicit offline stand-ins. They establish source integration behavior, not native PostgreSQL/S3 concurrency, image qualification, real Core authentication/receiver admission, live attachment custody or end-user chat verification. No live database, deployment, provider, paid call, source mutation or external message occurred.

Initial focused test failures were fixture defects: the TXT inspection omitted its required `encoding`/`whitespace` details; a fixture parameter shadowed its local policy variable; and a cancellation assertion ran before the existing bounded asynchronous cleanup had its next event-loop turn. The fixture/observation timing was corrected, original UNKNOWN/no-duplicate assertions retained, and no production guard or executor was weakened.

## Every own changed file

- `apps/control/commands/approval-metadata/artifact-file-kind.mjs`
- `apps/control/commands/approval-metadata/test/artifact-file-kind.test.mjs`
- `apps/control/intents/attachment-filing-preparation.mjs`
- `apps/control/intents/attachment-filing-services.mjs`
- `apps/control/intents/test/attachment-filing-fixture.mjs`
- `apps/control/intents/test/attachment-filing-preparation.test.mjs`
- `apps/control/intents/test/attachment-filing-execution-fixture.mjs`
- `apps/control/intents/test/attachment-filing-execution.test.mjs`
- `docs/integration/ATTACHMENT-FILING-LANE-20261019.md`
- `docs/integration/attachment-filing-evidence-20261019/focused.tap`

Receive these source slices and root-owned maps into the separate conversational-write review branch. Do not merge them into PR189/the read branch, the frozen image-build candidate or PR175; do not activate/deploy an unqualified native attachment write path.
