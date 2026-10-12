import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
const root=process.env.MERI_DISTRICT_REVIEW_SOURCE_ROOT;
const source=root?pathToFileURL(root.replace(/\/$/,'')+'/packages/contracts/'):new URL('../',import.meta.url);
const {createDistrictNexusValidators}=await import(new URL('retrieval-0.2/district-nexus-validation.mjs',source));
const load=url=>JSON.parse(readFileSync(url));
const schema=load(new URL('retrieval-0.2/district-nexus.schema.json',source));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const s of [load(new URL('../meri.schema.json',import.meta.url)),load(new URL('../retrieval-0.2/common.schema.json',import.meta.url)),schema])ajv.addSchema(s);
const shapes=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const family=createDistrictNexusValidators({assertSubject,canonicalSha256,validateShape(n,v){assert.equal(shapes.get(n)(v),true,`Invalid ${n}`);return v;}});
const normalize=family.normalizeDistrictNexusInput,check=family.assertDistrictNexusReadResult;
const C='get_district_nexus_context',D='get_district_nexus_changes';
const T='2026-09-01T12:00:00.000Z',prior='2026-09-01T11:00:00.000Z';
const uuid=n=>`${String(n).padStart(8,'0')}-4567-4abc-8def-123456789012`;
function context(){return {binding:{tenantId:'tenant-review',actorId:'actor-review',conversationId:uuid(1),runId:uuid(2),attemptId:uuid(3),workerId:uuid(4),writerFence:4},subject:{kind:'client',entityType:'client',entityIds:['client-review'],tenantId:'tenant-review',actorId:'actor-review',authorizationDecisionId:uuid(5),policyRevision:'policy-review',rosterVersionId:null,scopes:[{kind:'client',tenantId:'tenant-review',resourceId:'client-review',policyRevision:'policy-review'}]}};}
const input=()=>({clientId:'client-review',state:'CA',district:'03'});
// New synthetic projection examples: never copied/imported/executed legacy source.
function fact(){return {id:'fact-review',section:'economic',label:'Synthetic district observation',value:0,unit:null,amountStage:null,basis:'public_context',source:{type:'synthetic',label:'Synthetic source',recordId:null,url:null},asOf:{date:null,fiscalYear:null,sourceYear:null},geography:{state:'CA',district:'03',scope:'district',basis:null,boundaryCongress:null},freshness:{lastSyncedAt:null,stale:false,unavailable:false},coverage:'unknown',caveats:[]};}
const gap=()=>({section:'economic',reason:'Synthetic missing source',source:null});
function page(){return {...context(),data:{available:true,...input(),clientName:'Synthetic client',generatedAt:T,facts:[fact()],gaps:[],truncated:false}};}
const change=(id='item-a',time=T)=>({changeKind:'synthetic_update',source:'custom_source',sourceRecordId:id,observedAt:time,effectiveAt:null,severity:'custom'});
function changes(){return {...context(),data:{available:true,...input(),generatedAt:T,changes:[change()],gaps:[],truncated:false}};}
const disabled=()=>({...context(),data:{available:false,reason:'feature_disabled'}});
const reject=(op,p,raw=input(),ctx=context())=>assert.throws(()=>check(op,p,raw,ctx));
function mutants(op,make,list,raw=input()){for(const m of list){const p=make();m(p);reject(op,p,raw);}}

