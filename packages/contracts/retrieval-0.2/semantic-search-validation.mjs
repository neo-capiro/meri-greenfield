import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('SEMANTIC_SEARCH_INVALID');};
/** One admitted input shape for the three reads; the filters each family accepts mirror Core's parser exactly
 * (`apps/api/src/meri/semantic-search.ts`), so a filter the family ignores is refused here before any call. */
export const SEMANTIC_SEARCH_FAMILIES=Object.freeze({
 semantic_search_bills:Object.freeze({reference:'congress_bill',filters:Object.freeze(['congress','status','dateFrom','dateTo'])}),
 semantic_search_grants:Object.freeze({reference:'federal_grant',filters:Object.freeze(['agency','status','dateFrom','dateTo'])}),
 semantic_search_contract_opportunities:Object.freeze({reference:'sam_opportunity',filters:Object.freeze(['agency','naics','includeInactive','dateFrom','dateTo'])}),
});
const GRANT_STATUSES=['posted','forecasted','closed','archived'];
export function createSemanticSearchValidators({validateShape}){
 function normalizeInput(id,request,context={}){
  const family=SEMANTIC_SEARCH_FAMILIES[id];if(!family)fail();
  const input=snapshotOperationData(request),options=snapshotOperationData(context);
  if(!options||Object.keys(options).length)fail();validateShape('SemanticSearchInput',input);
  const admitted=new Set(['query','limit',...family.filters]);
  if(Object.keys(input).some(key=>!admitted.has(key)))fail();
  const query=input.query.replace(/\s+/g,' ').trim();if(query.length<3)fail();
  if(input.dateFrom&&input.dateTo&&input.dateTo<input.dateFrom)fail();
  if(id==='semantic_search_grants'&&input.status!==undefined&&!GRANT_STATUSES.includes(input.status.trim().toLowerCase()))fail();
  for(const key of ['status','agency'])if(typeof input[key]==='string'&&!input[key].trim())fail();
  return {input:{...input,query,limit:input.limit??10,...(id==='semantic_search_grants'&&input.status!==undefined?{status:input.status.trim().toLowerCase()}:{})}};
 }
 function assertOutput(id,value,request){
  const {input}=normalizeInput(id,request),family=SEMANTIC_SEARCH_FAMILIES[id],out=snapshotOperationData(value);validateShape('SemanticSearchOutput',out);
  if(out.tool!==id||out.query!==input.query||out.total!==out.results.length||out.results.length>input.limit||!Number.isFinite(Date.parse(out.generatedAt)))fail();
  // Only indexed records are reachable: the page can never claim more indexed records than stored ones.
  if(out.coverage.indexedRecords>out.coverage.totalRecords)fail();
  const seen=new Set();
  for(let i=0;i<out.results.length;i++){
   const row=out.results[i],record=row.record;
   if(row.reference!==`${family.reference}:${record.id}`||seen.has(row.reference)||row.score<out.similarityFloor)fail();seen.add(row.reference);
   if(i&&out.results[i-1].score<row.score)fail();
   if(id==='semantic_search_bills'&&(!Object.hasOwn(record,'billNumber')||input.congress!==undefined&&record.congress!==input.congress||input.status!==undefined&&record.status!==input.status))fail();
   if(id==='semantic_search_grants'&&(!Object.hasOwn(record,'opportunityNumber')||input.status!==undefined&&record.status!==input.status))fail();
   if(id==='semantic_search_contract_opportunities'&&(!Object.hasOwn(record,'noticeId')||!input.includeInactive&&record.active!==true||input.naics!==undefined&&!(record.naicsCode??'').startsWith(input.naics)))fail();
  }
  return value;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
