# Wave 2 · Agent 1 · S2: authority-lite (PULLED INTO WAVE 1 by Neo, 2026-10-22: chat fails on control→Core authority calls)

**From:** Fable. **Lane:** R (runtime core). **Repository:** neo-capiro/meri-greenfield. Branch from the current default branch head at send time.
**How we work:** you build; dot's reviewers review; Fable gates, merges and ships. Draft PRs only; no merges, no AWS; list tests run and not run; mutation-check every new test. Read `WORKFLOW.md` (meri-greenfield `docs/handover/20261022/`).

## Sources of truth
The two master closeout plans (20261021), `STANDING-RULES.md`, and the tickets below, verbatim. Implement each ticket's bounded work and meet its acceptance exactly. If anything conflicts or is left open, ask on #202; don't decide.

## Plan row (FINAL-PLAN §5)
| **S2** · P2 PR-B + authority-lite | P2 PR-B (exchange collapse). **Authority-lite**, which replaces ADR P3: Meri control uses Core's combined current-authority receipt and its bounded Clerk cache (P6-Core, deployed in Phase 0) instead of separate identity, membership and context calls. Write intents use the run's own session instead of minting one per intent, which M4 needs. | Core calls per turn ≤ 30 (from about 151). Core time ≤ 3 s per turn. A revoked user loses access within 30 s. |

## Scope
Authority-lite replaces ADR P3. Meri control uses Core's **combined current-authority receipt** and its **bounded Clerk cache** (P6-Core, deployed in Phase 0) instead of separate identity, membership and context calls. Write intents use the run's own session instead of minting one per intent (M4 needs this). P2 PR-B already shipped.

## Acceptance
- Core calls per turn ≤ 30 (from about 151; measure via the owner `meri.turn.counters`, `CoreCalls`).
- Core time ≤ 3 s per turn.
- A revoked user loses access within 30 s (a negative test plus a live-check criterion).
- Also add the CloudWatch **alarm** on `ControlSessionRefusals` in `infra/product-preview/first-chat-observability.mjs` (the metric is already deployed; Phase 0 left the alarm).
