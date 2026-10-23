---
name: project-meri-conversation-deploy-pin
description: "Every Meri conversation started before an image deploy is refused (401 SESSION_REFUSED) after it; fix C11 (O102) composed with C10 as fable/c11-on-c10-20261021@9e7de79e, awaiting B review (10-21)"
metadata:
  node_type: memory
  type: project
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-21T15:36:45.373Z
---

**Found 2026-10-21 on candidate 10** (`3c56c3e9`). Diagnosis: `adj-reports/adj-e-SESSION-REFUSED-AFTER-CANCEL.md`. Fix report: `adj-reports/adj-e-C11-SURVIVE-DEPLOY.md`.

**The mechanism:** the initial-binding record pins `configurationSha256` and `versions.imageDigest`, and every deploy changes both. The same "conversation = one image" pin sat in 7 more places:
- prepared-candidate `valid()`/`select()`;
- the proxy owner currentness and placement;
- next-run-journal `reserve`/`accept`/`execution`;
- the history view;
- the registry `originalAdmission`;
- settled-source revocation (`ALLOCATION_MISMATCH` against the current render's allocation).

**The fix (C11, decision O102, built by me 10-21, NOT merged or deployed):**
- Image identity is per run. The original record proves owner, client and policy; its deployment pins bind only the original run.
- The seam for C's checkpoint seeding: `execution()` refuses `NEXT_RUN_CHECKPOINT_RUNTIME_CHANGED` only when `{sdk,cli,contracts,checkpointFormat}` differ. An image-only deploy resumes the SDK session.
- 4a adds the line `CONTROL_SESSION_REFUSED step= code=`, plus the metric filters `ControlSessionRefused` and `ControlSessionDiagnosticsSuppressed` (template only).

**Composed with C10 (10-21):** `fable/c11-on-c10-20261021@9e7de79e`. Ship them TOGETHER: C11 alone leaves the worker `next-turn-options` pin in place. C10's `session-continuity.mjs` (`NEXT_TURN_SDK_CHANGED`, O103) replaced my `execution()` seam. On top of C10, `accept` relaxes the reservation-versions equality and re-checks continuity; without that, a successor reserved before a deploy is bricked.

**PG test trap:** `provision-postgres.sh` applies migrations only through conversations `0011`, and the suites need the `MERI_INSPECTION_TEST_*` env. Set both, and apply `0013+`, gateway `0002` and artifacts `0003`, or every `*-pg` suite refuses before connecting. Script: `adj-e-notes/c11/pg-linux.sh` plus `extra-migrations.sh`.

**Still pinned (follow-ups):**
- pause→resume across a deploy (continuation envelope `checkpoint.versions`);
- stopping a still-live previous-render run from the new render.

**Traps found:**
- `identity-context.mjs` replaces EVERY context failure with one `NATIVE_AUTHORITY_UNAVAILABLE`, so carry diagnostics explicitly.
- `owner-independent` throws a hostile `Proxy` as a rejection and asserts zero traps. Never read error fields without `util.types.isProxy` (the `refusalDiagnostic` in context-adapter).

**How to apply:** a reopened conversation failing after a deploy means this, until C11 ships. Check the DB record's `versions.imageDigest` against the serving image.

Related: [[project-meri-hot-path-phase-workflow]], [[reference-meri-in-image-test-recipe]]
