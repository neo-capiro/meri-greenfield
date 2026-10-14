# R2 ledger reconciliation at 740cc43706287bf50feda1a7f71cb99711aca30d

Read-only join of the recorded R2 ledgers (`docs/coordination/r2`), the typed retrieval catalog meri.retrieval 0.2.15 (contract 0.2.0), the 14 skill manifests in `packages/skills` and the source adapter families under `apps/gateway/sources`. Nothing is promoted: a bound handler is a source fact, not qualification; a ledger state is the recorded state, not a measurement.

## Counts

- Capabilities: 139 originals (96 selected / 43 deferred); 96 selected map to a catalog operation, 0 selected have no replacement operation recorded; 139 carry runtimeParity NOT_QUALIFIED in the ledger.
- Operations: 97 typed operations; handler bound 0; discoverable (enabled, qualified, handler, no side effect, no approval) 0; availability {"unimplemented":97}; qualification {"pending":97}; with a source adapter family 18; referenced by skill manifests 54; targeted by a capability replacement 96.
- Skills: 14 manifests, 14 ledger rows, 14 selectable; 143 allowed-operation references, 143 present in the catalog, 0 with a bound handler.
- Ledgers: requirements 12 (10 PENDING; proposed input is not a measure; 2 DISABLED_OPTIONAL); gates 12 (10 PENDING; proposed input is not a measure; 2 DISABLED_OPTIONAL); tickets 9 (7 PENDING; proposed input is not a measure; 2 DISABLED_OPTIONAL); findings 10 (10 PENDING; proposed input is not a measure); skills 14 (14 R2 selected intent; original manifest/al).
- Drift entries: 0.

## Drift

None: every ledger identifier resolves, dispositions agree, every skill operation exists in the catalog and every replacement target exists.

## Adapter families and the operations they reference

- `action-items`: `query_action_items`, `actions.query`
- `client-evidence`: `read_client_documents`, `get_client_context`
- `client-knowledge`: `read_monday_client_boards`, `search_memory`
- `dataset-metadata`: `list_global_datasets`
- `identity-contacts`: `find_contacts`, `resolve_entity`
- `mail`: `mail.read_thread`, `mail.list_messages`, `mail.search_messages`
- `meetings`: `meeting.list_upcoming_meetings`, `meeting.read_client_meetings`, `meeting.query_debriefs`
- `memory-proposals`: `memory.list_own_proposals`
- `original-tracking`: `query_tasks`, `query_action_items`
- `research-portfolio-evidence`: `get_research_evidence`

## Operations with source presence but no bound handler

