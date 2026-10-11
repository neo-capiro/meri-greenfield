import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixture, request, response, NOW, id, copy, canonicalize } from '../../../../packages/contracts/test/sdk-fixture-wire.test.mjs';
import { createFixtureChannel } from './fixture-channel.mjs';

const bytes = value => Buffer.from(canonicalize(value));
const driver = full => ({runUuid:full.runUuid,sessionId:full.namespace.sessionId,
  attempt:full.identity.attempt,fence:full.identity.fence,operation:full.phase,deadlineMs:full.clock.deadlineMs});
function setup(phase='interrupt', extra={}) {
  const f=fixture(),calls=[],signals=[];
  const transport=async args=>{calls.push(args);signals.push(args.signal);const q=JSON.parse(args.requestBytes);return bytes(response(f,q));};
  let ids=0;
  const options={transport,producer:f.producer,current:phase==='resume'?f.current:f.producer,
    phaseDeadlineMs:NOW+100,requestId:()=>{ids++;return id(70);},fixtureFile:f.fixtureFile,
    evidence:f.evidence,reference:phase==='resume'?f.reference:undefined,now:()=>NOW,...extra};
  return {f,calls,signals,options,channel:createFixtureChannel(options),ids:()=>ids};
}
test('physical sentinel must match the channel-held file before commit or verify dispatch', async () => {
  for (const phase of ['interrupt', 'resume']) {
    const s = setup(phase), raw = Buffer.from('different synthetic sentinel');
    const foreign = { path: s.f.fixtureFile.path, bytes: raw.length,
      sha256: createHash('sha256').update(raw).digest('hex'), base64: raw.toString('base64') };
    const args = { context: driver(phase === 'interrupt' ? s.f.producer : s.f.current),
      bundle: s.f.bundle, reference: s.f.reference, fixtureFile: foreign };
    await assert.rejects(s.channel.checkpoint[phase === 'interrupt' ? 'commit' : 'verify'](args),
      /FIXTURE_SENTINEL_MISMATCH/);
    assert.equal(s.calls.length, 0);
    assert.equal(s.ids(), 0);
  }
});
test('inconsistent bulk capture refuses before cloning for static and deferred evidence', async () => {
  for (const deferred of [false, true]) {
    const s = setup('interrupt', deferred ? { evidence: undefined,
      evidenceProvider: async () => { throw new Error('unexpected supplier'); } } : {});
    s.f.bundle.totalBytes++;
    const original = globalThis.structuredClone; let copied = false;
    globalThis.structuredClone = function(value, ...args) {
      if (value === s.f.bundle) copied = true;
      return original(value, ...args);
    };
    try { await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer),
      bundle: s.f.bundle }), deferred ? /FIXTURE_TOTAL_BYTES/ : /FIXTURE_WIRE_INVALID_REQUEST/); }
    finally { globalThis.structuredClone = original; }
    assert.equal(copied, false);
    assert.equal(s.calls.length, 0);
    assert.equal(s.ids(), 0);
  }
});
test('driver six fields map to owner full contexts before any transport effect',async()=>{
  const s=setup(),d=driver(s.f.producer);
  assert.equal(await s.channel.gateway.authorize(d),true);
  const q=JSON.parse(s.calls[0].requestBytes);assert.deepEqual(q.context,s.f.producer);
  assert.equal(s.calls[0].operation,'authorizeFixturePhase');assert.equal(s.calls[0].deadlineMs,NOW+100);
  assert.equal(s.signals[0].aborted,true);
  for(const [field,value] of [['runUuid',id(90)],['sessionId',id(90)],['attempt',2],['fence',2],['operation','resume'],['deadlineMs',d.deadlineMs+1]]){
    await assert.rejects(s.channel.gateway.authorize({...d,[field]:value}),/FIXTURE_DRIVER_CONTEXT/);
  }
  await assert.rejects(s.channel.gateway.authorize({...d,taskArn:'foreign'}),/FIXTURE_DRIVER_CONTEXT/);assert.equal(s.calls.length,1);
});
test('driver accessors and mutated owner objects cannot rewrite immutable mapping',async()=>{
  const s=setup(),d=driver(s.f.producer);let seen=0;
  const bad={...d};Object.defineProperty(bad,'attempt',{enumerable:true,get(){seen++;return 1;}});
  await assert.rejects(s.channel.gateway.authorize(bad),/FIXTURE_DRIVER_CONTEXT/);assert.equal(seen,0);
  s.f.producer.identity.taskArn='foreign';s.f.producer.pins.imageDigest='foreign';
  assert.equal(await s.channel.gateway.authorize(d),true);assert.notEqual(JSON.parse(s.calls[0].requestBytes).context.identity.taskArn,'foreign');
});
test('B stale request returns false only for exact validated current owner replacement',async()=>{
  const f=fixture();let calls=0;
  const s=setup('resume',{transport:async({requestBytes})=>{calls++;const q=JSON.parse(requestBytes);return bytes({...response(f,q),status:'DENIED_STALE_BINDING',currentContext:f.current});}});
  assert.equal(await s.channel.gateway.authorize(driver(f.producer)),false);assert.equal(calls,1);
  f.current.identity.mappingId=id(99);
  await assert.rejects(s.channel.gateway.authorize(driver(f.producer)),/FIXTURE_AUTHORIZATION_UNKNOWN/);
});
test('channel errors malformed replies and transport exceptions throw never false',async()=>{
  for(const mode of ['error','malformed','throw']){
    const s=setup('resume',{transport:async({requestBytes})=>{
      if(mode==='throw')throw new Error('PRIVATE_MARKER');if(mode==='malformed')return Buffer.from('{}');
      const q=JSON.parse(requestBytes);return bytes({channelVersion:'sdk-fixture/1',profile:'sdk-interruption-fixture-v1',operation:q.operation,requestId:q.requestId,context:q.context,status:'ERROR',code:'REVOKED'});
    }});
    await assert.rejects(s.channel.gateway.authorize(driver(s.f.producer)),error=>!error.message.includes('PRIVATE_MARKER')&&/^FIXTURE_/.test(error.message));
  }
});
test('commit returns only partial receipt correlation and never retries even known success',async()=>{
  const s=setup();const ref=await s.channel.checkpoint.commit({context:driver(s.f.producer),bundle:s.f.bundle});
  assert.deepEqual(ref,s.f.reference);assert.equal(s.calls.length,1);assert.equal(s.ids(),1);
  await assert.rejects(s.channel.checkpoint.commit({context:driver(s.f.producer),bundle:s.f.bundle}),/QUARANTINED/);
  assert.equal(s.calls.length,1);assert.equal(s.ids(),1);
});
test('ambiguous commit is sticky quarantined before a new correlation ID or dispatch',async()=>{
  let sends=0;const s=setup('interrupt',{transport:async()=>{sends++;throw new Error('LOST_ACK_PRIVATE');}});
  await assert.rejects(s.channel.checkpoint.commit({context:driver(s.f.producer),bundle:s.f.bundle}),/FIXTURE_CHANNEL_TRANSPORT/);
  await assert.rejects(s.channel.checkpoint.commit({context:driver(s.f.producer),bundle:s.f.bundle}),/QUARANTINED/);
  assert.equal(sends,1);assert.equal(s.ids(),1);
});
test('foreign producer receipt and corrupt payload refuse without acceptance',async()=>{
  const f=fixture(),s=setup('interrupt',{transport:async({requestBytes})=>{const q=JSON.parse(requestBytes),r=response(f,q);r.receipt.producer=f.current;return bytes(r);}});
  await assert.rejects(s.channel.checkpoint.commit({context:driver(f.producer),bundle:f.bundle}),/FIXTURE_WIRE_INVALID_RESPONSE/);
  const t=setup(),bad=copy(t.f.bundle);bad.files[0].sha256='0'.repeat(64);
  await assert.rejects(t.channel.checkpoint.commit({context:driver(t.f.producer),bundle:bad}),/FIXTURE_WIRE_INVALID_REQUEST/);assert.equal(t.calls.length,0);
});
test('load and verify retain independent expected reference and original producer',async()=>{
  const s=setup('resume');
  const loaded=await s.channel.checkpoint.load({context:driver(s.f.current),reference:s.f.reference});
  assert.deepEqual(loaded.bundle,s.f.bundle);assert.deepEqual(loaded.receipt.producer,s.f.producer);
  assert.equal(loaded.receipt.completeRecoveryCheckpoint,false);assert.equal(loaded.receipt.sessionStoreQualified,false);
  assert.equal(await s.channel.checkpoint.verify({context:driver(s.f.current),bundle:loaded.bundle,reference:s.f.reference}),true);
  assert.equal(s.calls.length,2);
  const wrong={...s.f.reference,receiptId:id(99)};
  await assert.rejects(s.channel.checkpoint.verify({context:driver(s.f.current),bundle:loaded.bundle,reference:wrong}),/EXPECTED_REFERENCE/);assert.equal(s.calls.length,2);
});
test('load cannot derive expected authority from its own response',async()=>{
  const s=setup('resume',{reference:undefined});
  await assert.rejects(s.channel.checkpoint.load({context:driver(s.f.current),reference:s.f.reference}),/EXPECTED_REFERENCE/);assert.equal(s.calls.length,0);
});
test('owner phase deadline expiry original D and postresponse clock remain binding',async()=>{
  const f=fixture();for(const deadline of [NOW,NOW+60001,f.producer.clock.deadlineMs+1])assert.throws(()=>setup('interrupt',{phaseDeadlineMs:deadline}),/PHASE_CUTOFF/);
  let now=NOW;const s=setup('interrupt',{now:()=>now});now=NOW+100;
  await assert.rejects(s.channel.gateway.authorize(driver(s.f.producer)),/DEADLINE/);assert.equal(s.calls.length,0);
  let observed=NOW;const t=setup('interrupt',{now:()=>observed,transport:async({requestBytes})=>{observed=NOW+100;return bytes(response(f,JSON.parse(requestBytes)));}});
  await assert.rejects(t.channel.gateway.authorize(driver(t.f.producer)),/DEADLINE/);
});
test('timeout aborts its owned signal once with no retry or borrowed disposal',async()=>{
  let calls=0,signal,disposed=0;
  const transport=args=>{calls++;signal=args.signal;return new Promise(()=>{});};transport.dispose=()=>disposed++;
  const s=setup('interrupt',{transport,phaseDeadlineMs:NOW+5});
  await assert.rejects(s.channel.checkpoint.commit({context:driver(s.f.producer),bundle:s.f.bundle}),/TIMEOUT/);
  assert.equal(signal.aborted,true);assert.equal(calls,1);assert.equal(disposed,0);
  await assert.rejects(s.channel.checkpoint.commit({context:driver(s.f.producer),bundle:s.f.bundle}),/QUARANTINED/);assert.equal(calls,1);
});
test('load sentinel data can seed verify only after trusted reference byte validation',async()=>{
  const s=setup('resume',{fixtureFile:undefined});
  await assert.rejects(s.channel.checkpoint.verify({context:driver(s.f.current),bundle:s.f.bundle,reference:s.f.reference}),/VERIFY_INPUTS/);
  const loaded=await s.channel.checkpoint.load({context:driver(s.f.current),reference:s.f.reference});
  assert.equal(await s.channel.checkpoint.verify({context:driver(s.f.current),bundle:loaded.bundle,reference:s.f.reference}),true);
});
test('rejected transport objects are never inspected for private messages or getters',async()=>{
  let reads=0;const rejection={get message(){reads++;throw new Error('PRIVATE_GETTER');}};
  const s=setup('interrupt',{transport:async()=>{throw rejection;}});
  await assert.rejects(s.channel.gateway.authorize(driver(s.f.producer)),/^Error: FIXTURE_CHANNEL_TRANSPORT$/);assert.equal(reads,0);
});
test('clock and correlation callback errors remain content-free and cannot dispatch',async()=>{
  assert.throws(()=>setup('interrupt',{now:()=>{throw new Error('PRIVATE_CLOCK');}}),/^Error: FIXTURE_CLOCK$/);
  const s=setup('interrupt',{requestId:()=>{throw new Error('PRIVATE_CORRELATION');}});
  await assert.rejects(s.channel.gateway.authorize(driver(s.f.producer)),/^Error: FIXTURE_REQUEST_ID$/);assert.equal(s.calls.length,0);
});
test('pre-dispatch serialization budget and backwards clock refuse before transport',async()=>{
  let reads=0;const s=setup('interrupt',{now:()=>++reads>=3?NOW+100:NOW});
  await assert.rejects(s.channel.gateway.authorize(driver(s.f.producer)),/DEADLINE/);assert.equal(s.calls.length,0);
  let now=NOW;const t=setup('interrupt',{now:()=>now});now--;
  await assert.rejects(t.channel.gateway.authorize(driver(t.f.producer)),/FIXTURE_CLOCK/);assert.equal(t.calls.length,0);
});

