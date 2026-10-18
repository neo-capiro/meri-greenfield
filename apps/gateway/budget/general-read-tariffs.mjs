/** P3 tariff schedule for the 76 registered general reads. GENERATED from the registered reads and the Core cost evidence
 * gathered at capiro-backend #84 @ 7dd72a0e (all read paths of meri-tools.service.ts, federal-market-meri-tools.service.ts and
 * the adapters they call). One unit is 1 µUSD, the floor the budget owner accepts (as get_client_context is charged today).
 *  - db / free-external / tenant-saas / quota: 1 µUSD (no per-call cost to Capiro beyond its own database).
 *  - embedding: 1 + 164 µUSD. Amazon Titan Text Embeddings V2 is priced $0.02 per million input tokens and takes at most
 *    8,192 tokens (AWS, "Get started with Amazon Titan Text Embeddings V2"), so one embedding costs at most 163.84 µUSD.
 *  - `assumptions`: the tariff holds only under that Core configuration (rerankDisabled: RETRIEVAL_RERANK_ENABLED false, the
 *    default; webSearchProviderDuckDuckGo: CLIO_WEB_SEARCH_PROVIDER duckduckgo, the default). The allocation composer excludes these
 *    operations unless the render asserts the assumption from a reviewed Core configuration.
 *  - chargeMicrousd null: external cost unknown and unbounded in source; the operation is never allocated. */
export const GENERAL_READ_TARIFF_ASSUMPTIONS=Object.freeze(['rerankDisabled','webSearchProviderDuckDuckGo']);
/** read_client_documents (Core #84 @ aabe0f17): one document, one section, at most one paid call per call.
 *  - text: listing, plain text, docx, xlsx, pptx and PDFs with a text layer are parsed locally: the 1 µUSD floor.
 *  - vision: only when the selected PDF page has no text layer. One page, the page ≤ 5 MiB (file ≤ 20 MiB), output ≤ 8,192
 *    tokens (8,000 requested; raised to 8,192 for gpt-6-astra), zero retries, 30 s. Model from OPENAI_MODEL (default
 *    gpt-6-astra). Priced from evidence of the model's input/output prices and an input-token bound for one page.
 *  - transcription: audio/video goes to whisper-1 with no duration, cost or cache bound in Core (only the 25 MiB upload
 *    limit). It is priced only once Core supplies a duration cap (evidence `maxAudioSeconds`); until then the document read
 *    is not allocated. That Core cap is required work, not a deferral.
 * The charge is 1 + max(vision, transcription), because Meri cannot tell from the operation which branch a call takes. */
export const GENERAL_READ_DOCUMENT_BOUNDS=Object.freeze({textChargeMicrousd:1,
 vision:Object.freeze({pages:1,maxPageBytes:5242880,maxFileBytes:20971520,maxOutputTokens:8192,retries:0,timeoutMs:30000}),
 transcription:Object.freeze({model:'whisper-1',maxUploadBytes:26214400,maxAudioSeconds:null})});
/** The exact Core setting each assumption asserts. An allocation may price an assumption-gated read only with evidence binding
 * this setting to the measured Core (source commit, image digest, configuration digest); see assertTariffAssumptionEvidence. */
