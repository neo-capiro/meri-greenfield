# Independent actual canary3 evidence review

**Accept the measured controller-exit managed-containment result for this exact synthetic canary only. Managed cleanup is STOPPED_CONFIRMED; workload qualification remains FAILED with exit137. G1, native workloads and security remain OPEN.** No blocking evidence inconsistency was found for this bounded experiment. This decision does not authorize another run, retry, redrive, workload or cutover.

This review uses dedicated branch review/g1-canary3-execution from c85ba2f4a1ca27c9715407f170347ddefcf6ece9. The only tracked output is this report. Root authored and executed the deployment, publication and controller. I authored the separate observer d18d49d10f13b70ef34b3d772235dbe3df4c07ab, so **this is not independent acceptance of that helper**. I independently reconciled the raw service responses/history and root-owned process/authority records without importing or executing the observer, controller, compiler or any AWS helper. Own stdlib DATA scripts copied, hashed and parsed records only; no AWS/network/provider/model/Hermes call occurred in this review.

## Actual admission and immutable deployment

Run cbfce523-4807-4ebc-865c-b319e4807e22 and static binding94d71251b3f10c0bc3ba6fd0cdab8f74f9a5373db6ade5beec814629ba89a917 match the consumed reservation, five-field start input, owner admission, exact machine version3 and final output. Public preparation/runtime source and the original conditional review5d5443b0ba443a911720af8294c4e3df3bd2a24c remain separate from actual admission. The ten final executor raw pins and eleven compiler records match their reviewed bytes; the94-state graph contains no Retry.

Actual definition147206B/SHA2565be47681d90780ef70573ffff8bd9f3600c097a9da0ab499d03a5f9965f20e04 matches the uploaded/read-back body and native checksum. Put/head/get bind S3 version4sFrfa8eROYjpsQ6PeKymEcZw6SBaMP7; the upload used if-none-match, KMS and the run/hash-scoped key. Actual server template equals the proposed template. The fresh AVAILABLE change set contains exactly NativeEnforcementRole Policies and NativeEnforcementMachine DefinitionS3Location/RoleArn Modify, ReplacementFalse, RequiresRecreationNever. It changes no ECS definition, network resource or other boundary. The consumed execute reservation and UPDATE_COMPLETE readback match the version parameter.

All40 fresh authority binary captures/envelopes and stream hashes passed. Their timestamps precede the actual start by less than600 seconds. I separately compared all32 non-managed baseline documents with only the disclosed RoleLastUsed/image-pull timestamp normalization, plus immutable version2 and the two old execution records. Current trust, full policy, sole inline policy/no attachments and pre-start policy match the proposed role. Execute/start caller records identify the fixed capirocli principal/account/region. Version3's actual definition, STANDARD/ACTIVE and role match exactly. This is bounded retained authority evidence under the trusted serial-owner assumption, not a global lock against privileged administrator mutation.

One consumed StartExecution reservation precedes the recorded acknowledgement; no second start or redrive is present. Root's direct-child controller receipt records PID7228 exiting0 at18:14:46.691435Z, before the worker started18:15:50.389Z. The fixed controller source returns after acknowledgement and supplies no stop timer. This measures intentional controller exit, not arbitrary process killing, controller-host loss, AWS outage or universal finally behavior.

## Independent physical and managed confirmation

The exact singleton task is b0656cb3fd9f4870903bce3d12d5c81c; worker container d790fca8-2ec9-4efb-b666-cb0de908051e. Initial RunTask, pre-stop provenance, both managed terminal results, final ledger and separate fresh ECS read agree on the qualification cluster, immutable canary definition1, createdAt18:14:46.010Z, startedBy UUID, group, three tags, worker/image/container and retained network binding. Worker image remains bf55fdab91136344688e2c804598546e521b24d6cdbf4fde9e6a7131e6c2ec9c. PreStopRecord event6816 includes the original record, fresh task, verified ENI and actual delegated STS principal for the new managed role. StopTask's parameters target only that exact task and run-bound reason.

| Evidence | Actual UTC/fact |
| --- | --- |
| Original t0 |18:14:43.365;1791656083365ms|
| AWS execution start |18:14:44.999|
| Controller exit |18:14:46.691435|
| Worker start |18:15:50.389|
| Task stoppingAt |18:24:09.159|
| Task AND worker STOPPED |18:25:44.535; strict integer exit137|
| First managed terminal result |event7187,18:25:50.051|
| Final managed terminal result |event7218,18:25:50.510|
| Final ledger terminalAt |18:25:50.524|
| AWS execution stop |18:25:50.595|
| Original D / C |18:26:43.365 /18:29:43.365|

