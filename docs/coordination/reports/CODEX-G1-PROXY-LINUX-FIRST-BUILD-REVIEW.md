# Independent review of the first failed Linux experiment

Verdict: the retained actual DATA supports the owner's rejection. This was one acknowledged, terminally failed CodeBuild experiment with zero automatic retries. Offline package installation and runtime inventories succeeded; Prisma generation failed before the qualification image/container import stage. No native-import, runtime, proxy, security or G1 acceptance follows. The consumed dispatch cannot be reused, and this report does not approve another attempt.

The reviewer did not author the Linux assembly, dispatcher or recipe. A dedicated worktree from `1d7321468a49bb10e5c622e72859436bda16151c` contains only this report. AGENTS and IMPLEMENTATION-STANDARDS were read and a proportionate outline preceded review. Ignored evidence is `.task-inputs/linux-first-build-review-1/`. No subject helper, test, Docker/native binary, AWS CLI, provider, database or network action was executed by the reviewer. PowerShell/.NET read-only DATA processing and Git provenance commands were used. The prior dispatcher/runner source reviews are inherited context, not newly rerun qualification.

## Exact operation and immutable handles

| Binding | Actual value |
| --- | --- |
| Author source | `e2a2a26c7bef0911edc1819ab9ac237097d43e0d` |
| Build | `meri-greenfield-qualification-build:0e9dac8a-b69b-408e-af11-77dfc66f8655` |
| Source S3 version | `z0F24xm0e_69De0JgKZ_bqPVCJaZSVyv` |
| Result S3 version | `guK9wdAqutGfBEEqP3AVqvAZ3q8KXbU8` |
| Local permanent token | `30a25c01-8879-4f1f-820a-276fcfd03937` |
| Source archive expected SHA-256 | `77ef8e305ee57cc5886cbdd9c34d78829739f1a4b1680028ef1becdda22de53e` |
| Input manifest SHA-256 | `64d887006dd2a05567fdc18b44e7b27e6eb6c8ed9943858928536baeb7de2931` |
| Actual result archive SHA-256 | `ac0c5ed40b0fe085d5cf081bc9fc7b05541ca96452700463990c7dc309ad33f4` |

The source archive is 219,762,982 bytes. Per allocation, its full hash/330 ZIP members were not replayed; the owner previously verified those against the frozen 328 context rows/321 artifacts. This review independently checked the retained upload and versioned source HeadObject checksum/length/metadata against that exact expected digest, request and frozen decision. The complete actual result archive is only 13,909 bytes and was independently hashed, parsed as DATA and compared with its versioned HeadObject/GetObject receipts.

The permanent `dispatch-1/reservation.json` precedes the retained AWS calls and records `retryAllowed:false`. Exclusive upload/start attempted markers and raw acknowledgements remain. Nine dispatch captures show identity, project/activity checks, one upload, versioned head, renewed project/identity and one StartBuild. Five subsequent captures show two build observations, one log page and result head/get. All 14 envelopes have successful CLI exits, no recorded timeout/retry and exact raw stdout/stderr hashes. The upload took about 42.91 seconds within its 60-second direct-child limit. StartBuild's ACK was captured at 03:00:18.712064–03:00:19.710654 UTC.

Both acknowledgement and terminal build DATA bind the same source version and exact reviewed inline v3 recipe, not the project's worker/ECR recipe. The requested retry override is zero; actual `autoRetryConfig.autoRetryLimit` and `autoRetryNumber` are zero, with no next/previous retry handle. First observation is IN_PROGRESS/BUILD; the second is FAILED, `buildComplete:true`, phase COMPLETED at 03:01:21.805 UTC. The BUILD phase failed with COMMAND_EXECUTION_ERROR/exit 1, while later finalization/artifact phases completed. These facts resolve this retained build handle as terminal failure; they do not globally enumerate every possible account action.

## What genuinely ran and where it stopped

Actual Docker version DATA identifies Linux/amd64 Docker 28.5.2. The docker-build receipt records the fixed platform/context/Dockerfile/iid arguments, exit 1, elapsed 32.018767 seconds, 1,200-second timeout, no bound failure and `captureComplete:true`. Its stdout is empty; stderr is 66,118 bytes, SHA-256 `b6035a9ebfd67122e4f919d9d8cb1bb467f93bd028967421ef8aae6abd54c542`. Observed and written counters equal the independently measured raw stream sizes, below the 32 MiB per-stream limit. Docker-version's receipt likewise has complete matching streams and exit zero.

