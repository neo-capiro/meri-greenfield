# Dot to Fable - source ownership pickup addendum

Date: **2026-10-15 UTC**. Read with [the completion instructions](https://github.com/neo-capiro/meri-greenfield/blob/8bbe8405e03964072ed79be068d2d0a84cf71609/docs/coordination/reports/DOT-TO-FABLE-COMPLETION-INSTRUCTIONS-20261015.md). This addendum returns the shared owner's published source work and the parent's new central source allocation decision. It does not change the original handoff's gates or grant execution authority.

## Provenance pickup order

Published branch: `dot/meri-provenance-refresh-20261015`, exact head `b11a6c95631b219384a69b15447e873ab8b346e2`, tree `054477d478364c754ce40bad031c593a7780898f`. Base: `b5be44d5141ae5fd3830aed789cb7ad525506c4e`. Preserve and integrate these commits in order after checking the actual receiving source:

1. [602d8d43158d5803a0c0107cd28552267a9cbcdc](https://github.com/neo-capiro/meri-greenfield/commit/602d8d43158d5803a0c0107cd28552267a9cbcdc): supported regeneration of conversation and lifecycle provenance metadata; all418 other contracts files byte-identical to base.
2. [c83b7cf859fcb9a920766828303f6190ae1b70c5](https://github.com/neo-capiro/meri-greenfield/commit/c83b7cf859fcb9a920766828303f6190ae1b70c5): supported worker validator pin refresh and new source-only candidate;18 other records and all fields outside the records preserved;57-member source context recorded.
3. [b11a6c95631b219384a69b15447e873ab8b346e2](https://github.com/neo-capiro/meri-greenfield/commit/b11a6c95631b219384a69b15447e873ab8b346e2): clean-source check receipts and retained platform failures. The checks bind clean source `c83b7cf859fcb9a920766828303f6190ae1b70c5`; the final commit changes documentation/evidence only.

[Candidate evidence and limitations](https://github.com/neo-capiro/meri-greenfield/blob/b11a6c95631b219384a69b15447e873ab8b346e2/docs/qualification/candidates/dot-provenance-refresh-20261015/README.md). Independent review accepted this narrow source delta. All45 runtime proof rows and four historical manifests are preserved; no independent expected outcome was edited. Remote verification matched both published branch heads and all18 delivered provenance/audit files byte-for-byte.

The source owner has completed this metadata/pin assignment. When integrating onto newer source, verify dependent source hashes and use the same supported generators for necessary regeneration; do not copy stale metadata or rewrite historical receipts. A newer integrated candidate requires fresh exact-source evidence.

## Required Linux reruns - UNQUALIFIED until run

Windows generated checks/typechecking and source pins passed; runtime proof5/5 passed. Public tests remain139/145 (five Windows URL-path harness failures, one sandbox localhost `EACCES`); pin regressions3/4 (symlink privilege unavailable). The initial sandbox Temp failure is also retained. These controls remain **UNQUALIFIED**; no assertion was weakened or failure relabelled. No Linux rerun is claimed by this addendum.

From an existing authorized repository, with Node24 and Python3 available, use a fresh isolated path (the command fails if it already exists):

```sh
git fetch origin refs/heads/dot/meri-provenance-refresh-20261015
git worktree add --detach /tmp/meri-provenance-linux-review-20261015 b11a6c95631b219384a69b15447e873ab8b346e2
cd /tmp/meri-provenance-linux-review-20261015
git status --porcelain
git rev-parse HEAD 'HEAD^{tree}'
node --version
npm --version
python3 --version
npm ci --prefix packages/contracts --ignore-scripts --no-audit --no-fund
npm --prefix packages/contracts run check
python3 -B scripts/qualification/worker_source_pins.py --check
python3 -B -m unittest scripts.qualification.worker_source_pins_test scripts.qualification.worker_context_test
node --test --test-isolation=none --test-concurrency=1 scripts/qualification/assembled-image/source-proof.test.mjs
git diff --check
```

Run each check independently and retain its exit, output, skips, environment and output hashes outside the source tree. Confirm the checkout is clean before checks. A permitted Linux environment must support ordinary test loopback and link semantics; do not bypass environment denials. If integration changes source bytes, rerun the affected checks at the exact clean integrated candidate and retain its full commit/tree. These source checks do not qualify target Python/native artifact behavior, actual Docker COPY, image scan/admission or live infrastructure bindings.

## Central migration decision - now recorded

The parent integration coordinator has **CONFIRMED** `apps/control/conversations/migrations/0009_next_runs.sql` for the existing next-run/completion source and **RESERVED** `apps/control/conversations/migrations/0010_retention.sql` plus `apps/artifacts/migrations/0002_retention.sql` exclusively for Fable's retention source work. [The central allocation task record](../tasks/CODEX-CENTRAL-MIGRATION-ALLOCATION-20261015.md) is the authoritative new source allocation record, with exact namespace/path, purpose, authorship and immutable baseline.

This supersedes the earlier pending-allocation status as of this date without rewriting the historical audit, SQL or manifests. It grants no SQL acceptance/application, deletion or deployment authority. Retention corrections, explicit policy, restore barrier and purge-disabled boundaries from the completion packet remain required. Shipping/runtime bindings, exact TLS/hosts approval and all original qualification gates remain separate.
