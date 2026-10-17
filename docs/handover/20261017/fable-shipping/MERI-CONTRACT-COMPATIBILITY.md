# Contract compatibility and producer/consumer provenance

Recorded 2026-10-17T01:48:38.429841+00:00. Current shipping owner: **Codex/dot**, per parent. This task compared immutable local Git objects and a frozen vendored package. No AWS/network call, install, build, source edit, cross-thread message, package version change, or immutable-attempt change occurred. Only this report was created.

## Conclusion

**No wire-incompatible DTO, route, status or validator difference was found for the selected frontend-to-Meri surfaces. Frontend consumer 0.1.8 and producer package 0.1.7 are valid distinct facts under the immutable binding plan. No package successor is established as necessary to ship this runtime solely to make those labels equal.** The incomplete producer public-package closure is a real inventory/release-hygiene issue if a complete producer 0.1.8 release is claimed, not a demonstrated failure of the mounted HTTP path. A literal bump would not repair that optional release closure. Linux failure repair and actual paired runtime proof remain the priority.

| Selected source | Exact commit | Tree |
| --- | --- | --- |
| Meri PR #101 | `38f52df94b1738649776792b2a28aac743801c19` | `7980fe7530d6623a2de9a788e150a377aca8201b` |
| Frontend selected PR #60 image source | `e0b47a34d00b8c181420188ed39a1d849e25ec0a` | `a774141d541ae051d1eafe6d50c46215c2ff1ebe` |

Every read used those exact objects, not checkout HEAD or later documentation commits.

The authoritative clarification was also read from frontend commit `6d796834aab693e90a3a052548c4c51a03ebe3c3`, path `docs/non-meri-continuation-20261016/FIRST-CHAT-PREVIEW-BINDING-PLAN-20261017.md`, Git blob `936dc12f1dfe82b297db8ecae6666706878562cc`, 17,615 bytes, SHA-256 `99662ac647ef5a6be3672f0dc489173719ec39cda08a375b38ca1f67ae436b62`. Its section “Meri contract version: consumer and producer are different facts” explicitly identifies the 0.1.8 frontend value as its consumer distribution and permits paired-protocol proof with the truthfully recorded producer manifest 0.1.7. This later documentation clarifies the existing e0 gate; it does not change the qualified frontend image source.

- Meri `packages/contracts/package.json` says **0.1.7**; its own lock says **0.1.5** at top level and `packages[""]`. The private initial-input protocol already declares **packageVersion 0.1.8**.
- Frontend web and the actual exported conversation client resolve the frozen **0.1.8** tarball. Of its **39 regular members**, **34 are byte-identical** to Meri38f's corresponding files; `package.json` differs and exactly **four** initial-input dist artifacts are absent in Meri38f.
- Initial-input release metadata contains **22 provenance source pins**. **21 match Meri38f byte for byte**: all six actual server allocation/facts/journal/store/service/migration files, all six private initial-input modules and the shared public dependencies. Only the release generator is absent. This is a content comparison to embedded provenance, not signed release authority.
- All **five initial-input schema definitions** are equal after exact reference expansion. No caller DTO or backend wire behavior change is indicated by this comparison.

## Frozen frontend distribution and actual resolution

- Tarball: `vendor/capiro-meri-contracts-0.1.8.tgz`.
- Frontend Git blob: `cbd7cd8246fee5feef17a1119dc93e66df06a5a6`.
- Length: **523,664 bytes**.
- SHA-256: `0b0dffa63e19c55a3bc91e0c6b39cd5ad5916c6941ae1ccdc92098ba580d9820`.
- Computed npm SRI, matching both web/client lock entries: `sha512-pu28RP8HPhHPiwYYI3/afGrKXHNjHHkAIxt/qe+Q7mslchnY4kCw55VklF1NnF0ri9NtOBsZtcjOoJRGsSv+XQ==`.

`apps/web/package.json` uses `file:../../vendor/capiro-meri-contracts-0.1.8.tgz`. Lock entries `apps/web/node_modules/@capiro/meri-contracts` and `packages/meri-client/node_modules/@capiro/meri-contracts` are 0.1.8 with that exact SRI. The client's peer is exactly 0.1.8. Its `./conversation` public export points to **`dist/conversation-client.js`**, which was inspected alongside source.

