import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { createSourceDisabledGateway } from '../index.mjs';
import { fixture as originalFixture, NOW, limits, uuid } from './fixtures.mjs';
import { connected, clientId, actorId, page, operation, row } from '../../../docs/qualification/candidates/capability-successor-20261012/action-review/fixture.mjs';
const tick = () => new Promise(resolve=>setImmediate(resolve));

test('all15 production operations remain unavailable and zero-effect',async()=>{
  const f=originalFixture();const gateway=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('7')});
  assert.equal(catalog.operations.length,21);assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);
  for(const descriptor of catalog.operations)await assert.rejects(gateway.execute(JSON.stringify({operation:descriptor.operation,arguments:{clientId}}),'synthetic-opaque'),/UNAVAILABLE/);
  assert.deepEqual(f.calls,[]);
});
test('actual resolver to current authority to dispatcher validates a nonempty recommendation',async()=>{
  const f=connected({clientId:` ${clientId} `});const output=JSON.parse(await f.create().execute(f.request,'synthetic-opaque'));
  assert.equal(output.actions.length,1);assert.equal(output.actions[0].recordKind,'action_recommendation');assert.equal(output.actions[0].nativeCompletion.completed,false);
  const call=f.state.handlerCall;assert.equal(call.authority.binding.actorId,actorId);assert.equal(call.input.clientId,clientId);assert.equal(call.request.clientId,` ${clientId} `);
  assert.deepEqual(f.state.policyInput,call.input);assert.equal(f.state.reservation.argumentsSha256,canonicalSha256(call.input));
  assert.equal(f.state.reservation.argumentsSha256,call.argumentsSha256);assert.equal(f.calls.filter(x=>x==='handler').length,1);
  assert.equal(f.calls.filter(x=>x==='policy').length,4);assert.ok(f.calls.lastIndexOf('policy')>f.calls.indexOf('settle'));assert.equal(f.calls.includes('uncertain'),false);
});
test('clientless and malformed raw arguments refuse before reserve or handler',async()=>{
  for(const args of [{},{clientId:null},{clientId:' '},{cursor:'opaque'},{actionItemId:'exact'},{clientId,limit:'20'},{clientId,cursor:'x'.repeat(4097)}]){
    const f=connected(args);await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/INVALID_ARGUMENTS/);
    assert.equal(f.calls.includes('reserve'),false);assert.equal(f.calls.includes('handler'),false);}
});
test('model authority injection refuses before every trusted port',async()=>{
  for(const key of ['actorId','tenantId','writerFence','policyRevision','binding']){
    const f=connected({clientId,nested:{[key]:'forged'}});await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/INVALID_ARGUMENTS/);assert.deepEqual(f.calls,[]);}
});
test('stale task, expired credential, absent grant and disabled source stop prior to reservation',async()=>{
  for(const kind of ['fence','expiry','grant','source']){
    const f=connected();if(kind==='fence')f.state.fence=2;if(kind==='expiry')f.claims.expiresAt=new Date(NOW).toISOString();if(kind==='grant')f.state.grants=[];if(kind==='source')f.state.sourceEnabled=false;
    await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/ACCESS_DENIED/);assert.equal(f.calls.includes('reserve'),false);assert.equal(f.calls.includes('handler'),false);}
});
test('revocation while reserving prevents effect and preserves uncertain hold',async()=>{
  const f=connected(),reserve=f.budget.reserve;f.budget.reserve=async call=>{const r=await reserve(call);f.state.revoked=true;return r;};
  await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/ACCESS_DENIED/);assert.equal(f.calls.includes('handler'),false);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
});
test('opaque cursor and exact action requests reach effect only as canonical selections',async()=>{
  const f=connected({clientId,cursor:'opaque-unqualified',limit:1});const out=JSON.parse(await f.create().execute(f.request,'synthetic-opaque'));
  assert.equal(f.state.handlerCall.input.page,null);assert.equal(f.state.handlerCall.input.cursorApplied,true);assert.equal(f.state.handlerCall.request.cursor,'opaque-unqualified');
  assert.equal(out.scope.page,2);assert.equal(out.pageCoverage.complete,false);assert.equal(out.evidenceReady,false);assert.equal(out.continuation.cursor,null);
});
test('full foreign run and authorization lineage never escapes even for valid family data',async()=>{
  for(const change of [p=>p.binding.runId=uuid('9'),p=>p.binding.attemptId=uuid('9'),p=>p.binding.workerId=uuid('9'),p=>p.binding.writerFence=2,p=>p.subject.authorizationDecisionId=uuid('9'),p=>{p.binding.actorId='other';p.subject.actorId='other';},p=>p.subject.policyRevision='other',p=>p.subject.entityIds=['other-client'],p=>p.operation={id:'query_tasks',version:'0.2.0'},p=>p.argumentsSha256='f'.repeat(64)]){
    const f=connected();f.entry.execute=async call=>{f.calls.push('handler');const out=page(call.request,{binding:call.authority.binding,subject:call.authority.subject});change(out);return JSON.stringify(out);};
    await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/INVALID_RESULT/);assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);}
});
test('source proof, fabricated evidence and recommendation completion fail through dispatch',async()=>{
  for(const change of [p=>p.actions[0].sourceProof.contentSha256='0'.repeat(64),p=>p.actions[0].sourceProof.currentClientId='foreign',p=>p.actions[0].nativeCompletion.completed=true,p=>p.actions[0].acceptedAsTask=true,p=>p.actions[0].nativeCompletion.establishesDeliveryOrAcceptance=true,p=>p.evidenceReady=true,p=>p.coverage.enumeration='complete',p=>p.sources[0].status='checked',p=>p.actions[0].recommendedAction='substituted']){
    const f=connected();f.entry.execute=async call=>{f.calls.push('handler');const out=page(call.request);change(out);return JSON.stringify(out);};
    await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/INVALID_RESULT/);assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.includes('uncertain'),true);}
});
test('reported recommendation outcome is accepted only as noncompletion',async()=>{
  const f=connected();f.entry.execute=async call=>JSON.stringify(page(call.request,{actions:[row({outcome:'Synthetic work reported'})]}));
  const out=JSON.parse(await f.create().execute(f.request,'synthetic-opaque'));assert.equal(out.actions[0].nativeCompletion.evidence,'recommendation_outcome_only');assert.equal(out.actions[0].nativeCompletion.completed,false);assert.equal(out.actions[0].acceptedAsTask,false);
});
test('revocation during effect or settlement never releases a result',async()=>{
  for(const stage of ['effect','settle']){
    const f=connected();if(stage==='effect'){const effect=f.entry.execute;f.entry.execute=async call=>{const out=await effect(call);f.state.revoked=true;return out;};}
    else {const settle=f.budget.settle;f.budget.settle=async call=>{const out=await settle(call);f.state.revoked=true;return out;};}
    await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/ACCESS_DENIED/);assert.equal(f.calls.includes('uncertain'),stage==='effect');}
});
test('uncertain acknowledgements stop before effects or output and never refund',async()=>{
  for(const stage of ['reserve','settle']){
    const f=connected();f.budget[stage]=async()=>{f.calls.push(stage);return 'false';};
    await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/BUDGET_UNCERTAIN/);assert.equal(f.calls.filter(x=>x==='handler').length,stage==='reserve'?0:1);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);}
});
test('cancelled parked effect/settlement cannot start a later authorization or release',async()=>{
  for(const stage of ['effect','settle']){
    const f=connected();const controller=new AbortController();let enter,release;const entered=new Promise(resolve=>{enter=resolve;});
    if(stage==='effect')f.entry.execute=call=>new Promise(resolve=>{f.calls.push('handler');release=()=>resolve(JSON.stringify(page(call.request)));enter();});
    else f.budget.settle=call=>new Promise(resolve=>{f.calls.push('settle');release=()=>resolve(JSON.stringify({reservationId:call.reservationId,decision:'settled'}));enter();});
    const output=f.create().execute(f.request,'synthetic-opaque',controller.signal);await entered;controller.abort();await assert.rejects(output,/CANCELLED/);
    const calls=[...f.calls];release();await tick();assert.deepEqual(f.calls,calls);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);}
});
test('freshly shortened release authority bounds parked settlement with no late release',async()=>{
  const f=connected();let release;const effect=f.entry.execute;f.entry.execute=async call=>{const out=await effect(call);f.state.deadline=NOW+20;return out;};
  f.budget.settle=call=>new Promise(resolve=>{f.calls.push('settle');release=()=>resolve(JSON.stringify({reservationId:call.reservationId,decision:'settled'}));});
  await assert.rejects(f.create().execute(f.request,'synthetic-opaque'),/DEADLINE/);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
  const calls=[...f.calls];release();await tick();assert.deepEqual(f.calls,calls);
});
