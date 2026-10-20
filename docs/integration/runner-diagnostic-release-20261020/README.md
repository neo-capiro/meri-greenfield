# Runner diagnostics and stdout EOF release

## Candidate and scope

Exact product source: **`2b4421f612f9fbb728d6da52927aac228d712d40`**, branch `fix/runner-transport-diagnostic-20261019`.

This combines diagnostic source `97795c86dbc1c0045c14747cecf170a9dc44f73d` with reviewed transport commit `516a86b61a0b3874707ecf672beb23df51b2ad06`, received with attribution. Constant-only first-failure diagnostics are observability. The transport correction waits for process exit **and stdout EOF**, then drains queued bytes before natural completion; premature stream close/error fails closed. Explicit stop retains its separate path. The source defect is reproduced; causation of the earlier failed live chat remains unproven.

The separate frontend wording change `0e4a9d748591774e838592ab9bccf89706392e59` is not part of this image. No credentials, PKI, private material, authenticated chat content or private correlation evidence are included in this public packet.

## Exact qualification pins

| Item | Value |
| --- | --- |
| Node image digest | `sha256:f5a7abc9940ef8f5092bbfa9db9c3345874d448de2d7d7712645f8aad9db5ff7` |
| Repository | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker` |
| Image build | `meri-greenfield-qualification-build:04e83f76-34b4-4d4a-be39-d75e34697173` |
| Image build terminal time | `2026-10-20T00:13:45.363Z`, SUCCEEDED, zero retries |
| Measurement build | `meri-greenfield-qualification-build:aaab4ac1-53a1-48f5-b257-cdace47dfad9` |
| Measurement terminal time | `2026-10-20T00:19:27.434Z`, SUCCEEDED, zero retries |
| Source archive SHA-256 | `1c7d59d2419c00e4f74e02b0d0d0754819cf547a3224ee1d8673b376a65006f3` |
| Source archive version | `S7yMsSHfvstrG6OmgQjWsVHEuVg9zW0Y` |
| Source member manifest SHA-256 | `a986c0a4bf026cffc76b0eb689c95501c59d3369e652e71b37a496004e15f656` |
| Source member manifest version | `lncRwK1qmByghPnOfj_cFFT78v.MO2SX` |
| External source proof n SHA-256 | `b9af435fb9f41e576aa81b282a22f8737d2e6a4e934cc4185ab1da6f108823fa` |
| Runtime values SHA-256 | `46a04439273a9a26b90472b4fab28f9d13068187e033ad41d12e7045d48f4e0d` |

The source ZIP is 277,007,966 bytes, with 20,256 members. Its authenticated immutable metadata and independent raw Git/archive audit are retained. The large ZIP is not duplicated in this Git evidence packet. The member manifest object is version-pinned by the request and authenticated HEAD.

Both jobs used the existing approved SMALL Linux X86_64 route. The first used 30 execution/5 queue minutes maximum; the second retained its tighter 10/5 limit. Both had zero automatic retries. Exactly two jobs were submitted under Neo's additional $5 allocation, total approved ceiling $621. These are allocation ceilings, not a billing claim. No third attempt or fresh model request is authorized by this packet.

## Verification and limits

- Focused source checks: 36 diagnostic/activity/facade cases and 16 selected transport cases passed. The transport run on Windows mocked only the test configuration filesystem boundary; it does not establish POSIX ownership behavior.
- The first local diagnostic run retained two dependency-load failures, repaired with existing dependency junctions and rerun only for the affected files. The initial transport test-loader path failure and successful file-URI rerun remain visible.
- Independent source/archive audit passed. External proof n passed 23 focused checks, preserving its historical lineage and checking 58 source paths/52 COPY obligations. It is external proof; the sealed source's historical selector was not changed.
- The successful product producer enforced its existing source, image, fixed 24-case Linux, runtime and cleanup gates. The exact digest ECR scan is COMPLETE with zero HIGH/CRITICAL findings.
- Six artifacts were downloaded by exact selected S3 versions, joining producing build ARN, length, KMS metadata and raw hashes. Canonical measurement verification and runtime-values assembly passed, including all seven launch gates, two invariant SDK spawn probes and COMPLETE physical cleanup. No model request was made.
- Independent request and result reviews are recorded under `measurement-operator/`. Source/image and receipt identities are tied to the new jobs. Fresh measurement produced the same runtime-values bytes as the predecessor; old measurement receipts were not reused.

Only `images.nodeRuntime` and `images.nodeRuntimeSourceCommit` change from the reviewed C public deployment baseline. Policy/allocation remain three turns/one tool. Optional feature, capability-profile and active-read selectors stay absent. This preserves the approved diagnostic launch scope; disabled source capabilities are not counted as delivered, and the wider accepted capability backlog remains open.

## Deployment preparation and remaining gate

The candidate is **qualified and not deployed**. The public readbacks were collected at 00:06–00:07 UTC on 20 October: all ten services were 1/1, none pending, and deployments completed. Foundation/private edge and deployment stacks were stable; the new `FIRST_CHAT_20261020E` label was absent from all five material secrets. Only secret ARNs/version labels were read.

Canonical stage3 derives candidate revisions control35, worker34, issuer34, owner33, proxy33 and runner20. These are not reservations. Any revision or foundation drift requires refreshed reviewed inputs. Proxy main and all five Temporal server images remain unchanged. Existing IAM, network, security and capability settings are preserved.

Neo's explicit restriction against agent secret transmission requires **Neo to render and upload the new private material on the existing secure operator host**. The released Windows helper uses the existing private PKI/Core inputs locally; agents must not read, upload or receive them. See [the handoff](NEO-PRIVATE-RERENDER-HANDOFF.md) and the final published `windows/README.md` for the reviewed invocation. Upload and bindings remain gated until the new metadata-only render receipt has been reviewed and its exact upload manifest pinned.

After Neo returns only the approved public receipt/version metadata and three public templates, the deployment owner can review the exact templates and execute the already approved same-preview sequence **MODEL → ISSUER → APP**, qualifying each stage. No rollout or fresh chat occurred in this packet. No new live-chat authorization is inferred.

## Frozen public exports

The packet commit contains the evidence listed by `PUBLIC-FILE-MANIFEST.json`, excluding that manifest itself. A later commit supplies `windows-readbacks/FILE-MANIFEST.json`; a final helper commit pins both earlier commits and their raw hashes. The helper exports each frozen commit separately, preventing later helper files from changing the packet manifest's file set. Keep the exact pins; do not export a mutable branch tip as the packet.