The separate qualification-transport workspace retains a root 0.1.0 lock entry; that is not the web/client's resolved 0.1.8 copy and must not be used to infer their active version.

### Actual static imports

Enumerated from exact frontend `apps/web/src` and `packages/meri-client/src` plus `dist`. Counts are distinct matching files per specifier, not tests or a whole-repository audit.

| Specifier | Files | Evidence |
| --- | ---: | --- |
| `@capiro/meri-contracts` | 7 | existing export and matching public payload bytes |
| `@capiro/meri-contracts/action-application` | 5 | existing export and matching public payload bytes |
| `@capiro/meri-contracts/browser` | 3 | existing export and matching public payload bytes |
| `@capiro/meri-contracts/conversation-application` | 18 | existing export and matching public payload bytes |
| `@capiro/meri-contracts/conversation-history` | 3 | existing export and matching public payload bytes |
| `@capiro/meri-contracts/conversation-initial-input` | 4 | new public export absent in Meri manifest; matching private HTTP owner exists |
| `@capiro/meri-contracts/conversation-input` | 3 | existing export and matching public payload bytes |
| `@capiro/meri-contracts/document-application` | 7 | existing export and matching public payload bytes |

All existing browser/event, action, document, application, lifecycle, history and input runtime bundles, JSON schemas and exported types retain identical bytes. The additive initial-input public subpath is the only new API surface.

## Initial-input caller and mounted runtime

### Frontend

- `apps/web/src/shared/meri-conversations/input.ts:10–13` imports the initial-input metadata/request receiver. Lines 20–25 recognize the fixed allocate path; lines 49–52 and 93–98 enforce its 128 KiB request cap and parse that request.
- `apps/web/src/shared/meri-conversations/proxy.ts:104–109` applies the 128 KiB initial response cap. Lines 139–157 require the native-token gate plus an opaque `Bearer action_session_...` value, then forward that opaque Meri session bearer to the fixed Meri route. The native token is not substituted for the Meri session token in this operation.
- The **actual exported** `packages/meri-client/dist/conversation-client.js:3` imports the initial-input receivers. Lines 160–176 allocate the retained immutable request and validate the receipt against held tenant/actor/conversation/run/selected-client context. Lines 177–199 require allocation proof, call existing input/admit, then submit. The source counterpart is `packages/meri-client/src/conversation-client.ts:147–198`.
- A replay must retain the same allocation. The bridge compares exact binding, scopes, versions, request ID and canonical request SHA against the genuine earlier allocation proof. UNKNOWN, a digest or absence does not authorize acceptance.

### Meri38f

`apps/runtime/control.mjs:19–20` imports the initial HTTP application and **private relative** initial-input protocol. Line 90 composes it with the real conversation service and a deadline bounded to 3 seconds; line 92 dispatches the exact allocation route to it.

`apps/control/conversations/initial-input/http.mjs:6–7` imports the private protocol and `assertInitialInputShape`, **not** the absent public package subpath. Lines 17–25 enforce the fixed POST path/empty query/hash, bearer, media/body bounds and parse the original submit-compatible request. Line 26 calls `service.allocateInput`; line 27 validates the returned allocated response with the private schema owner; line 28 returns JSON 200/no-store/nosniff. Errors use the same private protocol map.

Thus the missing public export **does not itself break the current HTTP mount**. A new consumer trying to import `@capiro/meri-contracts/conversation-initial-input` from Meri38f's published package would fail resolution. That is a real public package defect, separate from a demonstrated HTTP response mismatch.

The private receiver refers to `./generated-validator.mjs`; frontend release metadata describes that as a generator-provided virtual input bundled into the public receiver. The actual HTTP application uses `shape.mjs`/AJV and does not import that private receiver. Missing generation closure cannot be presented as a proven failure of the existing private HTTP path.

## Schema, exported DTO and semantic comparison

