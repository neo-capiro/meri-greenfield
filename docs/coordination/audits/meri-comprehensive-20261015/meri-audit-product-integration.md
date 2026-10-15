## Product integration verdict

HOLD for a complete Meri product. The repositories contain substantial implementation and deliberately honest disconnected UI, but the reviewed sources do not establish one composed, authenticated, persistent product. Four main gaps remain; the known keyboard/SSR and inherited Preferences defects are not counted again.

### Reviewed source boundaries

| Repository | Main/default | Candidate inspected |
|---|---|---|
| capiro-frontend | main `02c02d95bdf3949662b9123f425271c6491ffdab` | `meri/figma-34-ui` `9b4de0583d5300183a2582fcc70350b3114200cd`; earlier review `a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b`, baseline `4e1421054df0d32c564f7c9bc75cbd5e5366b428` |
| meri-greenfield | main `8b123bea4c90794dc2d766814b6ddbdbfe0928bc` | Core `ba40647c5b6f1f81773869e41ce82c099d64d505`; P1a `6d9bb391005f73c8be6ec636c346a05381b5bd98`, P1b `06b2f4991cfd9d85ea20fee1b7b9cb3bd721dc40`, P1c `e0f94fe00a65ddd7f3f663bc2eafd25def7dfda4` inspected separately |
| capiro-backend | default is **backend-import**, `c76f5fc0df6688743afeec274211afd2e67fe8f1`; no main | Application baseline `4945791dfc8e755a2abaddfa60cdcf670ee20712`; runtime candidate `f4f9e1361d92ac0afadd67c1cae3f5faefa829ec` remains separate |

Meri main does not contain the candidate `apps/runtime/control.mjs`. These candidate findings must not be described as merged-main behavior.

