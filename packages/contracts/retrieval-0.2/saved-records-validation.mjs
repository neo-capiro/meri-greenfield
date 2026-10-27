/** Current-owner saved reads. Only the two explicit client filters support a client conversation. */
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('Invalid saved record contract');};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const equalId=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
export function savedRecordClientSelector(request){
 return request.source==='workspace'&&request.kind==='library'?request.input?.query?.clientId??null:
  request.source==='core'&&request.kind==='legiwatch_saved_items'?request.input?.clientId??null:null;
}
function scope(context){
 const s=context.savedRecordScope;
 if(!s||Object.keys(s).sort().join(',')!=='clientId,identityRevision,membershipRevision,tenantId'||
  typeof s.tenantId!=='string'||!uuid.test(s.tenantId)||s.clientId!==null&&(typeof s.clientId!=='string'||!uuid.test(s.clientId))||
  ![s.identityRevision,s.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))fail();
 return s;
}
export function createSavedRecordValidators({validateShape}){
 function normalizeInput(id,raw,context={}){
  if(id!=='read_saved_record')fail();const request=snapshotOperationData(raw);validateShape('SavedRecordStrictRequest',request);
  const s=scope(context),selector=savedRecordClientSelector(request);
  if(selector!==null&&(typeof selector!=='string'||!uuid.test(selector.toLowerCase())))fail();
  // A caller's ability to read another record is not permission to broaden a selected-client conversation.
  if(s.clientId!==null&&!equalId(selector,s.clientId))fail();
  return {input:request};
 }
 function assertOutput(id,raw,request,context={}){
  normalizeInput(id,request,context);const page=snapshotOperationData(raw);validateShape('SavedRecordOutput',page);
  if(page.kind!==request.kind||Buffer.byteLength(JSON.stringify(page),'utf8')>262144)fail();
  const input=request.input??{},d=page.data,s=scope(context),selector=savedRecordClientSelector(request);
  if(request.source==='core'){
   if(page.kind==='usage_events'&&d.some(row=>row.tenantId!==s.tenantId))fail();
   if(page.kind==='usage_events'&&d.length>(input.limit??100))fail();
   if(page.kind==='legiwatch_saved_items'){
    if(d.page!==(input.page??1)||d.pageSize!==(input.pageSize??25)||d.rows.length>d.pageSize)fail();
    if(selector&&d.rows.some(row=>!equalId(row.clientId,selector)))fail();
    if(input.hearingId&&d.rows.some(row=>row.hearingId!==input.hearingId))fail();
   }
  }else{
   if(['documents','versions','saved_version','outreach_revision'].includes(page.kind)&&!equalId(d.draftId,input.draftId))fail();
   if(['saved_version','outreach_revision'].includes(page.kind)&&!equalId(d.versionId,input.versionId))fail();
   if(page.kind==='comments'&&!equalId(d.documentId,input.documentId))fail();
   if(['newsletter','hill_day'].includes(page.kind)&&!equalId(d.id,input.documentId))fail();
   if(page.kind==='newsletter_stage'&&d!==null&&(!equalId(d.documentId,input.documentId)||d.revision!==input.revision))fail();
   if(page.kind==='library'&&selector&&d.items.some(row=>!equalId(row.clientId,selector)))fail();
  }
  return page;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
