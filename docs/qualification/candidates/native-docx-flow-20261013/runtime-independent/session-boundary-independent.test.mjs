import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=process.env.MERI_REVIEW_SOURCE_ROOT;
assert.ok(root,'Exact source root required');
const {createNativeBoundSdkSessionStore}=await import(pathToFileURL(resolve(root,'apps/runtime/native-authority/session-client.mjs')).href);
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const key={projectKey:'native.observed:key',sessionId:id(5)};
const client=()=>({async register(){return {registered:true};},async load(){return {entries:null,offset:0};},async append(){return {offset:1};},async listSubkeys(){return {subkeys:[]};}});
test('bound native mirror admits outer configuration without executing getter',()=>{
 let effects=0;
 assert.throws(()=>createNativeBoundSdkSessionStore({get client(){effects++;return client();},binding,sessionKey:key}));
 assert.equal(effects,0);
});
test('bound native mirror rejects Proxy configuration before traps',()=>{
 let traps=0;
 const configuration=new Proxy({client:client(),binding,sessionKey:key},{get(target,name,receiver){traps++;return Reflect.get(target,name,receiver);},ownKeys(target){traps++;return Reflect.ownKeys(target);}});
 assert.throws(()=>createNativeBoundSdkSessionStore(configuration));assert.equal(traps,0);
});
test('bound native mirror rejects borrowed method accessor without executing it',()=>{
 let effects=0;const port=client();Object.defineProperty(port,'load',{get(){effects++;return async()=>({entries:null,offset:0});}});
 assert.throws(()=>createNativeBoundSdkSessionStore({client:port,binding,sessionKey:key}));assert.equal(effects,0);
});
test('bound native mirror preserves admitted client methods and original receiver',async()=>{
 const state=new WeakMap();let effects=0;
 class Port{
  constructor(){state.set(this,0);}
  async register(){assert.ok(state.has(this));return {registered:true};}
  async load(){assert.ok(state.has(this));state.set(this,state.get(this)+1);return {entries:null,offset:0};}
  async append(){assert.ok(state.has(this));return {offset:1};}
  async listSubkeys(){assert.ok(state.has(this));return {subkeys:[]};}
 }
 const port=new Port(),bound=createNativeBoundSdkSessionStore({client:port,binding,sessionKey:key});
 Object.defineProperty(Port.prototype,'load',{get(){effects++;throw Error('Replacement getter');}});
 try{assert.equal(await bound.store.load(key),null);assert.equal(state.get(port),1);assert.equal(effects,0);}
 finally{bound.closeMirror();await bound.settleObservedCalls();}
});
