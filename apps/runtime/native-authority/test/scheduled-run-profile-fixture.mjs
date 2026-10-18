/** Actual schedule custody, original admission and same-work lifecycle; scripted SQL and policy, no sockets or services. */
import {scheduledJobFixture,id,hash} from '../../../control/schedules/test/scheduled-job-fixture.mjs';
import {createScheduledRunProfile} from '../scheduled-run-profile.mjs';
export {id,hash};
export async function scheduledRunProfileFixture({admit=true,allocated=true,occurrenceCap=2000,maxRuntimeSeconds=20,authorityWindowMs}={}){
 const h=await scheduledJobFixture({admit:false}),state={originReads:0,onRead:null};
 h.occurrence.projection.maxCostMicrousd=occurrenceCap;h.occurrence.projection.maxRuntimeSeconds=maxRuntimeSeconds;
 h.intent.projection=h.occurrence.projection;
 const projected=[...h.scheduleSql.state.projections.values()][0],intent=[...h.scheduleSql.state.intents.values()][0];
 projected.projection=structuredClone(h.intent.projection);projected.projection_sha256=hash(projected.projection);
 intent.intent=structuredClone(h.intent);intent.intent_sha256=hash(intent.intent);
 if(authorityWindowMs!==undefined)h.policy.expiresAtMs=h.now()+authorityWindowMs;
 if(admit){await h.adapter.admit(h.request);if(allocated)await h.claim();}
 const connect=h.scheduleSql.pool.connect;
 h.scheduleSql.pool.connect=async()=>{const client=await connect();return {...client,async query(sql,args){
  if(sql.startsWith('SELECT tenant_id,generation,occurrence_key')){
   state.originReads++;await state.onRead?.(state.originReads);
   return {rows:structuredClone([...h.scheduleSql.state.occurrences.values()].filter(r=>r.tenant_id===args[0]&&r.effect.binding.conversationId===args[1]).slice(0,2))};
  }return client.query(sql,args);
 }};};
 const configuration={scheduleOwner:h.scheduleOwner,store:h.store,task:h.template.task,selectedClientId:h.template.selectedClientId,
  allocationJson:h.template.allocationJson,maxCostMicroUSD:1500,now:h.now,maxRequestMs:1000};
 const call=binding=>({binding:binding??h.identity.binding,scopes:h.scopes,expiresAtMs:h.now()+60000,deadlineMs:h.now()+1000});
 return {...h,state,configuration,call,profile:createScheduledRunProfile(configuration),
  storedOrigin:()=>h.scheduleSql.state.occurrences.get(h.identity.binding.tenantId+':'+h.identity.occurrenceKey)};
}
