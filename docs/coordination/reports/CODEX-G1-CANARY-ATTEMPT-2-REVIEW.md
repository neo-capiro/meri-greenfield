# Independent review of the second canary proposal

10 October 2026 UTC. Codex `contract_review`, independently reviewing the integration owner's DATA/controller proposal. I coauthored the historical wire-v2 compiler repair; I did not author this second-run proposal, change-set script, controller or fallback. Review base: `ad4d90e53c2e79a378857dc1706eed465d3c1688`. No Hermes, AWS, compiler/evaluator, container, provider or task execution occurred in this review.

**Conditionally suitable for one new synthetic sleep-only qualification experiment**, subject to the fresh owner checks below. This is neither ExecuteChangeSet/StartExecution authority nor runtime qualification, security waiver or G1 acceptance. The first run remains permanently consumed; no retry/redrive or reservation reset is accepted.

## First attempt and clock correction

I read and remeasured the first attempt's complete history, DescribeExecution, StartedBy task query, original input and controller binary streams/exit envelope. The history has exactly five events, ids1–5: ExecutionStarted, ChoiceStateEntered/Exited at GuardInput, FailStateEntered and ExecutionFailed. There is no next page, TaskScheduled or service/RunTask event. DescribeExecution is FAILED/AdmissionRefused, version1, redriveCount0. The task query is empty. The controller exited0 at15:30:28.268366Z after its one start acknowledgement; its exit does not establish managed containment.

Original input t0=1791646227268 (15:30:27.268Z); AWS execution start15:30:27.053Z. The supplied t0 was exactly215ms later, so the unchanged `t0 <= Execution.StartTime` condition was false. This is a sufficient refusal explanation, not proof that every other context predicate was observed. No worker was dispatched and no StopTask/physical cleanup was required for this first attempt. See the unchanged [first-attempt record](CODEX-G1-CANARY-ATTEMPT-1.md).

The new controller uses `t0=int(nowUTC*1000)-2000`. Its original D=t0+720000 and C=t0+900000 remain; the existing30s admission guard remains unchanged. This conservatively shortens available time. It does not guarantee arbitrary clock skew, delayed dispatch or success: a start outside the guard must still fail closed and consume this new attempt. It supplies no local cleanup timer and exits after acknowledgement; an independent observer must measure the managed workflow and physical termination.

## Exact candidate and source identity

New run `1b4fc350-7391-4c40-9e3b-b2bb27a1cfbc`; binding `6fa52a532cbe940a5bd546f96b4830e8cce1292e4a2c1401e09872c36a9a763e`. All eleven compiler dependency files equal the first reviewed records, current raw working bytes and Git blobs at `651ec8ce136a9ed3b22f911ea0dac90f33de40c7`. The inert manifest's before/after source records and all four inert output hashes match. This is a trusted checkout identity check, not hostile filesystem attestation.

| Artifact under `.task-inputs/CODEX-G1-canary-admission-data-4/` | Bytes | SHA256 |
|---|---:|---|
| `inert-prepared/manifest.json` |20513|`92c6c7d6075059bbeca61b2e02afd9a1f2213b4dba68cd5dc4ecb1915ba54f6d`|
| `static-pins.json` |6017705|`318ab033dfaeb3b11e850b18fb849d3c8692574f1e12f15359d0b513a4bc1903`|
| `deployment-candidate/definition.json` |145984|`5603bcfb499e4249e8e880a405f279c0b2b939c980f21936e6af4793bb89fb04`|
| `deployment-candidate/template.json` |3896|`1ac960cf763018dde1cc7fdc2b758d6fa7d0fbfd9c4bb7fb65b3f9442088923d`|
| `deployment-candidate/proposal.json` |1648|`471d7b394e27811fe7948c580ea784b7c841a17f68896f96c06f5c1a3fc1a81d`|

Complete inert→candidate comparison permits only GuardInput's exact false→true literal, binding/template runtimeEnabled metadata and the already reviewed external versioned definition transport. It does not change any other graph field. The candidate has94 states and10 service Task states, unchanged from the first proposal.

