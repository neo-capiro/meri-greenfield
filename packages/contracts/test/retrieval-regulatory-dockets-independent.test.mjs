import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createRegulatoryDocketsValidators,REGULATORY_DOCKETS_OPERATION_IDS} from '../retrieval-0.2/regulatory-dockets-validation.mjs';

const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/regulatory-dockets.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const compiled=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createRegulatoryDocketsValidators({schema,validateShape(name,value){const f=compiled.get(name);if(!f?.(value))throw new Error(`${name}: ${ajv.errorsText(f?.errors)}`);return value;}});
const id='query_regulatory_dockets',stamp='2026-10-12T00:00:00.000Z';
const row=(extra={})=>({id:'synthetic-row',documentId:'synthetic-document',agencyId:'RAW Agency',docketId:null,documentType:'Unknown stored type',title:'Synthetic docket',postedDate:null,commentStartDate:null,commentEndDate:null,frDocNum:null,subtype:null,withdrawn:false,lastModified:null,syncedAt:stamp,...extra});
const page=(rows=[row()],total=rows.length)=>({tool:id,generatedAt:stamp,total,results:rows});
const upcoming=(rows=[row({commentEndDate:stamp})],total=rows.length,days=30)=>({...page(rows,total),windowDays:days});
const normalize=request=>v.normalizeRegulatoryDocketsInput(id,request);
const check=(value=page(),request={})=>v.assertRegulatoryDocketsOutput(id,value,request);
const upcomingRequest={upcomingOnly:true};
const fields=['id','documentId','agencyId','docketId','documentType','title','postedDate','commentStartDate','commentEndDate','frDocNum','subtype','withdrawn','lastModified','syncedAt'];

