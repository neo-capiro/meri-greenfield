# Trusted composition — independent source acceptance

11 October 2026 UTC. **SOURCE ACCEPT for this bounded change; image/build/runtime HOLD; G1 OPEN.**
Tested implementation `72c8afa5f7854505f99ccbd569c5de8c9e6bd1d9`, tree
`6a38083a3090a272559a0f1d7d5283e4c54ba798`, extends delivered base
`7f1d20d2c28db25948ecc02d26545645e87a3e3c`. Subsequent commits contain
reports and retained evidence only. Existing delivery archives remain immutable.

## Accepted changes and organization

`scripts/qualification/sdk-native-evidence-owner.mjs` composes the existing
observation, canonical encoding, verification and one-shot publication owners.
Its two ports are the native observer and the existing evidence-provider
interface. Signer/storage capabilities remain outside the fixed worker context.
Deadline, cancellation, current authorization and uncertain-write quarantine
are preserved; it neither creates a second model loop nor issues credentials.

The service's existing admission validator is exported as
`assertNativeEvidenceAdmission`, preserving its original body and existing
call arguments. The new owner invokes it before exposing capabilities. This
closes the independent review finding that malformed or foreign public keys
could otherwise survive construction. No public `0.1.0` distribution, schema,
wire operation or transport contract changed. Root adds only the focused
owner suite to the existing SDK evidence check.

`scripts/qualification/worker_image_scan.py` owns offline basic ECR analysis.
It reuses the canonical collector's bounded stable-file reader, strict JSON,
hashing and encoding, and publication identity constants. It retains every
accepted finding and attribute, reconciles severity counts and refuses
ambiguous, incomplete, paginated or enhanced evidence. Its file/CLI adapters
perform no network or persistent writes. Even zero findings produce HOLD;
applicability, fixes, embedded-copy coverage and admission are never invented.

These are cohesive owners with injected dependencies, inert initialization
and focused tests. No dependency, lock, Dockerfile, context membership,
generated distribution, historical authority or unrelated source changed.

## Independent review

The owner reviewer independently passed 12 focused groups and checked the
canonical validator body/call preservation. Five malformed/foreign key
variants now refuse before ports, observation, authorization or storage.
The original review HOLD, failing counterexample and repair remain visible.

The analyzer reviewer independently checked preservation, duplicates, types,
limits, hash bindings, inert import and actual CLI behavior, then verified
that the integrated image-suite failures pre-exist at the delivered base.
No reviewer modified production code or ran cloud/native/provider operations.

## Root verification on the exact implementation

Raw stdout, stderr and hash/exit envelopes are retained in
`docs/qualification/candidates/trusted-composition-20261011/`.
Counts below overlap; they are not a unique-test total.

| Check | Actual result |
| --- | --- |
| Registered SDK evidence suite | 369 passed; no failures, cancellations or skips |
| Root contracts/session suite after dependency restoration | 182 passed; no failures or skips |
| Public distribution | Exact generated-byte check, typecheck and seven tests passed |
| New offline scan suite | 18 passed |
| SDK worker source pins | 19 exact records verified |
| Fixed worker context | 53 members; 994,107 bytes; owner scripts excluded |
| Integrated historical build/publication plus scan suite | 52 of 56 passed; one failure and three errors; HOLD |
| Unchanged base's build/publication suite, isolated Git export | 34 of 38 passed; the same four failure identifiers |
| Final diff formatting | Passed |

The first root contract run passed 181/182: the existing generated-distribution
check could not import `esbuild`. Restoring the existing locked contracts
dependencies with `npm ci --ignore-scripts --no-audit --no-fund --prefix
packages/contracts` installed 24 packages without source/lock changes.
The full root rerun and public distribution check then passed. Initial failure
streams and the dependency-restoration capture are retained.

The first staged formatting check identified three whitespace-only lines in
that original failed stdout. Local evidence attributes mark captured streams
as binary so Git retains their exact bytes; the streams were not edited.
Source, reports and JSON remain subject to normal formatting checks.

The four historical image-suite failures are not waived:

1. Collector nonpublish source records are 56, against historical authority 47.
2. Publisher source records are 58, against historical authority 49.
3. Current context SHA differs from the historical admitted context SHA.
4. The owner executable is bound to a fixed Windows Python path and refuses
   this Linux runtime.

The six relevant build/collector/publisher/context/test files are byte-identical
between base and implementation. Independent exported-base captures and source
hashes are retained under `image-baseline-review/`. Source export archive bytes
remain in ignored local evidence; the base commit and retained source manifest
permit reproduction without a second source archive in Git. No assertion,
platform guard or authority pin was weakened to make this suite green.

The current SOURCE_ONLY context SHA is
`da96000546d9688bafd50ffb5d6101ce5a76300e65a47bfb5ea55a1273bd13a4`;
historical build authority still requires
`18836912a03fc035d69c0cfc57d1f407e5c46af1bdd37c21a761f5d42dc84dda`.
Assembling the current local context does not admit an image build.

## Authentication and external execution

The official Linux AWS CLI installer was signature-verified and installed
locally without sudo. Actual CLI version is `2.37.12`; local help succeeded.
Neo authorized CLI sign-in and requested reuse by the separate session named
**Github Access Blocker**. That request does not establish a shared runtime.

The remote console login was attempted with isolated config/cache paths and
terminal echo suppressed. It failed at the official us-east-1 token exchange
with an endpoint connection error; authentication did not complete. A separate
unauthenticated diagnostic using normal managed transport and verified TLS
reached the exact official endpoint but received HTTP 200, HTML, 195 bytes,
recognized as `Site unavailable`. That is not an operational token response.
The sanitized diagnostic is an observation record, not a raw AWS service proof.
No code, token, credentials, cache, authentication URL nonce or transport values
are included in this source delivery. No AWS account API calls occurred.

The canonical AWS capture owner remains Windows/profile bound and strips
ambient proxy/CA overrides; it was not bypassed or modified. A trusted host
with supported AWS endpoint connectivity and independently verified local
authentication is needed for read-only acquisition and later qualification.
Separate ChatGPT sessions have no established messaging endpoint or shared
credential filesystem. No message was sent to another chat.

## Remaining admission work

The source owner is not a qualified supervisor. Genuine child UID/PID
restrictions, key delivery, namespace/workspace exclusivity and observation
provenance remain required. Task-bound certificates, owner-port delivery,
PostgreSQL/S3 current-fence wiring, native A interruption/B resume, stale-A
refusal and independently verified physical cleanup remain unproved.
The positive new owner closure uses scripted transport/fake S3 and a synthetic
sentinel payload digest, not a new physical-file or two-task runtime proof.

The old image still has recorded five critical and seventeen high findings.
Actual historical scan/archive bytes, all finding/provider/embedded-copy
dispositions, coherent supported patched components and complete notices
remain unresolved. The new analyzer has not processed the historical scan.
Fresh image preparation requires reviewed exact source/recipe/build authority;
image shipment additionally requires the user's concrete shipping approval.
No prior build approval is reused.

The pinned proxy/import/authentication and native discovery route, trusted ECS
identity, durable aggregate $10 budget, browser-host sandbox qualification,
Office acceptance and 75 approved real-request inputs remain separate G1 work.
Full SessionStore/workspace/subagent/compaction recovery is not claimed here.
Nothing was pushed, merged, deployed, cut over or changed in current Capiro.
All owned local check children exited; no new listener or background worker
was started by this continuation. The earlier frontend Figma delivery remains
separate and unchanged.
