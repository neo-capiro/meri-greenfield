# W02-06 owner browser-host cleanup controller — independent exact-commit review

Status: **PREPARATION REVIEW ACCEPT (offline)**. Runtime/actual AWS **NOT RUN**; no gate promoted;
Codex owns acceptance. Reviewer is a separate real Hermes session (not the owner/implementation
session) and does not self-approve, deploy, push, amend, resume, delegate or retry. This review
executed only offline Python fake-AWS/clock/CLI tests; it made **no implementation edits** and no
AWS/network/credential/source/native/container/browser/OS/SDK/Office call.

## Reviewed artifacts

- Reviewed commit (pinned base = HEAD): `21c87bc27a7c3ef9b7df2d6841312ada1acd6668`
- Parent / diff base: `6630ab8dfd24bf4cdfaaa87a060ddd2f1ea98254`
- Branch: `review/w02-owner-controller`; worktree `C:\dev\main\meri-greenfield-worktrees\w02-controller-review`
- Reviewer session: `20261009_185630_a6a44b` (separate reviewer session)
- `git status` clean at HEAD; `git show --check 21c87bc` clean. Commit adds exactly three new files
  (name-status all `A`), matches the reported scope:
  - `scripts/qualify-browser-host.py` — 711 lines, SHA256 `bc06a339d24120581ef21b6942453b330fcba47af1ea9f6cb5ee21a8db54a964`
  - `scripts/test_qualify_browser_host.py` — 599 lines, SHA256 `82744b35a59b70e718104bd95c3e81ca7c99e0e2fd29a246eba88178878a832b`
  - `docs/coordination/reports/W02-06-OWNER-CONTROLLER-PREPARATION.md` — 13 lines
- Both source SHA256s **match** the preparation report exactly. No existing probe, infra, contract,
  package/lock, task brief or other report is touched.

These are Codex-owned integration-owner files (thin cleanup controller), not a Hermes implementation
artifact. Constants reference only the NEW dedicated qualification resources (`vpc-06e1941747e798f0a`,
`subnet-0864c000b771df32c`, `ami-0fb0f484b75566814`, account `967807252336`, profile `capiro-dev`,
new stack `MeriGreenfield-BrowserQualification`) established by the W02 Fargate baseline / W02-06 task
brief. No current Meri/Capiro resource, path, deletion or admin op is referenced.

## Checks actually run (real, this host)

| Check | Command | Result | Exit |
|---|---|---|---|
| Syntax/compile | `python -B -m py_compile scripts/qualify-browser-host.py scripts/test_qualify_browser_host.py` | OK | 0 |
| Owner fake suite | `python -B -m unittest discover -s scripts -p test_qualify_browser_host.py -v` | 28 pass / 0 fail / 0 skip (4.702s) | 0 |
| Reviewer adversarial harness | `python -B .task-inputs/w02-06-adversarial-review.py` (ignored scratch) | 20 pass / 0 fail | 0 |
| Whitespace/conflict | `git diff --check`; `git show --check 21c87bc` | clean | 0 |

Bundled Python: `C:\Users\neoma\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`
(Python 3.12.14). Owner 28-test count and pass result reproduce exactly. No controller CLI
`--inspect`/`--execute` was run against any AWS endpoint.

## Independent adversarial cases exercised (fake-only; imports the owner fakes)

20 new cases in `.task-inputs/w02-06-adversarial-review.py` (ignored, NOT committed), targeting
boundaries the owner suite does not cover. All pass:

- Full change-set fingerprint binds across **multiple DescribeChangeSet pages** (combined-hash equals
  the manifest `changeSetSha256`); **metadata drift between pages** rejected; **repeated pagination
  token** rejected; **pagination bound exceeded** rejected.
- EC2 discovery: **reservation OwnerId mismatch** blocks cleanup; **repeated instance pagination
  token** blocks cleanup (no termination in either).
- Manifest strictness: **extra key** rejected; **future `reviewedAt`** rejected; **naive (tz-less)
  timestamp** rejected; **non-canonical run UUID** rejected; **wrong-account stack ARN** rejected;
  **string `"true"` for `reviewed`** rejected (type-exact).
