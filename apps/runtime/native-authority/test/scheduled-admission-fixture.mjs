/** Pure SQL/Temporal protocol fixtures over canonical product owners; synthetic policy only. No pg, sockets or worker process. */
import {readFileSync} from 'node:fs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {initialInputFixture} from '../../../control/conversations/test/initial-input-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {versions,id} from '../../../control/conversations/test/store-fixture.mjs';
import {scheduleOwnerFixture} from '../../../control/schedules/test/schedule-owner-fixture.mjs';
import {createPostgresScheduleOwner} from '../../../control/schedules/postgres-schedule-owner.mjs';
import {createIntent,configuration,projection,ownerBinding,instruction,temporalFixture} from '../../../control/schedules/test/scheduled-dispatch-harness.mjs';
import {occurrenceIdentity} from '../../../control/schedules/scheduled-occurrence.mjs';
import {workflowId,createTemporalConversationDispatcher} from '../../../control/conversations/temporal-dispatch.mjs';
import {createTemporalRunEvidence} from '../../../control/conversations/temporal-run-evidence.mjs';
import {createScheduledNativeAdmission} from '../scheduled-admission.mjs';
export {versions,instruction};

export async function scheduledAdmissionFixture({nativeCandidate,clockMs}={}){
 const conversations=initialInputFixture(),bindings=new Map(),queries=[],releases=[],faults={onQuery:null,onCommit:null,onRelease:null,loseBindingCommit:false,loseAcceptanceCommit:false};
 if(clockMs!==undefined)conversations.advance(clockMs-conversations.now());
 const key=p=>p.slice(0,2).join(':'),copy=v=>structuredClone(v);
 const pool={async connect(){const client=await conversations.pool.connect();let backup,stage='read';return {async query(sql,p=[]){
  queries.push({sql,params:copy(p)});await faults.onQuery?.(sql,p);
  const rows=v=>({rows:copy(v),rowCount:v.length});
  if(sql==='BEGIN'||sql==='BEGIN ISOLATION LEVEL READ COMMITTED'){backup=copy(bindings);return client.query('BEGIN');}
  if(sql==='ROLLBACK'){bindings.clear();for(const [k,v]of backup)bindings.set(k,v);return client.query(sql,p);}
  if(sql==='COMMIT'){
   const result=await client.query(sql,p);await faults.onCommit?.(stage);
   const flag=stage==='binding'?'loseBindingCommit':stage==='accept'?'loseAcceptanceCommit':null;
   if(flag&&faults[flag]){faults[flag]=false;throw Error('synthetic committed write acknowledgement lost');}return result;
  }
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings'))return rows(bindings.has(key(p))?[bindings.get(key(p))]:[]);
  if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){
   stage='binding';if(bindings.has(key(p)))return rows([]);
   const row={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:copy(p[3]),record_sha256:p[4]};bindings.set(key(p),row);return rows([row]);
  }
  if(sql.startsWith('SELECT projection,projection_sha256 FROM meri_conversations.runs'))return rows([...conversations.state.runs.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).slice(0,1));
  if(sql.startsWith('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs'))return rows([...conversations.state.nextRuns.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]&&r.source_run_id===p[2]));
  if(sql.startsWith('SELECT 1 FROM meri_conversations.next_runs'))return rows([...conversations.state.nextRuns.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).slice(0,1));
  if(sql.startsWith('UPDATE meri_conversations.initial_inputs'))stage='accept';
  return client.query(sql,p);
 },release(reason){releases.push(reason);client.release(reason);faults.onRelease?.(stage);}};}};
 const now=conversations.now,store=createPostgresConversationStore({pool,now}),scheduleSql=scheduleOwnerFixture(),scheduleOwner=createPostgresScheduleOwner({pool:scheduleSql.pool});
 const nativeAllocation=nativeCandidate===undefined?null:JSON.parse(nativeCandidate.allocationJson);
 const manifest=nativeAllocation?.manifest??JSON.parse(readFileSync(new URL('../../../../packages/skills/originals/relationship_brief/1.0.0/manifest.json',import.meta.url)));
 const principal=nativeAllocation?{tenantId:nativeAllocation.run.tenantId,actorId:nativeAllocation.run.actorId}:{tenantId:'tenant-a',actorId:'actor-a'},selectedClientId=nativeCandidate?.identity.commandContext.clientResolution.clientId??id(5),policyRevision=nativeCandidate?.qualification.policyRevision??'policy1',scopes=[{...principal,kind:'client',resourceId:selectedClientId,policyRevision}].map(({actorId,...s})=>s);
 const allocation=nativeAllocation??{run:{...principal,conversationId:id(80),runId:id(81)},manifest,manifestSha256:hash(manifest),catalogSha256:'a'.repeat(64),budgets:manifest.budgets,
  schedule:{revision:'b'.repeat(64),expiresAt:new Date(now()+120000).toISOString(),operations:[{operation:manifest.allowedOperations[0],chargeMicrousd:10}]}};
 const task={taskId:id(9),manifestSha256:allocation.manifestSha256,version:1};
 const selectedVersions=nativeCandidate?.runtime.versions??versions;
 const template={principal,selectedClientId,policyRevision,versions:selectedVersions,task,configurationSha256:'c'.repeat(64),allocationJson:JSON.stringify(allocation),runWindowMs:60000,destinationId:'meri-inbox'};
 const intent={...createIntent(),projection:projection({owner:principal,scopes,maxCostMicrousd:manifest.budgets.maxCostMicroUSD,maxRuntimeSeconds:20,retryLimit:0,destinationId:template.destinationId,createdAt:new Date(now()-1000).toISOString()}),configuration:configuration({task,catchupWindowMs:60000})};
 const occurrence={workflowId:'synthetic-native-schedule-firing',temporalScheduleId:intent.projection.temporalScheduleId,scheduledAt:new Date(now()).toISOString(),projection:intent.projection,generation:1,task};
 const identity=occurrenceIdentity(occurrence),effect={binding:identity.binding,requestId:identity.requestId,eventId:identity.eventId,workflowId:workflowId(identity.binding)};
 const proposed=await conversations.proposal({input:{requestId:identity.requestId,prompt:instruction},context:{binding:identity.binding,scopes,versions:selectedVersions,selectedClientId}});
 const {selectedClientId:_,...input}=proposed.acceptance;input.event.eventId=identity.eventId;
 const request={occurrence,occurrenceKey:identity.occurrenceKey,effect,input};
 const policy={calls:[],onAuthorize:null,expiresAtMs:now()+120000};
 const authority={async authorize(q){policy.calls.push(q);if(policy.onAuthorize)return policy.onAuthorize(q);return {authorized:true,selectionSha256:q.selectionSha256,binding:q.selection.binding,scopes,
  selectedClientId,policyRevision,configurationSha256:template.configurationSha256,checkedAtMs:now(),expiresAtMs:policy.expiresAtMs};}};
 const options={pool,store,scheduleOwner,authority,template,now},adapter=createScheduledNativeAdmission(options);
 async function acknowledge(value=intent){const q=ownerBinding(value);await scheduleOwner.claim(q,()=>{});await scheduleOwner.markDispatching(q,()=>{});await scheduleOwner.commitKnown(q,()=>{});}
 await acknowledge();
 const temporal=temporalFixture(),dispatcher=createTemporalConversationDispatcher({client:temporal.client,taskQueue:'meri-conversations',lifecycle:true,now}),runs=createTemporalRunEvidence({client:temporal.client,now});
 const firingAuthority={async authorize(q){return {authorized:true,occurrenceKey:q.occurrenceKey,owner:principal,scopes,checkedAtMs:now(),expiresAtMs:now()+60000};}};
 return {pool,store,scheduleSql,scheduleOwner,conversations,bindings,queries,releases,faults,now,advance:conversations.advance,template,allocation,scopes,intent,occurrence,identity,effect,input,request,
  policy,authority,options,adapter,acknowledge,temporal,dispatcher,runs,firingAuthority};
}
