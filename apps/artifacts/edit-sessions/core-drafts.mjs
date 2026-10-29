/** Fixed Core draft routes. Borrows the existing live native-session credential
 * on every call; no credential/session persistence, minting or retries. Core is
 * the authority for membership, conversation access and atomic draft custody. */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {OFFICE_DRAFT_ROUTES,OFFICE_DRAFT_JSON_BYTES,officeDraftRequest,officeDraftResponse} from './core-draft-wire.mjs';
const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
const hash=value=>createHash('sha256').update(value).digest('hex');
const failure=(code,outcome)=>Object.assign(Error(code),{code,outcome});
export function createCoreOfficeDraftClient(options){
 const c=own(options,['origin','nativeCredentials','getServiceSecret','reservedCredentials','now'],['fetchImpl','maxRequestMs']);
 let origin;try{if(typeof c.origin!=='string')throw Error();origin=new URL(c.origin);if(origin.protocol!=='https:'||origin.origin!==c.origin||origin.username||origin.password)throw Error();}catch{throw failure('OFFICE_DRAFT_CONFIGURATION','NOT_DISPATCHED');}
 const credentials=own(c.nativeCredentials,['nativeCredentialFor']),fetchImpl=c.fetchImpl??globalThis.fetch,maxRequestMs=c.maxRequestMs??10000;
 if(![credentials.nativeCredentialFor,c.getServiceSecret,c.reservedCredentials,c.now,fetchImpl].every(fn=>typeof fn==='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw failure('OFFICE_DRAFT_CONFIGURATION','NOT_DISPATCHED');
 async function call(route,value,selection){
  const request=officeDraftRequest(route,value),{signal,...fields}=own(selection,['binding','scopes','selectedClientId','deadlineMs'],['signal']);nativeSignal(signal);
  const selected=data(fields);assertNativeConversationScope(selected);
  if(request.conversationId!==selected.binding.conversationId||!Number.isSafeInteger(selected.deadlineMs))throw failure('OFFICE_DRAFT_SCOPE','NOT_DISPATCHED');
  const life=createOperationLifetime({now:c.now,signal,deadlineMs:Math.min(selected.deadlineMs,c.now()+maxRequestMs),errorFactory:code=>failure('OFFICE_DRAFT_'+code,'NOT_DISPATCHED')});
  const effect=route!=='read'&&!(route==='lock'&&request.operation==='get');let sent=false,acquired;
  try{
   const forbidden=await life.run(()=>c.reservedCredentials());
   if(!(forbidden instanceof Set)||[...forbidden].some(value=>typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value)))throw Error();
   const borrow=()=>{
    const issued=data(own(credentials.nativeCredentialFor({binding:selected.binding,selectedClientId:selected.selectedClientId,signal:life.signal}),['credential','expiresAtMs']));
    if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||forbidden.has(hash(issued.credential))||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=c.now())throw failure('OFFICE_DRAFT_ACCESS_DENIED','NOT_DISPATCHED');
    life.limitDeadline(issued.expiresAtMs);return issued;
   };
   const first=borrow(),secret=await life.run(()=>c.getServiceSecret());
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first.credential||forbidden.has(hash(secret)))throw failure('OFFICE_DRAFT_ACCESS_DENIED','NOT_DISPATCHED');
   if(borrow().credential!==first.credential)throw failure('OFFICE_DRAFT_ACCESS_DENIED','NOT_DISPATCHED');
   const body=JSON.stringify(request);if(Buffer.byteLength(body)>OFFICE_DRAFT_JSON_BYTES)throw failure('OFFICE_DRAFT_LIMIT','NOT_DISPATCHED');
   acquired=await life.run(async signal=>{
    sent=true;const response=await fetchImpl(origin.origin+'/api/clio/office-drafts/'+OFFICE_DRAFT_ROUTES[route],{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body});
    try{responseBody(response);life.check();return response;}catch(error){try{cancelBody(responseBody(response));}catch{}throw error;}
   });
   if(acquired.redirected)throw Error();
   if([400,401,403,404,409,410].includes(acquired.status)){
    const codes={400:'OFFICE_DRAFT_REFUSED',401:'OFFICE_DRAFT_ACCESS_DENIED',403:'OFFICE_DRAFT_ACCESS_DENIED',404:'OFFICE_DRAFT_UNAVAILABLE',409:'OFFICE_DRAFT_CONFLICT',410:'OFFICE_DRAFT_EXPIRED'};
    // Core rolls these refusals back before answering. Never reflect its body.
    throw failure(codes[acquired.status],'NOT_DISPATCHED');
   }
   const result=officeDraftResponse(route,await readJsonResponse(acquired,{lifetime:life,maxResponseBytes:route==='read'?OFFICE_DRAFT_JSON_BYTES:32768}),request);
   if(borrow().credential!==first.credential)throw failure('OFFICE_DRAFT_ACCESS_DENIED',effect?'UNKNOWN':'READ_UNAVAILABLE');
   life.check();return result;
  }catch(error){
   const definite=error?.outcome==='NOT_DISPATCHED'&&acquired&&[400,401,403,404,409,410].includes(acquired.status);
   const code=typeof error?.code==='string'&&/^OFFICE_DRAFT_[A-Z_]+$/u.test(error.code)?error.code:'OFFICE_DRAFT_UNAVAILABLE';
   throw failure(code,definite||!sent?'NOT_DISPATCHED':effect?'UNKNOWN':'READ_UNAVAILABLE');
  }finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life.close();}
 }
 return Object.freeze({call});
}