test('post-drain supplier gets exact frozen capture after gateway authorization and commits only returned references', async () => {
  let observed;
  const s = setup('interrupt', { evidence: undefined, evidenceProvider: async input => {
    observed = input;
    assert.equal(Object.isFrozen(input.bundle), true);
    assert.equal(Object.isFrozen(input.fixtureFile), true);
    assert.equal(input.signal.aborted, false);
    return s.f.evidence;
  } });
  const ref = await s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle });
  assert.deepEqual(ref, s.f.reference);
  assert.deepEqual(observed.bundle, s.f.bundle);
  assert.deepEqual(observed.fixtureFile, s.f.fixtureFile);
  assert.deepEqual(observed.producer, s.f.producer);
  assert.equal(observed.deadlineMs, NOW + 100);
  assert.equal(observed.signal.aborted, true);
  assert.deepEqual(s.calls.map(call => call.operation), ['authorizeFixturePhase', 'commitFixtureCheckpoint']);
  const committed = JSON.parse(s.calls[1].requestBytes);
  assert.deepEqual(committed.evidence, s.f.evidence);
  await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /QUARANTINED/);
});

test('supplier configuration and invalid capture refuse before timer, authority or supplier effects', async () => {
  let calls = 0;
  assert.throws(() => setup('interrupt', { evidenceProvider: () => {} }), /COMPOSITION/);
  assert.throws(() => setup('interrupt', { evidence: undefined, evidenceProvider: true }), /COMPOSITION/);
  const s = setup('interrupt', { evidence: undefined, evidenceProvider: () => { calls++; } });
  const bad = copy(s.f.bundle); bad.files[0].sha256 = '0'.repeat(64);
  await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: bad }), /BYTES_MISMATCH/);
  assert.equal(s.calls.length, 0); assert.equal(calls, 0);
});

