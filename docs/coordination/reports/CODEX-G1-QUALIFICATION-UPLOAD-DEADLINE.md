# Qualification upload deadline

Status: CLOSED source preparation, pending distinct review, at
`f0c9f3b7232666a85c3f7ff844ade98b1da02c63`.

An outline was recorded before editing. Ownership is the canonical
`scripts/qualification/aws_evidence.py`, one focused
`aws_evidence_timeout_test.py` and this report. Extend only the canonical timeout
validation for an explicitly requested long, conditional, checksum/KMS-bound
qualification ZIP upload. Preserve environment/profile/retry/CLI behavior and all
other operation deadlines. Validate exact unique option/value pairs and regular
bounded body identity/hash before any evidence allocation or subprocess dispatch.
Reuse canonical duplicate-key JSON validation. Verify observable acceptance and
preallocation denial with offline subprocess fakes, retaining failures and raw
captures. No AWS operation, E2 retry or operational evidence change is authorized.

## Behavior and boundary

The actual E2 conditional source upload of217,387,189 bytes reached the old60s
capture timeout with empty streams/no ACK; the owner's later read-only HEAD
returned404 and no StartBuild occurred. Those operational records, consumed
attempt and frozen dispatcher remain unchanged. This source fix permits a
separately reviewed fresh attempt; it does not retry or reset that operation.

The existing `capture(out, label, arguments, timeout=45)` API and default remain.
All timeouts now require exact Python `int` (booleans/floats refuse). Values1..60
retain the original operation behavior. Values61..180 require precisely one
`s3api put-object` with nine unique explicit option/value pairs:

- Bucket `meri-greenfield-qual-build-967807252336-us-east-1`.
- Key `inputs/proxy-linux-import-<40 lowercase hex>/<canonical lowercase UUID>.zip`.
- `--if-none-match *`, SSE `aws:kms`, exact qualification key ARN ending
  `1cca74fc-d9ae-43a6-8bfd-b93107e90042`, checksum algorithm `SHA256`.
- Exactly `sourcecommit` and `archivesha256` JSON metadata, using canonical
  duplicate-key refusal; sourcecommit equals the key and archivehash equals
  the actual body SHA256. The explicit base64 checksum must match that digest.
- An absolute, nonempty, single-link regular body no larger than512MiB, with
  link/reparse ancestors refused. Hashing streams in1MiB chunks with stable
  path/open-file identity checks before/after. No zip-format parser is introduced.

Any duplicate, missing, additional, abbreviated, equals-form or global option in
this long-timeout profile refuses before evidence directory creation and process
dispatch. Other services, result keys, buckets, encryption keys, unsupported
checksums, malformed metadata, body drift and out-of-range/type timeouts refuse.
The existing1..60s path is not converted into a new general request validator.

No allowlisted operation or option was added. Canonical profile capiro-dev,
region us-east-1, fixed executable, ambient AWS/proxy/CA removal, configured
endpoint refusal, one SDK attempt, shell=false and connect10/read30 CLI timeouts
remain exact. Only the direct subprocess whole timeout may extend for this
explicit upload profile. Existing raw timeout/failed stream retention remains.

## Actual offline checks

Pinned CPython3.12.14 executable:
`C:/Users/neoma/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`.
One `-I -B -S scripts/qualification/aws_evidence_timeout_test.py` child ran under
a60s external direct-child bound: **10 test methods PASS**,3.466s unittest time,
4.063s child elapsed, exit0, four canonical source pre/post records stable.
Full binary stdout/stderr and process envelope are in
`.task-inputs/qualification-upload-deadline-1/checks-1/` in this dedicated worktree.
There was no failed test/replay in this allocation.

Controls establish forwarding61/179/180s only for the bound upload, unchanged
ordinary1/45/60s, noninteger/bool/range refusal, duplicate/ambiguous options,
namespace/encryption/metadata/hash checks, missing/empty/relative/directory/
oversized/hardlinked bodies, preallocation no-process denial, and one fake timeout
retained without retry. Real subprocess/network effects are audit-denied; the
adapter's process operation is replaced by a deterministic fake. Synthetic body
bytes are not represented as a genuine ZIP or a live upload test.

`source-delta.json` separately records source AST comparison: original capture
body is unchanged except replacing the old timeout conditional with the focused
validator call; allowlists remain equal. `FINAL-MANIFEST.json` binds the finite
source, original raw Git, test and DATA records. Postcommit raw Git readback binds
only the exact three owned paths and clean status.

## Limits and next owner action

This is a trusted-owner-file boundary, not an atomic filesystem lock across the
later AWS CLI reopen. Source/archive bytes must remain immutable through dispatch;
hashing is size-bounded but not an independently preemptible wall-clock phase.
The direct subprocess timeout is not process-tree containment, hard byte-capped
PIPE memory or proof of wire cancellation. Existing timeout outcomes remain
uncertain and consumed. Conditional create is service-side exclusion, not proof
that an arbitrary namespace is new or authority to repeat a mutation.

The owner must independently review this commit, bind a new complete dispatcher/
helper/runtime closure, explicitly choose the longer timeout, renew authority
and admit at most one fresh upload/action. A new invocation/admission must not
reuse E2's consumed reservation or silently repin its frozen files. No upload,
AWS call, StartBuild, native image/import, provider, database or G1 acceptance
occurred here. No ambient credential/proxy/retry behavior or shared contract
was changed.
