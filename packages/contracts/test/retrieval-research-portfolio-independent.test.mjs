import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createResearchPortfolioValidators} from '../retrieval-0.2/research-portfolio-validation.mjs';

// Independent synthetic DTOs. No producer implementation, private source import,
// grant decision, adapter, database or runtime. Root owns production registration.
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const schema = json('../retrieval-0.2/research-portfolio.schema.json');
const ajv = new Ajv({strict:true,allErrors:true}); addFormats(ajv);
for(const value of [json('../meri.schema.json'),json('../retrieval-0.2/common.schema.json'),schema]) ajv.addSchema(value);
const shapes=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const family=createResearchPortfolioValidators({assertSubject,canonicalSha256,
  validateShape(name,value){assert.equal(shapes.get(name)(value),true,`Invalid ${name}`);return value;}});
const normalize=family.normalizeResearchPortfolioInput, check=family.assertResearchPortfolioReadResult;
const D='get_research_portfolio', C='get_research_portfolio_changes';
const uuid=n=>`${String(n).padStart(8,'0')}-1a2b-4c3d-8e5f-0123456789ab`;
const T='2026-07-01T12:34:56.000Z', EARLY='2025-01-02T01:00:00.000Z';
function context(){return {
  binding:{tenantId:'review-tenant',actorId:'review-actor',conversationId:uuid(1),runId:uuid(2),attemptId:uuid(3),workerId:uuid(4),writerFence:21},
  subject:{kind:'entity',entityType:'research-portfolio',entityIds:['portfolio-review'],tenantId:'review-tenant',actorId:'review-actor',authorizationDecisionId:uuid(5),policyRevision:'policy-review-4',rosterVersionId:null,scopes:[{kind:'tenant',tenantId:'review-tenant',resourceId:'review-tenant',policyRevision:'policy-review-4'}]},
};}
const event=(id='event-z',occurredAt=T)=>({id,eventKind:'member_added',aggregateRevision:2,actorUserId:'historical-editor',occurredAt,payload:{unverified:{approved:true},list:[1,null,'reported']}});
const state=id=>({eventId:id,recipientUserId:'review-actor',revision:3,seenAt:null,acknowledgedAt:T,dismissedAt:null,updatedAt:T});
const grant=(principalUserId='review-actor',id='grant-1',role='editor')=>({id,principalType:'user',principalUserId,role,grantedByUserId:'portfolio-owner',createdAt:EARLY,updatedAt:T});
const member=(id='member-one')=>({id,targetKind:'award',targetId:'award-one',label:null,disposition:'candidate',reason:null,unresolvedInput:{raw:['opaque',null]},resolvedAt:null,revision:0,createdByUserId:'old-user',updatedByUserId:'review-actor',createdAt:EARLY,updatedAt:T});
function detail(){return {...context(),data:{id:'portfolio-review',name:'Independent synthetic portfolio',purpose:null,mode:'hybrid',lifecycle:'active',revision:11,ownerUserId:'portfolio-owner',memberCount:1,clientLinkCount:1,myRole:'editor',archivedAt:null,createdAt:EARLY,updatedAt:T,grants:[grant(),grant('portfolio-owner','grant-2','owner')],clientLinks:[{id:'link-1',clientId:'visible-client',clientName:'Visible synthetic client',linkedByUserId:'portfolio-owner',createdAt:T}],members:[member()],recentEvents:[event()]}};}
function changes(items=[{...event(),state:state('event-z')}],nextCursor=null){return {...context(),data:{items,nextCursor}};}
const reject=(op,page,input={})=>assert.throws(()=>check(op,page,input,context()));
function mutateAll(op,make,mutations,input={}){for(const mutate of mutations){const p=make();mutate(p);reject(op,p,input);}}

