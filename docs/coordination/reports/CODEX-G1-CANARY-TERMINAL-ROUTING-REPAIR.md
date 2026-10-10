# Canary terminal routing: actual failure and bounded source repair

10 October 2026 UTC. Codex `contract_review` diagnosed retained AWS DATA independently, then authored this allocated source repair. This is **author evidence, not independent acceptance**. Owned paths are only `infra/native-enforcement/lib/workflow.mjs`, `scripts/test-native-terminal-routing.mjs` and this report. No AWS, task, provider, model, native worker, server or Hermes invocation occurred in this task. Canary attempt2 remains permanently **CLEANUP_UNKNOWN / NOT_ACCEPTED**; no retry/redrive, runtime admission or G1 pass follows from the repair.

## Actual cause

The seven retained history pages under `.task-inputs/CODEX-G1-canary-runtime-2/history-final/` contain contiguous event IDs1..6877. Each raw page hash/length agrees with its successful CLI envelope; the final page has no continuation token, and retained outputDetails are untruncated. Execution input binds run `1b4fc350-7391-4c40-9e3b-b2bb27a1cfbc`, static binding `6fa52a532cbe940a5bd546f96b4830e8cce1292e4a2c1401e09872c36a9a763e` and immutable machine version2. Retained version-readback definition SHA256 is `5603bcfb499e4249e8e880a405f279c0b2b939c980f21936e6af4793bb89fb04`.

The history contains one RunTask and one managed StopTask. StopTask was scheduled at event6721, **12:00:33.246ET**, and succeeded at6723,12:00:33.359ET. Its response still says RUNNING/desired STOPPED: this acknowledgement is not terminal evidence. The controller had already exited successfully at15:51:10.458102Z, more than nine minutes earlier. There is no local fallback artifact directory in the retained runtime2 evidence. This establishes the observed managed stop, not universal CloudTrail absence of every other actor.

The apparent `eni-unavailable` issue is not the exit cause. NetworkUnknown occurs exactly once, event126 at11:51:10.918ET during startup. The final two EC2 reads succeed, and RetainENI occurs at6822 and6860. After event6826's valid task/ENI observation, the old AfterObservation containment branch unconditionally selects SelectOwned6828 even though the only original ledger row already has stopAttempted=true and terminal=false. The pending-stop set is empty; the unconfirmed set contains that task.

SelectOwned's `$pending[0].arn` becomes an omitted value. Its merge keeps the old currentArn, so prestop describe and another STS identity read run for that stale selection. CheckStopIdentity6873 correctly rejects the required unique pending-stop membership, then FinalUnknown6875 ends the workflow at12:00:35.159ET. **No SelectConfirm or TerminalDescribe was visited.** This is a control-routing defect; weakening the identity gate or treating ENI history as terminal proof would be incorrect.

The later watch07 CLI task read binds the same task ARN, definition `meri-greenfield-qualification-canary:1`, startedBy run, original container and image. It measures task/container STOPPED, exit137 and stoppedAt12:02:10.442ET, **57.006s before D12:03:07.448ET**. The workflow had already ended without a terminal receipt. That later physical observation does not rewrite the failed attempt's managed result. Nonzero application exit remains FAILED even when a future run obtains independent cleanup confirmation.

## Source repair

Only the explicit SDK PascalCase v2 branch changes, for both native and closed canary factories:

- AfterObservation chooses SelectOwned only when pending stop work exists; otherwise it selects unconfirmed work through SelectConfirm. The original terminal predicate stays ahead of containment, so a bound terminal candidate can be retained without fresh ENI proof.
- SelectOwned assigns currentArn:null for an empty pending set, preventing omitted-value merge from retaining an old identity.
- StopBudget checks unique membership of the selected pending identity. An empty-pending/unconfirmed race routes to confirmation; empty-all, mismatched identity or expired deadline remains UNKNOWN.

The legacy v1 static graph is byte-preserved. No states, Task resources, calls, retries, IAM, network authority, task commands, D720s/C900s deadlines, polling intervals, result/context limits or ledger fields are added or broadened. Both v2 graphs still have94 states. Existing StopIdentity/CheckStopIdentity, one-attempt MarkStopAttempt, exact-bound terminal predicate, sticky security failure and exit-code semantics are unchanged. The new selector uses the already admitted currentArn null-or-task-ARN allowance, so it introduces no larger persistent data field; changed branch text and serialized graph must still receive a fresh owner pin/bounds review before use.

## Recorded offline checks

Each child ran once with explicit bundled Node, a120s direct-child external timeout, replacement Windows basics/PATH environment, binary stdout/stderr and source hashes before/after. There were no test failures or unchanged reruns in this repair task:

1. New focused11 cases /58 actual JSONata2.0.6 evaluations PASS. It pins the seven actual history pages, old version-readback, actual input/static pins and later physical task DATA. The original deployed AfterObservation expression reproduces SelectOwned; the repaired source reaches TerminalDescribe. Cases cover singleton raw ledger shape, empty selection/stale ARN, empty-selector race, another pending identity, overflow round-robin, deadline refusal, one stop then confirmation, nonzero terminal FAILED, foreign container refusal and direct terminal precedence with unavailable ENI. The terminal fixture explicitly maps retained CLI fields into the reviewed compact facts; it is not presented as a new Step Functions service response.
2. Existing native-wire17 PASS, including six exact legacy native A/B binding/graph/template hashes, new v2 inertness and94-state parseability, retained wire/strict shape checks, original container binding and nonzero-exit behavior. Importing its fixture module does not run canonical47 because that module has a direct-entry guard; my initial planning statement to the owner was corrected before claiming coverage.
3. Original canonical native47 ran FIRST time separately and PASS. No focused/wire replay occurred.

Evidence is retained in `.task-inputs/CODEX-G1-canary-terminal-routing-1/`. `actual-diagnosis.json`13113B SHA256 `fe7d5a49f8e09b0f5f50fe755bf94e3bebdabd238ca8d2081ebfb757131416d0` binds raw pages/envelopes, exact timeline, action counts and scope limits. Focused stdout1055B SHA `fd919333f70b7f281acddf4a9cc333fcd8784940e4f4938e69c151b4223eb458`; native-wire stdout1585B SHA `748d64d2cc25ac010993685ada9b87b676cf94d1d39d652126587604256a794e`; canonical stdout2886B SHA `33a96886118b2c22da0492b0b15018478640775385b9e3a4b6a8292701cc470b`. All three stderr streams are empty. Final manifest binds source, runtimes, raw results and wrappers.

## Remaining owner work

`scripts/qualification/native_preparation.mjs` intentionally remains unchanged. It still fixes source reference `651ec8ce136a9ed3b22f911ea0dac90f33de40c7` and old workflow25523B/SHA `237eae6c3938464732c13add0ef6e18484c203e51f00a79c1ef8064e6fd3bc98`; it must refuse the new current workflow. A separately reviewed exact compiler-closure pin migration, new inert preparation/raw graph/template/source hashes, independent Codex review, fresh authority/admission, immutable managed version and another separately consumed run are required before any further runtime experiment. Frozen helpers/oracles, old inputs/versions, failed attempts and reservations are preserved.

Selected-expression checks and legacy products do not prove complete service scheduling, timing, all task multiplicities, IAM/tag propagation, kernel termination or universal cleanup. The independent reviewer must inspect the three changed states, no-new-data allowance, all unchanged native bytes and one-stop/terminal boundaries. All image vulnerabilities and other G1 qualifications remain OPEN; no provider/source/product or release workload is admitted.
