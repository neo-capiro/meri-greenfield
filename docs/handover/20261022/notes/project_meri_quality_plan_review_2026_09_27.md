---
name: meri-quality-plan-review-2026-09-27
description: "Reviewed the 09-27 Meri architecture/quality-recovery plan; its 4 code defects are real on main, but it missed 2 live-config facts (tool selector OFF in prod, JEV enforcing for all tenants) and ignores existing thumbs-down data"
metadata:
  node_type: memory
  type: project
  originSessionId: dfab0c9e-7387-4820-ad68-b280e6295f03
  modified: 2026-09-27T16:27:58.301Z
---

On 2026-09-27 Neo asked for an honest review of `Downloads/Meri-Architecture-Quality-Recovery-and-Cutover-Plan-2026-09-27.md` (1,120 lines, baseline main `63c214e9`; Neo calls it "my plan"). Context: users are unhappy with Meri; Neo wants it to feel like "Hermes for gov affairs" with access to Capiro data.

Verified at origin/main `42942deda` — all four of the plan's headline defects are real:
- `institutional-knowledge-retrieval.adapter.ts` ~L190: `ORDER BY updated_at DESC LIMIT 501` BEFORE ranking → older eligible memories unreachable
- `useMeriChatController.ts` ~L2938: approval `if (!res.ok) return;` — no user-visible error
- `meriv3-assistant.service.ts` ~L2480: any resolved tool result marked `done`; only thrown errors become `error`
- `meriv3-retrieval-assistant.service.ts` L363: governed turns `return super.run(...)` before `MeriV3SemanticRuntimeStore.run` → no tool selection

Live config the plan did NOT check (task def `capiro-dev-meriv2-orchestrator:84`):
- no `MERI_SEMANTIC_TOOL_GATEWAY_*` env or secrets → gateway is `legacy` for every tenant; fixing the governed wiring alone changes nothing live
- JEV `MERI_JEV_PROVIDER_MODE=enforce`, `MERI_JEV_PROVIDER_TENANTS=all`, 8s timeout, 2 attempts, post-draft live-repair loop → plan treats JEV as a future staged P2, but it is fully live
- all modes `gpt-6-astra`

User-feedback source exists: thumbs-down with 10 reason codes (`apps/web/src/components/chat/message-feedback-shared.ts`) → `MeriService.recordMessageFeedback`. **CORRECTION (same day): my claim "feedback only in ChatDrawer, not the workspace" was WRONG** — the live vNext `/meri` route renders `apps/web/src/vnext/meri/VNextMeriMessage.tsx` → `MeriMessageFeedback` (thumbs, `controller.submitFeedback`). I missed it because a `git grep ... | head -10` truncated the vnext hits and a later grep only matched `<MessageFeedback`. Lesson: never `head`-truncate a "does X exist anywhere" search; grep component-name variants. Jira has ~15 Meri tickets, all internal, none about answer quality.

Runtime size at that commit: `meriv3/` ≈12k non-test lines (assistant service 2,878), `meri-tools.service.ts` 8,952, `useMeriChatController.ts` 3,500.

Re-verified same day against LIVE images (Neo asked; "Meri has changed since Sep 12"):
- live API = `42942deda` (mutable `:latest`), live web-vnext = `42942deda`, live orchestrator = `c2bc41a8` (09-25, PR #1819; 7 files behind main, core runtime files identical) → all 4 defects are live
- orchestrator revs 60–84 (09-16→09-25): tool-gateway flags NEVER set; JEV none until 09-22 → shadow 1 tenant (rev 71) → enforce 1 tenant (rev 74, 09-23) → enforce ALL (rev 75, 09-23)
- tool registry grew ~92 (09-12) → 132 (09-27) with no per-turn selection
- team deleted ~251k lines of retired Hermes runtime (#1867) + dead code (#1883); `apps/api/src/learning/` already turns feedback into governed memory candidates; daily digests already exist (PE Watch, tracker, insight-generator `daily_briefing`, engagement client daily brief)
- JEV cost/latency canary reporting exists: `docs/meri/grounding/stage-3/3c-cost-latency.md`

Plan v2 (`...2026-09-27 (1).md`, 40,839 words vs 16,195): adds decision sheet, §7.5 tool consolidation, coworker jobs/steering (§5.6), Congressional Drafting engine (§8.6), open-model register + LoRA fine-tuning program (§8.4–8.7, §9.7, §11.5), new suites CW/DR/M/TRN/MOD (~182 named cases total), Appendix H = the 26 real reported JEV findings (23 accuracy/source-honesty; #26 "adoption concentrated on one user"). Its new claims verified TRUE: `search_federal_contract_awards` validates `fiscalYear` but `listContracts`→`commonAwardClauses` never filters on it; `page: 1` hard-coded; "Use this FIRST" in multiple tool descriptions; JEV repair 8s/60k in `live-repair.service.ts`; Qwen3.8-27B and granite-4.2-8b exist (Apache-2.0, Aug 2026). My evaluation: approve direction + repair core; sequence (not parallelize) drafting/ML; split doc into 3.

**Why:** the plan diagnoses from source only; live flags diverge from what it assumes, so "fix X" can be a no-op in prod.
**How to apply:** before any Meri quality work, re-read live orchestrator task-def flags and pull thumbs-down reason counts first; never assume source defaults = served behavior. Related: [[project-capirov2-ci-blocked]], [[project_web_vnext_os_capiro]].
