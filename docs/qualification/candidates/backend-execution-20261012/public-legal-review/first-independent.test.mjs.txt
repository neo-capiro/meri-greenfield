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
