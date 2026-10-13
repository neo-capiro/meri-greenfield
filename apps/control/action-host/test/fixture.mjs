/** Synthetic trusted ports around actual accepted lookup/workflow/command owners. */
import {setup,id,NOW} from '../../action-followthrough/test/fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createActionHostApplication} from '../index.mjs';
export {id,NOW};
export async function fixture(){
 const t=await setup(),hooks={},state={revoked:false,revision:'one',serial:100,authCalls:0,currentCalls:0,reservations:0,issueCalls:0};
 const principal={sessionId:'opaque-session-id',...Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,t.f.binding[k]]))};
 const stamp=()=>({checkedAtMs:t.clock(),expiresAtMs:NOW+9000});
 const authenticateSession=async call=>{state.authCalls++;if(hooks.auth)await hooks.auth(call);if(state.revoked||call.credential!=='opaque-session')throw Error('PRIVATE_AUTH');return {principal,sessionRevision:state.revision,...stamp()};};
 const readCurrentState=async call=>{state.currentCalls++;let value={authenticationSha256:canonicalSha256(call.authentication),binding:structuredClone(t.f.binding),scopes:structuredClone(t.scopes),selectedClientId:t.clientId,...stamp()};if(hooks.current)value=await hooks.current(value,call);return value;};
 const receipt=call=>({authenticationSha256:canonicalSha256(call.authentication),binding:structuredClone(call.current.binding),...stamp()});
 const reserveLookup=async call=>{state.reservations++;const n=state.serial;state.serial+=10;let out={...receipt(call),lookupId:id(n),resultReference:id(n+1),requestId:id(n+2),deliveryJson:JSON.stringify({context:{binding:call.current.binding},producer:{namespace:'fixture',executionId:'lookup'},deliveryId:`lookup-${n}`}),slots:{started:{eventId:id(n+3),sequence:n},terminal:{eventId:id(n+4),sequence:n+1}}};if(hooks.reserve)out=await hooks.reserve(out,call);return out;};
 const issueLookupCredential=async call=>{state.issueCalls++;let out={...receipt(call),credential:t.issued.credential};if(hooks.issue)out=await hooks.issue(out,call);return out;};
 const issueExecution=async call=>{const p=call.proposal;let out={...receipt(call),execution:{...t.f.execution,proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey},credential:'synthetic'};if(hooks.execution)out=await hooks.execution(out,call);return out;};
 const config={services:{lookup:t.lookup,commandOptions:t.commandOptions,commandExecutor:t.commandOptions.executor},authenticateSession,readCurrentState,reserveLookup,issueLookupCredential,issueExecution,now:t.clock,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:131072}};
 const make=changes=>createActionHostApplication({...config,...changes}),app=make();
 const request=(route,body,signal)=>new Request(`http://local.invalid/api/action-followthrough/${route}`,{method:'POST',headers:{authorization:'Bearer opaque-session','content-type':'application/json'},body:JSON.stringify(body),signal});
 const send=async(route,body,application=app,signal)=>{const response=await application.handle(request(route,body,signal));return{status:response.status,value:await response.json()};};
 const approve=proposal=>{Object.assign(t.f.decision,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256});t.f.state.approvalRevoked=false;};
 return {t,hooks,state,principal,config,make,send,approve,request};
}
