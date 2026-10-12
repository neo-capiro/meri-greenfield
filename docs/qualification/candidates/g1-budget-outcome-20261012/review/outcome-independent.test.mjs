import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,NOW,uuid,operation,requestJson,BudgetCommitUncertain} from './outcome-harness.mjs';
const snapshot=h=>structuredClone(h.state());
const mutations=h=>h.commands.filter(x=>/^(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP)\b/.test(x.sql));
async function initialized(state='UNKNOWN') {const h=harness();await h.bind();if(state!=='ABSENT')await h.reserve();if(state==='SETTLED')await h.settle();return h;}

test('actual disabled gateway exposes exact ABSENT observation with zero ledger mutation',async()=>{
  const h=await initialized('ABSENT'),before=snapshot(h),writes=mutations(h).length;
  const g=h.gateway();assert.equal(g.sourceEnabled,false);assert.equal(typeof g.readInvocationOutcome,'function');
  assert.deepEqual(await g.readInvocationOutcome(h.json(),JSON.stringify(h.expected)),{invocationId:h.invocation.invocationId,reservationId:null,state:'ABSENT',operation,argumentsSha256:h.expected.argumentsSha256,holdMicrousd:null,chargedMicrousd:null,outputBytes:null,observedAtMs:NOW});
  assert.deepEqual(h.state(),before);assert.equal(mutations(h).length,writes);assert.deepEqual(h.f.calls,[]);
});
for(const kind of ['UNKNOWN','SETTLED'])test(`${kind} returns immutable bounded accounting through actual owner composition`,async()=>{
  const h=await initialized(kind),before=snapshot(h),writes=mutations(h).length;
  const outcome=await h.read();assert.equal(outcome.state,kind);assert.equal(outcome.holdMicrousd,'10');
  assert.equal(outcome.chargedMicrousd,kind==='SETTLED'?'10':null);assert.equal(outcome.outputBytes,kind==='SETTLED'?7:null);
  assert.equal(outcome.reservationId,uuid('7'));assert.ok(Object.isFrozen(outcome));assert.ok(Object.isFrozen(outcome.operation));
  assert.deepEqual(Object.keys(outcome).sort(),['invocationId','reservationId','state','operation','argumentsSha256','holdMicrousd','chargedMicrousd','outputBytes','observedAtMs'].sort());
  assert.deepEqual(h.state(),before);assert.equal(mutations(h).length,writes);assert.deepEqual(h.f.calls,[]);
});
for(const phase of ['reserve','settle'])test(`canonical lost ${phase} acknowledgement retained across fresh readback without replay`,async()=>{
  const h=await initialized('ABSENT');if(phase==='settle')await h.reserve();h.loseCommit();
  await assert.rejects(phase==='reserve'?h.reserve():h.settle(),BudgetCommitUncertain);
  assert.ok(h.releases.at(-1) instanceof BudgetCommitUncertain);const before=snapshot(h);
  const outcome=await h.read();assert.equal(outcome.state,phase==='reserve'?'UNKNOWN':'SETTLED');assert.deepEqual(h.state(),before);
  await assert.rejects(h.reserve());assert.equal(h.state().reservations.size,1);assert.equal(h.state().budget.consumed_micro_usd,phase==='reserve'?'0':'10');
});
test('historical original A remains inspectable after expiry/revocation/quarantine and replacement B',async()=>{
  const h=await initialized();h.state().grant.state='REVOKED';h.state().grant.expires_at=new Date(NOW-1);h.state().budget.quarantined=true;
  Object.assign(h.state().run,{attempt:2,fence:2,worker_arn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'b'.repeat(32)}`});h.setClock(NOW+20000);
  assert.equal((await h.read()).state,'UNKNOWN');await assert.rejects(h.reserve());assert.equal(h.state().reservations.size,1);
});
test('ABSENT is a snapshot; same existing trusted invocation may become UNKNOWN after later reservation',async()=>{
  const h=await initialized('ABSENT');const absent=await h.read();assert.equal(absent.state,'ABSENT');
  await h.reserve();assert.equal((await h.read()).state,'UNKNOWN');assert.equal(absent.state,'ABSENT');assert.equal(h.state().reservations.size,1);
});
test('read acknowledgement uncertainty and ordinary query failure release no success receipt or writes',async()=>{
  const h=await initialized(),before=snapshot(h);h.loseCommit();await assert.rejects(h.read(),BudgetCommitUncertain);assert.deepEqual(h.state(),before);
  h.failAt('tool_reservations WHERE');await assert.rejects(h.read());assert.deepEqual(h.state(),before);h.failAt(null);
  assert.equal((await h.read()).state,'UNKNOWN');
});
test('read serialized behind actual canonical reservation boundary sees committed UNKNOWN',async()=>{
  const h=await initialized('ABSENT'),parked=h.parkAt('INSERT INTO meri_qualification.tool_reservations');
  const reservation=h.reserve();await parked.ready;let completed=false;const read=h.read().then(value=>{completed=true;return value;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);parked.resume();await reservation;
  assert.equal((await read).state,'UNKNOWN');assert.equal(h.state().reservations.size,1);
});
test('parallel observations do not alter or settle liability',async()=>{
  const h=await initialized(),before=snapshot(h),writes=mutations(h).length;
  const results=await Promise.all([h.read(),h.read(),h.read()]);assert.ok(results.every(r=>r.state==='UNKNOWN'));
  assert.deepEqual(h.state(),before);assert.equal(mutations(h).length,writes);
});
test('all canonical descriptor execute paths remain unavailable before further transaction/authority work',async()=>{
  const h=await initialized();const n=h.commands.length;assert.equal(h.operations.length,14);
  for(const entry of h.operations)await assert.rejects(h.gateway().execute(JSON.stringify({operation:entry.operation,arguments:{}}),h.credential,h.json()),/UNAVAILABLE/);
  assert.equal(h.commands.length,n);assert.deepEqual(h.f.calls,[]);assert.equal(h.gateway().sourceEnabled,false);
});
for(const state of ['ABSENT','UNKNOWN'])test(`${state} requires retained allocation and original grant binding`,async()=>{
  for(const key of ['allocation','grantBinding','grant']){const h=await initialized(state);h.state()[key]=null;await assert.rejects(h.read());}
});
test('raw expected/invocation objects cannot execute getters or proxy reflection',async()=>{
  const h=await initialized(),n=h.commands.length;let effects=0;
  const getter={get operation(){effects++;throw Error('private');}},proxy=new Proxy({},{get(){effects++;throw Error('private');}});
  for(const value of [getter,proxy]){await assert.rejects(h.gateway().readInvocationOutcome(h.json(),value));await assert.rejects(h.gateway().readInvocationOutcome(value,JSON.stringify(h.expected)));}
  assert.equal(effects,0);assert.equal(h.commands.length,n);
});
test('closed invalid expectations deny before scripted connection work',async()=>{
  const h=await initialized(),n=h.commands.length;
  for(const value of [{...h.expected,extra:true},{operation},{...h.expected,argumentsSha256:'x'},{...h.expected,operation:{id:'other',version:'0.2.0'}}])await assert.rejects(h.gateway().readInvocationOutcome(h.json(),JSON.stringify(value)));
  await assert.rejects(h.gateway().readInvocationOutcome(h.json(),' '.repeat(65537)));assert.equal(h.commands.length,n);
});
test('operation/argument mismatch cannot expose an existing outcome',async()=>{
  const h=await initialized();await assert.rejects(h.gateway().readInvocationOutcome(h.json(),JSON.stringify({...h.expected,argumentsSha256:'f'.repeat(64)})));
  h.row().operation={...operation,version:'0.2.1'};await assert.rejects(h.read());
});
test('tenant actor conversation run and allocation substitution cannot read other scope',async()=>{
  for(const field of ['tenantId','actorId','conversationId','runId']){const h=await initialized(),i=structuredClone(h.invocation);i.binding[field]=field==='tenantId'||field==='actorId'?'foreign':uuid('9');await assert.rejects(h.gateway().readInvocationOutcome(JSON.stringify(i),JSON.stringify(h.expected)));}
  const h=await initialized(),i={...h.invocation,allocationSha256:'f'.repeat(64)};await assert.rejects(h.gateway().readInvocationOutcome(JSON.stringify(i),JSON.stringify(h.expected)));
});
test('historical grant correlation rejects task attempt fence policy capability and grant substitutions',async()=>{
  const changes={grant_id:uuid('9'),run_id:uuid('9'),attempt:2,worker_arn:'foreign',fence:2,policy_revision:'b'.repeat(64),capability_sha256:'c'.repeat(64),state:'PENDING',expires_at:new Date(NaN)};
  for(const [key,value]of Object.entries(changes)){const h=await initialized();h.state().grant[key]=value;await assert.rejects(h.read(),undefined,`grant ${key}`);}
});
test('retained allocation and grant-binding duplicate columns cannot disagree with facts',async()=>{
  for(const [table,key]of [['allocation','run_id'],['allocation','allocation_sha256'],['grantBinding','grant_id'],['grantBinding','run_id']]){const h=await initialized();h.state()[table][key]=key.includes('sha')?'f'.repeat(64):uuid('9');await assert.rejects(h.read(),undefined,`${table}.${key}`);}
  const h=await initialized();h.state().grantBinding.facts.binding.workerId=uuid('9');await assert.rejects(h.read());
});
test('reservation duplicate identities and full original facts cannot disagree',async()=>{
  for(const key of ['invocation_id','reservation_id','run_id','grant_id']){const h=await initialized();h.row()[key]=key==='reservation_id'?'not-uuid':uuid('9');await assert.rejects(h.read(),undefined,key);}
  const h=await initialized();h.row().facts.binding.workerId=uuid('9');await assert.rejects(h.read());
});
test('UNKNOWN rejects charge/output/time fields inconsistent with retained liability',async()=>{
  const changes={state:'NO_DISPATCH',hold_micro_usd:'0',max_output_bytes:'0',charged_micro_usd:'10',output_bytes:'0',settled_at:new Date(NOW),created_at:new Date(NOW+1)};
  for(const [key,value]of Object.entries(changes)){const h=await initialized();h.row()[key]=value;await assert.rejects(h.read(),undefined,key);}
});
test('SETTLED refuses malformed amounts, output overflow, missing or unordered timestamps',async()=>{
  const changes={hold_micro_usd:'11',charged_micro_usd:'11',output_bytes:'65537',created_at:new Date(NaN),settled_at:null};
  for(const [key,value]of Object.entries(changes)){const h=await initialized('SETTLED');h.row()[key]=value;await assert.rejects(h.read(),undefined,key);}
  for(const time of [NOW-1,NOW+1]){const h=await initialized('SETTLED');h.row().settled_at=new Date(time);await assert.rejects(h.read());}
});
