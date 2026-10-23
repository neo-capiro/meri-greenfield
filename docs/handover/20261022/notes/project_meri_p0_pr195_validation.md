---
name: project-meri-p0-pr195-validation
description: "P0 telemetry PR neo-capiro/meri-greenfield#195 (43b705c8) plan-conformance verdict CHANGES (10-20); the change list and where the report is"
metadata:
  node_type: memory
  type: project
  originSessionId: 132a8902-f161-42d4-b1f8-47a3f7430573
  modified: 2026-10-21T00:44:54.620Z
---

**Verdict:** I gave Neo's agent-1 P0 telemetry PR #195 (`feat/meri-p0-telemetry` @ `43b705c8`, base `69fd1994`) a verdict of **CHANGES** on 2026-10-20. Report: `C:\dev\fable\adj-reports\phases\P0-VALIDATION-plan-conformance.md`.

**Required changes:**
- remove `.github/workflows/meri-p0-telemetry.yml` and `scripts/qualification/p0-telemetry/`;
- remove `docs/hot-path/P0-IMPLEMENTATION.md` and `P0-VERIFICATION.md`, moving their content to the PR description and `TURN-TELEMETRY.md`;
- use the exact suppressed-filter tokens `PRODUCT_OWNER_DIAGNOSTICS_SUPPRESSED` and `PRODUCT_PROXY_DIAGNOSTICS_SUPPRESSED`;
- add the runner `TelemetryDropped` to its alarm;
- move the outcome expression in `server.py` inside `_safe`.

**Conforms:** the telemetry code itself (allowlist, redaction, identity wrappers, never-throw). The PR's own GitHub workflow refused before any step ran, so the image gate is unproven by the PR; A ran the Docker gates separately.

**Why:** P0 is the measurement base for every later hot-path phase ([[project-meri-hot-path-phase-workflow]]). I validate, then ship.

**Update 10-20:** the re-check of `e64b2231` gave **ACCEPT** for plan conformance.
- All 8 items were done, plus a proxy writer-release fix in `main.py`.
- The ACCEPT is conditional on A's Docker gates on `e64b2231`.
- Nits: the rehearsal hard-pins 164 (the poll share is timing-sensitive), and there is dead vocabulary (`exchange` / `EXCHANGE_RETIRED`).

**How to apply:**
- Before shipping, re-check the PR head for these items and confirm A's 24/24 gate result.
- Plan baseline corrected to 164 Core calls ([[reference-meri-rehearsal-traced-owner-trap]]).
