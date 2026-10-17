/** Actual production reader factories over explicitly synthetic owner readbacks.
 * No live task, authority, credential, database or durability is qualified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createObjectiveSourcePreparedReader} from './prepared-reader.mjs';
import {objectiveProtectedFactsFixture} from './test/protected-facts-fixture.mjs';
const unavailable=/OBJECTIVE_SOURCE_UNAVAILABLE/;
function fixture(){
 const f=objectiveProtectedFactsFixture(),decorated=f.decorate(),issued={issuance:{...f.options.issuance,factsSha256:decorated.facts.factsSha256},...decorated.facts};
 const state={now:f.options.nowMs,accepted:structuredClone(f.options.accepted),issued:structuredClone(issued),coreExpiry:f.options.nowMs+1000,calls:{run:0,issuance:0,allocation:0,task:0,core:0}};
 const resource={taskArn:'arn:aws:ecs:us-east-1:967807252336:task/SyntheticObjective/'+'a'.repeat(32)};
 const record={state:'ADMITTED',original:issued.original,allocationSha256:issued.allocationSha256,taskRequestSha256:issued.taskRequestSha256,grantIntents:issued.grantIntents,resource};
 const ports={store:{async read(){state.calls.run++;return structuredClone(state.accepted);},allocations:{async read(){state.calls.allocation++;return {record:structuredClone(record)};}}},
  issuance:{async readIssuance(){state.calls.issuance++;return structuredClone(state.issued.issuance);}},
  taskProof:{async verifyTask(){state.calls.task++;return {taskArn:resource.taskArn,imageSha256:issued.original.versions.imageDigest.slice(7),runnerSha256:'a'.repeat(64),checkedAtMs:state.now,expiresAtMs:issued.issuance.expiresAtMs};}},
  coreCurrent:{async readCurrent(){state.calls.core++;return {binding:issued.original.binding,sourceRequestSha256:issued.issuance.requestSha256,objectiveGeneration:issued.objectiveGeneration,objectiveStrategy:issued.objectiveStrategy,checkedAtMs:state.now,expiresAtMs:state.coreExpiry};}},
 };
 const create=(options={})=>createObjectiveSourcePreparedReader({...ports,issued,enabled:true,now:()=>state.now,maxRequestMs:3000,...options});
 return {state,ports,issued,create};
}

test('actual prepared-facts reader succeeds before a closed envelope exposes the shortest Core proof expiry',async()=>{
 const f=fixture(),reader=f.create(),result=await reader.read({binding:f.issued.original.binding});
 assert.equal(reader.available(),true);assert.deepEqual(result.issued,f.issued);assert.equal(result.expiresAtMs,f.state.coreExpiry);assert.equal(result.checkedAtMs,f.state.now);
 assert.deepEqual(f.state.calls,{run:3,issuance:3,allocation:3,task:1,core:1});assert.deepEqual(Object.keys(result).sort(),['checkedAtMs','expiresAtMs','issued']);assert.equal(Object.isFrozen(result.issued),true);
});

test('each read observes its own fresh Core expiry without extending a previous observation',async()=>{
 const f=fixture(),reader=f.create(),first=await reader.read({binding:f.issued.original.binding});f.state.coreExpiry=f.state.now+500;
 const second=await reader.read({binding:f.issued.original.binding});assert.equal(first.expiresAtMs,f.state.now+1000);assert.equal(second.expiresAtMs,f.state.now+500);assert.equal(f.state.calls.core,2);
});

test('disabled or incomplete wrapper cannot invoke owner ports or fall back to raw facts',async()=>{
 for(const options of [{enabled:false},{store:undefined},{issuance:undefined},{taskProof:undefined},{coreCurrent:undefined}]){
  const f=fixture(),reader=f.create(options);assert.equal(reader.available(),false);await assert.rejects(reader.read({binding:f.issued.original.binding}),unavailable);
  assert.equal(Object.values(f.state.calls).reduce((a,b)=>a+b,0),0);
 }
 assert.equal(createObjectiveSourcePreparedReader().available(),false);
});

test('backward clock during actual source reads refuses rather than returning an earlier checkedAt',async()=>{
 const f=fixture();const original=f.ports.store.read;f.ports.store.read=async()=>{f.state.now-=1;return original();};
 await assert.rejects(f.create().read({binding:f.issued.original.binding}),unavailable);assert.equal(f.state.calls.core,0);
});

test('malformed or expired Core proof and source drift after proof are not projected',async()=>{
 for(const amend of [v=>({...v,expiresAtMs:v.checkedAtMs}),v=>({...v,checkedAtMs:v.checkedAtMs-1}),v=>({...v,extra:'SYNTHETIC-FORBIDDEN'})]){
  const f=fixture(),original=f.ports.coreCurrent.readCurrent;f.ports.coreCurrent.readCurrent=async()=>amend(await original());await assert.rejects(f.create().read({binding:f.issued.original.binding}),unavailable);
 }
 const f=fixture(),original=f.ports.coreCurrent.readCurrent;f.ports.coreCurrent.readCurrent=async()=>{const result=await original();f.state.accepted.run.state='failed';return result;};
 await assert.rejects(f.create().read({binding:f.issued.original.binding}),unavailable);
});

test('bounded operation expiry survives a delayed actual source read and never slides forward',async()=>{
 const f=fixture();f.state.coreExpiry=f.state.now+10000;const began=f.state.now,original=f.ports.store.read;let once=true;
 f.ports.store.read=async()=>{if(once){f.state.now+=1000;once=false;}return original();};
 const result=await f.create().read({binding:f.issued.original.binding});assert.equal(result.checkedAtMs,began+1000);assert.equal(result.expiresAtMs,began+3000);
});
