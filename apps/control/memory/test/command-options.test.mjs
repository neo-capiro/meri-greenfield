/** Native memory preparer contract; the source owns governed submission and Core owns the only approval. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createMemoryIntentPreparer} from '../command-options.mjs';
import {id,ids,CLIENT_A} from './fixtures.mjs';
const deliveryId=`sdk:${'a'.repeat(64)}`;
const invalid=error=>{assert.equal(error.code,'INVALID_ARGUMENTS');assert.equal(error.effect,'none');return true;};
function setup({general=false}={}){
 const binding={tenantId:'tenant-one',actorId:'actor-1',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const selectedClientId=general?null:CLIENT_A;
 const scopes=[{tenantId:binding.tenantId,kind:general?'private-user':'client',resourceId:general?binding.actorId:CLIENT_A,policyRevision:'policy-1'}];
 const calls=[],source={async propose(value){calls.push(value);return {candidateId:id(300),commandSha256:canonicalSha256(value.command),status:'pending'};}};
 const options={source,binding,scopes,selectedClientId,newId:ids(100)};
 return {binding,scopes,source,calls,options,preparer:createMemoryIntentPreparer(options)};
}

for(const general of [false,true])test(`native memory preparer returns a content-free governed review receipt in ${general?'General':'client'} context`,async()=>{
 const t=setup({general}),controller=new AbortController();
 const result=await t.preparer.prepare({arguments:{content:'  Remember this  ',key:'  preference  ',scope:general?'user_private':'client',ttlDays:400},deliveryId,signal:controller.signal});
 assert.equal(t.preparer.owner,'memory');assert.deepEqual(t.preparer.operation,{id:'save_memory',version:'0.2.0'});
 assert.deepEqual(result,{status:'review_pending',binding:t.binding,scopes:t.scopes,result:{candidateId:id(300),commandSha256:canonicalSha256(t.calls[0].command),status:'pending'}});
 assert.equal(t.calls[0].signal,controller.signal);
 assert.deepEqual(t.calls[0].command.arguments,{content:'Remember this',key:'preference',scope:general?'personal':'client',clientId:general?null:CLIENT_A,ttlDays:365});
 assert.deepEqual(t.calls[0].command.binding,t.binding);assert.deepEqual(t.calls[0].command.scopes,t.scopes);assert.deepEqual(t.calls[0].command.attachments,[]);
 assert.equal(t.calls[0].command.commandId,id(100));assert.equal(t.calls[0].command.idempotencyKey,id(101));
 assert.equal(Object.hasOwn(result,'proposal'),false);assert.equal(JSON.stringify(result).includes('Remember this'),false);
 assert.equal(JSON.stringify(result).includes('approval_required'),false);assert.equal(JSON.stringify(result).includes('published'),false);
});

test('model-supplied clientId is rejected even when null or equal to the selected client',async()=>{
 for(const general of [false,true])for(const clientId of [null,CLIENT_A,'malformed',undefined]){
  const t=setup({general});await assert.rejects(t.preparer.prepare({arguments:{content:'Preference',clientId},deliveryId}),invalid);
  assert.equal(t.calls.length,0);
 }
});

test('General cannot request client scope or broaden its private-user context',async()=>{
 const t=setup({general:true});
 await assert.rejects(t.preparer.prepare({arguments:{content:'Preference',scope:'client'},deliveryId}),invalid);assert.equal(t.calls.length,0);
 assert.throws(()=>createMemoryIntentPreparer({...t.options,scopes:[{...t.scopes[0],resourceId:'another-actor'}]}));
 assert.throws(()=>createMemoryIntentPreparer({...t.options,scopes:[{...t.scopes[0],kind:'tenant',resourceId:t.binding.tenantId}]}));
});

test('malformed SDK delivery and model payload never reach the governed producer',async()=>{
 const t=setup();
 for(const bad of ['delivery',`sdk:${'A'.repeat(64)}`,`sdk:${'a'.repeat(63)}`,null]){
  await assert.rejects(t.preparer.prepare({arguments:{content:'Preference'},deliveryId:bad}),invalid);
 }
 for(const args of [{content:' '},{content:'x'.repeat(4001)},{content:'Preference',scope:'global'},{content:'Preference',unexpected:true}]){
  await assert.rejects(t.preparer.prepare({arguments:args,deliveryId}),invalid);
 }
 assert.equal(t.calls.length,0);
});

test('source uncertainty passes through without manufacturing a review receipt or second approval',async()=>{
 const t=setup(),failure=Object.assign(Error('UNKNOWN'),{code:'UNKNOWN',effect:'unknown'});
 t.source.propose=async()=>{throw failure;};
 await assert.rejects(t.preparer.prepare({arguments:{content:'Preference'},deliveryId}),error=>error===failure);
});

test('preparer pins trusted conversation identity before callers mutate their inputs',async()=>{
 const t=setup(),originalBinding=structuredClone(t.binding),originalScopes=structuredClone(t.scopes);
 t.binding.runId=id(99);t.scopes[0].resourceId=id(98);
 const result=await t.preparer.prepare({arguments:{content:'Preference',scope:'client'},deliveryId});
 assert.deepEqual(result.binding,originalBinding);assert.deepEqual(result.scopes,originalScopes);
 assert.deepEqual(t.calls[0].command.binding,originalBinding);assert.deepEqual(t.calls[0].command.scopes,originalScopes);
 assert.equal(t.calls[0].command.arguments.clientId,CLIENT_A);
});
