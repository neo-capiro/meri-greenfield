/** Read-only native Core context join for an already member-owned saved conversation. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {ProductError,productFailure} from '../../control/product-access/errors.mjs';
import {isAuthorityUnavailable,markAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {currentTurnTelemetry} from '../telemetry/turn-context.mjs';
import {CURRENT_MAX_WAIT_MS} from './run-current-authority.mjs';

const unavailable=()=>{throw new ProductError('CONVERSATION_UNAVAILABLE');};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function createCoreConversationCurrentness(configuration){
 const c=own(configuration,['origin','fetchImpl','now','limits','selectedClientId']);
 const limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 if(typeof c.selectedClientId!=='string'||!uuid.test(c.selectedClientId))unavailable();
 const client=createCapiroApplicationAuthorityClient({origin:c.origin,fetchImpl:c.fetchImpl,now:c.now,enabled:true,limits:{maxRequestMs:limits.maxRequestMs,maxResponseBytes:limits.maxFactBytes}});
 const samePrincipal=(receipt,principal)=>receipt.principal.tenantId===principal.tenantId&&receipt.principal.actorId===principal.actorId;
 const fresh=(receipt,started)=>{const at=c.now();if(!Number.isSafeInteger(started)||!Number.isSafeInteger(at)||at<started||receipt.checkedAtMs<started||receipt.checkedAtMs>at||receipt.expiresAtMs<=at)unavailable();};
 return Object.freeze({async assertCurrent(value){
  try{
   const call=own(value,['credential','principal','conversationId','scopes','deadlineMs'],['signal']),principal=own(call.principal,['tenantId','actorId','clientIds'],['role','permissions','membershipRevision']);
   nativeSignal(call.signal);
   const scopes=data(call.scopes),clientIds=data(principal.clientIds);
   if(typeof call.credential!=='string'||!call.credential||!Number.isSafeInteger(call.deadlineMs)||typeof call.conversationId!=='string'||!uuid.test(call.conversationId)||!Array.isArray(scopes)||scopes.length<1||!Array.isArray(clientIds)||!clientIds.includes(c.selectedClientId))unavailable();
   for(const scope of scopes){validateShape('Scope',scope);if(scope.tenantId!==principal.tenantId||scope.kind==='client'&&!clientIds.includes(scope.resourceId))unavailable();}
   if(!scopes.some(scope=>scope.kind==='client'&&scope.resourceId===c.selectedClientId))unavailable();
   const started=c.now();if(!Number.isSafeInteger(started)||call.deadlineMs<=started)unavailable();
   const deadlineMs=Math.min(call.deadlineMs,started+limits.maxRequestMs);
   // History is not a run: never enter the O208 receipt cache or retain a positive across rows/requests.
   // Membership admission supplies this pin; no identity/context revision is invented from stored local policy scopes.
   const expect=principal.membershipRevision===undefined?undefined:{membershipRevision:principal.membershipRevision};
   currentTurnTelemetry()?.recordAuthority?.('fresh');
   const receipt=await client.readCurrent({credential:call.credential,conversationId:call.conversationId,clientId:c.selectedClientId,...(expect?{expect}:{}),signal:call.signal,deadlineMs:Math.min(deadlineMs,started+CURRENT_MAX_WAIT_MS)});
   fresh(receipt,started);
   if(!samePrincipal(receipt,principal)||receipt.conversationId!==call.conversationId||receipt.selectedClientId!==c.selectedClientId)unavailable();
   if(call.signal?.aborted||c.now()>=Math.min(deadlineMs,receipt.expiresAtMs))unavailable();
  }catch(cause){
   if(productFailure(cause))throw cause;
   // Preserve the frozen content-free history envelope; status/availability classify the adapter observation only.
   const error=Object.assign(new ProductError('CONVERSATION_UNAVAILABLE'),{status:[401,403,409].includes(cause?.status)?cause.status:503});
   throw isAuthorityUnavailable(cause)?markAuthorityUnavailable(error):error;
  }
 }});
}