test('supplier failure and malformed reply quarantine the whole attempt without commit or second publication', async () => {
  for (const mode of ['throw', 'malformed']) {
    let supplies = 0;
    const s = setup('interrupt', { evidence: undefined, evidenceProvider: async () => {
      supplies++; if (mode === 'throw') throw new Error('PRIVATE_SUPPLIER'); return {};
    } });
    await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /^Error: (FIXTURE_EVIDENCE_REFUSED|INVALID_FIXTURE_NativeEvidence)$/);
    await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /QUARANTINED/);
    assert.equal(supplies, 1); assert.equal(s.calls.length, 1);
  }
});

test('supplier timeout and external cancellation abort owned work and never dispatch commit', async () => {
  for (const cancel of [false, true]) {
    let suppliedSignal, supplies = 0;
    const abort = new AbortController();
    const s = setup('interrupt', { evidence: undefined, phaseDeadlineMs: NOW + 20,
      evidenceProvider: ({ signal }) => { supplies++; suppliedSignal = signal; if (cancel) abort.abort(); return new Promise(() => {}); } });
    await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle, signal: abort.signal }), /EVIDENCE_(TIMEOUT|REFUSED)/);
    assert.equal(suppliedSignal.aborted, true);
    await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /QUARANTINED/);
    assert.equal(supplies, 1); assert.equal(s.calls.length, 1);
  }
});