test('independent dockets: only one operation and exact private definitions',()=>{
 assert.deepEqual([...REGULATORY_DOCKETS_OPERATION_IDS],[id]);
 assert.equal(v.regulatoryDocketsInputDefinition(id),'RegulatoryDocketsQueryInput');assert.equal(v.regulatoryDocketsOutputDefinition(id),'RegulatoryDocketsQueryOutput');
 for(const invalid of ['constructor','__proto__','get_state_rule_status',''])for(const fn of [v.regulatoryDocketsInputDefinition,v.regulatoryDocketsOutputDefinition])assert.throws(()=>fn(invalid));
});
test('independent dockets: normalization defaults and branch-only default window',()=>{
 assert.deepEqual(normalize({}).input,{upcomingOnly:false,limit:20});
 assert.deepEqual(normalize({upcomingOnly:null}).input,{upcomingOnly:false,limit:20});
 assert.deepEqual(normalize({upcomingOnly:true}).input,{upcomingOnly:true,limit:20,days:30});
 assert.deepEqual(normalize({days:365}).input,{upcomingOnly:false,limit:20,days:365});
});
test('independent dockets: approved strict integers reject legacy coercion and clamping',()=>{
 for(const key of ['limit','days'])for(const value of [null,'2','',true,1.1,NaN,Infinity,0,-1,{},[]])assert.throws(()=>normalize({[key]:value}));
 assert.throws(()=>normalize({limit:51}));assert.throws(()=>normalize({days:366}));
 assert.equal(normalize({limit:1}).input.limit,1);assert.equal(normalize({limit:50,days:365}).input.days,365);
 for(const value of ['true',1,{},[]])assert.throws(()=>normalize({upcomingOnly:value}));
});
test('independent dockets: selectors trim case-preserving UTF16 slices and omit blank/null',()=>{
 assert.deepEqual(normalize({agencyId:null,documentType:' '}).input,{upcomingOnly:false,limit:20});
 const normalized=normalize({agencyId:' aBc ',documentType:' Unmapped ',upcomingOnly:true});
 assert.equal(normalized.input.agencyId,'aBc');assert.equal(normalized.input.documentType,'Unmapped');
 assert.equal(normalize({agencyId:'😀'.repeat(30)}).input.agencyId.length,40);
 assert.equal(normalize({documentType:'x'.repeat(81)}).input.documentType.length,80);
 for(const field of ['agencyId','documentType'])for(const value of [2,true,{},[]])assert.throws(()=>normalize({[field]:value}));
});
test('independent dockets: no model paging, tenant, source clock or authority fields',()=>{
 for(const key of ['page','cursor','tenantId','actorId','source','subject','binding','serviceAsOf','generatedAt','sql','authorized'])assert.throws(()=>normalize({[key]:'synthetic'}));
});
test('independent dockets: ordinary count is independent even for zero with returned rows',()=>{
 check(page([row()],0));check(page([],90));check(page([row()],90));
 for(const count of [-1,1.5,'1',null])assert.throws(()=>check(page([],count)));
});
test('independent dockets: ordinary exact filters use normalized selectors without rewriting rows',()=>{
 check(page(),{agencyId:' RAW Agency ',documentType:' Unknown stored type '});
 assert.throws(()=>check(page(),{agencyId:'raw agency'}));assert.throws(()=>check(page(),{documentType:'unknown stored type'}));
});
test('independent dockets: ordinary limit is independent of total',()=>{
 const rows=Array.from({length:3},(_,i)=>row({id:String(i),documentId:'doc'+i}));check(page(rows,0),{limit:3});assert.throws(()=>check(page(rows,0),{limit:2}));
});
test('independent dockets: ordinary descending nonnull dates retain explicit null-placement limitation',()=>{
 const later=row({id:'later',documentId:'later',postedDate:'2026-10-02T00:00:00.000Z'}),earlier=row({id:'earlier',documentId:'earlier',postedDate:'2026-10-01T00:00:00.000Z'});
 for(const rows of [[row(),later,earlier],[later,row(),earlier],[later,earlier,row()]])check(page(rows));
 assert.throws(()=>check(page([earlier,row(),later])));
});
test('independent dockets: exact ordinary and upcoming envelope distinction',()=>{
 assert.throws(()=>check(upcoming()));assert.throws(()=>check(page(),upcomingRequest));
 check(upcoming(),upcomingRequest);assert.throws(()=>check(upcoming(undefined,1,31),upcomingRequest));
 for(const key of ['complete','nextCursor','agencyId','note','data']){const p=page();p[key]=null;assert.throws(()=>check(p));}
});
test('independent dockets: upcoming total is capped service window before exact wrapper slice',()=>{
 const rows=Array.from({length:3},(_,i)=>row({id:String(i),documentId:'doc'+i,commentEndDate:stamp}));
 check(upcoming(rows,50),{upcomingOnly:true,limit:3});
 assert.throws(()=>check(upcoming(rows,51),{upcomingOnly:true,limit:3}));
 assert.throws(()=>check(upcoming(rows,2),{upcomingOnly:true,limit:3}));
 assert.throws(()=>check(upcoming(rows.slice(0,2),3),{upcomingOnly:true,limit:3}));
 check(upcoming([],0),upcomingRequest);assert.throws(()=>check(upcoming([],1),upcomingRequest));
});
test('independent dockets: upcoming intentionally ignores ordinary filter selectors',()=>{
 check(upcoming(),{upcomingOnly:true,agencyId:'different',documentType:'different'});
});
test('independent dockets: upcoming nonwithdrawn and nonnull end dates are required',()=>{
 assert.throws(()=>check(upcoming([row()]),upcomingRequest));
 assert.throws(()=>check(upcoming([row({commentEndDate:stamp,withdrawn:true})]),upcomingRequest));
 check(page([row({withdrawn:true})]));
});
test('independent dockets: upcoming order allows equal dates but refuses descending',()=>{
 const early=row({commentEndDate:stamp}),late=row({id:'late',documentId:'late',commentEndDate:'2026-10-13T00:00:00.000Z'});
 check(upcoming([early,late]),upcomingRequest);assert.throws(()=>check(upcoming([late,early]),upcomingRequest));
 late.commentEndDate=stamp;check(upcoming([early,late]),upcomingRequest);
});
test('independent dockets: elapsed day span boundary includes equality and refuses one millisecond over',()=>{
 const first=row({commentEndDate:'2026-03-08T08:00:00.000Z'}),last=row({id:'last',documentId:'last',commentEndDate:'2026-03-09T08:00:00.000Z'});
 check(upcoming([first,last],2,1),{upcomingOnly:true,days:1});
 last.commentEndDate='2026-03-09T08:00:00.001Z';assert.throws(()=>check(upcoming([first,last],2,1),{upcomingOnly:true,days:1}));
});
test('independent dockets: generatedAt proves neither service window nor current eligibility',()=>{
 for(const generatedAt of ['1900-01-01T00:00:00.000Z','2099-12-31T00:00:00.000Z']){const p=upcoming();p.generatedAt=generatedAt;check(p,upcomingRequest);}
});
test('independent dockets: all fourteen raw projected fields stay required',()=>{
 assert.deepEqual(Object.keys(row()).sort(),[...fields].sort());
 for(const field of fields){const r=row();delete r[field];assert.throws(()=>check(page([r])));}
 const r=row();r.raw={};assert.throws(()=>check(page([r])));
});
test('independent dockets: generic storage IDs and free values have no invented UUID or enums',()=>{
 check(page([row({id:'not-a-uuid',documentId:'',agencyId:'',documentType:'new stored type',title:'',docketId:'',frDocNum:'',subtype:'unmapped'})]));
 for(const field of ['id','documentId','agencyId','documentType','title'])assert.throws(()=>check(page([row({[field]:null})])));
});
test('independent dockets: stored time relationships are not invented',()=>{
 check(page([row({postedDate:'2100-01-01T00:00:00.000Z',commentStartDate:'2090-01-01T00:00:00.000Z',commentEndDate:'2000-01-01T00:00:00.000Z',lastModified:'2200-01-01T00:00:00.000Z',syncedAt:'1900-01-01T00:00:00.000Z'})]));
});
test('independent dockets: raw dates require declared canonical JSON instants',()=>{
 for(const field of ['postedDate','commentStartDate','commentEndDate','lastModified','syncedAt'])for(const value of ['invalid','2026-02-30T00:00:00.000Z','2026-10-12','2026-10-12T00:00:00Z'])assert.throws(()=>check(page([row({[field]:value})])));
 assert.throws(()=>check(page([row({syncedAt:null})])));const p=page();p.generatedAt='2026-02-30T00:00:00.000Z';assert.throws(()=>check(p));
});
test('independent dockets: primary and document IDs are unique within one result',()=>{
 assert.throws(()=>check(page([row(),row({documentId:'other'})])));assert.throws(()=>check(page([row(),row({id:'other'})])));
 check(page([row({id:'A',documentId:'A'}),row({id:'a',documentId:'a'})]));
});
test('independent dockets: caller snapshots stay unchanged and normalized bundle is frozen',()=>{
 const freeze=value=>{if(value&&typeof value==='object'){for(const x of Object.values(value))freeze(x);Object.freeze(value);}return value;};
 const input=freeze({agencyId:' RAW Agency '}),p=freeze(page()),saved=JSON.stringify([input,p]);const normalized=normalize(input);check(p,input);
 assert.notEqual(normalized.input,input);assert.ok(Object.isFrozen(normalized)&&Object.isFrozen(normalized.input)&&Object.isFrozen(normalized.metadata));assert.equal(JSON.stringify([input,p]),saved);
});
test('independent dockets: ambient clock is never read',()=>{
 const old=Date.now;let calls=0;Date.now=()=>{calls++;throw new Error('ambient clock');};try{normalize({});check();check(upcoming(),upcomingRequest);assert.equal(calls,0);}finally{Date.now=old;}
});
test('independent dockets: hostile request/result effects are rejected before access',()=>{
 let calls=0;const raw={get limit(){calls++;return 1;}};const p=page();Object.defineProperty(p,'results',{enumerable:true,get(){calls++;return[];}});
 assert.throws(()=>normalize(raw));assert.throws(()=>check(p));const proxy=new Proxy({}, {ownKeys(){calls++;return[];}});assert.throws(()=>normalize(proxy));assert.throws(()=>check(proxy));assert.equal(calls,0);
});
test('independent dockets: operation and shape selectors are rejected before coercion',()=>{
 let calls=0;const hostile={[Symbol.toPrimitive](){calls++;return id;},toString(){calls++;return id;}};
 for(const selector of [hostile,null,{},[],Symbol('id')]){
  for(const f of [v.regulatoryDocketsInputDefinition,v.regulatoryDocketsOutputDefinition])assert.throws(()=>f(selector));
  assert.throws(()=>v.normalizeRegulatoryDocketsInput(selector,{}));assert.throws(()=>v.assertRegulatoryDocketsOutput(selector,page(),{}));assert.throws(()=>v.validateRegulatoryDocketsShape(selector,{}));
 }assert.equal(calls,0);
});
test('independent dockets: cycles hidden data and foreign prototypes refuse inert admission',()=>{
 const cycle={};cycle.self=cycle;for(const input of [cycle,new Date(),Object.defineProperty({},'limit',{value:2})])assert.throws(()=>normalize(input));
 const p=page();p.results[0].title=new String('synthetic');assert.throws(()=>check(p));
});

test('independent dockets: metadata explicitly limits both count and current-window qualification',()=>{
 for(const [request,countScope] of [[{},'separate-local-count'],[{upcomingOnly:true},'bounded-service-window-before-limit']]){
  const metadata=normalize(request).metadata;
  assert.deepEqual(metadata,{authoritative:false,sourceConnected:false,producerQualified:false,absenceEvidence:false,currentWindowQualified:false,sourceScope:'stored-regulatory-dockets',countScope});
 }
});
test('independent dockets: direct output shape helper retains necessary window relationships',()=>{
 const p=upcoming([row({commentEndDate:stamp,withdrawn:true})]);
 assert.throws(()=>v.validateRegulatoryDocketsShape('RegulatoryDocketsQueryOutput',p));
 assert.throws(()=>v.validateRegulatoryDocketsShape('RegulatoryDocketsQueryOutput',upcoming(undefined,51)));
 v.validateRegulatoryDocketsShape('RegulatoryDocketsQueryOutput',page([row()],0));
});
