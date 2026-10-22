# Wave 2 · Agent 2 · MP: Claude API path alongside Bedrock (DRAFT: send only after Wave 1 closes; Neo's rule, fresh "agent 2 v{next}" session)

**From:** Fable. **Lane:** D (domain, proxy, contracts). **Repository:** neo-capiro/meri-greenfield (proxy/owner) plus a capiro-frontend handoff for the picker via agent 4. Branch from the current default branch head at send time.
**How we work:** you build; dot's reviewers review; Fable gates, merges and ships. Draft PRs only; no merges, no AWS; list tests run and not run; mutation-check every new test. Read `WORKFLOW.md` (meri-greenfield `docs/handover/20261022/`).

## Sources of truth
The two master closeout plans (20261021), `STANDING-RULES.md`, and the tickets below, verbatim. Implement each ticket's bounded work and meet its acceptance exactly. If anything conflicts or is left open, ask on #202; don't decide.

## Plan row (FINAL-PLAN §5)
| **MP** · Model choice: Claude API alongside Bedrock | D + U | **Two model paths:** Bedrock (today's) and the Claude API. Any current Claude model and reasoning level is selectable: a default in Settings, plus a per-conversation picker. The API key lives in AWS Secrets Manager. Both paths get the same budgets, usage records, telemetry and Stop behaviour. | S1 | The whole-flow chat check passes on both paths; switching model or provider mid-conversation works; usage is recorded per provider |

## Neo's decision 9 (plan §8)
Keep the current Claude model on Bedrock **and add the Claude API as a second code path, with every model and reasoning level selectable** (a default in Settings, plus a per-conversation picker). SDK upgrades still need the transcript-recap handover first (O103).

## UI libraries for this phase (FINAL-PLAN §10, Neo 2026-10-22)

- ReUI Cascader: provider → model → reasoning-level picker for the Settings default and the per-conversation picker (masters `563:44165`, `563:44221`, `563:44282`; review `563:44623`). Agent 4 builds the picker UI in lane U; agent 2 owns the proxy and model paths
- Sonner: model default saved, only after the receipt
- Rules: Figma first, pinned versions and licenses, one library per pattern, lazy-load heavy libraries, receipts decide success (§10.4).

## Acceptance
- The whole-flow chat check passes on both paths.
- Switching model or provider mid-conversation works.
- Usage is recorded per provider.
- Budgets, usage records, telemetry and Stop behavior are identical across paths.
- The API key lives in AWS Secrets Manager (Fable provisions the secret; you reference it by ARN and never by value).
