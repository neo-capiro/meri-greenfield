import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createFacilityRepresentationValidators} from '../retrieval-0.2/facility-representation-validation.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../validate.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/facility-representation.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const path of ['../meri.schema.json','../retrieval-0.2/common.schema.json'])ajv.addSchema(JSON.parse(readFileSync(new URL(path,import.meta.url))));
ajv.addSchema(schema);const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createFacilityRepresentationValidators({assertSubject,canonicalSha256,validateShape(name,value){const check=checks.get(name);assert.ok(check?.(value),ajv.errorsText(check?.errors));return value;}});
const U='11111111-1111-1111-1111-111111111111',stamp='2026-10-12T00:00:00.000Z';
function context(){return{binding:{tenantId:'synthetic',actorId:'reader',conversationId:U,runId:U,attemptId:U,workerId:U,writerFence:1},
  subject:{tenantId:'synthetic',actorId:'reader',kind:'client',entityType:'client',entityIds:['client'],rosterVersionId:null,
    policyRevision:'policy',authorizationDecisionId:U,scopes:[{tenantId:'synthetic',kind:'client',resourceId:'client',policyRevision:'policy'}]}};}
const row=()=>({facilityId:U,facilityName:'Synthetic',city:null,state:'CA',representation:{federal:{house:null,senate:[]},state:{lower:null,upper:null}}});
const federal=(chamber='house')=>({bioguideId:'arbitrary-id',fullName:'Synthetic member',party:null,state:'California',district:-1,chamber});
const local=(chamber='lower')=>({id:'synthetic-state-id',name:'Synthetic member',state:'CA',chamber,district:null,party:null,url:null});
const page=()=>({...context(),data:{tool:'get_representation',generatedAt:stamp,facilities:[row()],note:null}});
const check=(p=page(),request={clientId:'client'},ctx=context())=>v.assertFacilityRepresentationResult(p,request,ctx);
const normalize=(raw,ctx=context())=>v.normalizeFacilityRepresentationInput(raw,ctx);

