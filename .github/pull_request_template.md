## What and why

## Checklist (all required)

- [ ] **No dead code.** Everything this change replaces is deleted in this PR: code, tests, fixtures, docs, config, env vars, flags, IAM statements, ALB rules, secrets, task definitions, kit steps. Temporary diagnostics are removed.
- [ ] **Proof of deletion** is below: the identifiers, files and resources deleted, each with a `git grep` that returns nothing. Any drop in test count is explained.
- [ ] **Simple and standard.** No new proxy, relay, per-operation authority, reservation ledger, credential-minting service or lease. If a new mechanism is needed, the description names the standard feature it replaces or why none exists.
- [ ] **Not a superseded ticket.** Checked `docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
- [ ] **Claude handles the harness.** Nothing here re-implements something the Agent SDK or AWS already does.
- [ ] **Core is the gatekeeper for Capiro data.** Tests cover another tenant, another client and walled data.
- [ ] **No customer IDs, UUIDs, prefixes, secrets or credentials** in this diff. This repository is public.
- [ ] Tests run and not run are listed. A failure that is identical on the base is labelled inherited, with the evidence.

## Deleted: identifiers, files, resources, and `git grep` proof

## Tests run / not run

Standing requirements: `docs/handover/20261022/STANDING-REQUIREMENTS.md`
