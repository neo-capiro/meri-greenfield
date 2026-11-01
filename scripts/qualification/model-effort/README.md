# Five-pair qualification method candidate

Offline source for independent review and the sole Release owner. No source commit, manifest, fixture or parser authorizes a build, model request or activation.

## Native path and limits

The immutable base is source `d8cdbca1db57e8c2f3a51a7a74f5014e6fc3f34d`, tree `514245eca0ff473fb84c7fd089dd9e8a8f957aaf`, image `sha256:3b2ee09f99d75d1647c3a1206cdf16bbe7836bb52b8debc56cdd548e221e2037`. It lacks this addon. Image qualification is not model qualification. Existing AgentCore query/HTTP, authenticated control, real workspace/session, SDK query, usage writer and cleanup owners remain unchanged; SDK0.3.295 / CLI2.1.295 are retained.

Exactly five fresh General originals: Sonnet high/max and Opus null/high/max, using `us.anthropic.claude-sonnet-4-6` and `us.anthropic.claude-opus-4-6-v1`. Null omits SDK effort. Fixed prompt and pair order are in plan.mjs. One allocate/admit/submit sequence and one SDK query per case; maximum2 SDK turns/$0.25 estimate each, aggregate5 queries/10 turns/$1.25 estimate. These are stop thresholds, not hard provider invoice ceilings. An in-flight request can exceed them. Overrun stops; provider acknowledgement and invoice stay UNKNOWN.

Each case has180s, HTTP requests10s, history reads24; allocation<=900s, no new work in final30s, runtime shutdown cleanup30s. Unknown stops without resend, replacement request, used-runtime restart, copied allocation or automatic reopening. Existing native idempotent accounting/event retries retain their owner. The SDK preserves presets and lifecycle; additive deny-all PreToolUse aborts tool/delegation attempts; read-only Stop captures active post-downgrade effort. Explicit mismatch fails, missing effort stays UNKNOWN. Tools, skills, delegation and multi-turn behavior are not qualified.

## Candidate and non-circular identity

Retained image config: workdir `/opt/meri`, UID/GID1000:1000, entrypoint `node`, production command `apps/runtime/agentcore-entrypoint.mjs`. The retained AgentCore API has containerUri, no command override. Release's selected route is a minimal candidate-only derivative FROM the exact base digest, copying the complete repinned addon to `/opt/meri/scripts/qualification/model-effort`; combined candidate startup argv is `node /opt/meri/scripts/qualification/model-effort/runtime.mjs`, without a file-plan argument. Preserve native dependencies/files, SDK/CLI, trust, isolation and security. Production entrypoint and initial d8 cut remain unchanged.

Release prepares the actual recipe/archive and qualifies the derivative through existing meri-greenfield-qualification-build after Office closes, including ordinary ARM64/nonroot/dependency/SDK/CA/scan/runtime inventory and candidate-startup offline gates. No pipeline, infrastructure, build or deployment is created by this source.

METHOD-PINS v2 pins base source/tree/image and file bytes. External post-build binding retains ten fields: baseSourceCommit, baseSourceTree, baseImageDigest, operatorCommit, operatorTree, methodSha256, candidateRecipeSha256, candidateArchiveSha256, candidateImageDigest, candidateQualificationSha256. Candidate digest differs from base. The last hash references Release's actual qualified build/image/readbacks. Operator/build outputs are not embedded in their own inputs. Build and preallocation Release receipts precede the common manifest and must not contain its hash; a later outer receipt joins them. Never bake manifest, private envelope or credentials into the image.

## Compact environment and private driver

Use Release's MODEL490-ENVIRONMENT-MANIFEST-CONTRACT-20261101.json, SHA945be490631a87e7b1363b0349b52becb052f732e89badf3a1a69418919169ff. One MERI_MODEL_QUALIFICATION_MANIFEST value contains canonical ASCII JSON<=1800bytes, schema meri.model-qualification-runtime/1. Closed fields: coordinator,scope,notBeforeMs,expiresAtMs,controlOriginSha256,productionOriginSha256,buildBindingSha256,methodSha256,candidateImageDigest,releaseBindingSha256,candidatePolicySha256,productionPolicySha256,cases, plus schema. Cases are exactly five ordered {id,bindingSha256,requestId}. Existing canonical JSON/hash owner generates commitments; duplicate/unknown/noncanonical input is refused. Shared allocation SHA is SHA256 of exact canonical bytes, never the private credential envelope.

The closed private meri.model-qualification-driver/1 envelope retains exact runtimeManifest and allocationSha256, ten expanded build fields, coordinator/scope/time bounds, full origins, Release/policy hashes, candidateLogGroup, accepted collectorSha256, and cases {id,binding,requestId,sessionCredentialFile,nativeCredentialFile,nativeReceiptFile}. See validatePlan for exact keys. All commitments are checked before effects. Unique case/request/bindings retain one tenant/actor. A separate canonical private-envelope hash enters the exclusive claim and journal. Only driver reads protected credential files. No credential bytes, private paths or expanded bindings enter the environment manifest.

Runtime parses and deletes the manifest slot before SDK imports/loading, keeps the parsed object immutable, and has no file fallback. It hashes the authenticated invocation binding, checks actual loaded request/prompt/pair, and checks invocation/loaded candidate-image versions. SDK observer also refuses a child environment containing the manifest. Existing invocation/control transport carries native credentials.

Release must run assertCandidateEnvironment on its actual configured API map, including CA/origin/source/image/renderer values. Both UTF-8 key/value total and canonical serialized map total<=4000bytes; entries<=50, keys1..100chars, values<=5000chars. The per-value API maximum is not the manifest budget. Retained sample fit proves feasibility only. No compression, chunking, truncation, trust removal or alternate bootstrap. Actual delivery/readback and isolation remain unbound Release gates.

