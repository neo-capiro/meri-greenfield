/** SYNTHETIC: conversation resume and fork END TO END through the real owners: the lifecycle service/journal and conversation store
 * (scripted SQL protocol fixture), the real action-session owner over the REAL prepared-candidate identity context (the application
 * context adapter's `resolveTransitionContext`; Core application-authority routes scripted), the production continuation authority
 * (derived admission, retirement over a scripted native stop, fork claim through the real initial-run-binding journal) and the real
 * prepared-run registry serving each successor over the same store. Task issuance is the registry suite's inert synthetic issuer.
 * No PostgreSQL, Temporal, ECS task, live Core, key material or credential provisioning. */
import test from 'node:test';import assert from 'node:assert/strict';
import {normalize,resolve} from 'node:path';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {applicationAuthorityRoutes} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {lifecycleFixture,binding,id,versions,allocateOriginal,recordRetired} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {createInitialRunBindingJournal} from '../../../control/conversations/initial-run-binding-journal.mjs';
import {createConversationService} from '../../../control/conversations/service.mjs';
import {createConversationLifecycleService} from '../../../control/conversations/lifecycle/service.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createContinuationAuthority,derivedUuid} from '../../native-authority/continuation-authority.mjs';
import {capabilityDigest} from '../../native-authority/task-verifier.mjs';
import {createPreparedCandidateIdentity} from '../../prepared-candidate.mjs';
import {createPreparedNextRunOwner} from '../../prepared-next-run.mjs';
import {createPreparedRunRegistry} from '../../prepared-run-registry.mjs';
import {compilePreparedRunFacts} from '../../prepared-run-issuance.mjs';
import {compilePreparedRunConfigurationSha256} from '../../prepared-run-configuration.mjs';
import {candidateFixture} from '../../test/prepared-candidate-fixture.mjs';
const check=()=>{},NATIVE='synthetic-native',TOKEN='synthetic-target-task-token',UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const status=(n,state)=>({eventId:id(n),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}});
/** The scripted pool extended with the 0017 initial-run-binding relation and the journal's narrow reads of runs/next_runs, sharing the
 * fixture's serialized connection and rollback. No DB engine. */
function withInitialRunBindings(f){
 const bindings=new Map(),key=p=>p.slice(0,2).join(':'),copy=v=>structuredClone(v);
 return {async connect(){const c=await f.pool.connect();let backup;return {async query(sql,p=[]){
  if(sql==='BEGIN ISOLATION LEVEL READ COMMITTED'){backup=copy(bindings);return c.query('BEGIN',p);}
  if(sql==='ROLLBACK'){bindings.clear();for(const [k,v] of backup??[])bindings.set(k,v);return c.query(sql,p);}
  let rows;
  if(sql.startsWith('SELECT * FROM meri_conversations.initial_run_bindings')){const r=bindings.get(key(p));rows=r?[r]:[];}
  else if(sql.startsWith('INSERT INTO meri_conversations.initial_run_bindings')){if(bindings.has(key(p)))rows=[];else{const r={tenant_id:p[0],conversation_id:p[1],run_id:p[2],record:copy(p[3]),record_sha256:p[4]};bindings.set(key(p),r);rows=[r];}}
  else if(sql.startsWith('SELECT projection,projection_sha256 FROM meri_conversations.runs'))rows=[...f.state.runs.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).sort((a,b)=>a.sequence_base-b.sequence_base).slice(0,1).map(r=>({projection:r.projection,projection_sha256:r.projection_sha256}));
  else if(sql.startsWith('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs'))rows=[...f.state.nextRuns.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]&&r.source_run_id===p[2]).map(r=>({reservation:r.reservation,reservation_sha256:r.reservation_sha256}));
  else if(sql.startsWith('SELECT 1 FROM meri_conversations.next_runs'))rows=[...f.state.nextRuns.values()].filter(r=>r.tenant_id===p[0]&&r.conversation_id===p[1]).slice(0,1).map(()=>({present:1}));
  else return c.query(sql,p);
  return {rows:copy(rows),rowCount:rows.length};
 },release:reason=>c.release(reason)};}};
}
/** The registry suite's inert synthetic issuer, retargeted to any successor binding: facts compiled from the candidate configuration
 * for exactly the intent's binding and expiry; no capability generation, material or allocation. */
