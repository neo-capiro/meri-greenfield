import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createAcquisitionPersonnelValidators,ACQUISITION_PERSONNEL_OPERATION_IDS} from '../retrieval-0.2/acquisition-personnel-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
// Compiler is a test seam; canonical loader/catalog are exclusively root-owned.
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/acquisition-personnel.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createAcquisitionPersonnelValidators({schema,validateShape(name,value){const check=checks.get(name);if(!check?.(value))throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);return value;}});
const [search,detail]=ACQUISITION_PERSONNEL_OPERATION_IDS;
const id='abcdefab-1234-0000-0000-000000000001',other='abcdefab-1234-0000-0000-000000000002';
const stamp='2026-10-12T12:00:00.000Z';
const regular={actorRole:'standard_user'},admin={actorRole:'capiro_admin'};
const req=op=>op===search?{}:{id};
function common(){return{id,fullName:'Synthetic Person',service:null,organization:null,title:null,role:null,pePrimary:null,peSecondary:[],emailDomain:null,publicProfileUrl:null,confidence:0.5,status:'unclassified',firstSeenAt:stamp,lastSeenAt:stamp,email:null,phone:null,parentOffice:null,department:null};}
function mention(n=1){return{id:`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,source:'synthetic-source',sourceUrl:null,snippet:null,observedAt:stamp,confidence:0.4,metadata:{}};}
function page(){return{tool:search,generatedAt:stamp,data:[{...common(),headshotUrl:null,sourceCount:0}],total:1,page:1,limit:20};}
function person(){return{tool:detail,generatedAt:stamp,person:{...common(),nameKey:'synthetic person',programOfRecord:null,metadata:{},sources:[]}};}
const make=op=>op===search?page():person();
const row=p=>p.data?.[0]??p.person;

test('two distinct operation definitions and pinned factory identity',()=>{
 assert.equal(v.acquisitionPersonnelSchemaId,'urn:meri:retrieval:acquisition-personnel:0.2.0');
 assert.equal(new Set(ACQUISITION_PERSONNEL_OPERATION_IDS.map(v.acquisitionPersonnelInputDefinition)).size,2);
 for(const op of ['__proto__','constructor','get_program_element_personnel','link_crm_contact'])assert.throws(()=>v.normalizeAcquisitionPersonnelInput(op,{},regular));
});
for(const op of ACQUISITION_PERSONNEL_OPERATION_IDS){
 test(`${op}: immutable request and output with explicit unqualified metadata`,()=>{
  const request=req(op),saved=structuredClone(request),p=make(op),before=structuredClone(p),n=v.normalizeAcquisitionPersonnelInput(op,request,regular);
  assert.deepEqual(request,saved);assert.notEqual(n.input,request);assert.ok(Object.isFrozen(n.input));assert.ok(Object.isFrozen(n.metadata));
  for(const key of ['authoritative','sourceConnected','producerQualified','absenceEvidence','currentAuthorityQualified'])assert.equal(n.metadata[key],false);
  assert.equal(n.metadata.auditWriteRequired,true);assert.equal(n.metadata.producerPolicyPin,'4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace');
  assert.equal(v.assertAcquisitionPersonnelOutput(op,p,request,regular),p);assert.deepEqual(p,before);
 });
 test(`${op}: both operations require exact trusted role context`,()=>{
  for(const context of [undefined,{},null,[],{actorRole:'admin'},{actorRole:'capiro_admin '},{actorRole:'CAPIRO_ADMIN'},{actorRole:'capiro_admin',tenantId:'invented'},{role:'capiro_admin'}]){
   assert.throws(()=>v.normalizeAcquisitionPersonnelInput(op,req(op),context));assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,make(op),req(op),context));
  }
  for(const actorRole of ['capiro_admin','user_admin','standard_user','client_portal_user'])v.assertAcquisitionPersonnelOutput(op,make(op),req(op),{actorRole});
 });
 test(`${op}: actor hints in model arguments cannot elevate privilege`,()=>{
  for(const key of ['actorRole','actorId','tenantId','userId','isAdmin','asOf','include_superseded','email'])assert.throws(()=>v.normalizeAcquisitionPersonnelInput(op,{...req(op),[key]:'capiro_admin'},regular));
 });
 test(`${op}: non-admin top-level contact fields must all be null`,()=>{
  for(const actorRole of ['user_admin','standard_user','client_portal_user'])for(const key of ['email','phone','parentOffice','department']){
   const p=make(op);row(p)[key]='synthetic';assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,p,req(op),{actorRole}),/trusted capiro_admin/);
  }
 });
 test(`${op}: exact current projection closes omitted/extra fields`,()=>{
  for(const key of ['approvedFacts','contactUse','roles','crmLinkBlocked','supersededAt','complete']){const p=make(op);row(p)[key]=true;assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,p,req(op),regular));}
  for(const key of ['phone','parentOffice','department','email']){const p=make(op);delete row(p)[key];assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,p,req(op),regular));}
  const p=make(op);p.tool=op===search?detail:search;assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,p,req(op),regular));
 });
 test(`${op}: finite confidence and dates without invented confidence/lifecycle ranges`,()=>{
  const p=make(op);row(p).confidence=-2;row(p).firstSeenAt='2026-10-13T12:00:00.000Z';v.assertAcquisitionPersonnelOutput(op,p,req(op),regular);
  row(p).confidence=5;v.assertAcquisitionPersonnelOutput(op,p,req(op),regular);
  for(const value of [NaN,Infinity]){row(p).confidence=value;assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,p,req(op),regular));}
  for(const key of ['generatedAt','firstSeenAt','lastSeenAt']){const p=make(op);(key==='generatedAt'?p:row(p))[key]='2026-06-30T23:59:60Z';assert.throws(()=>v.assertAcquisitionPersonnelOutput(op,p,req(op),regular));}
 });
}
test('search defaults/range are strict while source string trim and UTF16 caps remain explicit',()=>{
 assert.deepEqual(v.normalizeAcquisitionPersonnelInput(search,{},regular).input,{limit:20,page:1});
 const n=v.normalizeAcquisitionPersonnelInput(search,{query:' '+ 'q'.repeat(239)+'😀 ',service:' '+ 's'.repeat(70),organization:'o'.repeat(201),role:'r'.repeat(61),peCode:'p'.repeat(33)},regular).input;
 assert.equal(n.query,'q'.repeat(239)+'\ud83d');assert.equal(n.service.length,60);assert.equal(n.organization.length,200);assert.equal(n.role.length,60);assert.equal(n.peCode.length,32);
 assert.deepEqual(v.normalizeAcquisitionPersonnelInput(search,{query:' \t ',service:' '},regular).input,{limit:20,page:1});
 assert.equal(v.normalizeAcquisitionPersonnelInput(search,{query:'q'.repeat(239)+' X'},regular).input.query,'q'.repeat(239));
 for(const field of ['limit','page'])for(const value of [0,-1,1.5,'10',null,true,undefined,field==='limit'?51:101])assert.throws(()=>v.normalizeAcquisitionPersonnelInput(search,{[field]:value},regular));
 for(const input of [{query_alias:'unknown selector'},{pe_code:'hidden selector'},{sort:'confidence'},{pe_aligned:'aligned'}])assert.throws(()=>v.normalizeAcquisitionPersonnelInput(search,input,regular));
});
test('search every registered limit/page boundary and echoed selection',()=>{
 for(const limit of [1,50])for(const pageNumber of [1,100]){const p=page();p.limit=limit;p.page=pageNumber;v.assertAcquisitionPersonnelOutput(search,p,{limit,page:pageNumber},regular);}
 for(const mutate of [p=>p.page++,p=>p.limit++,p=>p.data.push({...p.data[0],id:other})]){const p=page();p.limit=1;mutate(p);assert.throws(()=>v.assertAcquisitionPersonnelOutput(search,p,{limit:1},regular));}
});
test('fuzzy totals count a bounded candidate window before remaining filters, not all matches',()=>{
 for(const [count,total] of [[0,0],[0,5],[1,1],[1,20]]){const p=page();if(!count)p.data=[];p.total=total;v.assertAcquisitionPersonnelOutput(search,p,{query:'Synthetic'},regular);}
 for(const total of [0,21]){const p=page();p.total=total;assert.throws(()=>v.assertAcquisitionPersonnelOutput(search,p,{query:'Synthetic'},regular),/candidate window/);}
 assert.equal(v.normalizeAcquisitionPersonnelInput(search,{query:'Synthetic'},regular).metadata.countScope,'paged-fuzzy-candidates-before-filters');
});
test('unfiltered totals are separate observations and may be smaller than returned rows',()=>{
 const p=page();p.total=0;v.assertAcquisitionPersonnelOutput(search,p,{},regular);p.total=10000;v.assertAcquisitionPersonnelOutput(search,p,{},regular);
 assert.equal(v.normalizeAcquisitionPersonnelInput(search,{},regular).metadata.countScope,'separate-local-count');
});
test('exact service/role/PE filter bindings do not confer caller authority',()=>{
 const p=page();Object.assign(p.data[0],{service:'Army',role:'capiro_admin',peSecondary:['PE-1']});
 v.assertAcquisitionPersonnelOutput(search,p,{service:'Army',role:'capiro_admin',peCode:'PE-1'},regular);
 for(const request of [{service:'Navy'},{role:'PM'},{peCode:'PE-2'}])assert.throws(()=>v.assertAcquisitionPersonnelOutput(search,p,request,regular),/selector substitution/);
 p.data[0].email='synthetic@example.invalid';assert.throws(()=>v.assertAcquisitionPersonnelOutput(search,p,{role:'capiro_admin'},regular),/trusted capiro_admin/);
});
test('list admin email is stored text; headshot is opaque inert JSON, not a string assertion',()=>{
 for(const headshotUrl of [null,false,0,'',[],{untrusted:'synthetic'}]){const p=page();Object.assign(p.data[0],{email:' synthetic@example.invalid ',phone:'123',parentOffice:'Office',department:'Dept',headshotUrl});v.assertAcquisitionPersonnelOutput(search,p,{},admin);}
 for(const phone of ['', ' 123','123 ']){const p=page();p.data[0].phone=phone;assert.throws(()=>v.assertAcquisitionPersonnelOutput(search,p,{},admin),/normalized text/);}
});
test('detail UUID request normalization matches actual UUID identity without invented version restriction',()=>{
 for(const inputId of ['00000000-0000-0000-0000-000000000000',id.toUpperCase()]){const p=person();p.person.id=inputId.toLowerCase();v.assertAcquisitionPersonnelOutput(detail,p,{id:' '+inputId+' '},regular);}
 assert.equal(v.normalizeAcquisitionPersonnelInput(detail,{id:' '+id.toUpperCase()+' '},regular).input.id,id);
 for(const inputId of ['', ' ', 'not-uuid',id+'x',null,4])assert.throws(()=>v.normalizeAcquisitionPersonnelInput(detail,{id:inputId},regular));
 assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,person(),{id:other},regular),/identity substitution/);
 const absent=person();absent.person=null;assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,absent,{id},regular));
 assert.equal(v.normalizeAcquisitionPersonnelInput(detail,{id},regular).metadata.notFound,'exception-after-audit');
});
test('detail top-level headshot is not projected, and source metadata remains opaque',()=>{
 const p=person();p.person.headshotUrl='synthetic';assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,p,{id},regular));
 const opaque=person();opaque.person.sources=[mention()];opaque.person.sources[0].metadata={uploadedDirectoryContact:{email:'opaque@example.invalid'}};v.assertAcquisitionPersonnelOutput(detail,opaque,{id},regular);
});
test('current nonadmin object metadata omits both specified containers without broad invented redaction',()=>{
 for(const key of ['uploadedDirectoryContact','uploadedDirectoryPrevious'])for(const value of [null,[],{},'opaque']){const p=person();p.person.metadata={[key]:value};assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,p,{id},regular),/redaction missing/);}
 for(const metadata of [null,[],[{uploadedDirectoryContact:'opaque'}],false,5,'opaque',{nested:{uploadedDirectoryContact:'opaque'},email:'opaque@example.invalid'}]){const p=person();p.person.metadata=metadata;v.assertAcquisitionPersonnelOutput(detail,p,{id},regular);}
});
test('admin detail upload-derived fields correlate with retained metadata after trim',()=>{
 const p=person();p.person.metadata={uploadedDirectoryContact:{phone:' 123 ',parentOffice:' Office ',department:' Dept '},uploadedDirectoryPrevious:{opaque:true}};
 Object.assign(p.person,{email:'stored@example.invalid',phone:'123',parentOffice:'Office',department:'Dept'});v.assertAcquisitionPersonnelOutput(detail,p,{id},admin);
 for(const key of ['phone','parentOffice','department']){const wrong=structuredClone(p);wrong.person[key]='invented';assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,wrong,{id},admin),/metadata mismatch/);}
 for(const metadata of [null,[],{}, {uploadedDirectoryContact:[]},{uploadedDirectoryContact:{phone:123,parentOffice:' ',department:false}}]){const empty=person();empty.person.metadata=metadata;v.assertAcquisitionPersonnelOutput(detail,empty,{id},admin);}
});
test('detail sources preserve full unpaged array, descending observation and UUID uniqueness',()=>{
 const p=person();p.person.sources=Array.from({length:65},(_,i)=>mention(i));v.assertAcquisitionPersonnelOutput(detail,p,{id},regular);
 const reversed=person();reversed.person.sources=[mention(1),{...mention(2),observedAt:'2026-10-13T12:00:00.000Z'}];assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,reversed,{id},regular),/newest first/);
 const dup=person();dup.person.sources=[mention(),mention()];assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,dup,{id},regular),/Duplicate/);
 for(const key of ['complete','hasMore','nextOffset']){const wrong=person();wrong.person[key]=true;assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,wrong,{id},regular));}
});
test('inert admission rejects hooks on model input, role context and opaque result metadata',()=>{
 let hooks=0;const accessor=Object.defineProperty({},'actorRole',{enumerable:true,get(){hooks++;return'capiro_admin';}});
 assert.throws(()=>v.normalizeAcquisitionPersonnelInput(search,{},accessor));
 const proxy=new Proxy({},{get(){hooks++;},ownKeys(){hooks++;return[];}});assert.throws(()=>v.normalizeAcquisitionPersonnelInput(search,proxy,regular));
 const p=person();p.person.metadata={toJSON(){hooks++;return{};}};assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,p,{id},regular));
 p.person.metadata={};p.person.metadata.self=p.person.metadata;assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,p,{id},regular));
 p.person.metadata={bad:NaN};assert.throws(()=>v.assertAcquisitionPersonnelOutput(detail,p,{id},regular));assert.equal(hooks,0);
});
test('actual canonical resolver pins request/hash and restricts both trusted context boundaries',()=>{
 const bindings=ACQUISITION_PERSONNEL_OPERATION_IDS.map(op=>({id:op,version:'0.2.0',contextKeys:['actorRole'],normalize:(_,request,context)=>v.normalizeAcquisitionPersonnelInput(op,request,context),outputAssert:(_,value,request,context)=>v.assertAcquisitionPersonnelOutput(op,value,request,{actorRole:context.actorRole})}));
 const catalog={operations:bindings.map(b=>({operation:{id:b.id,version:b.version},handler:null,status:'unavailable'}))};
 const r=createOperationContracts({catalog,bindings,validators:v,assertCatalog(){},canonicalSha256});
 for(const op of ACQUISITION_PERSONNEL_OPERATION_IDS){const c=r.resolveOperationContract({id:op,version:'0.2.0'}),n=c.normalizeInput(req(op),regular);assert.ok(Object.isFrozen(n.request));assert.equal(n.argumentsSha256,canonicalSha256(n.input));c.assertOutput(make(op),{request:n.request,...regular});assert.throws(()=>c.normalizeInput(req(op),{...regular,nowMs:1}));assert.throws(()=>c.assertOutput(make(op),{request:n.request}));}
});

// Added after independent review preserved the rejected-q source failure.
test('query wins only when nonblank; q preserves null/blank fallback and canonical digest equivalence',()=>{
 for(const query of [undefined,null,'',' \t ']){
  const request={q:' Alias Person ',...(query===undefined?{}:{query})};
  assert.deepEqual(v.normalizeAcquisitionPersonnelInput(search,request,regular).input,{query:'Alias Person',limit:20,page:1});
  v.assertAcquisitionPersonnelOutput(search,page(),request,regular);
 }
 assert.deepEqual(v.normalizeAcquisitionPersonnelInput(search,{query:' Preferred ',q:' Alias '},regular).input,{query:'Preferred',limit:20,page:1});
 for(const q of [null,'',' \n '])assert.deepEqual(v.normalizeAcquisitionPersonnelInput(search,{query:null,q},regular).input,{limit:20,page:1});
 const capped=v.normalizeAcquisitionPersonnelInput(search,{query:null,q:' '+ 'q'.repeat(239)+'😀 '},regular).input;
 assert.equal(capped.query,'q'.repeat(239)+'\ud83d');assert.equal(Object.hasOwn(capped,'q'),false);
 const a=v.normalizeAcquisitionPersonnelInput(search,{q:' Alias '},regular).input,b=v.normalizeAcquisitionPersonnelInput(search,{query:'Alias'},regular).input;
 assert.equal(canonicalSha256(a),canonicalSha256(b));
 for(const q of [false,1,{},[]])assert.throws(()=>v.normalizeAcquisitionPersonnelInput(search,{q},regular));
 const malformed=page();malformed.total=21;assert.throws(()=>v.assertAcquisitionPersonnelOutput(search,malformed,{q:'Alias'},regular),/candidate window/);
});
