# Independent Codex review of canary terminal routing

10 October 2026 UTC. Reviewed candidate `234f51f4a7ced907d53be088fc37eb0d1d9705d5`, authored by Codex `contract_review`, independently of its author. **No blocking finding in the allocated source repair; ready for the integration owner's offline source decision.** This is not runtime, security or G1 acceptance. No AWS, provider, model, worker, native application or Hermes invocation occurred. Canary attempt2 remains permanently **CLEANUP_UNKNOWN / NOT_ACCEPTED**.

The reviewer fully read the three committed paths, their author evidence, the complete workflow and its expression/wire/binding/infrastructure dependencies. Raw Git blobs and current source agree. The author final manifest is 9,216 bytes, SHA256 `6a1412458b86ed0627be3c565e954abb7f2537f278e5b9a608e6532c3cfa0845`; every one of its 13 evidence records was independently byte-checked and preserved. The exact compiler closure contains 11 paths. Compared with accepted `651ec8ce136a9ed3b22f911ea0dac90f33de40c7`, ten are byte-identical; only workflow.mjs changes. The commit adds only the focused test and author report beside that source change.

| Candidate path | Bytes | SHA256 |
| --- | ---: | --- |
| infra/native-enforcement/lib/workflow.mjs | 26275 | c2051ec152fd5e0e9b7376f69da85dedd6e8b7348d1ec10a279ed2753525a830 |
| scripts/test-native-terminal-routing.mjs | 11401 | c42a85cea76b1b9871f20f26a97700dbd322dd6659ab2b3f008f186c77146fde |
| docs/coordination/reports/CODEX-G1-CANARY-TERMINAL-ROUTING-REPAIR.md | 7975 | 27f1ce0427c99aee82c830603ba2c72fd6c6a166f5e248c8cfd8d99e5a37a5b5 |

## Retained failure and actual cause

The seven retained history pages independently verify as 6,877 contiguous events, with the next token from each page used by the following request and no token on the final page. Raw lengths/hashes agree with successful CLI envelopes; all retained input/output truncation flags are false. The history contains exactly one RunTask and one StopTask, 189 ListTasks, 65 DescribeTasks, 64 DescribeNetworkInterfaces and three GetCallerIdentity calls.

Run `1b4fc350-7391-4c40-9e3b-b2bb27a1cfbc` stopped selection incorrectly after the managed StopTask acknowledgement. At event6826, the original ledger's only task had stopAttempted=true, terminal=false. No pending stop work remained. The deployed AfterObservation nevertheless selected SelectOwned; its omitted empty selection retained a stale currentArn. CheckStopIdentity correctly refused that identity because it was no longer pending. FinalUnknown ended the workflow without any TerminalDescribe. The earlier startup `eni-unavailable` issue was not the routing exit cause: it occurred once at126; the final EC2 reads and RetainENI observations succeeded.

The one managed StopTask was scheduled at event6721, 16:00:33.246Z; its successful response still said RUNNING/desired STOPPED. The later watch07 CLI observation binds the original task/container, measures both STOPPED with exit137 at16:02:10.442Z, 57.006 seconds before D. That later physical evidence cannot rewrite the managed UNKNOWN result. The retained controller had ended more than nine minutes before the managed stop. Absence of a local fallback directory is not universal proof about other actors.

## Source and terminal semantics

Actual compiler output for both SDK-wire v2 native and canary profiles still has 94 states. Only AfterObservation, SelectOwned and StopBudget differ. No Task resources, retries, IAM, network permissions, command, caps, ledger fields, polling intervals or D720s/C900s deadlines change. Canary IAM resources are deeply equal before/after; its infrastructure source is also byte-identical.

AfterObservation now selects stop work only with a nonempty pending set, otherwise unconfirmed work reaches SelectConfirm. The exact terminal predicate remains first. SelectOwned writes explicit null for an empty selection, preventing omitted-value merge from preserving an old ARN. StopBudget requires unique membership of currentArn in the current pending set; the empty-pending/unconfirmed race reaches confirmation. A different pending identity, an empty ledger, or expired budget does not admit a stale stop.

The complete unchanged post-stop sequence was examined, rather than treating these three conditions as a cleanup proof. MarkStopAttempt precedes the single StopOwned call. A stop acknowledgement alone changes no terminal flag. Confirmation performs a fresh exact-ARN TerminalDescribe with actual result/error assignment, wire coverage, original task/definition/container binding, task AND worker STOPPED, and integer exit-code checks. Running observations wait and poll. Retaining terminal evidence is followed by the final ledger traversal and another fresh read before FinalGate. A fresh read failure sets the sticky hold; a contradictory container cannot reuse the earlier terminal record. Expiry or insufficient confirmation stays CLEANUP_UNKNOWN. A nonzero exit can confirm containment while qualification remains FAILED.

