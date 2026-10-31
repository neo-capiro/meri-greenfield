# Native /2 release composition

This successor connects the accepted native runtime to the existing first-chat material renderer and preview template path. It prepares source and offline artifacts only. It creates no cloud resources, applies no SQL, starts no browser/native work, and does not make native processing a default. Release remains the sole build/deployment owner and DB retains migration custody.

## Implementation outline and owners

- `first-chat/native-processing-material.mjs` translates one closed deployment feature into the existing Control and worker configurations. The canonical deployment/config/bootstrap validators, material initializer, issuer, currentness and durable operation owners remain authoritative.
- `native-observer-entrypoint.mjs` is the Lambda handler for the existing bridge. It reads one exact Secrets Manager version, checks the public hash and private CA, and disposes buffers. It has no database, EC2 or Step Functions client. The bridge accepts a fixed base machine ARN; worker and Control retain all immutable graph/version/provenance checks.
- `native-template.mjs` prepares observer publication, the existing /2 watchdog, and supplemental policies on existing Control/worker roles. These functions are also exported from the existing product-preview `manifest.mjs`. They are ordinary CloudFormation source, not a replacement deployment pipeline.
- `native-processing-package.mjs` stages exact committed source plus locked dependency versions from Release's extracted runtime image, verifies actual packaged imports, and makes a deterministic ZIP with a member inventory. It neither installs dependencies nor builds/pushes an image. Its receipt explicitly does not qualify a serving image.

Every new boundary refuses missing, extra, inconsistent or disabled-with-leftovers inputs. Existing source/currentness/physical cleanup owners are reused rather than replaced. Final source/package/template review is required before merge or release.

## Material input

Omit `features.nativeProcessing`, or set it to exactly `{ "enabled": false }`, to leave provisioning absent/disabled. Ordinary `features.uploads` still selects the existing AgentCore inspection path. Enabled native processing additionally requires `sourceEnabled: true`, `uploads.enabled: true`, a distinct `database.roles.nativeWorker`, and a distinct explicit `foundation.WorkerTaskRoleArn`.

An enabled feature has exactly these fields:

| Field | Source |
| --- | --- |
| `enabled` | `true`, explicit protected operator input |
| `deployment` | Existing `compileNativeDeployment` /2 shape: account/region, full placement and launch, image/source/bootstrap pins, bootstrapSpec, physicalObserver, launchTagPolicy; optional helper pin/maxLifetimeMs |
| `watchdog` | Actual numeric `stateMachineVersionArn`, exact raw UTF-8 `definitionSha256`, reviewed `qualificationEvidenceSha256`, and `definitionReadback` as specified below |
| `observerKeyId` | Fixed observer authentication key identity |
| `maxRequestMs` | Integer 1–30000 |
| `materialSha256` | Exact six-purpose raw-byte SHA-256 map below |

Guest sourceCommit must match the rendered runtime source commit. Publication uses `DefinitionString: canonicalJson(compileNativeWatchdogDefinition(...))`, with no trailing newline, substitutions or object serialization by the template path. Release must obtain `DescribeStateMachine` for the actual numeric version and supply `watchdog.definitionReadback` as an exact projection of `{stateMachineArn,type,status,revisionId,definition}`. Copy the returned `definition` string unchanged; never parse/re-encode it, substitute the expected local string, or infer observed bytes from the template output. The renderer requires matching numeric ARN, STANDARD/ACTIVE, a nonempty revision ID, exact equality of the returned definition to the complete canonical compiled graph, and a SHA-256 of those raw UTF-8 bytes equal to `definitionSha256`. It strips the preparation readback from the emitted worker configuration, whose unchanged three-field watchdog contract independently hashes the raw service response before execution. The template output is an expected-byte hash, not readback evidence. Ordinary/pretty JSON of the same graph, a repinned changed graph, missing readback or a different version all refuse. If a service changes the published bytes, stop preparation; do not silently replace the pin or relax the worker. Release owns the actual response/provenance custody; offline inputs cannot authenticate an AWS observation.

