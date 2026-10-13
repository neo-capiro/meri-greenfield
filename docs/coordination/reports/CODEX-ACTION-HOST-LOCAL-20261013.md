# Local host recovery author report

Exact base: `61ffc8f2487a010c9baba0c8e18088b42569d90a`. Source freeze: `8a3643e3564f676b66edc6b4cc220fb1c4193098`. Dedicated branch: `task/meri-action-host-local-20261013`.

The actual three-host loopback flow now completes query/read, draft, pending proposal, unapproved refusal, reconstruction and explicit approval of the same proposal, one task effect, reconstruction and identical replay, then fresh revocation. The canonical lookup, command approval, budget, metadata, host and application owners remain unchanged. Only the allocated local fixture/runner/CLI are repaired.

The absent synthetic approval previously threw a generic transport error, producing conservative UNKNOWN. The local composition now returns a missing fact (null), which the canonical guard classifies COMMAND_APPROVAL_REFUSED before dispatch. Once explicitly approved, the original fact owner supplies the decision. This fixes fixture protocol without weakening the required NOT_DISPATCHED/zero-effect assertion. The runner preserves the existing bounded approval/revocation waits and adds content-free diagnostic phases; direct callers receive the original error.

Checks and retained failures:

- Parent first CLI failure is retained unchanged in `integration/host-cli-first.*` at base, with process group460304 absent.
- `initial-direct.*`: 1 pass/1 fail; actual UNKNOWN versus expected NOT_DISPATCHED. Source preimage committed in `8fccbd9da01444b60e3298dc7d72807fd10e3e0f`; process group461194 absent. The initial test had unreachable numeric accounting expectations; these were corrected to canonical decimal strings before the first successful full flow. No reached assertion was weakened.
- `missing-approval-fact.*`: 2/2 pass after the local missing-fact repair; process group462522 absent. This capture binds the committed repair through its recorded precommit diff and source freeze.
- `repaired-cli.*`: exact source freeze, zero source diff, actual `--run` PASS in2.979 seconds; process group463544 absent. Three listeners closed with zero sockets; fixture closed; one source read, one task effect, one command reservation/invocation, command and lookup charge each `'10'`. Unapproved409, approved observed, identical replay, revoked401. Lookup rows2 includes one fixture-seeded row, not two new queries.
- A sparse-index staging refusal caused no source/runtime failure; explicit `git add --sparse` staged only allocated paths. No dependency installation was performed.

No native SQL/database/restart, provider authentication/current policy, customer data or paid call was exercised. Canonical source connectivity and production catalog remain disabled. The process-local maps and synthetic approvals prove the local composition only. Supporting recommendation evidence remains outside the immutable task command hash. Independent integration reviewer reported ACCEPT_SOURCE for exact8a3643e3: 7/7 controls (including unchanged accelerated callback checks and real 30-second deadline corroboration), audit37/37. Its final packet pin is separately owned.

Merge these author commits onto the exact base in order: `8fccbd9d`, `8a3643e3`, then the documentation/evidence closeout commit. Existing root lifetime repair and independent tests are not replaced. Run the CLI above or the focused `node --test apps/control/action-host/local/local.test.mjs` from the integrated checkout with existing minimal dependencies. No secret or source body is included in the output.
