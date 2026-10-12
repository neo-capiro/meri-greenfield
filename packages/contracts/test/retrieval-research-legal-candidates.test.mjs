import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createResearchLegalCandidatesValidators,RESEARCH_LEGAL_CANDIDATES_OPERATION_IDS} from '../retrieval-0.2/research-legal-candidates-validation.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/research-legal-candidates.schema.json',import.meta.url)));
const outreach=JSON.parse(readFileSync(new URL('../retrieval-0.2/outreach-query.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(outreach);ajv.addSchema(schema);
const shapes=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createResearchLegalCandidatesValidators({schema,validateShape(name,value){const check=shapes.get(name);if(!check?.(value))throw Error(ajv.errorsText(check?.errors));}});
const operation='search_research_sources',at='2026-10-12T12:00:00.000Z';
const uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const types=['client','meeting','mail_thread','mail_message','clio_note','directory_contact_note'];
const context={clientResolution:null};
const resolution=(reference,clientId=uuid(1))=>({clientResolution:{reference,clientId}});
const normalize=(request={query:'evidence'},ctx=context)=>v.normalizeResearchLegalCandidatesInput(operation,request,ctx);
const row=(type,n=types.indexOf(type)+1)=>({type,id:uuid(n),clientId:type==='directory_contact_note'?null:uuid(type==='client'?n:1),title:'Stored title',snippet:'Hidden source may match',occurredAt:at,...(type==='mail_message'?{metadata:{threadId:uuid(10)}}:type==='directory_contact_note'?{metadata:{directoryContactId:'opaque directory key'}}:{})});
const page=(results=types.map(type=>row(type)))=>({tool:operation,query:'evidence',generatedAt:at,results});
const check=(value,request={query:'evidence'},ctx=context)=>v.assertResearchLegalCandidatesOutput(operation,value,request,ctx);

test('one exact family and canonical resolution shape',()=>{
 assert.deepEqual(RESEARCH_LEGAL_CANDIDATES_OPERATION_IDS,[operation]);assert.ok(Object.isFrozen(RESEARCH_LEGAL_CANDIDATES_OPERATION_IDS));
 assert.equal(v.researchLegalCandidatesSchemaId,schema.$id);assert.equal(v.researchLegalCandidatesInputDefinition(operation),'ResearchLegalCandidatesInput');assert.equal(v.researchLegalCandidatesOutputDefinition(operation),'ResearchLegalCandidatesOutput');
 assert.equal(schema.$defs.ResearchLegalCandidatesContext.$ref,`${outreach.$id}#/$defs/OutreachQueryContext`);
});
test('operation and definition selectors refuse hostile coercion without hooks',()=>{
 let calls=0;const evil={[Symbol.toPrimitive](){calls++;return operation;},toString(){calls++;return operation;}};
 for(const id of [evil,'constructor','get_research_evidence',null]){assert.throws(()=>v.normalizeResearchLegalCandidatesInput(id,{query:'x'},context));assert.throws(()=>v.researchLegalCandidatesInputDefinition(id));assert.throws(()=>v.researchLegalCandidatesOutputDefinition(id));}
 assert.throws(()=>v.validateResearchLegalCandidatesShape(evil,{}));assert.equal(calls,0);
});
test('required query and explicit nullable client/default limit',()=>{
 assert.deepEqual(normalize({query:' evidence '}).input,{query:'evidence',clientId:null,limit:8});
 for(const request of [{},{query:null},{query:''},{query:' \n '},{query:1}])assert.throws(()=>normalize(request));
 for(const clientId of [null,'',' \n '])assert.equal(normalize({query:'evidence',clientId}).input.clientId,null);
});
test('query retains wrapper UTF16 clipping without unproved second trim',()=>{
 const query='x'.repeat(239)+' y';assert.equal(normalize({query}).input.query,'x'.repeat(239)+' ');
 assert.equal(normalize({query:'x'.repeat(239)+'😀tail'}).input.query,'x'.repeat(239)+'\ud83d');
 const p=page([]);p.query='x'.repeat(239)+' ';check(p,{query});
});
test('source finite numeric and string limit truncation/clamp is preserved',()=>{
 for(const [limit,wanted] of [[null,8],['not a number',8],['',1],['3.9',3],[0,1],[-3,1],[99,25],[1.9,1],['1e1',10]])assert.equal(normalize({query:'x',limit}).input.limit,wanted);
 for(const limit of [false,[],{},NaN,Infinity,undefined])assert.throws(()=>normalize({query:'x',limit}));
});
test('closed typed requests reject invented authority and legacy object coercion',()=>{
 for(const key of ['tenantId','actorId','clientResolution','scope','source','cursor','limitSql'])assert.throws(()=>normalize({query:'evidence',[key]:'x'}));
 for(const clientId of [false,1,{},[]])assert.throws(()=>normalize({query:'x',clientId}));
});
test('context is mandatory and closed, even without client',()=>{
 for(const ctx of [undefined,{},null,[],{clientResolution:null,actor:'x'}])assert.throws(()=>v.normalizeResearchLegalCandidatesInput(operation,{query:'x'},ctx));
 assert.throws(()=>normalize({query:'x'},resolution('Client')));
});
test('name selectors require exact trusted resolution, never infer authority',()=>{
 assert.equal(normalize({query:'x',clientId:' Client '},resolution('Client')).input.clientId,uuid(1));
 assert.throws(()=>normalize({query:'x',clientId:'Client'}));assert.throws(()=>normalize({query:'x',clientId:'Client'},resolution('Other')));
 const input=normalize({query:'x',clientId:'x'.repeat(79)+' rest'},resolution('x'.repeat(79))).input;assert.equal(input.clientId,uuid(1));
});
test('explicit UUID permits case equivalence but never rebinding',()=>{
 const upper='ABCDEF00-0000-0000-0000-000000000001';assert.equal(normalize({query:'x',clientId:upper},resolution(upper,upper.toLowerCase())).input.clientId,upper.toLowerCase());
 assert.throws(()=>normalize({query:'x',clientId:uuid(1)},resolution(uuid(1),uuid(2))));
});
test('six exact candidate variants are admitted without total or absence proof',()=>{check(page());check(page([]));assert.equal(normalize().metadata.complete,false);assert.equal(normalize().metadata.absenceEvidence,false);});
test('each projected member is mandatory and rows are closed',()=>{
 for(const type of types){const original=row(type);for(const key of Object.keys(original)){const value=structuredClone(original);delete value[key];assert.throws(()=>check(page([value])));}
 const extra={...original,current:true};assert.throws(()=>check(page([extra])));}
 for(const key of ['total','cursor','complete','sourceConnected'])assert.throws(()=>check({...page([]),[key]:0}));
});
test('metadata is exact and only projected for mail messages and directory notes',()=>{
 for(const type of types.slice(0,3).concat('clio_note'))assert.throws(()=>check(page([{...row(type),metadata:{}}])));
 for(const type of ['mail_message','directory_contact_note']){const r=row(type);r.metadata.extra='x';assert.throws(()=>check(page([r])));}
 const r=row('directory_contact_note');r.metadata.directoryContactId='';r.title='';check(page([r]));
});
test('raw titles remain stored strings and are not forced to match hidden query text',()=>{
 const p=page();for(const r of p.results){r.title=' \n Arbitrary stored title ';r.snippet='';}check(p);
 const p2=page([row('client')]);p2.results[0].title='';check(p2);
 assert.throws(()=>check(page([{...row('clio_note'),title:''}])));
});
test('source table UUIDs are typed while cross-family identity overlap is valid',()=>{
 const p=page([row('client',1),row('meeting',1)]);check(p);
 for(const key of ['id','clientId']){const p2=page([row('client')]);p2.results[0][key]='opaque';assert.throws(()=>check(p2));}
 const r=row('mail_message');r.metadata.threadId='opaque';assert.throws(()=>check(page([r])));
});
test('same-family PK duplicates reject including case aliases',()=>{
 const a=row('meeting');const b={...a};assert.throws(()=>check(page([a,b])));
 a.id='abcdef00-0000-0000-0000-000000000001';b.id=a.id.toUpperCase();assert.throws(()=>check(page([a,b])));
});
test('client rows identify themselves; nonclient rows retain null client when unscoped',()=>{
 const p=page();for(const r of p.results)if(r.type!=='client')r.clientId=null;check(p);
 assert.throws(()=>check(page([{...row('client'),clientId:uuid(9)}])));
});
test('selected client filters five branches while directory notes remain tenant-wide',()=>{
 const p=page();check(p,{query:'evidence',clientId:'Client'},resolution('Client'));
 for(const type of types.slice(0,5)){const r=row(type);r.clientId=uuid(9);if(type==='client')r.id=uuid(9);assert.throws(()=>check(page([r]),{query:'evidence',clientId:'Client'},resolution('Client')));}
 const directory=row('directory_contact_note');check(page([directory]),{query:'evidence',clientId:'Client'},resolution('Client'));directory.clientId=uuid(1);assert.throws(()=>check(page([directory])));
});
test('per-branch window and final three-times limit are independent bounds',()=>{
 check(page(types.slice(0,3).map(type=>row(type))),{query:'evidence',limit:1});
 assert.throws(()=>check(page(types.slice(0,4).map(type=>row(type))),{query:'evidence',limit:1}));
 assert.throws(()=>check(page([row('meeting',10),row('meeting',11)]),{query:'evidence',limit:1}));
 check(page([row('meeting',10),row('meeting',11)]),{query:'evidence',limit:2});
});
test('generatedAt is independent of source chronology and currentness',()=>{
 for(const generatedAt of ['1900-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z'])check({...page(),generatedAt});
 const p=page([row('meeting')]);p.results[0].occurredAt='2099-01-01T00:00:00.000Z';check(p);
});
test('only mail-message occurredAt may be null, sorting null as epoch zero',()=>{
 for(const type of types){const r=row(type);r.occurredAt=null;if(type==='mail_message')check(page([r]));else assert.throws(()=>check(page([r])));}
 const message={...row('mail_message'),occurredAt:null};const before={...row('meeting'),occurredAt:'1969-12-31T23:59:59.000Z'};
 check(page([message,before]));assert.throws(()=>check(page([before,message])));
});
test('descending source times and equal-time stable family order are retained',()=>{
 const a=row('meeting'),b={...row('client'),occurredAt:'2026-10-11T12:00:00.000Z'};check(page([a,b]));assert.throws(()=>check(page([b,a])));
 check(page());assert.throws(()=>check(page(types.toReversed().map(type=>row(type)))));
 const m1=row('meeting',50),m2=row('meeting',2);check(page([m1,m2])); // No source PK tie order declared.
});
test('snippet is normalized and capped by UTF16, with no invented ellipsis rule',()=>{
 for(const snippet of ['', 'a'.repeat(360), 'a'.repeat(357)+'...', 'a'.repeat(356)+'\ud83d...'])check(page([{...row('client'),snippet}]));
 for(const snippet of [' x','x ','x\nx','x  x','😀'.repeat(181)])assert.throws(()=>check(page([{...row('client'),snippet}])));
});
test('canonical wire dates intentionally exclude invalid and alternative serialization',()=>{
 for(const date of ['invalid','2026-02-30T00:00:00.000Z','2026-10-12T12:00:00Z','2026-10-12T12:00:00.000+00:00','+010000-01-01T00:00:00.000Z']){
 assert.throws(()=>check({...page([]),generatedAt:date}));assert.throws(()=>check(page([{...row('meeting'),occurredAt:date}])));}
});
test('query echo and operation cannot substitute a superficially matching result',()=>{
 assert.throws(()=>check({...page([]),query:'Evidence'}));assert.throws(()=>check({...page([]),tool:'get_research_evidence'}));
});
test('inert admission rejects accessors, proxies and mutation hooks before running them',()=>{
 let calls=0;const request={get query(){calls++;return'evidence';}};assert.throws(()=>normalize(request));
 const p=page([]);Object.defineProperty(p,'results',{get(){calls++;return[];},enumerable:true});assert.throws(()=>check(p));
 const ctx={get clientResolution(){calls++;return null;}};assert.throws(()=>normalize({query:'x'},ctx));
 assert.throws(()=>normalize(new Proxy({query:'x'},{get(){calls++;return'x';}})));assert.equal(calls,0);
});
test('inputs and contexts are untouched; normalized values frozen and returned pages detached',()=>{
 const request={query:' evidence ',clientId:'Client'},ctx=resolution('Client'),saved=structuredClone({request,ctx});
 const n=normalize(request,ctx);assert.ok(Object.isFrozen(n)&&Object.isFrozen(n.input)&&Object.isFrozen(n.metadata));assert.deepEqual({request,ctx},saved);
 const p=page(),output=check(p,request,ctx);assert.notEqual(output,p);assert.notEqual(output.results,p.results);output.results[0].title='changed';assert.equal(p.results[0].title,'Stored title');
});
test('source authority flags remain false independently of valid result shape',()=>{
 const m=normalize().metadata;for(const key of ['sourceConnected','producerQualified','authorizationEstablished','absenceEvidence','complete'])assert.equal(m[key],false);
 assert.match(m.coverage,/tenant directory notes/);check(page([]));
});
