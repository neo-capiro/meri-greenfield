---
name: meri-quick-action-skills
description: "Meri v3 Skills panel (bottom-right context rail) enable + live deploy, and a concurrent-deploy race-condition trap hit along the way"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8992a821-3ef8-408c-b170-d94de072fc10
  modified: 2026-08-19T19:11:41.588Z
---

The Meri v3 "SKILLS" section (bottom of the right-hand context rail in the undocked `/meri` workspace) was fully built in code — readable labels ("Research a Company", "Relationship Brief", "Client Changes", "Portfolio Changes", "Portfolio Overlap") sourced from `packages/shared/src/meri-skills.ts` (`MERI_SKILL_REGISTRY`), rendered by `apps/web/src/vnext/meri/VNextMeriContextRail.tsx` (merged via PR #1057, `agent/meriv3-v4-rail-panel-rework`) — but was showing "No skills are available for this workspace yet." because the server-side flag gate (`MeriFeatureFlagsService.isMeriQuickActionSkillsEnabled`, `apps/api/src/meri/meri-feature-flags.service.ts`) requires the env var `MERI_QUICK_ACTION_SKILLS_ENABLED=true`, which was never set on the live `capiro-dev-api` task definition.

**2026-08-19: fixed.** Added `MERI_QUICK_ACTION_SKILLS_ENABLED=true` to a new `capiro-dev-api` task-def revision and rolled the service to it. Verified live via Claude-in-Chrome on `os.capiro.ai/meri` — all 5 skills now render with real labels + descriptions. Rollback is task-def revision 163 (the pre-change baseline). Tenant allowlist defaults to `capiro-internal` (`meriQuickActionSkillsTenantSlugs`, env `MERI_QUICK_ACTION_SKILLS_TENANTS` not set), which covers Neo's own tenant — no per-tenant DB flag needed on top of the env var for this rollout.

**Trap hit mid-deploy, worth remembering:** `aws ecs update-service` was called against a task-def built from the *then-current* revision (163) — but by the time it landed, another concurrent deploy had already registered and started rolling out revision 164 with a *newer container image* (unrelated to this change). The naive update silently reverted that in-flight image deploy back to the old one while only adding the env var. **Always re-run `describe-services` right before `update-service` to check for an in-flight PRIMARY deployment with a different image** before assuming the revision you last read is still the source of truth — then rebuild your change on top of *that* revision instead. Fixed here by re-registering the flag change on top of 164's image as revision 166, which is what's live now. The stray revision 165 (image 163 + flag, an accidental regression) was deregistered — never actually ran.

**Also checked while here (2026-08-19), for the record:** `RETRIEVAL_RERANK_ENABLED` is also off on `capiro-dev-api` (internal search re-ranking quality knob, degrades to a fallback silently — not user-visible, not urgent). Everything else with an env kill-switch (`MERIV2_ENABLED`, `MERIV3_ENABLED`, `STRATEGY_MERI_ENABLED`, `STRATEGY_AGENTS_ENABLED`, `NOTETAKER_ENABLED`) is already true. `CLIO_MCP_ENABLED` looks absent from the task def but fails **open** by design (unset = enabled) — not actually gated. Several other features (Strategy Planner, agentic Meri, engagement vNext reskin, meetings cross-user grouping, etc.) have no env switch at all and are gated purely by a per-tenant `settings_jsonb.clioFeatureFlags` DB row — not queried this session, so their on/off state for any given tenant is still unknown.

See also [[reference_capiro_deploy_traps]], [[project_web_vnext_os_capiro]].
