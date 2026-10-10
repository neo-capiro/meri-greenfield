# Browser wire role: fresh authority and staging handoff

Codex, 10 October 2026. **READY FOR ROOT REVIEW; ROLE STAGING NOT ADMITTED OR DISPATCHED.** Eight fresh read-only AWS calls completed with the expected caller, new target role/stack absence, allowed IAM simulation decisions and valid proposed template. No change set, role, fixture volume, TestState, host, provider or model action occurred. Source acceptance remains the integration owner's separate decision and G1 remains OPEN.

Dedicated branch `task/g1-browser-wire-owner`, base `155ba06b555fc9c8bf229289df4f6fd31da9356e`, worktree `C:/dev/main/meri-greenfield-worktrees/g1-browser-wire-owner`. This report is the sole tracked addition. The outline preceded helper code; applicable AGENTS and human implementation standards were read. All new supervisor/capture/proposal/evidence is ignored under `.task-inputs/role-owner-1/` (E). The canonical SOURCE5 ten/fourteen source bytes were read-only throughout.

## Actual read-only evidence

The eight calls ran **22:41:25.967610–22:41:33.579262 UTC**, 7.641s total inside one bounded480s child, exit0/no exception. Each AWS invocation used the existing raw-pinned `scripts/qualification/aws_evidence.py` capture, fixed `capiro-dev`/us-east-1, JSON, stdin EOF, shell false, connect10/read30, total attempts1 and45s direct-child bound. Its three import sources were fully read and pinned before import. A local wrapper explicitly supplies `AWS_CLI_OUTPUT_ENCODING=utf-8` and `PYTHONIOENCODING=utf-8`; canonical source is unchanged. Existing profile files are selected explicitly; credentials are neither read into reports nor copied.

| Actual call | Observed result |
| --- | --- |
| STS GetCallerIdentity | Exact UserId `AIDA6CVOOW5YCNOGMSALQ`, account967807252336, `arn:aws:iam::967807252336:user/capirocli` |
| IAM GetRole, exact new name | Retained nonzero CLI result, typed `NoSuchEntity`, exact role “cannot be found” |
| CFN DescribeStacks, exact new name | Retained nonzero CLI result, typed `ValidationError`, exact stack “does not exist” |
| SimulatePrincipalPolicy: six CFN actions | Six `allowed` decisions, no missing context |
| SimulatePrincipalPolicy: seven exact-role IAM actions | Seven `allowed` decisions, no missing context |
| SimulatePrincipalPolicy: PassRole | Exact proposed role, `iam:PassedToService=states.amazonaws.com`; `allowed`, no missing context |
| SimulatePrincipalPolicy: TestState | Resource `*`, east1 requested-region context; `allowed`, no missing context |
| CFN ValidateTemplate | No parameters; `CAPABILITY_NAMED_IAM` for the single proposed IAM role |

The 15 simulation rows match the requested actions/resources; no continuation marker is returned. Their matched statement names AdministratorAccess. These are simulation observations, **not proof of actual CreateChangeSet/role creation/PassRole/TestState success, every SCP/session constraint, future unchanged permissions or service trust delivery**. The two expected absence errors remain failed AWS CLI processes and are not relabeled as successful calls. Full binary stderr/stdout and original argv/time/hash envelopes remain available for owner review. Initial incorrect local helper filenames were read-discovery errors only; there was no failed hidden cloud retry.

Actual summary `E/authority-1/summary.json`: **39866B/SHA256 `262227913167ceda78474ef92114246b0ab7357a1ffb27e47260ab6016442323`**. External child envelope `E/authority-child-process.json`: **2236B/SHA256 `302ea871b64862a23dbf9effd926741db7cc1068c3baf93dfb020d72b9fa642d`**. Summary status is deliberately `CAPTURED_CURRENT_AUTHORITY_PENDING_OWNER_REVIEW`. All seven initial pins plus ten canonical source records were equal before/after the capture, including root's accepted-source DATA `browser-source5-owner-readback-1.json`, SHA `86b2e3dbb419714e5668700ecacb6ad0db0353686161308754df892aebbec5de`. No accepted-authority status was manufactured.

## Exclusive owner scope and refusing proposals

Verified absent before claiming the exact original directory:
`C:/dev/main/meri-greenfield-worktrees/g1-browser-wire-shape-repair/.task-inputs/browser-wire-owner-actions-1` (OWNER). A new `OWNER-CLAIM.json` records this worktree's preparation scope. All25 authority payloads were copied byte-for-byte into `OWNER/authority-captured-1/`; `E/authority-copy-manifest.json` binds original/copy bytes and hashes. This supplies the canonical private-record containment without rewriting their original paths inside historical captures.