## Inter-case native barrier and collector file amendment

Public completion/usage precede native cleanup and only trigger observation. Before another original request, driver requires the existing createAgentCoreQuery post-cleanup settled receipt, matching effective effort/model/session/tool/accounting facts, and a complete bounded retained collection. Missing/pending/failed/misbound evidence prevents advancement.

Release owns the existing FilterLogEvents collector adaptation: <=24 single-attempt reads/case, <=4pages/pass, <=6passes, limit200, collection<=60s intersected with remaining case/allocation cutoff, each subprocess<=5s, interpass pause<=2s, automatic retries0. Each pass fixes endTime and ends without nextToken. Repeated tokens, failed/malformed/incomplete pages and cap exhaustion are UNKNOWN. This operator creates no collector, AWS client, endpoint or model loop.

The narrow handoff amendment retains the actual existing native-read format. request.json is {atUtc,argv,attempt}; receipt.json retains endUtc,nativeExitCode,stdoutSha256,stdoutBytes,stderrSha256,stderrBytes,outcomeUnknown,invocationConsumed,retries. Raw stdout/stderr stay unchanged. The historical90s helper is not admitted unchanged: Release's separately reviewed adaptation must enforce5s subprocess/CLI limits while preserving these fields. native-receipt.mjs only reads files and never executes argv.

Each exclusive private case directory publishes one final envelope at nativeReceiptFile: schema meri.model-qualification-native-receipt/1; allocationSha256,caseId,binding,requestId,buildBindingSha256,releaseBindingSha256,collectorSha256,logGroupName,runtimeSessionId,startedAtMs,finishedAtMs,passes,extractionFile,extractionSha256. Each pass is {startTime,endTime,pages}; each page is {requestFile,requestSha256,receiptFile,receiptSha256,stdoutFile,stderrFile}. References are bounded basenames in that directory. No PASS field is accepted. Publish only a complete final envelope; missing is pending, malformed/incomplete is a stop.

Verifier checks identity/custody, resolved containment and symlink refusal, hashes, actual read argv/group/time/filter/manual-pagination/no-retry facts, raw pages and exact extraction. Only identical CloudWatch event ID/stream/content transport copies are deduplicated; distinct application duplicates remain. Positive source-bound native settlement and runtimeSessionId are required. Pagination completion does not imply absence of late logs. Release separately verifies owner-only ACLs, execution provenance and actual candidate group/session routing.

Driver reads local final receipt<=60times at1s spacing within original case deadline, initiating no cloud reads. It fsyncs native-case-verified with collection-envelope hash, runtime-row hash and SDK turns/estimate before advancing. Final review reopens original files; changed/missing custody cannot pass. Per-case SDK cleanup does not imply final runtime/listener/transport closure, which still needs owned evidence.

## Prerequisites, execution and disposition

Independent source/method acceptance, accepted collector adaptation/envelope, actual qualified derivative, actual environment sizing/readback, isolated routing/IAM/material, credential/session allocation and cleanup ownership remain unbound. If the retained collector cannot deliver the stated file amendment within bounds, return the constraint; do not invent S3/SSM, mounts, roles, services or endpoints.

Use existing clean-base policy assembly and audited candidate-only tenant CAS/readbacks. Candidate policy enables Sonnet null/high/max and Opus null/high/max, pending empty, Sonnet/null default; qualification tenant caps<=2turns/250000micro-USD plus bounded monthly allocation. Source production policy still holds Opus unavailable/model_unqualified and explicit Sonnet efforts pending. Stored historical IDs are never rewritten/aliased. Prepare five ordinary authenticated fresh General sessions with adequate expiry and no skills/windows/uploads/procedures/source reads/intents or prior model work.

After prerequisites, with existing dependencies/trust:

```sh
node /opt/meri/scripts/qualification/model-effort/runtime.mjs
node scripts/qualification/model-effort/driver.mjs /private/driver-envelope.json /private/new-driver.jsonl
node scripts/qualification/model-effort/review.mjs /private/driver-envelope.json /private/new-driver.jsonl /private/combined-runtime.jsonl /private/new-review.json
```

Native /invocations and /ping remain on8080. Driver creates an exclusive fsynced .attempted claim before effects. Exit2 setup/refusal, exit3 failure/unknown; driver exit0 is completion pending independent review. Preserve all stopped/failure journals, raw receipts and claims.

Review requires matching allocation/private-envelope start, ordered settings/original allocate/admit/submit/history/usage exchanges with correct identities, verified collection barrier before each completion, and exactly one successful terminal batch disposition. Wrong/missing starts, STOP_NO_RESEND, duplicate/partial/out-of-order exchanges, changed files, lost or trailing records make journal UNKNOWN and prevent every case PASS. RUNTIME_CASE_PASS means retained witnesses agree; activationAuthorized always false, provider acknowledgement/invoice UNKNOWN.

Later production maxTurns40/maxBudgetMicroUsd5000000 and catalog activation remain separate Release work after live qualification and independent acceptance: guarded audited tenant CAS plus material rollout/readbacks/inverse operations, not a distributed atomic transaction. Reconcile partial/unknown effects first.

Offline: node --test scripts/qualification/model-effort/controls.test.mjs infra/product-preview/first-chat/runtime-values.test.mjs with existing dependencies. Controls use synthetic ports, real scripted SQL/public receivers and private temporary retained files; no server, DB, provider or SDK child starts.