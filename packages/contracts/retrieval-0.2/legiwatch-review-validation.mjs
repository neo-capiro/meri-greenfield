/** Exact current selection and owner review projection. No credential or I/O. */
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('Invalid LegiWatch review contract');};
const fields={folders:[],suggestions:['folderId','jurisdiction','sessionKey','cursor'],rules:['folderId'],workflows:['folderId']};
const required={folders:[],suggestions:['folderId','jurisdiction','sessionKey'],rules:['folderId'],workflows:['folderId']};
const names={folders:'Folders',suggestions:'Suggestions',rules:'Rules',workflows:'Workflows'};
export function createLegiwatchReviewValidators({validateShape,canonicalSha256:hash}){
 function normalizeInput(raw,context={}){
  const input=snapshotOperationData(raw);validateShape('LegiwatchReviewRequest',input);
  if(Object.keys(input).some(k=>!['view','clientId',...fields[input.view]].includes(k))||required[input.view].some(k=>!Object.hasOwn(input,k)))fail();
  const scope=context.legiwatchReviewScope;
  if(!scope||Object.keys(scope).sort().join(',')!=='clientId,identityRevision,membershipRevision'||scope.clientId!==input.clientId||
   ![scope.identityRevision,scope.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))fail();
  return {input};
 }
 function assertOutput(raw,request,context={}){
  const {input}=normalizeInput(request,context),page=snapshotOperationData(raw);validateShape('LegiwatchReviewOutput',page);
  if(hash(page.selection)!==hash(input)||Buffer.byteLength(JSON.stringify(page),'utf8')>262144||
   page.coverage.ownerRowLimit!==({folders:null,suggestions:50,rules:201,workflows:100})[input.view])fail();
  validateShape(`LegiwatchReview${names[input.view]}Data`,page.data);
  const rows=input.view==='folders'?page.data.folders:page.data.rows;
  if(new Set(rows.map(r=>r.id)).size!==rows.length)fail();
  let previous=input.cursor??'';
  for(const row of rows){
   if(input.view==='folders'&&row.clientId!==input.clientId)fail();
   if(input.view==='suggestions'){
    if(row.folder_id!==input.folderId||row.payload.sourceScope.jurisdiction!==input.jurisdiction||row.payload.sourceScope.sessionKey!==input.sessionKey||row.id<=previous)fail();previous=row.id;
   }else if(input.view==='rules'&&!row.config.folderIds.includes(input.folderId))fail();
   else if(input.view==='workflows'&&!row.input.folderIds.includes(input.folderId))fail();
  }
  if(input.view==='suggestions'&&page.data.next!==null&&(rows.length!==50||page.data.next!==rows.at(-1)?.id))fail();
  return page;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
