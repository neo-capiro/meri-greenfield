/** Existing accepted run/settings owners; no Core, model or database calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createObjectiveSelectionOwner} from './selection-owner.mjs';
import {runStartFixture,id,NOW} from '../objective-source/test/run-start-fixture.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {HISTORICAL_MODEL_SELECTION} from '../../../packages/contracts/model-selection.mjs';
const clone=structuredClone;
function fixture(){const f=runStartFixture(),state={at:NOW,start:{state:'STARTED',record:clone(f.record)},reads:0,policies:0,onPolicy:null};
 state.saved={request:clone(f.acceptedRequest),run:{binding:clone(f.binding),state:'running',scopes:[{kind:'client',tenantId:f.tenantId,resourceId:f.clientId,policyRevision:'policy'}],createdAt:new Date(NOW).toISOString(),policyRevision:'policy',versions}};
 const ports={runStarts:{async read(){state.reads++;return clone(state.start);}},store:{async readModelSelection(b,check){assert.deepEqual(b,f.binding);check();return HISTORICAL_MODEL_SELECTION;},async read(){return clone(state.saved);},async readModelPolicy(b,check){assert.deepEqual(b,f.binding);check();state.policies++;await state.onPolicy?.();return {maxTurns:20,maxBudgetMicroUsd:2000000,monthlyCapMicroUsd:10000000};}}};
 return {...f,state,ports,make:()=>createObjectiveSelectionOwner({...ports,now:()=>state.at,maxRequestMs:50})};}
test('one accepted Objective uses the actual SDK model and canonical policy without issuance, allocation or task proof',async()=>{const f=fixture(),r=await f.make().read({binding:f.binding});assert.deepEqual(r.objectiveGeneration.sourceAdmission,f.selection.sourceAdmission);assert.deepEqual(r.objectiveStrategy.request,f.selection.request);assert.deepEqual(r.objectiveStrategy.executionSelection,{provider:'bedrock',model:HISTORICAL_MODEL_SELECTION.modelId});assert.equal(r.expiresAtMs,f.record.effectExpiresAtMs);assert.equal(f.state.policies,1);assert.equal(f.state.reads,2);});
test('only genuine ABSENT is ordinary chat and it needs no policy read',async()=>{const f=fixture();f.state.start={state:'ABSENT'};assert.equal(await f.make().read({binding:f.binding}),null);assert.equal(f.state.policies,0);await assert.rejects(f.make().read({binding:f.binding,typedResult:{}}));});
for(const [name,change] of [
 ['unknown start',f=>{f.state.start={state:'UNKNOWN'};}],['absent with record',f=>{f.state.start.state='ABSENT';}],
 ['changed accepted request',f=>{f.state.saved.request.prompt='other';}],['foreign actor',f=>{f.state.saved.run.binding.actorId=id(99);}],
 ['foreign tenant',f=>{f.state.saved.run.scopes[0].tenantId=id(99);}],['wrong client',f=>{f.state.saved.run.scopes[0].resourceId=id(99);}],
 ['mismatched policy',f=>{f.state.saved.run.policyRevision='other';}],
 ['private scope on client Objective',f=>{f.state.saved.run.scopes[0]={...f.state.saved.run.scopes[0],kind:'private-user',resourceId:f.actorId};}],
 ['cancelled run',f=>{f.state.saved.run.state='cancelled';}],['failed run',f=>{f.state.saved.run.state='failed';}],
 ['corrupt selection',f=>{f.state.start.record.selection.request.input.typeHint='authorization';}],['expired admission',f=>{f.state.at=f.record.effectExpiresAtMs;}],
 ['policy refusal',f=>{f.ports.store.readModelPolicy=async()=>{throw Error('revoked');};}],
 ['run changes during policy read',f=>{f.state.onPolicy=()=>{f.state.saved.run.state='cancelled';};}],
 ['start changes during policy read',f=>{f.state.onPolicy=()=>{f.state.start={state:'ABSENT'};};}],
 ['expiry during policy read',f=>{f.state.onPolicy=()=>{f.state.at=f.record.effectExpiresAtMs;};}],
 ['extra authority input',f=>{f.extra={taskCapability:'not-authority'};}],
])test('selection refuses '+name,async()=>{const f=fixture();change(f);await assert.rejects(f.make().read({binding:f.binding,...f.extra}));});
test('cancellation and stalled policy are bounded without a late result',async()=>{const f=fixture(),a=new AbortController();a.abort();await assert.rejects(f.make().read({binding:f.binding,signal:a.signal}));assert.equal(f.state.reads,0);f.state.onPolicy=()=>new Promise(()=>{});await assert.rejects(f.make().read({binding:f.binding}));});
test('completed source selection remains readable for exact completion replay, but missing policy still refuses',async()=>{const f=fixture();f.state.saved.run.state='completed';assert.ok(await f.make().read({binding:f.binding}));delete f.ports.store.readModelPolicy;assert.throws(f.make);});
test('Objective saved model failure is not replaced by mutable actor preferences or an independent fixed model',async()=>{const f=fixture();let calls=0;f.ports.store.readModelSelection=async()=>{calls++;throw Error('MODEL_SELECTION_UNAVAILABLE');};await assert.rejects(f.make().read({binding:f.binding}),/MODEL_SELECTION_UNAVAILABLE/);assert.equal(calls,1);delete f.ports.store.readModelSelection;assert.throws(f.make);});
