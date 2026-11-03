import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('SEMANTIC_SEARCH_INVALID');};
/** One admitted input shape per family; the filters each family accepts mirror Core's parser exactly
 * (`apps/api/src/meri/semantic-search.ts` and its DIBBS/SBIR sibling), so a filter the family ignores is refused
 * here before any call. The two active-corpus reads share one stricter input (no status, congress, NAICS or
 * includeInactive) and carry the contract's own UTF-16 query bound, because a JSON Schema maxLength counts code
 * points while Core measures UTF-16 code units. */
const ACTIVE_FILTERS=Object.freeze(['agency','dateFrom','dateTo']);
export const SEMANTIC_SEARCH_FAMILIES=Object.freeze({
 semantic_search_bills:Object.freeze({reference:'congress_bill',filters:Object.freeze(['congress','status','dateFrom','dateTo'])}),
 semantic_search_grants:Object.freeze({reference:'federal_grant',filters:Object.freeze(['agency','status','dateFrom','dateTo'])}),
 semantic_search_contract_opportunities:Object.freeze({reference:'sam_opportunity',filters:Object.freeze(['agency','naics','includeInactive','dateFrom','dateTo'])}),
 semantic_search_dibbs_solicitations:Object.freeze({reference:'tango_dibbs_solicitation',filters:ACTIVE_FILTERS,
  input:'ActiveSemanticSearchInput',output:'SemanticDibbsOutput',binding:'archived_content_sha256',sourceTable:'opportunity_attachment',documents:true,utf16Query:true}),
 semantic_search_sbir_topics:Object.freeze({reference:'tango_sbir_topic',filters:ACTIVE_FILTERS,
  input:'ActiveSemanticSearchInput',output:'SemanticSbirTopicOutput',binding:'provider_topic_id',sourceTable:'tango_sbir_topic',documents:false,utf16Query:true}),
});
const GRANT_STATUSES=['posted','forecasted','closed','archived'];
const HASH=/^[0-9a-fA-F]{64}$/;
export function createSemanticSearchValidators({validateShape}){
 function normalizeInput(id,request,context={}){
  const family=SEMANTIC_SEARCH_FAMILIES[id];if(!family)fail();
  const input=snapshotOperationData(request),options=snapshotOperationData(context);
  if(!options||Object.keys(options).length)fail();validateShape(family.input??'SemanticSearchInput',input);
  const admitted=new Set(['query','limit',...family.filters]);
  if(Object.keys(input).some(key=>!admitted.has(key)))fail();
  const query=input.query.replace(/\s+/g,' ').trim();if(query.length<3)fail();
  // Core's measured bound is UTF-16 code units on the normalized query, not JSON Schema code points.
  if(family.utf16Query&&query.length>2000)fail();
  if(input.dateFrom&&input.dateTo&&input.dateTo<input.dateFrom)fail();
  if(id==='semantic_search_grants'&&input.status!==undefined&&!GRANT_STATUSES.includes(input.status.trim().toLowerCase()))fail();
  for(const key of ['status','agency'])if(typeof input[key]==='string'&&!input[key].trim())fail();
  return {input:{...input,query,limit:input.limit??10,...(id==='semantic_search_grants'&&input.status!==undefined?{status:input.status.trim().toLowerCase()}:{})}};
 }
 /** The active-corpus families publish one passage per canonical record and bind it to that record by canonical and
  * provider identity; the two hashes stay distinct (normalized text versus archived bytes), and the two families
  * differ exactly as Core's projection does (DIBBS archived local text with attachment coverage; SBIR provider
  * synopsis with null archive facts and no documents block). A requested close-date bound excludes a null date. */
 function assertActiveOutput(id,input,family,out){
  if(out.similarityFloor!==0.35||out.candidateLimit!==200)fail();
  if(out.coverage.indexedRecords>out.coverage.totalRecords)fail();
  const seen=new Set();
  for(let i=0;i<out.results.length;i++){
   const row=out.results[i],record=row.record,passage=row.passage;
   if(row.reference!==`${family.reference}:${record.id}`||seen.has(row.reference)||row.score<out.similarityFloor)fail();seen.add(row.reference);
   // Distinct raw scores can round to the same published score: only non-increasing published scores are asserted,
   // never a canonical-ID tie order.
   if(i&&out.results[i-1].score<row.score)fail();
   if(passage.sourceTable!==family.sourceTable||passage.binding!==family.binding)fail();
   if(passage.canonicalRecordId!==record.id||passage.providerRecordId!==record.providerId)fail();
   if(passage.end<passage.start)fail();
   // documentHash identifies the normalized full text; attachmentContentSha256 identifies archived bytes.
   if(passage.documentHash===passage.attachmentContentSha256)fail();
   if(family.documents){
    if(!HASH.test(passage.attachmentContentSha256??'')||passage.archivedAt===null||passage.extractionMethod!=='local_parser'||typeof passage.truncated!=='boolean')fail();
    const documents=row.documents;
    if(documents.attachments<1||documents.withText<1||documents.indexed<1)fail();
    if(['withText','truncated','indexed'].some(key=>documents[key]>documents.attachments))fail();
   }else if(passage.attachmentContentSha256!==null||passage.archivedAt!==null||passage.extractionMethod!==null||passage.truncated!==null)fail();
   // An inclusive close-date bound cannot be satisfied by an unknown date; a null date stays unknown.
   if(input.dateFrom!==undefined&&(record.closeDate===null||record.closeDate<input.dateFrom))fail();
   if(input.dateTo!==undefined&&(record.closeDate===null||record.closeDate>input.dateTo))fail();
  }
 }
 function assertOutput(id,value,request){
  const {input}=normalizeInput(id,request),family=SEMANTIC_SEARCH_FAMILIES[id],out=snapshotOperationData(value);validateShape(family.output??'SemanticSearchOutput',out);
  if(out.tool!==id||out.query!==input.query||out.total!==out.results.length||out.results.length>input.limit||!Number.isFinite(Date.parse(out.generatedAt)))fail();
  // Only indexed records are reachable: the page can never claim more indexed records than stored ones.
  if(out.coverage.indexedRecords>out.coverage.totalRecords)fail();
  if(family.binding)return assertActiveOutput(id,input,family,out),value;
  const seen=new Set();
  for(let i=0;i<out.results.length;i++){
   const row=out.results[i],record=row.record;
   if(row.reference!==`${family.reference}:${record.id}`||seen.has(row.reference)||row.score<out.similarityFloor)fail();seen.add(row.reference);
   if(i&&out.results[i-1].score<row.score)fail();
   // Passage citations and attachment coverage belong to the two funding reads; coverage never exceeds the attachments.
   if(id==='semantic_search_bills'&&(Object.hasOwn(row,'passage')||Object.hasOwn(row,'documents')))fail();
   if(row.documents&&['withText','truncated','indexed'].some(key=>row.documents[key]>row.documents.attachments))fail();
   if(id==='semantic_search_bills'&&(!Object.hasOwn(record,'billNumber')||input.congress!==undefined&&record.congress!==input.congress||input.status!==undefined&&record.status!==input.status))fail();
   if(id==='semantic_search_grants'&&(!Object.hasOwn(record,'opportunityNumber')||input.status!==undefined&&record.status!==input.status))fail();
   if(id==='semantic_search_contract_opportunities'&&(!Object.hasOwn(record,'noticeId')||!input.includeInactive&&record.active!==true||input.naics!==undefined&&!(record.naicsCode??'').startsWith(input.naics)))fail();
  }
  return value;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
