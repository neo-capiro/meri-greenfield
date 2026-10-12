import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createFacilityRepresentationValidators} from '../retrieval-0.2/facility-representation-validation.mjs';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url)));
const schema=read('../retrieval-0.2/facility-representation.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const item of [read('../meri.schema.json'),read('../retrieval-0.2/common.schema.json'),schema])ajv.addSchema(item);
const validators=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const family=createFacilityRepresentationValidators({assertSubject,canonicalSha256,validateShape(name,value){
  const validate=validators.get(name);if(!validate?.(value))throw new Error(`${name}: ${ajv.errorsText(validate?.errors)}`);return value;
}});
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clientId=uuid(10),stamp='2026-10-12T12:00:00.000Z';
const context=()=>({binding:{tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:uuid(1),runId:uuid(2),attemptId:uuid(3),workerId:uuid(4),writerFence:4},
  subject:{kind:'client',entityType:'client',entityIds:[clientId],tenantId:'synthetic-tenant',actorId:'synthetic-actor',authorizationDecisionId:uuid(5),policyRevision:'synthetic-policy',rosterVersionId:null,
    scopes:[{kind:'client',tenantId:'synthetic-tenant',resourceId:clientId,policyRevision:'synthetic-policy'}]}});
const request=()=>({clientId});
const federal=(extra={})=>({bioguideId:'synthetic-federal',fullName:'Synthetic federal member',party:null,state:'Florida',district:null,chamber:'house',...extra});
const state=(extra={})=>({id:'synthetic-state',name:'Synthetic state member',state:'FL',chamber:'lower',district:'HD-003',party:null,url:null,...extra});
const resolved=()=>({federal:{house:null,senate:[]},state:{lower:null,upper:null}});
const facility=(extra={})=>({facilityId:uuid(20),facilityName:'Synthetic facility',city:null,state:'FL',representation:resolved(),...extra});
const result=(facilities=[facility()],note=facilities.length?null:'No facilities found for this client — say so explicitly, do not guess a representative.',ctx=context())=>({binding:structuredClone(ctx.binding),subject:structuredClone(ctx.subject),data:{tool:'get_representation',generatedAt:stamp,facilities,note}});
const normalize=(input=request(),ctx=context())=>family.normalizeFacilityRepresentationInput(input,ctx);
const check=(page=result(),input=request(),ctx=context())=>family.assertFacilityRepresentationResult(page,input,ctx);

test('independent facility: normalized client and state retain declared slicing and casing',()=>{
  assert.deepEqual(normalize({}),{clientId:null,state:null});
  assert.deepEqual(normalize({clientId:' ',state:' '}),{clientId:null,state:null});
  const normalized=normalize({clientId:` ${clientId} `,state:' fl '});
  assert.equal(normalized.clientId,clientId);assert.equal(normalized.state,'FL');
  assert.equal(normalize({clientId,state:'ß'}).state,'SS');assert.throws(()=>normalize({clientId,state:'ßß'}));
  assert.equal(normalize({clientId,state:'🧭x'}).state,'🧭');
});
test('independent facility: source needs one matching client subject, never another identity kind',()=>{
  for(const mutate of [c=>c.subject.entityIds=[uuid(11)],c=>c.subject.entityIds.push(uuid(11)),c=>c.subject.kind='public',c=>c.subject.entityType='research-portfolio',c=>c.subject.actorId='other',c=>c.subject.tenantId='other']) {
    const ctx=context();mutate(ctx);assert.throws(()=>normalize(request(),ctx));
  }
  assert.throws(()=>normalize({clientId:uuid(11)}));
});
test('independent facility: exact context shape and strict scalar inputs refuse model authority',()=>{
  for(const extra of ['tenantId','actorId','subject','binding','sql','current'])assert.throws(()=>normalize({...request(),[extra]:'forged'}));
  for(const input of [{clientId:1},{state:[]},{clientId:true},{clientId:{}},{clientId:undefined}])assert.throws(()=>normalize(input));
  for(const ctx of [null,[],{}, {...context(),role:'admin'}])assert.throws(()=>normalize(request(),ctx));
});
test('independent facility: missing selector returns exact legacy refusal without defaulting subject ID',()=>{
  for(const input of [{},{clientId:null},{clientId:' '},{clientId:null,state:'FL'}]) {
    const normalized=normalize(input);assert.ok(normalized.clientId==null);
    check(result([],'Provide a client UUID.'),input);
    assert.throws(()=>check(result(),input));
  }
  assert.throws(()=>check(result([],'No client'),{}));
});
test('independent facility: missing and empty outputs still require exact current wrapper lineage',()=>{
  for(const [input,page] of [[{},result([],'Provide a client UUID.')],[request(),result([])],[request(),result()]]) {
    for(const field of Object.keys(page.binding)) {
      const mutant=structuredClone(page);mutant.binding[field]=field==='writerFence'?5:field==='actorId'||field==='tenantId'?'foreign':uuid(99);
      assert.throws(()=>check(mutant,input));
    }
    for(const [field,value] of [['authorizationDecisionId',uuid(99)],['policyRevision','foreign'],['entityIds',[uuid(99)]]]) {
      const mutant=structuredClone(page);mutant.subject[field]=value;assert.throws(()=>check(mutant,input));
    }
  }
});
test('independent facility: canonical subject lineage is not a new grant authorization engine',()=>{
  const ctx=context();ctx.subject.scopes[0].resourceId='unqualified-resource';normalize(request(),ctx);check(result(undefined,undefined,ctx),request(),ctx);
  for(const field of ['tenantId','policyRevision']){const bad=context();bad.subject.scopes[0][field]='foreign';assert.throws(()=>normalize(request(),bad));}
});
test('independent facility: output state filtering uses exact persisted value',()=>{
  check(result(),{clientId,state:' fl '});
  assert.throws(()=>check(result([facility({state:'fl'})]),{clientId,state:'FL'}));
  assert.throws(()=>check(result([facility({state:null,representation:{unresolved:true,reason:'no_state'}})]),{clientId,state:'FL'}));
  check(result([facility({state:'fl'})]));
});
test('independent facility: empty filter note and nonempty null note are correlated',()=>{
  check(result([],'No facilities found for this client in FL — say so explicitly, do not guess a representative.'),{clientId,state:'FL'});
  assert.throws(()=>check(result([]),{clientId,state:'FL'}));
  assert.throws(()=>check(result([],null)));assert.throws(()=>check(result(undefined,'Complete footprint')));
});
test('independent facility: facility projected storage identity and nullable values remain exact',()=>{
  check(result([facility({facilityName:'',city:'',state:'' ,representation:{unresolved:true,reason:'no_state'}})]));
  check(result([facility({state:null,representation:{unresolved:true,reason:'no_state'}})]));
  for(const extra of [{facilityId:'not-a-uuid'},{facilityName:null},{city:1},{state:'ABC'},{latitude:0},{clientId}])assert.throws(()=>check(result([facility(extra)])));
});
test('independent facility: VarChar2 storage counts Unicode codepoints, not UTF16 units',()=>{
  check(result([facility({state:'🧭🧭'})]));
  assert.throws(()=>check(result([facility({state:'🧭🧭🧭'})])));
});
test('independent facility: unresolved shape is closed and reason correlates with state truthiness',()=>{
  check(result([facility({representation:{unresolved:true,reason:'no_geocode'}})]));
  for(const row of [facility({representation:{unresolved:true,reason:'no_state'}}),facility({state:null,representation:{unresolved:true,reason:'no_geocode'}}),facility({representation:{unresolved:true,reason:'unknown'}}),facility({representation:{unresolved:true,reason:'no_geocode',federal:{house:null,senate:[]}}})])assert.throws(()=>check(result([row])));
});
test('independent facility: resolved empty is allowed but no-state or unresolved:false cannot be invented',()=>{
  check(result());check(result([facility({state:'ZZ'})]));
  assert.throws(()=>check(result([facility({state:null})])));assert.throws(()=>check(result([facility({state:''})])));
  assert.throws(()=>check(result([facility({representation:{...resolved(),unresolved:false}})])));
});
test('independent facility: uncapped facilities and senators do not assert completeness',()=>{
  const representation=resolved();representation.federal.senate=Array.from({length:5},(_,n)=>federal({bioguideId:`synthetic-${n}`,chamber:'senate',district:n}));
  const rows=Array.from({length:121},(_,n)=>facility({facilityId:uuid(100+n),representation}));check(result(rows));
  assert.throws(()=>check(result([facility(),facility()])));
});
test('independent facility: House and Senate retain slot chambers while federal geographic joins remain unqualified',()=>{
  const representation=resolved();representation.federal.house=federal();representation.federal.senate=[federal({bioguideId:'senate',chamber:'senate',district:-1})];
  check(result([facility({representation})]));check(result([facility({state:'fl',representation})]));
  for(const stored of ['FL','florida',null,'unqualified']) {
    const clone=structuredClone(representation);clone.federal.house.state=stored;clone.federal.senate[0].state=stored;check(result([facility({representation:clone})]));
  }
  for(const mutate of [r=>r.federal.house.chamber='senate',r=>r.federal.senate[0].chamber='house']) {
    const clone=structuredClone(representation);mutate(clone);assert.throws(()=>check(result([facility({representation:clone})])));
  }
});
test('independent facility: federal summary admission does not certify geographic correspondence',()=>{
  const representation=resolved();representation.federal.house=federal();check(result([facility({state:'ZZ',representation})]));
  representation.federal.house=null;representation.federal.senate=[federal({chamber:'senate'})];check(result([facility({state:'ZZ',representation})]));
});
test('independent facility: Senate nullable and signed Int district is preserved without list-members coercion',()=>{
  for(const district of [null,-2147483648,0,2147483647]) {
    const representation=resolved();representation.federal.senate=[federal({chamber:'senate',district})];check(result([facility({representation})]));
  }
  for(const district of [1.5,2147483648,'0']) {
    const representation=resolved();representation.federal.senate=[federal({chamber:'senate',district})];assert.throws(()=>check(result([facility({representation})])));
  }
});
test('independent facility: at-large House null and zero district are valid reported values',()=>{
  for(const district of [null,0]){const representation=resolved();representation.federal.house=federal({district});check(result([facility({representation})]));}
});
test('independent facility: state slots bind raw facility state and chamber without rewriting districts',()=>{
  const representation=resolved();representation.state.lower=state();representation.state.upper=state({id:'upper',chamber:'upper',district:'SD-009'});check(result([facility({representation})]));
  const lowercase=structuredClone(representation);lowercase.state.lower.state='fl';lowercase.state.upper.state='fl';check(result([facility({state:'fl',representation:lowercase})]));
  for(const mutate of [r=>r.state.lower.state='Florida',r=>r.state.lower.state='fl',r=>r.state.lower.chamber='upper',r=>r.state.lower.chamber=null,r=>r.state.upper.chamber='lower']) {
    const clone=structuredClone(representation);mutate(clone);assert.throws(()=>check(result([facility({representation:clone})])));
  }
});
test('independent facility: free persisted summary fields are preserved without ID/URL/party enums',()=>{
  const representation=resolved();representation.federal.house=federal({bioguideId:'free-form',party:'unmapped'});
  representation.state.lower=state({id:'free-form-state',party:'unmapped',url:'stored non-URL text',district:'arbitrary stored district'});check(result([facility({representation})]));
});
test('independent facility: repeated representatives across different facilities remain valid',()=>{
  const representation=resolved();representation.federal.senate=[federal({chamber:'senate'})];
  check(result([facility({representation}),facility({facilityId:uuid(21),representation})]));
  const duplicate=structuredClone(representation);duplicate.federal.senate.push(structuredClone(duplicate.federal.senate[0]));assert.throws(()=>check(result([facility({representation:duplicate})])));
});
test('independent facility: generatedAt is canonical wire metadata, not current freshness',()=>{
  const page=result();page.data.generatedAt='2000-01-01T00:00:00.000Z';check(page);
  for(const stamp of ['invalid','2026-02-30T00:00:00.000Z','2026-10-12T12:00:00Z']){const p=result();p.data.generatedAt=stamp;assert.throws(()=>check(p));}
});
test('independent facility: strict envelope and summaries reject extra content/provenance claims',()=>{
  for(const mutate of [p=>p.data.tool='get_committee_roster',p=>p.data.complete=true,p=>p.data.facilities[0].representation.federal.current=true,p=>p.actorId='forged']){const p=result();mutate(p);assert.throws(()=>check(p));}
});
test('independent facility: request/context/result accessors and proxies never execute',()=>{
  let calls=0;const input={get clientId(){calls++;return clientId;}},ctx=context();Object.defineProperty(ctx,'subject',{get(){calls++;return context().subject;},enumerable:true});
  const p=result();Object.defineProperty(p.data,'note',{get(){calls++;return null;},enumerable:true});
  const proxy=new Proxy({}, {ownKeys(){calls++;return [];}});
  assert.throws(()=>normalize(input));assert.throws(()=>normalize(request(),ctx));assert.throws(()=>check(p));assert.throws(()=>normalize(proxy));assert.throws(()=>check(proxy));assert.equal(calls,0);
});
test('independent facility: cycles, hidden properties and class instances fail inert admission',()=>{
  const cycle={clientId};cycle.self=cycle;
  for(const input of [cycle,new Date(),Object.defineProperty({},'clientId',{value:clientId})])assert.throws(()=>normalize(input));
});
