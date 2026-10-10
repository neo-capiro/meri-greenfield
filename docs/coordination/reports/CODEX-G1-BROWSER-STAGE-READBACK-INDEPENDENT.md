# Codex actual browser stage/readback DATA review

Disposition: the retained SOURCE7 stage DATA reconciles. Execution remains BLOCKED by the canonical readback refusal; this report grants no execution, role-readiness, TestState, volume, host, browser, security or G1 admission. The integration owner makes acceptance decisions.

Reviewer branch `review/g1-browser-stage-readback` starts at `017b7594f9bd10f1dc72e1b987f70ad55a74f02d`. The reviewer authored earlier browser source/wrapper preparation, so this is an independent audit of the integration owner's actual request and returned DATA, not independent acceptance of those implementations. No AWS, helper CLI, candidate import, test replay, native execution or mutation was performed during this review. Only retained DATA reads, hashes, exclusive copies and read-only Git were used.

The actual supervisor ran once from 2026-10-10 23:32:43.821507Z to 23:32:47.325298Z, exit0/error null, sourceInputStable true. The canonical operation records failureClass null and sourceAndFreezeStable true. Empty binary stdout/stderr match their recorded hashes. These establish the direct child's observed exit, with the existing direct-child and postcapture byte-bound limitations; they do not establish descendant cleanup or runtime admission.

The raw canonical CREATE request matches an independently assembled literal request: the exact new stack/change-set names, CREATE type, original template serialization, named-IAM capability, original run ClientToken, description and two ownership tags. Fresh full STS caller `arn:aws:iam::967807252336:user/capirocli`, account `967807252336`, UserId `AIDA6CVOOW5YCNOGMSALQ` completed before the shared consumed nonce, which preceded CREATE dispatch. The nonce remains consumed. All eight preceding authority captures were hash-bound and 95.554–107.463 seconds old at supervisor start; exact typed role/stack absence errors and allowed simulation results were retained. Simulations do not prove effective service permissions, SCP, trust, or PassRole success.

The one captured CREATE ACK and stage-result agree on:

- Change set `arn:aws:cloudformation:us-east-1:967807252336:changeSet/browser-wire-b247b9a1-bfde-414a-a76b-9ff4fdd83110/901d9687-8ceb-4a67-aec7-ce247ea8433a`.
- Stack `arn:aws:cloudformation:us-east-1:967807252336:stack/MeriGreenfield-BrowserWireReadOnly-20261010/e5039620-c502-11f1-8f72-0e08b184dc4d`.
- Run `b247b9a1-bfde-414a-a76b-9ff4fdd83110`; stage status `STAGED_NOT_EXECUTED`.

Canonical role-changeset-readback retained ValueError after exactly STS and DescribeStacks. The actual sole pending stack is REVIEW_IN_PROGRESS, with Tags `[]`, matching the ACK's exact ID/name. There is no successful changeset output or execute operation/consumed record in the reviewed slots. SOURCE5's earlier failed supervisor remains preserved; SOURCE7's canonical consumed record must not be reset or reused.

The subsequent three-call read-only diagnostic confirms the exact change set CREATE_COMPLETE/AVAILABLE, no NextToken, exactly one `Add` of `BrowserWireReadOnlyRole` (`AWS::IAM::Role`), both requested ownership tags, and semantic equality of the actual Original template to the pinned template. Tag order is reversed and immaterial. DescribeChangeSet has no ChangeSetType field; CREATE provenance comes from the actual captured request, nonce and ACK, not an invented response field. The service CreationTime precedes local CREATE capture start by about 0.584 seconds; no exact local/service clock synchronization is claimed.

The missing pending-stack tags are a concrete API-profile compatibility blocker, not evidence of an executed foreign stack. A separately reviewed SOURCE8 must bind the retained SOURCE7 request/ACK/nonce, exact pending stack and actual change-set tags/template before any execution. This review neither implements nor invokes SOURCE8, and does not broadly waive empty ownership tags.

The SOURCE7 canonical closure remains 1,621 bytes/SHA256 `45721917b5ef0e389d3720665c7482eabc357aa8b1f1e134c4aa29c665567446`; full14 closure remains 4,560 bytes/`e7981362507bf0e588f100139ca4a082cbc42ee042c4b435c7489d9d9802f88b`. All fourteen source members, runtime pins, owner freezes, failed-supervisor evidence and referenced captures rehashed. The diagnostic's fourteen pre/post records agree.

Evidence is under this worktree's `.task-inputs/browser-stage-readback-independent-1/`. Local DATA audit v2 reconciled 88 exclusive copies, 286 recorded reference occurrences and 115 assertions; these include copy-stability assertions, not 115 distinct deployment scenarios. Its audit.json is 153,456 bytes/SHA256 `fc0936c8d863765bffa8fd44f521761c6f401c2781da10760f50acd01f1bea40`. Additional authority-data.json retains all eight raw projections and age checks. Attempt1 failed while treating a relative manifest member as an absolute path; the helper, copied bytes and failure explanation remain, and v2 resolves members relative to their owning manifest. No cloud retry occurred.

All 49 current and five older findings remain OPEN. No role execution, disposable volume, error-wire qualification, isolated host, model call or G1 pass is established. Evidence is a retained observation, not a claim that the cloud state remains unchanged indefinitely.
