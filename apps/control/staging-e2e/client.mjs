/** Staging probe ownership guard. Existing authenticated Fetch/session ports remain external. */
import {isIP} from 'node:net';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {receiveConversationRequest,receiveConversationResponse,conversationApplicationMetadata} from '../../../packages/contracts/dist/conversation-application.mjs';
import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload} from '../../../packages/contracts/dist/document-application.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
export function stagingTarget(raw){
 const c=data(own(raw,['baseUrl','sourceCommit','automation','manual']));own(c.automation,['tenantId','actorId','clientId','conversationIds']);own(c.manual,['clientId','conversationIds']);let url;try{url=new URL(c.baseUrl);}catch{fail('STAGING_CONFIGURATION');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||isIP(url.hostname)||!url.hostname.includes('.')||url.hostname==='localhost'||!(/^[a-f0-9]{40}$/u.test(c.sourceCommit)))fail('STAGING_CONFIGURATION');
 if(['tenantId','actorId'].some(k=>typeof c.automation[k]!=='string'||!c.automation[k])||!uuid(c.automation.clientId)||!uuid(c.manual.clientId)||c.automation.clientId===c.manual.clientId)fail('STAGING_DATA_OVERLAP');
 for(const part of [c.automation,c.manual])if(!Array.isArray(part.conversationIds)||!part.conversationIds.length||part.conversationIds.length>32||part.conversationIds.some(v=>!uuid(v))||new Set(part.conversationIds).size!==part.conversationIds.length)fail('STAGING_DATA_OVERLAP');
 if(c.automation.conversationIds.some(v=>c.manual.conversationIds.includes(v)))fail('STAGING_DATA_OVERLAP');return Object.freeze({...c,baseUrl:url.origin});
}
async function bytes(response,maximum,life){const reader=response.body?.getReader();if(!reader)fail('STAGING_RESPONSE_REFUSED');const chunks=[];let total=0;
 try{for(;;){const next=await life.run(()=>reader.read());if(next.done)break;if(!(next.value instanceof Uint8Array))fail('STAGING_RESPONSE_REFUSED');total+=next.value.byteLength;if(total>maximum)fail('STAGING_RESPONSE_LIMIT');chunks.push(next.value);}const result=new Uint8Array(total);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.byteLength;}return result;}
 finally{try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}
}
export function createStagingE2EClient({target:rawTarget,readCurrentContext,verifyCandidate,authenticatedFetch,now=Date.now,maxRequestMs=15000}){
 const target=stagingTarget(rawTarget);if([readCurrentContext,verifyCandidate,authenticatedFetch,now].some(v=>typeof v!=='function')||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('STAGING_CONFIGURATION');
 const contexts=new Set(target.automation.conversationIds),versions=new Map(),active=new Set();let closed=false;
 function ownedBinding(binding){validateShape('RunBinding',binding);if(binding.tenantId!==target.automation.tenantId||binding.actorId!==target.automation.actorId||!contexts.has(binding.conversationId)||target.manual.conversationIds.includes(binding.conversationId))fail('STAGING_MANUAL_DATA_REFUSED');}
 function ownedScopes(scopes){if(!Array.isArray(scopes)||!scopes.length||!scopes.some(s=>s.kind==='client'&&s.resourceId===target.automation.clientId))fail('STAGING_MANUAL_DATA_REFUSED');for(const scope of scopes){validateShape('Scope',scope);if(scope.tenantId!==target.automation.tenantId||scope.kind==='client'&&scope.resourceId!==target.automation.clientId)fail('STAGING_MANUAL_DATA_REFUSED');}}
 async function current(life){const started=now(),c=data(await life.run(signal=>readCurrentContext({signal})));own(c,['binding','scopes','selectedClientId','checkedAtMs','expiresAtMs']);ownedBinding(c.binding);ownedScopes(c.scopes);if(c.selectedClientId!==target.automation.clientId||!Number.isSafeInteger(c.checkedAtMs)||c.checkedAtMs<started||c.checkedAtMs>now()||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now())fail('STAGING_CONTEXT_REFUSED');life.limitDeadline(c.expiresAtMs);return c;}
 async function candidate(life){const p=data(await life.run(signal=>verifyCandidate({origin:target.baseUrl,signal})));own(p,['origin','sourceCommit','imageDigest']);if(p.origin!==target.baseUrl||p.sourceCommit!==target.sourceCommit||!/^sha256:[a-f0-9]{64}$/u.test(p.imageDigest??''))fail('STAGING_CANDIDATE_REFUSED');}
 async function request({family,route,input,signal}){
  if(closed)fail('STAGING_CLOSED');const life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal,errorFactory:code=>Object.assign(new Error(code),{code})});active.add(life);
  try{let admitted,path,receive,maximum;
   if(family==='conversation'&&['submit','history','cancel'].includes(route)){admitted=receiveConversationRequest(route,new TextEncoder().encode(JSON.stringify(data(input))));path=conversationApplicationMetadata.routes[route].path;receive=receiveConversationResponse;maximum=2097152;}
   else if(family==='document'&&['create','revise','inspect','download'].includes(route)){admitted=receiveDocumentRequest(route,new TextEncoder().encode(JSON.stringify(data(input))));path=`/api/documents/${route}`;receive=receiveDocumentResponse;maximum=16777216;}
   else fail('STAGING_ROUTE_REFUSED');
   await candidate(life);const before=await current(life);
   if(family==='document'&&['revise','inspect','download'].includes(route)&&!versions.has(admitted.baseVersionId??admitted.versionId))fail('STAGING_UNOWNED_VERSION');
   if(family==='document'&&['create','revise'].includes(route)&&versions.size>=64)fail('STAGING_VERSION_LIMIT');
   // No credential is generated or copied into configuration/logs. This supplied
   // Fetch port uses the already authorized staging session and same-origin path.
   const response=await life.run(signal=>authenticatedFetch(new Request(target.baseUrl+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(admitted),redirect:'error',cache:'no-store',signal})));
   if(response.redirected||response.url&&new URL(response.url).origin!==target.baseUrl)fail('STAGING_REDIRECT_REFUSED');
   const result=family==='document'&&route==='download'&&response.status===200
    ?await life.run(signal=>receiveDocumentDownload(response,versions.get(admitted.versionId),{maxBytes:maximum,timeoutMs:maxRequestMs,signal}))
    :await receive(route,response.status,await bytes(response,maximum,life),admitted);
   const after=await current(life);if(!same(before.binding,after.binding)||!same(before.scopes,after.scopes))fail('STAGING_CONTEXT_CHANGED');
   if(result.error)return result;
   if(family==='conversation'){const run=result.run;if(run){ownedBinding(run.binding);ownedScopes(run.scopes);}}
   else{ownedBinding(result.version.binding);ownedScopes(result.version.scopes);versions.set(result.version.versionId,result.version);}
   return result;
  }finally{life.close();active.delete(life);}
 }
 return Object.freeze({target,request,close(){closed=true;for(const life of active)life.close();versions.clear();},status:()=>({closed,ownedClientId:target.automation.clientId,manualClientId:target.manual.clientId,ownedVersions:versions.size,activeRequests:active.size,credentialsConfigured:false,resourcesProvisioned:false})});
}
