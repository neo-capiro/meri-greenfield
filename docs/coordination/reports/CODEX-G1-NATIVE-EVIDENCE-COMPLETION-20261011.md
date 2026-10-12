# Native SDK lifecycle evidence — source acceptance

**ACCEPT for source integration only. G1 remains OPEN; runtime HOLD.**
The complete Meri deployment scope and G0/G1–G7 gates have not changed.
This closes a missing qualification-source seam from the remote handover;
it does not establish native interruption/replacement/resume or product
SessionStore durability.

## Exact candidate

| Identity | Value |
| --- | --- |
| Base | `a5dc95c5940e7403bc1d6a4dcf1d61ed06b2f91f` |
| Branch | `task/codex-g1-native-evidence-20261011` |
| Reviewed source commit | `b797da32a07ac77b0495d25a400626860506dfa8` |
| Reviewed source tree | `9b5f7505769bff393b96d9b0b380e30a8648e764` |
| Source-only worker context | 49 members; 946,994 bytes |
| Context manifest SHA-256 | `604d3b6768226fc45cd3345fae790f3088212e20d57093876cc24f9be696ff0d` |
| Source-check report SHA-256 | `d64dcd41c0c8d1737df008b6ed776003907dc8174eac211505493c6e25762e27` |

The later documentation commit adds this report and scrubbed captures. It
does not replace the reviewed source identity. The remote handoff was
rechecked at `8d045221aa314871edf214deb2c9f1800fde6b17`; its sole change
after a5dc95c is the handover's Cleanup1 coordination note. No source path
overlap was observed. Do not infer permission for shared integration,
cleanup, merge or release from that historical coordination note.

## Canonical implementation and behavior

| Responsibility | Canonical owner |
| --- | --- |
| Private closed native-evidence grammar, canonical bytes, signing bytes and capture binding | `packages/contracts/qualification-sdk/native-evidence.{schema.json,mjs}` |
| Admitted observer signatures, exact S3 evidence reads and lifecycle/capture inspection | `apps/control/qualification-sdk-fixture/service/native-evidence.mjs` |
| Current-authority one-shot evidence publication | `service/native-evidence-publisher.mjs` and existing `service/s3-objects.mjs` |
| Verified immutable checkpoint snapshot before effects | Existing `service/checkpoint-store.mjs` |
| SDK lifecycle observations | `apps/worker/qualification/probes/native-observations.mjs` |
| Backpressured stdout observation and owned stream teardown | `probes/native-stream-observer.mjs` |
| Bounded exclusive Linux PID-namespace baseline and post-exit sampling | `probes/native-namespace-observer.mjs` |
| Native query interruption and post-interrupt event drain | Existing `probes/sdk-interruption.mjs` and `probes/sdk-capture.mjs` |
| Post-drain one-shot evidence-reference binding | Existing `checkpoint/fixture-channel.mjs` |
| Fixed source-context closure and regenerated packaging pins | `scripts/qualification/worker_context.py` and new `worker_source_pins.py` |

The private protocol binds init, interrupt, exit and drain records to one
producer, observer admission, process instance, fence, session, policy,
runtime pins and ordered timestamps. An admitted public Ed25519 key comes
from the trusted owner; payloads never supply their own verification key.
Signature verification authenticates that admission, not an unqualified
runtime observation.

The inspector rereads all four exact immutable S3 versions and compares
the final capture against the exact transcript bundle, inventory and
synthetic sentinel. Checkpoint submission is validated, snapshotted and
frozen before asynchronous inspection or writes. The publisher validates
all bounded bytes and records before effects and reserves its single
attempt before awaiting authorization. Oversized evidence and transcript
content are rejected before unnecessary decoding or copying.

The SDK driver continues reading after an active interrupt through event
stream exhaustion, real child exit and observed pipe closure. Forced exit,
mirror errors, incomplete drains and uncertain namespace facts refuse
publication. The stream observer preserves SDK backpressure; destroying
the observed stream tears down its owned source. A premature source close
propagates failure instead of hanging.

The procfs inspector requires an admitted supervisor alone at PID 1 in an
exclusive namespace, a pre-spawn baseline and consistent complete
post-exit samples. It refuses hidden/masked procfs, surviving processes,
PID reuse, cancellation, timeout and uncertain reads. These samples are
not an atomic process freeze or proof against future host writers. Actual
supervisor placement, child namespace inheritance and exclusive workspace
ownership still require runtime proof.

