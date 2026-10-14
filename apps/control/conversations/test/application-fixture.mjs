import {createActionSessionOwner} from '../../action-host/session/owner.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createConversationService} from '../service.mjs';
import {createConversationApplication} from '../http.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {storeFixture,binding,scopes,versions,id} from './store-fixture.mjs';
export {binding,scopes,versions,id};
export async function applicationFixture({scopes:configuredScopes=scopes}={}){const f=storeFixture(),state=Object.assign(f.state,{revoked:false,context:structuredClone({binding,scopes:configuredScopes,selectedClientId:id(5)}),starts:0,cancels:0});let n=100;
 const sessions=createActionSessionOwner({mode:'process-local',limits:{maxSessions:20,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},verifyIdentity:async()=>{if(state.revoked)throw Error('denied');return {principal:{tenantId:state.context.binding.tenantId,actorId:state.context.binding.actorId},identityRevision:'identity1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};},resolveContext:async({identity})=>{if(state.checkCurrentBinding)await state.checkCurrentBinding(state.context.binding);return {identitySha256:canonicalSha256(identity),...state.context,contextRevision:'context1',checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000};}});
 const issued=await sessions.issue({identityCredential:'synthetic-native'}),credential=issued.credential,store=createPostgresConversationStore({pool:f.pool}),dispatcher={async start(){state.starts++;if(state.startUnknown)throw Error('ack lost');},async cancel(){state.cancels++;}},service=createConversationService({sessions,store,dispatcher,versions,newId:()=>id(n++)}),app=createConversationApplication({service});
 const input={requestId:id(6),prompt:'Hello'};
 const runOwner={load:({binding,signal})=>service.loadForExecution({credential,binding,signal}),append:({binding,event,signal})=>service.publish({credential,binding,event,signal})};
 return {...f,state,sessions,credential,store,dispatcher,service,app,input,runOwner,close:()=>sessions.close(),post:(route,body=input)=>app.handle(new Request(`https://meri.invalid/api/conversations/${route}`,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)}))};
}
