import test from 'node:test';
import assert from 'node:assert/strict';
import {capiroDataCase} from './fixture.mjs';
import {RETAINED_CAPIRO_PRIVATE_RELATIONS} from '../../../../../packages/contracts/retrieval-0.2/capiro-data-validation.mjs';
const names=[...RETAINED_CAPIRO_PRIVATE_RELATIONS,'client_meetings'];
const page=(scene,names)=>{scene.page.relations=names.map(name=>({...structuredClone(scene.page.relations[0]),name}));};

for(const version of ['0.2.0','0.3.0','0.4.0'])test(`${version}: default private description survives Core meeting expansion with exact retained bounds`,async()=>{
 const f=capiroDataCase('describe_capiro_data',{version,request:{source:'client_records'}});page(f,names);
 const out=JSON.parse(await f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()));
 assert.deepEqual(out.result.relations.map(r=>r.name),version==='0.4.0'?names:RETAINED_CAPIRO_PRIVATE_RELATIONS);
 assert.deepEqual(out.result.scope,f.page.scope);assert.deepEqual(f.wire[0].body,{source:'client_records'});
});

test('private successor reads old fourteen-relation Core and explicit new meeting selection without fallback',async()=>{
 for(const selected of [undefined,['client_meetings']]){
  const request={source:'client_records',...(selected?{relations:selected}:{})};
  const f=capiroDataCase('describe_capiro_data',{version:'0.4.0',request});page(f,selected??RETAINED_CAPIRO_PRIVATE_RELATIONS);
  const out=JSON.parse(await f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()));
  assert.deepEqual(out.result,f.page);assert.deepEqual(f.wire[0].body,request);
 }
});

test('private successor refuses a static credential or injected source and preserves unavailable errors',async()=>{
 const f=capiroDataCase('describe_capiro_data',{version:'0.4.0',request:{source:'client_records'}});
 await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 let reads=0;await assert.rejects(f.handler({getCredentials:undefined,readSource:async()=>{reads++;return f.page;}})(f.call()),{message:'ACCESS_DENIED'});assert.equal(reads,0);
 f.state.page={version:'0.2.0',generatedAt:f.page.generatedAt,ok:false,error:{code:'SOURCE_UNAVAILABLE',message:'Unavailable'}};
 const out=JSON.parse(await f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()));
 assert.deepEqual(out.result,f.state.page);
});