Frontend 9b4 changes only mobile start-tile CSS and the mobile Files-navigation browser test. It does not resolve desktop integration or known keyboard/SSR holds. [Exact delta](https://github.com/neo-capiro/capiro-frontend/compare/a0b58a2b9d26fb13bc5c38c21e6eafd68245a93b...9b4de0583d5300183a2582fcc70350b3114200cd).

## 1. Canonical startup does not compose the full product

Trace at Meri core ba40647:

- [CLI line 10](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/cli.mjs#L10) starts control with the signal, without product owners.
- [control.mjs lines 76–92](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L76-L92) rejects externally supplied product ports when native-candidate mode is configured, then supplies only `identityContext` from that candidate.
- [product-applications.mjs lines 26–35](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/product-applications.mjs#L26-L35) mounts documents, selected tasks and SDK sessions, but defaults absent selected-task/session owners to unavailable.
- [artifact application lines 13–16](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/artifacts/application.mjs#L13-L16) also fails unavailable without its options owner.
- The final dispatch at [control.mjs lines 62–67](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/runtime/control.mjs#L62-L67) does not mount the separate action query/draft/prepare/execute application.

Impact: enabling frontend flags does not connect the missing owners. Existing reusable modules are not proof that the canonical process exposes their functionality.

P1a/P1c retain identical control source; P1b changes telemetry but preserves identity-only candidate composition. All three retain the same product-applications blob. No combined P1 integration was assumed.

Minimum repair: compose the actual product owners through reviewed trusted startup, including durable authority and persistence; exercise authenticated public action/document/selected-task/session paths against that exact composed artifact.

## 2. Real conversation UX stops after one submitted run

At frontend 9b4:

- [MeriConversationView lines 74–120](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/features/meri/conversation/MeriConversationView.tsx#L74-L120) disables input whenever a submission exists, including an observed successful submission. It explicitly says recent-conversation listing and new-turn controls are unavailable.
- [query-journal.ts](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/shared/meri-conversations/query-journal.ts#L12-L98) retains nonsecret intent and exact selected conversation/run in QueryClient memory. This provides same-page/reopen protection, not durable recovery across browser reload.
- [input.ts lines 12–22](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/shared/meri-conversations/input.ts#L12-L22) allows submit/history/cancel/events/reconnect only. It does not expose the lifecycle control or checkpoint-inspection endpoints present in [Meri lifecycle HTTP line 11](https://github.com/neo-capiro/meri-greenfield/blob/ba40647c5b6f1f81773869e41ce82c099d64d505/apps/control/conversations/lifecycle/http.mjs#L11).

Impact: this is a useful one-run observer, not the required continuing conversation workspace with discovery, new turns, steering, resume/fork and approval recovery.

Contract qualification is also split: frontend pins `meri-contracts` 0.1.3 while core declares 0.1.5. This is not evidence old chat is broken; it is evidence the newer lifecycle has not been adopted end to end.

Minimum repair: implement the required lifecycle through canonical APIs and persistent receipts; prove reconnect, reload, retry, new-turn, cancellation and approval-wait behavior without changing run identity or duplicating effects.

## 3. Much of the finished-looking workspace is still fixture-only

[SidebarDestinations lines 23–79](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/shared/shell/SidebarDestinations.tsx#L23-L79) gives real destinations to Conversations and Files. Runs, Approvals, Memory, Routines and Data access have only fixture destinations.

The [fixture registry](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/features/meri/fixtures/screens/registry.ts#L31-L52) includes browser, runs, artifacts, approvals, routines, sources, memory, workflows and settings screens. Their presence is design coverage, not connected-product acceptance.

[Preferences panel](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/features/meri/screens/settings/MeriPreferencesPanel.tsx#L17-L36) deliberately disables controls pending a verified settings contract. Accounts/connectors, limits, skills, notifications and privacy settings are not a persisted settings product here.

[Connection configuration lines 19–33](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/shared/meri-actions/connection-config.ts#L19-L33) exposes a document deployment choice of Word or Excel, rather than all required native artifact families. Action/conversation/document flags default closed.

Impact: approvals, memory, schedules, broad artifacts and preferences cannot be accepted because their screens exist. These were required new-product capabilities even when similarly named legacy workflows were deferred.

Browser requirement: the latest user instruction requires browser availability ON by default in the finished product. Disabled or disconnected source bindings remain unfinished work. Network boundaries, website authentication and consequential-action approval remain separate controls.

Existing Preferences defect, already reported: [navigation lines 82–83](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/shared/shell/SidebarDestinations.tsx#L82-L83) points to `/settings/preferences`; [SettingsScreen](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/features/settings/SettingsScreen.tsx#L43) registers `meri-preferences`. The real link therefore reaches the unavailable fallback. Inherited, not a new 9b4 regression.

Minimum repair: replace fixture-only destinations with authenticated, scoped real hosts and persistence; test every visible desktop control and every required artifact family.

## 4. Objective → Strategy → Planner is not autonomous durable completion

The current frontend still owns the automatic Planner continuation:

- [objective-plan-flow.ts lines 45–87](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/apps/web/src/features/portfolio/objectives/objective-plan-flow.ts#L45-L87): suspend clears automatic execution; advance requires both `automatic` and `observing`; hydration explicitly resets automatic execution.
- Closing the browser can therefore prevent the next Planner step even if Strategy generation itself finishes durably.

The [backend reconciliation](https://github.com/neo-capiro/capiro-backend/tree/23a1c35042f18ca1aae54841e340e06d6c2d815d/docs/objective-automation-reconciliation-20261015) distinguishes existing atomic Strategy/version/job completion from missing canonical output identity and automatic Planner follow-through. The stale claim that Strategy and job completion are separate transactions should not be repeated.

The separate [Objective ready-intent candidate](https://github.com/neo-capiro/capiro-backend/blob/215d072def7d8449ac94559e4e1a44eabf513276/apps/api/src/clients/objectives/objective-work-intent.ts) adds an intent, not a completed dispatcher/provider/runtime integration.

The standalone [Strategy contract candidate README lines 1–13](https://github.com/neo-capiro/meri-greenfield/blob/a631e22f6f8e2283c40140dd5fec147f1a487fa7/packages/contracts/strategy-operations-candidate/README.md#L1-L13) explicitly says runtime execution, authenticated delegation, dispatcher, durable result store and product persistence remain unimplemented.

Minimum repair: freeze one common protocol; compose trusted workload authority, durable dispatch/result custody and canonical output identity; complete Planner independently of the browser; make the UI observe authoritative composite state.

## What is genuinely implemented

The real conversation host uses authenticated identity and selected-client context rather than fixture identity. Account/client/session boundaries reset cached state. Issuance and proxy code use fixed service destinations, scoped session material, strict routes and fail-closed behavior. The fixture shell visibly identifies synthetic data.

Those are meaningful source-level strengths. They do not demonstrate live authentication, entitlement enforcement or restart recovery without integration execution.

Code organization is generally recognizable: frontend routes → features → shared clients/contracts, with fixtures separated. The backend default remains a broad historical import, and substantial legacy Strategy code remains. I did not establish a repository-wide dead-code proof; deleting code based only on absent direct imports would be unjustified because DI, dynamic routes, CLI and build consumers require tracing.

## End-goal scope accounting

| Scope | Historical accounting | Current audit treatment |
|---|---|---|
| Legacy registry | 139 entries: 96 selected, 43 deferred | Historical baseline, not today’s final instruction |
| Required new product | Conversation lifecycle, memory proposals, artifacts/revisions, public browser, schedules, revocation, budgets and release operations | Mandatory independently of legacy classifications |
| Additional historical deferrals | Individually authenticated websites, device/browser bridge, live browser takeover, full in-browser Office editing, full 139-workflow parity | Must be reconciled with “complete it all”; not silently considered dropped |
| Mobile | Explicitly deferred relative to desktop | Keep separate from desktop acceptance |
| New user browser direction | Browser enabled by default | Required final behavior; implementation/qualification pending |
| Latest “complete it all” | Broader completion direction | Fable needs an explicit reconciled final ledger; historical 43 cannot silently remain excluded |

The [scope ledger](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/CAPABILITY-SCOPE.md#L19-L39) itself distinguishes new mandatory product capabilities from legacy rows. The [master crosswalk](https://github.com/neo-capiro/meri-greenfield/tree/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/coordination/master-crosswalk-20261015) and [deployment plan](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/plans/MERI-DEPLOYMENT.md) retain unaccepted release gates; source presence is not gate acceptance.

Approval provenance: the repository records human scope approval in D011 and Codex G0 acceptance in D012; the scope document labels D012 as scope disposition. Treat this as a recorded historical approval with a citation mismatch, not a fresh verified user approval to exclude these capabilities today. [Decision record](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/coordination/DECISIONS.md#L23-L33).

### All 43 historically deferred registry capabilities

Exact names from the [pinned ledger](https://github.com/neo-capiro/meri-greenfield/blob/9a41cfe54174cdd11cdfbd84e90cc8087bdfc0d6/docs/CAPABILITY-SCOPE.md#L43-L179):

- Research Portfolio, 17: manage_research_portfolio; get_research_portfolio_analytics; create_research_portfolio_snapshot; request_research_portfolio_output; save_research_portfolio_output_to_client; watch_research_portfolio; update_research_portfolio_change_state; get_research_portfolio_bookmarks; create_research_portfolio_bookmark; get_research_portfolio_fit; get_research_portfolio_reviews; add_research_portfolio_review_note; get_research_portfolio_rules; get_research_portfolio_imports; get_research_portfolio_operations; prepare_research_portfolio_brief; prepare_research_portfolio_meeting.
- Relations/legislation/Florida, 9: find_path_to; get_legiwatch_review; compare_florida_budget_amounts; prepare_legiwatch_briefing; compare_legislative_versions; save_legislative_research; preview_legiwatch_relevance; save_legiwatch_relevance; apply_legiwatch_suggestion.
- Legacy document/email workflows, 5: create_meeting_brief; draft_policy_memo; save_note; send_email; reply_email.
- Direct canonical-memory mutations, 3: confirm_memory; correct_memory; forget_memory.
- Client/commercial workflows, 9: get_pe_buyer_workspace; create_client; update_client_profile; explain_opportunity_match; compare_funding_opportunities; build_opportunity_action_plan; get_business_development_brief; resolve_business_development_source; save_business_development_brief.

Deferring those legacy names did **not** defer local brief/document creation, memory proposals/sourced corrections, or application retention/deletion.

## Evidence limits

This lane independently read pinned sources, traced calls/routes, compared candidate files and counted the 96/43 ledger. It did not run applications, tests, databases, models, browser actions or deployments.

The frontend [qualification report](https://github.com/neo-capiro/capiro-frontend/blob/9b4de0583d5300183a2582fcc70350b3114200cd/docs/meri-conversation-host-20261014/QUALIFICATION.md) contains reported local/unit/browser results but leaves all 337 native acceptance rows open. Those receipts are not an independently rerun 9b4 acceptance suite. Core ba40647 also preserves known failing-test attribution rather than proving a clean integrated release.

The four integration gaps above are source-supported. Whether an uninspected deployment supplies additional composition remains unverified; no deployment success or universal absence is claimed.
