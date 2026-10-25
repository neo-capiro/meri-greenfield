/** Canonical inventory + executor + actual row-target validator over scripted SQL.
 * The success port exercises the existing locked SDK traversal; real mutations,
 * permits and rollback remain covered by the journal and actual PostgreSQL suites. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {sdkRetentionFixture,binding,id} from '../../conversations/test/retention-sdk-fixture.mjs';
import {forEachSdkRetentionTargetPage} from '../../conversations/retention-sdk-rows.mjs';
import {createConversationPurgeFacts} from '../inventory-source.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createPurgeExecutor,recomputePlan,planDigest,rowWorkflowIdentity} from '../purge.mjs';
import {hash,subjectKey} from '../boundary.mjs';
import {compose} from './fixture.mjs';

const day=86400000,entryTable='meri_conversations.sdk_session_entries';
async function fixture(t,{object=true}={}){
 const sdk=await sdkRetentionFixture({count:1001,text:'AAAA'});t.after(sdk.close);
 const f=compose(),subject=sdk.raw.subject,key=subjectKey(subject),trashedAtMs=f.clock.now(),requestId=id(800001);
 const state={phase:'setup',inventories:0,inventoryErrors:[],validations:0,deletes:0,purges:0,finalizations:0,visits:0,afterInventory:null,afterValidation:null,readerFault:null},calls=[];
 if(object){
  const run=sdk.raw.runs[0],{scopes,versions}=run.projection,input={controlId:id(800002),intent:'pause'};
  const file={objectId:id(800003),versionId:'retained-version',sha256:'d'.repeat(64),bytes:5,scopes};
  const files={workspace:{contractVersion:'0.1.0',manifestId:id(800004),binding,logicalCwd:'/workspace/conversation',entries:[{path:'private.txt',kind:'file',executable:false,object:file}],scopes,createdAt:new Date(trashedAtMs).toISOString()},tasks:[]};
  const projection={input,inputSha256:hash(input),sourceBinding:binding,scopes,sourceSelectedClientId:id(5),sourceRequest:run.request,sourceRequestSha256:run.request_sha256,
   contextSha256:hash({window:run.request.window??null,skill:run.request.skill??null,scopes}),versions,captureSequence:1,command:null,commandSha256:null,approval:null,state:'UNKNOWN',checkpointId:null,proof:null,target:null,retirement:null,replayed:false,
   fileCapture:{requestSha256:hash(files),sessionId:id(800005),files}};
  sdk.raw.controls.push({tenant_id:subject.tenantId,conversation_id:subject.subjectId,run_id:binding.runId,control_id:input.controlId,control_sequence:1,projection,projection_sha256:hash(projection)});
  f.store.put(f.keyFor(file),file.versionId);
 }
 const reader={async query(sql,args){calls.push({phase:state.phase,sql,args});await state.readerFault?.(sql,args);return sdk.reader.query(sql,args);}};
 const rowJournal=createPostgresRetentionJournal({pool:{connect:async()=>({...reader,release(){}})},now:f.clock.now});
 const storage={...f.storage,async holdsFor(){return {legalHold:false,objectLockRetainUntilMs:null};},async deleteVersion(...args){state.deletes++;return f.storage.deleteVersion(...args);}};
 const core={async read(){return {status:'trashed',trashRequestId:requestId,revision:'2',trashedAt:new Date(trashedAtMs).toISOString(),restoreUntil:new Date(trashedAtMs+30*day).toISOString(),checkedAtMs:f.clock.now()};}};
 const canonical=createConversationPurgeFacts({pool:{connect(){assert.fail('unexpected second lease');}},journal:{withSnapshot:fn=>fn(reader)},core,storage,keyFor:f.keyFor,now:f.clock.now});
 // Shared-holder and execution settlement are explicit fixture ports. SDK
 // content always comes through the production canonical inventory source.
 const facts={...canonical,sharedFor:async()=>[],liabilities:async()=>[],async inventoryFor(...args){
  state.inventories++;state.phase='inventory-'+state.inventories;let result;
  try{result=await canonical.inventoryFor(...args);}catch(error){state.inventoryErrors.push(error);throw error;}
  await state.afterInventory?.(result);return result;
 }};
 const rows={...rowJournal.rows,async validatePlanTargets(...args){
  state.validations++;state.phase='target-validation';await rowJournal.rows.validatePlanTargets(...args);await state.afterValidation?.();return true;
 },async preflight(){assert.fail('executor must not request a duplicate SDK preflight');},async purge(_key,plan,options){
  state.purges++;state.phase='locked-traversal';
  for(const step of plan.rowSteps.filter(s=>s.target.sdk))await forEachSdkRetentionTargetPage(reader,{subject,target:step.target,check:options.check,lock:true},async page=>{
   if(!state.visits){for(const table of ['sdk_sessions','sdk_session_streams'])assert.ok(calls.some(c=>c.phase==='locked-traversal'&&c.sql.includes('FROM meri_conversations.'+table+' r')&&c.sql.includes('FOR UPDATE')));}
   state.visits++;assert.ok(page.length<=1000);
  });
  return plan.rowSteps.map(step=>({...step,state:'EXECUTED',deleted:0}));
 }};
 const suppression=createSuppressionOwner({...f,ownership:{ownerOf:async()=>subject.ownerActorId},now:f.clock.now});
 await suppression.suppress({principal:{tenantId:subject.tenantId,actorId:subject.ownerActorId},subject,reason:'conversation-trash:'+requestId});f.clock.advance(31*day);
 const executor=createPurgeExecutor({...f,facts,storage,rows,enabled:true,now:f.clock.now,async finalize(){state.finalizations++;}});
 return {...f,sdk,subject,key,state,calls,facts,rows,executor,plan:async()=>recomputePlan(facts,subject,await f.journal.get(key),f.clock.now())};
}

for(const stage of ['planning','target-validation'])for(const change of ['corrupt-final-page','rehashed-final-page','orphan'])test(`${change} after ${stage} is refused at fresh begin before any effect`,async t=>{
 const f=await fixture(t);let changed=false;
 const mutate=()=>{if(changed)return;changed=true;const row=f.sdk.raw.contentRows[entryTable].at(-1);
  if(change==='orphan')row.subpath='unowned-stream';
  else{row.entry.message.content='BBBB';if(change==='rehashed-final-page')row.entry_sha256=hash(row.entry);}
 };
 if(stage==='planning')f.state.afterInventory=inventory=>{assert.equal(inventory.objects.length,1);if(f.state.inventories===1)mutate();};
 else f.state.afterValidation=mutate;
 await assert.rejects(f.executor.sweepSubject(f.subject),change==='rehashed-final-page'?/RETENTION_PLAN_DIGEST_REFUSED/:/RETENTION_AUTHORITY_UNAVAILABLE/);
 if(change==='rehashed-final-page')assert.equal(f.state.inventoryErrors.length,0);
 else{assert.equal(f.state.inventoryErrors.length,1);assert.equal(f.state.inventoryErrors[0].code,'STORE_CORRUPT');}
 assert.equal(f.state.inventories,2);assert.equal(f.state.validations,1);assert.equal(changed,true);
 assert.deepEqual([f.state.deletes,f.state.purges,f.state.finalizations],[0,0,0]);assert.equal(f.store.versions.size,1);
 assert.equal((await f.journal.get(f.key)).purge.state,'PLANNED');
 assert.equal((await f.sink.read()).some(row=>row.state==='PURGE_UNKNOWN'),false);
});

test('public execute refuses a self-consistent forged SDK summary through canonical inventory',async t=>{
 const f=await fixture(t),p=structuredClone(await f.plan()),step=p.rowSteps.find(s=>s.target.sdk);
 step.target.sdk.rowsSha256='f'.repeat(64);step.workflowId=rowWorkflowIdentity({tenantId:f.subject.tenantId,subjectId:f.subject.subjectId,target:step.target,policyVersion:p.policyVersion});p.planSha256=planDigest(p);
 await assert.rejects(f.executor.execute(p),/RETENTION_PLAN_DIGEST_REFUSED/);
 assert.deepEqual([f.state.validations,f.state.deletes,f.state.purges,f.state.finalizations],[0,0,0,0]);assert.equal(f.store.versions.size,1);
});

for(const fault of ['cancel','unavailable'])test(`fresh canonical begin ${fault} preserves zero effects`,async t=>{
 const f=await fixture(t),controller=new AbortController();let once=false;
 f.state.afterValidation=()=>{f.state.readerFault=sql=>{if(!once&&sql.startsWith('SELECT r.* FROM '+entryTable)){once=true;if(fault==='cancel')controller.abort();else throw Error('synthetic SDK source unavailable');}};};
 await assert.rejects(f.executor.sweepSubject(f.subject,{signal:controller.signal}),/RETENTION_AUTHORITY_UNAVAILABLE/);
 assert.equal(f.state.inventoryErrors.length,1);assert.match(f.state.inventoryErrors[0].message,fault==='cancel'?/RETENTION_INVENTORY_CANCELLED/:/synthetic SDK source unavailable/);
 assert.equal(once,true);assert.deepEqual([f.state.deletes,f.state.purges,f.state.finalizations],[0,0,0]);assert.equal(f.store.versions.size,1);
});

test('fresh row-only sweep uses planning and begin snapshots then one locked SDK traversal',async t=>{
 const f=await fixture(t,{object:false}),result=await f.executor.sweepSubject(f.subject);
 assert.equal(result.coreFinalized,true);assert.deepEqual([f.state.inventories,f.state.validations,f.state.purges,f.state.finalizations],[2,1,1,1]);
 const bodyCalls=f.calls.filter(c=>c.sql.startsWith('SELECT r.* FROM '+entryTable));
 assert.deepEqual(bodyCalls.map(c=>c.phase),['inventory-1','inventory-1','inventory-2','inventory-2','locked-traversal','locked-traversal']);
 assert.equal(f.state.visits,4,'two entry pages, one stream page, one header page');
});

test('target validation refuses malformed SDK, foreign subjects and unsupported classes before SQL',async t=>{
 const f=await fixture(t,{object:false}),p=await f.plan(),step=p.rowSteps.find(s=>s.target.sdk);f.calls.length=0;
 for(const bad of [
  {...p,subject:{...p.subject,subjectId:id(900001)},rowSteps:[step]},
  {...p,rowSteps:[{...step,target:{...step.target,extra:true}}]},
  {...p,rowSteps:[{className:'schedules',target:{className:'schedules',key:id(900002)}}]},
  {...p,rowSteps:[{className:'events',target:{className:'events',key:id(900003)}}]},
 ])await assert.rejects(f.rows.validatePlanTargets(f.key,bad),/RETENTION_INVALID_REQUEST|RETENTION_ROW_CLASS_UNSUPPORTED/);
 assert.deepEqual(f.calls,[]);
});

test('target validation retains current non-SDK byte checks under row locks',async t=>{
 const f=await fixture(t,{object:false}),p=await f.plan();f.calls.length=0;f.sdk.raw.runs[0].request.prompt='changed current content';
 await assert.rejects(f.rows.validatePlanTargets(f.key,p),/RETENTION_ROW_CHANGED/);
 assert.ok(f.calls.some(c=>c.sql.startsWith('SELECT r.* FROM meri_conversations.runs')&&c.sql.includes('FOR UPDATE')));
 assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));
 assert.ok(!f.calls.some(c=>c.sql.startsWith('SELECT r.* FROM '+entryTable)));
});

test('target validation retains Memory candidate scope and unavailable-owner refusal',async()=>{
 const subject={tenantId:'tenant-a',kind:'conversation',subjectId:id(900004),ownerActorId:'actor-a'},key=subjectKey(subject),candidateId=id(900005),calls=[];
 let available=true;
 const journal=createPostgresRetentionJournal({pool:{async connect(){return {release(){},async query(sql,args){calls.push({sql,args});return {rows:sql.startsWith('SELECT candidate,')&&available?[{candidate:{text:'retained'},candidate_purged_at:null}]:[]};}};}}});
 const plan={subject,rowSteps:[{className:'meriMemoryCandidates',target:{className:'meriMemoryCandidates',key:candidateId}}]};
 assert.equal(await journal.rows.validatePlanTargets(key,plan),true);
 const read=calls.find(c=>c.sql.startsWith('SELECT candidate,'));
 assert.deepEqual(read.args,[subject.tenantId,subject.subjectId,candidateId,subject.ownerActorId]);
 assert.match(read.sql,/origin_kind='conversation' AND origin_conversation_id=\$2 AND proposer_actor_id=\$4/);
 available=false;await assert.rejects(journal.rows.validatePlanTargets(key,plan),/RETENTION_ROW_PURGE_UNAVAILABLE/);
 const {ownerActorId,...unowned}=subject;
 await assert.rejects(journal.rows.validatePlanTargets(key,{...plan,subject:unowned}),/RETENTION_INVALID_REQUEST/);
 assert.ok(calls.some(c=>c.sql==='ROLLBACK'));assert.ok(!calls.some(c=>/^(DELETE|UPDATE|INSERT)/.test(c.sql)));
});
