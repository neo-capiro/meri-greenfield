// Independent actual owner/control tests; scripted transaction boundary, never native SQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,canonicalSha256,NOW,uuid,requestJson,operation} from './invocation-harness.mjs';
const deliveryId='synthetic-stable-delivery';
const produced=h=>[...h.state().produced.values()][0];
const reserved=h=>[...h.state().reservations.values()][0];
const handlerCount=h=>h.f.calls.filter(x=>x==='handler').length;
const settleCount=h=>h.commands.filter(x=>x.sql.startsWith('UPDATE meri_qualification.budget SET consumed')).length;
async function setup(){const h=harness();const c=await h.controller();await c.bindTrustedGrant();return {h,c};}
const changedRequest=JSON.stringify({operation,arguments:{limit:2}});

test('production control constructs real source-disabled gateway and never dispatches',async()=>{
 const h=harness(),c=await h.controller(true);await c.bindTrustedGrant();
 await assert.rejects(c.execute(requestJson,h.credential,deliveryId),/UNAVAILABLE/);
 assert.equal(handlerCount(h),0);assert.equal(h.state().reservations.size,0);assert.equal(settleCount(h),0);
});
test('actual control->dispatcher validates normalized request and records immutable completion before fixed charge',async()=>{
 const {h,c}=await setup();const output=await c.execute(requestJson,h.credential,deliveryId);
 const p=produced(h),r=reserved(h);assert.match(p.invocation_id,/^owned_/);assert.equal(p.raw_request_sha256,canonicalSha256(JSON.parse(requestJson)));
 assert.equal(p.arguments_sha256,canonicalSha256({page:1,limit:10}));assert.notEqual(p.arguments_sha256,canonicalSha256({}));
 assert.equal(p.completion.resultSha256,canonicalSha256(JSON.parse(output)));assert.equal(p.completion.outputBytes,Buffer.byteLength(output));
 assert.equal(p.completion.factsSha256,canonicalSha256(p.facts));assert.equal(r.state,'SETTLED');assert.equal(h.state().budget.consumed_micro_usd,'10');assert.equal(handlerCount(h),1);
 const result=await (await h.controller()).reconcile(requestJson,deliveryId);assert.equal(result.stage,'SETTLED');assert.equal(result.resultDelivered,false);assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.accounting));
 assert.equal(JSON.stringify(result).includes('synthetic-actor'),false);assert.equal(settleCount(h),1);
 await assert.rejects((await h.controller()).execute(requestJson,h.credential,deliveryId));assert.equal(handlerCount(h),1);assert.equal(settleCount(h),1);
});
test('unprepared exact historical observation is ABSENT with no new row or refund',async()=>{
 const {h,c}=await setup();const out=await c.reconcile(requestJson,deliveryId);assert.deepEqual(out,{stage:'ABSENT',invocationId:null,reservationId:null,accounting:null,resultDelivered:false});assert.equal(h.state().produced.size,0);assert.equal(settleCount(h),0);
});
test('concurrent reconstructed producers retain one original ID, deadline and one physical handler',async()=>{
 const {h,c}=await setup();const d=h.delivery();const [a,b]=await Promise.all([h.enabledGateway().prepareInvocation(d,requestJson),h.enabledGateway().prepareInvocation(d,requestJson)]);
 assert.equal(a.invocationJson,b.invocationJson);assert.equal(a.deadlineMs,b.deadlineMs);assert.equal(h.state().produced.size,1);
 const results=await Promise.allSettled([c.execute(requestJson,h.credential,deliveryId),(await h.controller()).execute(requestJson,h.credential,deliveryId)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(handlerCount(h),1);assert.equal(h.state().reservations.size,1);assert.equal(settleCount(h),1);
});
test('canonical whitespace replay agrees; changed raw arguments cannot borrow original identity',async()=>{
 const {h}=await setup();const g=h.enabledGateway(),a=await g.prepareInvocation(h.delivery(),requestJson);
 const b=await g.prepareInvocation(h.delivery(),JSON.stringify(JSON.parse(requestJson),null,2));assert.equal(a.invocationJson,b.invocationJson);
 await assert.rejects(g.prepareInvocation(h.delivery(),changedRequest));assert.equal(h.state().produced.size,1);assert.equal(h.state().reservations.size,0);
});
test('same run/delivery key with replacement grant/task/fence refuses rather than minting a second identity',async()=>{
 const {h}=await setup();await h.enabledGateway().prepareInvocation(h.delivery(),requestJson);const first=structuredClone(produced(h));
 const b=structuredClone(h.invocation);b.grantId=uuid('9');b.binding.attemptId=uuid('a');b.binding.workerId=uuid('b');b.binding.writerFence=2;b.qualificationBinding.attempt=2;b.qualificationBinding.fence=2;b.qualificationBinding.workerArn=b.qualificationBinding.workerArn.replace(/a{32}$/,'b'.repeat(32));
 h.state().run={...h.state().run,attempt:2,fence:2,worker_arn:b.qualificationBinding.workerArn};h.state().grant={...h.state().grant,...h.state().run,grant_id:b.grantId};
 await h.owner().bindTrustedGrant(JSON.stringify(b));const {invocationId,...context}=b;
 await assert.rejects(h.enabledGateway().prepareInvocation(JSON.stringify({context,producer:h.producer,deliveryId}),requestJson));
 assert.equal(h.state().produced.size,1);assert.deepEqual(produced(h),first);assert.equal(handlerCount(h),0);
});
for(const stage of ['prepare','reserve','marker','settle'])test(`lost ${stage} COMMIT acknowledgement preserves exact durable stage across owner reconstruction`,async()=>{
 const {h,c}=await setup();h.loseStage(stage);await assert.rejects(c.execute(requestJson,h.credential,deliveryId));
 const p=produced(h);assert.ok(p);const id=p.invocation_id;const r=reserved(h);
 assert.equal(handlerCount(h),['prepare','reserve'].includes(stage)?0:1);assert.ok(h.releases.some(Boolean),'uncertain client evicted');
 const next=await h.controller();const result=await next.reconcile(requestJson,deliveryId);assert.equal(result.invocationId,id);assert.equal(result.resultDelivered,false);
 assert.equal(result.stage,stage==='prepare'?'PREPARED':stage==='reserve'?'UNKNOWN':'SETTLED');
 if(stage==='prepare'){assert.equal(r,undefined);assert.equal(h.state().budget.consumed_micro_usd,'0');}
 else if(stage==='reserve'){assert.equal(reserved(h).state,'UNKNOWN');assert.equal(produced(h).completion,null);assert.equal(h.state().budget.consumed_micro_usd,'0');await assert.rejects(next.execute(requestJson,h.credential,deliveryId));assert.equal(handlerCount(h),0);}
 else{assert.equal(h.state().budget.consumed_micro_usd,'10');await next.reconcile(requestJson,deliveryId);assert.equal(settleCount(h),1);assert.equal(handlerCount(h),1);}
});
test('UNKNOWN without completion remains held after revocation, expiry, quarantine and restart',async()=>{
 const {h,c}=await setup();h.f.entry.execute=async()=>{h.f.calls.push('handler');throw Error('synthetic unavailable result');};await assert.rejects(c.execute(requestJson,h.credential,deliveryId));
 h.state().grant.state='REVOKED';h.state().budget.quarantined=true;h.setClock(NOW+20000);
 const result=await (await h.controller()).reconcile(requestJson,deliveryId);assert.equal(result.stage,'UNKNOWN');assert.equal(result.accounting.holdMicrousd,'10');assert.equal(result.accounting.chargedMicrousd,null);assert.equal(settleCount(h),0);assert.equal(handlerCount(h),1);
});
test('retained valid marker reconciles historically once with full fixed charge and no result release',async()=>{
 const {h,c}=await setup();h.loseStage('marker');await assert.rejects(c.execute(requestJson,h.credential,deliveryId));
 h.state().grant.state='REVOKED';h.state().budget.quarantined=true;h.setClock(NOW+20000);
 const out=await (await h.controller()).reconcile(requestJson,deliveryId);assert.equal(out.stage,'SETTLED');assert.equal(out.accounting.chargedMicrousd,'10');assert.equal(out.resultDelivered,false);
 await (await h.controller()).reconcile(requestJson,deliveryId);assert.equal(settleCount(h),1);assert.equal(handlerCount(h),1);
});
test('reserved owned namespace cannot enter legacy execute or forInvocation with an extra bypass argument',async()=>{
 const {h}=await setup();const g=h.enabledGateway();const p=await g.prepareInvocation(h.delivery(),requestJson);
 assert.throws(()=>h.owner().forInvocation(p.invocationJson),/OWNED_INVOCATION_REQUIRED/);
 await assert.rejects(g.execute(requestJson,h.credential,p.invocationJson,undefined,{settle(){throw Error('bypass');}}),/OWNED_INVOCATION_REQUIRED/);
 assert.equal(h.state().reservations.size,0);assert.equal(handlerCount(h),0);
});
test('aborted before prepare makes no new transaction or authority call',async()=>{
 const {h,c}=await setup();const n=h.commands.length;const a=new AbortController();a.abort();await assert.rejects(c.execute(requestJson,h.credential,deliveryId,a.signal));assert.equal(h.commands.length,n);assert.equal(h.f.calls.length,0);assert.equal(h.state().produced.size,0);
});
test('cancelled parked prepare acknowledgement cannot start dispatch after late completion',async()=>{
 const {h,c}=await setup();const gate=h.parkCommit('prepare'),a=new AbortController();const promise=c.execute(requestJson,h.credential,deliveryId,a.signal);const rejected=assert.rejects(promise);await gate.ready;a.abort();await rejected;gate.resume();await new Promise(r=>setImmediate(r));
 assert.equal(h.state().produced.size,1);assert.equal(h.state().reservations.size,0);assert.equal(h.f.calls.length,0);assert.equal(handlerCount(h),0);
});
for(const cause of ['abort','expiry'])test(`${cause} while completion marker ACK is parked prevents automatic settlement after late ACK`,async()=>{
 const {h,c}=await setup();const gate=h.parkCommit('marker'),a=new AbortController();const promise=c.execute(requestJson,h.credential,deliveryId,a.signal);const rejected=assert.rejects(promise);await gate.ready;
 if(cause==='abort')a.abort();else h.setClock(NOW+20000);
 gate.resume();await rejected;await new Promise(r=>setImmediate(r));
 assert.ok(produced(h).completion);assert.equal(reserved(h).state,'UNKNOWN');assert.equal(settleCount(h),0);assert.equal(handlerCount(h),1);
 const result=await (await h.controller()).reconcile(requestJson,deliveryId);assert.equal(result.stage,'SETTLED');assert.equal(settleCount(h),1);
});
for(const failure of ['invalid-output','release-denial'])test(`${failure} leaves UNKNOWN without completion proof`,async()=>{
 const {h,c}=await setup();const original=h.f.entry.execute;
 h.f.entry.execute=async call=>{const out=await original(call);if(failure==='release-denial'){h.f.state.revoked=true;return out;}return '{}';};
 await assert.rejects(c.execute(requestJson,h.credential,deliveryId));assert.equal(produced(h).completion,null);assert.equal(reserved(h).state,'UNKNOWN');assert.equal(settleCount(h),0);
});
for(const field of ['raw_request_sha256','arguments_sha256','facts','producer_key_sha256','completion'])test(`corrupt retained ${field} cannot authorize historical settlement`,async()=>{
 const {h,c}=await setup();h.loseStage('marker');await assert.rejects(c.execute(requestJson,h.credential,deliveryId));const p=produced(h);
 if(field==='facts')p.facts.binding.actorId='foreign';else if(field==='completion')p.completion.invocationId='foreign-invocation';else p[field]='e'.repeat(64);
 if(field==='producer_key_sha256'){const out=await c.reconcile(requestJson,deliveryId);assert.equal(out.stage,'ABSENT');}else await assert.rejects(c.reconcile(requestJson,deliveryId));
 assert.equal(settleCount(h),0);assert.equal(reserved(h).state,'UNKNOWN');
});
test('live normalized digest must be the canonical dispatcher result, never caller-supplied reconciliation digest',async()=>{
 const {h,c}=await setup();h.loseStage('marker');await assert.rejects(c.execute(requestJson,h.credential,deliveryId));
 await assert.rejects(h.enabledGateway().reconcileInvocation(h.delivery(),JSON.stringify({...JSON.parse(requestJson),argumentsSha256:'e'.repeat(64)})));
 assert.equal(settleCount(h),0);assert.equal(produced(h).arguments_sha256,canonicalSha256({page:1,limit:10}));
 await c.reconcile(requestJson,deliveryId);assert.equal(settleCount(h),1);
});
test('unknown model liability participates in the same canonical reservation cap',async()=>{
 const {h,c}=await setup();h.state().budget.cap_micro_usd='100';h.state().model.push({run_id:uuid('9'),grant_id:uuid('9'),state:'UNKNOWN',hold_micro_usd:'91'});
 await assert.rejects(c.execute(requestJson,h.credential,deliveryId));assert.equal(h.state().reservations.size,0);assert.equal(handlerCount(h),0);assert.equal(settleCount(h),0);
});
test('control rejects outer accessor/proxy without executing injected code',async()=>{
 const {pathToFileURL}=await import('node:url');const {bindToolInvocationControl}=await import(pathToFileURL(`${process.env.MERI_REVIEW_SOURCE_ROOT}/apps/control/tool-invocations.mjs`));let effects=0;
 assert.throws(()=>bindToolInvocationControl({get gateway(){effects++;throw Error('private');},contextJson:'{}',producerJson:'{}'}));
 assert.throws(()=>bindToolInvocationControl(new Proxy({},{getPrototypeOf(){effects++;throw Error('private');}})));assert.equal(effects,0);
});

test('cancel during live accounting first write cannot start the next accounting write',async()=>{
 const {h,c}=await setup();const gate=h.parkAt('UPDATE meri_qualification.budget SET consumed_micro_usd'),a=new AbortController();
 const promise=c.execute(requestJson,h.credential,deliveryId,a.signal),rejected=assert.rejects(promise);await gate.ready;a.abort();const atCancel=h.commands.length;gate.resume();await rejected;await new Promise(r=>setImmediate(r));
 assert.equal(h.commands.slice(atCancel).filter(x=>x.sql.startsWith('UPDATE meri_qualification.tool_reservations SET')).length,0,'second accounting write started after cancellation');
 assert.equal(reserved(h).state,'UNKNOWN');assert.equal(h.state().budget.consumed_micro_usd,'0');assert.ok(produced(h).completion);
});

test('replayed preparation preserves the original deadline rather than granting a fresh request window',async()=>{
 const {h,c}=await setup();const first=await h.enabledGateway().prepareInvocation(h.delivery(),requestJson);h.setClock(first.deadlineMs+1);
 const again=await h.enabledGateway().prepareInvocation(h.delivery(),requestJson);assert.equal(again.deadlineMs,first.deadlineMs);assert.equal(again.invocationJson,first.invocationJson);
 await assert.rejects(c.execute(requestJson,h.credential,deliveryId));assert.equal(handlerCount(h),0);assert.equal(h.state().reservations.size,0);
});

test('cancel during produced reservation count query cannot start a later reservation INSERT',async()=>{
 const {h,c}=await setup();const gate=h.parkAt('SELECT count(*) AS calls'),a=new AbortController();
 const promise=c.execute(requestJson,h.credential,deliveryId,a.signal),rejected=assert.rejects(promise);await gate.ready;a.abort();const atCancel=h.commands.length;gate.resume();await rejected;await new Promise(r=>setImmediate(r));
 assert.equal(h.commands.slice(atCancel).filter(x=>x.sql.startsWith('INSERT INTO meri_qualification.tool_reservations')).length,0,'reservation INSERT started after cancellation');
 assert.equal(h.state().reservations.size,0);assert.equal(handlerCount(h),0);
});
