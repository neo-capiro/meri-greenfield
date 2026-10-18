# PR110 selected source-read status snapshot

Pinned source: [PR110](https://github.com/neo-capiro/meri-greenfield/pull/110), commit `f7f4ed5b397fcd44576251739ed361aee6941d7a`, tree `e5f752758583cc56a720c1b40093c1fb23a7372c`. This handoff records the immutable published source snapshot, rather than later PR state. Local equivalent `e3b393c702b5df33e337e79a5c1f7063b6cb3757` has the same tree.

Derived from committed [current source exposure](https://github.com/neo-capiro/meri-greenfield/blob/f7f4ed5b397fcd44576251739ed361aee6941d7a/docs/coordination/ledgers/scope-ledger.json), [SDK policy](https://github.com/neo-capiro/meri-greenfield/blob/f7f4ed5b397fcd44576251739ed361aee6941d7a/apps/worker/conversation/reads/families.mjs) and [canonical bindings](https://github.com/neo-capiro/meri-greenfield/blob/f7f4ed5b397fcd44576251739ed361aee6941d7a/packages/contracts/retrieval-0.2/catalog-validation.mjs). Historical top-level ledger counts are not used as current source status. Machine-readable sibling: [read-statuses.json](read-statuses.json).

**82 selected source reads = 58 complete + 13 partial + 11 absent.** The 24 incomplete reads span 15 families. All 43 exclusions remain outside selection and SDK registration. **SDK: 60 operations / 36 families**, comprising 58 selected source operations plus the two separate product/historical operations below. **Qualified/live: zero**; every record carries `qualified:false` and `live:false`.

Complete means full canonical source implementation with static SDK registration. Partial means a bounded branch or pending bridge leaves complete operation coverage and SDK exposure held. Absent means no canonical source adapter. Static SDK exposure requires current task/tenant/user authority, current installation and every existing availability gate before execution; it is not live availability. No implementation, source refresh, dependency change, tests or live calls were performed to prepare this handoff.

Research portfolio, portfolio changes and Florida budget project reads are all complete and SDK-exposed as source only. BD context/recent are complete; BD evidence is absent. Compatible legal citation paths remain partial. Funding five remain partial and SDK-held.

## All 82 selected source reads

| Family | Canonical operation | Source status | SDK exposed | Qualified / live |
| --- | --- | --- | --- | --- |
| `acquisition-personnel` | `get_acquisition_person` | complete | yes | false / false |
| `acquisition-personnel` | `search_acquisition_personnel` | complete | yes | false / false |
| `action-items-complete` | `actions.query` | complete | yes | false / false |
| `bill-text` | `read_bill_text` | complete | yes | false / false |
| `bill-text` | `search_congress_bills` | complete | yes | false / false |
| `business-development` | `get_business_development_context` | complete | yes | false / false |
| `business-development` | `get_business_development_evidence` | absent | no | false / false |
| `business-development` | `get_business_development_recent_changes` | complete | yes | false / false |
| `certification-status` | `get_certification_status` | absent | no | false / false |
| `client-documents` | `read_client_documents` | complete | yes | false / false |
| `client-knowledge-memory` | `search_memory` | complete | yes | false / false |
| `client-knowledge-monday` | `read_monday_client_boards` | complete | yes | false / false |
| `client-knowledge-profile` | `get_client_context` | complete | yes | false / false |
| `client-knowledge-search` | `query_knowledge_graph` | complete | yes | false / false |
| `client-knowledge-search` | `search_client_knowledge` | absent | no | false / false |
| `client-registry` | `lookup_client_registry` | complete | yes | false / false |
| `data-search` | `search_capiro_data` | complete | yes | false / false |
| `dataset-metadata` | `list_global_datasets` | complete | yes | false / false |
| `disclosures` | `search_fara_registrations` | complete | yes | false / false |
| `disclosures` | `search_lda_filings` | complete | yes | false / false |
| `disclosures` | `search_sec_filings` | complete | yes | false / false |
| `district-nexus` | `get_district_nexus_changes` | complete | yes | false / false |
| `district-nexus` | `get_district_nexus_context` | complete | yes | false / false |
| `entity-candidates` | `resolve_entity` | complete | yes | false / false |
| `facility-representation` | `get_representation` | complete | yes | false / false |
| `federal-legislation` | `get_bill_status` | complete | yes | false / false |
| `federal-legislation` | `search_floor_votes` | complete | yes | false / false |
| `federal-market` | `get_district_federal_market` | complete | yes | false / false |
| `federal-market` | `search_contract_vehicles` | complete | yes | false / false |
| `federal-market` | `search_federal_contract_awards` | complete | yes | false / false |
| `federal-market` | `search_federal_subawards` | complete | yes | false / false |
| `federal-market` | `search_procurement_forecasts` | complete | yes | false / false |
| `florida-budget` | `get_florida_budget_project` | complete | yes | false / false |
| `funding-opportunities` | `get_funding_opportunity` | partial | no | false / false |
| `funding-opportunities` | `get_funding_opportunity_requirements` | partial | no | false / false |
| `funding-opportunities` | `get_opportunity_client_context` | partial | no | false / false |
| `funding-opportunities` | `get_opportunity_government_landscape` | partial | no | false / false |
| `funding-opportunities` | `search_funding_opportunities` | partial | no | false / false |
| `intelligence-summary` | `query_intelligence` | complete | yes | false / false |
| `legislative-directory` | `get_committee_roster` | complete | yes | false / false |
| `legislative-directory` | `list_members` | complete | yes | false / false |
| `mail` | `mail.list_messages` | complete | yes | false / false |
| `mail` | `mail.read_thread` | complete | yes | false / false |
| `mail` | `mail.search_messages` | complete | yes | false / false |
| `meeting-source` | `meeting.list_upcoming_meetings` | complete | yes | false / false |
| `meeting-source` | `meeting.query_debriefs` | complete | yes | false / false |
| `meeting-source` | `meeting.read_client_meetings` | complete | yes | false / false |
| `operational-reads` | `query_tasks` | complete | yes | false / false |
| `outreach-query` | `query_outreach` | partial | no | false / false |
| `pe-references` | `get_pe_bills` | complete | yes | false / false |
| `pe-references` | `get_pe_contractors` | complete | yes | false / false |
| `pe-references` | `get_pe_report_language` | complete | yes | false / false |
| `program-elements` | `get_pe_budget_timeline` | absent | no | false / false |
| `program-elements` | `get_program_element` | absent | no | false / false |
| `program-elements` | `search_program_elements` | absent | no | false / false |
| `public-data` | `query_economic_data` | complete | yes | false / false |
| `public-data` | `search_federal_awards` | absent | no | false / false |
| `public-data` | `search_federal_grants` | absent | no | false / false |
| `public-domain-hearings` | `search_committee_hearings` | partial | no | false / false |
| `public-domain-query` | `query_global_data` | complete | yes | false / false |
| `public-reports` | `search_cbo_cost_estimates` | complete | yes | false / false |
| `public-reports` | `search_crs_reports` | complete | yes | false / false |
| `public-reports` | `search_gao_reports` | complete | yes | false / false |
| `public-web` | `scrape_web_page` | complete | yes | false / false |
| `public-web` | `search_public_web` | complete | yes | false / false |
| `regulatory-dockets` | `query_regulatory_dockets` | complete | yes | false / false |
| `research-legal-candidates` | `search_research_sources` | absent | no | false / false |
| `research-legal-legislation` | `get_legal_reference` | partial | no | false / false |
| `research-legal-legislation` | `search_legislative_research` | partial | no | false / false |
| `research-legal-news` | `search_legiwatch_news` | partial | no | false / false |
| `research-portfolio` | `get_research_portfolio` | complete | yes | false / false |
| `research-portfolio` | `get_research_portfolio_changes` | complete | yes | false / false |
| `research-portfolio-evidence` | `get_research_evidence` | complete | yes | false / false |
| `rule-status` | `get_state_rule_status` | absent | no | false / false |
| `sam-opportunities` | `search_sam_opportunities` | absent | no | false / false |
| `state-legislation` | `get_state_legislator` | complete | yes | false / false |
| `state-legislation` | `search_state_bills` | complete | yes | false / false |
| `state-status-votes` | `get_state_bill_status` | partial | no | false / false |
| `state-status-votes` | `search_state_floor_votes` | partial | no | false / false |
| `stored-intelligence` | `search_intel_articles` | complete | yes | false / false |
| `tenant-contacts` | `find_contacts` | complete | yes | false / false |
| `tracked-bills` | `search_tracked_bills` | partial | no | false / false |

## Family coverage

A family is complete only when all of its selected source reads are complete, absent only when all are absent, and otherwise partial. These aggregate family states do not change the operation counts above.

| Family | Aggregate status | Selected | Complete / partial / absent | SDK source operations |
| --- | --- | --- | --- | --- |
| `acquisition-personnel` | complete | 2 | 2 / 0 / 0 | 2 |
| `action-items-complete` | complete | 1 | 1 / 0 / 0 | 1 |
| `bill-text` | complete | 2 | 2 / 0 / 0 | 2 |
| `business-development` | partial | 3 | 2 / 0 / 1 | 2 |
| `certification-status` | absent | 1 | 0 / 0 / 1 | 0 |
| `client-documents` | complete | 1 | 1 / 0 / 0 | 1 |
| `client-knowledge-memory` | complete | 1 | 1 / 0 / 0 | 1 |
| `client-knowledge-monday` | complete | 1 | 1 / 0 / 0 | 1 |
| `client-knowledge-profile` | complete | 1 | 1 / 0 / 0 | 1 |
| `client-knowledge-search` | partial | 2 | 1 / 0 / 1 | 1 |
| `client-registry` | complete | 1 | 1 / 0 / 0 | 1 |
| `data-search` | complete | 1 | 1 / 0 / 0 | 1 |
| `dataset-metadata` | complete | 1 | 1 / 0 / 0 | 1 |
| `disclosures` | complete | 3 | 3 / 0 / 0 | 3 |
| `district-nexus` | complete | 2 | 2 / 0 / 0 | 2 |
| `entity-candidates` | complete | 1 | 1 / 0 / 0 | 1 |
| `facility-representation` | complete | 1 | 1 / 0 / 0 | 1 |
| `federal-legislation` | complete | 2 | 2 / 0 / 0 | 2 |
| `federal-market` | complete | 5 | 5 / 0 / 0 | 5 |
| `florida-budget` | complete | 1 | 1 / 0 / 0 | 1 |
| `funding-opportunities` | partial | 5 | 0 / 5 / 0 | 0 |
| `intelligence-summary` | complete | 1 | 1 / 0 / 0 | 1 |
| `legislative-directory` | complete | 2 | 2 / 0 / 0 | 2 |
| `mail` | complete | 3 | 3 / 0 / 0 | 3 |
| `meeting-source` | complete | 3 | 3 / 0 / 0 | 3 |
| `operational-reads` | complete | 1 | 1 / 0 / 0 | 1 |
| `outreach-query` | partial | 1 | 0 / 1 / 0 | 0 |
| `pe-references` | complete | 3 | 3 / 0 / 0 | 3 |
| `program-elements` | absent | 3 | 0 / 0 / 3 | 0 |
| `public-data` | partial | 3 | 1 / 0 / 2 | 1 |
| `public-domain-hearings` | partial | 1 | 0 / 1 / 0 | 0 |
| `public-domain-query` | complete | 1 | 1 / 0 / 0 | 1 |
| `public-reports` | complete | 3 | 3 / 0 / 0 | 3 |
| `public-web` | complete | 2 | 2 / 0 / 0 | 2 |
| `regulatory-dockets` | complete | 1 | 1 / 0 / 0 | 1 |
| `research-legal-candidates` | absent | 1 | 0 / 0 / 1 | 0 |
| `research-legal-legislation` | partial | 2 | 0 / 2 / 0 | 0 |
| `research-legal-news` | partial | 1 | 0 / 1 / 0 | 0 |
| `research-portfolio` | complete | 2 | 2 / 0 / 0 | 2 |
| `research-portfolio-evidence` | complete | 1 | 1 / 0 / 0 | 1 |
| `rule-status` | absent | 1 | 0 / 0 / 1 | 0 |
| `sam-opportunities` | absent | 1 | 0 / 0 / 1 | 0 |
| `state-legislation` | complete | 2 | 2 / 0 / 0 | 2 |
| `state-status-votes` | partial | 2 | 0 / 2 / 0 | 0 |
| `stored-intelligence` | complete | 1 | 1 / 0 / 0 | 1 |
| `tenant-contacts` | complete | 1 | 1 / 0 / 0 | 1 |
| `tracked-bills` | partial | 1 | 0 / 1 / 0 | 0 |

## SDK extras outside the 82 source-operation count

| SDK operation | Family | Classification | Relationship |
| --- | --- | --- | --- |
| `memory.list_own_proposals` | `memory-proposals` | product-state-read | Separate product-state read; not a selected source read |
| `query_action_items` | `operational-reads` | historical-contract-alias | Historical alias of `actions.query`; one selected source capability |

## All 60 SDK operation IDs by 36 families

| SDK family | Exact registered operation IDs |
| --- | --- |
| `acquisition-personnel` | `get_acquisition_person`, `search_acquisition_personnel` |
| `action-items-complete` | `actions.query` |
| `bill-text` | `read_bill_text`, `search_congress_bills` |
| `business-development` | `get_business_development_context`, `get_business_development_recent_changes` |
| `client-documents` | `read_client_documents` |
| `client-knowledge-memory` | `search_memory` |
| `client-knowledge-monday` | `read_monday_client_boards` |
| `client-knowledge-profile` | `get_client_context` |
| `client-knowledge-search` | `query_knowledge_graph` |
| `client-registry` | `lookup_client_registry` |
| `data-search` | `search_capiro_data` |
| `dataset-metadata` | `list_global_datasets` |
| `disclosures` | `search_fara_registrations`, `search_lda_filings`, `search_sec_filings` |
| `district-nexus` | `get_district_nexus_changes`, `get_district_nexus_context` |
| `entity-candidates` | `resolve_entity` |
| `facility-representation` | `get_representation` |
| `federal-legislation` | `get_bill_status`, `search_floor_votes` |
| `federal-market` | `get_district_federal_market`, `search_contract_vehicles`, `search_federal_contract_awards`, `search_federal_subawards`, `search_procurement_forecasts` |
| `florida-budget` | `get_florida_budget_project` |
| `intelligence-summary` | `query_intelligence` |
| `legislative-directory` | `get_committee_roster`, `list_members` |
| `mail` | `mail.list_messages`, `mail.read_thread`, `mail.search_messages` |
| `meeting-source` | `meeting.list_upcoming_meetings`, `meeting.query_debriefs`, `meeting.read_client_meetings` |
| `memory-proposals` | `memory.list_own_proposals` |
| `operational-reads` | `query_action_items`, `query_tasks` |
| `pe-references` | `get_pe_bills`, `get_pe_contractors`, `get_pe_report_language` |
| `public-data` | `query_economic_data` |
| `public-domain-query` | `query_global_data` |
| `public-reports` | `search_cbo_cost_estimates`, `search_crs_reports`, `search_gao_reports` |
| `public-web` | `scrape_web_page`, `search_public_web` |
| `regulatory-dockets` | `query_regulatory_dockets` |
| `research-portfolio` | `get_research_portfolio`, `get_research_portfolio_changes` |
| `research-portfolio-evidence` | `get_research_evidence` |
| `state-legislation` | `get_state_legislator`, `search_state_bills` |
| `stored-intelligence` | `search_intel_articles` |
| `tenant-contacts` | `find_contacts` |

## Derivation and reproducibility

Committed ledger SHA256: `31a5764bc3dcee4b60b44ff3ac9d655ec6f3fba01e4c076b127d8008dacb6c53`; Git blob `578393ac55f660707d9cb8ad85cfc81ef5632a5f`. Committed SDK policy SHA256: `64fed993299072d2c72679e535aba2208dff71e04301b87ac04777feaab137bc`; Git blob `e711d251f089b78a3cc46434be95b1b03ba2a856`. The source ledger and SDK policy blobs were read back through the GitHub connector at the immutable PR110 commit and matched committed local-equivalent objects. The JSON retains all input paths, hashes, exact states, SDK subsets and all 43 excluded capability IDs.

Use Node 24 from a clean checkout of the pinned commit (or the identical local-equivalent tree). The following POSIX-shell command performs read-only derivation and assertions; on PowerShell pass the same JavaScript through a literal here-string to `node --input-type=module`. It writes no files and invokes no test runner. No absolute workspace path is required.

```sh
node --preserve-symlinks --max-old-space-size=256 --input-type=module <<'NODE'
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {READ_FAMILIES} from './apps/worker/conversation/reads/families.mjs';
import {CATALOG_OPERATION_BINDINGS} from './packages/contracts/retrieval-0.2/catalog-validation.mjs';
const committed=execFileSync('git',['show','HEAD:docs/coordination/ledgers/scope-ledger.json'],{maxBuffer:2097152});
assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),'e5f752758583cc56a720c1b40093c1fb23a7372c');
assert.equal(createHash('sha256').update(committed).digest('hex'),'31a5764bc3dcee4b60b44ff3ac9d655ec6f3fba01e4c076b127d8008dacb6c53');
const e=JSON.parse(committed).sourceExposure,rows=e.rows.filter(r=>r.kind==='source-read');
const reg=Object.entries(READ_FAMILIES).map(([family,p])=>({family,operations:(Object.hasOwn(p,'operationIds')?[...p.operationIds]:CATALOG_OPERATION_BINDINGS.filter(x=>x.group===family).map(x=>x.id)).sort()})).sort((a,b)=>a.family.localeCompare(b.family));
assert.deepEqual(reg,e.generalRegistration);
const sdk=reg.flatMap(x=>x.operations),gaps=rows.filter(r=>r.state!=='adapter-present');
assert.deepEqual([rows.length,...['adapter-present','adapter-partial','adapter-missing'].map(s=>rows.filter(r=>r.state===s).length),gaps.length,new Set(gaps.map(r=>r.family)).size,sdk.length,reg.length,e.counts.excludedCapabilities,e.counts.live],[82,58,13,11,24,15,60,36,43,0]);
const source=new Set(rows.map(r=>r.operation));assert.deepEqual(sdk.filter(id=>!source.has(id)).sort(),['memory.list_own_proposals','query_action_items']);
for(const id of ['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'])assert.ok(rows.some(r=>r.operation===id&&r.state==='adapter-present'&&r.generalOperations.includes(id)));
console.log(JSON.stringify({counts:e.counts,reads:rows.map(r=>({operation:r.operation,family:r.family,status:({'adapter-present':'complete','adapter-partial':'partial','adapter-missing':'absent'})[r.state],sdkExposed:sdk.includes(r.operation),qualified:false,live:false}))},null,2));
NODE
```

Safe-stop boundary: this is portable source accounting. It does not allocate remaining implementation, change source/contracts/ledger, qualify Core/server/native credentials, alter shipping acceptance or authorize deployment.