export const GENERAL_READ_TARIFF_ASSUMPTION_KEYS=Object.freeze({
 rerankDisabled:Object.freeze({configKey:'RETRIEVAL_RERANK_ENABLED',configValue:'false'}),
 webSearchProviderDuckDuckGo:Object.freeze({configKey:'CLIO_WEB_SEARCH_PROVIDER',configValue:'duckduckgo'}),
});
export const GENERAL_READ_TARIFFS=Object.freeze({
 'actions.query@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_action_items: Capiro database only, no outbound paid call"}),
 'find_contacts@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/find_contacts: Capiro database only, no outbound paid call"}),
 'get_acquisition_person@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_acquisition_person: Capiro database only, no outbound paid call"}),
 'get_bill_status@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_bill_status: Capiro database only, no outbound paid call"}),
 'get_business_development_context@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_business_development_context: Capiro database only, no outbound paid call"}),
 'get_business_development_recent_changes@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_business_development_recent_changes: Capiro database only, no outbound paid call"}),
 'get_client_context@0.3.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_client_context: Capiro database only, no outbound paid call"}),
 'get_committee_roster@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_committee_roster: Capiro database only, no outbound paid call"}),
 'get_district_federal_market@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_district_federal_market: Capiro database only, no outbound paid call"}),
 'get_district_nexus_changes@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_district_nexus_changes: Capiro database only, no outbound paid call"}),
 'get_district_nexus_context@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_district_nexus_context: Capiro database only, no outbound paid call"}),
 'get_florida_budget_project@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Capiro intel-api SQL over internal HTTP (meri-tools.service.ts:2507-2533 → evidence.service.ts:247); other intel-api work on that request not traced"}),
 'get_funding_opportunity_requirements@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_funding_opportunity_requirements: Capiro database only, no outbound paid call"}),
 'get_funding_opportunity@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_funding_opportunity: Capiro database only, no outbound paid call"}),
 'get_opportunity_client_context@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_opportunity_client_context: Capiro database only, no outbound paid call"}),
 'get_opportunity_government_landscape@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_opportunity_government_landscape: Capiro database only, no outbound paid call"}),
 'get_pe_bills@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_pe_bills: Capiro database only, no outbound paid call"}),
 'get_pe_budget_timeline@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_pe_budget_timeline: Capiro database only, no outbound paid call"}),
 'get_pe_contractors@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_pe_contractors: Capiro database only, no outbound paid call"}),
 'get_pe_report_language@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_pe_report_language: Capiro database only, no outbound paid call"}),
 'get_program_element@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_program_element: Capiro database only, no outbound paid call"}),
 'get_representation@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_representation: Capiro database only, no outbound paid call"}),
 'get_research_evidence@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_research_evidence: Capiro database only, no outbound paid call"}),
 'get_research_portfolio_changes@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_research_portfolio_changes: Capiro database only, no outbound paid call"}),
 'get_research_portfolio@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_research_portfolio: Capiro database only, no outbound paid call"}),
 'get_state_bill_status@0.2.0':Object.freeze({chargeMicrousd:1,class:'free-external-quota',evidence:"LegiScan live lookup only when the bill is not stored, under monthly quotas (meri-state-bill-live.ts:29,116-156; LEGISCAN_* caps)"}),
 'get_state_legislator@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_state_legislator: Capiro database only, no outbound paid call"}),
 'list_global_datasets@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/list_global_datasets: Capiro database only, no outbound paid call"}),
 'list_members@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/list_members: Capiro database only, no outbound paid call"}),
 'lookup_client_registry@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/lookup_client_registry: Capiro database only, no outbound paid call"}),
 'mail.list_messages@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/list_emails: Capiro database only, no outbound paid call"}),
 'mail.read_thread@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/get_email_thread: Capiro database only, no outbound paid call"}),
 'mail.search_messages@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_emails: Capiro database only, no outbound paid call"}),
 'meeting.list_upcoming_meetings@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/list_upcoming_meetings: Capiro database only, no outbound paid call"}),
 'meeting.query_debriefs@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_debriefs: Capiro database only, no outbound paid call"}),
 'meeting.read_client_meetings@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/read_client_meetings: Capiro database only, no outbound paid call"}),
 'memory.list_own_proposals@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/list_memory_proposals: Capiro database only, no outbound paid call"}),
 'query_action_items@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_action_items: Capiro database only, no outbound paid call"}),
 'query_economic_data@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_economic_data: Capiro database only, no outbound paid call"}),
 'query_global_data@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_global_data: Capiro database only, no outbound paid call"}),
 'query_intelligence@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_intelligence: Capiro database only, no outbound paid call"}),
 'query_knowledge_graph@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_knowledge_graph: Capiro database only, no outbound paid call"}),
 'query_regulatory_dockets@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_regulatory_dockets: Capiro database only, no outbound paid call"}),
 'query_tasks@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/query_tasks: Capiro database only, no outbound paid call"}),
 'read_bill_text@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/read_bill_text: Capiro database only, no outbound paid call"}),
 'read_client_documents@0.2.0':Object.freeze({chargeMicrousd:null,class:'document-composite',evidence:"One call reads one document section and makes at most ONE paid call (Core #84 @ aabe0f17): listing and text/docx/xlsx/pptx/text-layer PDFs parse locally (engagement/attachment-content.service.ts:388-399); an image-only PDF page goes to OpenAI vision, bounded (engagement/attachment-pdf-vision.ts:60-91); audio/video goes to OpenAI whisper-1 with no duration bound (engagement/engagement.service.ts:7950-7967, 8893). Priced by composeGeneralReadAllocation only from documentPricing evidence; see GENERAL_READ_DOCUMENT_BOUNDS"}),
 'read_monday_client_boards@0.2.0':Object.freeze({chargeMicrousd:1,class:'tenant-saas',evidence:"monday.com managed MCP over the tenant's own OAuth connection; Capiro is not billed per call (monday-managed-mcp.adapter.ts:450)"}),
 'resolve_entity@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/resolve_entity: Capiro database only, no outbound paid call"}),
 'scrape_web_page@0.2.0':Object.freeze({chargeMicrousd:1,class:'free-external',evidence:"direct fetch of the target URL, no vendor (meri-tools.service.ts:6610 → hardenedWebTransport.ts:153/200); 5 MB HTML / 15 MB PDF caps"}),
 'search_acquisition_personnel@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_acquisition_personnel: Capiro database only, no outbound paid call"}),
 'search_capiro_data@0.2.0':Object.freeze({chargeMicrousd:165,class:'conditional-embedding',assumptions:Object.freeze(['rerankDisabled']),evidence:"Titan v2 embedding only for institutional_knowledge with semantic_recall (meri-data-search.helpers.ts:104 → institutional-knowledge-retrieval.adapter.ts:144/393); monday domain uses the tenant's own monday.com connection; NVIDIA rerank only if enabled"}),
 'search_cbo_cost_estimates@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_cbo_cost_estimates: Capiro database only, no outbound paid call"}),
 'search_client_knowledge@0.2.0':Object.freeze({chargeMicrousd:165,class:'embedding',evidence:"Bedrock amazon.titan-embed-text-v2:0 embeds the query on every client-scoped call (meri-tools.service.ts:2294 → embeddings/client-kb.service.ts:661 → titan-embedding.provider.ts:124)"}),
 'search_committee_hearings@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',assumptions:Object.freeze(['rerankDisabled']),evidence:"database read; NVIDIA rerank only with recordsView and RETRIEVAL_RERANK_ENABLED (published-hearing-records.ts:107)"}),
 'search_congress_bills@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_congress_bills: Capiro database only, no outbound paid call"}),
 'search_contract_vehicles@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_contract_vehicles: Capiro database only, no outbound paid call"}),
 'search_crs_reports@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_crs_reports: Capiro database only, no outbound paid call"}),
 'search_fara_registrations@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_fara_registrations: Capiro database only, no outbound paid call"}),
 'search_federal_awards@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_federal_awards: Capiro database only, no outbound paid call"}),
 'search_federal_contract_awards@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_federal_contract_awards: Capiro database only, no outbound paid call"}),
 'search_federal_grants@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_federal_grants: Capiro database only, no outbound paid call"}),
 'search_federal_subawards@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_federal_subawards: Capiro database only, no outbound paid call"}),
 'search_floor_votes@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_floor_votes: Capiro database only, no outbound paid call"}),
 'search_funding_opportunities@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_funding_opportunities: Capiro database only, no outbound paid call"}),
 'search_gao_reports@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_gao_reports: Capiro database only, no outbound paid call"}),
 'search_intel_articles@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_intel_articles: Capiro database only, no outbound paid call"}),
 'search_lda_filings@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_lda_filings: Capiro database only, no outbound paid call"}),
 'search_legislative_research@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Capiro intel-api SQL over internal HTTP (research.service.ts:251); other intel-api work on that request not traced"}),
 'search_memory@0.2.0':Object.freeze({chargeMicrousd:165,class:'embedding',assumptions:Object.freeze(['rerankDisabled']),evidence:"Bedrock Titan v2 embedding on every semantic search (meri-tools.service.ts:3431-3436 → institutional-knowledge-retrieval.adapter.ts:144); NVIDIA rerank only if RETRIEVAL_RERANK_ENABLED"}),
 'search_procurement_forecasts@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_procurement_forecasts: Capiro database only, no outbound paid call"}),
 'search_program_elements@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_program_elements: Capiro database only, no outbound paid call"}),
 'search_public_web@0.2.0':Object.freeze({chargeMicrousd:1,class:'conditional-paid-external',assumptions:Object.freeze(['webSearchProviderDuckDuckGo']),evidence:"CLIO_WEB_SEARCH_PROVIDER defaults to duckduckgo, a free HTML fetch (config.schema.ts:704, web-search.helpers.ts); Tavily/Serper when configured are paid and have no tariff here"}),
 'search_sec_filings@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_sec_filings: Capiro database only, no outbound paid call"}),
 'search_state_bills@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_state_bills: Capiro database only, no outbound paid call"}),
 'search_state_floor_votes@0.2.0':Object.freeze({chargeMicrousd:1,class:'free-external-quota',evidence:"same LegiScan fallback, only with billId (meri-tools.service.ts:5650 → :3706)"}),
 'search_tracked_bills@0.2.0':Object.freeze({chargeMicrousd:1,class:'db',evidence:"Core tools/search_tracked_bills: Capiro database only, no outbound paid call"}),
});