test('supplier consumes original phase and expiry clock rather than resetting commit budget', async () => {
  let observed = NOW;
  const s = setup('interrupt', { evidence: undefined, now: () => observed,
    evidenceProvider: async () => { observed = NOW + 100; return s.f.evidence; } });
  await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /DEADLINE/);
  await assert.rejects(s.channel.checkpoint.commit({ context: driver(s.f.producer), bundle: s.f.bundle }), /QUARANTINED/);
  assert.equal(s.calls.length, 1);
});

test('concurrent provider commits reserve one attempt before pending gateway authorization', async () => {
  let release, supplies = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const f = fixture();
  const s = setup('interrupt', { evidence: undefined,
    transport: async ({ requestBytes }) => {
      const q = JSON.parse(requestBytes);
      if (q.operation === 'authorizeFixturePhase') await barrier;
      return bytes(response(f, q));
    }, evidenceProvider: async () => { supplies++; return f.evidence; } });
  const first = s.channel.checkpoint.commit({ context: driver(f.producer), bundle: f.bundle });
  await assert.rejects(s.channel.checkpoint.commit({ context: driver(f.producer), bundle: f.bundle }), /QUARANTINED/);
  assert.equal(supplies, 0);
  release(); await first;
  assert.equal(supplies, 1);
});
