import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import {objectiveReaderSchema} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {createObjectiveCustodyRecord,assertObjectiveCustodyRecord,projectObjectiveSourceObservation} from './projection.mjs';
import {custodyFixture,NOW} from './test/custody-fixture.mjs';
const unavailable=/OBJECTIVE_SOURCE_UNAVAILABLE/;
const validate=new Ajv({strict:true}).compile({...objectiveReaderSchema,$ref:objectiveReaderSchema.$id+'#/$defs/Observation'});

test('exact active and historical observations conform to closed canonical wire schema',()=>{
 const f=custodyFixture(),record=createObjectiveCustodyRecord({accepted:f.accepted,issued:f.issued});
 for(const purpose of ['active-source','historical-source']){
  const accepted=structuredClone(f.accepted);if(purpose==='historical-source')accepted.run.state='completed';
  const value=projectObjectiveSourceObservation({record,accepted,purpose,checkedAtMs:NOW,expiresAtMs:NOW+1000});
  assert.equal(validate(value),true,JSON.stringify(validate.errors));assert.equal(Object.keys(value.issuance).length,7);assert.equal(Object.isFrozen(value.issuance.binding),true);
  assert.equal(validate({...value,materialRef:'SYNTHETIC-FORBIDDEN'}),false);
 }
});

test('projection cannot renew active expiry but historical read expiry is independent',()=>{
 const f=custodyFixture(),record=createObjectiveCustodyRecord({accepted:f.accepted,issued:f.issued}),accepted=structuredClone(f.accepted);
 assert.throws(()=>projectObjectiveSourceObservation({record,accepted,purpose:'active-source',checkedAtMs:NOW,expiresAtMs:NOW+200000}),unavailable);
 accepted.run.state='completed';const value=projectObjectiveSourceObservation({record,accepted,purpose:'historical-source',checkedAtMs:NOW+200000,expiresAtMs:NOW+201000});
 assert.equal(value.issuance.expiresAtMs,NOW+100000);assert.equal(value.expiresAtMs,NOW+201000);
});

test('immutable custody snapshot rejects secret-bearing or changed original metadata',()=>{
 const f=custodyFixture(),input={accepted:structuredClone(f.accepted),issued:structuredClone(f.issued)},record=createObjectiveCustodyRecord(input);
 input.accepted.request.prompt='caller mutation';input.issued.objectiveStrategy.executionSelection.model='caller mutation';assert.deepEqual(assertObjectiveCustodyRecord(record),record);
 for(const amend of [r=>({...r,proxyCredential:'SYNTHETIC-FORBIDDEN'}),r=>({...r,binding:{...r.binding,writerFence:2}}),r=>({...r,sourceAdmissionSha256:'8'.repeat(64)}),r=>({...r,issued:{...r.issued,issuance:{...r.issued.issuance,materialRef:'SYNTHETIC-FORBIDDEN'}}})])assert.throws(()=>assertObjectiveCustodyRecord(amend(structuredClone(record))),unavailable);
});

test('unavailable run states, wrong purpose and expired current-read windows cannot be projected',()=>{
 const f=custodyFixture(),record=createObjectiveCustodyRecord({accepted:f.accepted,issued:f.issued});
 for(const state of ['paused','waiting-for-approval','completed']){
  const accepted=structuredClone(f.accepted);accepted.run.state=state;assert.throws(()=>projectObjectiveSourceObservation({record,accepted,purpose:'active-source',checkedAtMs:NOW,expiresAtMs:NOW+1000}),unavailable);
 }
 for(const purpose of ['retained-result','other'])assert.throws(()=>projectObjectiveSourceObservation({record,accepted:f.accepted,purpose,checkedAtMs:NOW,expiresAtMs:NOW+1000}),unavailable);
 assert.throws(()=>projectObjectiveSourceObservation({record,accepted:f.accepted,purpose:'active-source',checkedAtMs:NOW,expiresAtMs:NOW}),unavailable);
});
