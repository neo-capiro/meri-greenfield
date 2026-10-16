/** Synthetic source/security controls. Fake HTTPS + scripted SQL; no Core, broker, database or provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {retainedCase,portfolioId,clientId} from './test/retained-cases.mjs';
import {durableFamilyFixture} from './test/durable-fixture.mjs';
const ids=['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'];
const code=c=>e=>e.message===c;
for(const id of ids){
 test(`synthetic ${id}: missing trusted context is unavailable before reserve/source`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));
  await assert.rejects(f.mount({retainedContextPorts:undefined}).execute({operation:f.operation,arguments:{},deliveryId:'no-context'}),code('UNAVAILABLE'));
  assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);
 });
 test(`synthetic ${id}: missing trusted broker is explicitly unavailable`,async()=>{
  const scene=retainedCase(id);delete scene.transport.getCredentials;
  const f=await durableFamilyFixture(scene);await assert.rejects(f.execute(),code('UNAVAILABLE'));assert.equal(f.wire.length,0);
 });
 for(const field of ['binding','operation','requestSha256','subject','sourceIds','policyRevision','checkedAtMs'])test(`synthetic ${id}: context ${field} substitution stops before reservation`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));f.state.contextMutator=r=>{
   if(field==='binding')r.binding={...r.binding,writerFence:2};else if(field==='subject')r.subject={...r.subject,actorId:'other'};
   else if(field==='operation')r.operation={...r.operation,id:'other'};else if(field==='sourceIds')r.sourceIds=[];
   else if(field==='checkedAtMs')r.checkedAtMs--;else r[field]='other';};
  await assert.rejects(f.execute(),code('ACCESS_DENIED'));assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);
 });
 test(`synthetic ${id}: current-context revocation at release withholds result`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));f.state.contextMutator=(r,n)=>{if(n>=4)r.policyRevision='revoked';};
  await assert.rejects(f.execute(),code('ACCESS_DENIED'));assert.equal(f.wire.length,1);assert.equal(f.state.produced.size,1);
 });
 for(const field of ['origin','argumentsSha256','normalizationContext'])test(`synthetic ${id}: broker ${field} substitution never calls Core`,async()=>{
  const f=await durableFamilyFixture(retainedCase(id));f.state.brokerMutator=r=>{r[field]=field==='normalizationContext'?{}:'forged';};
  await assert.rejects(f.execute(),code('INVALID_RESULT'));assert.equal(f.wire.length,0);
 });
 test(`synthetic ${id}: HTTP denial and oversized body are closed`,async()=>{
  for(const status of [401,403,404]){const f=await durableFamilyFixture(retainedCase(id));f.state.httpStatus=status;
   await assert.rejects(f.execute(),code('INVALID_RESULT'));assert.equal(f.state.budget.consumed_micro_usd,0);}
  const f=await durableFamilyFixture(retainedCase(id));f.state.responseHeaders={'content-length':'1048577'};
  await assert.rejects(f.execute(),code('INVALID_RESULT'));
 });
}
test('portfolio GET selector comes only from subject; changes preserve event-ID cursor and explicit limit25',async()=>{
 const f=await durableFamilyFixture(retainedCase(ids[1]));await f.execute();
 const [url,options]=f.wire[0];assert.equal(url,`https://core.example.invalid/api/research-portfolios/${portfolioId}/changes?limit=25`);
 assert.equal(options.method,'GET');assert.equal(options.body,undefined);assert.equal(options.headers['x-internal-service-secret'],undefined);
 const c=await durableFamilyFixture(retainedCase(ids[1]));c.page.items=[];await c.execute('cursor',{cursor:' e:a/?&= ',limit:100});
 const u=new URL(c.wire[0][0]);assert.equal(u.searchParams.get('cursor'),'e:a/?&=');assert.equal(u.searchParams.get('limit'),'100');
});
test('portfolio changed recipient/cursor/count and foreign conversation never become accepted pages',async()=>{
 const f=await durableFamilyFixture(retainedCase(ids[0]));await assert.rejects(f.execute('foreign',{conversationId:'99999999-9999-4999-8999-999999999999'}),code('INVALID_ARGUMENTS'));
 assert.equal(f.wire.length,0);
 const d=await durableFamilyFixture(retainedCase(ids[0]));d.page.memberCount=1;await assert.rejects(d.execute(),code('INVALID_RESULT'));
 const c=await durableFamilyFixture(retainedCase(ids[1]));c.page.items[0].state.recipientUserId='other';await assert.rejects(c.execute(),code('INVALID_RESULT'));
 const p=await durableFamilyFixture(retainedCase(ids[1]));p.page.nextCursor='substituted';await assert.rejects(p.execute(),code('INVALID_RESULT'));
});
test('Florida POST uses normalized selectors and trusted resolution; asOf is an observation label',async()=>{
 const f=await durableFamilyFixture(retainedCase(ids[2]));Object.assign(f.page.result.scope,{sessionKey:'2027',folderId:'folder-one',clientId});
 // Independent exact amount window legitimately need not share the requested fiscal/session window.
 f.page.result.amounts=[{id:'old-amount',observation:{fiscalYear:'2024-25',session:'old'}}];
 f.page.generatedAt='2026-10-12T01:00:01.000Z';
 const output=JSON.parse(await f.execute('florida',{q:'a'.repeat(250),projectId:'missing-project',sessionKey:'2027',folderId:'folder-one',clientId:' Example client ',offset:'0'}));
 const [url,options]=f.wire[0],input=JSON.parse(options.body);
 assert.equal(url,'https://core.example.invalid/api/clio/tools/get_florida_budget_project');assert.equal(options.method,'POST');
 assert.equal(input.q.length,200);assert.equal(input.clientId,clientId);assert.equal(input.fiscalYear,'2026-27');assert.equal(input.offset,0);
 assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');assert.equal('currentTurn'in input,false);
 assert.equal(output.result.generatedAt,new Date(f.now()).toISOString());assert.equal(output.result.result.amounts[0].observation.fiscalYear,'2024-25');
 assert.equal(output.argumentsSha256,canonicalSha256(input));assert.equal(f.state.contextReads,5);
});
test('Florida scope/clock drift and malformed result identity fail closed',async()=>{
 const a=await durableFamilyFixture(retainedCase(ids[2]));a.state.contextMutator=(r,n)=>{if(n===3)r.context.asOf='2026-10-01T00:00:00.000Z';};
 await assert.rejects(a.execute(),code('ACCESS_DENIED'));assert.equal(a.wire.length,0);
 const b=await durableFamilyFixture(retainedCase(ids[2]));b.page.result.scope.clientId=clientId;
 await assert.rejects(b.execute(),code('INVALID_RESULT'));
 const c=await durableFamilyFixture(retainedCase(ids[2]));c.page.tool='other';await assert.rejects(c.execute(),code('INVALID_RESULT'));
});
