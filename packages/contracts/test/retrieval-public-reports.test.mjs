import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createPublicReportsValidators,PUBLIC_REPORT_OPERATION_IDS} from '../retrieval-0.2/public-reports-validation.mjs';
import {createOperationContracts} from '../retrieval-0.2/operation-contracts.mjs';
import {canonicalSha256} from '../validate.mjs';
// Test-only strict compiler: canonical loader/catalog changes belong to root.
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/public-reports.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createPublicReportsValidators({schema,validateShape(name,value){const check=checks.get(name);if(!check?.(value))throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);return value;}});
const [cbo,gao,crs]=PUBLIC_REPORT_OPERATION_IDS;
const stamp='2026-10-12T12:00:00.000Z',date='2026-10-01T00:00:00.000Z';
const cboRow=()=>({id:'cbo-synthetic',billId:'hr1-119',congress:119,billType:'hr',billNumber:'1',title:'Synthetic estimate',description:null,pubDate:stamp,cboUrl:'https://example.invalid/cbo'});
const gaoRow=()=>({id:'gao-synthetic',title:'Synthetic report',url:null,publishDate:date,reportType:null,topics:[],agencies:[],summary:'',recommendations:null});
const crsRow=()=>({id:'crs-synthetic',title:'Synthetic report',date,authors:[],topics:[],summary:'',pdfUrl:null,htmlUrl:null});
const rows=new Map([[cbo,cboRow],[gao,gaoRow],[crs,crsRow]]);
function result(id,count=1){const values=Array.from({length:count},(_,i)=>({...rows.get(id)(),id:`synthetic-${i}`}));return id===cbo?{tool:id,generatedAt:stamp,estimatesFound:count,estimates:values,...(count===0?{note:'No CBO cost estimates matched. Say so explicitly — do not estimate or guess a score.'}:{})}:{tool:id,generatedAt:stamp,total:count,data:values};}
const select=p=>p.estimates??p.data;
const specificNote=label=>`No CBO cost estimate on record for ${label}. Say so explicitly — do not estimate or guess a score.`;

