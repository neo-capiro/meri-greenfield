# Conversation inventory planner consumption — source handoff, 18 October 2026

Base: draft PR176 `9e5d8097f8f67a19418b57672a9672ddd73cb00e`. This source-only successor teaches the pure retention inventory and planner to retain every explicit conversation control and event row and to carry unpublished completion rows. It adds no production `facts` composer, row deletion route, policy, hold or liability owner, and does not enable purge. The Core signed memory source coordination pin is `63e426b0cd8ea82857268ea2c5541cc3b78eda17`, superseding `8712e508` in the earlier PR174 handoff; Core issuance remains hard off.

## Planner contract

`apps/control/retention/inventory.mjs` requires a conversation header, at least one run, explicit event and control arrays, complete per-run event sequences, unique row identities, run/control membership and a nonempty owner actor. Each event and control becomes an exact row target. Artifact subjects refuse those foreign arrays. A source pin, when present, covers the exact PR176 owner fields. `CAPTURING` and `UNKNOWN` completion rows retain exact targets with null checkpoints and no proven object references; a `PUBLISHED` row requires its checkpoint. Canonical checkpoint object references carry `bytes` and `scopes`; the enumerator validates and projects their storage-version identity.

With the PR176 producer's `inventorySha256`, enumeration verifies the owner-field digest and compares `objectVersions` to all checkpoint and continuation references it enumerates. `artifactVersionRefs` are event lineage and do not become storage deletion steps. `planPurge` and shared-holder eligibility refuse an unpublished completion independently of a liability port's answer. A missing unresolved-completion list refuses the planner. This is a source fact about unfinished capture, not an invented hold or orphan-byte liability.

The existing `inventory-source.mjs` composes a separate memory-continuation read, has no production all-class source and cannot carry the PR176 digest intact. It remains source-incomplete for injected legacy/fixture composition. A production composer must preserve the producer's complete same-transaction memory rows and digest under one suppression generation and obtain truthful SDK, selected-output, artifact, native-journal, upload, receipt, schedule, external-memory, budget and shared-reference inventories from their owners. This slice does not add that composer or claim the legacy one is qualified for production.

## Checks and remaining gates

Focused pure inventory, composition, planning and recovery controls passed 24/24. The disposable network-disabled PostgreSQL 16 producer fixture passed 1/1 with genuine canonical owner output and a genuine `CAPTURING` row. It asserted exact event and control targets, object-version parity and no pending capture object reference. Its private container, socket and logs were removed. `node --check` and `git diff --check` passed. No live SQL, AWS, provider or deployment action occurred.

The PostgreSQL row deletion owner still admits only its existing SDK and artifact routes. It has no conversation event, control or completion deletion route; no effect is added here. Purge remains disabled. A separate owner must qualify exact row deletion, the full retained-data inventory, policy, holds and liabilities, suppression and runtime readback before activation.
