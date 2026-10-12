import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createResearchLegalCandidatesValidators} from '../retrieval-0.2/research-legal-candidates-validation.mjs';

const load = name => JSON.parse(readFileSync(new URL(`../retrieval-0.2/${name}.schema.json`, import.meta.url)));
const schema = load('research-legal-candidates'), ajv = new Ajv({strict: true, allErrors: true});
addFormats(ajv); ajv.addSchema(load('outreach-query')); ajv.addSchema(schema);
const shapes = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref: `${schema.$id}#/$defs/${name}`})]));
const v = createResearchLegalCandidatesValidators({schema, validateShape(name, value) {
  const check = shapes.get(name);
  if (!check?.(value)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);
}});
const ID = 'search_research_sources', at = '2026-10-12T12:00:00.000Z';
const uuid = n => `${n.toString(16).padStart(8, '0')}-abcd-1234-abcd-0123456789ab`;
const clientId = uuid(1), other = uuid(2), context = {clientResolution: null};
const types = ['client', 'meeting', 'mail_thread', 'mail_message', 'clio_note', 'directory_contact_note'];
function row(type, n = types.indexOf(type) + 10) {
  const r = {type, id: uuid(n), clientId: null, title: '', snippet: '', occurredAt: at};
  if (type === 'client') r.clientId = r.id;
  if (type === 'mail_message') {r.occurredAt = null; r.metadata = {threadId: uuid(100)};}
  if (type === 'clio_note') r.title = 'Meri note';
  if (type === 'directory_contact_note') r.metadata = {directoryContactId: 'opaque directory key'};
  return r;
}
const page = (results = []) => ({tool: ID, query: 'needle', generatedAt: at, results});
const norm = (raw = {query: 'needle'}, options = context) => v.normalizeResearchLegalCandidatesInput(ID, raw, options);
const check = (p = page(), raw = {query: 'needle'}, options = context) => v.assertResearchLegalCandidatesOutput(ID, p, raw, options);
const resolved = reference => ({clientResolution: {reference, clientId}});