The renderer also compares VPC/subnet against deployment input and the bootstrap Control server/CA against actual first-chat PKI. These are preparation checks, not infrastructure observations.

Supply `--native-material <private-json-path>` to the existing render command. The JSON is an exact map from the following names to absolute local private files; the library accepts equivalent Buffer values as `nativeMaterial`. Raw material never enters the summary or template.

| Name | Delivery |
| --- | --- |
| `controlClientCertificate` | Control `/run/meri/native-control-client.pem` |
| `controlClientKey` | Control `/run/meri/native-control-client.key` |
| `issuerCaCertificate` | Control and worker `/run/meri/native-issuer-ca.pem` |
| `issuerCaKey` | Worker only `/run/meri/native-issuer-ca.key` |
| `observerKey` | Control only `/run/meri/native-observer.key` |
| `databaseConnection` | Worker only `/run/meri/native-database.uri` |

Inputs are bounded, hash-pinned, regular files; the CLI refuses symlinks and, on POSIX, nonowner or group/world-readable files. The existing static delivery contract still enforces exact inventory, direct paths, UID/GID, inode/readback and mode. The worker DSN must match the configured database host, port, database, distinct native role and `sslmode=verify-full`. This does not create the role or grant membership.

The Control client must match its private key and bootstrap certificate, chain to the pinned Control CA, contain the exact client DNS SAN and clientAuth EKU, and have an actual DER lifetime no greater than 900000ms. At rendering it needs more than 87000ms remaining (minimum lease plus cleanup and signing margin). `summary.nativeProcessing.materialNotAfterMs` records the short native window separately from ordinary first-chat material validity. The renderer issues no certificate and adds no rotation service. Release must provide fresh accepted material for its bounded native window; long-lived Temporal credentials cannot substitute.

## Noncircular publication and package inputs

1. Select reviewed source and exact runtime/guest image inputs. Keep native producer configuration disabled. Extract dependency directories from that runtime image into Release-owned scratch and retain the extraction/source/image binding.
2. Prepare the observer ZIP using the existing preview source utility:

   ```text
   node infra/product-preview/native-processing-package.mjs --source-root <checkout> --commit <reviewed-full-SHA> --runtime-root <extracted-apps/runtime> --contracts-root <extracted-packages/contracts> --image-digest <qualified-runtime-digest> --out <new-private-directory>
   ```

   The output directory must be absent and outside all input roots. It contains `package/`, `manifest.json`, `observer.zip`, and `receipt.json`. Actual committed handler/contract/schema bytes and bundled SDK dependencies are included. Dependency versions must exist in selected Git locks; every copied file is hashed. The ZIP rechecks each member's length/hash. Readback/import success is not authenticity evidence for an arbitrary supplied image digest: Release must bind the extraction to its qualified image. Local cache tests are explicitly synthetic package qualification.