Complete first→second candidate leaf comparison covers all267 graph leaves:15 exact run/binding literal replacements and252 authority-reference leaves across twelve record outputs. Those outputs are AdmissionRecord, LaunchAttemptRecord, RunResultRecord, PageRecord, DescribeCandidateWire, OwnershipRecord, ObservedRecord, PreStopDescribeWire, PreStopRecord, StopResultRecord, TerminalDescribeWire and TerminalRecord. Each receives the same ten new binding references. Whole-object reconstruction using only these exact literals/paths equals the candidate; no expression normalization or shorter-string inference was used. Choice predicates, state transitions, Task arguments except run-bound literals, TimeoutSeconds, Catch paths, context/ledger shapes and budgets are otherwise identical.

The23 binding leaves are the new run and binding plus21 authority-reference fields. All ten reference paths move from data2 to data4 and all ten version labels become15:33:53.500262Z; only the image body's hash changes. Nine authority bodies are unchanged. The image body changes only `image.imageDetails[0].lastRecordedPullTime`, an observational pull-time field. All ten body strings/hash bindings match their exact local records.

The new image/IAM/network/DNS/log/KMS/task-definition/security bodies equal the corresponding retained start-authority1 responses, independently remeasured with their raw envelopes. Thirty-nine authority captures plus the three first-attempt observations were checked. The earlier owner comparison's32-document claim is historical metadata discovery, not a fresh start grant. These captures predate the first failed execution; managed-executions=[] from that capture cannot describe the later failed execution or present activity. Fresh start-authority2 is mandatory.

## Proposed UPDATE and private executors

The template remains exactly two resources on the existing **dedicated new qualification** stack `MeriGreenfield-NativeCanaryEnforcement`: NativeEnforcementRole and NativeEnforcementMachine. Machine `meri-greenfield-native-enforcement-canary-20261010`, role `MeriGreenfield-NativeEnforcement-Canary-20261010`, trust, action/resource permissions and every other template field remain unchanged. Complete template difference has exactly five leaves:

- Metadata.staticBindingId;
- NativeEnforcementMachine DefinitionS3Location.Key;
- NativeEnforcementRole Statements0/1 `aws:RequestTag/QualificationRun` and Statement3 `aws:ResourceTag/QualificationRun` values, old UUID→new UUID.

The six proposal leaves are the corresponding definition/template/source-manifest hashes, run/binding and definition key. Failed data3's alternate names are preserved; this review accepts no name-contract change. The new key is `inputs/native-canary-1b4fc350-7391-4c40-9e3b-b2bb27a1cfbc/5603bcfb499e4249e8e880a405f279c0b2b939c980f21936e6af4793bb89fb04.json` in the existing new qualification build bucket. DefinitionObjectVersion remains the sole parameter. Same KMS key, conditional IfNoneMatch*, SHA256/checksum, exact immutable version HEAD and full-byte GET are required.

I fully read `codex-g1-canary-changeset-run2.py`. It binds complete proposal, graph, template and inert source manifest; takes explicit approval raw SHA; writes exclusive snapshots before consuming its one upload/UPDATE-change-set reservation; uses only those copies for arguments; verifies returned version/checksum/encryption/metadata/full definition bytes; and performs immediate byte checks before PutObject/CreateChangeSet. It has no ExecuteChangeSet, StartExecution, retry or redrive path. Its trusted owner Python invocation must retain assertions (`-O` is prohibited). Actual CloudFormation effects cannot be proven by prospective template: the owner must inspect exactly two Modify operations, no replacement/add/remove/import/nested expansion, exact existing stack/role/machine and sole exact S3 version before executing once.