| Operation | Availability | Qualification | Adapter families | Skills |
| --- | --- | --- | --- | --- |
| `mail.read_thread@0.2.0` | unimplemented | pending | mail | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.mail_history, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `mail.list_messages@0.2.0` | unimplemented | pending | mail | quick_skill.mail_history |
| `mail.search_messages@0.2.0` | unimplemented | pending | mail | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.mail_history, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `meeting.list_upcoming_meetings@0.2.0` | unimplemented | pending | meetings | quick_skill.meeting_prep |
| `meeting.read_client_meetings@0.2.0` | unimplemented | pending | meetings | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `meeting.query_debriefs@0.2.0` | unimplemented | pending | meetings | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `query_tasks@0.2.0` | unimplemented | pending | original-tracking | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `search_capiro_data@0.2.0` | unimplemented | pending | — | quick_skill.portfolio_changes, quick_skill.portfolio_overlap |
| `search_federal_contract_awards@0.2.0` | unimplemented | pending | — | quick_skill.portfolio_overlap, quick_skill.research_company |
| `search_federal_subawards@0.2.0` | unimplemented | pending | — | quick_skill.portfolio_overlap, quick_skill.research_company |
| `search_contract_vehicles@0.2.0` | unimplemented | pending | — | quick_skill.research_company |
| `search_procurement_forecasts@0.2.0` | unimplemented | pending | — | quick_skill.research_company |
| `memory.list_own_proposals@0.2.0` | unimplemented | pending | memory-proposals | — |
| `query_action_items@0.2.0` | unimplemented | pending | action-items, original-tracking | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `get_business_development_recent_changes@0.2.0` | unimplemented | pending | — | quick_skill.client_changes, quick_skill.portfolio_changes |
| `search_funding_opportunities@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match, quick_skill.research_company |
| `get_funding_opportunity_requirements@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match, quick_skill.research_company |
| `get_funding_opportunity@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match |
| `get_opportunity_client_context@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match |
| `get_opportunity_government_landscape@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match |
| `read_client_documents@0.2.0` | unimplemented | pending | client-evidence | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `search_federal_grants@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match, quick_skill.research_company |
| `search_federal_awards@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match |
| `get_district_nexus_context@0.2.0` | unimplemented | pending | — | quick_skill.portfolio_overlap, quick_skill.representation_lookup |
| `get_district_nexus_changes@0.2.0` | unimplemented | pending | — | quick_skill.client_changes, quick_skill.portfolio_changes |
| `get_state_legislator@0.2.0` | unimplemented | pending | — | quick_skill.representation_lookup |
| `search_cbo_cost_estimates@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive |
| `search_gao_reports@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive |
| `search_crs_reports@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive |
| `get_bill_status@0.2.0` | unimplemented | pending | — | quick_skill.bill_watch, quick_skill.client_changes, quick_skill.hearing_watch, quick_skill.meeting_prep, quick_skill.pe_deep_dive, quick_skill.portfolio_changes, quick_skill.research_company |
| `read_bill_text@0.2.0` | unimplemented | pending | — | quick_skill.bill_watch, quick_skill.hearing_watch, quick_skill.pe_deep_dive, quick_skill.research_company |
| `get_committee_roster@0.2.0` | unimplemented | pending | — | quick_skill.hearing_watch, quick_skill.representation_lookup |
| `list_members@0.2.0` | unimplemented | pending | — | quick_skill.hearing_watch, quick_skill.representation_lookup |
| `get_pe_contractors@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive |
| `get_pe_bills@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive |
| `get_pe_report_language@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive |
| `get_state_rule_status@0.2.0` | unimplemented | pending | — | quick_skill.regulatory_docket_brief |
| `get_certification_status@0.2.0` | unimplemented | pending | — | quick_skill.research_company |
| `list_global_datasets@0.2.0` | unimplemented | pending | dataset-metadata | — |
| `get_representation@0.2.0` | unimplemented | pending | — | quick_skill.representation_lookup |
| `query_regulatory_dockets@0.2.0` | unimplemented | pending | — | quick_skill.regulatory_docket_brief |
| `find_contacts@0.2.0` | unimplemented | pending | identity-contacts | quick_skill.mail_history, quick_skill.meeting_prep, quick_skill.portfolio_overlap, quick_skill.relationship_brief, quick_skill.representation_lookup, quick_skill.research_company |
| `resolve_entity@0.2.0` | unimplemented | pending | identity-contacts | quick_skill.mail_history, quick_skill.meeting_prep, quick_skill.portfolio_overlap, quick_skill.regulatory_docket_brief, quick_skill.relationship_brief, quick_skill.research_company |
| `search_tracked_bills@0.2.0` | unimplemented | pending | — | quick_skill.client_changes, quick_skill.hearing_watch, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.research_company |
| `search_public_web@0.2.0` | unimplemented | pending | — | quick_skill.portfolio_overlap, quick_skill.regulatory_docket_brief, quick_skill.research_company |
| `scrape_web_page@0.2.0` | unimplemented | pending | — | quick_skill.portfolio_overlap, quick_skill.regulatory_docket_brief, quick_skill.research_company |
| `search_sam_opportunities@0.2.0` | unimplemented | pending | — | quick_skill.funding_opportunity_match, quick_skill.research_company |
| `search_program_elements@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive, quick_skill.portfolio_overlap, quick_skill.research_company |
| `get_program_element@0.2.0` | unimplemented | pending | — | quick_skill.pe_deep_dive, quick_skill.portfolio_overlap, quick_skill.research_company |
| `get_pe_budget_timeline@0.2.0` | unimplemented | pending | — | quick_skill.bill_watch, quick_skill.pe_deep_dive, quick_skill.research_company |
| `read_monday_client_boards@0.2.0` | unimplemented | pending | client-knowledge | quick_skill.client_changes, quick_skill.commitments_audit, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.relationship_brief |
| `search_memory@0.2.0` | unimplemented | pending | client-knowledge | quick_skill.meeting_prep, quick_skill.relationship_brief |
| `get_client_context@0.2.0` | unimplemented | pending | client-evidence | quick_skill.client_changes, quick_skill.funding_opportunity_match, quick_skill.hearing_watch, quick_skill.meeting_prep, quick_skill.portfolio_changes, quick_skill.portfolio_overlap, quick_skill.regulatory_docket_brief, quick_skill.representation_lookup, quick_skill.research_company |
| `get_legal_reference@0.2.0` | unimplemented | pending | — | quick_skill.regulatory_docket_brief |
| `actions.query@0.2.0` | unimplemented | pending | action-items | — |
| `search_committee_hearings@0.2.0` | unimplemented | pending | — | quick_skill.hearing_watch, quick_skill.meeting_prep |
| `get_research_evidence@0.2.0` | unimplemented | pending | research-portfolio-evidence | — |
| `create_word@0.2.0` | unimplemented | pending | — | quick_skill.bill_watch |

