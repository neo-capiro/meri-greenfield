import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryContextRelay} from '../memory-context-relay.mjs';

test('proposal continuation relay binds once to the owned journal and fences captured ports on close',async()=>{
 const relay=createMemoryContextRelay(),task=Object.freeze({clientId:'client'}),
  ports=Object.freeze({loadPrevious(){return 'previous';},retain(){return 'retained';}}),store={forTask(input){
   assert.equal(this,store);assert.equal(input,task);return ports;
  }};
 assert.equal(relay.state(),'unbound');
 assert.throws(()=>relay.forTask(task),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 assert.throws(()=>relay.bind({}),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 relay.bind(store);
 assert.equal(relay.state(),'bound');
 const captured=relay.forTask(task);
 assert.equal(await captured.loadPrevious({}),'previous');
 assert.equal(await captured.retain({}),'retained');
 assert.throws(()=>relay.bind(store),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 relay.close();
 assert.equal(relay.state(),'closed');
 assert.throws(()=>relay.forTask(task),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 await assert.rejects(captured.loadPrevious({}),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 await assert.rejects(captured.retain({}),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 assert.throws(()=>relay.bind(store),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
});

test('relay closure withholds an in-flight continuation receipt',async()=>{
 const relay=createMemoryContextRelay();let complete;
 relay.bind({forTask(){return {loadPrevious:()=>new Promise(resolve=>{complete=resolve;}),retain:()=>null};}});
 const pending=relay.forTask({}).loadPrevious({});relay.close();complete('stale');
 await assert.rejects(pending,{code:'MEMORY_CONTEXT_UNAVAILABLE'});
});


test('mail uses its distinct journal factory and captured ports are fenced on close',async()=>{
 const relay=createMemoryContextRelay();let calls=0;
 relay.bind({forTask(){throw Error('memory factory must not handle mail');},forMail(task){assert.equal(task.clientId,null);calls++;return {loadPrevious:async()=> 'mail',retain:async()=> 'retained'};}});
 const ports=relay.forMail({clientId:null});assert.equal(await ports.loadPrevious({}),'mail');assert.equal(calls,1);
 relay.close();await assert.rejects(ports.retain({}),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
 assert.throws(()=>relay.forMail({}),{code:'MEMORY_CONTEXT_UNAVAILABLE'});
});