Physical stoppedAt is58.830 seconds before D and238.830 before C. Both actual managed DescribeTasks results are fresh after that physical stop, preserve the same task and worker identity, report STOPPED/desiredSTOPPED and exit137, and occur before C. The final confirmation is distinct from a StopTask acknowledgement. The separate owner-observed task response preserves those physical facts; deleted ENI attachment metadata does not invalidate the positively bound terminal task/container receipt.

I independently exhausted and hash-checked all eight raw GetExecutionHistory service pages:7240 contiguous events, exact next-token chain, no truncated input/output and final ExecutionSucceeded output equal to DescribeExecution. Counts are one scheduled RunTask, one scheduled StopTask,14 TerminalDescribe polling entries and zero redrive events. There are two successful STOPPED terminal results at the end; the earlier twelve polls are not duplicate terminal successes. The94-state source has no Retry. The first watch's6996-event running/stopping observation remains intact, rather than being replaced by the final receipt.

Final AWS status SUCCEEDED does not establish workload success. The exact managed result is cleanup STOPPED_CONFIRMED, qualification FAILED, terminal:true, qualifiedSeen:true, stopAttempted:true and no overflow ledger. Exit137 is retained; it is consistent with the forced-stop experiment but does not independently establish a signal or exclude other exit causes. No root fallback receipt/invocation is present, and the root owner states none occurred. Complete managed history establishes the managed StopTask; exclusion of every possible out-of-band administrator action still relies on the selected trusted serial-owner assumption rather than CloudTrail or an adversarial global lock.

## Evidence and retained failures

Ignored evidence is C:/dev/main/meri-greenfield-worktrees/g1-canary3-execution-review/.task-inputs/CODEX-G1-canary3-execution-independent-1/. Initial DATA checks preserved317 files and verified93 process envelopes. The final DATA snapshot preserves171 files and verifies52 process envelopes, including baseline captures and the final observation; overlapping baseline/history records are not extra experimental runs. Root's separate475-file/49,841,008B seal was fully checked against current raw bytes and copied with its manifest/report/task into478 exclusive records. Root HEAD3e1ec5a2daf8897d55dae17024fb6b6968ece21d is clean; its changes from caecef0 are only owner execution report/task documentation. No source byte changed during this actual experiment review.

| Reviewer artifact | SHA256 |
| --- | --- |
| phase-1/manifest.json |6589fb5794dee7361ea26c6d29a7c2a0339afed845cc79d71112b472f62267d9|
| phase-1/audit.json |67433f276530f51d2353e9f2440a8f233e6b90002203e5819e964e7ceb5c2a19|
| first final-data/manifest.json |7ef8075e226a82810664a1af673bf7fa37cd6be9b7ceb51ea1c6258981146133|
| final-data-2/manifest.json |796a86d392478a89404aba84d97af9d253af51212608804b5dd02ce0f8a9ba3f|
| final-data-2/audit.json |dbbff69277eb1980238e4ed49b5555f387220bdaeb6ee59e5d0d76a0b26b90e3|
| owner-seal/manifest.json |3ecff8d83f59f19c508ce29b7419125bbac3bb9f3ad9e68f01e023457f0039bf|
| owner-seal/audit.json |35c517f6c669a297c651bdbe38313484c27c64cd36d086a44669127656f6ff75|

The first independent final DATA audit failed closed while decoding legacy Windows CLI CP1252 metadata as UTF8, after its history/terminal assertions. Its source, copied bytes/manifest and full tool error remain preserved; no first success artifact exists. A NEW v2 DATA reader added explicit UTF8-first/CP1252 fallback and a NEW output directory. That corrected audit passed in a bounded30-second local child with raw stdout/stderr/envelope retained. It altered neither service data nor production source. Root's separate first terminal DATA reader also failed because it assumed one polling entry and direct scheduled-to-succeeded ancestry; root's corrected reader accounts for14 polls/TaskStarted and its original failure remains in the sealed evidence. Earlier quoting/oversized instrumentation failures remain in the original owner record and are not relabelled cloud or workload successes.

## Scope that remains open

Accept only this measured managed-containment demonstration after the launching controller exited, on the exact non-parser sleep fixture in the separate qualification Fargate environment. Keep canary1/2 permanently consumed with their original domain failures; canary2's physical STOPPED receipt never relabelled its CLEANUP_UNKNOWN result. This experiment gives no permission to reuse the run UUID, retry/redrive, call a model or dispatch SDK/Office/browser/source workloads.

All49 image findings, including4critical/18high, and five older vendor-open findings remain OPEN. This is no security waiver or production acceptance. The empty-policy worker role remains distinct from roleless workers and may vend zero-action credentials. Capture bounds supervise direct children with post-completion byte checks; they do not establish hostile-descendant containment. No universal managed-service outage/cleanup or future workload guarantee follows. Source, proxy/budget, SDK/Office/browser qualification and G1 still require their own accepted artifacts, current authority and measured gates. Paid inference remains zero, current Capiro/Meri remains untouched, and cutover remains unauthorized.