test('independent research: schema namespace and exact operation selectors', () => {
  assert.equal(schema.$id, 'urn:meri:retrieval:research-legal-candidates:0.2.0');
  assert.equal(v.researchLegalCandidatesInputDefinition(ID), 'ResearchLegalCandidatesInput');
  assert.equal(v.researchLegalCandidatesOutputDefinition(ID), 'ResearchLegalCandidatesOutput');
  for (const id of ['__proto__', 'constructor', 'query_global_data', '']) {
    assert.throws(() => v.normalizeResearchLegalCandidatesInput(id, {}, context));
    assert.throws(() => v.researchLegalCandidatesOutputDefinition(id));
  }
});
test('independent research: detached frozen normalized defaults retain explicit null client', () => {
  const raw = {query: ' needle ', clientId: '  ', limit: null}, saved = structuredClone(raw), result = norm(raw);
  assert.deepEqual(result.input, {query: 'needle', clientId: null, limit: 8});
  assert.deepEqual(raw, saved); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.input));
  assert.ok(Object.isFrozen(result.metadata));
  for (const key of ['sourceConnected', 'producerQualified', 'authorizationEstablished', 'absenceEvidence', 'complete']) assert.equal(result.metadata[key], false);
});
test('independent research: missing or blank required query and unknown selectors refuse', () => {
  for (const raw of [{}, {query: null}, {query: ''}, {query: ' \n '}, {query: 7}, {query: 'x', sql: 'SELECT'}, {query: 'x', clientResolution: null}]) assert.throws(() => norm(raw));
});
test('independent research: query uses UTF16 clipping without an invented second trim', () => {
  assert.equal(norm({query: 'x'.repeat(239) + ' y'}).input.query, 'x'.repeat(239) + ' ');
  assert.equal(norm({query: 'x'.repeat(239) + '😀'}).input.query, 'x'.repeat(239) + '\ud83d');
});
test('independent research: numeric-string limits follow finite truncation clamp and fallback', () => {
  for (const [limit, expected] of [[-3,1],[99,25],[3.9,3],['',1],['0x10',16],['3.9',3],['nonsense',8],['Infinity',8],[null,8]]) assert.equal(norm({query:'needle',limit}).input.limit,expected);
  for (const limit of [true,false,[],{},Infinity,NaN,undefined]) assert.throws(() => norm({query:'needle',limit}));
});
test('independent research: trusted client resolution matches trimmed capped reference', () => {
  assert.equal(norm({query:'needle',clientId:'  named client  '},resolved('named client')).input.clientId,clientId);
  const text='x'.repeat(79)+' y'; assert.equal(norm({query:'needle',clientId:text},resolved('x'.repeat(79))).input.clientId,clientId);
  assert.throws(() => norm({query:'needle',clientId:'named client'}));
  assert.throws(() => norm({query:'needle',clientId:'named client'},resolved('other')));
  assert.throws(() => norm({query:'needle'},resolved('named client')));
});
test('independent research: supplied UUID cannot rebind, case-equivalent UUID can', () => {
  const raw={query:'needle',clientId:clientId.toUpperCase()};
  assert.equal(norm(raw,{clientResolution:{reference:clientId.toUpperCase(),clientId:clientId.toUpperCase()}}).input.clientId,clientId);
  assert.throws(() => norm(raw,{clientResolution:{reference:clientId.toUpperCase(),clientId:other}}));
});
test('independent research: context is required closed data and grants no extra authority', () => {
  for (const options of [{},null,{clientResolution:null,authorized:true},{clientResolution:{reference:'x',clientId,role:'admin'}}]) assert.throws(() => norm({query:'needle'},options));
  assert.throws(() => v.normalizeResearchLegalCandidatesInput(ID,{query:'needle'},undefined));
});
test('independent research: request and context accessors/proxies are rejected without execution', () => {
  let effects=0;const raw={};Object.defineProperty(raw,'query',{enumerable:true,get(){effects++;return 'needle';}});
  assert.throws(() => norm(raw));const ctx={};Object.defineProperty(ctx,'clientResolution',{enumerable:true,get(){effects++;return null;}});
  assert.throws(() => norm({query:'needle'},ctx));assert.throws(() => norm(new Proxy({query:'needle'},{get(){effects++;}})));assert.equal(effects,0);
  const cyclic={query:'needle'};cyclic.self=cyclic;assert.throws(() => norm(cyclic));
});
test('independent research: all six exact variants and metadata projections survive', () => {
  const rows=types.map(t=>row(t));rows.sort((a,b)=>(b.occurredAt===null?0:Date.parse(b.occurredAt))-(a.occurredAt===null?0:Date.parse(a.occurredAt)));
  assert.deepEqual(check(page(rows)),page(rows));
  for(const r of rows)for(const key of Object.keys(r)){const bad=structuredClone(r);delete bad[key];assert.throws(()=>check(page([bad])),`${r.type}.${key}`);}
});
test('independent research: candidate output is detached through metadata', () => {
  const p=page([row('mail_message')]), saved=structuredClone(p), out=check(p);
  assert.deepEqual(out,saved);assert.notEqual(out,p);assert.notEqual(out.results,p.results);assert.notEqual(out.results[0].metadata,p.results[0].metadata);
  p.results[0].metadata.threadId=other;assert.deepEqual(out,saved);
});
test('independent research: empty candidates are not a corpus or authorization claim', () => {
  check();for(const key of ['total','complete','hasMore','authorized','note']){const p=page();p[key]=key==='total'?0:true;assert.throws(()=>check(p));}
});
test('independent research: query echo and operation identity cannot substitute', () => {
  const p=page();p.query='other';assert.throws(()=>check(p));p.query='needle';p.tool='get_research_evidence';assert.throws(()=>check(p));
  check({...page(),query:'x'.repeat(239)+' '},{query:'x'.repeat(239)+' y'});
});
test('independent research: candidate caps enforce overall3limit and individual source limit', () => {
  const r=[row('client',10),row('meeting',11),row('clio_note',12)];check(page(r),{query:'needle',limit:1});
  assert.throws(()=>check(page([...r,row('directory_contact_note',13)]),{query:'needle',limit:1}));
  assert.throws(()=>check(page([row('meeting',11),row('meeting',12)]),{query:'needle',limit:1}));
});
test('independent research: row identity is per source kind, never global UUID uniqueness', () => {
  check(page([row('client',10),row('meeting',10)]));
  assert.throws(()=>check(page([row('meeting',10),row('meeting',10)])));
});
test('independent research: UUID scalar identities do not impose version4', () => {
  check(page([row('client')]));const bad=row('meeting');bad.id='opaque';assert.throws(()=>check(page([bad])));
  const m=row('mail_message');m.metadata.threadId='opaque';assert.throws(()=>check(page([m])));
  const d=row('directory_contact_note');d.metadata.directoryContactId='';d.title='';check(page([d]));
});
test('independent research: client row self-ID and resolved branch client correlation', () => {
  const c=row('client');c.clientId=other;assert.throws(()=>check(page([c])));
  for(const type of types.slice(0,5)){
    const r=row(type);r.clientId=clientId;if(type==='client')r.id=clientId;
    check(page([r]),{query:'needle',clientId:'name'},resolved('name'));
    r.clientId=other;if(type==='client')r.id=other;
    assert.throws(()=>check(page([r]),{query:'needle',clientId:'name'},resolved('name')),type);
  }
});
test('independent research: tenant directory notes intentionally escape requested client filter', () => {
  check(page([row('directory_contact_note')]),{query:'needle',clientId:'name'},resolved('name'));
  const r=row('directory_contact_note');r.clientId=clientId;assert.throws(()=>check(page([r]),{query:'needle',clientId:'name'},resolved('name')));
});
test('independent research: unscoped nullable clients retain ordinary String titles', () => {
  for(const type of types.slice(1)){const r=row(type);r.title=' \n ';check(page([r]));}
  for(const type of types){const r=row(type);r.title=null;assert.throws(()=>check(page([r])));}
});
test('independent research: snippets normalize whitespace and use360 UTF16 units', () => {
  for(const snippet of ['', 'x'.repeat(360), 'x'.repeat(357)+'...', 'x'.repeat(356)+'\ud83d...']) {const r=row('meeting');r.snippet=snippet;check(page([r]));}
  for(const snippet of [null,' leading','double  space','line\nbreak','x'.repeat(361),'😀'.repeat(181)]) {const r=row('meeting');r.snippet=snippet;assert.throws(()=>check(page([r])));}
});
test('independent research: only message timestamp is nullable', () => {
  check(page([row('mail_message')]));for(const type of types.filter(t=>t!=='mail_message')){const r=row(type);r.occurredAt=null;assert.throws(()=>check(page([r])));}
});
test('independent research: descending source time uses null as epoch0, not universally last', () => {
  const now=row('meeting'),none=row('mail_message',20),old=row('mail_message',21);old.occurredAt='1960-01-01T00:00:00.000Z';
  check(page([now,none,old]));assert.throws(()=>check(page([now,old,none])));assert.throws(()=>check(page([old,now])));
});
test('independent research: equal timestamp order retains original source concatenation order', () => {
  check(page([row('client'),row('meeting')]));assert.throws(()=>check(page([row('meeting'),row('client')])));
});
test('independent research: canonical date admission never uses generatedAt as currentness proof', () => {
  check({...page([row('meeting')]),generatedAt:'2000-01-01T00:00:00.000Z'});
  for(const value of ['invalid','2026-02-30T12:00:00.000Z','2026-10-12T12:00:00Z','+010000-01-01T00:00:00.000Z']){const r=row('meeting');r.occurredAt=value;assert.throws(()=>check(page([r])));}
});
test('independent research: unreturned matching text is not a title or snippet predicate', () => {
  const r=row('meeting');r.title='other';r.snippet='';check(page([r]));
});
test('independent research: metadata cannot smuggle source bodies or cross-kind fields', () => {
  for(const type of types){const r=row(type);r.body='hidden producer body';assert.throws(()=>check(page([r])));}
  const a=row('meeting');a.metadata={threadId:uuid(100)};assert.throws(()=>check(page([a])));
  const b=row('directory_contact_note');b.metadata.threadId=uuid(100);assert.throws(()=>check(page([b])));
});
test('independent research: hostile output data is rejected inertly', () => {
  let effects=0;const p=page();Object.defineProperty(p,'results',{enumerable:true,get(){effects++;return [];}});assert.throws(()=>check(p));assert.equal(effects,0);
  const q=page();q.results.push(q);assert.throws(()=>check(q));
});
test('independent research: empty note title cannot bypass the original nonempty fallback', () => {
  const r=row('clio_note');r.title='';assert.throws(()=>check(page([r])));
  r.title=' ';check(page([r]));
});

