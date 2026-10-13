// Literal synthetic DATA only. No source, current membership or authorization.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {normalizeMemoryProposalInput as normalize, assertMemoryProposalReadResult as check,
  assertCatalog, resolveOperationContract} from '../retrieval-0.2/validate.mjs';

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const CLIENT = '33333333-3333-4333-8333-333333333333';
const OTHER = '44444444-4444-4444-8444-444444444444';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OLDER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const subject = (client = null) => ({tenantId:TENANT, actorId:USER,
  kind:client ? 'client' : 'personal', entityType:client ? 'client' : 'user',
  entityIds:[client ?? USER], rosterVersionId:null, policyRevision:'synthetic-policy',
  authorizationDecisionId:OTHER,
  scopes:[{tenantId:TENANT,kind:client ? 'client' : 'private-user',resourceId:client ?? USER,policyRevision:'synthetic-policy'}]});
const options = (client = null) => ({subject:subject(client)});
const candidate = changes => ({id:ID,status:'pending',approvedFact:false,scope:'personal',
  clientId:null,sourceKind:'explicit_user',createdAt:'2026-01-02T00:00:00.000Z',
  restricted:false,title:'Synthetic proposal',proposedText:'Unapproved synthetic text',contentTruncated:false,...changes});
const page = changes => ({tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',
  claimsAreApprovedFacts:false,scope:{tenantId:TENANT,userId:USER,clientId:null},
  candidates:[candidate()],nextCursor:null,
  coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'},...changes});
const partial = changes => page({coverage:{firstPage:true,complete:false,
  reason:'unread_pages_restricted_or_truncated_content'},...changes});

test('normalizes defaults/nulls and binds the server-selected client', () => {
  assert.deepEqual(normalize({},options()),{clientId:null,cursor:null,limit:5});
  assert.deepEqual(normalize({clientId:null,cursor:null,limit:null},options(CLIENT)),{clientId:CLIENT,cursor:null,limit:5});
  assert.deepEqual(normalize({clientId:CLIENT,limit:10},options(CLIENT)),{clientId:CLIENT,cursor:null,limit:10});
});
test('strict raw input bounds, numeric coercion and model authority keys refuse', () => {
  for (const input of [{limit:0},{limit:11},{limit:'5'},{limit:1.1},{limit:Infinity},
    {cursor:''},{cursor:'x'.repeat(2049)},{clientId:'invalid'},
    {tenantId:TENANT},{userId:USER},{approvedFact:true},{scope:'firm'}]) assert.throws(()=>normalize(input,options()));
});
test('requires canonical trusted actor/subject and rejects client substitution', () => {
  assert.throws(()=>normalize({}));
  assert.throws(()=>normalize({}, {...options(),actorId:OTHER}));
  assert.throws(()=>normalize({clientId:CLIENT},options()));
  assert.throws(()=>normalize({clientId:OTHER},options(CLIENT)));
  const changed=options();changed.subject.entityIds=[OTHER];assert.throws(()=>normalize({},changed));
});
test('complete/empty producer queue metadata never becomes approved evidence or absence', () => {
  assert.deepEqual(check(page(),{},options()),{kind:'complete',claimsAreApprovedFacts:false,evidenceReady:false,negativeAssertion:'none'});
  assert.equal(check(page({candidates:[]}),{},options()).kind,'empty');
});
test('selected client permits own firm/private rows and the selected client, rejects another client', () => {
  const value=page({scope:{tenantId:TENANT,userId:USER,clientId:CLIENT},candidates:[candidate({scope:'client',clientId:CLIENT})]});
  assert.equal(check(value,{},options(CLIENT)).kind,'complete');
  for (const scope of ['firm','personal']) {value.candidates=[candidate({scope})];check(value,{},options(CLIENT));}
  value.candidates=[candidate({scope:'client',clientId:OTHER})];assert.throws(()=>check(value,{},options(CLIENT)));
  value.candidates=[candidate({scope:'firm',clientId:CLIENT})];assert.throws(()=>check(value,{},options(CLIENT)));
});
test('result actor/tenant/client and pending-fact constants cannot be substituted', () => {
  for(const changes of [{scope:{tenantId:OTHER,userId:USER,clientId:null}},
    {scope:{tenantId:TENANT,userId:OTHER,clientId:null}}, {claimsAreApprovedFacts:true},
    {authority:'approved_memory'}, {tool:'search_memory'}, {evidenceReady:true},
    {candidates:[candidate({status:'approved'})]}, {candidates:[candidate({approvedFact:true})]}])
    assert.throws(()=>check(page(changes),{},options()));
});
test('restricted proposals redact text/title and remain partial', () => {
  const restricted=candidate({restricted:true,title:null,proposedText:null});
  assert.equal(check(partial({candidates:[restricted]}),{},options()).kind,'partial');
  for(const changes of [{title:'leak'},{proposedText:'leak'},{contentTruncated:true}])
    assert.throws(()=>check(partial({candidates:[{...restricted,...changes}]}),{},options()));
  assert.throws(()=>check(page({candidates:[restricted]}),{},options()));
});
test('truncated/null-text pages cannot claim complete producer coverage', () => {
  for(const row of [candidate({contentTruncated:true}),candidate({proposedText:null})]) {
    assert.equal(check(partial({candidates:[row]}),{},options()).kind,'partial');
    assert.throws(()=>check(page({candidates:[row]}),{},options()));
  }
});
test('disabled review is unavailable, including continued-request firstPage semantics', () => {
  const disabled=page({enabled:false,candidates:[],coverage:{firstPage:true,complete:false,reason:'review_disabled'}});
  assert.equal(check(disabled,{},options()).kind,'unavailable');
  for(const changes of [{candidates:[candidate()]},{nextCursor:'next'},
    {coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'}}])
    assert.throws(()=>check({...disabled,...changes},{},options()));
});
test('continuation requires retained scope, exact cursor and unchanged page limit', () => {
  const prior=partial({nextCursor:'synthetic-next'}), context={...options(),previous:{request:{},page:prior}};
  assert.deepEqual(normalize({cursor:'synthetic-next'},context),{clientId:null,cursor:'synthetic-next',limit:5});
  for(const request of [{cursor:'other'},{cursor:'synthetic-next',limit:10}]) assert.throws(()=>normalize(request,context));
  assert.throws(()=>normalize({cursor:'synthetic-next'},options()));
  assert.throws(()=>normalize({},context));
  const swapped=structuredClone(context);swapped.previous.page.scope.userId=OTHER;
  assert.throws(()=>normalize({cursor:'synthetic-next'},swapped));
});
test('final continued page remains partial and must advance beyond prior key', () => {
  const prior=partial({nextCursor:'synthetic-next'}), context={...options(),previous:{request:{},page:prior}};
  const next=partial({candidates:[candidate({id:OLDER,createdAt:'2026-01-01T00:00:00.000Z'})],
    coverage:{firstPage:false,complete:false,reason:'unread_pages_restricted_or_truncated_content'}});
  assert.equal(check(next,{cursor:'synthetic-next'},context).kind,'partial');
  assert.throws(()=>check(page({coverage:{firstPage:false,complete:true,reason:'own_pending_proposals_complete'}}),{cursor:'synthetic-next'},context));
  assert.throws(()=>check({...next,candidates:[candidate()]},{cursor:'synthetic-next'},context));
  assert.throws(()=>check({...next,nextCursor:'synthetic-next'},{cursor:'synthetic-next'},context));
});
test('UTF-16 preview caps, date order, duplicates and requested count are enforced', () => {
  for(const changes of [{title:'😀'.repeat(101)},{proposedText:'😀'.repeat(1001)},
    {createdAt:'not-time'},{scope:'client',clientId:null}]) assert.throws(()=>check(page({candidates:[candidate(changes)]}),{},options()));
  assert.throws(()=>check(page({candidates:[candidate(),candidate()]}),{},options()));
  assert.throws(()=>check(page({candidates:[candidate(),candidate({id:OLDER,createdAt:'2026-01-03T00:00:00.000Z'})]}),{},options()));
  assert.throws(()=>check(page({candidates:[candidate(),candidate({id:OLDER,createdAt:'2026-01-01T00:00:00.000Z'})]}),{limit:1},options()));
  assert.throws(()=>check(partial({candidates:[],nextCursor:'next'}),{},options()));
});
test('inert admission refuses getters/proxies/cycles/sparse data without invocation', () => {
  let touched=0;const getter={};Object.defineProperty(getter,'limit',{enumerable:true,get(){touched++;return 5;}});
  assert.throws(()=>normalize(getter,options()));assert.equal(touched,0);
  const proxy=new Proxy({},{ownKeys(){touched++;return [];}});
  assert.throws(()=>normalize(proxy,options()));assert.equal(touched,0);
  const cycle={};cycle.limit=cycle;assert.throws(()=>normalize(cycle,options()));
  const value=page();value.candidates=new Array(1);assert.throws(()=>check(value,{},options()));
});
test('operation is mapped but unavailable and public exports stay separate', () => {
  const catalog=JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json',import.meta.url)));
  assertCatalog(catalog);const row=catalog.originals.find(row=>row.id==='list_memory_proposals');
  assert.deepEqual(row.replacement,{id:'memory.list_own_proposals',version:'0.2.0'});assert.equal(row.state,'mapped');
  const {descriptor}=resolveOperationContract({id:'memory.list_own_proposals',version:'0.2.0'});
  assert.equal(descriptor.availability,'unimplemented');assert.equal(descriptor.handler,null);
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
  assert.equal(pkg.version,'0.1.2');assert.ok(!JSON.stringify(pkg.exports).includes('memory-proposals'));
});
test('family factory import has no process/network/timer effect', () => {
  const source=new URL('../retrieval-0.2/memory-proposals-validation.mjs',import.meta.url).href;
  const probe=`import cp from 'node:child_process'; import net from 'node:net';
    cp.spawn=()=>{throw Error('process')}; net.connect=()=>{throw Error('network')};
    globalThis.setTimeout=()=>{throw Error('timer')}; await import(${JSON.stringify(source)});`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',probe],{timeout:5000,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('nonfinite proposal timestamps cannot claim complete or restricted coverage', () => {
  const createdAt='2026-06-30T23:59:60Z';
  assert.equal(Number.isFinite(Date.parse(createdAt)),false);
  assert.throws(()=>check(page({candidates:[candidate({createdAt})]}),{},options()),/finite instant/);
  assert.throws(()=>check(partial({candidates:[candidate({createdAt,restricted:true,title:null,proposedText:null})]}),{},options()),/finite instant/);
});
test('nonfinite timestamps refuse in either position before within-page ordering', () => {
  const invalid=candidate({createdAt:'2026-06-30T23:59:60Z'});
  const valid=candidate({id:OLDER,createdAt:'2027-01-01T00:00:00.000Z'});
  for(const candidates of [[invalid,valid],[valid,invalid]])
    assert.throws(()=>check(page({candidates}),{},options()),/finite instant/);
});
test('nonfinite retained or current timestamps cannot advance a continuation', () => {
  const invalid=candidate({createdAt:'2026-06-30T23:59:60Z'});
  const invalidPrior={...options(),previous:{request:{},page:partial({nextCursor:'next',candidates:[invalid]})}};
  assert.throws(()=>normalize({cursor:'next'},invalidPrior),/finite instant/);
  const continued=partial({candidates:[candidate({id:OLDER,createdAt:'2027-01-01T00:00:00.000Z'})],
    coverage:{firstPage:false,complete:false,reason:'unread_pages_restricted_or_truncated_content'}});
  assert.throws(()=>check(continued,{cursor:'next'},invalidPrior),/finite instant/);
  const validPrior={...options(),previous:{request:{},page:partial({nextCursor:'next'})}};
  assert.throws(()=>check({...continued,candidates:[invalid]},{cursor:'next'},validPrior),/finite instant/);
});
test('finite timestamps preserve offset-aware ordering and equal-instant identity ties', () => {
  const laterId=candidate({id:OLDER,createdAt:'2026-01-02T01:00:00.000+01:00'});
  const earlierId=candidate();
  assert.equal(check(page({candidates:[laterId,earlierId]}),{},options()).kind,'complete');
  assert.throws(()=>check(page({candidates:[earlierId,laterId]}),{},options()),/descending createdAt\/id order/);
  assert.equal(check(page({candidates:[earlierId,candidate({id:OLDER,createdAt:'2026-01-02T00:59:59.999+01:00'})]}),{},options()).kind,'complete');
  const context={...options(),previous:{request:{},page:partial({nextCursor:'next',candidates:[laterId]})}};
  const continued=partial({candidates:[earlierId],
    coverage:{firstPage:false,complete:false,reason:'unread_pages_restricted_or_truncated_content'}});
  assert.equal(check(continued,{cursor:'next'},context).kind,'partial');
  assert.throws(()=>check({...continued,candidates:[laterId]},{cursor:'next'},context),/continuation order failed/);
});
