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

test('legal independent: related occurrences retain all DDL scalars and offset relation',()=>{
 const row={id:'occ:a',document_id:'doc:a',bill_id:'bill:a',jurisdiction:'FL',session_key:'2026',document_revision:'rev',reference_id:'ref:a',locator:'opaque',start_offset:0,end_offset:1,quote:'different length is not a DB constraint',relation:'cites',basis:'opaque',parser_version:'v',observed_at:at,source_url:null,document_kind:null,is_current:false};
 const r={...rr,referenceId:'ref:a'},p=wrap({...refs(),referenceId:'ref:a',related:[row]},REFERENCE);lp(p,r,lc,REFERENCE);
 for(const key of Object.keys(row)){const bad=structuredClone(p);delete bad.result.related[0][key];assert.throws(()=>lp(bad,r,lc,REFERENCE),key);}
 for(const patch of[{reference_id:'other'},{session_key:'other'},{start_offset:-1},{end_offset:0},{relation:'invented'}])assert.throws(()=>lp(wrap({...p.result,related:[{...row,...patch}]},REFERENCE),r,lc,REFERENCE));
});
test('legal independent: present lateral revision keeps JSON null without losing scalar fields',()=>{
 const row={id:'ref:a',jurisdiction:'FL',code_kind:'statute',reference_kind:'section',chapter:null,section:null,subdivisions:null,identity:{guidance:'inert'},created_at:at,revision_id:'revision:a',edition:'2026',title:'',source_url:'',content_hash:'',extraction_hash:'',parser_version:'',sections:null,history_text:null,complete:false,coverage:null,observed_at:at};
 lp(wrap({...refs([row]),edition:'2026'},REFERENCE),{...rr,edition:'2026'},lc,REFERENCE);
 for(const key of['title','source_url','content_hash','extraction_hash','parser_version','complete','observed_at'])assert.throws(()=>lp(wrap({...refs([{...row,[key]:null}]),edition:'2026'},REFERENCE),{...rr,edition:'2026'},lc,REFERENCE));
});
test('legal independent: adopted history is selected-only and capped at ten',()=>{
 const a={id:'history:a',title:'',source_url:'',content_hash:'',extraction_hash:'',sections:null,complete:false,coverage:[],observed_at:at};
 const p=wrap({...rules(),adopted:[a]},REFERENCE),r={...rr,view:'rules',ruleNumber:'1'};lp(p,r,lc,REFERENCE);assert.throws(()=>lp(p,{...rr,view:'rules'},lc,REFERENCE));
 assert.throws(()=>lp(wrap({...rules(),adopted:Array.from({length:11},(_,i)=>({...a,id:String(i)}))},REFERENCE),r,lc,REFERENCE));
});
test('legal independent: native record caps101 and201 are not silently page100/200',()=>{
 const rows=Array.from({length:101},(_,i)=>({id:String(i).padStart(3,'0'),notice_id:'n',payload:null,source_url:'',content_hash:'',observed_at:at}));lp(wrap(rules(rows),REFERENCE),{...rr,view:'rules'},lc,REFERENCE);assert.throws(()=>lp(wrap(rules([...rows,{...rows[0],id:'z'}]),REFERENCE),{...rr,view:'rules'},lc,REFERENCE));
});
for(const count of[0,1])test(`legal independent: logical AST requires multiple children (${count} impossible)`,()=>{
 const p=wrap({...searchResult(),interpretedQuery:{...compiled,ast:{kind:'and',children:Array.from({length:count},()=>({kind:'term',value:'needle',wildcard:'none'}))}}});
 assert.throws(()=>lp(p,{...sr,query:'needle'}));
});