The build log contains a successful hash-required, no-index/no-deps installation of all 124 selected wheels and a 124-entry installed-distribution inventory. It contains 99 dpkg inventory rows, actual `v24.21.0` and `Python 3.13.5`, followed by the inventory step's successful completion. These are genuine retained Linux build observations. This review does not independently remeasure each installed binary/RECORD or establish a complete SBOM/security verdict from console output.

The next generation step explicitly runs under BuildKit `RUN --network=none`. It invokes the actual Node/Prisma generation path and reports `BUILD_REFUSED`, `BuildRefused`, `GENERATION_FAILED_OR_BOUND`. The retained error names this exact missing request:

`https://binaries.prisma.sh/all_commits/ac9d7041ed77bcc8a8dbd2ab6616b39013829574/debian-openssl-1.1.x/query-engine.gz.sha256`

The reason is `getaddrinfo EAI_AGAIN binaries.prisma.sh`. This is a failed fetch/resolution attempt under the retained network-none step, not proof that the upstream release is absent. The unchanged schema includes multiple targets; the assembled cache only supplied the retained Debian OpenSSL 3 native engine pair. A complete acquired-file inventory did not establish a complete offline generation dependency closure. The source and actual failure preserve that distinction rather than relabeling native bytes as another platform or weakening schema/network checks.

The qualification import probe was not reached. `result.json` records `nativeImportPassed:false`, `containerCreateAttempted:false`, `containerRemoved:false`, `containerCleanup:NOT_NEEDED_NO_CREATE_DISPATCH`, `inputStable:true`, `providerCalled:false`, `databaseStarted:false`, `imagePushed:false`, `runtimeAdmitted:false`. The reviewed runner's control flow refuses the failed build before image validation/container creation; the returned bundle has no create/start/import receipts. This supports no create dispatch in this fixed runner path, not an independent global Docker-host absence proof. Node/Python and a Prisma generation attempt did run during image building; describing this as no native execution at all would be incorrect.

No runtime container existed to qualify cleanup. `NOT_NEEDED_NO_CREATE_DISPATCH` is truthful for this failure path and is not the positive physical cleanup proof required by a successful future import experiment. CodeBuild terminal status also does not reconstruct every BuildKit intermediary or past daemon state. The source/result objects remain intentionally retained encrypted evidence; the permanent reservation remains consumed despite the known failed outcome.

## Independent capture and continuity checks

The v3 result manifest binds the exact source commit/archive/manifest, source version and build ID. It reports seven payload rows, all complete/stable, totaling and reserving 69,554 bytes. Independent DATA parsing found exactly eight flat regular tar members: those seven payloads plus `capture-manifest.json`. Every member's size/SHA-256 matches its retained flat file and row; there are no duplicate, linked, nested or unexpected members. The whole archive checksum matches both exact-version S3 receipts and the same dedicated KMS key. `evidenceComplete:true` means this finite failure evidence is complete; it does not mean the failed native workflow passed.

The outer Docker stream capture is complete. Nested generation stdout/stderr are not separately returned raw files: the Dockerfile printed the generator summary and at most a 1 MiB prefix of its stderr on failure. Consequently this report does not claim complete nested generator diagnostics. The retained CloudWatch response has 174 events and forward/backward continuation tokens; it was preserved as corroboration, not claimed to be a fully paginated log history.

All nine enumerated invocation source/executable records still match their pinned bytes: dispatcher, preparer, Python/AWS executables and five canonical imported helper sources. This is an enumerated source/executable continuity check, explicitly not a full installed runtime/stdlib/CLI dependency freeze or reconstruction of past process memory. The result's input stability and binding fields are retained builder observations. The reviewer copied/rehashed 68 small source/evidence files, preserved their current equality and kept all prior source/review seals unchanged.

Two diagnostic limitations remain visible. The owner's first build-observation command reportedly failed to import its module under `-I` before any AWS dispatch, then a corrected sys.path command captured build-1. That original failure is tool-transcript-only owner evidence; no binary failure envelope was supplied, so this review does not invent one. Separately, the reviewer's first .NET tar readback mishandled a zero-length member's null DataStream and failed before producing its DATA result. The original tool diagnostic and a labeled record are retained; only that DATA reader was corrected to treat exact zero length as empty bytes and refuse null nonempty streams. No product/helper/test/API was replayed.

The completed independent DATA result is `data-reconciliation.json`, 66,169 bytes, SHA-256 `29bb00778a85587d5739e89e0e028099048c90e1e828232571da7b772f92ba02`. The final sibling seal binds its raw snapshots/protected sources and report Git readback. It confirms retained failure evidence, not permission for another build. Any future attempt needs a separately reviewed dependency-closure repair, fresh independent input/admission namespace and owner decision. Original failed artifacts, consumed token, source/recipe hashes and no-runtime/G1 disposition remain immutable.
