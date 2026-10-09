# H00 Hermes session qualification — stages 1–2 report

Status: `ready-for-review` (not accepted)
Task: H00 Hermes session qualification
Explicit session ID: `20261009_145356_5c1d2a` (stage 2 is the explicit resume of the same session)
Updated: 2026-10-09T18:59Z (UTC)

Result: HEAD of this task commit (exact full SHA returned in the final handoff; not embedded
here to avoid a self-referential hash). A passing fixture proves local delegation structure
only — not authentication, current authorization, durable storage, network/browser isolation
or Fargate compatibility.

## Coordinates

- Worktree (cwd): `C:\dev\main\meri-greenfield-worktrees\h00`
- Branch: `hermes/h00-qualification` (dedicated worktree, single writer)
- Base commit: `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3` (tag `contracts/v0.1.0`)
- Node: v24.19.0; npm: 11.17.0
- Contracts: frozen `packages/contracts/meri.schema.json` 0.1.0, referenced read-only via
  `packages/contracts/validate.mjs`. No contract, lockfile, `package.json` or AGENTS.md change.

## Changed files (owned paths only)

- `evals/qualification/hermes-session.fixture.json` (new)
- `evals/qualification/hermes-session.test.mjs` (new)
- `docs/coordination/reports/H00-HERMES-QUALIFICATION.md` (new, this file)

Exactly these three paths are committed. No other repository path was modified.

## Fixture

Synthetic data only. Deterministic UUIDs; no live tenant, credential or source content.
The fixture carries one frozen `WorkspaceManifest` (logical cwd `/workspace/conversation`,
single portable entry `outputs/brief.txt`) and one `ApprovalProposal` wrapping a
`task.create` `Command` whose `commandSha256` is the RFC 8785 canonical SHA-256 of that
command.

- Fixture SHA-256: `59fcee0913c875fb8cf45adfa4fe2d71a02c2446152c9560181236b0d8914362`
- Test SHA-256: `49c8ecfc57dc54aed699986b124602f5b49fab668803d2c68a6c9b7217f03131`
- Embedded `commandSha256`: `5c8b86698ccd77ef70a93414be3a61e9c2ea08d3ebf5a4ecc8c381b68d622031`

## Resume evidence (stage 2)

Stage 2 resumed the same explicit session `20261009_145356_5c1d2a` (never `--resume latest`)
and verified continuity before any edit:

- cwd unchanged: `C:\dev\main\meri-greenfield-worktrees\h00`
- branch unchanged: `hermes/h00-qualification`
- base unchanged: HEAD `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`, tag `contracts/v0.1.0`
- fixture SHA-256 unchanged from stage 1: `59fcee0913c875fb8cf45adfa4fe2d71a02c2446152c9560181236b0d8914362`
- test SHA-256 unchanged: `49c8ecfc57dc54aed699986b124602f5b49fab668803d2c68a6c9b7217f03131`
- working tree carried exactly the three owned untracked files, nothing else

## Checks and exact outcomes

### `node --test evals/qualification/hermes-session.test.mjs`

- Stage 1 (2026-10-09T18:55Z): exit 0 — tests 5 / pass 5 / fail 0
- Stage 2 resume (2026-10-09T18:59Z): exit 0 — tests 5 / pass 5 / fail 0

```
✔ fixture conforms to frozen 0.1.0 WorkspaceManifest and ApprovalProposal shapes
✔ accepts the portable workspace and the unchanged approved command
✔ rejects traversal and non-portable workspace paths before restoration
✔ rejects a mutated approved command argument
✔ rejects a mutated attachment version
```

### `npm run check:contracts`

- Stage 1: exit 0 — tests 10 / pass 10 / fail 0
- Stage 2 resume: exit 0 — tests 10 / pass 10 / fail 0

```
node --test packages/contracts/test/*.test.mjs
✔ accepts portable manifests and immutable proposals
✔ rejects unsafe workspace paths before restoration
✔ rejects duplicate paths and unsupported symlinks
✔ rejects changed approved arguments, input versions and tenant approvers
✔ rejects unknown protocol versions, loose identity fields and unsafe integers
✔ canonical hashes are key-order independent and bind every command input
✔ event envelope requires typed payload, scopes and positive durable sequence
✔ rejects file ancestors regardless of manifest insertion order
✔ truncated scans cannot claim complete coverage
✔ approval survives executor replacement while approved intent stays immutable
```

Both commands ran from the assigned worktree on the resumed session; all fixtures use
synthetic data.

## Stage 1 scope deviation and resolved cleanup

During stage 1 an additional ad-hoc cross-check created a temporary script at
`C:\Users\neoma\AppData\Local\Temp\hermes-verify-h00.mjs`, executed it, then deleted it in the
same session. That write was outside the three owned task paths and is recorded here as a
scope deviation. Resolution: the temp file was removed during stage 1; no copy of it remains
on disk; no repository path, contract, lockfile, credential or source data was touched by it,
and no Git object referenced it. Stage 2 created no files outside the three owned paths and
used only in-memory node commands for any additional check. This is an editing boundary only:
the Windows worktree is not a filesystem or credential sandbox, and no such guarantee is
claimed.

## Policy / migration effects

None. No migration IDs allocated. No source connectivity enabled. No deployment, push,
credential retrieval, global-configuration change or background job performed.

## Remaining limitations

- Fixture proves local structural/hash/path checks only; authentication, current
  authorization, durable storage, browser isolation and Fargate compatibility remain NOT RUN.
- Status is `ready-for-review`, not accepted; a separate read-only Hermes reviewer and a Codex
  rerun/inspection of the exact result commit are still required.

## Process / worktree state

Single writer for this worktree; stage 2 committed only the three owned files. Working tree
clean after commit; local branch `hermes/h00-qualification` advanced by one commit on top of
the base. No other commit amended, no push, no recursive delegation, no background scheduler.