// Legal-owner controls frozen before its candidate is inspected.
import {createResearchLegalLegislationValidators} from '../retrieval-0.2/research-legal-legislation-validation.mjs';
const legalSchema=load('research-legal-legislation');ajv.addSchema(legalSchema);
const legalShapes=new Map(Object.keys(legalSchema.$defs).map(n=>[n,ajv.compile({$ref:`${legalSchema.$id}#/$defs/${n}`})]));
const legal=createResearchLegalLegislationValidators({schema:legalSchema,validateShape(n,x){const f=legalShapes.get(n);if(!f?.(x))throw Error(`${n}: ${ajv.errorsText(f?.errors)}`);}});
const SEARCH='search_legislative_research',REFERENCE='get_legal_reference';
const lc={clientResolution:null,citationResolution:null};
const ls={jurisdiction:'FL',sessionKey:'2026',folderId:null,clientId:null};
const sr={sessionKey:'2026'}, rr={sessionKey:'2026'};
const ln=(id=SEARCH,r=sr,c=lc)=>legal.normalizeResearchLegalLegislationInput(id,r,c);
const authority='Source quotations retain their document identity. Meri relevance is an inference for review; keyword grammar and current folder decisions control assignments.';
const wrap=(result,id=SEARCH)=>({tool:id,generatedAt:at,result,authority});
const uncheckedMessage='Positive matches use retained source versions. Search completeness requires a qualified provider inventory.';
const searchResult=(items=[])=>({scope:{...ls},items,interpretedQuery:null,versionPolicy:'any_retained',searchedKinds:'all',scanned:items.length,cursor:null,coverage:{complete:false,reason:'SOURCE_DOCUMENT_INVENTORY_NOT_QUALIFIED',manifestId:null,billIds:[],retainedVersionsOnly:true},message:uncheckedMessage});
const lp=(p=wrap(searchResult()),r=sr,c=lc,id=SEARCH)=>legal.assertResearchLegalLegislationOutput(id,p,r,c);
const version=(id='doc:a')=>({id,billId:'bill:a',jurisdiction:'FL',sessionKey:'2026',revision:'revision opaque',contentHash:'',extractorVersion:'unknown',sourceUrl:null,kind:null,publishedDate:null,observedAt:at,complete:false,title:null,isCurrent:false});
const item=(id='doc:a')=>({...version(id),billTitle:'',billIdentifier:'',sponsor:null,chamber:null,lastAction:null,versionType:null,excerpt:{quote:'',start:0,end:0},evaluation:null});
const compiled={raw:'needle',parserVersion:'legiwatch-query-v1',status:'supported',ast:{kind:'term',value:'needle',wildcard:'none'},reasons:[],interpretation:'needle'};
const refs=(rows=[])=>({scope:{...ls},referenceId:'',edition:null,rows,related:[],coverage:{complete:false,reason:'SELECTED_INGESTED_REFERENCES_ONLY'}});
const rules=(rows=[])=>({scope:{...ls},rows,adopted:[],coverage:{complete:false,reason:'SELECTED_NOTICES_AND_HISTORY_ONLY'}});

