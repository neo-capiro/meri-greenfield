# Wave 2 · Agent 2 · MP: Claude API path alongside Bedrock (RE-SCOPED 2026-10-23 by Wave 2 item 0; send only after item 0 step 2 is released)

**From:** root Codex under Neo's current authorization. **Lane:** D (domain, contracts). Its `apps/proxy` ownership ends when item 0 deletes the proxy. **Repository:** neo-capiro/meri-greenfield, plus a capiro-frontend handoff for the picker via agent 4. Branch from the current default branch head at send time.
**How we work:** root assigns exact files/heads; the author implements and runs meaningful affected checks; a separate Astra Ultra reviewer reviews the exact result. Root owns integration, heavy gates, AWS and shipping. Preserve one-writer ownership and other work. Use `../../CODEX-SETUP.md` and `../../CODEX-VALIDATION-AND-SHIPPING.md`.

## Standing requirements (Neo, updated2026-10-24). Read `STANDING-REQUIREMENTS.md` in the handover folder before anything else.
1. **Claude handles the harness** (actual SDK full harness on AgentCore Runtime V1, direct Bedrock, Capiro data as tools). Never build a custom replacement for something the SDK or AWS already does.
2. **Keep it simple and standard.** No per-hop re-verification, proxies, credential-minting services or reservation ledgers. Core is the gatekeeper for Capiro data.
3. **Leave no dead code.** Delete what your change replaces in the same PR, remove temporary diagnostics, add no flag that nothing turns on, and show `git grep` proof in the PR description.
4. **Keep Capiro data working.** Core owns canonical tenant/member/client/wall permissions and revocation; preserve General/client semantics, memory, all read families and their positive/negative/paging cases.

## What changed

The original MP added a second provider path *inside the owner/proxy*, with both paths sharing budgets, usage records, telemetry and Stop. Item 0 deletes the proxy, the owner and the budget reservations, so there is nothing to extend. MP is now a **provider setting on the runner's SDK**, per `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`:

- **Bedrock (default):** `CLAUDE_CODE_USE_BEDROCK=1` with the AgentCore runtime IAM role.
- **Claude API:** `ANTHROPIC_API_KEY` from AWS Secrets Manager, readable by the runner task role only. It is never exposed to the model, the tool gateway or the browser.
- **Choice:** a provider, model and reasoning level per conversation, with a default in Settings. They reach the runner as run configuration.

## Neo's decision 9 (plan §8), unchanged

Keep the current Claude model on Bedrock **and add the Claude API as a second path, with every model and reasoning level selectable** (a default in Settings, plus a per-conversation picker). SDK upgrades still need the transcript-recap handover first (O103).

## Scope

- Do not touch `apps/proxy` or the budget code. Any provider difference lives in the runner's environment and one small provider config.
- Usage and cost for both providers come from the SDK result into the one ledger (spec §3). Limits are the SDK's per-run limits plus the tenant cap.
- Switching provider or model mid-conversation: verify in the spike whether a restored SDK session resumes across models and providers. Where it can't, use the transcript-recap handover (O103) and tell the user.
- Which built-in tools exist on each provider is a spike question (spec §8). Anything that is Claude-API-only must be shown honestly in the UI.

## UI libraries for this phase (FINAL-PLAN §10, Neo 2026-10-22)

- ReUI Cascader: provider → model → reasoning-level picker for the Settings default and the per-conversation picker (masters `563:44165`, `563:44221`, `563:44282`; review `563:44623`). Agent 4 builds the picker UI in lane U; agent 2 owns the runner's provider configuration
- Sonner: model default saved, only after the receipt
- Rules: Figma first, pinned versions and licenses, one library per pattern, lazy-load heavy libraries, receipts decide success (§10.4).

## Acceptance

- The whole-flow chat check passes on both providers.
- Switching model or provider mid-conversation works, or tells the user honestly that it starts from a recap.
- Usage is recorded per provider, from the SDK result.
- The API key lives in AWS Secrets Manager and is referenced by ARN, never by value.
- No code for the old proxy path remains (`STANDING-REQUIREMENTS.md` rule 3).