No second model loop, authorization system or generic framework was added.
New responsibilities have focused modules; the existing large capture
adapter received a narrow extension rather than an unrelated rewrite.
Public 0.1.0 schema/generated distribution is unchanged. Both partial
flags remain false: `completeRecoveryCheckpoint:false` and
`sessionStoreQualified:false`.

## Verification and independent review

Node 24.19.0 and Python 3.12.14. Lockfile installation used ignored
dependency directories with lifecycle scripts disabled. The bundled SDK
CLI was not executed.

| Check | Final result |
| --- | --- |
| Root contract/Hermes protocol suite | 175 passed |
| Integrated native-evidence suite | 295 passed |
| Public distribution generation, typecheck and tests | PASS; 7 tests passed |
| Worker package suite | 156 passed |
| Control service suite | 36 passed; 2 explicit PostgreSQL skips |
| Genuine local loopback mTLS ingress | 29 passed |
| Python source/context guards | 21 passed |
| Fixed source-pin verification | 15 records verified |
| Discovery source options/tools | 23 passed |
| Driver and source-pin CLI help/missing configuration | Four expected exits: 0/2/0/2 |
| Context assembly and verification | PASS; 49 members |
| Diff/source identity | Clean tracked tree; all 35 changed source paths stable |

These suites overlap; their counts are not a unique end-to-end scenario
count. S3, SDK/process/namespace positives and observer keys are synthetic
fixtures. The TLS transport tests used actual local TLS listeners and
verified teardown. PostgreSQL integration and the separate state registry
suite were not run: this host lacks PostgreSQL and a usable nonroot user
namespace. No global database installation or root-start workaround was
used.

Distinct read-only reviewer `native_candidate_review` accepted the exact
source commit after verifying all changed bytes against Git objects and all
26 final capture hashes. It reproduced and reviewed repairs for concurrent
publication, mutable-input races, stream teardown, allocation bounds and
source-pin checks. No remaining known source blocker was identified.

[Machine-readable checks](../../qualification/candidates/native-evidence-20261011/source-checks.json),
[context manifest](../../qualification/candidates/native-evidence-20261011/worker-context-manifest.json)
and all final stdout/stderr captures are tracked beside that manifest.

Retained failure: the broad parallel replay at 2f005c9 passed 294/295 native
cases; the unchanged transcript capture refused `SOURCE_CHANGED` when
other tests modified a shared temporary ancestor. The capture guard and
assertions were preserved. The new suite registration serializes test
files; final replay ran that suite alone with an exclusive TMPDIR before
other commands. The original failed stdout/stderr remain in the candidate
directory. Two captured stdout lines contain trailing whitespace; that
stream is retained as lossless base64 with its decoded size/hash, while the
original ignored capture is unchanged. Decoded bytes were verified equal;
neither the failure nor whitespace was removed from the evidence. A report
formatter subsequently used an incorrect manifest key
after all commands and identity/context checks completed; metadata assembly
was corrected from retained bytes and observed return codes without
rerunning passing tests.

## Runtime and AWS pickup

No AWS operation, provider request, image build, cloud cleanup or deployment
occurred in this continuation. See the [next-run admission checklist](../../qualification/candidates/native-evidence-20261011/AWS-NEXT-RUN.md).
The published image remains PUBLISHED_NOT_ADMITTED; historical image-build
authority pins were not rebased to admit this new context automatically.

The trusted runtime still needs credential issuance and task identity,
admitted signer/namespace placement, real S3/current-fence composition,
PostgreSQL verification, sentinel write/restore/read, the A/B owner and
independent ECS/ENI containment proof. Full SessionStore is later W05/W09.
Other G1 proxy, discovery, browser, security/license and measured contract
qualification remain open. Connected UI and source/memory release work
remain later gates.

GitHub publishing was attempted for this isolated branch. CLI push lacked
credentials; the connector rejected branch creation with HTTP 403,
`Resource not accessible by integration`. No remote branch, PR, merge or
release was created. An importable source handoff preserves the exact
local commits; public repository read access is not write access.