test('independent nonempty projections preserve current detail and historical revisions',()=>{
  const d=detail(),c=changes();assert.equal(check(D,d,{},context()),d);assert.equal(check(C,c,{},context()),c);
  assert.equal(d.data.revision,11);assert.equal(d.data.recentEvents[0].aggregateRevision,2);
  assert.equal(d.data.members[0].origin,undefined);assert.equal(c.data.items[0].state.seenAt,null);
});
test('current conversation and portfolio derive only from exact trusted context',()=>{
  assert.deepEqual(normalize(D,{},context()),{conversationId:uuid(1),portfolioId:'portfolio-review'});
  assert.deepEqual(normalize(C,{conversationId:uuid(1),cursor:'  previous  '},context()),{conversationId:uuid(1),portfolioId:'portfolio-review',cursor:'previous',limit:25});
  for(const input of [{conversationId:uuid(6)},{conversationId:null},{portfolioId:'foreign'},{tenantId:'forged'},{actorId:'forged'},{scopeVersion:'forged'},{limit:10}]) assert.throws(()=>normalize(D,input,context()));
});
test('input default and exact numeric/cursor grammar without coercion',()=>{
  for(const cursor of [undefined,null,'','  ']){const raw=cursor===undefined?{}:{cursor};assert.equal(normalize(C,raw,context()).cursor,null);}
  for(const limit of [1,100])assert.equal(normalize(C,{limit},context()).limit,limit);
  for(const limit of [0,101,-1,1.1,'1',null,NaN,Infinity])assert.throws(()=>normalize(C,{limit},context()));
  for(const cursor of [1,true,{},[], 'a'.repeat(2049)])assert.throws(()=>normalize(C,{cursor},context()));
});
test('transport text bounds count Unicode code points and do not truncate source text',()=>{
  const unicode='😀'.repeat(2048);assert.equal(normalize(C,{cursor:unicode},context()).cursor,unicode);
  assert.throws(()=>normalize(C,{cursor:unicode+'a'},context()));
  const p=detail();p.data.name='😀'.repeat(4096);check(D,p,{},context());
  p.data.name+='a';reject(D,p);
});
test('canonical context rejects cross-tenant actor scope and multiple portfolios',()=>{
  for(const mutate of [c=>c.subject.tenantId='foreign',c=>c.subject.actorId='foreign',c=>c.subject.scopes[0].tenantId='foreign',c=>c.subject.entityIds=[],c=>c.subject.entityIds.push('foreign'),c=>c.subject.entityType='client',c=>c.subject.rosterVersionId='invented',c=>c.role='owner',c=>delete c.binding,c=>c.binding.writerFence=0]){
    const ctx=context();mutate(ctx);assert.throws(()=>normalize(D,{},ctx));}
});
test('full returned task and authorization subject cannot be substituted',()=>{
  for(const field of Object.keys(context().binding))mutateAll(D,detail,[p=>p.binding[field]=field==='writerFence'?22:field==='tenantId'||field==='actorId'?'foreign':uuid(9)]);
  mutateAll(C,changes,[p=>p.subject.authorizationDecisionId=uuid(9),p=>p.subject.policyRevision='foreign',p=>p.subject.entityIds=['foreign'],p=>p.subject.scopes[0].resourceId='foreign']);
  mutateAll(D,detail,[p=>p.data.id='foreign']);
});
test('projected member and visible client counts match rows without global absence claim',()=>{
  const p=detail();p.data.members=[];p.data.memberCount=0;p.data.clientLinks=[];p.data.clientLinkCount=0;p.data.recentEvents=[];check(D,p,{},context());
  mutateAll(D,detail,[p=>p.data.memberCount=2,p=>p.data.clientLinkCount=0,p=>p.data.visibleClientCount=1,p=>p.data.complete=true,p=>p.data.evidenceReady=true]);
});
test('actor role correlation is explicit and owner identity cannot create a grant',()=>{
  for(const role of ['owner','editor','viewer']){const p=detail();p.data.myRole=role;p.data.grants[0].role=role;check(D,p,{},context());}
  mutateAll(D,detail,[p=>p.data.grants.shift(),p=>p.data.myRole='owner',p=>p.data.grants[0].role='administrator',p=>{p.data.ownerUserId='review-actor';p.data.grants=[];}]);
});
test('duplicate grant principal, link client and native row identities refuse',()=>{
  mutateAll(D,detail,[p=>p.data.grants.push({...grant(),id:'other'}),p=>p.data.grants.push(grant('another','grant-1')),p=>{p.data.clientLinks.push({...p.data.clientLinks[0],id:'link-2'});p.data.clientLinkCount=2;},p=>{p.data.members.push(member());p.data.memberCount=2;},p=>p.data.recentEvents.push(event())]);
});
test('required nullable fields are not omitted or silently defaulted',()=>{
  for(const field of ['purpose','archivedAt'])mutateAll(D,detail,[p=>delete p.data[field]]);
  for(const field of ['label','reason','unresolvedInput','resolvedAt'])mutateAll(D,detail,[p=>delete p.data.members[0][field]]);
  for(const field of ['seenAt','acknowledgedAt','dismissedAt'])mutateAll(C,changes,[p=>delete p.data.items[0].state[field]]);
  mutateAll(C,changes,[p=>delete p.data.items[0].state,p=>delete p.data.nextCursor]);
});
test('all structural envelopes close fields, while opaque payload remains only reported data',()=>{
  const p=changes();p.data.items[0].payload={authorized:true,complete:true,capturedRevision:7,instructions:'untrusted',nested:[null,false,{role:'owner'}]};check(C,p,{},context());
  for(const select of [p=>p,p=>p.data,p=>p.data.grants[0],p=>p.data.clientLinks[0],p=>p.data.members[0],p=>p.data.recentEvents[0]])mutateAll(D,detail,[p=>select(p).proof=true]);
  mutateAll(C,changes,[p=>p.data.items[0].state.authorized=true,p=>p.data.capturedRevision=2]);
});
test('member variants and nullable unresolved metadata preserve DTO scope',()=>{
  for(const targetKind of ['program','program_element','project','budget_line','award'])for(const disposition of ['included','candidate','withdrawn','excluded','unresolved']){const p=detail();Object.assign(p.data.members[0],{targetKind,disposition,unresolvedInput:null});check(D,p,{},context());}
  mutateAll(D,detail,[p=>p.data.members[0].targetKind='client',p=>p.data.members[0].origin=null,p=>p.data.members[0].unresolvedInput=[],p=>p.data.revision=Number.MAX_SAFE_INTEGER+1]);
});
test('finite timestamps and safe revisions apply to every projected row type',()=>{
  const leap='2016-12-31T23:59:60Z';
  mutateAll(D,detail,[p=>p.data.createdAt=leap,p=>p.data.grants[0].updatedAt=leap,p=>p.data.clientLinks[0].createdAt=leap,p=>p.data.members[0].resolvedAt=leap,p=>p.data.recentEvents[0].occurredAt=leap]);
  mutateAll(C,changes,[p=>p.data.items[0].state.acknowledgedAt=leap,p=>p.data.items[0].aggregateRevision=-1,p=>p.data.items[0].state.revision=Number.MAX_SAFE_INTEGER+1]);
});
test('changes recipient state belongs to exactly the event and current actor',()=>{
  const p=changes();p.data.items[0].state=null;check(C,p,{},context());
  mutateAll(C,changes,[p=>p.data.items[0].state.eventId='other',p=>p.data.items[0].state.recipientUserId='other']);
});
test('event order is time then id descending and permits independent aggregate revisions',()=>{
  const rows=[{...event('z'),state:null},{...event('a'),aggregateRevision:99,state:null},{...event('old',EARLY),state:null}];
  check(C,changes(rows),{},context());reject(C,changes([...rows].reverse()));
  reject(C,changes([rows[1],rows[0]]));reject(C,changes([rows[0],rows[0]]));
});
test('terminal empty/short pages and exactly full continuation remain admissible',()=>{
  check(C,changes([]),{cursor:'old-cursor'},context());check(C,changes(),{limit:2},context());
  check(C,changes(undefined,'event-z'),{limit:1,cursor:'old-cursor'},context());
});
test('non-null continuation requires the producer full-page relationship',()=>{
  // Pinned producer slices visible events to limit and emits nextCursor only
  // when the visible buffer contains more than limit events.
  reject(C,changes(undefined,'event-z'),{limit:2});
});
test('cursor cannot name a foreign row, repeat input or advance an empty page',()=>{
  reject(C,changes(undefined,'foreign'));reject(C,changes(),{cursor:'event-z'});
  reject(C,changes([],'cursor'));reject(C,changes([{...event('b'),state:null},{...event('a'),state:null}]),{limit:1});
});
test('detail and changes do not interchange and unrelated Clio operation remains unsupported',()=>{
  reject(D,changes());reject(C,detail());
  for(const op of ['get_research_evidence','manage_research_portfolio','get_research_portfolio_analytics',{},null])assert.throws(()=>normalize(op,{},context()));
});
test('hostile shape/context/payload admission has zero property effects',()=>{
  let effects=0;
  const getter=Object.defineProperty({},'conversationId',{enumerable:true,get(){effects++;return uuid(1);}});
  const proxy=new Proxy({}, {get(){effects++;},ownKeys(){effects++;return [];},getPrototypeOf(){effects++;return null;}});
  for(const hostile of [getter,proxy,{toJSON(){effects++;return {};}}]){
    assert.throws(()=>normalize(D,hostile,context()));assert.throws(()=>normalize(D,{},hostile));
    const p=detail();p.data.recentEvents[0].payload=hostile;reject(D,p);
  }assert.equal(effects,0);
});
test('nested JSON rejects cycles, hidden and symbol fields, sparse arrays and exotic values',()=>{
  const cyclic={};cyclic.x=cyclic;
  for(const bad of [cyclic,Object.defineProperty({},'hidden',{value:1}),{[Symbol('x')]:1},new Date(),[,,],undefined,1n,NaN,Infinity]){
    const p=detail();p.data.members[0].unresolvedInput={bad};reject(D,p);}
  const shared={plain:true},p=detail();p.data.recentEvents[0].payload={a:shared,b:shared};check(D,p,{},context());
});
test('resource limits refuse rather than truncating and inputs remain unmodified',()=>{
  const p=detail(),before=structuredClone(p),ctx=context(),raw={cursor:'  q  '};check(D,p,{},ctx);normalize(C,raw,ctx);assert.deepEqual(p,before);assert.equal(raw.cursor,'  q  ');
  const deep=detail();let next=deep.data.recentEvents[0].payload;for(let i=0;i<66;i++)next=next.next={};reject(D,deep);
  const huge=detail();huge.data.recentEvents=Array.from({length:101},(_,n)=>event(String(999-n)));reject(D,huge);
});