- Template/scope gate: **disallowed resource type** (`AWS::S3::Bucket`) rejected; **`Transform`**
  rejected; **two EC2 instances** rejected; **change-set logical id absent from template** rejected
  — each before any mutation (`mutations() == []`).
- Observation: **wrong `logical-id` tag** never admitted and **never terminated**.
- Containment edges: **uncertain `TerminateInstances` (`ProcessExitUnknown`) is attempted exactly once
  and never auto-retried**, leaving no confirmed termination; a **`shutting-down`** host is not counted
  terminated and is not double-terminated; a **retained (non-delete-on-termination) root volume**
  blocks confirmation.
- CLI guard: `execute-change-set` and `terminate-instances` both raise "mutation disabled" without the
  execute flag.

## Required-bound confirmations (each verified by inspection + a passing fake test)

- Fixed account/region/profile/caller, immutable full-stack + change-set binding, canonical hash of the
  FULL combined change-set (omitting only `NextToken`), canonical **Original** `GetTemplate` JSON hash,
  all-`Add`, single-EC2, exact-new-`REVIEW_IN_PROGRESS` stack, `QualificationRun` effective parameter +
  stack tag + instance tag all bound — `validate_manifest`/`preflight` (`qualify-browser-host.py`
  214-447). No current Meri resource referenced.
- Default read-only; `--execute` requires an explicitly supplied reviewed v1 manifest
  (`main` 684-707; `AwsCLI.call` mutation/allowlist guard 179-183).
- Fresh exact STS immediately precedes **each** mutation (execute 641-647; terminate 569-572);
  `termination_requested` is set **before** the terminate call so an uncertain response is never
  auto-retried (571-572). No automatic mutation retry anywhere.
- Durable pre-execute deadline/watchdog precede mutation: the `armed-before-execute` record
  (`armedAt`, `absoluteDeadline`, `cleanupWindowSeconds`) is persisted, then the independent watchdog
  thread starts, then `execute-attempted` is persisted with `required=True`, and only then
  `ExecuteChangeSet` (634-647). A pre-mutation persistence failure aborts before any mutation.
- Independent watchdog containment holds during slow main API, failure, interrupt and successful
  outputs, and during ROLLBACK/`CREATE_FAILED` (tests at 228-260, 404-437, 537-553).
- Repaired paths confirmed: persistent **CFN status/inventory outage CANNOT block** scoped EC2
  discover → fresh STS → terminate (containment runs before any CFN confirmation, 562-579).
  **Delayed tag visibility cannot yield early empty success** — confirmation requires positive host
  observation and observed root volumes (`bool(observed and self.volumes)`) and `observed <= current`
  (595). **Post-attempt disk write/readback failure does not disable containment** (`save`/`journal`
  swallow `OSError` once `attempted`, 296-312), while **pre-execute persistence failure aborts**.
  Actual stack-tag / effective-parameter conflicts fail the gate pre-mutation and, post-mutation, only
  prevent a positive confirmation without blocking otherwise-safe containment. **Missing instance tags
  stay bounded INCONCLUSIVE then re-observe** (never admitted, never sticky) (493-496); **conflicting
  / old / wrong host is never admitted** (491-501, 525-528).
- A positive `terminated` state **and** observed root EBS returning `InvalidVolume.NotFound` are both
  required; missing/inconclusive observations cannot pass (`root_volumes_deleted` 533-552,
  `complete` 595). **No application qualification is inferred from CFN** — `applicationQualification`
  is `NOT_ASSESSED` throughout and the success status is
  `cleanup-confirmed-application-unassessed` (284, 680).
- Thread force-kill limitation and guest 15-minute poweroff timer are explicit and expected; the
  controller claims no full-production or OS/browser-sandbox enforcement.

## Findings (concrete, with lines)

- **F1 — LOW / fail-closed observation. Persistent rejection latch can force a false FAILED.**
  `observe()` records a permanent `problems` entry on any concrete mismatch (526), and `cleanup()`
  blocks confirmation forever if any `"Rejected scoped EC2 observation"` problem exists (596-597).
  For a genuinely foreign/old host this is exactly the required behaviour. The same latch means a
  one-off transient rejection of the *legitimate* host (e.g. a momentary unexpected `State` or a stale
  tag value) also prevents a truthful `confirmed` verdict afterwards. This is fail-CLOSED: it never
  produces a false confirmation, it can only under-claim success. Not a rejection trigger.