| Surface | Matching requirement |
| --- | --- |
| Route | `POST /api/conversations/input/allocate`, JSON, current opaque-session Bearer, no query/hash |
| Allocation limits | 131,072 request bytes; 131,072 response bytes; 3,000 ms maximum |
| Request | The existing canonical input request: requestId, prompt and canonical optional skill/window fields |
| Expected context | Closed tenant, actor, conversation, run and selected client; receipt fields do not mint authority |
| Success | Closed `{allocation,state,created}`; state RESERVED or ACCEPTED |
| Allocation | binding, nonempty scopes, versions, selectedClientId, requestId, inputSha256, requestSha256, allocatedAtMs, expiresAtMs |
| Facts | writerFence 1; matching tenant scopes/policy revision; unique scopes; selected client scope present; safe ordered timestamps |
| Admission | Exact retained request/canonical input hash and deadline; same authenticated context; no allocation drift, ACCEPTED rollback or invalid created/state combination |
| Existing input bridge | WeakMap-backed request/allocation proof; exact binding/scopes/versions/request ID/canonical request SHA join |
| Errors | Same fixed status/code map and NOT_DISPATCHED/UNKNOWN outcomes |

Exported scope DTOs preserve the nonempty tuple constraint. **RuntimeVersions.contracts stays literal `0.1.0`** in the common wire schema. That wire version is distinct from npm distribution version 0.1.8; changing it merely to match the package label would create a new incompatibility.

Only pure private protocol/schema constructors were evaluated in an isolated Node VM without file/network/process capabilities. Inert authentication/bridge-limit metadata supplied the protocol's unused dependencies; schema construction uses schemaId/error codes. No runtime/application module was imported. References were expanded through exact pinned base/input schemas; descriptive annotations were ignored and required/enum order normalized. Validation keywords and values were then compared structurally:

| Definition | Result | Normalized validation-shape SHA-256 |
| --- | --- | --- |
| `ConversationInitialInputRequest` | equal | `5efae2c5af11aa7ebc57312328bc4752a67f0f8faba8e1628b35eaa73c75d168` |
| `ConversationInitialInputExpectedContext` | equal | `a0505ac891c29b1ad8c1477f6a60ef838530b9604f60e0b20df61a8bc0eee4d2` |
| `ConversationInitialInputAllocation` | equal | `9bb6249c67bc6f00ad7010e6442f0d31147ce1ceb5b002666fc4b3499ec03905` |
| `ConversationInitialInputAllocatedResponse` | equal | `b64852e6c2a7a44789abdee60aefeeb027cc90c096df5c8406646c314df5eab0` |
| `ConversationInitialInputErrorResponse` | equal | `207da1071c3ced81154d5de47da29d4860be36d1651aec428859534c4c388bfd` |

The first investigation-only VM probe omitted an inert limits dependency and failed before comparison. Supplying that documented context yielded the five passing comparisons; no source or product assertion was changed.

## Exact producer public-release inventory gap

This inventory does not create a producer=consumer release policy. The frontend binding plan does not require restoring these files merely to ship the matching private HTTP runtime.

Two exports are absent from Meri38f's manifest:

- `./conversation-initial-input`: types `./dist/conversation-initial-input.d.ts`, runtime `./dist/conversation-initial-input.mjs`.
- `./conversation-initial-input/schema`: `./dist/conversation-initial-input.schema.json`.

The manifest also omits initial-input generator/check/type/public-test script wiring. Existing dependencies and Node engines match 0.1.8; no dependency/framework change is implied. The manifest/lock versions are inconsistent at 0.1.7/0.1.5.

| Missing Meri38f artifact / corresponding frontend tar member | Frontend member SHA-256 |
| --- | --- |
| `packages/contracts/dist/conversation-initial-input.metadata.json` | `1b11cbcb262e326a83753ea9a16d5ae0bec560be0f08f04cb726a1e2831a752c` |
| `packages/contracts/dist/conversation-initial-input.schema.json` | `c59dc9fb3c133a08fcf80125a450f6de3186221356e3e05408401b1af2708324` |
| `packages/contracts/dist/conversation-initial-input.mjs` | `321bff8c0333b3a35902d396f6019224d98cc1311848df8c03080ede816c08f0` |
| `packages/contracts/dist/conversation-initial-input.d.ts` | `1b0ae0b0a9de890dbe9561f246e715c3319ee280d8ffed130349b86e522c6f5c` |

Also absent:

- `packages/contracts/generate-initial-input.mjs`; frontend metadata pins **9,127 bytes**, SHA-256 **`4bb75f2c9bda859e8b190f3cd3c1d6854cb64a237d418ad0547fec4cf1350a31`**.
- `packages/contracts/test/conversation-initial-input-public.test.mjs`.
- `packages/contracts/test/conversation-initial-input-public-types.ts`.

