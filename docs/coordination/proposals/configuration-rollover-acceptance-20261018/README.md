# Configuration rollover acceptance proposal — 18 October 2026

**Status: NOT APPLIED. NOT ACTIVATED.** These are review-only patches copied byte-for-byte from the delegated `/tmp` drafts. This commit changes no application code, database schema, runtime configuration, or deployment. Shared receiving owners must review and coordinate their paths before applying any patch. The application gate in the proposed code defaults off.

## Recovery pin and patch order

Base: Meri PR178 branch `codex/meri-config-continuation-20261018`, commit `cce61720c4a5f6f6c37d5c5482ff882fca52eb6b`.

| Order | Patch | SHA-256 | Touched paths |
| --- | --- | --- | --- |
| 1 | `meri-rollover-acceptance.patch` | `3ee784c3c632bbdb6c1b88e4a803a9fe1b9e671bee8bdc3324d70cf978cf1cdd` | `apps/control/conversations/next-run-journal.mjs`, `apps/control/conversations/postgres-store.mjs`, `apps/control/conversations/service.mjs` |
| 2 | `meri-rollover-context.patch` | `dc35c1d19b0c39f35cb9b79904811392541b598660dfe0e6e9302852f7c60856` | `apps/control/action-host/application-adapters/context-adapter.mjs`, `apps/runtime/native-authority/identity-context.mjs`, `apps/runtime/prepared-candidate.mjs` |
| 3 | `meri-rollover-focused-tests.patch` | `4d37092360fc1fcc9ab050608711a30d887a1d77b3342303852bc2625f26a9f2` | `apps/control/action-host/application-adapters/context-independent.test.mjs`, `apps/control/conversations/test/configuration-rollover-acceptance.test.mjs` (new), `apps/control/conversations/test/effective-admission.test.mjs`, `apps/runtime/test/dynamic-candidate-identity.test.mjs` |

From the repository root, verify the exact bytes with `sha256sum docs/coordination/proposals/configuration-rollover-acceptance-20261018/*.patch`. The listed order is the proposed application order **after** the shared file owners accept the hunks. Preserve the base and re-review any conflict rather than changing a hash silently.

## Checks and limits

On clean PR178 base `cce61720`, `git apply --check` passed with all three patches supplied in the listed order. In an isolated `/tmp` clone with dependencies installed from the committed root and runtime lockfiles (`npm ci --ignore-scripts --no-audit --no-fund`), the four changed-file suites passed 94/94: context-independent 76, rollover acceptance 3, effective admission 8, and dynamic candidate identity 7. Three adjacent next-run owner/recovery and candidate-configuration suites passed 32/32. One unrelated public candidate submission test returned `502 CONVERSATION_UNAVAILABLE` on both the patched clone and the clean unpatched base (9/10 in each); it is not evidence of a patch regression. `node --check` passed for the six touched source modules, and `git diff --check` passed in the isolated clone. The declared runtime lockfile supplied `@aws-sdk/client-ecs` 3.1151.0; neither lockfile was changed. The repository's default staged whitespace check reports three `+ ` lines inside the preserved test patch payload; `git -c core.whitespace=-blank-at-eol diff --cached --check` passed. No live SQL, AWS, model, or deployment action was run.

Patch 1 proposes a canonical current/accept/execution descriptor join. Its adopted Run INSERT supplies `runs.transition_sha256`; the original retains `NULL`, and descendants inherit the adopted transition digest. A RESERVED adopted target is bounded by `validUntilMs`, while an ACCEPTED replay remains eligible after that decision expiry. Patch 2 proposes an opt-in versioned local current-run fact bound to the descriptor SHA and keeps historical original pins distinct from current image pins. Patch 3 tests those junctions.

This proposal is **not** a complete activation path. Registry, issuer, model grant, native allocation, and product budget first-write paths still need coordinated `transition_sha256` propagation and canonical descriptor currentness. The gated lifecycle transition path deliberately refuses until its source descriptor is bound. Static original admission, startup flag ownership, focused runtime tests after integration, and live qualification remain open.