I fully read `codex-g1-canary-controller-run2.py`, including two narrow review repairs. It now pins the inert manifest raw SHA before trusting compilerRecords, and repeats the ten-minute age assertion after three fresh calls and immediately before t0/reservation/start. Before its one permanent execution reservation it requires exact immutable version2 and definition SHA, explicit approval SHA, current eleven-source bytes, fresh owner summary and exact fresh caller/empty running-task query/current managed policy. The five-field input and start name are fixed to this run. It calls StartExecution once and records acknowledgement; any error or uncertainty leaves the reservation consumed and requires read-only reconciliation, never retry. Freshness checks and local exclusive files are sequential observations under trusted owner/filesystem/profile assumptions, not an atomic anti-admin boundary.

The run2 fallback is byte-exactly the reviewed public `canary_cleanup.py` after four single-occurrence literal substitutions: private location parents[2]→parents[1], runtime1→runtime2 evidence path, UUID and binding. No logic change. Therefore I did not rerun the unchanged21 fake tests. Its existing strict task/definition/cluster/group/current-three-tags/creation-window/fresh-caller/one-reservation checks remain; no foreign or ambiguous task is admitted. StopTask acknowledgement is not STOPPED. Its bounded45s CLI calls do not themselves enforce C900 or provide a durable watcher. Fallback use can never count as managed-survival PASS.

| Reviewed private script | Bytes | SHA256 |
|---|---:|---|
| `codex-g1-canary-changeset-run2.py` |6656|`88083f5905486bf61714862ed419d6ffb60eb2ee8b29e47bb6d739972aaaf430`|
| `codex-g1-canary-controller-run2.py` |5990|`1da5b3b42e3cb6a7550ecdd7185e52c067a088d5d6952bcf22ccc3eccd499567`|
| `codex-g1-canary-cleanup-run2.py` |7620|`3e4bc7d141a6cfc81e843e04c88cc8fe8fa43d7efc643f25e80bd9ea85511e1e`|

## Conditional disposition and unresolved measurements

Only the exact bf55 image, canary task-definition revision1, `/usr/bin/sleep 1200`, UID10001/read-only root/dropALL/fresh volumes, reviewed private-subnet/no-public-IP/DNS/AWS-endpoint boundaries are in scope. The empty task role may vend credentials; it has no source/database/provider/admin permission, and is not credential-free. All49 findings, including4critical/18high, and five older vendor-open findings remain OPEN. This is a proposed explicit owner residual-risk decision for a fixed synthetic non-parser command; network/read-only controls do not prove native vulnerabilities harmless. No uploads, business/source data, model calls or broader workload is accepted.

Before UPDATE execution/start the owner must refresh authority and ensure no existing canary task needs the old run-tag StopTask grant. First-run complete history establishes that run dispatched none; fresh current activity remains necessary. Require exact server template/parameters/two Modify/no replacement, successful stack update, actual policy/definition readback and immutable version2 byte identity. Reconcile first run and new run independently; no overlap, automatic start retry, redrive or consumed-input reuse.

Provisional nested CreatedAt ISO mode, actual task/container/attachment wire, IAM launch/stop, controller-loss managed containment and physical STOPPED/worker-exit by C remain unmeasured. A managed fatal error can bypass cleanup. The exact-owned emergency fallback must be available, and its use, late/unknown cleanup, missing terminal evidence or ambiguous launch means FAILED_OR_UNKNOWN and blocks every next launch. Application nonzero-exit FAILED semantics remain distinct from containment success. No browser/Office/SDK/product/source/release or G1 gate passes here.

Independent ignored evidence: `.task-inputs/CODEX-G1-canary-admission-review-2/`. The first DATA checker reached its controller-envelope check then failed on my wrong nested `stdout` field assumption; actual envelope uses `stdoutBytes`/`stdoutSha256`. Original checker/failure/Git captures remain. A separately named checker/output directory corrected only that local data interpretation and passed102 checks. The separate exact-delta checker passed43 checks. No candidate defect was inferred from this reviewer error, and no candidate/test/cloud execution was repeated. Console results are retained in tool history; raw existing AWS captures and both read-only Git binary streams are independently hash checked. Approval and final evidence manifest bind these results and exact script bytes.