The tests are referenced by the frontend tarball's scripts but are not packaged in the npm artifact. The canonical generator/test source and approved release owner still need recovery; nothing was reconstructed here.

## Attestation gap versus source compatibility

`apps/web/src/shared/preview/meri-conversation-route.server.ts:4` pins package version 0.1.8. Lines 41–51 compare configured runtime source/image strings and `CAPIRO_PREVIEW_MERI_CONTRACT_PACKAGE_VERSION` against that literal. Its comment explicitly states those coordinates **do not attest the running service**. There is no live package handshake in this predicate.

The immutable binding plan explicitly defines the 0.1.8 environment value as the frontend consumer distribution. It is truthful for those already frozen consumer bytes even while the Meri producer manifest remains 0.1.7. It must not be weakened to 0.1.7, nor used to relabel the producer as 0.1.8. There is no producer-package-equality requirement established by the selected source or the plan.

The remaining required attestation is the paired runtime proof: exact qualified Meri image/source/digest and mounted allocate/admit behavior, native authentication, compatible request/response/recovery and the actual current deployment. The static correspondence here supports that proof but does not complete it. Missing producer release-generation closure is optional package hygiene unless a separately adopted release policy requires a complete matching producer public distribution.

## Smallest required proof and conditional successor scope

**Leave the current immutable 38f attempt/source inputs exact. Do not bump a literal, patch its archive, reseal it, rebuild it in place or reassign its artifact identity.** No frontend DTO/caller rewrite and no backend wire behavior change is required by the present evidence.

For the unchanged frontend, retain consumer value 0.1.8, record producer package 0.1.7, and qualify the actual paired runtime as the binding plan requires. This comparison does not justify adding package release work to the Linux failure repair. The separately prepared release-closure worktree was not edited by this investigation; package implementation is paused under the parent's latest steering.

Only if a separate release policy requires a complete producer public package 0.1.8, or a future producer consumer actually imports the missing subpath, would a separately reviewed packaging/release successor under one contract owner be indicated:

1. Recover the canonical approved generator (matching the pinned SHA) and initial-input public runtime/type test sources. Reuse the current matching private source; do not introduce a parallel validator or manually recreate generated code.
2. Close package manifest and lock coherently to the reviewed release, including the two exports and generator/check/type/public-test wiring.
3. Generate/restore the four missing dist artifacts through that generator. Require equality to the frontend frozen hashes unless a separately reviewed behavior change is necessary. Preserve all 34 matching existing public members and all 21 matching provenance inputs.
4. Run focused generated/type/public package checks and an isolated pack/export/import/metadata check, recording exact source and release tarball identities. Record caller/server compatibility with bounded evidence; no broad framework or route change is indicated.
5. Record that optional release's source/package/tarball identity without retroactively relabeling the existing 38f source or artifact. The existing frontend field already has its consumer meaning in the immutable plan; do not reinterpret it as a producer installed-package equality gate.

Any successor has its own identity and appropriate qualification decision. This report grants no publication, paid attempt, new image build or deployment authority. The selected frontend e0 artifact can remain exact if supported semantics and its frozen public bytes remain unchanged.

## Exact evidence: main manifests/runtime and frontend callers

Meri at `38f52df94b1738649776792b2a28aac743801c19`:

| Path | Git blob | SHA-256 |
| --- | --- | --- |
| `packages/contracts/package.json` | `a78c60072ca8bf7ba7432fa71b90591cc7667d5b` | `07a14262720d14d4adab4945014d8123298370b359d798b3b7a14308841ad49c` |
| `packages/contracts/package-lock.json` | `551afd0dc26f037db0c5cf240299f707f12ba929` | `418a5af3b8673d9cdd2faed654b0d94586b03afdca4b23a1a7995462686e54e3` |
| `apps/runtime/control.mjs` | `630a078ef848fd1a9f25b3486321937ea770efb5` | `9532183eb85b74804a8aef1ff6db801f9f808346808fbe2b2085e9c28be706af` |

Frontend at `e0b47a34d00b8c181420188ed39a1d849e25ec0a`:

| Path | Git blob | SHA-256 |
| --- | --- | --- |
| `apps/web/package.json` | `7e20a0f6624fb39414407ff15bbc6290212ace01` | `da47a1b4db3aace691f456dd85a26a26a5496cb3c1987177a1b3c58d9996251e` |
| `package-lock.json` | `54234a26fc09b72bfc8c1e7a40964c2189904c1d` | `dbe95f5a8744bd7277fb1631f20e022fea23496db21d65b793a9b33f0e9f004f` |
| `packages/meri-client/package.json` | `a3634e2445d1299382200a5b0afa8f3ecb106e80` | `ebf300c0974fc96ec41375fe85f64a0c10abfbe8b0bd79c7ee6f18fd528d6624` |
| `packages/meri-client/dist/conversation-client.js` | `7f75b6df83bdcfeeafd1ce00ce72b46c706335d4` | `4ccbe9f2bade361c4ca83d847d4f71b029b3e5ed329c20fd866b449d822a12f1` |
| `packages/meri-client/src/conversation-client.ts` | `c9f59c3812ba70fb0605e9ed72478cef9d61b617` | `d42a5a87c3c72c22e3c6f78e8fe417b31de46f1638794c256f0fec72aafe4880` |
| `apps/web/src/shared/meri-conversations/input.ts` | `dd2ee15d4ef6885cd4b64231621627bf95b469d8` | `f90d47b6fe4765c70b5b7f9269327a064a2a1ef71ba85f1a69e9abeac55d4f18` |
| `apps/web/src/shared/meri-conversations/proxy.ts` | `98ea30c279c3244f9d88370d50759e9e085d094b` | `9d5f9d4f37b6cf9c01c7974a1448d7cb0fd24ff674cd6780dba2996898355e3e` |
| `apps/web/src/shared/preview/meri-conversation-route.server.ts` | `51582003c72285a5ead0861d84f6fe5ca74fb72c` | `f2824cdd9d916e98902fc438a9b56f8d585317620c5cd383becdb414faf12d49` |

## Initial-input provenance comparison

Paths are normalized from metadata inside the frozen frontend tarball. Every present Meri input recomputed to the expected SHA; only the generator is absent. There are **21/22 distinct source paths**. Counting the one repeated matching `browserImports` pin yields **22/23 total pin entries**, as the immutable binding plan explains. No individual path result differs between these counts.