function syntheticIssuance(fx){
 const c=fx.configuration.nativeCandidate,issued=new Map(),facts=new Map(),stats={prepare:[],sources:[]};
 const factsFor=intent=>{const allocation=JSON.parse(c.allocationJson);allocation.run=Object.fromEntries(Object.keys(allocation.run).map(k=>[k,intent.binding[k]]));
  return {runtime:{...c.runtime,binding:intent.binding,deadlineMs:intent.expiresAtMs,proxyCredential:fx.secret.proxy},plan:c.plan,preparationIntent:{...c.preparationIntent,workspace:c.preparationIntent.workspace.slice(0,-binding.conversationId.length)+intent.binding.conversationId},allocationJson:JSON.stringify(allocation),qualification:c.qualification,grantIntents:[{grantId:id(600),capabilitySha256:capabilityDigest(TOKEN),expiresAtMs:intent.expiresAtMs}],grantId:id(600),operations:c.operations,taskRequest:c.taskRequest,containerName:c.containerName,controlCapabilitySha256:capabilityDigest(fx.secret.control),transport:{origin:c.taskOrigin,http:c.taskHttp}};};
 const issuance={async prepare({source,signal:_signal,...intent}){stats.prepare.push(intent.binding);stats.sources.push(source??null);const key=hash(intent.binding);if(issued.has(key))return issued.get(key);
   const compiledFacts=factsFor(intent),base={...intent,issuanceKey:key,grantId:id(600),capabilitySha256:capabilityDigest(TOKEN)},compiled=compilePreparedRunFacts(compiledFacts,{intent,issuance:base,now:Date.now});
   facts.set(key,compiledFacts);const entry={issuance:{...base,factsSha256:compiled.factsSha256},...compiled};issued.set(key,entry);return entry;},
  async resolveFacts(receipt){return facts.get(receipt.issuanceKey);},async resolveCapability(){return TOKEN;}};
 return {issuance,stats};
}
/** The production composition shape of assembleControl: store with the continuation authority, the session owner over the real
 * candidate identity context and the journal's transition reader, basic + lifecycle services, the registry over the same store. */
