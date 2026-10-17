# Native mode safe-stop review — 2026-10-17

**Final candidate: HOLD_TESTS / INCOMPLETE.** This is a read-only source/handoff review followed by this report only. The latest reader/owner lifetime correction and updated tests have **not run**. Earlier source acceptance and passing captures apply to their recorded bytes; they are not a combined pass for this snapshot. Neo's safe-stop remains in effect. No source, test, registry, metadata, ledger, dependency, startup or Core file was changed by this review, and no tests, build, install, stage, commit or live call was performed.

The Meri source is above public PR125 commit `6968836486738cab4ba62a39e799356914cd7c85`, tree `aa31607522e34df3bca96b9e381caae0d599d398`; its tree-identical local base is `4359e05bd11b7756d4f1d42fcd2243b3e07f126b`. The separate Core mode source starts at PR59 commit `59efe08f2f3429918758eef30539e9dde4dbb868`, tree `c2babd8e0d386b1c9f18ed32ebcd4472d5ebf486`. These bases do not establish publication or installation of the new endpoint. Hashes below identify the reviewed working-source snapshot without requiring a local-only Git object.

## Current interface and protocol

The finite operations, each version `0.2.0`, are `search_federal_grants`, `search_federal_awards`, `search_program_elements`, `get_program_element` and `get_pe_budget_timeline`. Modes remain the three distinct values `off`, `shadow` and `enforce`. No mode is inferred from a result, and shadow does not collapse to off.

- `createReadModeObservationReader({available,origin,fetchImpl,authorityClient,now,maxRequestMs})` returns `readModeObservation({credential,serviceSecret,operation,requestSha256,deadlineMs,signal?})`.
- Fixed route: `POST /api/clio/application-authority/read-mode-observation`. Closed body: `{operation:{id,version},requestSha256}`. Closed native response: `{operation,requestSha256,principal:{tenantId,actorId},surface:'chat',evidenceAccuracyMode}`.
- The fixed HTTPS origin, native Bearer token and internal service secret remain trusted configuration. No caller header/origin override, cookie, redirect or cache is admitted. Response decoding remains bounded to 4096 uncompressed strict UTF-8 JSON bytes. The reader brackets this request with actual identity reads and requires matching principal and identity revision.
- The local frozen projection remains exactly `{principal,identityRevision,operation,requestSha256,evidenceAccuracyMode,checkedAtMs,expiresAtMs}`. Its assertion API is now `assertNativeReadModeObservation(value,{started,now,operation,requestSha256,deadlineMs})`, with the original caller deadline explicitly required for correlation. It is a local observation, not a grant, issuer receipt, resource revision or source qualification.
- The private `x-meri-read-observation` carrier retains schema version `meri-native-read-observation/1`, canonical JSON/base64url admission, the 2048 decoded-byte bound, exact operation and canonical SHA256 of the original unnormalized flat tool request. Only these five arms use the closed `{evidenceAccuracyMode}` context. Funding five and semantic KB retain their `{asOf}` arms. Public retrieval schemas and native result receiving are unchanged.

Core's new controller uses the existing current membership owner, actual matched internal-service identity and request deadline latch. Observe-only service-guard admission does not establish the required matched-service marker. The consuming producer checks the actual authenticated tenant/chat enum against the expected enum before domain I/O and uses that captured actual value throughout the call. Ordinary calls preserve their earlier sampling points. This source design does not establish that any deployed server supports or consumes the protocol.

## Latest lifetime correction — source reviewed, tests UNRUN

The initial reader copied the client-reference reader's additional three-second local fact lease. The minimal mode proposal instead preserves existing identity, membership and invocation lifetimes. The current source separates these responsibilities:

