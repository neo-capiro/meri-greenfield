# Phase-1 failure comparison

Base `3c56c3e981ba868a2af103c4cae9f65a0d47458d`; head is the pre-rebase P1 working tree. This table is historical phase-1 evidence, not the final `bce70776` comparison. Original broad attempts and exact commands remain in [the detailed record](p1-host-checks-phase1.json).

| File | Test | Base | Head | Focused follow-up |
| --- | --- | --- | --- | --- |
| `apps/artifacts/storage/test/constructor-ports.test.mjs` | postgres retains the admitted bound method if configured connect is later replaced by an accessor | fail | fail |  |
| `apps/artifacts/storage/test/find-by-object.test.mjs` | another tenant or conversation, an unknown object, a duplicate holder or a corrupt row is refused | fail | fail |  |
| `apps/artifacts/storage/test/s3-artifact-publication.test.mjs` | S3 publication: purpose namespace is isolated from preview custody and exact full envelope/native receipt is retained | fail | pass |  |
| `apps/artifacts/storage/test/s3-preview-evidence.test.mjs` | synthetic S3 evidence: changed metadata/checksum/native version and403 cannot certify current facts | pass | fail | unchanged selected-name rerun passed |
| `apps/artifacts/storage/test/s3-preview-evidence.test.mjs` | synthetic S3 evidence: immutable append conflict and bounded inventory never overwrite or truncate existing facts | pass | fail | unchanged selected-name rerun passed |
| `apps/artifacts/storage/test/service.test.mjs` | current canonical authorization controls release and generation while storage retains only integrity facts | fail | fail |  |
| `apps/artifacts/storage/test/service.test.mjs` | unchanged artifact service creates/revises/downloads with durable ports and retained original lineage/bytes | fail | fail |  |
| `apps/control/action-host/session/http-independent.test.mjs` | independent actual HTTP opaque issuance reaches same accepted graph/proposal; native bearer, forged proposal and revoked session cannot execute | fail | fail | selected-name failure also reproduced on unchanged base |
| `apps/control/action-host/session/session.test.mjs` | actual HTTP session issuance composes shared-pool host query draft prepare and approved execute | fail | fail |  |
| `apps/control/conversations/skills/service-admission.test.mjs` | opaque session selected-client change during admission prevents durable release | fail | fail |  |
| `apps/control/conversations/skills/service-admission.test.mjs` | plain worker publication cannot invent an artifact availability event | fail | fail |  |
| `apps/control/conversations/skills/service-admission.test.mjs` | revocation after durable acceptance blocks Temporal start and exact replay release | fail | fail |  |
| `apps/control/conversations/skills/service-admission.test.mjs` | same canonical submit persists exact original pins only after trusted admission and rechecks before/after start and replay | fail | fail |  |
| `apps/control/conversations/skills/test/pipeline.test.mjs` | quick_skill.commitments_audit: full actual mounted task persists awaiting approval through restart | fail | fail |  |
| `apps/control/conversations/skills/test/pipeline.test.mjs` | quick_skill.commitments_audit: full actual mounted task publishes real approved DOCX | fail | fail |  |
| `apps/control/conversations/skills/test/pipeline.test.mjs` | quick_skill.relationship_brief: full actual mounted task persists awaiting approval through restart | fail | fail |  |
| `apps/control/conversations/skills/test/pipeline.test.mjs` | quick_skill.relationship_brief: full actual mounted task publishes real approved DOCX | fail | fail |  |
| `apps/control/conversations/skills/test/read-association.test.mjs` | actual source preparation cannot inspect or download a different original under the same output allocation | fail | fail |  |
| `apps/control/conversations/test/completion.test.mjs` | completion rejects scopes proof substitution and leaves no completed event | fail | pass |  |
| `apps/control/conversations/test/event-observation.test.mjs` | idle windows end with a clean close at the cap every time, not with the lifetime deadline | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | a different request ID cannot replace accepted input on the same run | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | a structurally valid store response with substituted binding cannot release an admission receipt | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | a structurally valid store response with substituted prompt cannot release an admission receipt | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | a structurally valid store response with substituted request ID cannot release an admission receipt | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | a structurally valid store response with substituted scope cannot release an admission receipt | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | binding drift after commit withholds receipt; accepted input stays durable without dispatch | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | concurrent different bodies under one identity conflict without another event or dispatch | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | current revocation after reservation lookup prevents acceptance persistence | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | expiry after commit withholds receipt; accepted input stays durable without dispatch | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | lost admission commit acknowledgement recovers positively from existing history and replays exact input | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | relative-window replay finds canonical request before normalization after clock/calendar rollover | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | retention suppression at persistence completion prevents receipt release and positive recovery until reopened | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | revocation after commit withholds receipt; accepted input stays durable without dispatch | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | scope drift after commit withholds receipt; accepted input stays durable without dispatch | fail | fail |  |
| `apps/control/conversations/test/input-admission.test.mjs` | the final current-auth check can withhold an exact replay without another event or dispatch | fail | fail |  |
| `apps/control/conversations/test/lifecycle-transition.test.mjs` | parked continued RPC receives the shorter admission deadline and no later effect dispatches | fail | pass |  |
| `apps/control/conversations/test/lifecycle-transition.test.mjs` | parked continued RPC receives the shorter retirement deadline and no later effect dispatches | fail | fail |  |
| `apps/control/conversations/test/lifecycle-transition.test.mjs` | parked continued RPC receives the shorter target deadline and no later effect dispatches | fail | pass |  |
| `apps/control/conversations/test/lifecycle-transition.test.mjs` | parked start RPC receives the shorter retirement deadline and no later effect dispatches | fail | pass |  |
| `apps/control/conversations/test/lifecycle-transition.test.mjs` | parked start RPC receives the shorter target deadline and no later effect dispatches | fail | pass |  |
| `apps/control/conversations/test/lifecycle.test.mjs` | multiple authorized clients do not permit changing the exact source selected subject on admission | fail | pass |  |
| `apps/control/conversations/test/lifecycle.test.mjs` | parked native admission then authenticated cancel prevents pause resume target/start/continued | fail | pass |  |
| `apps/control/conversations/test/load-amplification.test.mjs` | 500 ms Core replies fit the unchanged 23-second load budget after removing duplicate observations | fail | pass |  |
| `apps/control/conversations/test/load-amplification.test.mjs` | fused runner/load keeps the original authority gates with bounded Core fanout | fail | pass |  |
| `apps/control/conversations/test/startup-composition-latency.test.mjs` | 300 ms Core responses cross load, runtime, status and native prepare/start before the model | fail | fail |  |
| `apps/control/document-application/test/preview-http.test.mjs` | runtime mount: preview record reads and commits are rechecked; a denial at commit is UNKNOWN and publishes nothing | fail | fail |  |
| `apps/control/objective-generation/test/core-http.test.mjs` | non-success, malformed, encoded, oversized and stalled Core replies remain unavailable | fail | pass |  |
| `apps/control/retention/test/data-classes.test.mjs` | serving claims hold in the owners' source: every gated class is served by an owner that consults the canonical read gate | fail | fail |  |
| `apps/control/schedules/test/scheduled-job-workflow.test.mjs` | wrapper cancellation invokes actual job owner once | fail | fail |  |
| `apps/control/schedules/test/scheduled-job-workflow.test.mjs` | wrapper cancellation invokes actual job owner once and preserves failure uncertainty | fail | fail |  |
| `apps/proxy/product/test/test_owner_admission.py` | apps.proxy.product.test.test_owner_admission.AdmissionTests.test_exchange_clock_starts_once_the_carrier_is_held | fail | pass |  |
| `apps/proxy/product/test/test_service_pair_discovery.py` | apps.proxy.product.test.test_service_pair_discovery.DiscoveryTests.test_real_source_reader_compiles_policy_only_from_fresh_pair_and_never_caches | pass | fail | unchanged isolated rerun passed |
| `apps/proxy/product/test/test_telemetry_context.py` | apps.proxy.product.test.test_telemetry_context.TelemetryContextTests.test_inference_response_and_readiness_survive_outcome_classification_failure | pass | fail | unchanged isolated rerun passed |
| `apps/runtime/artifacts/test/download-links.test.mjs` | real canonical owners: a link issued for a generated workbook redeems its exact bytes and is revoked by a suppression cycle | fail | fail |  |
| `apps/runtime/artifacts/test/runtime.test.mjs` | real original compiler and generator traverse actual HTTP mount and reviewed S3/PG ports for create/revise/inspect/download | fail | fail |  |
| `apps/runtime/artifacts/test/runtime.test.mjs` | typed XLSX full replacement preserves original, exact parent and immutable bytes | fail | fail |  |
| `apps/runtime/native-authority/retained-reads/test/control.test.mjs` | concrete enabled CONTROL factory installs its ports into the same canonical gateway | fail | pass |  |
| `apps/runtime/native-authority/retained-reads/test/control.test.mjs` | default disabled control/client/broker are inert | pass | fail | explicit previous3000ms fixture default supplied; selected-name rerun passed |
| `apps/runtime/native-authority/retained-reads/test/control.test.mjs` | synthetic get_florida_budget_project: concrete CONTROL authority/broker/POST reaches canonical durable receipt once | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/native-authority/retained-reads/test/control.test.mjs` | synthetic get_research_portfolio: operation-specific resource drift after source withholds bytes | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/native-authority/test/business-development-personal.test.mjs` | BD personal get_business_development_recent_changes: a client relationship in native context is not rewritten into a task client grant | pass | fail | unchanged isolated rerun passed |
| `apps/runtime/native-authority/test/business-development-personal.test.mjs` | BD personal get_business_development_recent_changes: exact actor private-user scope and combined tenant/private-user scopes remain usable | pass | fail | unchanged isolated rerun passed |
| `apps/runtime/native-authority/test/continuation-authority.test.mjs` | resume admission derives one target per control from the verified source and checkpoint, idempotently | fail | fail |  |
| `apps/runtime/native-authority/test/deferred-process-independent.test.mjs` | one exact deferred request queues before admitted launch; genuine child bytes register only after release | fail | fail |  |
| `apps/runtime/native-authority/test/funding-runtime.test.mjs` | all five funding RPCs still require current installed membership | fail | pass |  |
| `apps/runtime/native-authority/test/native-start-router-budget.test.mjs` | reproduction: the deployed eight-second router enclosure cuts start inside a nested authority call | fail | pass |  |
| `apps/runtime/native-authority/test/read-composer.test.mjs` | the full P2 measurement needs all 21 retained handlers; task-bound ports compose the exact 76 | fail | fail |  |
| `apps/runtime/native-authority/test/read-family-subsets.test.mjs` | selected operations still require current discovered membership | fail | pass |  |
| `apps/runtime/native-authority/test/read-family-subsets.test.mjs` | selected operations still require current installed membership | fail | pass |  |
| `apps/runtime/native-authority/test/read-runtime-factory.test.mjs` | per-entry factory receives canonical READS verifier, same task capability and immutable config | fail | pass |  |
| `apps/runtime/native-authority/test/reads.test.mjs` | native client/receiver reaches canonical durable source once, validates bytes and preserves uncertain duplicate | fail | pass |  |
| `apps/runtime/native-authority/test/remote-task.test.mjs` | actual separate supervisor/native child crosses remote byte facade and canonical registration | fail | fail |  |
| `apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs` | SDK initialization milestones through the deferred remote process facade | fail | fail |  |
| `apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs` | a CLI ended by SIGKILL after initialize is reported with its SDK class and exit, never UNKNOWN | fail | fail |  |
| `apps/runtime/native-authority/test/sdk-initialization-milestones.test.mjs` | a CLI ended by SIGTERM after initialize is reported with its SDK class and exit, never UNKNOWN | fail | fail |  |
| `apps/runtime/native-authority/test/supervisor-workspace.test.mjs` | worker stdin byte JSON cannot invoke trusted workspace RPC after actual fixture child launches | fail | fail |  |
| `apps/runtime/native-authority/test/task-verifier.test.mjs` | canonical durable session owner uses native HTTP verifier inside locked SQL effect | fail | pass |  |
| `apps/runtime/product-ports/test/lifecycle-continuation.test.mjs` | a rejected or undecided proposal never retires, admits or dispatches | fail | fail |  |
| `apps/runtime/product-ports/test/lifecycle-continuation.test.mjs` | an unproven native stop is a barrier: no admission, no target run, the control UNKNOWN | fail | fail |  |
| `apps/runtime/product-ports/test/lifecycle-continuation.test.mjs` | approval.wait settles: the approved decision read from Core with the live session, the source retired and the derived successor APPLIED | fail | fail |  |
| `apps/runtime/product-ports/test/lifecycle-continuation.test.mjs` | without a live approver session the decision read refuses before Core and nothing is dispatched | fail | fail |  |
| `apps/runtime/test/cli-reads-composition.test.mjs` | cli passes exactly installation {enabled, measurement, measurementSha256, revokedOperations} and discovery {enabled, capabilityPolicy} to the reads composer | fail | pass |  |
| `apps/runtime/test/cli-reads-composition.test.mjs` | disabled installation and discovery pass their toggles only; absent blocks pass no key; discovery without capabilityPlatform is refused by configuration | fail | pass |  |
| `apps/runtime/test/download-links-mount.test.mjs` | absent or disabled configuration keeps the link routes closed, reads no key and leaves other document routes unchanged | fail | fail |  |
| `apps/runtime/test/download-links-mount.test.mjs` | an unreadable or short signing key keeps the gate closed after the store is verified | fail | fail |  |
| `apps/runtime/test/download-links-mount.test.mjs` | each missing owner keeps the gate closed with its own reason and never reads the signing key | fail | fail |  |
| `apps/runtime/test/download-links-mount.test.mjs` | verified owners open the gate before the listener; the key is read once through readSecret and the routes reach the link application | fail | fail |  |
| `apps/runtime/test/first-run-mount.test.mjs` | compiled startup factory receives the same owned pool/native before readiness and listener | fail | fail |  |
| `apps/runtime/test/first-run-mount.test.mjs` | mount captures original preadmitted data and issues an actual action session through canonical product SQL | fail | fail |  |
| `apps/runtime/test/first-run-mount.test.mjs` | mounted SDK registration joins current product allocation with the borrowed verifier and registration reader | fail | fail |  |
| `apps/runtime/test/first-run-mount.test.mjs` | precompiled borrowed owner is captured before asynchronous startup and retains its receiver | fail | fail |  |
| `apps/runtime/test/first-session.test.mjs` | one scripted SDK query obtains its first mirror key and settles before durable completion | fail | fail |  |
| `apps/runtime/test/first-session.test.mjs` | scripted success without first mirror cannot produce durable completed state | fail | fail |  |
| `apps/runtime/test/funding-source-integration.test.mjs` | a bridge HTTP refusal remains a single failed source attempt with UNKNOWN hold and no legacy retry | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/test/funding-source-integration.test.mjs` | get_funding_opportunity_requirements: synthetic governed source consumes the private observation and settles exact original request/result bytes | fail | pass |  |
| `apps/runtime/test/funding-source-integration.test.mjs` | get_opportunity_client_context: synthetic bridge read succeeds through actual MCP with current client authority and durable settlement | fail | pass |  |
| `apps/runtime/test/funding-source-integration.test.mjs` | search_funding_opportunities: synthetic governed source consumes the private observation and settles exact original request/result bytes | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/test/general-read-port.test.mjs` | remote runner constructs the canonical native client from bootstrap config and TASK credential when no borrowed port exists | fail | fail |  |
| `apps/runtime/test/general-read-port.test.mjs` | remote runner retains passive read port through existing execute boundary (false) | fail | fail |  |
| `apps/runtime/test/general-read-port.test.mjs` | remote runner retains passive read port through existing execute boundary (true) | fail | fail |  |
| `apps/runtime/test/general-read-runtime.test.mjs` | synthetic control factory get_research_portfolio: measured installation and durable gateway execute once | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/test/general-read-runtime.test.mjs` | synthetic control factory get_research_portfolio_changes: measured installation and durable gateway execute once | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/test/kb-source-integration.test.mjs` | semantic KB ordinary-empty consumes one retained observation and settles unchanged native result bytes | pass | fail | unchanged single-name rerun passed on both base and head |
| `apps/runtime/test/kb-source-integration.test.mjs` | semantic KB success consumes one retained observation and settles unchanged native result bytes | pass | fail | unchanged selected-name rerun passed |
| `apps/runtime/test/model-material-roles.test.mjs` | model-proxy root init stages, verifies and hands files and directory to 10001:10001 | fail | fail |  |
| `apps/runtime/test/model-material-roles.test.mjs` | proxy configuration is validated inside the plan with the Python startup rules | fail | fail |  |
| `apps/runtime/test/native-runner-gateway.test.mjs` | relay executes canonical task-authorized load/publish and denies foreign/revoked tasks before further durable effects | fail | fail |  |
| `apps/runtime/test/original-native-composition.test.mjs` | READS lookup never prepares or allocates; global control and missing/foreign entries cannot borrow authority | fail | fail |  |
| `apps/runtime/test/original-native-composition.test.mjs` | joint original startup uses actual accepted request, fixed expiry, canonical task/model facts and same registry session owner | fail | fail |  |
| `apps/runtime/test/original-native-composition.test.mjs` | static original or changed accepted input cannot receive new canonical authority, stop-only never issues | fail | fail |  |
| `apps/runtime/test/original-run-facts.test.mjs` | apps/runtime/test/original-run-facts.test.mjs | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | UNKNOWN original remains UNKNOWN until existing issuer reconciliation, never reminted | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | accepted request change across preparation withholds entry after durable issuance | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | actual accepted request and fixed original expiry reach the SAME canonical issuer; recreated helper never remints | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | already allocated static original never receives retrofitted canonical material | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | an original becoming statically allocated during preparation withholds the new entry | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | canonically issued allocated original replays only exact existing grant/facts/allocator identity | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | changed request under original issuance refuses without new material | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | recomputed original expiry conflicts and expired original cannot reach a port | fail | fail |  |
| `apps/runtime/test/original-run-preparation.test.mjs` | stopOnly refuses before every owner port, including an absent original | fail | fail |  |
| `apps/runtime/test/pinned-native-transport.test.mjs` | [posix-real-ca] a CA file owned by another uid is refused even at mode 0600 | fail | fail |  |
| `apps/runtime/test/prepared-candidate-control-lifetime.test.mjs` | parent cancellation retains actual control HTTP through ordered original candidate cleanup | fail | fail |  |
| `apps/runtime/test/prepared-candidate-fetch-propagation.test.mjs` | assembled multi-run registry receives the same injected HTTP transport as first-run and Core authority | fail | fail |  |
| `apps/runtime/test/prepared-candidate.test.mjs` | public candidate mounts actual issuance and queued submit before lazy allocation, and private readiness is control-only | fail | fail |  |
| `apps/runtime/test/process.test.mjs` | actual control listener mounts canonical opaque issuance, submit/history and task-authorized RPC | fail | fail |  |
| `apps/runtime/test/process.test.mjs` | actual listener rejects cross-origin and incorrect methods; dependency loss changes readiness | fail | fail |  |
| `apps/runtime/test/process.test.mjs` | actual process exits on SIGTERM after listener shutdown | fail | fail |  |
| `apps/runtime/test/process.test.mjs` | actual runner command composition consumes steering and canonically captures completed checkpoint | fail | fail |  |
| `apps/runtime/test/process.test.mjs` | actual runner completion route refuses current authority instead of fabricating completion | fail | fail |  |
| `apps/runtime/test/process.test.mjs` | actual runner native capture refusal leaves pause unverified, retains UNKNOWN control and fails the hold explicitly | fail | fail |  |
| `apps/runtime/test/product-mount.test.mjs` | runner preserves exact observed key, strips private selector and closes owned mirror | fail | fail |  |
| `apps/runtime/test/product-mount.test.mjs` | runner refuses missing observed registration before the single SDK query | fail | fail |  |
| `apps/runtime/test/product-mount.test.mjs` | uncertain observed SDK mirror prevents durable completed status and releases no success | fail | fail |  |
| `apps/runtime/test/product-routines-flow.test.mjs` | one actual factory flow completes inbox output then cancels future firings without inventing an active target | fail | fail |  |
| `apps/runtime/test/product-routines-flow.test.mjs` | one actual factory flow publishes partial inbox output then explicitly cancels and retires its real job | fail | fail |  |
| `apps/runtime/test/restart-retirement.test.mjs` | public Stop after a cold restart retires the failed original despite Temporal NOT_FOUND, without new authority | fail | fail |  |
| `apps/runtime/test/restart-retirement.test.mjs` | public Stop after a cold restart retires the running original despite Temporal NOT_FOUND, without new authority | fail | fail |  |
| `apps/runtime/test/restart-retirement.test.mjs` | public Stop preserves UNKNOWN on grant revocation failure; a repeated Stop after restart cleans up without redispatch | fail | fail |  |
| `apps/runtime/test/runtime.test.mjs` | isolated runner invokes canonical activity and one scripted SDK query, preserving durable events | fail | fail |  |
| `apps/runtime/test/schedule-service.test.mjs` | actual service retains pause through retirement/resume and cancels only the real target | fail | pass |  |
| `apps/runtime/test/start-control-port-boundary.test.mjs` | actual startControl default path reaches listener and closes only its own resources | fail | fail |  |
| `apps/runtime/test/start-control-port-boundary.test.mjs` | actual startControl direct path reaches listener and closes only its own resources | fail | fail |  |
| `apps/runtime/test/start-control-port-boundary.test.mjs` | actual startControl factory path reaches listener and closes only its own resources | fail | fail |  |
| `apps/runtime/test/start-control-port-boundary.test.mjs` | actual startControl prepared path reaches listener and closes only its own resources | fail | fail |  |
| `apps/runtime/test/start-control-port-boundary.test.mjs` | prepared startup composes supplemental direct membership without replacing canonical identity | fail | fail |  |
| `apps/runtime/test/start-control-port-boundary.test.mjs` | prepared startup composes supplemental factory membership without replacing canonical identity | fail | fail |  |
| `apps/runtime/test/startup-history.test.mjs` | trusted startup composes canonical session, submit and membership history, with missing lifecycle owners refused before writes | fail | fail |  |
| `apps/runtime/test/task-preferences-integration.test.mjs` | public mounts are exact and both applications remain excluded from the protected listener | fail | fail |  |
| `apps/runtime/test/temporal-issuer-cli.test.mjs` | actual executable help is inert and main handles normal TERM/INT through its owned entrypoint and pool | fail | fail |  |
| `apps/runtime/test/temporal-issuer-cli.test.mjs` | main keeps its retirement watchdog referenced and exits 3 when a close never settles | fail | fail |  |
| `apps/runtime/test/worker-load-retention.test.mjs` | deadline during release acquisition frees locks and prevents late serialization | fail | pass |  |
| `apps/worker/conversation/intents/test/options.test.mjs` | the activity mounts meri_intents only when policy enables governed intents and an owner can prepare one | fail | fail |  |
| `apps/worker/conversation/reads/test/business-development.test.mjs` | BD SDK get_business_development_context: an explicit one-call budget settles once then refuses another source dispatch | pass | fail | same selected-name failure reproduced on unchanged base and head |
| `apps/worker/conversation/reads/test/business-development.test.mjs` | BD SDK get_business_development_recent_changes: client-bound reads retain the exact Core conversation/client proof | fail | fail |  |
| `apps/worker/conversation/reads/test/business-development.test.mjs` | BD SDK get_business_development_recent_changes: personal fixed native read settles exact MCP bytes without a conversation authority port | pass | fail | unchanged selected-name rerun passed |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK get_state_bill_status: actual hook, source bytes, delivery hashes and durable receipts settle once | fail | pass |  |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK get_state_bill_status: native designation quota remains an honest received result | pass | fail | selected-name failure also reproduced on unchanged base |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK search_committee_hearings: a native name change after source withholds all bytes and keeps UNKNOWN | fail | pass |  |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK search_committee_hearings: actual hook, source bytes, delivery hashes and durable receipts settle once | pass | fail | unchanged selected-name rerun passed |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK search_committee_hearings: current task, capability and native principal are required before source credentials | pass | fail | unchanged selected-name rerun passed |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK search_tracked_bills: current availability removal after listing prevents gateway execution | pass | fail | unchanged selected-name rerun passed |
| `apps/worker/conversation/reads/test/completion.test.mjs` | completion SDK search_tracked_bills: native name observation preserves original raw hashes and dispatches only the admitted UUID | pass | fail | unchanged single-name rerun passed |
| `apps/worker/conversation/reads/test/funding.test.mjs` | funding SDK get_funding_opportunity: a foreign literal client or revoked native client visibility releases no source credential | fail | pass |  |
| `apps/worker/conversation/reads/test/funding.test.mjs` | funding SDK get_opportunity_government_landscape: a foreign literal client or revoked native client visibility releases no source credential | pass | fail | unchanged selected-name rerun passed |
| `apps/worker/conversation/reads/test/funding.test.mjs` | funding SDK get_opportunity_government_landscape: normal hook/source execution retains raw arguments, captured anchor, delivery hashes and settled receipts | fail | fail |  |
| `apps/worker/conversation/reads/test/kb.test.mjs` | KB SDK semantic empty: actual hook preserves original request, once-captured context, delivery and durable receipts | fail | pass |  |
| `apps/worker/conversation/reads/test/kb.test.mjs` | KB SDK semantic foreign-client: current authority refuses before source credentials and reservation | fail | pass |  |
| `apps/worker/conversation/reads/test/kb.test.mjs` | KB SDK semantic unavailable: actual hook preserves original request, once-captured context, delivery and durable receipts | fail | pass |  |
| `apps/worker/conversation/reads/test/kb.test.mjs` | KB SDK: personal graph remains available with empty context and no semantic carrier or client tool | fail | pass |  |
| `apps/worker/conversation/reads/test/newmode.test.mjs` | mode SDK get_program_element: an actual personal task retains native mode authority without an invented client grant | fail | pass |  |
| `apps/worker/conversation/reads/test/newmode.test.mjs` | mode SDK search_program_elements: a mode change during source-secret acquisition prevents tool HTTP | pass | fail | unchanged selected-name rerun passed |
| `apps/worker/conversation/reads/test/newmode.test.mjs` | mode SDK search_program_elements: an actual personal task retains native mode authority without an invented client grant | fail | pass |  |
| `apps/worker/conversation/reads/test/options.test.mjs` | the activity mounts meri_reads only when policy enables general reads and a read is available | fail | fail |  |
| `apps/worker/conversation/reads/test/research-legal.test.mjs` | legal SDK client: actual hook preserves raw selectors, admitted context, source results and durable receipts | fail | pass |  |
| `apps/worker/conversation/reads/test/research-legal.test.mjs` | legal SDK global: actual hook preserves raw selectors, admitted context, source results and durable receipts | fail | pass |  |
| `apps/worker/conversation/reads/test/research-legal.test.mjs` | legal SDK named: actual hook preserves raw selectors, admitted context, source results and durable receipts | fail | pass |  |
| `apps/worker/conversation/reads/test/server.test.mjs` | a duplicate delivery yields one receipt and one source call, including after a restart | fail | fail |  |
| `apps/worker/conversation/reads/test/server.test.mjs` | an authorized read returns the canonical page unmodified and one receipt bound to the durable delivery | fail | fail |  |
| `apps/worker/conversation/reads/test/server.test.mjs` | argument-borne authority and forged correlation never reach the gateway | fail | fail |  |
| `apps/worker/conversation/reads/test/server.test.mjs` | the per-call deadline ends the call with no receipt and leaves the durable outcome UNKNOWN, which blocks further dispatch | fail | fail |  |
| `apps/worker/conversation/reads/test/server.test.mjs` | the per-run call ceiling refuses at the hook before any further gateway effect | fail | fail |  |
| `apps/worker/conversation/reads/test/server.test.mjs` | the session is pinned on continuation and a closed server correlates nothing | fail | fail |  |
| `apps/worker/conversation/reads/test/source-slices.test.mjs` | query_economic_data: current native revision revocation after source withholds SDK bytes and receipt | fail | pass |  |
| `apps/worker/conversation/reads/test/source-slices.test.mjs` | query_knowledge_graph: actual mounted owner and MCP tool preserve exact source bytes and durable receipt | fail | pass |  |
| `apps/worker/conversation/reads/test/source-slices.test.mjs` | query_knowledge_graph: current native revision revocation after source withholds SDK bytes and receipt | fail | pass |  |
| `apps/worker/conversation/skills/test/selected-runtime.test.mjs` | quick_skill.commitments_audit: actual SDK server -> HTTP handler -> canonical gateway -> existing collector retains output awaiting separate approval | fail | fail |  |
| `apps/worker/conversation/skills/test/selected-runtime.test.mjs` | quick_skill.relationship_brief: actual SDK server -> HTTP handler -> canonical gateway -> existing collector retains output awaiting separate approval | fail | fail |  |
| `apps/worker/conversation/test/activity-browser.test.mjs` | a browser cleanup that cannot be verified surfaces as SDK_CLEANUP_UNKNOWN instead of a clean completion | fail | fail |  |
| `apps/worker/conversation/test/activity-browser.test.mjs` | a configured browser port is asked for the run policy, composes nothing while held, and its cleanup runs after a completed run | fail | fail |  |
| `apps/worker/conversation/test/activity-browser.test.mjs` | browser cleanup also runs when the run fails, and a refused browser policy fails the run before any query | fail | fail |  |
| `apps/worker/conversation/test/run-budgets-mounts.test.mjs` | the early read ledger follows the run's admitted maxToolCalls below and above the default, and keeps 20 without one | fail | fail |  |
| `docs/coordination/audits/meri-package4-qualification-20261016/accepted-followup-closure/combined-loading.test.mjs` | docs/coordination/audits/meri-package4-qualification-20261016/accepted-followup-closure/combined-loading.test.mjs | fail | fail |  |
| `docs/coordination/audits/meri-package4-qualification-20261016/combined-loading/combined-loading.test.mjs` | docs/coordination/audits/meri-package4-qualification-20261016/combined-loading/combined-loading.test.mjs | fail | fail |  |
| `docs/qualification/candidates/original-runtime-20261013/source-independent/control-composition-review.test.mjs` | actual canonical admission precedes storage/start and original pins survive exact replay | fail | fail |  |
| `docs/qualification/candidates/original-runtime-20261013/source-independent/control-composition-review.test.mjs` | exact selected-client revocation during admission refuses before persistence | fail | fail |  |
| `docs/qualification/candidates/original-runtime-20261013/source-independent/control-composition-review.test.mjs` | unconfigured selected output and ordinary worker artifact event cannot mint availability | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | actual submit consumer normalizes trusted Sunday calendar window through DST at fixed reference | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | all14 explicit selected originals refuse unavailable source operations before store or Temporal dispatch | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | cancelled subscription aborts its owned polling signal and cannot release a later page | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | exact retained normalized calendar window reaches the actual SDK query input with scopes and immutable context | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | external pipeline cancellation after SDK text stops completion, closes query and preserves earlier durable text | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | lost event COMMIT acknowledgement preserves exact text/event identity after owner reconstruction without duplicate event | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | source/tool/thinking/subagent diagnostics never become public AI SDK events or receipts | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | two simultaneously prepared activities permit one winning SDK execution without loser poisoning | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | unknown request commit remains durable but current revocation blocks retry/release and no new dispatch | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | worker exact immutable selected pin tampering refuses before SDK query and never injects changed prose | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-reliability-independent/lifecycle-independent.test.mjs` | worker valid exact asset pin still refuses the unchanged canonical unavailable runtime manifest | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/independent.test.mjs` | Current changed scope refuses worker publication before any durable event mutation | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/independent.test.mjs` | Exact calendar request replay retains original resolution across week rollover | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/independent.test.mjs` | Failure observation cannot park SDK Query cleanup after original activity deadline | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/independent.test.mjs` | Losing concurrent activity cannot poison the legitimate starting owner | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/independent.test.mjs` | Retained event ID column alias refuses disclosure despite consistent JSON hash | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/independent.test.mjs` | Retained event sequence column alias refuses disclosure despite consistent JSON hash | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/repaired-edge.test.mjs` | Cancellation binds current scopes to the exact locked run before append | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/repaired-edge.test.mjs` | Immutable fiscal replay uses retained window when current configuration is absent | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/repaired-edge.test.mjs` | SDK close failure never releases raw provider diagnostics from activity | fail | fail |  |
| `docs/qualification/candidates/usable-request-20261013/lifecycle-source-independent/repaired-edge.test.mjs` | The sole SDK query receives the persisted exact normalized window | fail | fail |  |
| `infra/product-preview/first-chat-observability.test.mjs` | CLI help and invalid flags are bounded without reading files; malformed input does not emit a partial template | fail | pass |  |
| `infra/product-preview/first-chat-observability.test.mjs` | suppression filters use the complete literal tokens emitted after the owner and proxy diagnostic budgets fill | pass | fail | existing fixture supplies previous60000ms owner and60s Python diagnostic windows; selected-name rerun passed |
| `infra/product-preview/first-chat/render-features.test.mjs` | no features (absent or {}) renders byte-identical material and summary to the reviewed render at BASE | fail | fail |  |
| `infra/product-preview/first-chat/render-features.test.mjs` | runtime values: the capability profile reaches the measurement and the assembled pin; without the feature nothing changes | fail | fail |  |
| `infra/product-preview/first-chat/runtime-values.test.mjs` | assembled runtime.json renders all five roles through every render-material validator with throwaway PKI | fail | fail |  |
| `infra/product-preview/material-init.test.mjs` | CLI has import-safe help, closed arguments, bounded material refusal and no material in diagnostics | fail | fail |  |
| `packages/contracts/test/conversation-initial-input-public.test.mjs` | initial-input generation records exact canonical provenance and one shared browser import | fail | pass |  |
| `packages/contracts/test/conversation-input-public.test.mjs` | input-only generation records exact canonical provenance and one shared browser import | fail | pass |  |