## Independent execution and compatibility

Checks ran in new exclusive raw-Git source/data snapshots using Node24.19.0, binary SHA256 `3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237`, and retained JSONata2.0.6, 291,449 bytes/SHA256 `8327cafae2779d31512939cc45eba2f1b3fff3c09cdf7906ed457c31f198302b`. Replaced child environments contain Windows basics and local paths only; stdin is DEVNULL, shell=false. Source, inputs and runtime pins are checked before/after. No canonical47 or native-wire17 replay was needed in this review.

The first reviewer setup attempt failed before any focused case: copying jsonata.js alone into a type=module repository omitted its original CommonJS package scope, producing `TypeError: jsonata is not a function`. That failed snapshot, stdout/stderr and envelope remain intact. A new snapshot-v2 adds only the exact retained upstream package.json, then runs the unchanged focused suite once to completion: **11/11 cases, 58 actual JSONata evaluations PASS**, 0.313 seconds under a120-second outer bound. This is a retained reviewer setup failure, not an implementation failure or a silently repeated positive run.

The reviewer authored a separate finite selected-path composition using actual expressions and Task Assign/Catch assignments: **6/6 composed cases, 261 JSONata evaluations PASS**, 0.390 seconds under a30-second bound. It covers:

- The retained post-stop context reaching terminal polling and a second fresh final read; exit137 yields cleanup STOPPED_CONFIRMED and qualification FAILED.
- A RUNNING stop acknowledgement followed by a RUNNING observation, an8-second logical wait, STOPPED, and the final fresh read; no second StopOwned is traversed.
- A foreign task failing coverage without terminal retention.
- An error on the final fresh read overriding earlier terminal ledger proof with sticky hold/UNKNOWN.
- A different original-container identity on that final read preventing stale confirmation.
- Expiry at C-999ms refusing another read and returning UNKNOWN.

The composed terminal response is explicitly a synthetic PascalCase mapping of retained CLI task DATA, including asserted original overrides. It is not a new observed Step Functions SDK response. The interpreter exercises selected Pass/Choice/Wait/Task-result/Succeed paths, not the whole managed scheduler. Counts are expression evaluations and cases, not independent security assertions.

Six original v1 native products are raw JSON.stringify byte-equal between the accepted651 compiler and candidate, including original fixture insertion order. Their independent literal hash checks pass:

| Product | A SHA256 | B SHA256 |
| --- | --- | --- |
| binding, 7133B | 19dfb84639bad374aa8e38c255512d1a1cc76eb0843c3d2d5929d8a4a4d671c5 | 9b9b77832b482e2d70f096326aa5c50cac60dbb1a37187bbb68cb6d20af654c1 |
| definition, 112210B | 2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3 | 2c962d23a3ab42317e9b9d9ecd80c9d8eab7af6a7e9c59f46359de106f51eac3 |
| template, 115766B | 6a8c3255737fc3d9dc0153241fd3af49ad7d186607f7a3d6b371d2881561b4c7 | c2de9e540fb97dc0e3a3ea421eea768ee58212c8593f4d70462bbc8f9bc0818a |

## Evidence and remaining boundary

New ignored evidence is `.task-inputs/CODEX-G1-canary-terminal-owner-review-1/`. Its exclusive manifest is 41,713 bytes/SHA256 `164ceda7a15092f1922da44e17a5e11c11aec4bb463b340624d037eaf199cca4`, binding 227 files/43,293,049 bytes. Independent composed result is 6,894 bytes/SHA256 `e612985db4ffb5f6396a7b2b93fe1500fd0bdd2ec47cfad0a90568b709189455`; its machine envelope SHA256 is `66f7760bc2f8f10bf58e24107e0b0e22dc72dc2e77bb6494a2a379dd9075137c`. Focused-v2 envelope SHA256 is `cbf0cfe540edfb3c257c9fb18cc97ce67599b1c5a67f4b1f787aab132b3bf7c1`. Final raw-Git/current/source/input stability check passes.

Local supervision measures the direct child and retained binary streams; it is not a descendant-tree or universal hard-kill proof. Output limits are checked after completion, not live byte enforced. Local JSONata execution does not prove AWS scheduler timing, all multiplicities, permissions, propagation, service failure behavior or physical termination under an outage.

The public native_preparation helper intentionally still pins accepted651 and the old workflow hash; it must refuse this new source. Exact closure migration, fresh inert products and bounds, independent owner review, actual immutable version and fresh per-run authority/consumed admission remain prerequisites. No old reservation, failed canary history or deployed version is replaced. All image vulnerabilities, other G1 qualifications and current Meri isolation constraints remain open and unchanged.
