import test from 'node:test';
import assert from 'node:assert/strict';
import {createBoundBrowserModelPort,BROWSER_MODEL_MAX_BYTES} from '../browser-model-port.mjs';
import {binding,enabledPolicy} from '../../browser/test/fixtures.mjs';

const policy=enabledPolicy(),request={binding,requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}};
const descriptor={name:'browser_snapshot',description:'Snapshot',inputSchema:{type:'object',properties:{}}};
const result={content:[{type:'text',text:'filtered snapshot'}]};
const fixture=(overrides={})=>createBoundBrowserModelPort({binding,policy,tools:async()=>[descriptor],call:async()=>result,...overrides});
const refused=promise=>assert.rejects(promise,error=>error.code==='BROWSER_CALL_REFUSED'&&error.message==='BROWSER_CALL_REFUSED');

test('disabled browser policy cannot construct a model tool boundary',()=>{
 assert.throws(()=>fixture({policy:{enabled:false}}),/BROWSER_CALL_REFUSED/);
});

test('host model port copies bounded tools and filtered text without exposing its context',async()=>{
 const port=fixture();assert.deepEqual(await port.tools({binding}),{tools:[descriptor]});
 const received=await port.call(request);assert.deepEqual(received,result);assert.throws(()=>{received.content[0].text='caller mutation';},TypeError);
 assert.equal((await port.call(request)).content[0].text,'filtered snapshot');port.close();
});

test('foreign, malformed, extra-key, unlisted and oversized calls cannot invoke the session',async()=>{
 let calls=0;const port=fixture({call:async()=>{calls++;return result;}});
 for(const value of [
  {...request,binding:{...binding,writerFence:2}}, {...request,requestId:'not-an-id'},
  {...request,tool:'browser_evaluate'}, {...request,args:[]}, {...request,args:null},
  {...request,args:{text:'x'.repeat(BROWSER_MODEL_MAX_BYTES)}}, {...request,profile:'/private/profile'},
  {...request,signal:{}},
 ])await refused(port.call(value));
 await refused(port.tools({binding:{...binding,attemptId:'00000015-b0a1-4000-8000-000000000000'}}));
 assert.equal(calls,0);port.close();
});

test('duplicate or policy-external tool schemas and oversized listings are refused',async()=>{
 for(const tools of [[descriptor,descriptor],[{...descriptor,name:'browser_evaluate'}],[{...descriptor,description:'x'.repeat(BROWSER_MODEL_MAX_BYTES)}]]){
  const port=fixture({tools:async()=>tools});await refused(port.tools({binding}));port.close();
 }
});

test('private errors, image data, metadata and oversized call results never cross model boundary',async()=>{
 for(const value of [
  {content:[{type:'image',data:'PRIVATE_IMAGE',mimeType:'image/png'}]},
  {content:[{type:'text',text:'safe'}],privateProfile:'/private/profile'},
  {content:[{type:'text',text:'safe',privateKey:'SECRET'}]}, {content:[]},
  {content:[{type:'text',text:'x'.repeat(BROWSER_MODEL_MAX_BYTES)}]},
 ]){const port=fixture({call:async()=>value});await refused(port.call(request));port.close();}
 const port=fixture({call:async()=>{throw Error('CONFIDENTIAL_NATIVE_ERROR');},tools:async()=>{throw Error('PRIVATE_TOOLS');}});
 await refused(port.call(request));await refused(port.tools({binding}));port.close();
});

test('request cancellation and owner close abort work and refuse late success',async()=>{
 for(const close of [false,true]){
  let started,complete,activeSignal;const entered=new Promise(resolve=>{started=resolve;});
  const port=fixture({call:async({signal})=>{activeSignal=signal;started();return new Promise(resolve=>{complete=resolve;});}});
  const controller=new AbortController(),pending=port.call({...request,signal:controller.signal});
  const rejection=refused(pending);await entered;close?port.close():controller.abort();await rejection;
  assert.equal(activeSignal.aborted,true);complete(result);await new Promise(resolve=>setImmediate(resolve));
  if(close)await refused(port.tools({binding}));port.close();
 }
});

test('tools listing cancellation reaches the borrowed port and refuses late schemas',async()=>{
 let started,complete,activeSignal;const entered=new Promise(resolve=>{started=resolve;});
 const port=fixture({tools:async({signal})=>{activeSignal=signal;started();return new Promise(resolve=>{complete=resolve;});}});
 const pending=refused(port.tools({binding}));await entered;port.close();await pending;
 assert.equal(activeSignal.aborted,true);complete([descriptor]);await new Promise(resolve=>setImmediate(resolve));
});

test('operation result after either the run expiry or selected policy budget is refused',async()=>{
 for(const expiry of [1001,1000000]){
  let now=1000;const port=fixture({now:()=>now,deadlineMs:expiry,call:async()=>{now=expiry===1001?expiry:1000+policy.timeouts.actionMs+policy.timeouts.navigationMs;return result;}});
  await refused(port.call(request));port.close();
 }
});