test('normalization has explicit nulls and exact trim/slice/uppercase ordering',()=>{
  assert.deepEqual(normalize({}),{clientId:null,state:null});assert.deepEqual(normalize({clientId:null,state:'  '}),{clientId:null,state:null});
  assert.deepEqual(normalize({clientId:' client ',state:' ca-extra '}),{clientId:'client',state:'CA'});
  const ctx=context();ctx.subject.entityIds=['x'.repeat(64)];assert.equal(normalize({clientId:'x'.repeat(65)},ctx).clientId.length,64);
  assert.equal(normalize({state:'ß'}).state,'SS');assert.throws(()=>normalize({state:'ﬃ'}));
});
test('selectors are closed inert strings or null and model context cannot inject authority',()=>{
  for(const value of [true,1,{},[],undefined])for(const field of ['state','clientId'])assert.throws(()=>normalize({[field]:value}));
  for(const key of ['tenantId','subject','actorId','authorized','limit','cursor'])assert.throws(()=>normalize({[key]:'x'}));
});
test('trusted context must be a complete current client lineage declaration',()=>{
  for(const ctx of [{},null,{...context(),foreign:true}])assert.throws(()=>normalize({},ctx));
  const ctx=context();ctx.subject.entityIds.push('other');assert.throws(()=>normalize({},ctx));
  assert.throws(()=>normalize({clientId:'other'}));
  const wrong=context();wrong.subject.actorId='other';assert.throws(()=>normalize({},wrong));
});
test('missing selector preserves empty outcome independent of state hint',()=>{
  for(const raw of [{},{clientId:null},{clientId:' ',state:'CA'}]){
    const p=page();p.data.facilities=[];p.data.note='Provide a client UUID.';check(p,raw);
    p.data.facilities=[row()];assert.throws(()=>check(p,raw));
  }
});
test('empty source observation and nonempty source have exact distinct notes',()=>{
  for(const state of [null,'CA']){const p=page();p.data.facilities=[];
    p.data.note=`No facilities found for this client${state?' in CA':''} — say so explicitly, do not guess a representative.`;
    check(p,{clientId:'client',state});p.data.note=null;assert.throws(()=>check(p,{clientId:'client',state}));
  }
  const p=page();p.data.note='No representatives';assert.throws(()=>check(p));
});
test('state filter uses exact stored state without source case folding',()=>{
  check(page(),{clientId:'client',state:'ca'});const p=page();p.data.facilities[0].state='ca';
  check(p);assert.throws(()=>check(p,{clientId:'client',state:'CA'}));
});
for(const state of [null,''])test(`no_state matches falsy stored state ${String(state)}`,()=>{
  const p=page();Object.assign(p.data.facilities[0],{state,representation:{unresolved:true,reason:'no_state'}});check(p);
  p.data.facilities[0].representation.reason='no_geocode';assert.throws(()=>check(p));
});
test('no_geocode remains distinct and cannot prove hidden district/geocode inputs',()=>{
  const p=page();p.data.facilities[0].representation={unresolved:true,reason:'no_geocode'};check(p);
  p.data.facilities[0].representation.reason='no_state';assert.throws(()=>check(p));
});
test('resolved branch omits unresolved flag and admits empty representatives',()=>{
  check();const p=page();p.data.facilities[0].representation.unresolved=false;assert.throws(()=>check(p));
  delete p.data.facilities[0].representation.unresolved;p.data.facilities[0].state=null;assert.throws(()=>check(p));
});
test('unknown nonempty states and two codepoint astral stored states have no invented geography refusal',()=>{
  for(const state of ['ZZ','😀😀']){const p=page();p.data.facilities[0].state=state;check(p);}
});
test('federal/state slots preserve nullable values and signed stored Senate districts',()=>{
  const p=page(),r=p.data.facilities[0].representation;r.federal.house=federal();
  r.federal.senate=[federal('senate')];r.state.lower=local();r.state.upper=local('upper');check(p);
  for(const district of [null,0,-2147483648,2147483647]){r.federal.senate[0].district=district;check(p);}
  r.federal.senate[0].district=2147483648;assert.throws(()=>check(p));
});
test('source slot chamber and raw state-legislator join claims cannot substitute',()=>{
  for(const change of [r=>r.federal.house=federal('senate'),r=>r.federal.senate=[federal('house')],
    r=>r.state.lower=local('upper'),r=>r.state.upper={...local('upper'),state:'NY'}]){
    const p=page();change(p.data.facilities[0].representation);assert.throws(()=>check(p));
  }
});
test('federal fullname geography remains explicitly unproven by this projection boundary',()=>{
  const p=page();p.data.facilities[0].representation.federal.house={...federal(),state:null};check(p);
  p.data.facilities[0].representation.federal.house.state='Unverified stored label';check(p);
});
test('facility storage UUID identity admits all versions and refuses duplicates case insensitively',()=>{
  const p=page();p.data.facilities[0].facilityId='abcdefab-1234-0000-0000-000000000001';check(p);
  p.data.facilities.push({...structuredClone(p.data.facilities[0]),facilityId:p.data.facilities[0].facilityId.toUpperCase()});assert.throws(()=>check(p));
});
test('senator identity is unique within a facility but counts are not capped at two',()=>{
  const p=page();p.data.facilities[0].representation.federal.senate=Array.from({length:5},(_,i)=>({...federal('senate'),bioguideId:String(i)}));check(p);
  p.data.facilities[0].representation.federal.senate.push(federal('senate'),federal('senate'));assert.throws(()=>check(p));
});
test('facility list has no fabricated page bound or completeness envelope',()=>{
  const p=page();p.data.facilities=Array.from({length:60},(_,i)=>({...row(),facilityId:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`}));check(p);
  p.data.complete=true;assert.throws(()=>check(p));
});
test('result wrapper is bound to the exact current lineage',()=>{
  for(const change of [p=>p.binding.writerFence++,p=>p.subject.policyRevision='new',p=>p.subject.entityIds=['other']]){
    const p=page();change(p);assert.throws(()=>check(p));
  }
});
test('time field is canonical serialization, without currentness or ordering assertion',()=>{
  const p=page();p.data.generatedAt='1999-01-01T00:00:00.000Z';check(p);
  for(const stamp of ['2026-10-12','2026-10-12T00:00:00Z','2026-10-12T01:00:00+01:00']){p.data.generatedAt=stamp;assert.throws(()=>check(p));}
});
test('unknown projection fields and wrong scalar/null types refuse',()=>{
  for(const change of [p=>p.data.facilities[0].district='01',p=>p.data.facilities[0].facilityName=null,
    p=>p.data.facilities[0].city=5,p=>p.data.facilities[0].representation={unresolved:true,reason:'unknown'}]){
    const p=page();change(p);assert.throws(()=>check(p));
  }
});
test('hostile JSON is refused before getters, hooks, or proxy effects',()=>{
  let effects=0;const hostile={get clientId(){effects++;return'client';}};assert.throws(()=>normalize(hostile));
  const ctx=context();Object.defineProperty(ctx,'binding',{enumerable:true,get(){effects++;return{};}});assert.throws(()=>normalize({},ctx));
  const p=page();Object.defineProperty(p.data,'facilities',{enumerable:true,get(){effects++;return[];}});assert.throws(()=>check(p));
  const proxy=new Proxy({},{get(){effects++;return undefined;}});assert.throws(()=>normalize(proxy));assert.equal(effects,0);
});
test('cycles and non-finite nested scalars refuse within canonical transport admission',()=>{
  const raw={};raw.self=raw;assert.throws(()=>normalize(raw));const p=page();p.data.facilities[0].representation.federal.house={...federal(),district:NaN};assert.throws(()=>check(p));
});
