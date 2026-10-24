import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationLifetime} from '../../../../../packages/runtime/operation-lifetime.mjs';
import {createActivityLifecycle} from '../activity-lifecycle.mjs';
import {continuationFixture,id} from './fixtures.mjs';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(t){
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
 const f=continuationFixture(),binding=f.target.binding,controller=new AbortController(),reads=[];
 const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+10000,signal:controller.signal,errorFactory:code=>Object.assign(Error(code),{code})});
 const owner={async nextControls(){reads.push(Date.now());return [];},async claimControl(){throw Error('unexpected claim');},async ackControl(){throw Error('unexpected ack');},async recordCheckpoint(){throw Error('unexpected checkpoint');}};
 const lifecycle=createActivityLifecycle({config:{captureCheckpoint(){throw Error('unexpected capture');}},runOwner:owner,binding,
  saved:{request:f.target.request,run:{versions:f.target.versions,scopes:f.target.scopes}},runtime:{deadlineMs:Date.now()+10000},
  input:{enqueue(){},close(){}},query:{interrupt(){},close(){}},life,now:Date.now});
 t.after(()=>{lifecycle.close();life.close();});
 return {controller,reads,lifecycle,async start(){await lifecycle.observe({type:'system',subtype:'init',session_id:id(90)});await flush();}};
}

test('default idle control cadence reads fresh once per second instead of ten times',async t=>{
 const f=fixture(t);await f.start();assert.equal(f.reads.length,1);
 for(let i=0;i<9;i++){t.mock.timers.tick(100);await flush();}
 assert.equal(f.reads.length,1,'no redundant idle reads within the first second');
 t.mock.timers.tick(100);await flush();assert.equal(f.reads.length,2);
 assert.equal(f.reads[1]-f.reads[0],1000);
 await f.lifecycle.finish();
});

test('a publication fence wakes the idle control read immediately',async t=>{
 const f=fixture(t);await f.start();const at=Date.now();
 assert.equal(f.lifecycle.fence(),true);await flush();
 assert.equal(f.reads.length,2);assert.equal(f.reads[1],at);
 const error=await f.lifecycle.failure;
 assert.equal(error.cause.code,'HOLD_CONTROL_MISSING','the fresh read still enforces the missing durable hold');
});

test('completion wakes the idle reader without another read or waiting for its timer',async t=>{
 const f=fixture(t);await f.start();let finished=false;
 const finishing=f.lifecycle.finish().then(()=>{finished=true;});await flush();
 assert.equal(finished,true);await finishing;assert.equal(f.reads.length,1);
});

test('caller cancellation wakes the idle reader without another authority read',async t=>{
 const f=fixture(t);await f.start();f.controller.abort();await flush();
 assert.equal(f.reads.length,1);const error=await f.lifecycle.failure;
 assert.equal(error.cause.code,'CANCELLED');
});
