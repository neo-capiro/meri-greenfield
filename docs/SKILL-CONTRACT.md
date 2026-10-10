# Skill contract foundation 0.2.0

Status: additive R2 foundation prepared for independent review. [skill.schema.json](../packages/contracts/retrieval-0.2/skill.schema.json) retains the fourteen named quick-action intents from the [R2 skill ledger](coordination/r2/skills.json). They are selected workflow scope, **not implemented or qualified skills**. No current Meri recipe/planner/skill code or restrictive third-party skill prose is imported. Historical built-ins and firm/self-service skill authoring keep their separate scope decisions.

The UI supplies explicit `skillId`/`skillVersion`, invocation ID, selected/resolved origin, typed requested subject/window and editable prompt. Identity, grants and an executable manifest are never inferred from composer keywords or the prompt. Natural-language invocation must reach the same trusted resolver as a selected quick action; this task defines no text classifier. Mentioning memory cannot reduce a relationship workflow to memory-only evidence, and portfolio selection cannot discard its requested window or required domains. Ordinary questions remain lightweight unless an explicit or reviewed resolved workflow selects a manifest.

An original immutable manifest binds skill ID/version, prose identity/hash, allowed operation versions, required source authority/purpose, subject/window kinds, completion/output rubric, partial-coverage policy, approval boundary, enforced budgets and lifecycle version policy. The catalog validator rejects missing/disabled operations and a required source that no legal operation supplies. These structural checks do not establish that a registered handler/skill exists, that its declared required sources are adequate, or that all promised evidence was actually retrieved. The runtime completion ledger/fixtures remain separate REL-04 work.

The server pins canonical manifest and catalog SHA256 values with the resolved subject/window before execution. Changed content with the same semantic version still changes the digest and is refused by the pin checker. Existing runs retain exact immutable versions; submit/steer/reconnect/resume/fork must preserve the chosen skill/manifest/catalog pins unless an explicit reviewed migration or reselection is recorded. `assertSkillContinuity` rejects silent substitution and tenant/actor changes; it does not implement persistence, migration, scope reauthorization or UI transport. No automatic migration API or authorization bypass is added. A fresh worker/executor still requires its current capability/fence under the accepted 0.1 execution boundary.

Required evidence cannot be omitted because a router chooses one family. An explicit partial result must disclose every unavailable/incomplete required source and unresolved decisive read. Success/completion and absence claims need the manifest obligations and authoritative coverage proof. A judge cannot replace mandatory source reads or counts; optional Decisions/JEV stay disabled. Budgets cover SDK turns, tool calls, purposeful recovery, wall time, cost and output bytes; trusted services enforce them outside the model. The schema does not itself enforce a timer or budget ledger.

Commitments & Deliverables needs an original, separately qualified rubric distinguishing promises from suggestions, known/unknown owner/date, conflicting statements, delivery evidence, deduplication and coverage. Mail, meetings/debriefs, native tasks/action items and monday.com must be checked according to current authorization. monday.com is limited to boards explicitly client-mapped or supplied and authorized; unrelated personal work cannot become client commitments. Disconnected, unavailable and unmapped are separate outcomes. Extraction never auto-creates a task or marks delivery complete without evidence. Any task, memory proposal or artifact filing remains a separate immutable approved action with current authority and receipts. This foundation locks `autoCreateTasks:false` and does not recreate the old procedure.

The matrix below preserves every R2 intent while leaving original manifest/prose/allowed-source choices and execution qualification open. It deliberately assigns no invented manifest version or fake completion result. The schema's version grammar is a contract facility; synthetic `1.0.0` fixture values are not released skills.

| Selected intent ID | Name | Current new-Meri state |
| --- | --- | --- |
| quick_skill.research_company | Research a Company | selected; manifest and execution pending |
| quick_skill.relationship_brief | Relationship Brief | selected; manifest and execution pending |
| quick_skill.client_changes | Client Changes | selected; manifest and execution pending |
| quick_skill.portfolio_changes | Portfolio Changes | selected; manifest and execution pending |
| quick_skill.portfolio_overlap | Portfolio Overlap | selected; manifest and execution pending |
| quick_skill.mail_history | Mail History | selected; manifest and execution pending |
| quick_skill.meeting_prep | Meeting Prep Brief | selected; manifest and execution pending |
| quick_skill.commitments_audit | Commitments & Deliverables | selected; manifest and execution pending |
| quick_skill.funding_opportunity_match | Funding Opportunity Match | selected; manifest and execution pending |
| quick_skill.pe_deep_dive | PE Deep Dive | selected; manifest and execution pending |
| quick_skill.bill_watch | Bill Watch | selected; manifest and execution pending |
| quick_skill.hearing_watch | Hearing Watch | selected; manifest and execution pending |
| quick_skill.representation_lookup | Representation Lookup | selected; manifest and execution pending |
| quick_skill.regulatory_docket_brief | Regulatory Docket Brief | selected; manifest and execution pending |
