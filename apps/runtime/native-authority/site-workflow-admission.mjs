/** Fixed Core read for the run's persisted selector. Credentials stay in control. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertSiteWorkflowSelection} from '../../../packages/contracts/site-workflow-selection.mjs';
import {validateShape,canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {markAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
const fault=code=>Object.assign(Error('SITE_WORKFLOW_CORE_'+code),{code:'SITE_WORKFLOW_CORE_'+code});
const refuse=code=>{throw fault(code);};
const TOKEN=/^[\x21-\x7e]{1,8192}$/u;
export const SITE_WORKFLOW_READ_ROUTE='/api/clio/site-workflows/runtime/read';
export function createCoreSiteWorkflowAdmission({origin,getServiceSecret,nativeCredentials,now=Date.now,fetchImpl=fetch,maxRequestMs=10000}={}){
 let base;try{const u=new URL(origin);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw 0;base=u.origin;}catch{refuse('CONFIGURATION');}
 if(typeof getServiceSecret!=='function'||typeof nativeCredentials?.nativeCredentialFor!=='function'||typeof now!=='function'||typeof fetchImpl!=='function'||
   !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse('CONFIGURATION');
 return Object.freeze({async resolve(raw){
  let life,response;
  try{
   const v=own(raw,['binding','selection','scopes'],['versions','signal','deadlineMs']);nativeSignal(v.signal);
   const binding=data(v.binding),selection=assertSiteWorkflowSelection(data(v.selection)),scopes=data(v.scopes);
   validateShape('RunBinding',binding);
   if(!Array.isArray(scopes)||!scopes.length||scopes.length>100)refuse('REQUEST');
   for(const scope of scopes){validateShape('Scope',scope);if(scope.tenantId!==binding.tenantId)refuse('REQUEST');}
   const clients=scopes.filter(s=>s.kind==='client');if(clients.length>1)refuse('REQUEST');
   const selectedClientId=clients[0]?.resourceId??null;
   if(selectedClientId===null&&!(scopes.length===1&&scopes[0].kind==='private-user'&&scopes[0].resourceId===binding.actorId))refuse('REQUEST');
   const bearer=()=>{
    const issued=data(own(nativeCredentials.nativeCredentialFor({binding,selectedClientId,signal:v.signal}),['credential','expiresAtMs']));
    if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())refuse('SESSION_UNAVAILABLE');
    return issued;
   };
   if(v.deadlineMs!==undefined&&(!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=now()))refuse('DEADLINE');
   life=createOperationLifetime({now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs??Infinity,now()+maxRequestMs),errorFactory:fault});
   const first=bearer();life.limitDeadline(first.expiresAtMs);
   const fresh=()=>{const current=bearer();if(current.credential!==first.credential)refuse('SESSION_UNAVAILABLE');life.limitDeadline(current.expiresAtMs);life.check();};
   const secret=await life.run(()=>getServiceSecret());
   if(typeof secret!=='string'||!TOKEN.test(secret)||secret===first.credential)refuse('UNAVAILABLE');
   fresh();
   response=await life.run(signal=>fetchImpl(base+SITE_WORKFLOW_READ_ROUTE,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},
    body:JSON.stringify({conversationId:binding.conversationId,selection})}));
   responseBody(response);
   if(response.status!==200)refuse([400,401,403,404,409].includes(response.status)?'REFUSED':'UNAVAILABLE');
   const answer=data(own(await readJsonResponse(response,{lifetime:life,maxResponseBytes:131072}),['manifest','manifestSha256','enabled']));
   const m=answer.manifest;
   if(answer.enabled!==true||!m||m.siteId!==selection.siteId||m.workflowId!==selection.workflowId||m.version!==selection.version||
     answer.manifestSha256!==selection.manifestSha256||canonicalSha256(m)!==selection.manifestSha256)refuse('REFUSED');
   fresh();return answer;
  }catch(error){
   if(error?.code?.startsWith('SITE_WORKFLOW_CORE_')){if(error.code==='SITE_WORKFLOW_CORE_UNAVAILABLE')markAuthorityUnavailable(error);throw error;}
   // Transport availability is not admission; keep refusals and malformed responses closed.
   throw fault(['ACCESS_DENIED','INVALID_RESULT','RESOURCE_LIMIT'].includes(error?.code)?'REFUSED':'UNAVAILABLE');
  }finally{try{if(response)cancelBody(responseBody(response));}catch{}life?.close();}
 }});
}