// News controls frozen against original source before candidate inspection.
import {createResearchLegalNewsValidators} from '../retrieval-0.2/research-legal-news-validation.mjs';
const newsSchema=load('research-legal-news');ajv.addSchema(load('florida-budget'));ajv.addSchema(newsSchema);
const newsShapes=new Map(Object.keys(newsSchema.$defs).map(n=>[n,ajv.compile({$ref:`${newsSchema.$id}#/$defs/${n}`})]));
const news=createResearchLegalNewsValidators({schema:newsSchema,validateShape(n,x){const f=newsShapes.get(n);if(!f?.(x))throw Error(`${n}: ${ajv.errorsText(f?.errors)}`);}});
const NEWS='search_legiwatch_news',ns={jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null};
const nc={clientResolution:null,effectiveScope:ns,windowAsOf:at,defaultYear:null,owner:null};
const sourceCtx={...nc,windowAsOf:null};
const nn=(r={},c=nc)=>news.normalizeResearchLegalNewsInput(NEWS,r,c);
const nw=result=>({tool:NEWS,generatedAt:at,result,authority});
const newsResult=(items=[])=>({scope:{...ns},matchDefinition:null,items,nextOffset:null,coverage:[],window:{since:'2026-10-05T12:00:00.000Z',days:7},coverageMessage:'Results reflect retained sources. Missing article bodies and unavailable providers limit coverage.'});
const np=(p=nw(newsResult()),r={},c=nc)=>news.assertResearchLegalNewsOutput(NEWS,p,r,c);
const baseNews=(id='n:a')=>({id,article_id:'article:a',revision:'revision:a',provider:'rss',provider_id:null,original_url:'',canonical_url:'',publisher:'publisher',author:null,provider_parsed_at:null,title:'title',summary:null,body:null,body_complete:false,language:null,publisher_country:null,article_geography:null,published_at:null,publication_precision:'unknown',observed_at:at,source_url:'',rights:'headline_link',is_current:true});
const listNews=(id='n:a')=>({...baseNews(id),saved:false,tracking_version:null});
const exactNews=(id='n:a')=>({...baseNews(id),sourceUrl:'',text:'title',observedAt:at,complete:false,authority:'Attributed publisher reporting'});
const personnel=(id='p:a')=>({id,source_key:'person:a',revision:'rev',kind:'change',name:'person',branch:null,registration_year:null,firm:null,principal:null,old_role:null,new_role:null,announced_date:null,effective_date:null,withdrawal_date:null,confirmation:'unconfirmed',canonical_person_id:null,directory_url:null,source_url:'',receipt_id:'receipt',payload:null,observed_at:at});
const personPage=(items=[])=>({items,nextOffset:null,year:2026,notice:'Source-linked observations; withdrawal does not establish employment termination. Unresolved identities remain unmerged.'});
const personnelCtx={...sourceCtx,defaultYear:2026};
const monitorOwner={tenantId:clientId,clerkUserId:'clerk:a'},monitorCtx={...sourceCtx,effectiveScope:null,owner:monitorOwner};
const emptyNewsQuery={raw:'',parserVersion:'legiwatch-query-v1',status:'empty',ast:null,reasons:['EMPTY_QUERY'],interpretation:null,adapterVersion:'legiwatch-news-query-v1',providerQuery:null};
const monitor=(id='m:a')=>({id,tenant_id:clientId,owner_clerk_id:'clerk:a',source_key:id,source:null,config:null,version:0,state:'needs_review',baseline_at:null,checkpoint:null,pending_window:null,last_attempt_at:null,last_error:null,created_at:at,interpretation:emptyNewsQuery});

