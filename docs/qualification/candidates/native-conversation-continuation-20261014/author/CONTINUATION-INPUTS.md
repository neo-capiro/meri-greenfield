# Existing continuation inputs and ordering

Exact base: PR81 `480944bae488932ab5dea5452d2d3dbdcb04a755`. This slice mounts explicit borrowed owners through the existing closed runtime product ports. It creates no authority issuer, allocator, approval decision, journal, or new public contract. The companion test exercises the actual control application, session issuance, lifecycle service, journal, and Temporal dispatcher over scripted SQL and explicitly synthetic current identity, admission, approval, checkpoint read, and Temporal infrastructure. It does not qualify physical retirement or real target allocation.

## First chat and later operations

First chat uses the already approved fixed candidate binding. Existing current identity/context establishes tenant, actor, selected client and scopes; opaque session issuance and public submit persist the queued first run. Temporal and prepared kickoff subsequently use the existing task allocation, admission, runtime, SDK, mirror and checkpoint owners. First chat requires neither `nativeAdmission.admit` nor an approval decision.

The parent frontend PR39 `useConversationActions` surface is history, submit, retry, cancel, stream and reconnect. It does not itself select a resume/fork target, issue authority, or prove multi-run ownership. A different request ID on the same fixed candidate run is not an automatically admitted later run; existing submit replay checks and active-run steer are separate contracts. This owner mount must not be reported as genuine end-to-end conversation acceptance.

## Canonical resume/fork flow

The canonical owner remains `apps/control/conversations/lifecycle/service.mjs`, with persistence under the existing conversation store's lifecycle journal. Control first verifies the current opaque session and saved tenant/actor/client/scopes/versions, reads the retained immutable checkpoint proof, and durably enters `DISPATCHING`. Effects recheck current authority. Waiting-for-approval resume additionally verifies the existing proposal and current decision through the supplied `approvals.read` and `approvals.readDecision` methods.

Resume calls the borrowed retirement owner first:

```js
retire({controlId, binding, checkpoint, signal})
// exact receipt:
{binding, retirementReceiptId, expiresAtMs}
```

The receipt must match the original source binding, have a UUID receipt ID and future expiry. The real owner must establish original source retirement; a fixture UUID is not evidence of capability revocation or physical process/resource absence. Fork does not retire the source.

Both modes then call the borrowed admission owner:

```js
admit({controlId, mode, sourceBinding, checkpoint, checkpointSha256,
       request, scopes, selectedClientId, versions, signal})
// exact receipt:
{binding, scopes, selectedClientId, admissionReceiptId,
 targetSessionId, expiresAtMs}
```

These are server-owned source request, current exact scopes/client, versions and immutable proof inputs. Target binding must preserve tenant/actor, have fresh run/attempt/worker IDs, and satisfy the existing lifecycle receipt validator. Resume retains the conversation, increases the writer fence and uses `targetSessionId:null`; fork has a different conversation and a fresh session ID distinct from the source checkpoint session (the qualification fixture uses fence 1). Admission scopes and selected client must exactly match the canonical source authority, and its expiry must be future.

Only `journal.continuation` then inserts the queued target conversation/run/request/event and persisted continuation envelope. It retains the source request, source proof/hash, admission and retirement correlation. The existing Temporal dispatcher starts that exact target binding. Resume subsequently signals the source workflow with `{controlId, sourceRunId, targetRunId, admissionReceiptId, retirementReceiptId}`. The lifecycle marks the control `APPLIED` after successful effects. An uncertain or refused effect after dispatch begins leaves `UNKNOWN`; replay does not redispatch. No target SQL row is created when retirement/admission fails before the journal insertion.

## Actual target ordering constraint

`apps/runtime/native-authority/task-allocator.mjs` and `preallocation-authority.mjs` require an existing canonical queued target run for allocation authorization/journal claim. Lifecycle `admit` currently runs **before** `journal.continuation` inserts that target. Consequently wiring `admit` straight to actual allocation cannot satisfy the current ordering. A caller must supply a genuine preallocation authorizing owner that approves exact target binding/plan without claiming an already accepted live ARN or grants; actual allocation/admission must follow the canonical queued insertion. Alternatively a separately authorized canonical lifecycle ordering change is required. This slice supplies neither a fabricated target row nor a stand-in ARN, and does not implement or qualify that real decision owner.

Existing `createNativeAllocationAdmission` admits grants/budget only against the actual qualified target task identity. Existing `createNativeTaskAllocator.stop` can retire the original canonical task with its original allocation record, exact task/resource proof and grant set, retaining actual revocation and physical retirement ownership. No such resource effects were executed here.

## Later target configuration remains explicit

The existing `apps/runtime/prepared-candidate-config.mjs` closed `nativeCandidate` configuration requires:

- Fresh target `identity` context, exact `runtime` binding/versions/proxy/model/deadline/budgets, and `proxyCredentialFile`.
- The approved `plan` and `preparationIntent`: workspace/config/storage directories, exact launch template, executable/image/runner/SDK-options/authority hashes. These must compile to the same target original tuple; task-local SDK preparation preserves the actual generated configuration path.
- Exact target `allocationJson`, qualification attempt/policy revision, `grantIntents`, selected `grantId`, supported operations and existing distinct task/control capability file bindings.
- Approved `taskRequest` cluster/task definition/private network/container overrides, `containerName`, `taskOrigin`, `taskHttp`, and immutable `objects` bucket/prefix/owner/key configuration.

These are configured trusted inputs, not frontend hints. The real fresh target identity/controller/approved resource plan and preallocation decision still need binding by the composition caller. Source task capability expiry cannot authorize a target, and an expired source bearer is never repurposed. Existing backend `/api/clio/application-authority/identity` and `/context` contracts remain unchanged; this report contains no foreign backend source.

After target insertion/allocation, `native-authority/continuation-runtime.mjs` joins current target admission with persisted lifecycle execution; `native-restorer.mjs` uses the canonical restorations journal and immutable object readback plus the task workspace port. Existing supported SessionStore snapshots remain the opaque session representation. Restored bytes do not establish target registration: independent native process observation remains the witness before canonical SDK mirror registration. Approval, restoration, allocation, capabilities and SQL each retain their existing owner.

## Focused qualification

`apps/runtime/test/lifecycle-continuation-mount.test.mjs` verifies exact source proof/scopes/versions/control input propagation, resume retirement-before-admission, canonical target persistence before Temporal dispatch, fork source preservation, supplied approval decision ordering, uncertain/refused effects and lost Temporal ACK replay containment. The pool and external owners are scripted; no real RunTask, SDK Query, provider, AWS, new credentials, security change or deployed acceptance is claimed.
