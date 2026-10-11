# SDK interruption fixture channel

This private source contract describes the bounded W02/G1 interruption/replacement qualification spike. It is not a public package/version freeze. Import `packages/contracts/qualification-sdk/validate.mjs` directly within the repository; existing 0.1 package exports, distribution, schemas and retrieval contracts are unchanged.

Every receipt uses profile `sdk-interruption-fixture-v1`, `completeRecoveryCheckpoint:false` and `sessionStoreQualified:false`. Coverage is the declared native transcript tree plus one synthetic workspace file, `qualification/continuity.txt`. This receipt is not the product `Checkpoint`. Full W05 SessionStore, workspace/quiescence recovery and W09 integration remain required at their planned gates. A valid source contract does not prove that even this partial fixture was durably committed or recovered.

## Canonical owners and identity

The new schema owns only qualification-specific shapes. Public 0.1 `RunBinding`, `ObjectReference` and `WorkspaceManifest`, canonical hashing and workspace path validation are reused unchanged. `IdentityMapping` explicitly connects the qualification ECS task ARN/integer attempt to canonical UUID attempt/worker IDs; no cast equates them. The trusted issuer supplies mapping/grant IDs, admission/expiry, tenant/actor/conversation/run, policy digest and fence. This fixture restricts task ARNs to account `967807252336`, region `us-east-1`, and fences to the existing qualification signed-int range. Attempt 1 is interruption and attempt 2 is replacement/resume.

The native namespace binds the actual SDK init session ID, `/workspace/conversation` and its project key. The qualification run UUID is distinct from that session ID. Source commit, exact image digest, SDK 0.3.295, CLI 2.1.295, public contracts schema hash and skills-manifest hash remain constant across replacement. The original producer is retained verbatim in every receipt; replacement has distinct task, grant, mapping, canonical attempt and worker, a higher fence, and admission after the trusted commit.

## Fixed operations

All requests and responses carry the closed protocol/profile, fixed operation, request ID and complete context. No worker-selected storage URL/key or arbitrary operation is accepted.

| Operation | Additional request data | Successful response |
| --- | --- | --- |
| `authorizeFixturePhase` | None | `AUTHORIZED`, or explicit `DENIED_STALE_BINDING` with the distinct fresh current replacement context |
| `commitFixtureCheckpoint` | Original-phase native bundle, sentinel and init/interrupt/exit/drain evidence references | `COMMITTED` receipt |
| `loadFixtureCheckpoint` | Trusted expected receipt ID/hash | `LOADED` receipt and exact bundle/sentinel bytes |
| `verifyFixtureCheckpoint` | Trusted expected receipt ID/hash plus restored bundle/sentinel | `VERIFIED` receipt |

`assertFixtureRequest` validates a request at caller-supplied trusted `nowMs`. `assertFixtureResponse` additionally requires the trusted original producer. Load/verify require a fresh replacement context and the previously trusted receipt identity. `assertFixtureReceipt` requires both trusted expected producer and receipt identity; deriving both from the same untrusted response proves no authenticity. `fixtureReceiptIdentity` calculates correlation data only.

Response validation returns status strings. Only the explicit, validated stale-binding response returns `STALE_BINDING_DENIED`; errors, malformed/foreign/expired data and unknown outcomes throw fixed errors. Its decision timestamp must be at or after the named current replacement's admission. A caller must never convert every exception to a false authorization witness. The 30-second decision-age bound is a protocol check, not measured continuous revocation evidence.

## Bytes, clocks and declared coverage

Original D is T0 + 720,000 ms and C is T0 + 900,000 ms. Current operations must occur before D and before their admission expiry. An expired original producer may remain historical provenance, while its commit must have occurred during its valid admission. Replacement cannot reset either clock.

The native bundle uses the existing `meri-native-session-files-v1` shape. Main session JSONL is first and nonempty; declared descendants are session-specific. File contents are canonical base64 of verbatim raw bytes, with exact size/hash; unknown transcript and compaction fields are preserved. Paths are a deliberately supported portable subset, with explicit parents and no duplicates, traversal, device aliases, ancestor-file conflicts or foreign session names. Unsupported layout is refused.

Bounds are 256 native files, 512 total native members, 12 path components, 8 MiB per native file, 32 MiB aggregate native bytes, 48 MiB canonical bundle transfer and 64 KiB sentinel. Stored bundle references bind the complete canonical JSON bundle bytes/hash, not just transcript hashes. The workspace manifest has exactly one non-executable sentinel and the original producer binding. Immutable object ID/version references and tenant/policy scopes are reused; bundle readback and workspace readback digests must agree.

The object validator rejects nonfinite numbers, cycles, accessors, non-JSON prototypes, sparse/extended arrays and excessive traversal. It accepts already parsed objects. A future transport must separately enforce bounded raw bytes, strict UTF-8 and duplicate JSON-key refusal before parsing. Receipt-only metadata validation is not complete object-byte verification; commit/load/verify payload checks and trusted service rereads supply that additional boundary.

## Required trusted implementation

The gateway/store must authenticate the real peer, current run/grant/fence/policy and operation audience independently of request fields. It must read and validate actual native init, interrupt, process-exit and drain evidence; their object references alone establish none of those facts. It must establish required fixture quiescence, persist and reread exact immutable bundle/workspace versions, and atomically publish under the current trusted fence. A late producer cannot publish after replacement admission. Contract fields, booleans, hashes and publisher names cannot manufacture authorization, durability or quiescence.

No endpoint, storage implementation, authority ledger, schema migration, SDK loop or SessionStore is supplied here. The existing interruption driver and native-file adapter still require a separately reviewed thin mapping/channel integration and a real bounded two-task native experiment. Security, image admission, original-deadline containment and physical cleanup remain owner gates.