test('legal independent: exact family schema and two operation selectors',()=>{
 assert.equal(legalSchema.$id,'urn:meri:retrieval:research-legal-legislation:0.2.0');
 assert.equal(legal.researchLegalLegislationInputDefinition(SEARCH),'ResearchLegalLegislationSearchInput');assert.equal(legal.researchLegalLegislationOutputDefinition(REFERENCE),'ResearchLegalLegislationReferenceOutput');
 for(const id of['__proto__','constructor','search_research_sources'])assert.throws(()=>ln(id));
});
test('legal independent: raw caller selectors separate from required trusted context',()=>{
 for(const c of[{},null,{clientResolution:null},{clientResolution:null,citationResolution:null,authorized:true}])assert.throws(()=>ln(SEARCH,sr,c));
 for(const key of['clientResolution','citationResolution','scope','authorized'])assert.throws(()=>ln(SEARCH,{...sr,[key]:null}));
});
test('legal independent: normalized default search preserves scope and explicit fields',()=>{
 const n=ln();assert.deepEqual(n.input,{scope:ls,query:'',versionPolicy:'any_retained',versionStage:'all',kind:'all',billIds:[],title:'',sponsor:'',chamber:'',action:'',referenceId:null,cursor:null});assert.ok(Object.isFrozen(n));assert.ok(Object.isFrozen(n.input));assert.ok(Object.isFrozen(n.input.scope));
});
test('legal independent: search requires explicit session and bounded jurisdiction',()=>{
 for(const r of[{}, {sessionKey:''},{sessionKey:'x'.repeat(61)},{sessionKey:'2026',jurisdiction:'fl'},{sessionKey:'2026',jurisdiction:'USA'}])assert.throws(()=>ln(SEARCH,r));
 assert.equal(ln(SEARCH,{sessionKey:' '}).input.scope.sessionKey,' ');
});
test('legal independent: client resolver is exact capped no-rebind and not folder-derived',()=>{
 const r={...sr,clientId:'  named  ',folderId:'folder'},c={...lc,clientResolution:{reference:'named',clientId}};assert.equal(ln(SEARCH,r,c).input.scope.clientId,clientId);
 assert.throws(()=>ln(SEARCH,r));assert.throws(()=>ln(SEARCH,{...sr,clientId}, {...lc,clientResolution:{reference:clientId,clientId:other}}));
 assert.equal(ln(SEARCH,{...sr,folderId:'folder'}).input.scope.clientId,null);
});
test('legal independent: bill identities deduplicate sort but retain empty stored selector',()=>{
 assert.deepEqual(ln(SEARCH,{...sr,billIds:['z','','a','z']}).input.billIds,['','a','z']);
 for(const billIds of[[],Array(31).fill('a'),[1],['x'.repeat(181)]])assert.throws(()=>ln(SEARCH,{...sr,billIds}));
});
test('legal independent: filters use UTF16 and query remains untrimmed source text',()=>{
 assert.equal(ln(SEARCH,{...sr,query:'  x  ',title:'x'.repeat(158)+'😀'}).input.query,'  x  ');
 assert.throws(()=>ln(SEARCH,{...sr,title:'x'.repeat(159)+'😀'}));
 for(const key of['title','sponsor','chamber','action'])assert.throws(()=>ln(SEARCH,{...sr,[key]:'x'.repeat(161)}));
});
test('legal independent: policy stage kind enums fail unsupported without conflating defaults',()=>{
 for(const [key,values]of[['versionPolicy',['any_retained','current_extractions','newest_dated_text']],['versionStage',['all','enrolled','chaptered']],['kind',['all','text','amendment','supplement']]]){for(const value of values)ln(SEARCH,{...sr,[key]:value});assert.throws(()=>ln(SEARCH,{...sr,[key]:'other'}));}
});
test('legal independent: unknown reference view still reaches references branch',()=>{
 for(const view of[undefined,null,'other','']){const r={...rr};if(view!==undefined)r.view=view;assert.equal(ln(REFERENCE,r).input.view,'references');}
 assert.equal(ln(REFERENCE,{...rr,view:'rules'}).input.view,'rules');assert.throws(()=>ln(REFERENCE,{...rr,view:'versions'}));
 assert.equal(ln(REFERENCE,{...rr,view:'versions',billId:''}).input.billId,'');
});
test('legal independent: citation fact exact raw binding and explicit override precedence',()=>{
 const citation='s. 100.1',fact={citation,referenceId:'derived-reference',code:'statute'};
 const r={...rr,citation,referenceId:'explicit-reference',edition:'2026'};const n=ln(REFERENCE,r,{...lc,citationResolution:fact}).input;assert.equal(n.referenceId,'explicit-reference');assert.equal(n.edition,'2026');
 assert.throws(()=>ln(REFERENCE,r,{...lc,citationResolution:{...fact,citation:'other'}}));
 assert.equal(ln(REFERENCE,{...r,citation:'Article I'}, {...lc,citationResolution:{citation:'Article I',referenceId:'constitution-reference',code:'constitution'}}).input.edition,null);
});
test('legal independent: references citation and edition bounds differ from rule bounds',()=>{
 assert.throws(()=>ln(REFERENCE,{...rr,citation:'x'.repeat(181)}));assert.throws(()=>ln(REFERENCE,{...rr,edition:'1999'}));
 assert.equal(ln(REFERENCE,{...rr,code:'constitution',edition:'garbage'}).input.edition,null);
 for(const [key,n]of[['ruleNumber',60],['noticeId',100]]){ln(REFERENCE,{...rr,view:'rules',[key]:'x'.repeat(n)});assert.throws(()=>ln(REFERENCE,{...rr,view:'rules',[key]:'x'.repeat(n+1)}));}
});
test('legal independent: empty search exact closed authority envelope',()=>{
 lp();assert.throws(()=>lp({...wrap(searchResult()),authority:'authorized'}));assert.throws(()=>lp({...wrap(searchResult()),tool:REFERENCE}));assert.throws(()=>lp({...wrap(searchResult()),generatedAt:'2026-10-12'}));
});
test('legal independent: detached outputs preserve nested scope and metadata',()=>{
 const p=wrap(searchResult()),saved=structuredClone(p),out=lp(p);assert.deepEqual(out,saved);assert.notEqual(out,p);assert.notEqual(out.result,p.result);assert.notEqual(out.result.scope,p.result.scope);p.result.scope.sessionKey='other';assert.deepEqual(out,saved);
});
test('legal independent: nullable source-view kind and title are not interface guarantees',()=>{lp(wrap(searchResult([item()])));});
test('legal independent: search exposes exact item keys but never hidden sections',()=>{
 const x=item();for(const key of Object.keys(x)){const bad=structuredClone(x);delete bad[key];assert.throws(()=>lp(wrap(searchResult([bad]))),key);}assert.throws(()=>lp(wrap(searchResult([{...x,sections:[]}]))));
});
test('legal independent: search scan can exceed returned matches but never less',()=>{
 lp(wrap({...searchResult(),scanned:25,interpretedQuery:compiled}),{...sr,query:'needle'});assert.throws(()=>lp(wrap({...searchResult([item()]),scanned:0})));assert.throws(()=>lp(wrap({...searchResult(),scanned:26})));
});
test('legal independent: cursor after refers to scanned row rather than returned last match',()=>{
 const cursor=Buffer.from(JSON.stringify({binding:'opaque binding',fingerprint:'opaque fingerprint',after:'scanned:25'})).toString('base64url');
 lp(wrap({...searchResult(),scanned:25,cursor,interpretedQuery:compiled}),{...sr,query:'needle'});
});
test('legal independent: selected current and kind constraints are branch specific',()=>{
 assert.throws(()=>lp(wrap({...searchResult([item()]),versionPolicy:'current_extractions'}),{...sr,versionPolicy:'current_extractions'}));
 assert.throws(()=>lp(wrap({...searchResult([item()]),searchedKinds:'text'}),{...sr,kind:'text'}));
 const x={...item(),kind:'text',isCurrent:true,publishedDate:'2026-01-01'};lp(wrap({...searchResult([x]),versionPolicy:'newest_dated_text'}),{...sr,versionPolicy:'newest_dated_text'});
});
test('legal independent: reference filtering may be qualified without complete coverage',()=>{
 const result=searchResult();result.coverage={complete:false,reason:'LEGAL_REFERENCE_CLASSIFICATION_NOT_QUALIFIED',manifestId:'receipt',billIds:['bill:a'],retainedVersionsOnly:false};result.message='Coverage is limited to the explicit bill selection and its retained provider inventory.';
 lp(wrap(result),{...sr,referenceId:'ref:a',billIds:['bill:a']});
});
test('legal independent: versions preserve identity order and 200-before-more limit',()=>{
 const r={...rr,view:'versions',billId:'bill:a'},result={scope:ls,versions:[version()],complete:true,order:'source_identity_not_legislative_sequence'};lp(wrap(result,REFERENCE),r,lc,REFERENCE);
 assert.throws(()=>lp(wrap({...result,complete:false},REFERENCE),r,lc,REFERENCE));assert.throws(()=>lp(wrap({...result,order:'chronological'},REFERENCE),r,lc,REFERENCE));
 assert.throws(()=>lp(wrap({...result,versions:[version('z'),version('a')]},REFERENCE),r,lc,REFERENCE));
 const many=Array.from({length:200},(_,i)=>version(`doc:${String(i).padStart(3,'0')}`));lp(wrap({...result,versions:many,complete:false},REFERENCE),r,lc,REFERENCE);
});
test('legal independent: missing joined revision is explicit full null tuple',()=>{
 const row={id:'ref:a',jurisdiction:'FL',code_kind:'statute',reference_kind:'section',chapter:null,section:null,subdivisions:null,identity:[],created_at:at};for(const key of['revision_id','edition','title','source_url','content_hash','extraction_hash','parser_version','sections','history_text','complete','coverage','observed_at'])row[key]=null;
 lp(wrap(refs([row]),REFERENCE),rr,lc,REFERENCE);assert.throws(()=>lp(wrap(refs([{...row,title:'impossible'}]),REFERENCE),rr,lc,REFERENCE));
});
test('legal independent: rules retain exact scalar and opaque JSON payloads',()=>{
 const row={id:'rule:a',notice_id:'notice:a',payload:['opaque',null],source_url:'',content_hash:'',observed_at:at};lp(wrap(rules([row]),REFERENCE),{...rr,view:'rules'},lc,REFERENCE);
 for(const key of Object.keys(row)){const r=structuredClone(row);delete r[key];assert.throws(()=>lp(wrap(rules([r]),REFERENCE),{...rr,view:'rules'},lc,REFERENCE));}
});
test('legal independent: returned scope does not silently rebind client folder or jurisdiction',()=>{
 for(const [key,value]of[['clientId',clientId],['folderId','folder'],['jurisdiction','NY'],['sessionKey','other']])assert.throws(()=>lp(wrap({...searchResult(),scope:{...ls,[key]:value}})));
});
test('legal independent: hostile request result context execute no hooks',()=>{
 let effects=0;const r={};Object.defineProperty(r,'sessionKey',{enumerable:true,get(){effects++;return'2026';}});assert.throws(()=>ln(SEARCH,r));
 const c={clientResolution:null};Object.defineProperty(c,'citationResolution',{enumerable:true,get(){effects++;return null;}});assert.throws(()=>ln(SEARCH,sr,c));
 assert.throws(()=>lp(new Proxy(wrap(searchResult()),{get(){effects++;}})));const cyclic=wrap(searchResult());cyclic.result.cycle=cyclic;assert.throws(()=>lp(cyclic));assert.equal(effects,0);
});
