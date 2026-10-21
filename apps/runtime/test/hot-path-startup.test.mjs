import test from 'node:test';
import assert from 'node:assert/strict';
import {hotPathBudgets} from '../../../packages/runtime/hot-path-budgets.mjs';
import {startTemporalWorker} from '../temporal-worker.mjs';
import {startScheduleWorker} from '../schedule-worker.mjs';
import {runConversation} from '../conversation-runner.mjs';
import {runRemoteConversation} from '../remote-conversation-runner.mjs';

const configuration={limits:{startupMs:30000,shutdownMs:10000,requestMs:25000},runWindowMs:900000};
const valid=hotPathBudgets(configuration);
const invalid=()=>{const value=structuredClone(valid);value.hops['control.capture'].ms=value.hops['runner.call.load'].ms;return value;};

test('worker and runner entrypoints reject invalid nesting before allocating their resources',async()=>{
 let effects=0;const effect=()=>{effects++;throw Error('RESOURCE_MUST_NOT_BE_ALLOCATED');};
 const invocations=[
  ()=>startTemporalWorker(configuration,{budgets:invalid(),testOwners:{authorization:effect,tls:effect,readMaterial:effect,nativeClient:effect,connect:effect,createWorker:effect,listen:effect}}),
  ()=>startScheduleWorker(configuration,{budgets:invalid(),dispatch:{dispatch:effect,reconcile:effect}}),
  ()=>runConversation(configuration,{budgets:invalid(),query:effect,sessionFactory:effect}),
  ()=>runRemoteConversation(configuration,{budgets:invalid(),fetchImpl:effect,execute:effect,listen:effect,createWorker:effect}),
 ];
 for(const invoke of invocations)await assert.rejects(invoke,{code:'HOT_PATH_BUDGET_CONFIGURATION'});
 assert.equal(effects,0);
});

test('worker and runner entrypoints require the rendered turn root before resource allocation',async()=>{
 const missing={limits:configuration.limits};let effects=0;const effect=()=>{effects++;throw Error('RESOURCE_MUST_NOT_BE_ALLOCATED');};
 for(const invoke of [
  ()=>startTemporalWorker(missing,{testOwners:{authorization:effect}}),
  ()=>startScheduleWorker(missing,{dispatch:{dispatch:effect,reconcile:effect}}),
  ()=>runConversation(missing,{query:effect}),
  ()=>runRemoteConversation(missing,{fetchImpl:effect,execute:effect,listen:effect,createWorker:effect}),
 ])await assert.rejects(invoke,{code:'HOT_PATH_BUDGET_CONFIGURATION'});
 assert.equal(effects,0);
});