| Boundary | Current source behavior |
| --- | --- |
| HTTP lifetime | Still `min(original caller deadline, began + maxRequestMs)`, with `maxRequestMs <= 3000`; first and second identity expiries can only shorten remaining I/O. No HTTP timeout was increased. |
| New server deadline header | Fixed `x-meri-deadline-at: String(cutoff)` on the mode POST, using the HTTP cutoff after the first identity observation. Core's existing latch consumes it before membership I/O and caps it by its own 30-second maximum. The second identity is read afterward and cannot retroactively determine this header. |
| Local observed fact | `expiresAtMs = min(original caller deadline, first identity expiry, second identity expiry)`. The HTTP timeout is not an extra mode lease. The closed projection validator rejects expiry beyond that explicitly supplied caller bound. |
| Native credential owner | Passes its actual current outer cutoff, rather than `min(cutoff, started + 3000)`, to the reader and projection assertion. Current task/native bounds still shorten that cutoff. The first captured resulting expiry remains pinned; later observations cannot renew it. |

The existing owner still rechecks task admission immediately before the private mode-secret getter, after that await, after mode observation, around normalized source-secret acquisition and at result observation. Principal, identity/membership revisions, operation, original request hash, mode and current task selection remain correlated. The native producer still compares actual mode before source work. There is no new configuration epoch or mode authority, and no claim that a deadline physically cancels or rolls back SQL/provider work.

Static inspection found the latest delta consistent with this reviewed direction. Updated reader assertions cover the server-header cutoff separately from the later fact expiry. Updated owner cases retain first-expiry pinning and add a source advancing the synthetic clock by 3500 ms while staying within the existing native/operation lifetime. Those five source-over-three-seconds cases, the changed reader tests and the changed owner tests are **UNRUN**. There is no fresh acceptance for their bytes.

The earlier [reader author report](CODEX-READ-MODE-READER-20261017.md) records the old three-second fact-lease design and original freeze hashes. Its statements about those hashes being final do not apply to this snapshot. The old test title mentioning a three-second local projection lifetime is also historical wording; the current assertion is caller-deadline-bound. This report supersedes that interpretation without altering the retained report or evidence.

## Retained checkpoints and unresolved checks

| Evidence | Recorded outcome | Meaning at this safe-stop |
| --- | --- | --- |
| [Reader/Core-client initial metadata](read-mode-reader-20261017/read-mode-initial.json), [stdout](read-mode-reader-20261017/read-mode-initial.stdout.txt), [stderr](read-mode-reader-20261017/read-mode-initial.stderr.txt) | **109/109 passed**, exit 0 | Original reader `19b1a220…`, before the server-header/fact-expiry correction; not a current-reader pass. |
| [Owner initial metadata](native-mode-20261017/mode-owner-initial.json), [output](native-mode-20261017/mode-owner-initial.txt) | **65/65 passed**, exit 0 | Original owner `b8853f0c…` and old fact lease; not a pass for the latest owner or new long-source cases. |
| [Private codec initial metadata](native-mode-20261017/mode-wire-initial.json), [output](native-mode-20261017/mode-wire-initial.txt) | **138/138 passed**, exit 0 | Finite wire checkpoint, including funding/KB compatibility vectors; not combined installation acceptance. |
| [Adapter initial metadata](../../../apps/gateway/sources/public-data/test/evidence/mode-initial.json), [console](../../../apps/gateway/sources/public-data/test/evidence/mode-initial.txt), [summary](../../../apps/gateway/sources/public-data/test/evidence/mode-summary.json) | **66/66 passed**, exit 0 | Synthetic HTTP adapter checkpoint: 21 economic, 17 public-data mode/composition and 28 PE cases. Does not qualify the current native owner or a live producer. |
| [SDK/installation initial metadata](native-mode-sdk-20261017/mode-sdk-installation-initial.json), [stdout](native-mode-sdk-20261017/mode-sdk-installation-initial.stdout.txt), [stderr](native-mode-sdk-20261017/mode-sdk-installation-initial.stderr.txt) | **84 passed / 17 failed / 101 total**, exit 1 | Actual retained failed run. Fifteen test-only corrections are authored but **UNRUN**: ten immutable prepared-runtime fixture mutations and five expected error-classifier corrections. Two award installation `DEADLINE` failures remain real recorded outcomes; they are not dismissed as load flakiness. The lifetime correction and fresh focused/combined checks remain unverified. |
| Core production and PE source | Parent reports source-only acceptance | Actual Core Jest and TypeScript checks **NOT RUN**. Syntax/fixture preparation is not Nest/native producer execution or compiler acceptance. A reviewed published successor pin and installation/qualification remain separate pending requirements. |