## Selected capabilities without a replacement operation

0 of 96 selected capabilities record no replacement operation (REL-02 required): 

## Skills

| Skill | Ledger disposition | Allowed operations (in catalog / handler bound) | Required sources |
| --- | --- | --- | --- |
| `quick_skill.bill_watch@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `read_bill_text@0.2.0`, `get_bill_status@0.2.0`, `get_pe_budget_timeline@0.2.0`, `create_word@0.2.0` | bill_text, federal_legislation, program_elements, artifact_versions |
| `quick_skill.client_changes@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `get_client_context@0.2.0`, `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0`, `meeting.read_client_meetings@0.2.0`, `meeting.query_debriefs@0.2.0`, `read_client_documents@0.2.0`, `query_tasks@0.2.0`, `query_action_items@0.2.0`, `read_monday_client_boards@0.2.0`, `search_tracked_bills@0.2.0`, `get_bill_status@0.2.0`, `get_district_nexus_changes@0.2.0`, `get_business_development_recent_changes@0.2.0` | client_knowledge_profile, mail, meetings, client_documents, tasks, action_recommendation, client_knowledge_monday, tracked_bills, federal_legislation, district_nexus, business_development |
| `quick_skill.commitments_audit@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0`, `meeting.read_client_meetings@0.2.0`, `meeting.query_debriefs@0.2.0`, `read_client_documents@0.2.0`, `query_tasks@0.2.0`, `query_action_items@0.2.0`, `read_monday_client_boards@0.2.0` | mail, meetings, client_documents, tasks, action_recommendation, client_knowledge_monday |
| `quick_skill.funding_opportunity_match@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `get_client_context@0.2.0`, `search_funding_opportunities@0.2.0`, `get_funding_opportunity@0.2.0`, `get_funding_opportunity_requirements@0.2.0`, `get_opportunity_client_context@0.2.0`, `get_opportunity_government_landscape@0.2.0`, `search_federal_grants@0.2.0`, `search_federal_awards@0.2.0`, `search_sam_opportunities@0.2.0` | client_knowledge_profile, funding_opportunities, stored_public_data, sam_opportunities |
| `quick_skill.hearing_watch@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `get_client_context@0.2.0`, `search_committee_hearings@0.2.0`, `get_committee_roster@0.2.0`, `list_members@0.2.0`, `search_tracked_bills@0.2.0`, `get_bill_status@0.2.0`, `read_bill_text@0.2.0` | client_knowledge_profile, public_domain_hearings, legislative_directory, tracked_bills, federal_legislation, bill_text |
| `quick_skill.mail_history@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `resolve_entity@0.2.0`, `find_contacts@0.2.0`, `mail.list_messages@0.2.0`, `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0` | entity_candidates, tenant_contacts, mail |
| `quick_skill.meeting_prep@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `resolve_entity@0.2.0`, `find_contacts@0.2.0`, `get_client_context@0.2.0`, `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0`, `meeting.list_upcoming_meetings@0.2.0`, `meeting.read_client_meetings@0.2.0`, `meeting.query_debriefs@0.2.0`, `read_client_documents@0.2.0`, `search_memory@0.2.0`, `query_tasks@0.2.0`, `query_action_items@0.2.0`, `read_monday_client_boards@0.2.0`, `search_tracked_bills@0.2.0`, `get_bill_status@0.2.0`, `search_committee_hearings@0.2.0` | entity_candidates, tenant_contacts, client_knowledge_profile, mail, meetings, client_documents, client_knowledge_memory, tasks, action_recommendation, client_knowledge_monday, tracked_bills, federal_legislation, public_domain_hearings |
| `quick_skill.pe_deep_dive@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `search_program_elements@0.2.0`, `get_program_element@0.2.0`, `get_pe_budget_timeline@0.2.0`, `get_pe_report_language@0.2.0`, `get_pe_contractors@0.2.0`, `get_pe_bills@0.2.0`, `read_bill_text@0.2.0`, `get_bill_status@0.2.0`, `search_cbo_cost_estimates@0.2.0`, `search_gao_reports@0.2.0`, `search_crs_reports@0.2.0` | program_elements, pe_references, bill_text, federal_legislation, stored_public_reports |
| `quick_skill.portfolio_changes@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `search_capiro_data@0.2.0`, `get_client_context@0.2.0`, `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0`, `meeting.read_client_meetings@0.2.0`, `meeting.query_debriefs@0.2.0`, `read_client_documents@0.2.0`, `query_tasks@0.2.0`, `query_action_items@0.2.0`, `read_monday_client_boards@0.2.0`, `search_tracked_bills@0.2.0`, `get_bill_status@0.2.0`, `get_district_nexus_changes@0.2.0`, `get_business_development_recent_changes@0.2.0` | clients, contacts, mail, meetings, tasks, monday, action_recommendations, outreach, strategies_work, program_elements, legiwatch_bills, hearings, grants, contracts_opportunities, federal_awards, directory, district_nexus, institutional_knowledge, client_knowledge_profile, client_documents, tasks, action_recommendation, client_knowledge_monday, tracked_bills, federal_legislation, business_development |
| `quick_skill.portfolio_overlap@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `search_capiro_data@0.2.0`, `get_client_context@0.2.0`, `resolve_entity@0.2.0`, `search_public_web@0.2.0`, `scrape_web_page@0.2.0`, `search_program_elements@0.2.0`, `get_program_element@0.2.0`, `search_federal_contract_awards@0.2.0`, `search_federal_subawards@0.2.0`, `find_contacts@0.2.0`, `get_district_nexus_context@0.2.0` | clients, contacts, mail, meetings, tasks, monday, action_recommendations, outreach, strategies_work, program_elements, legiwatch_bills, hearings, grants, contracts_opportunities, federal_awards, directory, district_nexus, institutional_knowledge, client_knowledge_profile, entity_candidates, public_web, federal_market, tenant_contacts |
| `quick_skill.regulatory_docket_brief@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `resolve_entity@0.2.0`, `query_regulatory_dockets@0.2.0`, `get_state_rule_status@0.2.0`, `get_legal_reference@0.2.0`, `search_public_web@0.2.0`, `scrape_web_page@0.2.0`, `get_client_context@0.2.0` | entity_candidates, regulatory_dockets, rule_status, research_legal_legislation, public_web, client_knowledge_profile |
| `quick_skill.relationship_brief@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `resolve_entity@0.2.0`, `find_contacts@0.2.0`, `mail.search_messages@0.2.0`, `mail.read_thread@0.2.0`, `meeting.read_client_meetings@0.2.0`, `meeting.query_debriefs@0.2.0`, `read_client_documents@0.2.0`, `search_memory@0.2.0`, `query_tasks@0.2.0`, `query_action_items@0.2.0`, `read_monday_client_boards@0.2.0` | entity_candidates, tenant_contacts, mail, meetings, client_documents, client_knowledge_memory, tasks, action_recommendation, client_knowledge_monday |
| `quick_skill.representation_lookup@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `get_client_context@0.2.0`, `get_representation@0.2.0`, `get_state_legislator@0.2.0`, `list_members@0.2.0`, `get_committee_roster@0.2.0`, `get_district_nexus_context@0.2.0`, `find_contacts@0.2.0` | client_knowledge_profile, facility_representation, state_legislation, legislative_directory, district_nexus, tenant_contacts |
| `quick_skill.research_company@1.0.0` | R2 selected intent; original manifest/allowed sources and ru | `resolve_entity@0.2.0`, `get_client_context@0.2.0`, `search_public_web@0.2.0`, `scrape_web_page@0.2.0`, `search_program_elements@0.2.0`, `get_program_element@0.2.0`, `get_pe_budget_timeline@0.2.0`, `search_federal_contract_awards@0.2.0`, `search_federal_subawards@0.2.0`, `search_contract_vehicles@0.2.0`, `search_procurement_forecasts@0.2.0`, `search_federal_grants@0.2.0`, `search_funding_opportunities@0.2.0`, `get_funding_opportunity_requirements@0.2.0`, `search_sam_opportunities@0.2.0`, `search_tracked_bills@0.2.0`, `get_bill_status@0.2.0`, `read_bill_text@0.2.0`, `get_certification_status@0.2.0`, `find_contacts@0.2.0` | entity_candidates, client_knowledge_profile, public_web, program_elements, federal_market, stored_public_data, funding_opportunities, sam_opportunities, tracked_bills, federal_legislation, bill_text, certification_status, tenant_contacts |

`*` marks a bound handler. Source: `RECONCILIATION.json` beside this file.