| Canonical Meri path | Meri Git blob | Expected/recomputed SHA-256 | Result |
| --- | --- | --- | --- |
| `apps/control/conversations/initial-input-facts.mjs` | `fe979b988ea899cfd6715a849317fadbc1cd9652` | `9190080d3cbcf725b34636b229ff2a9490faeee5b299dfcecb5f1e9a7bd62236` | MATCH |
| `apps/control/conversations/initial-input-journal.mjs` | `b6f8ada5066d00406b80a977db985baa78927cd8` | `aca25a23c131640eb3a1598e62643fbb94eab681d903b6bc0bfe938b858a02bf` | MATCH |
| `apps/control/conversations/initial-input/http.mjs` | `9f22d8dd9072d34dbec60ce1262bf5b01cc8a533` | `b00da086ebacababf988b287d0cde1c76b3007f03382aedae309ffe7f9cf16b3` | MATCH |
| `apps/control/conversations/migrations/0016_initial_inputs.sql` | `7f0373abcd086c4dd984ad31f8646981b8930f22` | `b008b490b744056beafdf94dc1f2c5e52e472c246c1258b90038dd3e95525e27` | MATCH |
| `apps/control/conversations/postgres-store.mjs` | `a4449be9c283fefcfaee80fd379797b418c3d728` | `96002cc66ed5658273af0cd4035e027efaaaa94708e020f28b79c22f1fc355a0` | MATCH |
| `apps/control/conversations/service.mjs` | `a1c4a7fa2c9e9d5e0cde3f05020050ce140aa869` | `5fddf01e3ec47cc1bd5fba40fbd37200ed23f48e7f29669faf51b5cd54367e41` | MATCH |
| `packages/contracts/conversation-initial-input/protocol.mjs` | `31295a759671eae89796d0353e6b854a1420502b` | `92ab9b2752fd6faf27707104435d5427707ee11cc41e946a0934389adf94f1e8` | MATCH |
| `packages/contracts/conversation-initial-input/receive.mjs` | `d14e44e8c3fa2dc71cbffd8f2e57fed3da7bae06` | `bf455fa82f4f4ba29fc5620c9ebefb902d26eb894c3e13e8339dffef4028d264` | MATCH |
| `packages/contracts/conversation-initial-input/schema.mjs` | `dbaac9968d74775a22f27ccbba84ac06fb6558b1` | `c45678d9a9f7eb37215967be7726bf60f48100a6f2a4018347db7144f62c8d8d` | MATCH |
| `packages/contracts/conversation-initial-input/semantics.mjs` | `ceb985d01eddae9a8bc992c08b5904795411cd02` | `809f7a3d07c1e933fdc865f7c9a2c9a87ab553aca158464c5887135eca493c10` | MATCH |
| `packages/contracts/conversation-initial-input/shape.mjs` | `f7d57003ec6b60c411108d90d5369f7a638c13bf` | `40d6163dd5ce4d78347d09415135242dc3ed25b4d2ad6f3bdbdab61b37b2a7b1` | MATCH |
| `packages/contracts/conversation-initial-input/validate.mjs` | `ca257965555b4c481b872d3b766decf3d8cfcaf4` | `9e04f2574ac844eeee19e97b455a872e1774aa4e18dc7244d9912cc0a10861d7` | MATCH |
| `packages/contracts/dist/conversation-application.d.ts` | `2d05c4290e9734ac3e01147945fdf7910a0a6f4b` | `f7e961446b69049cda1b054c695daffc45486da46b3ebf67c6b3a56e875916fe` | MATCH |
| `packages/contracts/dist/conversation-application.metadata.json` | `2d831339891b6f76346f187571bde0435849a72c` | `5bf91bef62e92fbb3f2db936c02986b76926ff108f6908b3bf4e670635d44858` | MATCH |
| `packages/contracts/dist/conversation-application.mjs` | `cfcd39ef7f06805445bd46c0a2878434a2fb7d1d` | `94465895c6a063536cd4de3ce84d6f736e8475890a663ef80e9c5d748992cea1` | MATCH |
| `packages/contracts/dist/conversation-input.d.ts` | `c00a48307802a19bc9ed89eee9159e769b6770eb` | `c23f833922fa41f0c779c75f52a8681f1fcc5cc09ede9ce52b2b0d93f0b359e9` | MATCH |
| `packages/contracts/dist/conversation-input.metadata.json` | `e66706db679e54ecc7868df753f21eca3c143ccf` | `e3c635fbab77b182bb95150590bd45f22bc19f7a31519d9b2a83aa51f7e18d05` | MATCH |
| `packages/contracts/dist/conversation-input.mjs` | `813d05b352fe1f4307b62297f053e0785ea6905e` | `85010997a028bdc2bc086e8b6f71bf16b4f3a6e595cf91b2764b61e76d674cb9` | MATCH |
| `packages/contracts/dist/conversation-input.schema.json` | `d1a362ca9998ea5cd3dae4d98032b39382b6f0c4` | `ac9b1abfa74ea720e090dfdc8b33a3a2a8275a0012c69e693bb4902b07a7f2ad` | MATCH |
| `packages/contracts/document-application/boundary.mjs` | `02dad0cceaaa3b3ccbbd237de8c41bd94fdf5fc1` | `6a82c49b1db426d2435d751eaf754731658ac1d448750e1a8f060fdada869982` | MATCH |
| `packages/contracts/generate-initial-input.mjs` | ABSENT | `4bb75f2c9bda859e8b190f3cd3c1d6854cb64a237d418ad0547fec4cf1350a31` | ABSENT |
| `packages/contracts/meri.schema.json` | `d7b3c22491ae81c5e875243754413aa7d35097e3` | `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b` | MATCH |

## All identical common public payload files

Each frontend tar member maps to the Meri path listed. Member bytes have no independent frontend tracked path; the exact tarball Git blob/SRI binds them.