3. Prepare `compileNativeObserverTemplate` with `enabled:true`, `configuration`, immutable `code {bucket,key,versionId,sha256}`, `network {privateSubnetIds,securityGroupIds}`, exact `kmsKeyArn`, and existing `logGroupName`. The source bytes and ZIP are not uploaded by these functions.
4. Observer configuration is `{schema:'meri-native-observer-entrypoint/1', functionArn, stateMachineArn, keyId, secretArn, secretVersionId, secretSha256, caSha256}`. Function and machine ARNs are fixed and unqualified here; the secret is one immutable version. `createNativeObserverSecret({keyId,key,ca})` prepares its exact JSON bytes without a graph/version dependency or key issuance. The completed first-chat render also emits the same `native-observer-material.json` outside the repository, mode0600, and records `observerMaterialSha256` and `observerCaSha256` in the native summary. Bind those hashes to Lambda `secretSha256` and `caSha256` and the recorded secret VersionId. Thus the prepared observer key and private Control CA come from the same material as Control, rather than an independent hand-written secret. No private value is included in CloudFormation. The renderer refuses a different observer origin/port.
5. Under Release's separate allocation, publish/read back the observer code/config and record the returned numeric version. The handler requires BOTH numeric `context.functionVersion` and an already numerically qualified matching `invokedFunctionArn`, plus the protected function name/account/region. Alias, unqualified, `$LATEST`, mismatched or event-forged identity refuses before material/network access. No next version number is guessed.
6. Compile `compileNativeWatchdogTemplate({enabled:true,name,deployment})` with that actual Lambda version in the accepted /2 deployment. Publish its exact canonical `DefinitionString`, then read back the actual numeric Standard graph version. Preserve the returned raw `definition` string and the five-field `definitionReadback` projection described above. Require byte equality to the template string and its expected SHA-256, and retain the reviewed qualification receipt before rendering material. This deliberately makes the canonical graph hash equal the observed raw-byte hash; merely having equivalent parsed JSON is insufficient. The graph remains the existing compiler's complete output with no added Retry/Redrive/launch path. The graph role can invoke only the exact numeric Lambda version.
7. Prepare `compileNativeRuntimePolicyTemplate({enabled:true,deployment,stateMachineVersionArn,instanceRoleArn,controlRoleName,workerRoleName})` against existing roles. Control gets scoped physical reads/ordinary termination/history; the worker gets scoped original launch/tagging, exact role passing, the named bootstrap document, invocation readback and exact graph version admission. It gets no direct termination, redrive, IAM mutation or tag deletion. Instance-profile membership and live effective policies must be checked separately.

All three template compilers return no resources by default. They do not publish, start an execution, enable a service or migrate data. Review an actual change set before applying these templates: omitted resources in an update are not an operational rollback recipe. Retain original published versions and all policies needed by unresolved original contexts. Use existing Release stack/pipeline custody; never replace the in-flight first-chat rollout with an unqualified native tuple.

The Lambda role permits only the selected secret version, scoped KMS/log access and Lambda's required VPC ENI operations. An explicit source-function deny prevents the function code from using EC2, Step Functions, IAM or Lambda operations. Lambda service ENI setup is distinct from code authority. The bridge's context identifies the function, not the calling graph. Release must inspect effective identity/resource policies and exclude unintended direct invocation. No template can establish that merely by naming a narrow allow statement.

## Database and reader order

Retained DB live completion evidence ends at ordinal 77. The following is dependency order, not a statement that later migrations are absent or pending:

| Dependency | Exact prepared SQL SHA-256 |
| --- | --- |
| Host 78 | `2740ff5f098e36bcaf781f86b79885d9dd559b2f9418edd335f647b4702d11d2` |
| Intent 79 | `894f177dae9e393e4285f004730c3e07204132f001a75b1c93c999d212fe5853` |
| Unnumbered SQL117, after host prerequisite | `0a760da5fd982b4d9b73fa79bfe7a82daa341aae36bc63a990e49eff9f47dbbb` |
| Observer delta, after exact SQL117 | `f93f3a215b6eb8d178059aad7b572c19f08d00764e34f28c68c7ccb2e0a6b330` |
| C2, after observer | `c8f189b48d0114aca710c5224e155a65a814c27a5f9dfcb4f214e05406f50546` |

DB owns actual catalog/ledger/role reconciliation, final ordinal registration, target/snapshot and bounded pre/post checks. Do not assign 80/81 from the retained 77 boundary or replay applied history. Observer/C2 packages remain sealed DB artifacts; this successor does not register or apply them.

Install compatible `originalFilename` and C2 readers and schema before enabling their producers. Exact browser filename preserves original case/length independently of the display title; historical missing provenance remains readable but exact lookup unresolved. C2 only extends protected /2 serverAuth to the ORIGINAL lease+25000; client/workload/currentness remain lease-bound. Actual DER lifetime stays <=900000, original client expiry/signing margin still caps allocation, and installed guest peer expiry is actual. No caller deadline, renewal or historical repair creates a new capability.

