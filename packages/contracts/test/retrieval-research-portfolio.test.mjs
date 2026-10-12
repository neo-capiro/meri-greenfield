import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createResearchPortfolioValidators} from '../retrieval-0.2/research-portfolio-validation.mjs';

// Test-only compiler until the root owner registers the family. No live source,
// authorization implementation, repository imports or provider traffic.
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const schema = read('../retrieval-0.2/research-portfolio.schema.json');
const ajv = new Ajv({strict:true, allErrors:true}); addFormats(ajv);
ajv.addSchema(read('../meri.schema.json'));
ajv.addSchema(read('../retrieval-0.2/common.schema.json'));
ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name,
  ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const validateShape = (name, value) => {
  assert.ok(checks.get(name)(value), ajv.errorsText(checks.get(name).errors)); return value;
};
const {normalizeResearchPortfolioInput: normalize, assertResearchPortfolioReadResult: check} =
  createResearchPortfolioValidators({validateShape, assertSubject, canonicalSha256});
const DETAIL='get_research_portfolio', CHANGES='get_research_portfolio_changes';
const UUID='11111111-1111-4111-8111-111111111111', OTHER='22222222-2222-4222-8222-222222222222';
const instant='2026-10-12T00:00:00.000Z', older='2026-10-11T00:00:00.000Z';
const context = () => ({
  binding:{tenantId:'synthetic',actorId:'reader',conversationId:UUID,runId:UUID,attemptId:UUID,workerId:UUID,writerFence:1},
  subject:{kind:'entity',entityType:'research-portfolio',entityIds:['portfolio-one'],tenantId:'synthetic',actorId:'reader',
    authorizationDecisionId:UUID,policyRevision:'synthetic-policy',rosterVersionId:null,
    scopes:[{tenantId:'synthetic',kind:'tenant',resourceId:'synthetic',policyRevision:'synthetic-policy'}]},
});
const event = changes => ({id:'event-b',eventKind:'updated',aggregateRevision:7,actorUserId:'past-actor',
  occurredAt:instant,payload:{changed:{name:true},reportedClaim:'Unverified source text'},...changes});
const member = () => ({id:'member',targetKind:'program_element',targetId:'original-target',label:null,
  disposition:'included',origin:'manual',reason:null,unresolvedInput:null,resolvedAt:null,revision:2,
  createdByUserId:'past-actor',updatedByUserId:'reader',createdAt:older,updatedAt:instant});
const detail = () => ({...context(),data:{id:'portfolio-one',name:'Synthetic portfolio',purpose:null,
  mode:'manual',lifecycle:'active',revision:9,ownerUserId:'owner',memberCount:1,clientLinkCount:1,myRole:'viewer',
  archivedAt:null,createdAt:older,updatedAt:instant,
  grants:[{id:'grant',principalType:'user',principalUserId:'reader',role:'viewer',grantedByUserId:'owner',createdAt:older,updatedAt:instant}],
  clientLinks:[{id:'link',clientId:'visible-client',clientName:'Synthetic client',linkedByUserId:'owner',createdAt:older}],
  members:[member()],recentEvents:[event()]}});
const changes = () => ({...context(),data:{items:[{...event(),state:{eventId:'event-b',recipientUserId:'reader',revision:1,
  seenAt:null,acknowledgedAt:null,dismissedAt:null,updatedAt:instant}}],nextCursor:null}});

