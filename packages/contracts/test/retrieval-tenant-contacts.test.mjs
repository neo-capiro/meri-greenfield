import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createTenantContactsValidators} from '../retrieval-0.2/tenant-contacts-validation.mjs';

// Isolated compiler only; canonical registration belongs to the root owner.
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/tenant-contacts.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const compiled=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
function validateShape(name,value){const fn=compiled.get(name);assert.ok(fn(value),ajv.errorsText(fn.errors));return value;}
const {normalizeTenantContactsInput:normalize,assertTenantContactsResult:check}=createTenantContactsValidators({validateShape});
const NOW='2026-10-12T00:00:00.000Z',OLD='2026-10-11T00:00:00.000Z',CLIENT='12345678-1234-4234-8234-123456789abc';
const row=(extra={})=>({name:null,email:'synthetic@example.invalid',phone:null,title:null,organization:null,lastContact:null,messageCount:0,source:'synthetic',onProfile:false,...extra});
const note=(contacts,linked)=>linked?`${contacts.length} correspondent(s) found; ${contacts.filter(x=>!x.onProfile).length} not yet on the People tab. These come from synced mail and calendar — cite them as such. Propose only the missing ones via update_client_profile people[].`:`${contacts.length} correspondent(s) found from synced mail and calendar.`;
const page=(rows=[row()],linked=false)=>({tool:'find_contacts',generatedAt:NOW,clientId:linked?CLIENT:null,clientName:linked?'Synthetic client':null,matchedOn:{domain:null,query:linked?null:'synthetic',linkedClient:linked},contacts:rows,note:note(rows,linked)});
const refusal=()=>({tool:'find_contacts',generatedAt:NOW,contacts:[],note:'Pass a clientId, a domain, or a query — find_contacts will not dump the whole contact table.'});
const QUERY={query:'synthetic'}, LINKED={clientId:'Synthetic client'};

