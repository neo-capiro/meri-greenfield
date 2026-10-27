/** Closed source-evidence selection and pending-suggestion receipt; no authority or I/O. */
import {hash as digest} from 'node:crypto';
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Object.assign(Error('Invalid LegiWatch relevance contract'),{code:'INVALID_RESULT'});};
const rawHash=value=>digest('sha256',JSON.stringify(value),'hex');
const keys=['explanation','documentId','start','end','quote'];
const semantic=input=>({scope:{jurisdiction:input.jurisdiction,sessionKey:input.sessionKey,fields:input.fields},folderId:input.folderId,billId:input.billId,
 explanation:input.explanation,documentId:input.documentId,start:input.start,end:input.end,quote:input.quote});
export function createRelevanceValidators({validateShape,canonicalSha256:hash}){
 function validEvidence(input){
  const count=keys.filter(k=>Object.hasOwn(input,k)).length;
  if(new Set(input.fields).size!==input.fields.length||count!==0&&(count!==keys.length||!input.explanation.trim()||input.end-input.start!==input.quote.length||input.quote.length>2000))fail();
  return input;
 }
 function saveInput(value){const input=snapshotOperationData(value);validateShape('RelevanceInput',input);return validEvidence(input);}
 function request(value){const input=snapshotOperationData(value);validateShape('RelevanceRequest',input);validEvidence(input);return input;}
 function normalizeInput(value,context={}){
  const input=snapshotOperationData(value);validateShape('RelevancePreviewInput',input);validEvidence(input);
  const scope=context.legiwatchReviewScope;
  if(!scope||Object.keys(scope).sort().join(',')!=='clientId,identityRevision,membershipRevision'||scope.clientId!==input.clientId||
   ![scope.identityRevision,scope.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))fail();return {input};
 }
 function assertOutput(value,raw,context={}){
  const {input}=normalizeInput(raw,context),page=snapshotOperationData(value);validateShape('RelevancePreviewOutput',page);
  if(hash(page.selection)!==hash(input)||Buffer.byteLength(JSON.stringify(page),'utf8')>262144)fail();
  const data=page.data;
  if(input.explanation===undefined){
   validateShape('RelevanceDiscovery',data);
   if(data.bill.id!==input.billId||data.bill.jurisdiction!==input.jurisdiction||data.bill.sessionKey!==input.sessionKey||new Set(data.documents.map(d=>d.id)).size!==data.documents.length||
    data.documents.some(d=>d.billId!==input.billId||!input.fields.includes(d.kind)||d.excerptOnly&&d.text?.length!==12000))fail();
  }else{
   validateShape('RelevanceVerified',data);const selected=semantic(input);
   if(hash(data.input)!==hash(selected)||hash(data.binding.input)!==hash(selected)||data.previewHash!==rawHash({input:selected,sourceFingerprint:data.binding.sourceFingerprint,folderVersion:data.binding.folderVersion}))fail();
  }
  return page;
 }
 function receipt(value,expected){
  request(expected);const page=snapshotOperationData(value);validateShape('RelevanceReceipt',page);
  if(hash(page.request)!==hash(expected)||page.payload.binding!==rawHash([expected.previewHash,expected.requestKey]))fail();return page;
 }
 return Object.freeze({normalizeInput,saveInput,request,assertOutput,receipt});
}
