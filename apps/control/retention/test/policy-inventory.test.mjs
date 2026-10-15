import test from 'node:test';import assert from 'node:assert/strict';
import {parseRetentionPolicy,requirePurgePolicy,purgeEligibility} from '../policy.mjs';
import {enumerateReferences,createReferenceIndex,sharedReferences,classes} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {policy,snapshot,subjectOf,object} from './fixture.mjs';
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
 assert.throws(()=>enumerateReferences({...snapshot(a),checkpoints:[{checkpointId:'x',checkpoint:{opaqueSession:{objectId:'bad',versionId:'v',sha256:'1'.repeat(64)},workspace:{entries:[]}}}]}),/RETENTION_INVALID_REQUEST/);
});
