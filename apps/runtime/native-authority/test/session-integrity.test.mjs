import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createNativeBoundSdkSessionStore} from '../session-client.mjs';
import {fixture,id} from './fixture.mjs';
const append=(entries,n=10,expectedOffset=0)=>({appendId:id(n),expectedOffset,entriesSha256:hash(entries),entries});
for(const [label,change] of [
 ['foreign binding',r=>{r.binding.runId=id(999);}],
 ['foreign observed key',r=>{r.key.projectKey='foreign';}],
 ['foreign append identity',r=>{r.appendId=id(999);}],
 ['foreign entry digest',r=>{r.entriesSha256='f'.repeat(64);}],
 ['uncommitted receipt',r=>{r.committed=false;}],
 ['impossible offset',r=>{r.offset=100001;}],
 ['inconsistent added count',r=>{r.added=0;}],
 ['coherent but false empty marker acknowledgement',r=>{r.added=0;r.offset=0;}],
 ['undeclared receipt field',r=>{r.nativeQualified=true;}],
])test('consistently rehashed retained receipt refuses '+label,async()=>{
 const f=fixture();await f.invoke('register');const call=append([{type:'system',marker:'retained'}]);await f.invoke('append',call);
 const row=f.state().batches.get(call.appendId);change(row.receipt);row.receipt_sha256=hash(row.receipt);const original=structuredClone(f.state().entries);
 await assert.rejects(f.invoke('append',call),e=>e.code==='SDK_SESSION_CORRUPT'||e.code==='SDK_SESSION_APPEND_CONFLICT');assert.deepEqual(f.state().entries,original);
});
test('original append receipt remains exact after later stream advancement',async()=>{const f=fixture();await f.invoke('register');const first=append([{type:'system',marker:'first'}]),receipt=await f.invoke('append',first);await f.invoke('append',append([{type:'system',marker:'second'}],11,1));assert.deepEqual(await f.invoke('append',first),receipt);assert.equal(f.state().entries.length,2);});
const port=()=>({async register(){return {registered:true};},async load(){return {entries:null,offset:0};},async append(){return {offset:1};},async listSubkeys(){return {subkeys:[]};}});
test('bound native mirror configuration accessor is refused without execution',()=>{const f=fixture();let effects=0;assert.throws(()=>createNativeBoundSdkSessionStore({get client(){effects++;return port();},binding:f.binding,sessionKey:f.key}));assert.equal(effects,0);});
test('bound native mirror configuration Proxy is refused before traps',()=>{const f=fixture();let effects=0;const configuration=new Proxy({client:port(),binding:f.binding,sessionKey:f.key},{get(t,n,r){effects++;return Reflect.get(t,n,r);},ownKeys(t){effects++;return Reflect.ownKeys(t);}});assert.throws(()=>createNativeBoundSdkSessionStore(configuration));assert.equal(effects,0);});
test('bound native mirror method accessor is refused without execution',()=>{const f=fixture(),client=port();let effects=0;Object.defineProperty(client,'load',{get(){effects++;return async()=>({entries:null,offset:0});}});assert.throws(()=>createNativeBoundSdkSessionStore({client,binding:f.binding,sessionKey:f.key}));assert.equal(effects,0);});
test('bound native mirror captures original two-argument methods and class receiver',async()=>{const f=fixture(),state=new WeakMap();let effects=0;class Port{constructor(){state.set(this,0);}async register(input,options){assert.ok(state.has(this));assert.equal(options.tag,'retained');return {registered:true};}async load(input,options){assert.ok(state.has(this));assert.ok(options.signal instanceof AbortSignal);state.set(this,state.get(this)+1);return {entries:null,offset:0};}async append(){return {offset:1};}async listSubkeys(){return {subkeys:[]};}}const client=new Port(),bound=createNativeBoundSdkSessionStore({client,binding:f.binding,sessionKey:f.key});Object.defineProperty(Port.prototype,'load',{get(){effects++;throw Error('Replacement');}});try{await bound.register({tag:'retained'});assert.equal(await bound.store.load(f.key),null);assert.equal(state.get(client),1);assert.equal(effects,0);}finally{bound.closeMirror();await bound.settleObservedCalls();}});