test('three exact operation definitions, schema identity and unknown IDs',()=>{
 assert.equal(v.publicReportsSchemaId,'urn:meri:retrieval:public-reports:0.2.0');
 assert.equal(new Set(PUBLIC_REPORT_OPERATION_IDS.map(v.publicReportsInputDefinition)).size,3);
 assert.equal(new Set(PUBLIC_REPORT_OPERATION_IDS.map(v.publicReportsOutputDefinition)).size,3);
 for(const id of ['__proto__','constructor','search_public_reports','search_gao_reports@0.2.0'])assert.throws(()=>v.normalizePublicReportsInput(id,{}));
});
for(const id of PUBLIC_REPORT_OPERATION_IDS){
 test(`${id}: immutable input and closed projection remain inert`,()=>{
  const request={query:'  Synthetic  '},saved=structuredClone(request),normalized=v.normalizePublicReportsInput(id,request),page=result(id),original=structuredClone(page);
  assert.deepEqual(request,saved);assert.equal(normalized.input.query,'Synthetic');assert.notEqual(normalized.input,request);
  assert.ok(Object.isFrozen(normalized.input));assert.ok(Object.isFrozen(normalized.metadata));
  for(const name of ['authoritative','sourceConnected','producerQualified','absenceEvidence'])assert.equal(normalized.metadata[name],false);
  assert.equal(v.assertPublicReportsOutput(id,page,request),page);assert.deepEqual(page,original);
 });
 test(`${id}: default/minimum/maximum limit and strict numeric boundaries`,()=>{
  const max=id===cbo?25:50,def=id===cbo?10:20;
  assert.equal(v.normalizePublicReportsInput(id,{}).input.limit,def);
  for(const limit of [1,max]){assert.equal(v.normalizePublicReportsInput(id,{limit}).input.limit,limit);v.assertPublicReportsOutput(id,result(id,limit),{limit});}
  for(const limit of [0,-1,max+1,1.5,'10',null,undefined,true,NaN,Infinity])assert.throws(()=>v.normalizePublicReportsInput(id,{limit}));
  assert.throws(()=>v.assertPublicReportsOutput(id,result(id,2),{limit:1}),/limit substitution/);
 });
 test(`${id}: model authority, foreign operation and unprojected output refuse`,()=>{
  for(const key of ['asOf','actorId','tenantId','nowMs','active','sourceConnected','cursor','offset'])assert.throws(()=>v.normalizePublicReportsInput(id,{[key]:'synthetic'}));
  for(const key of ['complete','approvedFacts','rawPayload','truncated','current','absenceEvidence']){const p=result(id);p[key]=true;assert.throws(()=>v.assertPublicReportsOutput(id,p,{}));}
  const foreign=result(id);foreign.tool=PUBLIC_REPORT_OPERATION_IDS.find(other=>other!==id);assert.throws(()=>v.assertPublicReportsOutput(id,foreign,{}));
 });
 test(`${id}: producer timestamps must be finite canonical JSON instants`,()=>{
  for(const generatedAt of ['2026-06-30T23:59:60Z','2026-10-12T12:00:00Z','2026-10-12T14:00:00.000+02:00','invalid',null]){const p=result(id);p.generatedAt=generatedAt;assert.throws(()=>v.assertPublicReportsOutput(id,p,{}));}
 });
 test(`${id}: duplicate primary keys and ascending non-null dates refuse`,()=>{
  const duplicate=result(id,2);select(duplicate)[1].id=select(duplicate)[0].id;assert.throws(()=>v.assertPublicReportsOutput(id,duplicate,{}),/Duplicate/);
  const p=result(id,2),key=id===cbo?'pubDate':id===gao?'publishDate':'date';select(p)[1][key]='2026-10-13T00:00:00.000Z';assert.throws(()=>v.assertPublicReportsOutput(id,p,{}),/newest first/);
 });
}
test('exact input trim and UTF-16 caps retain separate search semantics',()=>{
 assert.equal(v.normalizePublicReportsInput(cbo,{query:' '+ 'x'.repeat(199)+'😀  '}).input.query,'x'.repeat(199)+'\ud83d');
 assert.equal(v.normalizePublicReportsInput(gao,{query:' '+ 'x'.repeat(239)+'😀 '}).input.query,'x'.repeat(239)+'\ud83d');
 assert.equal(v.normalizePublicReportsInput(crs,{query:' '+ 'x'.repeat(239)+'😀 '}).input.query,'x'.repeat(239)+'\ud83d');
 assert.equal(v.normalizePublicReportsInput(gao,{reportType:' '+'r'.repeat(70)+' '}).input.reportType,'r'.repeat(60));
 for(const id of PUBLIC_REPORT_OPERATION_IDS)assert.deepEqual(v.normalizePublicReportsInput(id,{query:' \n\t '}).input,{limit:id===cbo?10:20});
 assert.throws(()=>v.normalizePublicReportsInput(crs,{reportType:'report'}));
 for(const query of [null,4,{},[],false])assert.throws(()=>v.normalizePublicReportsInput(gao,{query}));
});
test('CBO lowercases effective bill only, preserving original clipped label and expansion',()=>{
 const original='İ'.repeat(40),normalized=v.normalizePublicReportsInput(cbo,{billId:' '+original+' extra '});
 assert.equal(normalized.input.billId,'i\u0307'.repeat(40));assert.equal(normalized.metadata.cboBillLabel,original);
 const page=result(cbo,0);page.note=specificNote(original);v.assertPublicReportsOutput(cbo,page,{billId:' '+original+' extra '});
 const upper=result(cbo,0);upper.note=specificNote('HR1-119');v.assertPublicReportsOutput(cbo,upper,{billId:' HR1-119 '});
 upper.note=specificNote('hr1-119');assert.throws(()=>v.assertPublicReportsOutput(cbo,upper,{billId:' HR1-119 '}),/original request label/);
});
test('CBO clipped trailing whitespace belongs to note label but not effective filter',()=>{
 const request={billId:'H'.repeat(39)+' X'},normalized=v.normalizePublicReportsInput(cbo,request),page=result(cbo,0);
 assert.equal(normalized.input.billId,'h'.repeat(39));assert.equal(normalized.metadata.cboBillLabel,'H'.repeat(39)+' ');
 page.note=specificNote('H'.repeat(39)+' ');v.assertPublicReportsOutput(cbo,page,request);
});
test('CBO congress strict stored Int preserves negatives, zero means no filter',()=>{
 for(const congress of [-2147483648,-1,1,2147483647]){const p=result(cbo);p.estimates[0].congress=congress;v.assertPublicReportsOutput(cbo,p,{congress});}
 assert.deepEqual(v.normalizePublicReportsInput(cbo,{congress:0}).input,{limit:10});
 for(const congress of ['119',null,true,1.5,2147483648,-2147483649])assert.throws(()=>v.normalizePublicReportsInput(cbo,{congress}));
 assert.throws(()=>v.assertPublicReportsOutput(cbo,result(cbo),{congress:118}),/filter substitution/);
});
test('CBO returned count and exact zero-window disclaimer cannot invent a score',()=>{
 v.assertPublicReportsOutput(cbo,result(cbo,0),{});
 for(const mutate of [p=>p.estimatesFound++,p=>p.note='No funding available',p=>delete p.note]){const p=result(cbo,0);mutate(p);assert.throws(()=>v.assertPublicReportsOutput(cbo,p,{}));}
 const present=result(cbo);present.note='No estimate';assert.throws(()=>v.assertPublicReportsOutput(cbo,present,{}));
 for(const key of ['estimatedCost','score','amount','fullText']){const p=result(cbo);p.estimates[0][key]=100;assert.throws(()=>v.assertPublicReportsOutput(cbo,p,{}));}
 const nullable=result(cbo);nullable.estimates[0].billId=null;nullable.estimates[0].description=null;nullable.estimates[0].cboUrl='';v.assertPublicReportsOutput(cbo,nullable,{});
 assert.throws(()=>v.assertPublicReportsOutput(cbo,nullable,{billId:'HR1-119'}));
 v.assertPublicReportsOutput(cbo,result(cbo),{billId:' HR1-119 '});
});
for(const id of [gao,crs]){
 test(`${id}: total is separate local observation, including total less than returned`,()=>{
  for(const total of [0,1,50,10000]){const p=result(id,2);p.total=total;v.assertPublicReportsOutput(id,p,{});}
  for(const total of [-1,1.5,Number.MAX_SAFE_INTEGER+1]){const p=result(id);p.total=total;assert.throws(()=>v.assertPublicReportsOutput(id,p,{}));}
  assert.equal(v.normalizePublicReportsInput(id,{}).metadata.countScope,'separate-local-count');
 });
 test(`${id}: summaries use normalized UTF-16 bounds without invented truncation`,()=>{
  for(const [key,cap] of [['title',240],['summary',400]]){
   for(const value of ['', 'x'.repeat(cap), 'x'.repeat(cap-3)+'...', 'x'.repeat(cap-1)+'\ud83d']){const p=result(id);p.data[0][key]=value;v.assertPublicReportsOutput(id,p,{});}
   for(const value of ['x'.repeat(cap+1),' leading','trailing ','double  space','line\nbreak',null]){const p=result(id);p.data[0][key]=value;assert.throws(()=>v.assertPublicReportsOutput(id,p,{}));}
  }
 });
 test(`${id}: nullable stored dates and URLs remain nullable, null order is not fabricated`,()=>{
  const p=result(id,3),key=id===gao?'publishDate':'date';p.data[0][key]=null;p.data[2][key]=null;v.assertPublicReportsOutput(id,p,{});
  p.data[1][key]='2026-10-01T00:00:01.000Z';assert.throws(()=>v.assertPublicReportsOutput(id,p,{}),/UTC midnight/);
  p.data[1][key]='2026-10-01';assert.throws(()=>v.assertPublicReportsOutput(id,p,{}));
 });
}
test('GAO stored nullable recommendation Int and reportType are not invented enums or unsigned values',()=>{
 for(const recommendations of [null,-2147483648,0,2147483647]){const p=result(gao);p.data[0].recommendations=recommendations;p.data[0].reportType='SyntheticType';p.data[0].url='';v.assertPublicReportsOutput(gao,p,{reportType:' SyntheticType '});}
 assert.throws(()=>v.assertPublicReportsOutput(gao,result(gao),{reportType:'SyntheticType'}),/filter substitution/);
 for(const recommendations of [1.5,'1',2147483648]){const p=result(gao);p.data[0].recommendations=recommendations;assert.throws(()=>v.assertPublicReportsOutput(gao,p,{}));}
});
test('CRS active-only selection is an adapter obligation, not an invented projected proof',()=>{
 assert.equal(v.normalizePublicReportsInput(crs,{}).metadata.activeOnly,true);
 const p=result(crs);p.data[0].active=true;assert.throws(()=>v.assertPublicReportsOutput(crs,p,{}));
 const nullable=result(crs);nullable.data[0].pdfUrl=null;nullable.data[0].htmlUrl='';v.assertPublicReportsOutput(crs,nullable,{});
});
test('input and output accessors/proxies/cycles/coercion hooks are rejected without execution',()=>{
 let hooks=0;const cyclic={};cyclic.query=cyclic;
 const bad=[Object.defineProperty({},'query',{enumerable:true,get(){hooks++;return 'x';}}),new Proxy({},{get(){hooks++;},ownKeys(){hooks++;return[];}}),{toJSON(){hooks++;return{};}},Object.defineProperty({},'hidden',{value:1}),Object.assign(Object.create({inherited:true}),{query:'x'}),{query:Symbol('x')},cyclic];
 for(const request of bad)assert.throws(()=>v.normalizePublicReportsInput(gao,request));
 const output=result(gao);Object.defineProperty(output.data[0],'summary',{enumerable:true,get(){hooks++;return'';}});assert.throws(()=>v.assertPublicReportsOutput(gao,output,{}));assert.equal(hooks,0);
});
test('canonical resolver supplies immutable original request, normalized digest and no context keys',()=>{
 const bindings=PUBLIC_REPORT_OPERATION_IDS.map(id=>({id,version:'0.2.0',contextKeys:[],normalize:(_,request)=>v.normalizePublicReportsInput(id,request),outputAssert:(_,value,request)=>v.assertPublicReportsOutput(id,value,request)}));
 const catalog={operations:bindings.map(b=>({operation:{id:b.id,version:b.version},handler:null,status:'unavailable'}))};
 const resolver=createOperationContracts({catalog,bindings,validators:v,assertCatalog(){},canonicalSha256});
 const contract=resolver.resolveOperationContract({id:cbo,version:'0.2.0'}),request={billId:' HR1-119 '},normalized=contract.normalizeInput(request);
 assert.deepEqual(normalized.request,request);assert.ok(Object.isFrozen(normalized.request));assert.deepEqual(normalized.input,{billId:'hr1-119',limit:10});assert.equal(normalized.argumentsSha256,canonicalSha256(normalized.input));
 const p=result(cbo,0);p.note=specificNote('HR1-119');contract.assertOutput(p,{request:normalized.request});
 for(const context of [{actorId:'synthetic'},{asOf:stamp},{nowMs:1},{previousPage:{}}])assert.throws(()=>contract.normalizeInput(request,context));
 assert.throws(()=>contract.assertOutput(p,{}));assert.throws(()=>contract.assertOutput(p,{request:normalized.request,asOf:stamp}));
});