## Bounded Release acceptance

Reuse accepted A–E, SQL117/observer/C2 and actual DER source receipts. Do not rerun a historical unknown operation. New acceptance requires a separately admitted fresh allocation and exact source/image/config/material/graph/DB tuple.

| Check | Required evidence / refusal boundary |
| --- | --- |
| Protected request | Exact /2 declaration, original run/owner/generation/lease, canonical prepare/install request/observation joins; incomplete or caller-mutated scope refuses before effects |
| Dual image and package | Qualified Linux ARM64 runtime AND guest AMI/image digest, exact source/import/data closure, installed bootstrap/helper/profile/SSM document bytes; no x86/Fargate spike substitution |
| Material/TLS | Real protected file ownership/inode/mode, distinct pairs, actual issuer/client/host chains/EKUs/SANs/DER expiries; wrong scope, stale/expired material, C+1 and client+1 refuse |
| Graph/IAM/network | Actual numeric Lambda/Standard versions, complete graph hash, protected placement, seven instance/root-volume tags, effective caller trust, no unintended invocation/redrive/tag-mutation path, private CA/DNS/HTTPS and measured bounded latency |
| Linux guest | Real installed entrypoint and launcher, cgroup/process hierarchy, scanner/parser/Office sandbox, resource bounds and actual exported result under original currentness |
| Physical cleanup | Genuine mandatory guest teardown proof plus canonical correlated instance/root-volume/ENI outcome and retained O/M history/operation ledger; transport success or graph SUCCEEDED is insufficient |
| Failure/replay | Missing config stays disabled/unavailable; stale generation/wrong tuple refuses; lost/postcommit replies stay pending/unknown; unresolved /1 or crash-fenced history has no fresh deadline, TLS/SDK retry or redrive |

UNKNOWN remains UNKNOWN and blocks a new admission where the existing owner requires it. Do not forge a full teardown receipt from physical absence, release capacity on a postcommit fault, rewrite history, remint credentials, or roll back to a reader incompatible with retained extended records. Disabling new provisioning does not erase old cleanup obligations.

## Verification limits and references

Offline author evidence is retained in the capabilities source owner's handoff. The new renderer tests include real throwaway certificates, exact role inventories and repinned invalid material; wrapper tests join the actual bridge and refuse identity/config mutations before secret reads; package tests import the sealed handler with bundled dependencies; template tests check disabled defaults and permission boundaries. The F1 successor integration test crosses actual template publication bytes, full renderer and unchanged worker with a mocked SF transport: exact-byte positive control, ordinary/pretty JSON counterexamples, repinned full-graph mutation, missing readback and wrong numeric versions. The prior candidate/review and package receipts remain historical; unchanged handler/package/IAM/TLS findings are reused, not relabelled as new deployed evidence. These are not cloud or physical-host acceptance.

`cfn-lint 1.59.0` reports five E3601 type errors on inherited graph JSONata `TimeoutSeconds` expressions. AWS documents those expressions as supported; no deadline expression was weakened or suppressed to obtain a clean lint claim. The actual service validation remains Release-owned. Scoped Guard rules exercise bounded Lambda, retained versions, Standard/no-Retry graph and absence of mutable/asynchronous entry points, including a failing negative fixture. They are not a complete live-policy compliance assessment.

Primary references: [Lambda context](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html), [Lambda VPC permissions and source-function deny](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html), [Secrets Manager VersionId authorization](https://docs.aws.amazon.com/service-authorization/latest/reference/list_secretsmanager.html), [Step Functions role trust](https://docs.aws.amazon.com/step-functions/latest/dg/procedure-create-iam-role.html), [JSONata timeout expressions](https://docs.aws.amazon.com/step-functions/latest/dg/transforming-data.html).
