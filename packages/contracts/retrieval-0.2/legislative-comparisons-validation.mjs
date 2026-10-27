/** Exact owner comparison results; no arithmetic, diff algorithm or authority here. */
import {isDeepStrictEqual} from 'node:util';
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('Invalid legislative comparison contract');};
const kinds={compare_florida_budget_amounts:'Budget',compare_legislative_versions:'Version'};
export function createLegislativeComparisonValidators({validateShape}){
 function normalizeInput(id,raw,context={}){
  const prefix=kinds[id];if(!prefix)fail();
  const input=snapshotOperationData(raw);validateShape(`${prefix}ComparisonRequest`,input);
  input.clientId=input.clientId?.toLowerCase()??null;input.folderId??=null;
  if(prefix==='Budget'){input.jurisdiction??='FL';input.sessionKey??='';}
  else{input.allowCrossBill??=false;if(input.rightSessionKey!==undefined&&!input.allowCrossBill)fail();}
  const scope=context.legiwatchReviewScope;
  if(!scope||Object.keys(scope).sort().join(',')!=='clientId,identityRevision,membershipRevision'||scope.clientId!==input.clientId||
    ![scope.identityRevision,scope.membershipRevision].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v)))fail();
  return {input};
 }
 function assertOutput(id,raw,request,context={}){
  const {input}=normalizeInput(id,request,context),page=snapshotOperationData(raw),prefix=kinds[id];
  validateShape(`${prefix}ComparisonOutput`,page);
  if(Buffer.byteLength(JSON.stringify(page),'utf8')>262144||!isDeepStrictEqual(page.selection,input))fail();
  const d=page.data;
  if(d.left.id!==input.leftId||d.right.id!==input.rightId)fail();
  if(prefix==='Budget'){
   if(d.left.sourceRevision!==input.leftRevision||d.right.sourceRevision!==input.rightRevision||
     (d.comparable?d.deltaMinorUnits===null:d.deltaMinorUnits!==null||d.percentage!==null||!d.reasons.length))fail();
  }else{
   if(d.left.revision!==input.leftRevision||d.right.revision!==input.rightRevision||
    d.left.jurisdiction!==input.jurisdiction||d.right.jurisdiction!==input.jurisdiction||
    d.left.sessionKey!==input.sessionKey||d.right.sessionKey!==(input.rightSessionKey??input.sessionKey)||
    !input.allowCrossBill&&d.left.billId!==d.right.billId||d.scope.jurisdiction!==input.jurisdiction||
    d.scope.sessionKey!==input.sessionKey||d.scope.folderId!==input.folderId||input.clientId!==null&&d.scope.clientId!==input.clientId)fail();
   for(const line of d.changes){
    if((line.kind!=='added')!==(line.left!==null)||(line.kind!=='removed')!==(line.right!==null))fail();
    for(const range of [line.left,line.right])if(range&&(range.text!==line.text||range.end-range.start!==line.text.length))fail();
   }
  }
  return page;
 }
 return Object.freeze({normalizeInput,assertOutput});
}
