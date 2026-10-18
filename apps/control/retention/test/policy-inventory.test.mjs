import test from 'node:test';import assert from 'node:assert/strict';
import {parseRetentionPolicy,requirePurgePolicy,purgeEligibility} from '../policy.mjs';
import {enumerateReferences,createReferenceIndex,sharedReferences,classes} from '../inventory.mjs';
import {holderEligibility} from '../purge.mjs';
import {subjectKey} from '../boundary.mjs';
import {policy,snapshot,subjectOf,object,compose,planFrom} from './fixture.mjs';
test('a policy is explicit required configuration: every class, a positive cooling period and a version; nothing is defaulted',()=>{
 const p=parseRetentionPolicy(policy());assert.equal(p.version,3);assert.equal(Object.keys(p.classes).length,classes.length);
 const missing=policy();delete missing.classes.logs;assert.throws(()=>parseRetentionPolicy(missing),/INVALID_COMMAND|RETENTION_POLICY_INVALID/);
 assert.throws(()=>parseRetentionPolicy({...policy(),coolingPeriodMs:0}),/RETENTION_POLICY_INVALID/);
 assert.throws(()=>parseRetentionPolicy({...policy(),extra:1}),/INVALID_COMMAND/);
});
test('a missing policy blocks physical purge and is not consulted by suppression',()=>{
 assert.throws(()=>requirePurgePolicy(null),/RETENTION_POLICY_REQUIRED/);assert.throws(()=>requirePurgePolicy(undefined),/RETENTION_POLICY_REQUIRED/);
 const now=1_800_000_000_000,e=purgeEligibility({policy:policy(),className:'lifecycle',suppressedAtMs:now-1000,lastActivityAtMs:now-30*86400000,nowMs:now});
 assert.deepEqual(e,{eligible:false,reasons:['COOLING_PERIOD'],policyId:'policy-synthetic',policyVersion:3});
 assert.equal(purgeEligibility({policy:policy(),className:'lifecycle',suppressedAtMs:now-2*86400000,lastActivityAtMs:now-30*86400000,nowMs:now}).eligible,true);
 assert.deepEqual(purgeEligibility({policy:policy(),className:'logs',suppressedAtMs:now-2*86400000,lastActivityAtMs:now-30*86400000,nowMs:now}).reasons,['CLASS_NOT_PURGEABLE']);
 assert.deepEqual(purgeEligibility({policy:policy(),className:'events',suppressedAtMs:undefined,lastActivityAtMs:now,nowMs:now}).reasons,['NOT_SUPPRESSED','RETENTION_PERIOD']);
});
test('the inventory enumerates exact object versions per class, deduplicates across classes, and a fork sharing a version is excluded as a shared reference',()=>{
 const shared=object(),a=subjectOf(),b=subjectOf();
 const inventoryA=enumerateReferences(snapshot(a,{checkpoints:2,outputs:2,shared:[shared]})),inventoryB=enumerateReferences(snapshot(b,{shared:[shared]}));
 assert.equal(inventoryA.rows.filter(r=>r.className==='lifecycle').length,2);assert.equal(inventoryA.objects.length,2*2+2+2+1,'two checkpoints (2 objects each), one completion checkpoint (2), two outputs, one shared entry');
 assert.ok(inventoryA.rows.find(r=>r.className==='logs')&&inventoryA.rows.find(r=>r.className==='logs').objects.length===0,'logs carry identifiers only');
 const index=createReferenceIndex();index.record(subjectKey(a),inventoryA);index.record(subjectKey(b),inventoryB);
 const sharedA=sharedReferences(inventoryA,index,subjectKey(a),()=>({eligible:false,reasons:['HOLDER_NOT_SUPPRESSED']}));assert.equal(sharedA.length,1);assert.equal(sharedA[0].object.objectId,shared.objectId);assert.deepEqual(sharedA[0].heldBy,[subjectKey(b)]);assert.deepEqual(sharedA[0].blocking,[{holder:subjectKey(b),reasons:['HOLDER_NOT_SUPPRESSED']}]);
 assert.equal(sharedReferences(inventoryA,index,subjectKey(a),k=>({eligible:k===subjectKey(b),reasons:[]})).length,0,'once the fork holder is itself purge-eligible the version is no longer shared-blocked');
 assert.deepEqual(inventoryA.objects.find(o=>o.objectId===shared.objectId).classes,['lifecycle'],'classes are carried per exact object');
 const malformed=snapshot(a);malformed.checkpoints[0].checkpoint.opaqueSession.objectId='bad';
 assert.throws(()=>enumerateReferences(malformed),/RETENTION_INVALID_REQUEST/);
});
test('conversation row inventory refuses incomplete or duplicate owner event and control identities',()=>{
 const s=snapshot(subjectOf()),event=s.eventRows[0],control=s.controls[0];
 const inventory=enumerateReferences(s);
 assert.deepEqual(inventory.rowTargets.filter(row=>row.className==='events'),[{
  className:'events',table:'events',...event}]);
 assert.deepEqual(inventory.rowTargets.filter(row=>row.table==='controls'),[{
  className:'conversation',table:'controls',...control}]);
 for(const partial of [
  {...s,runs:[],eventRows:[],controls:[],checkpoints:[],completionCheckpoints:[]},
  {...s,eventRows:[]},
  {...s,eventRows:[event,event]},
  {...s,eventRows:[{...event,runId:subjectOf().subjectId}]},
  {...s,controls:[]},
  {...s,controls:[control,control]},
  {...s,controls:[{...control,runId:subjectOf().subjectId}]},
 ])assert.throws(()=>enumerateReferences(partial),/RETENTION_INVALID_REQUEST/);
 const artifact=snapshot(subjectOf('artifact'));
 assert.throws(()=>enumerateReferences({...artifact,eventRows:[event]}),/RETENTION_INVALID_REQUEST/);
 assert.throws(()=>enumerateReferences({...artifact,controls:[control]}),/RETENTION_INVALID_REQUEST/);
});
test('unpublished completion rows retain exact targets and block both plans and shared-holder eligibility',()=>{
 const s=snapshot(subjectOf()),f=compose(),nowMs=f.clock.now(),day=86400000,
  journalState={state:'SUPPRESSED',suppressedAtMs:nowMs-8*day,ledgerSequence:1,entrySha256:'a'.repeat(64)},
  holds=()=>({objectLockRetainUntilMs:null,legalHold:false});
 for(const state of ['CAPTURING','UNKNOWN']){
  const pending={...s,completionCheckpoints:[{...s.completionCheckpoints[0],state,checkpoint:null}]},
   inventory=enumerateReferences(pending),completion=pending.completionCheckpoints[0];
  assert.deepEqual(inventory.unpublishedCompletionCheckpoints,[{className:'completionCheckpoints',
   checkpointId:completion.checkpointId,runId:completion.runId,state}]);
  assert.deepEqual(inventory.rows.find(row=>row.className==='completionCheckpoints').objects,[],
   'unpublished completion supplies no proven object-version reference');
  const plan=planFrom(f,s.subject,journalState,{inventory});
  assert.equal(plan.state,'BLOCKED');
  assert.deepEqual(plan.blocks.filter(block=>block.reason==='UNPUBLISHED_COMPLETION'),[{
   reason:'UNPUBLISHED_COMPLETION',detail:{checkpointId:completion.checkpointId,runId:completion.runId,state}}]);
  assert.deepEqual(holderEligibility({journalState,policy:policy(),inventory,holds,liabilities:[],
   lastActivityAtMs:nowMs-30*day,nowMs}),{eligible:false,reasons:['HOLDER_UNPUBLISHED_COMPLETION']});
  assert.deepEqual(inventory.rowTargets.filter(row=>row.className==='completionCheckpoints'),[{
   className:'completionCheckpoints',checkpointId:completion.checkpointId,runId:completion.runId,state}]);
  assert.throws(()=>planFrom(f,s.subject,journalState,{inventory:{...inventory,
   unpublishedCompletionCheckpoints:undefined}}),/RETENTION_INVALID_REQUEST/);
 }
 const wrong={...s,completionCheckpoints:[{...s.completionCheckpoints[0],state:'CAPTURING'}]};
 assert.throws(()=>enumerateReferences(wrong),/RETENTION_INVALID_REQUEST/);
});
test('local proposal continuation rows retain distinct conversation purge targets',()=>{
 const s=snapshot(subjectOf()),runId=s.runs[0].runId,
  memoryContinuations=[{runId,keySha256:'a'.repeat(64)},{runId,keySha256:'b'.repeat(64)}];
 const {memoryContinuations:missing,...incomplete}=s;
 assert.throws(()=>enumerateReferences(incomplete),/INVALID_COMMAND/);
 const inventory=enumerateReferences({...s,memoryContinuations});
 const targets=inventory.rowTargets.filter(row=>row.table==='memory_proposal_contexts');
 assert.deepEqual(targets,[...memoryContinuations].map(row=>({className:'conversation',
  table:'memory_proposal_contexts',...row})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 assert.equal(inventory.rows.filter(row=>row.key.startsWith('memory-proposal:')).length,2);
 assert.throws(()=>enumerateReferences({...s,memoryContinuations:[{runId,keySha256:'wrong'}]}),
  /RETENTION_INVALID_REQUEST/);
});