test('news independent: exact namespace selectors and default normalized envelope',()=>{
 assert.equal(newsSchema.$id,'urn:meri:retrieval:research-legal-news:0.2.0');assert.equal(news.researchLegalNewsInputDefinition(NEWS),'ResearchLegalNewsInput');assert.equal(news.researchLegalNewsOutputDefinition(NEWS),'ResearchLegalNewsOutput');
 assert.deepEqual(nn().input,{view:'news',scope:ns,q:'',publisher:'',monitorId:null,kind:null,id:null,branch:'',limit:50,offset:0,days:7,year:null});
 for(const id of['__proto__','constructor','get_legal_reference'])assert.throws(()=>news.normalizeResearchLegalNewsInput(id,{},nc));
});
test('news independent: branch facts cannot be supplied by model or borrowed from another branch',()=>{
 for(const key of['effectiveScope','windowAsOf','defaultYear','owner','clientResolution'])assert.throws(()=>nn({[key]:null}));
 for(const c of[{},null,{...nc,owner:monitorOwner},{...nc,defaultYear:2026},{...nc,windowAsOf:null},{...nc,effectiveScope:null}])assert.throws(()=>nn({},c));
 assert.throws(()=>nn({view:'source',kind:'news',id:'n:a'},nc));assert.throws(()=>nn({view:'monitors'},sourceCtx));
});
test('news independent: exact default and numeric-string limit behavior',()=>{
 for(const[limit,want]of[[null,50],['',50],[0,50],[-1,1],['Infinity',100],[999,100],[2.9,2],['nonsense',50]])assert.equal(nn({limit}).input.limit,want);
 for(const limit of[false,{},[],Infinity])assert.throws(()=>nn({limit}));
});
test('news independent: news offsets reject fractions while personnel truncates them',()=>{
 assert.throws(()=>nn({offset:'1.5'}));assert.equal(nn({view:'personnel',offset:'1.5'},personnelCtx).input.offset,1);assert.equal(nn({offset:-2}).input.offset,0);
 for(const offset of[10001,'Infinity'])assert.throws(()=>nn({offset}));
});
test('news independent: actual days enum and UTF16 query clipping',()=>{
 for(const days of[1,3,7,14])assert.equal(nn({days:String(days)}).input.days,days);for(const days of[0,2,30])assert.throws(()=>nn({days}));
 assert.equal(nn({q:'x'.repeat(499)+'😀'}).input.q,'x'.repeat(499)+'\ud83d');assert.equal(nn({view:'personnel',q:'x'.repeat(199)+'😀'},personnelCtx).input.q,'x'.repeat(199)+'\ud83d');
});
test('news independent: effective folder client may differ from absent raw client but not explicit resolution',()=>{
 const c={...nc,effectiveScope:{...ns,folderId:'folder',clientId}};assert.equal(nn({folderId:'folder'},c).input.scope.clientId,clientId);
 assert.throws(()=>nn({},c));assert.throws(()=>nn({folderId:'folder',clientId:'named'},{...c,clientResolution:{reference:'named',clientId:other}}));
 assert.throws(()=>nn({}, {...nc,effectiveScope:{...ns,clientId}}));
});
test('news independent: personnel year is branch-specific source observation',()=>{
 assert.equal(nn({view:'personnel'},personnelCtx).input.year,2026);assert.equal(nn({view:'personnel',year:'2025'},sourceCtx).input.year,2025);
 assert.throws(()=>nn({view:'personnel',year:'2025'},personnelCtx));assert.throws(()=>nn({view:'personnel'},sourceCtx));assert.throws(()=>nn({view:'personnel',year:1.5},sourceCtx));
});
test('news independent: monitors ignores input scope only after wrapper client resolution',()=>{
 assert.equal(nn({view:'monitors',folderId:'ignored',sessionKey:'ignored'},monitorCtx).input.scope,null);
 assert.throws(()=>nn({view:'monitors',clientId:'named'},monitorCtx));assert.equal(nn({view:'monitors',clientId:'named'},{...monitorCtx,clientResolution:{reference:'named',clientId}}).input.scope,null);
});
test('news independent: empty news is an exact page not absence evidence',()=>{
 np();assert.throws(()=>np(nw({...newsResult(),complete:true})));const n=nn();assert.ok(Object.isFrozen(n.input));assert.ok(Object.isFrozen(n.metadata));
});
test('news independent: complete nullable list row and exact mandatory fields',()=>{
 const row=listNews();np(nw(newsResult([row])));for(const key of Object.keys(row)){const bad=structuredClone(row);delete bad[key];assert.throws(()=>np(nw(newsResult([bad]))),key);}
 assert.throws(()=>np(nw(newsResult([{...row,body_complete:true}]))));assert.throws(()=>np(nw(newsResult([{...row,is_current:false}]))));
});
test('news independent: lower window cutoff is inclusive and future rows remain possible',()=>{
 np(nw(newsResult([{...listNews(),observed_at:'2026-10-05T12:00:00.000Z'}])));np(nw(newsResult([{...listNews(),observed_at:'2099-01-01T00:00:00.000Z'}])));
 assert.throws(()=>np(nw(newsResult([{...listNews(),observed_at:'2026-10-05T11:59:59.999Z'}]))));assert.throws(()=>np(nw({...newsResult(),window:{since:at,days:7}})));
});
test('news independent: paging retains limit and exact next offset',()=>{
 const r={limit:1,offset:4},p=nw({...newsResult([listNews()]),nextOffset:5});np(p,r);assert.throws(()=>np({...p,result:{...p.result,nextOffset:6}},r));assert.throws(()=>np(nw({...newsResult(),nextOffset:5}),r));
});
test('news independent: raw publisher equality is separate from wildcard query truth',()=>{
 np(nw(newsResult([listNews()])),{q:'%_no literal match'});assert.throws(()=>np(nw(newsResult([listNews()])),{publisher:'other'}));
});
test('news independent: missing match-definition optional config values remain omitted',()=>{
 const p=nw({...newsResult(),matchDefinition:{id:'m:a',version:0,interpretation:'undefined'}});np(p,{monitorId:'m:a'});assert.throws(()=>np(p));assert.throws(()=>np(p,{monitorId:'m:b'}));
});
test('news independent: no verified endpoint and retained zero remain distinct source fields',()=>{
 const c={id:'coverage',publisher:'unmapped-publisher',source_group:'x',source_url:null,status:'unavailable',evidence:null,owner:'owner',version:0,intake:{status:'no_verified_endpoint',feeds:[]},retained:{articles:0,fullTextArticles:0,latestPublishedAt:null,latestObservedAt:null}};
 np(nw({...newsResult(),coverage:[c]}));assert.throws(()=>np(nw({...newsResult(),coverage:[{...c,retained:{...c.retained,articles:-1}}]})));
});
test('news independent: exact news source preserves historical row and raw versus alias observation',()=>{
 const r={view:'source',kind:'news',id:'n:a'};np(nw({...exactNews(),is_current:false}),r,sourceCtx);
 const p={...exactNews(),observed_at:'1969-12-31T23:59:59.999Z',observedAt:'1969-12-31T23:59:59.000Z'};np(nw(p),r,sourceCtx);
 assert.throws(()=>np(nw({...p,observedAt:'1970-01-01T00:00:00.000Z'}),r,sourceCtx));assert.throws(()=>np(nw({...exactNews(),id:'other'}),r,sourceCtx));
});
test('news independent: exact source text and rights are correlated without current coverage inference',()=>{
 const r={view:'source',kind:'news',id:'n:a'};np(nw({...exactNews(),body:'body',body_complete:true,complete:true,text:'title\nbody',rights:'full_text'}),r,sourceCtx);
 assert.throws(()=>np(nw({...exactNews(),text:'different'}),r,sourceCtx));assert.throws(()=>np(nw({...exactNews(),complete:true}),r,sourceCtx));
});
test('news independent: personnel null-year rows and explicit scope remain source observations',()=>{
 const row={...personnel(),saved:false,tracking_version:null};np(nw(personPage([row])),{view:'personnel'},personnelCtx);
 assert.throws(()=>np(nw(personPage([{...row,registration_year:2025}])),{view:'personnel'},personnelCtx));assert.throws(()=>np(nw(personPage([{...row,kind:'registration'}])),{view:'personnel'},personnelCtx));
});
test('news independent: exact personnel completeness and opaque payload are retained',()=>{
 const row={...personnel(),title:'person',sourceUrl:'',text:'',observedAt:at,complete:true,authority:'unconfirmed',rights:'full_text'};np(nw(row),{view:'source',kind:'personnel',id:'p:a'},sourceCtx);
 assert.throws(()=>np(nw({...row,text:'invented'}),{view:'source',kind:'personnel',id:'p:a'},sourceCtx));
});
test('news independent: exact budget keeps all raw document fields plus source-derived aliases',()=>{
 const p={id:'b:a',publisher:'',source_url:'',content_hash:'hash',title:'title',fiscal_year:'2026-27',session_key:'',chamber:'',stage:'proposed',role:'',offer:null,publication_date:null,observed_at:at,receipt_id:'r',sections:null,metadata:null,complete:false,revision:'hash',sourceUrl:'',text:'',observedAt:at,authority:'Florida fiscal source: proposed',rights:'full_text'};
 np(nw(p),{view:'source',kind:'budget',id:'b:a'},sourceCtx);assert.throws(()=>np(nw({...p,revision:'other'}),{view:'source',kind:'budget',id:'b:a'},sourceCtx));
});
test('news independent: exact research source is a distinct section projection',()=>{
 const p={id:'d:a',billId:'bill',revision:'rev',title:'text',sourceUrl:'',text:'one\ntwo',sections:[{locator:'a',text:'one',hash:'x'},{locator:'b',text:'two',hash:'y'}],observedAt:at,complete:true,authority:'Published legislative record',rights:'full_text'};
 np(nw(p),{view:'source',kind:'research',id:'d:a'},sourceCtx);assert.throws(()=>np(nw({...p,text:'one'}),{view:'source',kind:'research',id:'d:a'},sourceCtx));
});
test('news independent: monitor complete raw projection correlates exact current owner',()=>{
 const p=nw({monitors:[monitor()]});np(p,{view:'monitors'},monitorCtx);assert.throws(()=>np(nw({monitors:[{...monitor(),tenant_id:other}]}),{view:'monitors'},monitorCtx));assert.throws(()=>np(nw({monitors:[{...monitor(),owner_clerk_id:'other'}]}),{view:'monitors'},monitorCtx));
 for(const key of Object.keys(monitor())){const m=monitor();delete m[key];assert.throws(()=>np(nw({monitors:[m]}),{view:'monitors'},monitorCtx),key);}
});
test('news independent: returned outputs remain detached throughout JSON and rows',()=>{
 const p=nw(newsResult([{...listNews(),article_geography:{nested:['x']}}])),saved=structuredClone(p),out=np(p);assert.deepEqual(out,saved);assert.notEqual(out.result.items[0].article_geography,p.result.items[0].article_geography);p.result.items[0].article_geography.nested.push('y');assert.deepEqual(out,saved);
});
test('news independent: hostile selectors output and context invoke no hooks',()=>{
 let n=0;const r={};Object.defineProperty(r,'view',{enumerable:true,get(){n++;return'news';}});assert.throws(()=>nn(r));assert.throws(()=>np(new Proxy(nw(newsResult()),{get(){n++;}})));const c={...nc};Object.defineProperty(c,'windowAsOf',{enumerable:true,get(){n++;return at;}});assert.throws(()=>nn({},c));assert.equal(n,0);
});