My earlier provisional source review was bound to original reader `19b1a22067bf964499ed5c706d1daa7e8a7c641cf469b0ae6dc2c8298a52233f` and owner `b8853f0ca000ebba3707fbf5843b19fc9b2fc6448556aec23aff089cae73174f`, plus their then-current shared hashes. It found and checked the earlier first-secret ordering repair. It does **not** accept the changed reader/owner bytes below as tested or qualify the final packet.

Outreach is separate and excluded from self-review: I authored its source. Its [27/27 source checkpoint](outreach-name-correction-20261017/source-tests-final.json) and root's [74/74 reference/owner checkpoint](native-mode-20261017/outreach-owner-initial.json) are retained as distinct historical results. This report grants no independent source acceptance to my outreach work. Outreach remains partial; no unscoped/detail completion is claimed.

The source-policy SDK additions are authored, while acceptance/accounting remains incomplete. No source result, successful absence/completeness, current mode, native source, installation or live qualification is established by this report. **HOLD_TESTS / INCOMPLETE** remains the final decision for the candidate.

## Exact source snapshot

All hashes are SHA-256 over file bytes read during this review. Paths in this table are relative to `meri-greenfield`; the current reader/owner/test hashes intentionally differ from initial evidence.

| File | SHA-256 |
| --- | --- |
| `apps/runtime/native-authority/native-read-credentials/read-mode-observation.mjs` | `94fe59b8b94f90445f105b274edde213dd55308d88e39a4d1a0aafa886115739` |
| `apps/runtime/native-authority/native-read-credentials/owner.mjs` | `38d85df16bec6f7dfaf732b63436c7a8f50647758f765cf8e49385e90d2f55c3` |
| `apps/runtime/native-authority/native-read-credentials/test/read-mode-observation.test.mjs` | `274a461704ab33d4f97c61cd40640b6faf2fd998b36be06966ce1eabf4a71678` |
| `apps/runtime/native-authority/native-read-credentials/test/mode-context.test.mjs` | `327c461f022332a92abcfa63f5f6c492248918f269fcda419ceaf0fcfc430785` |
| `apps/runtime/native-authority/native-read-credentials/core-client.mjs` | `a5939600c8a8d45c5095865ad8ddd34e228ce9be44b38689ea45818e776c35d5` |
| `apps/runtime/native-authority/native-read-credentials/source-read-context.mjs` | `4de3e10ee866e3f7fac721e9f2cdb3beb5ee2ebddb8852e9248b12d0f9e6d82c` |
| `apps/runtime/native-authority/general-read-installation/runtime.mjs` | `e7ea0f66d823a367ceaf10c729dd94bcb7c2be513f4e4643e8e277fbcd0d1857` |
| `apps/gateway/sources/retained-reads/native-handler.mjs` | `2aef6e852ce79d51336eef2ba5064709266686f2e68a4a31d2fdbd27b3f315d8` |
| `apps/gateway/sources/retained-reads/http-transport.mjs` | `f17a9c61c4a98fc9e53e7000bef05b9f836f746871ff707c07ada8e9aac0460e` |
| `packages/contracts/native-read-observation-0.2/schema.json` | `c5451fb9e73cb8513d38270af54814c0c68216aacfee5325fcd1db41bdf4857f` |
| `packages/contracts/native-read-observation-0.2/validate.mjs` | `33bf8d112ed0ff1e2dcab5c3364528b1c449c9fec6a82224d18d88da2d2b697a` |
| `apps/gateway/general-reads/integration.mjs` | `5585f76924dadd3f5598a2ed21ed0d56c30c24ee28be06072a9342f7bed445b4` |
| `apps/worker/conversation/reads/families.mjs` | `ac3d06a17f7d2142a5713e890f5cd8cfe43c66138d8903f84d9e7967a9d8855c` |
| `apps/worker/conversation/reads/test/newmode.test.mjs` | `98a22294e75e73837bbbfdb9a07ca6152e6274284b36f8937fcac735dc07dbe6` |
| `apps/runtime/native-authority/general-read-installation/test/phase3-mode.test.mjs` | `bb2b3653961f851c1d9d85f10de6578cd3d9f146d921c5879f3a5e3f9f759b16` |

