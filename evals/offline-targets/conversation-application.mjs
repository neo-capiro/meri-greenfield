/** Loopback conversation HTTP application over scripted identity/context owners.
 * Reuses the canonical session owner, PostgreSQL store adapter (scripted wire fixture), service and Fetch mount.
 * No Temporal, PostgreSQL server, model or network. A LOCAL_FIXTURE, never evidence of live policy or durability. */
import {createActionSessionOwner} from '../../apps/control/action-host/session/owner.mjs';
import {createPostgresConversationStore} from '../../apps/control/conversations/postgres-store.mjs';
import {createConversationService} from '../../apps/control/conversations/service.mjs';
import {createConversationApplication} from '../../apps/control/conversations/http.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {storeFixture,versions} from '../../apps/control/conversations/test/store-fixture.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const hex4=/^[0-9a-f]{4}$/u;
/** Deterministic synthetic UUID: a 4-hex owner tag plus an ordinal; never a real identifier. */
export function syntheticId(tag,ordinal){if(!hex4.test(tag)||!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>99999999)fail('SYNTHETIC_ID');return `${String(ordinal).padStart(8,'0')}-${tag}-4000-8000-000000000000`;}
/** One authenticated principal: a conversation-bound actor whose identity credential the scripted owner recognizes. */
export function syntheticPrincipal({tenantId,actorId,tag,ordinal=1,policyRevision='policy1'}){
 if(typeof tenantId!=='string'||!tenantId||typeof actorId!=='string'||!actorId)fail('SYNTHETIC_PRINCIPAL');
 const base=ordinal*10,binding={tenantId,actorId,conversationId:syntheticId(tag,base+1),runId:syntheticId(tag,base+2),attemptId:syntheticId(tag,base+3),workerId:syntheticId(tag,base+4),writerFence:1},selectedClientId=syntheticId(tag,base+5);
 return Object.freeze({identityCredential:`synthetic-identity:${tenantId}:${actorId}:${binding.conversationId}`,tenantId,actorId,binding,selectedClientId,
  scopes:[{tenantId,kind:'client',resourceId:selectedClientId,policyRevision}]});
}
export async function createScriptedConversationApplication({principals,now=Date.now,ttlMs=30000}){
 if(!Array.isArray(principals)||!principals.length||principals.length>500)fail('TARGET_PRINCIPALS');
 const byCredential=new Map(principals.map(p=>[p.identityCredential,p]));if(byCredential.size!==principals.length)fail('TARGET_PRINCIPALS');
 const fixture=storeFixture(),state={revoked:new Set(),starts:[],cancels:[]};
 const store=createPostgresConversationStore({pool:fixture.pool,now});
 const sessions=createActionSessionOwner({mode:'process-local',now,limits:{maxSessions:1000,maxRequestMs:3000,maxTtlMs:Math.min(ttlMs,300000),maxFactBytes:65536},
  async verifyIdentity({credential}){const p=byCredential.get(credential);if(!p||state.revoked.has(p.identityCredential))throw Error('scripted identity refused');
   return {principal:{tenantId:p.tenantId,actorId:p.actorId},identityRevision:'identity1',checkedAtMs:now(),expiresAtMs:now()+ttlMs};},
  async resolveContext({identityCredential,identity}){const p=byCredential.get(identityCredential);if(!p)throw Error('scripted context refused');
   return {identitySha256:canonicalSha256(identity),binding:structuredClone(p.binding),scopes:structuredClone(p.scopes),selectedClientId:p.selectedClientId,contextRevision:'context1',checkedAtMs:now(),expiresAtMs:now()+ttlMs};}});
 const dispatcher={async start({binding}){state.starts.push(binding.runId);},async cancel({binding}){state.cancels.push(binding.runId);}};
 let ordinal=0;const service=createConversationService({sessions,store,dispatcher,versions,now,newId:()=>syntheticId('ffff',ordinal++)});
 const app=createConversationApplication({service,now});
 const request=({route,credential,body,method='POST',headers={}})=>{const h={...headers};if(credential!==undefined)h.authorization=`Bearer ${credential}`;if(method==='POST')h['content-type']='application/json';
  return new Request(`https://meri.invalid/api/conversations/${route}`,{method,headers:h,...(method==='POST'?{body:JSON.stringify(body)}:{})});};
 return Object.freeze({app,service,store,sessions,state,storeState:fixture.state,request,
  async issue(p){if(byCredential.get(p.identityCredential)!==p)fail('TARGET_PRINCIPAL_UNKNOWN');return (await sessions.issue({identityCredential:p.identityCredential})).credential;},
  close(){sessions.close();}});
}