- **F2 — INFO / limitation. `DeleteOnTermination` is advisory, not a gate.** A root mapping with
  `DeleteOnTermination != True` is recorded as a non-fatal `problem` (518-519), not a gate. The safety
  outcome still holds because confirmation independently requires the observed root volume to return
  `InvalidVolume.NotFound` (543-546); the adversarial `test_retained_root_volume_not_confirmed` case
  confirms a retained volume blocks confirmation. Doc nuance only.
- **F3 — INFO / disclosed limitation. Watchdog is a daemon thread.** It survives a slow main API call
  but not controller force-kill or machine death (609-627, 669-679); the separate guest 15-minute
  shutdown timer remains required and is not in this controller. Correctly disclosed by the owner.
- **F4 — INFO / fail-closed coupling. `attempted` is set before the required durable attempt write.**
  `self.attempted = True` precedes `update(required=True, status="execute-attempted")` (645-646). If
  that required write fails, no mutation occurs but the run is still treated as possibly-attempted and
  cleanup runs (conservative). Confirms the pre-mutation abort path is genuinely closed.

No correctness defect was found in the required behaviours. In particular: no mutation without a
durable pre-execute attempt record and fresh STS; no auto-retry of an uncertain mutation; containment
independent of CFN availability; no early-empty or missing-observation false success; no
non-terminated or retained-volume false success; no foreign/old host admitted or terminated; and no
application qualification implied by stack status.

## Limits / NOT RUN (explicit, not fabricated acceptance)

- Actual AWS, the CloudFormation/EC2 APIs, the real AWS CLI, STS, credentials, the network, the
  browser/OS/container sandbox, the guest timer, and any deployment are **NOT RUN**. No host launched;
  no stack created, executed, deleted or modified; no `--inspect`/`--execute` against real AWS.
- Real API response shapes and eventual consistency are unqualified. For example `resolve_parameters`
  rejects any change-set parameter item carrying `ResolvedValue` or `UsePreviousValue` (245); this is
  fail-closed but its compatibility with real `DescribeChangeSet` output is unverified. Likewise the
  exact key set of the real combined change-set response (needed for the manifest `changeSetSha256`)
  is an owner task. Consistent with the owner's disclosed "CFN/API eventual consistency and actual
  response behavior remain unqualified; every inconclusive cleanup is failure."
- The controller does **not** review template content (root-volume encryption/KMS, IMDSv2,
  userdata/seccomp, guest timer, IAM scope) beyond binding the reviewed `templateSha256` — by design a
  thin controller. Those remain the scope of the separate exact host-template review and the one
  closed-network probe admission. No host launch is admitted until the exact host template, this
  controller and the change-set reviews plus one closed-network probe admission pass.
- Correctness is proven only against injected fakes; a false ACCEPT is not possible from this review
  (runtime NOT RUN), and a review failure would require owner repair, not verdict self-promotion.

## Verdict

**PREPARATION REVIEW: ACCEPT (offline).** All four required checks pass with the reported counts
(28 owner fake tests, SHA256s matching the preparation report, clean whitespace), and 20 independent
adversarial fake cases pass. The exact new-stack/change-set/template/AMI/network/run bindings are
enforced, mutations are gated on an explicit reviewed manifest with fresh STS and no auto-retry, the
pre-execute durable deadline/watchdog is persisted before any mutation, and the required repaired
containment boundaries (CFN-outage independence, delayed-visibility safety, post-attempt disk-failure
containment, pre-execute abort, conflict/missing-tag handling, terminated + root-EBS-deleted
confirmation) all hold. Disclosed limits: F1 fail-closed rejection latch, F2 advisory
`DeleteOnTermination`, F3 daemon-thread watchdog (guest timer still required), F4 conservative
attempted-before-durable-write, and runtime/actual-AWS NOT RUN. No implementation files were modified
by this review. Codex owns acceptance and the owner retains the change-set execution and separate
stack teardown.