Core source is a separate `capiro-backend` candidate above the PR59 base, not a newly accepted published deployment dependency. These are the separately read source bytes, with no Core changes by this reviewer:

| Core file | SHA-256 |
| --- | --- |
| `apps/api/src/auth/application-read-mode-observation.controller.ts` | `1c5f3afa58a7d5b73d6489ecf63d9ca391e176cdf5af1c46efaf34b5eeff3749` |
| `apps/api/src/auth/application-read-mode-observation.service.ts` | `ed38f04afeeab6d3e8727af5f6c0fc86a8023898237a496be8ccdf6058904ee5` |
| `apps/api/src/auth/application-authority.module.ts` | `07d158abfca5af24758207ffab7717b583e4be6720d929d9306fad74449b4551` |
| `apps/api/src/meri/meri-funding-read-observation.ts` | `364ef0261c7bbb4b38e55613b1cbd33a9e8541b823f226f19a3d46fbb12d8e82` |
| `apps/api/src/meri/meri-tools.service.ts` | `4938c5ce71ad7e77aa5d8249ca67178d2f4dcde2082d9660d5335878ce4a33f0` |
| `apps/api/src/auth/application-membership-request.ts` | `f1ff3779a9817dc0fee330f1a8eb67faeea971f8e4e1a18109936377324ff340` |
| `apps/api/src/meri/meri-tools.program-elements-mode.spec.ts` | `f5f269f50e6d1a46f65e040efd9ae7f7d73882449190666b241b11c1662514b0` |

Literal fixture bytes were reread without executing code: mode golden is 8295 bytes, Git blob `b056a4aa0efd0384c1cd90cc810d9def181d6818`, SHA-256 `e793fb92fa13a175939f9ae0015787c12e281fe50d7133cc8698a5913956ca56`; existing funding golden remains blob `9536c662f4abd3487b6bdb4000ff06a0250f44ae`; semantic KB golden remains blob `a807a90718c2260f2c980bd04e04cec2d8c9414f`. This is file-integrity evidence, not a new test pass.

Raw checkpoint stdout hashes remain: reader `92c8ad663eadaa5b0edd7facb6a5d5ebb41a291560254e337239c8e2232ba5bf`; owner `4169b657f006022dd82f0793699a2afdf3556e1176055fc9d79f38e02c0b649f`; codec `0ce5460ee638df83fe25dd600015bf151f2aba3d3eb080eef6d78cbf55751f73`; SDK failed run `d9b6ca5270bfc79bc918854b2d6f304967be4929f67db1609f3b2e5fff7df841`. Original commands, exit status, before-run hashes and complete retained streams are linked above. No stream was rewritten or regenerated by this review.

## Resume boundary

After explicit authorization to resume, the owning coordinator must freeze the final source, resolve and execute the latest reader/owner and 17 failed/changed SDK cases, run the coherent focused Meri packet, execute actual Core Jest and TypeScript checks, and independently bind the published Core successor before any acceptance or metadata promotion. Existing current qualification, source/origin/config binding and live gates remain mandatory. These are outstanding steps, not scheduled or performed actions. This lane stops after freezing this report.
