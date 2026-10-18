import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {actionLookupSlice} from './action-lookup-slice-fixture.mjs';

test('actual lookup delivery, durable gateway, fixed HTTP adapter and SQL result owner compose once',async()=>{
  const f=await actionLookupSlice(),delivered=await f.lookup(),read=await f.read();
  assert.deepEqual(f.http,[{url:'https://synthetic.invalid/api/clio/tools/actions.query',method:'POST'}]);
  assert.equal(f.h.state().produced.size,1);assert.equal(f.h.state().reservations.size,1);
  assert.equal(f.h.state().budget.consumed_micro_usd,'10');
  assert.equal([...f.h.state().reservations.values()][0].state,'SETTLED');
  assert.equal(f.sql.lookups.size,1);assert.equal(f.sql.events.size,2);assert.equal([...f.sql.lookups.values()][0].state,'RESULT');
  assert.deepEqual(delivered.events.map(e=>e.type),['tool.started','tool.completed']);
  for(const event of delivered.events)validateShape('UIEvent',event);
  assert.equal(read.resultSha256,canonicalSha256(read.observation));
  assert.equal(read.resultReference,delivered.resultReference);
  assert.equal(read.observation.result.actions.length,1);
  assert.equal(read.observation.result.actions[0].acceptedAsTask,false);
  assert.equal(read.observation.result.evidenceReady,false);
  assert.equal(read.observation.result.coverage.enumeration,'unknown');
  assert.equal(read.observation.result.sources[0].freshness,'unknown');
  assert.deepEqual(read.observation.binding,f.h.f.binding);
  const release=f.trace.at(-1);assert.equal(release.phase,'before_release');
  assert.deepEqual(release.binding.original.context.binding,f.h.f.binding);
  assert.deepEqual(release.binding.current,f.c.readContext.currentBinding);
});
test('duplicate stable lookup never redispatches or charges a second time',async()=>{
  const f=await actionLookupSlice();await f.lookup();await assert.rejects(f.lookup(),/LOOKUP_REPLAY/);
  assert.equal(f.http.length,1);assert.equal(f.h.state().budget.consumed_micro_usd,'10');
  assert.equal((await f.read()).classification,'recommendations');
});
test('current control denial before claim performs no source or lookup SQL',async()=>{
  const f=await actionLookupSlice();f.h.f.state.revoked=true;
  await assert.rejects(f.lookup(),/ACCESS_DENIED/);assert.equal(f.http.length,0);assert.equal(f.sql.calls.length,0);
  assert.equal(f.h.state().produced.size,0);
});
test('revocation after HTTP observation prevents result retention and release',async()=>{
  const f=await actionLookupSlice();f.h.afterHttp=()=>{f.h.f.state.revoked=true;};
  await assert.rejects(f.lookup());assert.equal(f.http.length,1);
  assert.ok([...f.sql.lookups.values()].every(row=>row.record===null));
  assert.equal([...f.h.state().reservations.values()][0].state,'UNKNOWN');
});
test('unknown durable completion acknowledgement never yields a control result or source retry',async()=>{
  const f=await actionLookupSlice();f.h.loseStage('marker');await assert.rejects(f.lookup());
  await assert.rejects(f.lookup(),/LOOKUP_REPLAY/);assert.equal(f.http.length,1);
  assert.ok([...f.sql.lookups.values()].every(row=>row.record===null));
  assert.equal([...f.h.state().reservations.values()][0].state,'UNKNOWN');
  assert.equal(f.h.state().budget.consumed_micro_usd,'0');
});
test('fresh read denial blocks previously retained result after successful lookup',async()=>{
  const f=await actionLookupSlice();await f.lookup();f.h.f.state.revoked=true;
  const before=f.sql.calls.length;await assert.rejects(f.read(),/ACCESS_DENIED/);
  assert.equal(f.sql.calls.length,before);assert.equal(f.http.length,1);
  assert.equal([...f.sql.lookups.values()][0].state,'RESULT');
});
