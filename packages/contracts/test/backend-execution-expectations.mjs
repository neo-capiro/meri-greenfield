import {verticalOperationIds,expectedVerticalBoundary,expectedVerticalDescriptor,priorVerticalDescriptor} from './vertical-source-expectations.mjs';
// Exact declared expected deltas to immutable historical snapshots.
import assert from 'node:assert/strict';
// No field is ignored; old callbacks, hashes, outputs and behavior still compare.
export const addedOperations = Object.freeze(["search_client_knowledge", "query_knowledge_graph", "read_monday_client_boards", "read_chat_attachments", "search_memory", "get_client_context", "search_research_sources", "query_global_data", "search_legislative_research", "get_legal_reference", "actions.query", "search_legiwatch_news", "search_committee_hearings"]);
export const fullActionReference = Object.freeze({id:'actions.query',version:'0.2.0'});
const rawRequests = Object.freeze({"query_outreach": {"before": "OutreachQueryInput", "after": "OutreachQueryRequest"}, "search_program_elements": {"before": "ProgramElementSearchInput", "after": "ProgramElementSearchRequest"}, "get_program_element": {"before": "ProgramElementDetailInput", "after": "ProgramElementDetailRequest"}, "get_pe_budget_timeline": {"before": "ProgramElementTimelineInput", "after": "ProgramElementTimelineRequest"}, "search_public_web": {"before": "PublicWebSearchInput", "after": "PublicWebSearchRequest"}, "scrape_web_page": {"before": "PublicWebPageInput", "after": "PublicWebPageRequest"}, "search_sam_opportunities": {"before": "SamOpportunitiesInput", "after": "SamOpportunitiesRequest"}, "get_florida_budget_project": {"before": "FloridaBudgetInput", "after": "FloridaBudgetRequest"}, "get_state_bill_status": {"before": "StateBillStatusInput", "after": "StateBillStatusRequest"}, "search_state_floor_votes": {"before": "StateFloorVotesInput", "after": "StateFloorVotesRequest"}, "find_contacts": {"before": "TenantContactsInput", "after": "TenantContactsRequest"}, "resolve_entity": {"before": "EntityCandidatesInput", "after": "EntityCandidatesRequest"}, "search_tracked_bills": {"before": "TrackedBillsInput", "after": "TrackedBillsRequest"}, "get_committee_roster": {"before": "CommitteeRosterInput", "after": "CommitteeRosterRequest"}, "list_members": {"before": "MemberListInput", "after": "MemberListRequest"}, "get_pe_contractors": {"before": "PeContractorsInput", "after": "PeContractorsRequest"}, "get_pe_bills": {"before": "PeBillsInput", "after": "PeBillsRequest"}, "get_pe_report_language": {"before": "PeReportLanguageInput", "after": "PeReportLanguageRequest"}, "get_state_rule_status": {"before": "RuleStatusInput", "after": "RuleStatusRequest"}, "get_certification_status": {"before": "CertificationStatusInput", "after": "CertificationStatusRequest"}, "search_sec_filings": {"before": "DisclosuresSecInput", "after": "DisclosuresSecRequest"}, "search_fara_registrations": {"before": "DisclosuresFaraInput", "after": "DisclosuresFaraRequest"}, "search_lda_filings": {"before": "DisclosuresLdaInput", "after": "DisclosuresLdaRequest"}, "get_bill_status": {"before": "FederalBillStatusInput", "after": "FederalBillStatusRequest"}, "search_floor_votes": {"before": "FederalFloorVotesInput", "after": "FederalFloorVotesRequest"}, "search_state_bills": {"before": "StateBillSearchInput", "after": "StateBillSearchRequest"}, "get_state_legislator": {"before": "StateLegislatorInput", "after": "StateLegislatorRequest"}, "query_economic_data": {"before": "PublicEconomicInput", "after": "PublicEconomicRequest"}, "search_federal_grants": {"before": "PublicGrantInput", "after": "PublicGrantRequest"}, "search_federal_awards": {"before": "PublicAwardInput", "after": "PublicAwardRequest"}, "lookup_client_registry": {"before": "ClientRegistryInput", "after": "ClientRegistryRequest"}});
export function expectedExistingDescriptor(row) {
  let result=expectedVerticalDescriptor(row);
  if(rawRequests[row.operation.id]) {
    const change=rawRequests[row.operation.id], suffix='#/$defs/'+change.before;
    if(!result.inputSchema.id.endsWith(suffix)) throw Error('Unexpected historical input schema: '+row.operation.id);
    result={...result,inputSchema:{...result.inputSchema,id:result.inputSchema.id.slice(0,-suffix.length)+'#/$defs/'+change.after}};
  }
  if(row.operation.id==='query_action_items') result={...result,replacement:fullActionReference,limitations:[
    'Historical scoped-only contract; actions.query is the reviewed full native transport successor. This original partial validator remains unchanged.',
    'This scoped-only operation still refuses client-less listing; the successor declares tenant-only unscoped transport without establishing current access.',
    ...result.limitations.slice(2)]};
  return result;
}
// Only the declared changed fields are reversed; all other bytes remain hashed.
export function priorExistingDescriptor(row) {
  let result=priorVerticalDescriptor(row);
  if(rawRequests[row.operation.id]) {
    const change=rawRequests[row.operation.id],suffix='#/$defs/'+change.after;
    assert.ok(result.inputSchema.id.endsWith(suffix));
    result={...result,inputSchema:{...result.inputSchema,id:result.inputSchema.id.slice(0,-suffix.length)+'#/$defs/'+change.before}};
  }
  if(row.operation.id==='query_action_items') {
    const originalLimitations=["Partial native coverage only: the original query_action_items capability remains pending with no replacement mapping.", "Client-less legacy listing has no qualified authorization or result contract and is refused."];
    assert.deepEqual(row.replacement,fullActionReference);
    const expected=expectedExistingDescriptor({...row,replacement:null,limitations:[...originalLimitations,...row.limitations.slice(2)]});
    assert.deepEqual(row.limitations,expected.limitations);
    result={...result,replacement:null,limitations:[...originalLimitations,...result.limitations.slice(2)]};
  }
  return result;
}
export function expectedExistingBinding(row) {
  let result=row;
  if(rawRequests[row.id]) {
    const change=rawRequests[row.id];
    if(row.input!==change.before)throw Error('Unexpected historical binding input: '+row.id);
    result={...result,input:change.after};
  }
  if(row.id==='query_action_items')result={...result,supersededBy:'actions.query'};
  if(row.id==='list_global_datasets')result={...result,dispatchProfile:'dataset-metadata/1'};
  const passiveProfiles={read_monday_client_boards:'bound-projection/1',search_memory:'bound-projection/1',
    get_client_context:'bound-projection/1',find_contacts:'bound-projection/1',resolve_entity:'bound-projection/1',
    read_client_documents:'client-documents/1'};
  if(Object.hasOwn(passiveProfiles,row.id)) {
    assert.equal(Object.hasOwn(row,'dispatchProfile'),false,'Historical snapshot already has a dispatch profile');
    result={...result,dispatchProfile:passiveProfiles[row.id]};
  }
  return result;
}
export function expectedExistingOriginal(row) {
  row={...row,boundary:expectedVerticalBoundary(row.id,row.boundary)};
  if(verticalOperationIds.includes(row.id))return {...row,state:'mapped',replacement:{id:row.id,version:'0.2.0'}};
  if(row.id==='query_action_items')return {...row,state:'mapped',replacement:fullActionReference};
  if(addedOperations.includes(row.id))return {...row,state:'mapped',replacement:{id:row.id,version:'0.2.0'}};
  return row;
}