test('normalizes trusted conversation/portfolio and changes defaults without mutating inputs', () => {
  const ctx=context(), before=structuredClone(ctx), raw={};
  assert.deepEqual(normalize(DETAIL,raw,ctx),{conversationId:UUID,portfolioId:'portfolio-one'});
  assert.deepEqual(normalize(CHANGES,raw,ctx),{conversationId:UUID,portfolioId:'portfolio-one',cursor:null,limit:25});
  assert.deepEqual(normalize(CHANGES,{conversationId:UUID,cursor:' event-a ',limit:100},ctx),
    {conversationId:UUID,portfolioId:'portfolio-one',cursor:'event-a',limit:100});
  for(const cursor of [null,'','   ']) assert.equal(normalize(CHANGES,{cursor},ctx).cursor,null);
  assert.deepEqual(ctx,before); assert.deepEqual(raw,{});
});
test('refuses supplied foreign or malformed conversation and authority injection', () => {
  for(const raw of [{conversationId:OTHER},{conversationId:null},{conversationId:''},{conversationId:4},
    {portfolioId:'portfolio-one'},{researchPortfolioId:'portfolio-one'},{tenantId:'synthetic'},
    {userId:'reader'},{scopeVersion:'a'.repeat(64)},{subject:context().subject}])
    assert.throws(()=>normalize(DETAIL,raw,context()));
});
test('adopts declared integer grammar rather than permissive producer clamping', () => {
  for(const limit of [null,0,101,1.5,'25',NaN,Infinity]) assert.throws(()=>normalize(CHANGES,{limit},context()));
  for(const cursor of [4,{},'x'.repeat(2049)]) assert.throws(()=>normalize(CHANGES,{cursor},context()));
  assert.throws(()=>normalize(DETAIL,{cursor:'x'},context()));
  assert.throws(()=>normalize(CHANGES,{complete:true},context()));
});
test('requires only the closed canonical context and a single research-portfolio entity', () => {
  for(const ctx of [{},null,{...context(),nowMs:1},{...context(),role:'owner'},
    {...context(),subject:{...context().subject,kind:'portfolio',entityType:'client',rosterVersionId:'roster'}},
    {...context(),subject:{...context().subject,entityType:'client'}},
    {...context(),subject:{...context().subject,entityIds:['one','two']}},
    {...context(),subject:{...context().subject,actorId:'other'}},
    {...context(),subject:{...context().subject,tenantId:'other'}}])
    assert.throws(()=>normalize(DETAIL,{},ctx));
});
test('both operations accept their exact nonempty producer DTO projections', () => {
  for(const [operation,page] of [[DETAIL,detail()],[CHANGES,changes()]]) {
    assert.equal(check(operation,page,{},context()),page);
    assert.ok(!('coverage' in page.data));
  }
});
test('detail preserves current revision and older historical event revision without equalizing them', () => {
  const page=detail(); check(DETAIL,page,{},context());
  assert.equal(page.data.revision,9); assert.equal(page.data.recentEvents[0].aggregateRevision,7);
  // Captured conversation scope revision belongs to its trusted owner and is
  // not a field supplied by this result producer. Never synthesize or rewrite it.
  page.data.capturedRevision=7; assert.throws(()=>check(DETAIL,page,{},context()));
});
test('detail preserves every declared mode/disposition and nullable unresolved metadata', () => {
  for(const mode of ['manual','rules','hybrid']) {
    const page=detail();page.data.mode=mode;page.data.members[0].disposition='unresolved';
    page.data.members[0].unresolvedInput={original:{label:'Synthetic unresolved input'},choices:[null,1,true]};
    delete page.data.members[0].origin;check(DETAIL,page,{},context());
  }
  const page=detail();page.data.lifecycle='archived';page.data.archivedAt=instant;check(DETAIL,page,{},context());
});
test('detail role is reported per explicit grant, without ownerUserId or admin bypass', () => {
  for(const role of ['viewer','editor','owner']) {
    const page=detail();page.data.myRole=role;page.data.grants[0].role=role;check(DETAIL,page,{},context());
  }
  for(const mutate of [p=>p.data.grants=[],p=>p.data.grants[0].principalUserId='other',
    p=>p.data.myRole='owner',p=>p.data.grants[0].role='capiro_admin']) {
    const page=detail();mutate(page);assert.throws(()=>check(DETAIL,page,{},context()));
  }
});
test('rejects foreign portfolio and projected count inconsistencies', () => {
  for(const mutate of [p=>p.data.id='other',p=>p.data.memberCount=0,p=>p.data.clientLinkCount=0,
    p=>p.data.revision=-1,p=>p.data.revision=Number.MAX_SAFE_INTEGER+1]) {
    const page=detail();mutate(page);assert.throws(()=>check(DETAIL,page,{},context()));
  }
});
test('permits explicitly empty visible links/history and does not infer complete history', () => {
  const page=detail();page.data.clientLinks=[];page.data.clientLinkCount=0;page.data.recentEvents=[];
  check(DETAIL,page,{},context());
  for(const key of ['complete','evidenceReady','authorized','negativeAssertion']) {
    const changed=structuredClone(page);changed.data[key]=true;assert.throws(()=>check(DETAIL,changed,{},context()));
  }
});
test('detail rejects duplicate native identities', () => {
  for(const key of ['grants','clientLinks','members','recentEvents']) {
    const page=detail();page.data[key].push(structuredClone(page.data[key][0]));
    if(key==='members')page.data.memberCount=2;
    if(key==='clientLinks')page.data.clientLinkCount=2;
    assert.throws(()=>check(DETAIL,page,{},context()));
  }
});
test('changes binds recipient state to current actor and its own event', () => {
  for(const mutate of [p=>p.data.items[0].state.recipientUserId='other',
    p=>p.data.items[0].state.eventId='other']) {
    const page=changes();mutate(page);assert.throws(()=>check(CHANGES,page,{},context()));
  }
  const page=changes();page.data.items[0].state=null;check(CHANGES,page,{},context());
});
test('changes represents page continuation without source-history completeness', () => {
  const page=changes();page.data.nextCursor='event-b';check(CHANGES,page,{limit:1},context());
  const last=changes();last.data.items=[{...event({id:'event-a',occurredAt:older}),state:null}];
  check(CHANGES,last,{cursor:'event-b',limit:1},context());
  const empty=changes();empty.data.items=[];check(CHANGES,empty,{cursor:'event-b'},context());
});
test('non-null continuation requires the full requested page from the pinned producer projection', () => {
  const page=changes();page.data.nextCursor='event-b';
  assert.throws(()=>check(CHANGES,page,{limit:2},context()));
  check(CHANGES,page,{limit:1},context());
  page.data.nextCursor=null;check(CHANGES,page,{limit:2},context());
});
test('changes refuses nonprogress, foreign next cursor, excess rows and empty continuation', () => {
  for(const [page,request] of [
    [{...changes(),data:{items:[],nextCursor:'event-b'}},{}],
    [{...changes(),data:{items:changes().data.items,nextCursor:'other'}},{}],
    [changes(),{cursor:'event-b'}],
    [{...changes(),data:{items:[...changes().data.items,{...event({id:'event-a',occurredAt:older}),state:null}],nextCursor:null}},{limit:1}],
  ]) assert.throws(()=>check(CHANGES,page,request,context()));
});
test('event ordering follows descending occurredAt then id and is never revision sorting', () => {
  const page=changes();page.data.items.push({...event({id:'event-a',aggregateRevision:10}),state:null});
  check(CHANGES,page,{},context());
  page.data.items.reverse();assert.throws(()=>check(CHANGES,page,{},context()));
  page.data.items.reverse();page.data.items[1].occurredAt='2026-10-13T00:00:00.000Z';
  assert.throws(()=>check(CHANGES,page,{},context()));
});
test('result full run/task/fence and subject fields cannot be substituted', () => {
  for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']) {
    const page=detail();page.binding[field]=field==='writerFence'?2:OTHER;
    assert.throws(()=>check(DETAIL,page,{},context()));
  }
  for(const field of ['authorizationDecisionId','policyRevision','entityIds','scopes']) {
    const page=changes();page.subject[field]=field==='entityIds'?['other']:field==='scopes'?[]:OTHER;
    assert.throws(()=>check(CHANGES,page,{},context()));
  }
});
test('all structural DTOs are closed and nullable fields are distinct from omission', () => {
  for(const target of [p=>p,p=>p.data,p=>p.data.grants[0],p=>p.data.clientLinks[0],p=>p.data.members[0],p=>p.data.recentEvents[0]]) {
    const page=detail();target(page).invented=true;assert.throws(()=>check(DETAIL,page,{},context()));
  }
  const page=detail();delete page.data.purpose;assert.throws(()=>check(DETAIL,page,{},context()));
  const wrong=detail();wrong.data.members[0].targetKind='client';assert.throws(()=>check(DETAIL,wrong,{},context()));
  assert.throws(()=>check(CHANGES,detail(),{},context()));
});
test('rejects nonfinite timestamps even when the schema recognizes a leap-second format', () => {
  const page=detail();page.data.updatedAt='2016-12-31T23:59:60Z';
  assert.throws(()=>check(DETAIL,page,{},context()));
  const value=changes();value.data.items[0].state.updatedAt='2016-12-31T23:59:60Z';
  assert.throws(()=>check(CHANGES,value,{},context()));
});
test('bounds history, recursive payloads and declared text without deleting content', () => {
  const page=detail();page.data.recentEvents=Array.from({length:101},(_,i)=>event({id:`event-${1000-i}`}));
  assert.throws(()=>check(DETAIL,page,{},context()));
  const deep=detail();let value=deep.data.recentEvents[0].payload;
  for(let i=0;i<65;i++)value=value.next={};
  assert.throws(()=>check(DETAIL,deep,{},context()));
  const long=detail();long.data.purpose='x'.repeat(16385);assert.throws(()=>check(DETAIL,long,{},context()));
});
test('opaque event JSON remains source-reported data, not promoted authorization', () => {
  const page=changes();page.data.items[0].payload={complete:true,approved:true,role:'owner',nested:[null,{grant:'untrusted'}]};
  check(CHANGES,page,{},context());
  assert.deepEqual(Object.keys(page).sort(),['binding','data','subject']);
});
test('hostile getters, proxies and coercions are refused before executing user code', () => {
  let calls=0;
  const getter={get conversationId(){calls++;throw Error('must not execute');}};
  const proxy=new Proxy({}, {ownKeys(){calls++;throw Error('must not execute');},get(){calls++;throw Error('must not execute');}});
  for(const input of [getter,proxy,{limit:{valueOf(){calls++;return 25;}}}])
    assert.throws(()=>normalize(CHANGES,input,context()));
  assert.throws(()=>normalize(DETAIL,{},proxy));
  assert.throws(()=>check(DETAIL,proxy,{},context()));
  const page=detail();page.data.recentEvents[0].payload=getter;
  assert.throws(()=>check(DETAIL,page,{},context()));assert.equal(calls,0);
});
test('refuses cycles, hidden keys, symbols, inherited objects, sparse arrays and nonfinite JSON', () => {
  const cycle={};cycle.self=cycle;
  for(const bad of [cycle,Object.create({}),Object.defineProperty({},'x',{value:1}),{[Symbol('x')]:1},[,,],NaN]) {
    const page=detail();page.data.recentEvents[0].payload={bad};assert.throws(()=>check(DETAIL,page,{},context()));
  }
});
test('safe shared JSON references are accepted without creating a false cycle', () => {
  const shared={note:'synthetic'},page=detail();page.data.recentEvents[0].payload={a:shared,b:shared};
  check(DETAIL,page,{},context());
});
test('Clio research evidence and unrelated operations stay outside this family', () => {
  for(const operation of ['get_research_evidence','get_research_portfolio_analytics','manage_research_portfolio',null]) {
    assert.throws(()=>normalize(operation,{},context()));
    assert.throws(()=>check(operation,detail(),{},context()));
  }
});