test('empty and null selectors normalize to explicit nullable values and refusal',()=>{
  for(const raw of [{},{clientId:null,domain:null,query:null},{clientId:' ',domain:'\n',query:'\t'}]){
    assert.deepEqual(normalize(raw),{clientId:null,domain:null,query:null,limit:25});assert.equal(check(refusal(),raw).contacts.length,0);
  }
});
test('explicit empty context only, model authority and lookup scopes rejected',()=>{
  for(const options of [null,[],{binding:{}},{subject:{}},{tenantId:'tenant'},{role:'admin'},{authorized:true}])assert.throws(()=>normalize(QUERY,options));
  for(const key of ['tenantId','actorId','clientName','scopes','authorized','cursor','page'])assert.throws(()=>normalize({...QUERY,[key]:'x'}));
});
test('lookup references remain selectors; domain lowercases but query preserves case',()=>{
  assert.deepEqual(normalize({clientId:'  Named Client  ',domain:' EXAMPLE.INVALID ',query:' MiXeD '}),{clientId:'Named Client',domain:'example.invalid',query:'MiXeD',limit:25});
});
test('text limits are UTF16 and second trim follows truncation for domain/query',()=>{
  assert.equal(normalize({clientId:'😀'.repeat(101)}).clientId.length,200);
  assert.equal(normalize({query:'😀'.repeat(101)}).query.length,200);
  assert.equal(normalize({domain:'A'.repeat(199)+'  x'}).domain,'a'.repeat(199));
  assert.equal(normalize({query:'A'.repeat(199)+'  x'}).query,'A'.repeat(199));
  assert.equal(normalize({clientId:'A'.repeat(199)+'  x'}).clientId,'A'.repeat(199)+' ');
  assert.equal(normalize({domain:'İ'.repeat(200)}).domain.length,400);
});
test('number/string limits clamp finitely while unrelated scalar types refuse',()=>{
  for(const [raw,expected] of [[undefined,25],[null,25],['bad',25],['Infinity',25],['',1],[' ',1],[-1,1],[0,1],[2.9,2],['3.9',3],[101,100]])assert.equal(normalize(raw===undefined?{}:{limit:raw}).limit,expected);
  for(const value of [false,[],{},Infinity,NaN])assert.throws(()=>normalize({limit:value}));
  for(const key of ['clientId','domain','query'])for(const value of [1,true,{},[]])assert.throws(()=>normalize({[key]:value}));
});
test('declared transport ceilings are refused without changing effective source caps',()=>{
  assert.throws(()=>normalize({query:'x'.repeat(16385)}));assert.throws(()=>normalize({limit:'0'.repeat(129)}));
  assert.equal(normalize({query:'x'.repeat(1000)}).query.length,200);
});
test('refusal and normal variants cannot substitute for one another',()=>{
  assert.throws(()=>check(page(),{}));assert.throws(()=>check(refusal(),QUERY));
  assert.throws(()=>check({...refusal(),matchedOn:{domain:null,query:null,linkedClient:false}},{}));
  assert.throws(()=>check({...refusal(),contacts:[row()]},{}));
});
test('normal unlinked page has exact query echo and null client projection',()=>{
  check(page(),QUERY);for(const alter of [p=>p.matchedOn.query='other',p=>p.clientId=CLIENT,p=>p.clientName='other',p=>p.matchedOn.linkedClient=true]){const p=page();alter(p);assert.throws(()=>check(p,QUERY));}
});
test('linked name selector admits resolved ID and nullable raced client name',()=>{
  check(page([row()],true),LINKED);const p=page([row()],true);p.clientName=null;check(p,LINKED);
  p.clientId=null;assert.throws(()=>check(p,LINKED));
});
test('unreturned derived domain is accepted only with selected client',()=>{
  const p=page([row()],true);p.matchedOn.domain='derived.example.invalid';check(p,LINKED);
  p.matchedOn.domain='wrong';assert.throws(()=>check(p,{...LINKED,domain:'explicit.example.invalid'}));
  p.matchedOn.domain='explicit.example.invalid';check(p,{...LINKED,domain:' EXPLICIT.EXAMPLE.INVALID '});
  const q=page();q.matchedOn.domain='invented';assert.throws(()=>check(q,QUERY));
});
test('linked-client OR permits unrelated email/domain without claiming source link',()=>{
  const p=page([row({email:null,name:null})],true);p.matchedOn.domain='requested.invalid';p.matchedOn.query='query';check(p,{...LINKED,domain:'requested.invalid',query:'query'});
});
test('SQL NULL cannot match sole domain or query predicates',()=>{
  const p=page([row({email:null,name:null})]);assert.throws(()=>check(p,QUERY));
  const d=page([row({email:null,name:'synthetic'})]);d.matchedOn={domain:'example.invalid',query:null,linkedClient:false};assert.throws(()=>check(d,{domain:'example.invalid'}));
  const q=page([row({email:null,name:'synthetic'})]);check(q,QUERY);
});
test('nonstandard address and stored scalars are preserved without invented formats',()=>{
  check(page([row({email:'not-an-address',phone:'ext? 3',title:'',organization:'',source:''})]),QUERY);
});
test('every contact has exactly the nine projected fields',()=>{
  const p=page();for(const key of Object.keys(p.contacts[0])){const q=structuredClone(p);delete q.contacts[0][key];assert.throws(()=>check(q,QUERY),key);}
  for(const key of ['id','tenantId','clientId','profileId','authorized','complete']){const q=page();q.contacts[0][key]='x';assert.throws(()=>check(q,QUERY),key);}
});
test('all stored contact and history scalar types are closed',()=>{
  for(const key of ['name','email','phone','title','organization','source']){const p=page();p.contacts[0][key]={};assert.throws(()=>check(p,QUERY));}
  for(const value of [-1,1.5,9007199254740992,'1']){const p=page();p.contacts[0].messageCount=value;assert.throws(()=>check(p,QUERY));}
  const p=page();p.contacts[0].source=null;assert.throws(()=>check(p,QUERY));
});
test('history only exists when trimmed stored email supplies lookup identity',()=>{
  for(const email of [null,'','  ']){
    const p=page([row({email,name:'synthetic'})]);check(p,QUERY);
    p.contacts[0].messageCount=1;assert.throws(()=>check(p,QUERY));
    p.contacts[0].messageCount=0;p.contacts[0].lastContact=NOW;assert.throws(()=>check(p,QUERY));
  }
});
test('message count does not invent available mail timestamps or latest meeting truth',()=>{
  check(page([row({messageCount:3,lastContact:null})]),QUERY);
  check(page([row({messageCount:0,lastContact:NOW})]),QUERY);
});
test('returned last contact descends with nulls last and equal timestamps allowed',()=>{
  check(page([row({lastContact:NOW}),row({lastContact:NOW}),row({lastContact:OLD}),row()]),QUERY);
  for(const rows of [[row(),row({lastContact:NOW})],[row({lastContact:OLD}),row({lastContact:NOW})]])assert.throws(()=>check(page(rows),QUERY));
});
test('source Date ISO serializations refuse impossible dates and offset substitutions',()=>{
  for(const date of ['2026-02-30T00:00:00.000Z','2026-10-12T00:00:00Z','2026-10-12T01:00:00.000+01:00','2016-12-31T23:59:60Z']){
    const p=page();p.generatedAt=date;assert.throws(()=>check(p,QUERY));
    p.generatedAt=NOW;p.contacts[0].lastContact=date;assert.throws(()=>check(p,QUERY));
  }
});
test('duplicate name/email projections are legitimate since row IDs are omitted',()=>check(page([row(),row()]),QUERY));
test('returned window never exceeds requested or absolute cap',()=>{
  assert.throws(()=>check(page([row(),row()]),{...QUERY,limit:1}));
  check(page(Array.from({length:100},()=>row())),{...QUERY,limit:100});
  assert.throws(()=>check(page(Array.from({length:101},()=>row())),{...QUERY,limit:100}));
});
test('profile assertion requires linked client and a nonblank name or email',()=>{
  assert.throws(()=>check(page([row({onProfile:true})]),QUERY));
  check(page([row({onProfile:true})],true),LINKED);
  check(page([row({email:null,name:'Name',onProfile:true})],true),LINKED);
  assert.throws(()=>check(page([row({name:' ',email:' ',onProfile:true})],true),LINKED));
});
test('notes count only returned rows and missing-profile rows including empty linked page',()=>{
  check(page([],true),LINKED);check(page([],false),QUERY);
  check(page([row({onProfile:true}),row()],true),LINKED);
  for(const p of [page(),page([],true)]){p.note='complete and approved';assert.throws(()=>check(p,p.clientId?LINKED:QUERY));}
});
test('whole output remains closed and cannot grant profile mutation or coverage',()=>{
  for(const key of ['total','cursor','complete','evidenceOfAbsence','authorized','profileUpdateApproved']){const p=page();p[key]=true;assert.throws(()=>check(p,QUERY));}
  const p=page();p.matchedOn.clientOnly=true;assert.throws(()=>check(p,QUERY));
});
test('direct raw/options/result admission never invokes getters, proxies or coercion',()=>{
  let effects=0;const getter={get query(){effects++;return 'synthetic';}};
  const proxy=new Proxy({}, {ownKeys(){effects++;throw Error('side effect');},get(){effects++;throw Error('side effect');}});
  for(const input of [getter,proxy,Object.create({query:'synthetic'}),{query:{toString(){effects++;return 'synthetic';}}}])assert.throws(()=>normalize(input));
  assert.throws(()=>normalize(QUERY,proxy));assert.throws(()=>check(proxy,QUERY));
  const p=page();Object.defineProperty(p.contacts[0],'email',{get(){effects++;return 'x';},enumerable:true});assert.throws(()=>check(p,QUERY));assert.equal(effects,0);
});
test('symbol, hidden and array root data refuse; inputs are not mutated',()=>{
  for(const input of [[],null,{[Symbol('s')]:1},Object.defineProperty({},'query',{value:'x',enumerable:false})])assert.throws(()=>normalize(input));
  const input={query:' synthetic ',limit:'2'},before=structuredClone(input);assert.deepEqual(normalize(input),{clientId:null,domain:null,query:'synthetic',limit:2});assert.deepEqual(input,before);
  const p=page(),prior=structuredClone(p);assert.equal(check(p,QUERY),p);assert.deepEqual(p,prior);
});