async function composition({retire}={}){
 const fx=candidateFixture(),c=fx.configuration.nativeCandidate;
 for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[k]=normalize(c.preparationIntent[k]);c.preparationIntent.launchTemplate.command=normalize(c.preparationIntent.launchTemplate.command);c.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=c.preparationIntent.secureStorageDirectory;
 c.multiRun={runWindowMs:60000,materialDirectory:resolve('synthetic-meri-material'),dynamicInitialRuns:true};
 const POLICY=c.qualification.policyRevision,scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:POLICY}],principal={tenantId:binding.tenantId,actorId:binding.actorId};
 const f=await lifecycleFixture({scopes}),base=createPostgresConversationStore({pool:f.pool}),journal=createInitialRunBindingJournal({pool:withInitialRunBindings(f),now:Date.now});
 const configurationSha256=compilePreparedRunConfigurationSha256(fx.configuration),scheduleExpiresAtMs=Date.parse(JSON.parse(c.allocationJson).schedule.expiresAt),proposeInitialExpiry=()=>Math.min(Date.now()+c.multiRun.runWindowMs,scheduleExpiresAtMs);
 const stops=[],calls={starts:[],continued:[]},state={stopMode:'record'};let n=700,allocation=null;
 const authority=createContinuationAuthority({store:base,stop:async({binding:b})=>{stops.push(b);if(state.stopMode==='record')await recordRetired(base,allocation);},selectedClientId:id(5),policyRevision:POLICY,versions,now:Date.now,fork:{initialBindings:journal,configurationSha256,proposeInitialExpiry}});
 const store=createPostgresConversationStore({pool:f.pool,transitionAuthority:authority.transitionAuthority});
 const nextRunOwner=createPreparedNextRunOwner({store:base,versions,admissionForBinding:async()=>{throw Error('no revocation in this suite');}});
 const core={requests:[]};
 const coreFetch=async(url,options)=>{const path=new URL(url).pathname,body=JSON.parse(options.body);core.requests.push({path,body});if(new Headers(options.headers).get('authorization')!=='Bearer '+NATIVE)return Response.json({error:'PRIVATE_NATIVE'},{status:401});const at=Date.now();
  return Response.json(path===applicationAuthorityRoutes.identity?{principal,identityRevision:'identity1',checkedAtMs:at,expiresAtMs:at+30000}:{identitySha256:body.identitySha256,principal,identityRevision:'identity1',conversationId:body.conversationId,selectedClientId:body.clientId,contextRevision:'context1',checkedAtMs:at,expiresAtMs:at+30000});};
 const identityContext=createPreparedCandidateIdentity({store:base,identity:{origin:c.identity.origin,commandContext:c.identity.commandContext,fetchImpl:coreFetch},qualification:c.qualification,now:Date.now,limits:{maxRequestMs:3000,maxFactBytes:65536},nextRunOwner,initialBindings:journal,configurationSha256,versions:c.runtime.versions,proposeInitialExpiry,factWindowMs:c.multiRun.runWindowMs});
 const sessions=createActionSessionOwner({mode:'process-local',limits:{maxSessions:20,maxRequestMs:3000,maxTtlMs:30000,maxFactBytes:65536},verifyIdentity:identityContext.verifyIdentity,resolveContext:identityContext.resolveContext,
  readTransition:({signal,...input})=>store.lifecycle.readTransition({...input,signal},()=>signal?.throwIfAborted()),resolveTransitionContext:identityContext.resolveTransitionContext});
 const session=async hints=>(await sessions.issue({identityCredential:NATIVE,...(hints?{hints:{...hints,clientId:id(5)}}:{})})).credential,credential=await session();
 const dispatcher={async start(v){calls.starts.push(v.binding);},async cancel(){},async continued(v){calls.continued.push(v.input);},async signal(){}};
 const basic=createConversationService({sessions,store,dispatcher,versions,newId:()=>id(n++)});
 const nativeAdmission={admit:v=>authority.continuationAdmission.admit(v),retire:retire??(v=>authority.continuationAdmission.retire(v))};
 const service=createConversationLifecycleService({service:basic,store,dispatcher,checkpoints:f.checkpoints,nativeAdmission,approvals:f.approvals,sessions,newId:()=>id(n++)});
 const {issuance,stats}=syntheticIssuance(fx);
 const prepareInitial=async({binding:b})=>{const record=await journal.read({binding:b},check),saved=await base.readOptional(b,{},check);if(!record||!saved)throw Error('not an admitted dynamic original');return issuance.prepare({binding:b,requestSha256:hash(saved.request),expiresAtMs:record.expiresAtMs});};
 const registry=createPreparedRunRegistry({issuance,issuanceIntent:async()=>({expiresAtMs:c.runtime.deadlineMs}),store:base,pool:{connect(){assert.fail('No database');}},client:{send(){assert.fail('No AWS');}},identity:{origin:c.identity.origin,credential:fx.secret.identity,commandContext:c.identity.commandContext,fetchImpl(){assert.fail('No authority network');}},controlCapability:fx.secret.control,objects:{},limits:{maxRequestMs:1000,maxFactBytes:131072,cleanupMs:1000},now:Date.now,allocate(){assert.fail('No physical allocation in this suite');},initialBindings:journal,prepareInitial,retireInitial(){assert.fail('No initial retirement in this suite');},configurationSha256});
 const control=input=>service.control({credential,input});
 async function paused(){
  await basic.allocateInput({credential,input:f.input});await basic.submit({credential,input:f.input});allocation=await allocateOriginal(base,binding);
  for(const s of ['starting','running'])await basic.publish({credential,binding,event:status(n++,s)});
  const P=id(750);await control({controlId:P,intent:'pause'});
  const page=await service.nextControls({credential,binding}),pending=page.controls.find(p=>p.command.controlId===P);
  await service.claimControl({credential,binding,input:{controlId:P,commandSha256:pending.commandSha256}});
  const proof=await f.capture(id(220));await service.recordCheckpoint({credential,binding,input:{controlId:P,checkpointId:id(220),checkpointSha256:proof.checkpointSha256}});
  return proof;
 }
 const continuation=(intent,controlId,proof)=>control({controlId,intent,checkpointId:proof.checkpoint.checkpointId,checkpointSha256:proof.checkpointSha256});
 const row=b=>[...f.state.runs.values()].find(r=>r.run_id===b.runId),projection=controlId=>f.state.controls.get(`${binding.tenantId}:${controlId}`)?.projection;
 return {f,base,store,journal,registry,issuance:stats,sessions,credential,core,stops,state,calls,service,basic,POLICY,scopes,paused,session,row,projection,
  resume:(controlId,proof)=>continuation('resume',controlId,proof),fork:(controlId,proof)=>continuation('fork',controlId,proof),
  async close(){await registry.close();sessions.close();f.close();}};
}
test('fork: admitted in a new conversation through the dynamic owner, verified by the real transition context, served by the registry over the initial-run binding journal',async t=>{
 const c=await composition();t.after(c.close);const proof=await c.paused();
 const F=id(760),receipt=await c.fork(F,proof),t2=receipt.targetBinding;
 assert.equal(receipt.state,'APPLIED');assert.equal(receipt.intent,'fork');assert.deepEqual(receipt.sourceBinding,binding);assert.equal(receipt.retirementReceiptId,null);
 assert.notEqual(t2.conversationId,binding.conversationId);assert.match(t2.conversationId,UUID);assert.equal(t2.writerFence,1);for(const k of ['runId','attemptId','workerId'])assert.notEqual(t2[k],binding[k]);
 assert.deepEqual(c.stops,[],'a fork never stops the source');assert.deepEqual(c.calls.starts,[binding,t2],'the original submit, then exactly the fork target');assert.equal(c.calls.continued.length,0);
 // The real context adapter admitted the transition: every Core context read for the target named the NEW conversation.
 const contexts=c.core.requests.filter(r=>r.path===applicationAuthorityRoutes.context&&r.body.conversationId===t2.conversationId);assert.ok(contexts.length>=2,'preflight and native context reads of the fork conversation');
 // The initial-run binding journal holds the fork's ADMITTED record; the source stays paused with its range open; no next-run mapping.
 const claimed=await c.journal.read({binding:t2},check);assert.equal(claimed.state,'ADMITTED');assert.deepEqual(claimed.binding,t2);assert.equal(claimed.selectedClientId,id(5));
 const source=c.row(binding);assert.equal(source.projection.state,'paused');assert.equal(source.sequence_end,null);assert.equal(c.f.state.nextRuns.size,0);assert.equal(c.row(t2).sequence_base,0);
 // Served by the real registry as the admitted writer-fence-1 run of its conversation, with exactly the admission's expiry.
 const entry=await c.registry.ensure({binding:t2});assert.deepEqual(entry.original.binding,t2);assert.equal(entry.original.expiresAtMs,claimed.expiresAtMs);assert.deepEqual(c.issuance.prepare,[t2]);assert.deepEqual(c.issuance.sources,[null]);
 // The worker's fresh session on the fork target loads the fork envelope for exactly the source checkpoint; no next-turn lineage.
 const credential=await c.session({conversationId:t2.conversationId,runId:t2.runId}),loaded=await c.service.loadForExecution({credential,binding:t2});
 assert.deepEqual(loaded.run.binding,t2);assert.equal(loaded.continuation.mode,'fork');assert.equal(loaded.continuation.checkpointSha256,proof.checkpointSha256);assert.deepEqual(loaded.continuation.checkpoint.binding,binding);assert.equal(loaded.nextTurn,undefined);
 // Replay of the same control through the still-current source session is effect-free: same target, no second claim, start or issuance.
 const replay=await c.fork(F,proof);assert.equal(replay.replayed,true);assert.deepEqual(replay.targetBinding,t2);
 assert.equal(c.calls.starts.length,2);assert.equal(c.f.state.runs.size,2);assert.deepEqual(await c.journal.read({binding:t2},check),claimed);assert.equal(await c.registry.ensure({binding:t2}),entry);assert.equal(c.issuance.prepare.length,1);
});
test('resume: the retired source stays paused with its range closed, the successor is born with an ACCEPTED next-run mapping and the registry serves it',async t=>{
 const c=await composition();t.after(c.close);const proof=await c.paused();
 const R=id(770),receipt=await c.resume(R,proof),t2=receipt.targetBinding;
 assert.equal(receipt.state,'APPLIED');assert.equal(receipt.intent,'resume');assert.equal(t2.conversationId,binding.conversationId);assert.equal(t2.writerFence,2);assert.match(receipt.retirementReceiptId,UUID);
 assert.deepEqual(c.stops,[binding]);assert.deepEqual(c.calls.starts,[binding,t2]);assert.equal(c.calls.continued.length,1);
 // The state a retired, resumed source lands in: still paused (never terminal), its range closed by the successor, its allocation RETIRED.
 const source=c.row(binding);assert.equal(source.projection.state,'paused');assert.equal(source.hold_control_id,id(750));assert.equal(source.sequence_end,Number(source.sequence_base)+Number(source.last_sequence));assert.equal(c.row(t2).sequence_base,source.sequence_end);
 const allocation=await c.base.allocations.read({binding,allocationKey:hash(binding)},check);assert.equal(allocation.record.state,'RETIRED');assert.equal(allocation.record.resource.physicalStopProven,true);
 // The mapping the registry serves: ACCEPTED, source to target, the retirement and revocation facts of the RETIRED record, no completion checkpoint.
 assert.equal(c.f.state.nextRuns.size,1);const mapping=await c.base.nextRuns.readTarget(t2,check);
 assert.equal(mapping.state,'ACCEPTED');assert.deepEqual(mapping.source,binding);assert.deepEqual(mapping.target,t2);assert.deepEqual(mapping.scopes,c.scopes);assert.equal(mapping.policyRevision,c.POLICY);assert.deepEqual(mapping.versions,versions);
 assert.deepEqual(mapping.facts,{checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256:hash(allocation.record),grantIds:[id(240)]}});
 assert.deepEqual(await c.base.nextRuns.current(t2,check),{binding:t2,reserved:false,policyRevision:c.POLICY,scopes:c.scopes});
 assert.equal(await c.base.nextRuns.execution({binding:t2,scopes:c.scopes,selectedClientId:id(5)},check),null,'no next-turn lineage: the lifecycle envelope carries the checkpoint');
 assert.deepEqual((await c.base.nextRuns.listRuns({tenantId:binding.tenantId,conversationId:binding.conversationId},check)).reservations,[],'a continuation is not a new prompt');
 // Served by the real registry, which hands issuance exactly the retired source's original and grants.
 const entry=await c.registry.ensure({binding:t2});assert.deepEqual(entry.original.binding,t2);assert.deepEqual(c.issuance.prepare,[t2]);assert.deepEqual(c.issuance.sources,[{original:allocation.record.original,grantIntents:allocation.record.grantIntents}]);
 // The worker's fresh session on the target loads the resumed envelope, unambiguous against the next-turn lineage.
 const credential=await c.session({conversationId:binding.conversationId,runId:t2.runId}),loaded=await c.service.loadForExecution({credential,binding:t2});
 assert.deepEqual(loaded.run.binding,t2);assert.equal(loaded.continuation.mode,'resume');assert.equal(loaded.continuation.checkpointSha256,proof.checkpointSha256);assert.equal(loaded.nextTurn,undefined);
 // The source session is historical now: a replay of the control through it is refused by current authority and performs no effect.
 await assert.rejects(c.resume(R,proof),/SESSION_REFUSED/);
 assert.deepEqual(c.stops,[binding]);assert.equal(c.calls.starts.length,2);assert.equal(c.calls.continued.length,1);assert.equal(c.f.state.runs.size,2);assert.equal(c.f.state.nextRuns.size,1);assert.equal(c.projection(R).state,'APPLIED');assert.equal(await c.registry.ensure({binding:t2}),entry);assert.equal(c.issuance.prepare.length,1);
});
test('a source that still holds authority is never succeeded: an unproven stop refuses before any write, a retirement receipt without the RETIRED record is refused inside the successor transaction',async t=>{
 const silent=await composition();t.after(silent.close);const proof=await silent.paused();silent.state.stopMode='silent';
 await assert.rejects(silent.resume(id(780),proof),/LIFECYCLE_EFFECT_UNKNOWN/);
 assert.equal(silent.stops.length,1);assert.equal(silent.projection(id(780)).state,'UNKNOWN');assert.equal(silent.projection(id(780)).target,null);
 assert.equal(silent.f.state.runs.size,1);assert.equal(silent.f.state.nextRuns.size,0);assert.equal(silent.row(binding).sequence_end,null);assert.equal(silent.calls.starts.length,1);
 assert.equal((await silent.base.allocations.read({binding,allocationKey:hash(binding)},check)).record.state,'ALLOCATED');
 await assert.rejects(silent.registry.ensure({binding:{...binding,runId:id(790),attemptId:id(791),workerId:id(792),writerFence:2}}));assert.equal(silent.issuance.prepare.length,0);
 // An owner answering a receipt without the journal's RETIRED record: admission derives the target, the lifecycle journal refuses the
 // mapping under the source lock, the whole successor transaction rolls back: no run row, no mapping, nothing dispatched, no entry.
 const forged=await composition({retire:async({binding:b})=>({binding:b,retirementReceiptId:id(777),expiresAtMs:Date.now()+30000})});t.after(forged.close);const proof2=await forged.paused();
 await assert.rejects(forged.resume(id(781),proof2),/LIFECYCLE_EFFECT_UNKNOWN/);
 assert.equal(forged.stops.length,0);assert.equal(forged.projection(id(781)).state,'UNKNOWN');assert.equal(forged.f.state.runs.size,1);assert.equal(forged.f.state.nextRuns.size,0);assert.equal(forged.row(binding).sequence_end,null);assert.equal(forged.calls.starts.length,1);assert.equal(forged.calls.continued.length,0);
 const facts={controlId:id(781),mode:'resume',sourceBinding:binding,checkpointSha256:proof2.checkpointSha256},derived={...binding,runId:derivedUuid({...facts,field:'runId'}),attemptId:derivedUuid({...facts,field:'attemptId'}),workerId:derivedUuid({...facts,field:'workerId'}),writerFence:2};
 await assert.rejects(forged.registry.ensure({binding:derived}));assert.equal(forged.issuance.prepare.length,0);assert.equal(await forged.base.nextRuns.readTarget(derived,check),null);
});
