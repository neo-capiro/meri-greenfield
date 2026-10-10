# Browser role authority renewal preparation

Closed preparation from `0d0a7b17eb555b60a979fed904b72f2fec98af39`, in dedicated branch `task/browser-role-authority-renewal`, worktree `C:/dev/main/meri-greenfield-worktrees/g1-browser-role-authority-renewal`. Only this report is tracked. The proportionate outline and finite evidence are under `.task-inputs/role-owner-2` (E2).

One authorized renewal ran eight read-only AWS operations. No stage, reservation, role creation, change-set execution, volume, TestState, host, provider or source operation ran. This is renewed DATA for independent owner review; the browser role workflow remains on HOLD at readback/execute.

## Source continuity and boundaries

`capture-authority.py` is byte-identical to E1: 5821 B, SHA256 `a5df3acc935d0ff3485fc1cb34c3781c866b0030c7de63023998089918a14a7d`. `run-readonly.py` is likewise unchanged: 2093 B, `599f779232af115b3209e834a126dcf422640b1920799ad96704df05f95d49a7`. Their existing self-relative E/W bindings select this dedicated worktree. They retain the same eight operations, parameters, caller, profile, region, per-call bounds and transport overlay.

The unrun stage supervisor is 8507 B, SHA256 `fb21a313f317a4c0365e85fa7bcaf2614e099aedef053755705dbbe86462a3ff`. Its only substitutions are the fixed W literal to this worktree once, E `role-owner-1` to `role-owner-2` once, and `authority-captured-1` to `authority-captured-2` three times. No algorithm, guard, canonical OWNER, run or source changed. `source-mapping.json` records original/new raw identities and exact replacement counts.

Canonical OWNER remains `C:/dev/main/meri-greenfield-worktrees/g1-browser-wire-shape-repair/.task-inputs/browser-wire-owner-actions-1`; original run remains `b247b9a1-bfde-414a-a76b-9ff4fdd83110`. SOURCE5 ten-file closure SHA `8f5436ff0e75cdf2313e90ee485aa855f6ceea3f5859c2d814ba10e4bf536dbb`, full fourteen-file closure SHA `8f1f25312129310a95c86e0f2221c91d957fca49613f161bcc0ad61171b9ade2`, original role template, shared delete/create reservations and C900 remain unchanged. All 95 original E1 manifest record occurrences and all fourteen source records matched before and after renewal. Original E1 and OWNER/captured-1 bytes were preserved.

The canonical AWS adapter and its two imported validators were fully source-read and raw-pinned before dispatch: adapter SHA `f89bbf1b41a4660343d5143320e7b2c40e19a91fc5daffa47f1482508612eda9`, teststate_request `14ba07654193bbf86968728b301a21b9881167d549f24b29f3bca039f170f753`, readonly_shapes `602fbfa09d00d1cb8b3cfedc99b6274cf5e30c1aeec32e5cf0ce47c2bd990b91`. Python 3.12.14, isolated/nonoptimized/no bytecode, and AWS CLI binary retain their previous fixed pins. The closure includes imported TestState validators but this capture invokes no TestState operation.

## Actual renewed capture

The direct capture child ran 22:59:05.906548–22:59:24.932125 UTC, 19.031 seconds, exit 0, no exception, under its unchanged 480-second limit. Eight fixed calls ran 22:59:06.529715–22:59:24.815077 UTC: exact STS caller; named new role absence; named new stack absence; CloudFormation, IAM, PassRole and TestState permission simulations; exact template validation. Each retained receipt reports timeout 45 seconds, no timeout, automatic retries 0. The two expected absence calls exited 254 with exact NoSuchEntity/ValidationError evidence; the remaining six exited 0. All fifteen simulation action rows were allowed, with no missing context; this remains simulation evidence, not actual permission use or SCP proof.

`authority-1/summary.json` and copied canonical OWNER/`authority-captured-2/summary.json` are identical, 40228 B, SHA `693e20e4f0f9f0cee5a45b6d29e0b81443bdf8e2d5214a81f079b4869b1f18a1`. All 24 raw call files plus summary were copied exclusively and remeasured. `renewal-data-result.json` is 21163 B, SHA `aed0e5a1136ed74678f7198bc2a7a87fb1f75e9cab07191aeeb04a0076bef3cf`. The earliest call receipt reaches 600 seconds at **23:09:10.288 UTC**; later owner dispatch must enforce actual freshness or renew again.

E2 has refusing authority/freeze/acceptance proposals. The acceptance remains `NOT_ADMITTED_TEMPLATE` with null approval/deadline/final authority/freeze pins. Final OWNER authority, freeze, acceptance, consumed and operation paths were absent when this preparation closed. No command in this session invoked the stage supervisor or canonical action entrypoint.

## Retained API-contract blocker

Renewal was paused before dispatch when the owner identified that canonical `role_action.changes` requires response `ChangeSetType == 'CREATE'`. [AWS DescribeChangeSet response documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/API_DescribeChangeSet.html) does not define that member. The installed official AWS CLI model, `cloudformation/2010-05-15/service-2.json`, is 591936 B, SHA `760e50f9ed53ff6cf5899b3549bc4af3b4d815783ff84c658d2d9cc9892c9b5a`: its 25 DescribeChangeSetOutput members omit it, while CreateChangeSet input includes it.

Retained actual SDK DescribeChangeSet bytes, 1981 B, SHA `6709f20c300c95cd8aedea9324f84c4ec8e0ae8367865f56dde9e2d98e4cf6fd`, show CREATE_COMPLETE/AVAILABLE and two Add resources without that key. The corresponding SDK pending stack was REVIEW_IN_PROGRESS. These historical receipts establish an API shape example, not current browser stack authority. Exact model/receipt copies and DATA reconciliation are retained. The first PowerShell model parse refused case-distinct keys RoleARN/RoleArn; a subsequent `-AsHashtable` DATA parse resolved it. That diagnostic exists in the tool transcript, not a claimed binary capture.

The owner then expressly authorized this renewal because unchanged CREATE-only staging does not call the defective comparator. Readback and execution still refuse real responses. Repair must establish CREATE through exact consumed create request/raw ACK/stack provenance, pending-new-stack state, exact Add-only changes and actual original template; a fabricated response field or bare removal of the check is insufficient. No canonical source was repaired in this session.

## Limits and next owner gate

Canonical capture buffers stdout/stderr before retention; bounds are direct-child timeouts, not live memory or descendant-tree limits. CLI automatic pagination may perform multiple service requests. Copy/hash checks assume the trusted local filesystem and do not prove hostile-filesystem race resistance. No unchanged domain suite, browser, decoder, native or provider test was replayed.

The role proposal still trusts states.amazonaws.com with same-account restriction rather than an exact SourceArn; its region-scoped DescribeInstances/DescribeVolumes policy permits region-wide metadata. Root owns those residual decisions, actual staging admission and later source repair/review. All 49+5 security findings remain OPEN, Office DEFERRED, provider calls 0, source connectivity false, G1 OPEN. No current Capiro/Meri resource changed.
