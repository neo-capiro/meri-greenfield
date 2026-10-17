/** Offline registration controls over real canonical modules; no source execution or native calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertFamilyHandlerSet,familyOperations} from './registration.mjs';
import {createGeneralReadFamilyHandlers,GENERAL_READ_ADAPTER_FAMILIES} from './integration.mjs';
import {CASES,familyCase} from './test/family-cases.mjs';
import {storedCase as fundingCase,ids as fundingIds} from '../sources/funding-opportunities/test/fixture.mjs';
import {storedCase as programCase} from '../sources/program-elements/test/fixture.mjs';
const rows=family=>familyOperations(family).map(operation=>({operation,async execute(){throw Error('Synthetic registration only');}}));
const refuses=work=>assert.throws(work,error=>error.message==='GATEWAY_CONFIGURATION');

test('all existing canonical family constructors satisfy the exact set before source measurement',async()=>{
 const covered=new Set();
 // Mail and program-elements have no shared family case; mail constructs passively and must never call out.
 const passiveMail=()=>({now:()=>1800000000000,wire:[],state:{},transport:{endpoints:Object.fromEntries(familyOperations('mail').map(op=>[op.id,`https://mail.example.invalid/${op.id}`])),
  getCredentials:()=>{throw Error('UNEXPECTED_CREDENTIAL');},fetchImpl:()=>{throw Error('UNEXPECTED_FETCH');}}});
 for(const [family,id] of [...CASES,['funding-opportunities',fundingIds[0]],['program-elements','search_program_elements'],['mail',familyOperations('mail')[0].id]]){
  if(covered.has(family))continue;covered.add(family);
  const scene=family==='funding-opportunities'?fundingCase(id):family==='program-elements'?programCase(id):family==='mail'?passiveMail():familyCase(family,id);
  const result=await createGeneralReadFamilyHandlers({families:{[family]:scene.transport},now:scene.now,newId:randomUUID});
  assert.deepEqual([...result.keys()].sort(),familyOperations(family).map(operation=>`${operation.id}@${operation.version}`).sort());
  if(family==='funding-opportunities'){
   assert.deepEqual([...result.keys()].sort(),fundingIds.map(id=>`${id}@0.2.0`).sort());
   for(const handler of result.values()){
    assert.equal(handler.sourceSha256,canonicalSha256(handler.sourceFiles));
    for(const label of ['apps/gateway/sources/funding-opportunities/handler.mjs','apps/gateway/sources/funding-opportunities/request-context.mjs',
     'packages/contracts/native-read-observation-0.2/schema.json','packages/contracts/native-read-observation-0.2/validate.mjs']){
     const matches=handler.sourceFiles.filter(row=>row.label===label);assert.equal(matches.length,1);assert.match(matches[0].sha256,/^[a-f0-9]{64}$/u);
    }
   }
   assert.equal((scene.state.credentialOwnerCalls??[]).length,0);
  }
  assert.equal(scene.wire.length,0);
 }
 assert.deepEqual([...covered].sort(),[...GENERAL_READ_ADAPTER_FAMILIES].sort());
});

test('canonical handler order may differ without manufacturing a duplicate operation',()=>{
 const expected=rows('public-reports').reverse();assert.equal(assertFamilyHandlerSet('public-reports',expected),expected);
});

test('incomplete, extra, duplicate, foreign and wrong-version family sets refuse',()=>{
 for(const mutate of [values=>values.pop(),values=>values.push(values[0]),values=>values[1]=values[0],values=>values[0].operation={id:'read_bill_text',version:'0.2.0'},values=>values[0].operation={...values[0].operation,version:'0.1.0'}]){
  const values=rows('public-reports');mutate(values);refuses(()=>assertFamilyHandlerSet('public-reports',values));
 }
 refuses(()=>assertFamilyHandlerSet('unallocated-family',[]));
});

test('invalid callable and authority-bearing operation fields cannot enter a measured handler set',()=>{
 for(const execute of [undefined,{},new Proxy(()=>{},{})]){const values=rows('public-reports');values[0].execute=execute;refuses(()=>assertFamilyHandlerSet('public-reports',values));}
 const values=rows('public-reports');values[0].operation={...values[0].operation,tenantId:'model-selected'};refuses(()=>assertFamilyHandlerSet('public-reports',values));
});

test('handler accessors and proxies are refused without invoking user code',()=>{
 let effects=0;const values=rows('public-reports');values[0]={operation:values[0].operation,get execute(){effects++;return()=>{};}};
 refuses(()=>assertFamilyHandlerSet('public-reports',values));assert.equal(effects,0);
 const proxy=rows('public-reports');proxy[0]=new Proxy(proxy[0],{ownKeys(){effects++;return[];}});refuses(()=>assertFamilyHandlerSet('public-reports',proxy));assert.equal(effects,0);
});
