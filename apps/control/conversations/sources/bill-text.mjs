/** Trusted native capture and exact current-page projection. No content cache or model authority. */
import {hash as digest} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertSourceShape} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {BILL_TEXT_SOURCE_SCHEMA,BILL_TEXT_SOURCE_EVENT} from '../../../../packages/contracts/conversation-sources/protocol.mjs';
import {safeSourceLocator} from '../../../../packages/contracts/conversation-sources/semantics.mjs';
import {nativeReadFault} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {ProductError} from '../../product-access/errors.mjs';
const operation=Object.freeze({id:'read_bill_text',version:'0.2.0'}),same=(a,b)=>hash(a)===hash(b);
const fields=['authoritativeOwner','billId','versionCode','revisionId','packageId','provider','lineageKey','versionHash','textHash'];
const contract=resolveOperationContract(operation);
export function billTextReferenceId(binding,deliveryId){const h=hash({schema:BILL_TEXT_SOURCE_SCHEMA,binding,deliveryId});return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
function pageOf(result){const c=result.coverage;return {...c.locator,totalCharacters:c.totalCharacters,textSha256:digest('sha256',result.text,'hex'),
 pageComplete:c.pageComplete,contentComplete:c.contentComplete,paginationComplete:c.paginationComplete,truncated:c.truncated};}
export function projectBillTextSource({request,response,scopes,defaultCongress}){
 if(!same(request.operation,operation))return null;
 const normalized=contract.normalizeInput(request.arguments,{defaultCongress});if(normalized.metadata.mode!=='sequential')return null;
 const envelope=data(own(JSON.parse(response.resultJson),['binding','subject','operation','argumentsSha256','result']));
 if(!same(envelope.binding,request.binding)||!same(envelope.operation,operation)||envelope.argumentsSha256!==normalized.argumentsSha256||
  !same(envelope.subject.scopes,scopes)||envelope.subject.tenantId!==request.binding.tenantId||envelope.subject.actorId!==request.binding.actorId||
  envelope.subject.policyRevision!==response.policyRevision||hash(envelope)!==response.resultSha256)throw nativeReadFault('INVALID_RESULT');
 contract.assertOutput(envelope.result,{request:request.arguments,defaultCongress});const result=envelope.result;
 if(!result.found||result.currentStatus!=='available')return null;
 const source=Object.fromEntries(fields.map(k=>[k,result[k]]));
 return assertSourceShape('NativeBillTextSource',{schemaVersion:BILL_TEXT_SOURCE_SCHEMA,deliveryId:request.deliveryId,operation,requestSha256:response.inputSha256,
  argumentsSha256:envelope.argumentsSha256,resultSha256:response.resultSha256,executionSha256:response.executionSha256,policyRevision:response.policyRevision,source,page:pageOf(result)});
}
export function createBillTextSourceCapture({store,defaultCongress}){
 if(typeof store?.appendSource!=='function')throw nativeReadFault('CONFIGURATION');
 return async function capture({request,response,scopes,signal,check,onPublicationStart}){
  const source=projectBillTextSource({request,response,scopes,defaultCongress});if(source===null)return;
  const verify=()=>{signal?.throwIfAborted();check();};verify();
  try{onPublicationStart?.();await store.appendSource(request.binding,{eventId:billTextReferenceId(request.binding,request.deliveryId),type:BILL_TEXT_SOURCE_EVENT,data:source},verify,scopes);verify();}
  catch(error){if(['STORE_COMMIT_UNKNOWN','STORE_RELEASE_UNKNOWN'].includes(error?.code))throw nativeReadFault('SOURCE_PUBLICATION_UNKNOWN');
   if(error?.code==='EVENT_REPLAY_REFUSED')throw nativeReadFault('SOURCE_PUBLICATION_CONFLICT');throw error;}
 };
}
/** The first page has no cursor; a positive offset uses Core's existing tuple, never an offset-zero token. */
export function savedBillTextRequest(event){const {source,page}=event.data;return {billId:source.billId,versionCode:source.versionCode,
 ...(page.offset===0?{}:{cursor:Buffer.from(JSON.stringify([source.billId,source.versionCode,source.revisionId,source.textHash,page.offset])).toString('base64url')})};}
export function releaseBillTextPage(event,raw){
 const result=data(raw),request=savedBillTextRequest(event);
 if(result?.currentStatus==='unavailable')throw new ProductError('SOURCE_REFERENCE_UNAVAILABLE');
 // A changed first-page identity is stale; validate against the fixed request before any public projection.
 if(fields.some(k=>result[k]!==event.data.source[k]))throw new ProductError('SOURCE_REFERENCE_STALE');
 try{contract.assertOutput(result,{request,defaultCongress:Number(event.data.source.billId.split('-')[0])});}
 catch{throw new ProductError('SOURCE_REFERENCE_UNAVAILABLE');}
 if(!same(pageOf(result),event.data.page))throw new ProductError('SOURCE_REFERENCE_STALE');
 const sourceLocator=safeSourceLocator(result.sourceLocator);
 return {text:result.text,sourceLocator,linkStatus:sourceLocator===null?'unsafe':'available',sourceModifiedAt:result.sourceModifiedAt,publishedAt:result.publishedAt,fetchedAt:result.fetchedAt,coverage:result.coverage};
}
