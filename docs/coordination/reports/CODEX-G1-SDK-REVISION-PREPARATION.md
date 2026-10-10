# SDK initial revision source preparation

Source candidate only. No AWS call, state-machine update, publication, execution, task, provider or native operation occurred in this session. Root must independently review these exact bytes and issue a separate one-action admission. G1 remains OPEN.

Dedicated worktree `C:/dev/main/meri-greenfield-worktrees/g1-sdk-revision-preparation`, branch `task/g1-sdk-revision-preparation`, base `e1d7dea29872176476c2455cc97f3ffa34b1ef92`. AGENTS and implementation standards were read; the ignored outline preceded changes. The tracked scope is this report and `scripts/qualification/aws_evidence.py`. The adapter change adds exactly `update-state-machine` to `ALLOWED.stepfunctions`; no option, other operation, environment, retry, timeout or capture behavior changes. DATA-only raw-Git comparison verifies this literal delta and exact unchanged `teststate_request.py` / `readonly_shapes.py`.

## Reason and fixed subject

The integration owner observed that the newly created SDK machine has no revisionId. AWS documents initial revision as null, and an update creates a revision. The proposed prerequisite sends the existing reviewed definition again, without publishing or starting it. This is a reviewed resource mutation requiring its own admission; it is not a waiver of native run prerequisites. Sources: [DescribeStateMachineForExecution](https://docs.aws.amazon.com/step-functions/latest/apireference/API_DescribeStateMachineForExecution.html), [revision/version semantics](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-cd-aliasing-versioning.html), [UpdateStateMachine request/response](https://docs.aws.amazon.com/step-functions/latest/apireference/API_UpdateStateMachine.html). Actual service behavior has not been exercised here.

Fixed subject:

- Run `f1bdbc76-068f-4d04-bc91-5abd2608f05f`; binding `cb9bb93266c2314d2e69380d40318a73add385ee09eacd336194135149fa45f1`.
- Machine `arn:aws:states:us-east-1:967807252336:stateMachine:meri-greenfield-native-enforcement-sdk-20261010`.
- Stack `arn:aws:cloudformation:us-east-1:967807252336:stack/MeriGreenfield-NativeSdkEnforcement/9db306b0-c4e0-11f1-8aed-12ffde6aba01`.
- Role `arn:aws:iam::967807252336:role/MeriGreenfield-NativeEnforcement-Sdk-20261010`.
- Definition 145649B, SHA256 `1858d43c75d44b133271ee181da3748df7c22e174500120047f324839f342a39`; template 3808B, SHA256 `9b4d3c91099a154bc81d8561d94bfae6f3f1095dd497fb13629e20ec8f2b0f0d`.

The fixed graph keeps its SDK-only admission/IAM, original t0/D/C, no Retry and one-run behavior. It is not rewritten by this task. Office/native task admission, publication and the actual SDK wire proof remain separate.

## Candidate and closure

All private paths below are beneath `.task-inputs/CODEX-G1-sdk-revision-source-1/` in the dedicated worktree. They are ignored source/DATA, preserved for independent review rather than shipped as product code.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| `sdk-revision.py` | 11617 | `98595524ce6dbb8eb6219ef4474e6aaf07ddd6b335d01e22323cabaf4740d0f3` |
| `closure-manifest.json` | 3645 | `b0520b7ecd8f9ae6d9e61ea8bbf79e4d82532d493df85945351cbbe262039478` |
| `test_sdk_revision.py` | 14702 | `d0b965f104761abd12a3344efccf18759d83443978fd51fde400cb6a85a98db5` |
| `run-fake-controls.py` | 4210 | `5f52dd345cbce023f58da746624747a4fc38b360e8b45a165d4133fd32082e5c` |
| `fake-controls-1/process.json` | 1326 | `dc25a620316d211fc7583ea2c5e5a4b720deb8355cb84aea3d83de6baa68337f` |
| `source-integrity-1/results.json` | 14597 | `c5c1c86c6273d7cc371e7e2fc60e8088dc9e5e934f847a24900d3dfec844e23e` |

The new adapter is 7542B / `f89bbf1b41a4660343d5143320e7b2c40e19a91fc5daffa47f1482508612eda9`; its historical e1d version is 7518B / `7ee550216b6112b560e08d2998ffc1d9c0f40a07569461d513ebed90bf009c2d`.

Nine lifecycle source-2 files are copied byte-identically from the owner worktree, verified against original closure `b249206aab260c3b54c439b53f2802d3e3f0dc1ef8a0f3ccc0c70cd74c722167`. The existing twelve-record lifecycle closure remains the shape required by unchanged `b.verify_closure`: nine historical private files plus the three canonical adapter/request/shape modules. A separately frozen thirteenth record binds the new revision entry. The actual production local import chain is entry -> sdk_binding -> aws_evidence -> teststate_request -> readonly_shapes. The other historical entries are provenance/compatibility members, not called by the revision entry. Compiler provenance is DATA inherited from the fixed graph, not a runtime compiler import.

The binding is raw-hash checked before its one fixed ordinary import. A custom closed `meri-sdk-initial-revision-freeze/1` validates the entry, all twelve reused records, fixed runtime executable bytes, definition/template and seven reviewed deployment response records before output creation or adapter import. `b.freeze` and its action enum remain unchanged. `b.read`, `b.deployed`, `b.receipt`, `b.reserve`, parser and exclusive save are reused. The new `perform` receives a fake capture only in offline controls; production `main` chooses canonical `aws.capture` itself, with no caller-selected reader/import/AWS factory.

No real owner freeze or operational reservation is supplied. Root must fill/review the exact schema documented in README, including only `permittedActions:[revision]`, explicit decision/time, current complete seven-response baseline and a single fixed nonce/path independent of output. Hashes are review bindings, not authentication. The unchanged source-2 NAME remains the historical wrong SDK execution-name prefix; root owns its separate source-3 correction. Nothing here admits or invokes those start/observer helpers, or incorporates unseen source-3 bytes.

## One-action behavior

The candidate first captures all seven deployment readbacks and compares complete responses to the owner-reviewed baseline, in addition to canonical graph/template/trust/inline/attached/config checks. It requires no SDK executions and no current qualification-cluster RUNNING tasks, and refuses any explicit pagination marker. It rechecks closure/entry/graph/template, then reads the exact caller immediately before an exclusive fixed revision reservation; reserve performs an additional local closure recheck. Foreign caller/history/task/configuration refuses before reservation/update.

After reservation, the only mutation arguments are `stepfunctions update-state-machine --state-machine-arn <fixed machine> --definition file://<exact reviewed graph>`. It supplies no role, logging, tracing, encryption, publish, description or task argument. The acknowledgement must contain a typed nonempty revision and no published version. A lost, malformed, failed or unknown acknowledgement leaves the action consumed and raises a hold; the mutation is never replayed.

Readback permits at most three rounds of seven complete deployment reads, with 2s gaps for a still-null revision. Every round must retain the same full graph/configuration/role/template and all other deployment fields. Success requires the returned revision; only machine `revisionId` and `updateDate` are excluded from full baseline equality. A foreign revision or other drift fails immediately. Entry/closure/runtime/graph/template/baseline bytes are rechecked afterward. Success records revision only, `nativeAdmission:false`, no publication and no start.

Each direct capture is at most45s and receives the remaining monotonic600s operation budget. An external600s supervisor is required to cover initial validation and filesystem stalls. Canonical CLI automatically may paginate within that direct-call bound; returned markers are denied and inventories must be empty, but this is not a one-page API guarantee. Binary PIPE capture and post-read32MiB checks are not a memory resource cap or descendant-process supervisor. No mutation retry is configured.

## Verification actually performed

The original prohibition on helper imports was followed until the owner explicitly authorized fake-only execution after full source reading. `CLARIFICATION.md` preserves that distinction. The fixed Python3.12.14 executable ran `-I -B .../run-fake-controls.py`; the child denies real process/socket/DNS operations before importing the candidate and controls. The candidate CLI, binding adapter factory and canonical AWS adapter are never invoked/imported. Real local freeze, closure, deployment, receipt and exclusive reservation functions are exercised using synthetic temporary records/receipts; their temporary directories were cleaned.

One run on 2026-10-10, 20:23:37.097414-20:23:39.565545Z: exit0, no timeout, 13 unittest methods PASS in2.050s, 21 source/input/runtime records identical before/after. Controls cover exact one update/no publish/start; wrong caller/no reservation; missing reservation; foreign raw graph before output allocation; role trust drift; lost ACK/consumed exclusive nonce and denial of second reservation; graph/revision drift; nonempty histories/tasks and pagination marker. Several related subcases share one method; 13 is the method count, not a claim of 13 independent security properties. `stdout.bin` is empty; `stderr.bin`1985B SHA256 `c440403d71bf4d818fffe4108cb3a60fe6838f65254e3a91af7b151ac9bbafc0`. There were no failed checks or test retries.

A separate fully read DATA/Git-only helper verified nine original/copy pairs, the exact one-operation adapter delta, two unchanged raw-Git dependencies and the base. Its seven Git commands retain fourteen binary streams. Some exploratory Get-Content paths did not exist; these were discovery lookup errors, not candidate execution or hidden failed qualification.

## Remaining limits and owner sequence

This is local source qualification with synthetic AWS responses. The actual IAM permission, initial-revision creation, AWS consistency behavior and service-side no-publish behavior remain UNRUN. Current sources/admin credentials are not accessed. No additional AWS read was made by this agent.

The local trusted checkout/filesystem, serialized owner mutation and reviewed baseline are assumptions. UpdateStateMachine exposes no revision compare-and-swap request field: fresh pre/post checks cannot prevent an outside concurrent writer, and the local reservation is not a distributed lock or power-loss durability proof. Original reserve behavior is preserved. Unexpected interruption/unknown ACK requires independent reconciliation and never a fresh output/nonce retry. Partial local reservation-write uncertainty is retained as a hold.

Root should independently read the helper/closure/tests/report, retain these source pins, prepare a fresh revision-only freeze and supervisor, and decide whether to perform the one no-native update. Only after exact revision readback should root independently freeze the corrected source-3 publication/start closure, use the separately reviewed publication CAS, renew full native authority, issue the SDK-specific residual-risk/start decision and observe real native wire plus cleanup. No part of that later sequence is approved by this report. Actual paid Bedrock inference remains zero for this session; G1, production proxy, TLS and full native admission remain OPEN.