There is **no** final `role-authority-reviewed.json`, `role-stage-freeze.json`, `role-stage-owner-acceptance.json`, stage operation or consumed action. Three new E proposals intentionally refuse: `role-authority.PROPOSAL.json`, `role-stage-freeze.PROPOSAL.json` and `role-stage-owner-acceptance.TEMPLATE.json`. Null final times/nonces/record hashes and nonadmitted statuses are explicit. Root must read the complete raw evidence and supervisor, then write its own exact final decision/authority/freeze/acceptance; the helper never promotes the proposals. Final raw record triples must use canonical `str(Path(...))` path spelling and actual bytes/SHA, not copied illustrative forward-slash proposal values.

The final authority, if accepted, must bind the actual copied summary and the exact target role/stack. The canonical freeze keys/schema are preserved, with action `role-stage`, original run `b247b9a1-bfde-414a-a76b-9ff4fdd83110`, account967807252336/us-east-1, exact source closure, current actual approval/deadline, fresh64-hex nonce, `records={authority:<root-final raw record>}`, and `parameters={}`. No fixture T0/C has started; no volume/create/delete reservation was touched.

## Staging supervisor for owner source review

`E/run-reviewed-role-stage.py` is **8495B/SHA256 `ed20ad04fa42001ec069ae0c56d8e683443fd2fa1b34c56e0d74694fe9680cf5`**. It is source-prepared, uninvoked on its dispatch path. Canonical binding/domain/CLI files are unchanged; this thin owner process wrapper owns only admission integrity, one-child supervision and receipts. It has no execute/volume/TestState/host route.

Future root command, after separately accepting exact source and files:

```text
<pinned Python3.12.14> -I -B <E>/run-reviewed-role-stage.py <external SHA256 of ROOT role-stage-owner-acceptance.json>
```

The acceptance file is fixed at OWNER and exact-key validated: status/action/run/source/source-owner-decision, raw authority/freeze/supervisor/capturedSummary records, actual acceptedAtMs and dispatchDeadlineMs. It requires `OWNER_ACCEPTED_ONE_BROWSER_ROLE_STAGE`; current proposals cannot satisfy it. Admission lasts at most600s, every captured authority envelope must still be≤600s old, and the final freeze deadline must be within that dispatch deadline. Any stale evidence requires separately preserved new fresh reads and a new reviewed decision; there is no freshness bypass.

Before allocation the supervisor rehashes the complete fourteen-member raw source closure, canonical ten-member anchor, root accepted-source decision, pinned Python/AWS binaries, final authority/freeze/self and all copied raw authority streams/envelopes. Fixed files have plain/no-reparse ancestors, singleton regular-file/size bounds and same-API pre/post identity checks; canonical child repeats its reviewed protected-source/freeze validation before imports. These trusted owner files are not a multiuser authorization service or a hostile-root defense.

It refuses all existing stage/output/reservation slots, creates one exclusive supervision receipt before dispatch, and calls the unchanged canonical entry exactly once:
`Python -I -B SOURCE5/run_action.py role-stage <actual freeze SHA> <canonical closure SHA>`.
The canonical role action performs fresh exact full STS immediately before its own exclusive `role-stage-consumed.json` and one CREATE change-set request. The supervisor clips its child to120s and remaining final deadline; binary streams plus source/input postchecks are retained. Unknown child/cloud outcome consumes the attempt and requires read-only reconciliation, never another stage request. Direct-child timeout and postcapture limits do not promise descendant termination or remote completion. A successful child is staging only; root must inspect the actual AVAILABLE single-role ADD/Original template before separately authorizing any ExecuteChangeSet.

Canonical closure remains `8f5436ff0e75cdf2313e90ee485aa855f6ceea3f5859c2d814ba10e4bf536dbb`; complete14 closure remains `8f1f25312129310a95c86e0f2221c91d957fca49613f161bcc0ad61171b9ade2`. Python3.12.14 SHA is `10d845f50a2af64e3500bb2fcb348b5bc98a75d8ddada63e45ba1da6a1fc79d1`; AWS executable SHA is `4f53b4a03e0927c746d83aa40e136623edc828ee3b834c720a51a5b7f4198360`. Its9.3MiB executable is explicitly within the supervisor's16MiB runtime-file bound. Local source inspection caught that runtime bound before any dispatch-path invocation.

Only targeted inert checks ran: AST syntax parse, `--help` exit0 before file/config I/O, and missing argument exit2 before allocation. Both retained binary checks passed and source/OWNER path inventory stayed unchanged. No domain suite or fake staged action was replayed. A second reviewer/root must inspect the actual wrapper and final decision data before invocation. Source modules, provider/source credentials, worker assets, contracts and current Meri resources remain untouched. **CLOSED preparation writer; no staging authorization requested from or inferred for the human user.**