test('independent context and changes nonempty projections plus disabled variants admit',()=>{
  for(const [op,p] of [[C,page()],[D,changes()],[C,disabled()],[D,disabled()]])assert.equal(check(op,p,input(),context()),p);
});
test('explicit client selectors trim and geography uppercases without implicit conversation fallback',()=>{
  assert.deepEqual(normalize(C,{clientId:' client-review ',state:' ca ',district:' 03 '},context()),input());
  assert.deepEqual(normalize(D,input(),context()),{...input(),since:null});
  for(const value of [{state:'CA',district:'03'},{...input(),clientId:'other'},{...input(),clientId:' '},{...input(),state:6},{...input(),district:3}])assert.throws(()=>normalize(C,value,context()));
});
test('geography syntax does not fabricate a recognized state resolver or normalize numeric districts',()=>{
  assert.equal(normalize(C,{...input(),state:'zz',district:'00'},context()).state,'ZZ');
  for(const value of [{...input(),state:'CAL'},{...input(),state:'9A'},{...input(),district:'3'},{...input(),district:'٠٣'},{...input(),district:'100'}])assert.throws(()=>normalize(C,value,context()));
});
test('input/output variants remain closed and operation selection is explicit',()=>{
  for(const extra of [{tenantId:'forged'},{actorId:'forged'},{authorized:true},{flags:{district_nexus_v2:true}},{cursor:'next'},{limit:1}])assert.throws(()=>normalize(D,{...input(),...extra},context()));
  assert.throws(()=>normalize(C,{...input(),since:T},context()));
  assert.throws(()=>normalize('get_district_nexus_mutate',input(),context()));
  mutants(C,page,[p=>p.authorized=true,p=>p.data.complete=true,p=>p.data.total=1,p=>p.data.sourceHealth=[],p=>p.data.currentRole='admin']);
});
test('since normalizes offset instants, admits inclusive same time and rejects malformed values',()=>{
  const raw={...input(),since:'2026-09-01T13:00:00+01:00'};
  assert.equal(normalize(D,raw,context()).since,T);check(D,changes(),raw,context());
  for(const since of [null,12,'','September 1 2026','2026-09-01','2026-09-01T99:00:00Z','2016-12-31T23:59:60Z'])assert.throws(()=>normalize(D,{...input(),since},context()));
});
test('subject is exactly one client and current actor/tenant correlation cannot be bypassed',()=>{
  for(const mutate of [c=>c.subject.actorId='foreign',c=>c.subject.tenantId='foreign',c=>c.subject.entityIds=['foreign'],c=>c.subject.entityIds.push('other'),c=>c.subject.kind='public',c=>c.subject.entityType='research-portfolio',c=>c.role='admin']){const c=context();mutate(c);assert.throws(()=>normalize(C,input(),c));}
});
test('each binding field and returned subject decision lineage must remain exact even disabled',()=>{
  for(const make of [page,disabled])for(const k of Object.keys(context().binding)){const p=make();p.binding[k]=k==='writerFence'?8:k==='tenantId'||k==='actorId'?'other':uuid(9);reject(C,p);}
  mutants(C,page,[p=>p.subject.authorizationDecisionId=uuid(9),p=>p.subject.policyRevision='other',p=>p.subject.entityIds=['other']]);
});
test('scope resource remains trusted-owner metadata while returned client/geography must match',()=>{
  for(const op of [C,D])mutants(op,op===C?page:changes,[p=>p.data.clientId='other',p=>p.data.state='NY',p=>p.data.district='04']);
  const c=context();c.subject.scopes[0].resourceId='other';assert.deepEqual(normalize(C,input(),c),input());
  // Shared subject shape is not an authorization engine. Exact returned lineage still binds.
  reject(C,page(),input(),c);
  for(const field of ['tenantId','policyRevision']){const bad=context();bad.subject.scopes[0][field]='other';assert.throws(()=>normalize(C,input(),bad));}
});
test('disabled schema cannot smuggle availability, source data or authorization evidence',()=>{
  for(const op of [C,D])mutants(op,disabled,[p=>p.data.available=true,p=>p.data.reason='source_error',p=>p.data.clientId='client-review',p=>p.data.facts=[],p=>p.data.authorized=true]);
});
test('null, zero, negative and string facts are distinct values and required nullable fields remain present',()=>{
  for(const value of [null,0,-5,'unknown']){const p=page();p.data.facts[0].value=value;check(C,p,input(),context());assert.equal(p.data.facts[0].value,value);}
  for(const key of ['unit','amountStage'])mutants(C,page,[p=>delete p.data.facts[0][key]]);
  mutants(C,page,[p=>p.data.facts[0].value=true,p=>p.data.facts[0].value=NaN,p=>p.data.facts[0].value=Infinity]);
});
test('all declared sections, amount stages, fact bases and coverage variants stay source claims',()=>{
  for(const section of ['footprint','economic','opportunities','representation','cpf_cds','changes']){const p=page();p.data.facts[0].section=section;check(C,p,input(),context());}
  for(const stage of [null,'requested','enacted','obligated','awarded','forecast']){const p=page();p.data.facts[0].amountStage=stage;check(C,p,input(),context());}
  for(const basis of ['verified_client_nexus','public_context'])for(const coverage of ['complete','partial','unknown']){const p=page();Object.assign(p.data.facts[0],{basis,coverage});check(C,p,input(),context());}
  mutants(C,page,[p=>p.data.facts[0].amountStage='paid',p=>p.data.facts[0].basis='authorized',p=>p.data.facts[0].coverage='proved_complete']);
});
test('reported opaque as-of and freshness strings are not converted into verified timestamps',()=>{
  const p=page();p.data.facts[0].asOf={date:'source year label',fiscalYear:2027,sourceYear:2025};p.data.facts[0].freshness={lastSyncedAt:'source-labelled',stale:true,unavailable:true};p.data.facts[0].caveats=['Unverified synthetic source'];check(C,p,input(),context());
  mutants(C,page,[p=>p.data.facts[0].asOf.sourceYear=1.5,p=>p.data.facts[0].asOf.fiscalYear=Number.MAX_SAFE_INTEGER+1,p=>p.data.facts[0].freshness.stale='true']);
});
test('fact geography is scoped but statewide/national nullable district is preserved',()=>{
  for(const scope of ['statewide','national']){const p=page();p.data.facts[0].geography.scope=scope;p.data.facts[0].geography.district=null;check(C,p,input(),context());}
  mutants(C,page,[p=>p.data.facts[0].geography.state='NY',p=>p.data.facts[0].geography.district='04',p=>p.data.facts[0].geography.district=null,p=>p.data.facts[0].geography.scope='global']);
});
test('source reference strings and non-URL labels remain opaque without invented permissions',()=>{
  const p=page();Object.assign(p.data.facts[0].source,{type:'new_source',recordId:'opaque:record',url:'source reports missing URL'});check(C,p,input(),context());
  mutants(C,page,[p=>p.data.facts[0].source.allowed=true,p=>p.data.facts[0].source.recordId=1,p=>delete p.data.facts[0].source.url]);
});
test('forty facts are bounded and context forty alone does not assert truncation',()=>{
  const p=page();p.data.facts=Array.from({length:40},()=>fact());check(C,p,input(),context());p.data.truncated=true;check(C,p,input(),context());p.data.facts.push(fact());reject(C,p);
});
test('twenty-nine gaps with false truncation preserve exact-thirty original-gap underreport caveat',()=>{
  const p=page();p.data.gaps=Array.from({length:29},gap);check(C,p,input(),context());
  p.data.facts=Array.from({length:40},fact);p.data.gaps.push({section:'footprint',reason:'Synthetic fact overflow',source:null});p.data.truncated=true;check(C,p,input(),context());
  p.data.truncated=false;reject(C,p);p.data.truncated=true;p.data.facts.pop();reject(C,p);
});
test('context gaps can remain without facts; no-record/complete conclusions are invented',()=>{
  const p=page();p.data.facts=[];p.data.gaps=[gap()];check(C,p,input(),context());p.data.truncated=true;check(C,p,input(),context());
  p.data.gaps=Array.from({length:31},gap);reject(C,p);
});
test('observed descending order and inclusive lower bound allow ties but reject stale/out-of-order',()=>{
  const p=changes();p.data.changes=[change('a'),change('b'),change('c',prior)];check(D,p,{...input(),since:prior},context());
  reject(D,p,{...input(),since:T});p.data.changes.reverse();reject(D,p);
});
test('exactly twenty changes reports truncation even without proof of a twenty-first',()=>{
  const p=changes();p.data.changes=Array.from({length:20},(_,i)=>change(String(i)));p.data.truncated=true;check(D,p,input(),context());p.data.truncated=false;reject(D,p);p.data.truncated=true;p.data.changes.pop();reject(D,p);p.data.changes.push(change('x'),change('y'));reject(D,p);
});
test('database change strings stay extensible with character rather than UTF16 storage limits',()=>{
  const p=changes();Object.assign(p.data.changes[0],{changeKind:'😀'.repeat(48),source:'😀'.repeat(32),severity:'😀'.repeat(16)});check(D,p,input(),context());p.data.changes[0].severity+='x';reject(D,p);
});
test('effective date may be null or after observation without manufacturing an observation cutoff',()=>{
  const p=changes();p.data.changes[0].effectiveAt='2027-01-01T00:00:00Z';check(D,p,input(),context());p.data.changes[0].effectiveAt=null;check(D,p,input(),context());
  mutants(D,changes,[p=>delete p.data.changes[0].effectiveAt,p=>p.data.changes[0].observedAt='bad',p=>p.data.changes[0].observedAt='2016-12-31T23:59:60Z',p=>p.data.changes[0].effectiveAt='2016-12-31T23:59:60Z']);
});
test('ledger failure remains available empty with gap and cannot also supply successful changes',()=>{
  const p=changes();p.data.changes=[];p.data.gaps=[{section:'changes',reason:'Change ledger unavailable',source:'district_nexus_change'}];check(D,p,input(),context());p.data.changes=[change()];reject(D,p);
});
test('empty available changes plus other gaps preserve uncertainty and thirty-gap cap',()=>{
  const p=changes();p.data.changes=[];p.data.gaps=Array.from({length:30},()=>({section:'changes',reason:'Synthetic uncertain rail',source:null}));check(D,p,input(),context());p.data.gaps.push(p.data.gaps[0]);reject(D,p);
  mutants(D,changes,[p=>p.data.gaps=[gap()],p=>p.data.total=1,p=>p.data.nextCursor='x',p=>p.data.changes[0].observationKind='baseline']);
});
test('timestamps in generated result require finite instants and JSON shape',()=>{
  for(const op of [C,D])mutants(op,op===C?page:changes,[p=>p.data.generatedAt='bad',p=>p.data.generatedAt='2016-12-31T23:59:60Z',p=>p.data.generatedAt=new Date(T)]);
});
test('hostile inputs and context accessors or proxies cause no caller-controlled effects',()=>{
  let effects=0;const getter={...input()};Object.defineProperty(getter,'clientId',{enumerable:true,get(){effects++;return 'client-review';}});
  const proxy=new Proxy(input(),{get(){effects++;throw Error('effect');},ownKeys(){effects++;throw Error('effect');},getOwnPropertyDescriptor(){effects++;throw Error('effect');}});
  for(const raw of [getter,proxy,Object.assign(Object.create({inherited:true}),input()),{...input(),[Symbol('bad')]:1}])assert.throws(()=>normalize(C,raw,context()));
  const c=context();Object.defineProperty(c,'subject',{enumerable:true,get(){effects++;return context().subject;}});assert.throws(()=>normalize(C,input(),c));assert.equal(effects,0);
});
test('returned result accessors and proxies never run while nested extra keys refuse',()=>{
  let effects=0;const p=page();Object.defineProperty(p.data.facts[0],'value',{enumerable:true,get(){effects++;return 0;}});reject(C,p);
  reject(C,new Proxy(page(),{get(){effects++;throw Error('effect');},ownKeys(){effects++;throw Error('effect');}}));assert.equal(effects,0);
  mutants(C,page,[p=>p.data.facts[0].geography.authorized=true,p=>p.data.facts[0].asOf.verified=true,p=>p.data.facts[0].freshness.current=true]);
});
test('normalization returns a detached selection without rewriting original payload',()=>{
  const raw={clientId:' client-review ',state:' ca ',district:' 03 '};const prior=structuredClone(raw),n=normalize(C,raw,context());assert.deepEqual(raw,prior);n.clientId='other';assert.deepEqual(raw,prior);
});
