import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createTrackedBillsValidators} from '../retrieval-0.2/tracked-bills-validation.mjs';

// Test-only compiler; canonical registry/loader changes remain root-owned.
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const schema=read('../retrieval-0.2/tracked-bills.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const s of [read('../meri.schema.json'),read('../retrieval-0.2/common.schema.json'),schema])ajv.addSchema(s);
const compiled=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const validateShape=(name,value)=>{const fn=compiled.get(name);assert.ok(fn(value),ajv.errorsText(fn.errors));return value;};
const {normalizeTrackedBillsInput:normalize,assertTrackedBillsResult:check}=createTrackedBillsValidators({validateShape,assertSubject,canonicalSha256});
const UUID='12345678-1234-4234-8234-123456789abc',OTHER='22222222-2222-4222-8222-222222222222';
const NOW='2026-10-12T00:00:00.000Z',OLD='2026-10-11T00:00:00.000Z';
const raw=()=>({clientId:'Synthetic client'});
const context=()=>({binding:{tenantId:'tenant',actorId:'actor',conversationId:UUID,runId:UUID,attemptId:UUID,workerId:UUID,writerFence:1},
 subject:{kind:'client',entityType:'client',entityIds:[UUID],tenantId:'tenant',actorId:'actor',authorizationDecisionId:UUID,policyRevision:'policy',rosterVersionId:null,scopes:[{tenantId:'tenant',kind:'client',resourceId:UUID,policyRevision:'policy'}]},clientReference:'Synthetic client'});
const bill=()=>({identifier:'bill:us:119:hr:1',title:'Synthetic title',latestActionDate:null,latestActionText:null,status:null,actionTexts:[],sponsorName:null,sponsorParty:null,subjectNames:[]});
const row=(id=UUID,billId='bill:us:119:hr:1')=>({id,billId,note:null,createdAt:NOW,bill:{...bill(),identifier:billId}});
const page=(rows=[row()])=>{const ctx=context();return {binding:ctx.binding,subject:ctx.subject,data:{tool:'search_tracked_bills',generatedAt:NOW,clientId:UUID,total:rows.length,bills:rows}};};

test('normalization binds original name reference to canonical current client identity',()=>{
 assert.deepEqual(normalize(raw(),context()),{clientId:UUID});
 assert.deepEqual(normalize({clientId:'  Synthetic client  '},context()),{clientId:UUID});
 check(page(),raw(),context());
});
test('UUID lookup must match resolved UUID case-insensitively',()=>{
 const ctx=context();ctx.clientReference=UUID.toUpperCase();assert.deepEqual(normalize({clientId:ctx.clientReference},ctx),{clientId:UUID});
 ctx.clientReference=OTHER;assert.throws(()=>normalize({clientId:OTHER},ctx));
});
test('raw reference correlation cannot be substituted by asserted subject identity',()=>{
 const ctx=context();ctx.clientReference='Other client';assert.throws(()=>normalize(raw(),ctx));
 assert.throws(()=>normalize({clientId:UUID},context()));
});
test('source80UTF16 normalization is explicit and must equal retained reference',()=>{
 const ctx=context();ctx.clientReference='😀'.repeat(40);assert.deepEqual(normalize({clientId:'  '+'😀'.repeat(41)+'  '},ctx),{clientId:UUID});
 ctx.clientReference='x'.repeat(79)+' ';assert.deepEqual(normalize({clientId:'x'.repeat(79)+' y'},ctx),{clientId:UUID});
});
test('blank, wrong-type, absent and extra selector fields fail before effects',()=>{
 for(const request of [{},{clientId:''},{clientId:'   '},{clientId:null},{clientId:7},{clientId:[]},{...raw(),limit:50},{...raw(),page:1},{...raw(),cursor:'x'},{...raw(),tenantId:'other'}])assert.throws(()=>normalize(request,context()));
 assert.throws(()=>normalize({clientId:'x'.repeat(16385)},context()));
});
test('trusted context is required and closed without model role or grants',()=>{
 for(const ctx of [{},null,[],{...context(),authorized:true},{...context(),role:'admin'},{...context(),resolutionComplete:true}])assert.throws(()=>normalize(raw(),ctx));
 for(const key of ['binding','subject','clientReference']){const ctx=context();delete ctx[key];assert.throws(()=>normalize(raw(),ctx));}
});
test('canonical subject must be one client, with tenant actor and policy lineage',()=>{
 for(const mutate of [x=>x.subject.kind='personal',x=>x.subject.entityType='person',x=>x.subject.entityIds.push(OTHER),x=>x.subject.tenantId='other',x=>x.subject.actorId='other',x=>x.subject.scopes[0].policyRevision='other',x=>x.subject.scopes[0].tenantId='other',x=>x.subject.entityIds=['not-uuid']]){const ctx=context();mutate(ctx);assert.throws(()=>normalize(raw(),ctx));}
});
test('canonical structural scope limitations are not silently promoted into policy',()=>{
 const ctx=context();ctx.subject.scopes[0].resourceId=OTHER;
 // Existing assertSubject does not authorize resource membership. A live owner
 // must verify it; this family neither widens nor replaces that policy engine.
 assert.deepEqual(normalize(raw(),ctx),{clientId:UUID});
});
test('binding and subject evidence wrapper must exactly match trusted context',()=>{
 for(const mutate of [x=>x.binding.runId=OTHER,x=>x.binding.writerFence=2,x=>x.subject.authorizationDecisionId=OTHER,x=>x.subject.policyRevision='other',x=>x.subject.scopes[0].resourceId=OTHER]){const p=page();mutate(p);assert.throws(()=>check(p,raw(),context()));}
 assert.throws(()=>check(page().data,raw(),context()));
});
test('result wrapper and source client identity cannot be substituted',()=>{
 const p=page();p.data.clientId=OTHER;assert.throws(()=>check(p,raw(),context()));
 const q=page();q.clientReference='Synthetic client';assert.throws(()=>check(q,raw(),context()));
});
test('empty tracked set preserves complete returned count with no absence proof',()=>{
 check(page([]),raw(),context());
 const p=page([]);p.data.total=1;assert.throws(()=>check(p,raw(),context()));
 p.data.total=0;p.data.evidenceOfAbsence=true;assert.throws(()=>check(p,raw(),context()));
});
test('null global enrichment preserves outer identity note date and count',()=>{
 const r=row();r.bill=null;r.note='Unresolved global join';check(page([r]),raw(),context());
 const p=page([r]);delete p.data.bills[0].bill;assert.throws(()=>check(p,raw(),context()));
});
test('enrichment identity must exactly correlate even for opaque stored bill IDs',()=>{
 check(page([row(UUID,'opaque:source:id')]),raw(),context());check(page([row(UUID,'')]),raw(),context());
 const p=page();p.data.bills[0].bill.identifier='bill:us:119:s:2';assert.throws(()=>check(p,raw(),context()));
});
test('all nine nested projected fields are required despite broad optional TS annotation',()=>{
 for(const key of Object.keys(bill())){const p=page();delete p.data.bills[0].bill[key];assert.throws(()=>check(p,raw(),context()),key);}
});
test('exact stored nullable and array types reject unspecific objects',()=>{
 for(const key of ['latestActionDate','latestActionText','status','sponsorName','sponsorParty']){const p=page();p.data.bills[0].bill[key]={};assert.throws(()=>check(p,raw(),context()),key);}
 for(const key of ['actionTexts','subjectNames'])for(const value of [null,{},[null],[7]]){const p=page();p.data.bills[0].bill[key]=value;assert.throws(()=>check(p,raw(),context()),key);}
 for(const key of ['identifier','title']){const p=page();p.data.bills[0].bill[key]=null;assert.throws(()=>check(p,raw(),context()),key);}
});
test('stored text/status strings are not a fabricated legislature enum',()=>{
 const p=page();Object.assign(p.data.bills[0].bill,{title:'',status:'unrecognized source status',latestActionText:'',sponsorName:'',sponsorParty:'Other',actionTexts:['repeat','repeat',''],subjectNames:['B','A','B']});check(p,raw(),context());
});
test('action and subject lists have no invented15 or50 cap or ordering',()=>{
 const p=page();p.data.bills[0].bill.actionTexts=Array.from({length:80},(_,i)=>String(i));p.data.bills[0].bill.subjectNames=Array.from({length:80},(_,i)=>String(80-i));check(p,raw(),context());
});
test('tracking createdAt descends with equal-time arbitrary tie order',()=>{
 const a=row(UUID),b=row(OTHER,'other');b.createdAt=OLD;check(page([a,b]),raw(),context());
 assert.throws(()=>check(page([b,a]),raw(),context()));b.createdAt=NOW;check(page([b,a]),raw(),context());
});
test('tracking creation is timestamp while global action date is SQL midnight',()=>{
 const p=page();p.data.bills[0].createdAt='2026-10-12T11:22:33.123Z';p.data.bills[0].bill.latestActionDate=OLD;check(p,raw(),context());
 p.data.bills[0].bill.latestActionDate='2026-10-12T11:22:33.123Z';assert.throws(()=>check(p,raw(),context()));
});
test('admitted timestamps are finite canonical four-digit UTC serialization',()=>{
 for(const value of ['2026-02-30T00:00:00.000Z','2026-10-12T00:00:00Z','2026-10-12T01:00:00.000+01:00','2016-12-31T23:59:60Z','+010000-01-01T00:00:00.000Z']){
  const p=page();p.data.generatedAt=value;assert.throws(()=>check(p,raw(),context()));p.data.generatedAt=NOW;p.data.bills[0].createdAt=value;assert.throws(()=>check(p,raw(),context()));
 }
});
test('tracking primary UUID and client/bill unique keys are retained',()=>{
 assert.throws(()=>check(page([row(),row(UUID.toUpperCase(),'different')]),raw(),context()));
 assert.throws(()=>check(page([row(),row(OTHER)]),raw(),context()));
 const p=page();p.data.bills[0].id='opaque';assert.throws(()=>check(p,raw(),context()));
});
test('returned total is exact and has no invented50-row window',()=>{
 const rows=Array.from({length:75},(_,i)=>row(`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,`bill-${i}`));
 check(page(rows),raw(),context());
 const p=page(rows);p.data.total=74;assert.throws(()=>check(p,raw(),context()));p.data.total=76;assert.throws(()=>check(p,raw(),context()));
});
test('whole response admission refuses overbudget source data rather than truncating',()=>{
 const p=page();p.data.bills[0].bill.title='x'.repeat(16*1024*1024+1);assert.throws(()=>check(p,raw(),context()),/byte limit/);
});
test('row and nested objects are closed with no model authority or private columns',()=>{
 for(const [place,key] of [['data','limit'],['data','cursor'],['row','tenantId'],['row','source'],['bill','url'],['bill','currentVisibility'],['bill','approved']]){
  const p=page(),target=place==='data'?p.data:place==='row'?p.data.bills[0]:p.data.bills[0].bill;target[key]=true;assert.throws(()=>check(p,raw(),context()));
 }
});
test('direct inert admission rejects caller getters proxies hidden fields and coercion',()=>{
 let effects=0;const proxy=new Proxy({}, {get(){effects++;throw Error('trap');},ownKeys(){effects++;throw Error('trap');}});
 const getter={get clientId(){effects++;return UUID;}};
 for(const request of [proxy,getter,{clientId:{toString(){effects++;return UUID;}}},Object.create({clientId:UUID})])assert.throws(()=>normalize(request,context()));
 assert.throws(()=>normalize(raw(),proxy));assert.throws(()=>check(proxy,raw(),context()));
 const p=page();Object.defineProperty(p.data.bills[0].bill,'title',{get(){effects++;return 'x';},enumerable:true});assert.throws(()=>check(p,raw(),context()));assert.equal(effects,0);
});
test('symbol and hidden input properties refuse; requests/context/results remain unchanged',()=>{
 for(const r of [{...raw(),[Symbol('hidden')]:1},Object.defineProperty(raw(),'hidden',{value:1})])assert.throws(()=>normalize(r,context()));
 const r=raw(),ctx=context(),p=page(),before=structuredClone({r,ctx,p});normalize(r,ctx);assert.equal(check(p,r,ctx),p);assert.deepEqual({r,ctx,p},before);
});

test('returned validated snapshot survives mutation of original caller data',()=>{
 const original=page(),accepted=check(original,raw(),context());
 original.data.clientId=OTHER;original.data.bills[0].bill.title='Changed after validation';
 assert.equal(accepted.data.clientId,UUID);assert.equal(accepted.data.bills[0].bill.title,'Synthetic title');
 assert.notEqual(accepted,original);
});