| Meri path / corresponding frontend tar member | Meri Git blob | Shared SHA-256 |
| --- | --- | --- |
| `packages/contracts/dist/action-application.metadata.json` | `b2106be7f5fb00e9c75118d6aa02f19c032b0931` | `9909cec1f8008a69415d5cca842230eb27e1bb70f419563be3da0da0b9514355` |
| `packages/contracts/dist/action-application.schema.json` | `460861b4bd592f3bbd65e13222ee2ca7ce530b24` | `a44e403281e8404462be8d06ddbb369e175b61e6501e16c8007646d9e74a803c` |
| `packages/contracts/dist/conversation-application.metadata.json` | `2d831339891b6f76346f187571bde0435849a72c` | `5bf91bef62e92fbb3f2db936c02986b76926ff108f6908b3bf4e670635d44858` |
| `packages/contracts/dist/conversation-application.schema.json` | `c8f5da0cea24dc6d04ca84602e03f1e3255328ca` | `76f8a5a12958fcbcc6842f870a22a7ccba1675dd8b19359c2344f5ef2b06ad1b` |
| `packages/contracts/dist/conversation-history.metadata.json` | `3cc968b60834601984d7f608e9d6071786fcbae0` | `3d34fbfa650b80c223c02535ad759f8de46e0ce7164bb65dcc82e6c13409212d` |
| `packages/contracts/dist/conversation-history.schema.json` | `ccbdb513abcac85a084301a395b2ee5b2a236a47` | `64507f94d5b71e5730996ea85054d9310cb6ac92cc3dc5d3c137e8c259fec927` |
| `packages/contracts/dist/conversation-input.metadata.json` | `e66706db679e54ecc7868df753f21eca3c143ccf` | `e3c635fbab77b182bb95150590bd45f22bc19f7a31519d9b2a83aa51f7e18d05` |
| `packages/contracts/dist/conversation-input.schema.json` | `d1a362ca9998ea5cd3dae4d98032b39382b6f0c4` | `ac9b1abfa74ea720e090dfdc8b33a3a2a8275a0012c69e693bb4902b07a7f2ad` |
| `packages/contracts/dist/conversation-lifecycle.metadata.json` | `7fc049492bb81721da280e3a344e759383882181` | `19a9288f085940ac8360ba008e4fe301c0a2db1c4ee4bd5db6f4b6f4d97a1ea5` |
| `packages/contracts/dist/conversation-lifecycle.schema.json` | `c4b865e730ddc3ef633dee4487c0012dd790b08b` | `9ff87dc22a4fb144c1ad48d9b818f829a65053aac7937b83fdabdbff6f11ad4e` |
| `packages/contracts/dist/document-application.metadata.json` | `ed75f244d1f51044ed96923fe2cc97a911af2757` | `60a01c9a1221a3b5ee49b4b06fbd1ec0a3e9f94217de5855088672ddf9a9270e` |
| `packages/contracts/dist/document-application.schema.json` | `f355598b19eb0721165d3a20d9269247ecd11d70` | `712348c7758e7c99c77f2e50d35397038a651a5a312bb9439bdda5bbd44f5c51` |
| `packages/contracts/meri.schema.json` | `d7b3c22491ae81c5e875243754413aa7d35097e3` | `e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b` |
| `packages/contracts/README.md` | `28c27ca8c90468feb61afd1b6a4eebfa928a44e6` | `e91da2a7641e0eaafcbc46142ee330c7fdb95f46b2574c6c45cf460c7114b1ef` |
| `packages/contracts/THIRD-PARTY-NOTICES.md` | `ec61b91441db31faa8b8e8d2c32f131eb0129e6c` | `5c7b0def28c37c7a1855ecc25c6cf3ea61e79dad7c5a1601ad69fc9d7dd361dd` |
| `packages/contracts/dist/action-application.mjs` | `769f743ae9913f5b4f6ba6135234fbaada58d4e9` | `9e824b7f814561ec46aa63b0c31057a8292515a9f0186707bc838fed98eb3534` |
| `packages/contracts/dist/browser.mjs` | `0edfb969fedcd13773c3da2c6c054d256a05ec71` | `3682cd96d10c1cc53f4e4a91845c6da514eda9d524ce8342b89e09ffcc19ae83` |
| `packages/contracts/dist/conversation-application.mjs` | `cfcd39ef7f06805445bd46c0a2878434a2fb7d1d` | `94465895c6a063536cd4de3ce84d6f736e8475890a663ef80e9c5d748992cea1` |
| `packages/contracts/dist/conversation-history.mjs` | `4d25dcc634a818b81f9fcf1eedfb760387fe3302` | `1a1b4b0950ca8c328983d397cbb17730bbe597ddba8140ae82fb59f86a2f790c` |
| `packages/contracts/dist/conversation-input.mjs` | `813d05b352fe1f4307b62297f053e0785ea6905e` | `85010997a028bdc2bc086e8b6f71bf16b4f3a6e595cf91b2764b61e76d674cb9` |
| `packages/contracts/dist/conversation-lifecycle.mjs` | `7befd26db3a9131018b880f601190984ac11b0b1` | `b283901e0006f9a06f4b63f957133cce57914e791fb07bec8c1017a1d4ae149e` |
| `packages/contracts/dist/document-application.mjs` | `7ab3974bce3a473b12236d7643d1b508f766a370` | `4979699706346dc7fe3661ee1fafdc975e041e38a1f59873ea0b4f1795f9efde` |
| `packages/contracts/dist/metadata.mjs` | `ac07aa48b3dd52f80ed243061f770d3528c3e6bd` | `63a4733b40a9671dbca69419d12cae894adca42a9f2ced83cd729ce239e1ef94` |
| `packages/contracts/validate.mjs` | `4211952b7171b927f6b59f02ea0c6ad1da49ed6f` | `bc72b4cbc240e133742350d3dcc7dcd995a426d9dc85439f1886b49aa41c0605` |
| `packages/contracts/dist/action-application.d.ts` | `da6e859f49b92797300fd662e6733338b42f4da1` | `007880126ba782888b0a8411e3c90acd64d1cc0eb530ecb0cb41ff590bd6d762` |
| `packages/contracts/dist/browser.d.ts` | `5791ac15a45bc1cb19817005af1ae4e976ecf0a7` | `638d76071540b340cc8bd7efd728e3847cb22456dc8ec45d8733497792a0ba30` |
| `packages/contracts/dist/contracts.d.ts` | `1273d1adced80d7f6361df242a0f7968f16ca24f` | `e0366e2f5a668e9e14f09e90c175dce53cbec176125aa98a58c878b44fd74fbd` |
| `packages/contracts/dist/conversation-application.d.ts` | `2d05c4290e9734ac3e01147945fdf7910a0a6f4b` | `f7e961446b69049cda1b054c695daffc45486da46b3ebf67c6b3a56e875916fe` |
| `packages/contracts/dist/conversation-history.d.ts` | `9dd07bf6132ba7f2dfc6ee8aba9b784ba0514f41` | `668f9c89df2e71e53a39ec6de163f75eef6c4fc826e3ffc88454ba9f0f250d1a` |
| `packages/contracts/dist/conversation-input.d.ts` | `c00a48307802a19bc9ed89eee9159e769b6770eb` | `c23f833922fa41f0c779c75f52a8681f1fcc5cc09ede9ce52b2b0d93f0b359e9` |
| `packages/contracts/dist/conversation-lifecycle.d.ts` | `c98736a556150674caf04723d5e0e1f5c3c46618` | `1e9ff1c99e8b0d7d7a8ac86fdd275e2785adb5a6d300c095c783317d2c0ff523` |
| `packages/contracts/dist/document-application.d.ts` | `00cb5b8c10cd030d99c0ec42804317763a397ec5` | `1ce1f8f0f8967cbb705732bd9fd0396149cb4266fa0aec26d225d2f7e2a01d31` |
| `packages/contracts/dist/index.d.ts` | `79e6e96d047b3766f91352ec2845765a169059d7` | `b1d45e99574c3834d70354fd973298b5a9b4e76befc11d6e2996c51c70266642` |
| `packages/contracts/dist/metadata.d.ts` | `2d97076985d9cefb8906f31f5c90608942fff8fd` | `63e058d979f30b9807ed9a7c5df2760c06a180bd903ff13daa9c96bfcba78087` |

## Limits and remaining unknowns

- No live HTTP/current-identity/context, real model, stream, saved transcript/reload, database/migration, image or deployment qualification was run. Static source compatibility is not live acceptance.
- The canonical generator/test source commit and full 0.1.8 Meri release approval were not recovered in this task. The generator's exact content hash is known; no network recovery was attempted.
- A compatible request may still be refused by missing composition, identity/client, journal/migrations, deadline/custody, session or deployment configuration. These separate activation gates remain unproven here.
- Public subpath resolution in Meri38f is incomplete, while the mounted runtime uses the matching private implementation. Future imports must not silently switch to an absent public subpath under the unchanged package.
- The frontend version field records its consumer distribution, as the immutable binding plan explicitly states. It does not claim or require producer package equality. The paired live runtime proof remains required.
- Both repositories, source pins, locks, package literals, published artifacts and immutable attempt remain unchanged. This is a private factual report only.
