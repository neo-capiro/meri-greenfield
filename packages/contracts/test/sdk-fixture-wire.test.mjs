import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';
import { canonicalSha256, validateShape as publicShape } from '../validate.mjs';
import { validateShape, publicSchemaSha256, assertFixtureContext, fixtureReceiptIdentity,
  assertFixtureReceipt, assertFixtureRequest, assertFixtureResponse } from '../qualification-sdk/validate.mjs';

// Fixed synthetic DATA, never admitted identities or an allocated runtime clock.
const id = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const T = 1000000, NOW = T + 20000;
const profile = { channelVersion: 'sdk-fixture/1', profile: 'sdk-interruption-fixture-v1' };
const partial = { completeRecoveryCheckpoint: false, sessionStoreQualified: false };
const hash = raw => createHash('sha256').update(raw).digest('hex');
const copy = value => structuredClone(value);
const scope = () => ({ tenantId: 'synthetic', kind: 'tenant', resourceId: 'synthetic', policyRevision: 'd'.repeat(64) });
const object = (n, bytes = 9, sha256 = 'e'.repeat(64)) => ({ objectId: id(n), versionId: `immutable-${n}`, bytes, sha256, scopes: [scope()] });
function context(phase = 'interrupt') {
  const b = phase === 'resume';
  return { ...profile, runUuid: id(1), phase,
    namespace: { sessionId: id(2), cwd: '/workspace/conversation', projectKey: '-workspace-conversation' },
    identity: { mappingId: id(b ? 12 : 11), grantId: id(b ? 22 : 21), admittedAtMs: T + (b ? 15000 : 0), expiresAtMs: T + 720000,
      taskArn: `arn:aws:ecs:us-east-1:967807252336:task/qualification/${(b ? '2' : '1').repeat(32)}`,
      attempt: b ? 2 : 1, fence: b ? 2 : 1, policyRevision: 'd'.repeat(64),
      canonical: { tenantId: 'synthetic', actorId: 'actor', conversationId: id(3), runId: id(4),
        attemptId: id(b ? 32 : 31), workerId: id(b ? 42 : 41), writerFence: b ? 2 : 1 } },
    clock: { t0Ms: T, deadlineMs: T + 720000, cleanupDeadlineMs: T + 900000 },
    pins: { sourceCommit: 'a'.repeat(40), imageDigest: `sha256:${'b'.repeat(64)}`, sdkVersion: '0.3.295', cliVersion: '2.1.295',
      contractsVersion: '0.1.0', contractsSchemaSha256: publicSchemaSha256, skillsManifestSha256: 'c'.repeat(64) } };
}
function file(path, raw) { return { path, bytes: raw.length, sha256: hash(raw), base64: raw.toString('base64') }; }
function fixture() {
  const producer = context(), current = context('resume');
  const bundle = { format: 'meri-native-session-files-v1', sdk: '0.3.295', cli: '2.1.295', binding: copy(producer.namespace),
    directories: [id(2), `${id(2)}/subagents`], files: [file(`${id(2)}.jsonl`, Buffer.from('opaque compaction and unknown fields\n')),
      file(`${id(2)}/subagents/agent-a.jsonl`, Buffer.from('opaque child\n'))], totalBytes: 0 };
  bundle.totalBytes = bundle.files.reduce((n, f) => n + f.bytes, 0);
  const fixtureFile = file('qualification/continuity.txt', Buffer.from('SYNTHETIC-CONTINUITY\n'));
  const evidence = { init: object(61), interrupt: object(62), exit: object(63), drain: object(64) };
  const workspace = { contractVersion: '0.1.0', manifestId: id(51), binding: copy(producer.identity.canonical),
    logicalCwd: '/workspace/conversation', entries: [{ path: fixtureFile.path, kind: 'file', executable: false,
      object: object(52, fixtureFile.bytes, fixtureFile.sha256) }], scopes: [scope()], createdAt: new Date(T + 10000).toISOString() };
  const bundleRef = object(53, Buffer.byteLength(canonicalize(bundle)), canonicalSha256(bundle));
  const receipt = { ...profile, ...partial, receiptId: id(54), producer, coverage: { native: 'declared-transcript-tree', workspace: 'one-synthetic-sentinel' },
    bundle: bundleRef, nativeInventory: { format: bundle.format, directories: copy(bundle.directories),
      files: bundle.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })), totalBytes: bundle.totalBytes },
    workspace, workspaceSha256: canonicalSha256(workspace), evidence,
    commit: { commitId: id(55), publisherId: 'trusted-fixture-broker', committedAtMs: T + 11000,
      publication: 'CURRENT_FENCE_COMMITTED', publicationFence: 1, bundleReadback: copy(bundleRef), workspaceReadbackSha256: canonicalSha256(workspace) } };
  return { producer, current, receipt, bundle, fixtureFile, evidence, reference: fixtureReceiptIdentity(receipt) };
}
function request(f, operation) {
  return { ...profile, operation, requestId: id(70), context: copy(operation === 'commitFixtureCheckpoint' || operation === 'authorizeFixturePhase' ? f.producer : f.current),
    ...(operation === 'commitFixtureCheckpoint' ? { bundle: copy(f.bundle), fixtureFile: copy(f.fixtureFile), evidence: copy(f.evidence) } : {}),
    ...(['loadFixtureCheckpoint', 'verifyFixtureCheckpoint'].includes(operation) ? { reference: copy(f.reference) } : {}),
    ...(operation === 'verifyFixtureCheckpoint' ? { bundle: copy(f.bundle), fixtureFile: copy(f.fixtureFile) } : {}) };
}
function response(f, req) {
  return { ...profile, operation: req.operation, requestId: req.requestId, context: copy(req.context),
    ...(req.operation === 'authorizeFixturePhase' ? { status: 'AUTHORIZED', decisionId: id(71), checkedAtMs: NOW } :
      { ...partial, status: { commitFixtureCheckpoint: 'COMMITTED', loadFixtureCheckpoint: 'LOADED', verifyFixtureCheckpoint: 'VERIFIED' }[req.operation], receipt: copy(f.receipt) }),
    ...(req.operation === 'loadFixtureCheckpoint' ? { bundle: copy(f.bundle), fixtureFile: copy(f.fixtureFile) } : {}) };
}
const options = f => ({ producer: f.producer, nowMs: NOW });

import {encodeFixtureRequest, decodeFixtureRequest, decodeFixtureResponse, MAX_FIXTURE_WIRE_BYTES} from '../qualification-sdk/wire.mjs';
export {fixture, request, response, context, NOW, T, id, copy, profile, partial, canonicalize};

const raw = value => Buffer.from(canonicalize(value));
const decode = (f, q, value) => decodeFixtureResponse(value, q, {producer:f.producer,nowMs:NOW});
test('canonical fixture wire encodes and decodes all four fixed operations without mutation',()=>{
  const f=fixture();
  for(const op of ['authorizeFixturePhase','commitFixtureCheckpoint','loadFixtureCheckpoint','verifyFixtureCheckpoint']){
    const q=request(f,op),before=copy(q),encoded=encodeFixtureRequest(q,{nowMs:NOW});
    assert.equal(encoded.toString(),canonicalize(q));assert.deepEqual(q,before);
    const r=response(f,q),result=decode(f,q,raw(r));assert.deepEqual(result.response,r);assert.equal(result.status,r.status);
  }
});
test('trusted-service request decoder round-trips all four canonical worker operations as DATA',()=>{
  const f=fixture();
  for(const op of ['authorizeFixturePhase','commitFixtureCheckpoint','loadFixtureCheckpoint','verifyFixtureCheckpoint']){
    const q=request(f,op),before=copy(q),encoded=encodeFixtureRequest(q,{nowMs:NOW});
    assert.deepEqual(decodeFixtureRequest(encoded,{nowMs:NOW}),before);
    assert.deepEqual(q,before);
  }
});
test('request decoder refuses invalid buffers, encoding, structure and expired context',()=>{
  const q=request(fixture(),'authorizeFixturePhase'),r=raw(q);
  for(const b of [Buffer.from([0xc3,0x28]),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),r]),
    r.subarray(0,r.length-1),Buffer.from('null'),Buffer.from('[]'),Buffer.alloc(0),
    Buffer.alloc(MAX_FIXTURE_WIRE_BYTES+1,0x20),'{}'])
    assert.throws(()=>decodeFixtureRequest(b,{nowMs:NOW}),/^Error: FIXTURE_WIRE_INVALID_REQUEST$/);
  assert.throws(()=>decodeFixtureRequest(r,{nowMs:T+720000}),/^Error: FIXTURE_WIRE_INVALID_REQUEST$/);
  const invalid={...q,operation:'arbitrary'};
  assert.throws(()=>decodeFixtureRequest(raw(invalid),{nowMs:NOW}),/^Error: FIXTURE_WIRE_INVALID_REQUEST$/);
});
test('request decoder refuses noncanonical duplicate, whitespace, number and escape forms',()=>{
  const q=request(fixture(),'authorizeFixturePhase'),s=raw(q).toString();
  for(const value of [' '+s,s+'\n','{"operation":"authorizeFixturePhase",'+s.slice(1),
    s.replace('"attempt":1','"attempt":1.0'),
    s.replace('"admittedAtMs":1000000','"admittedAtMs":1e6'),
    s.replace('"requestId":"0','"requestId":"\\u0030')]){
    assert.notEqual(value,s);assert.deepEqual(JSON.parse(value),JSON.parse(s));
    assert.throws(()=>decodeFixtureRequest(Buffer.from(value),{nowMs:NOW}),/^Error: FIXTURE_WIRE_INVALID_REQUEST$/);
  }
});
test('wire refuses invalid UTF8 BOM truncation and non-object responses',()=>{
  const f=fixture(),q=request(f,'authorizeFixturePhase'),r=raw(response(f,q));
  for(const b of [Buffer.from([0xc3,0x28]),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),r]),r.subarray(0,r.length-1),Buffer.from('null'),Buffer.from('[]'),Buffer.alloc(0),'{}'])
    assert.throws(()=>decode(f,q,b),/^Error: FIXTURE_WIRE_INVALID_RESPONSE$/);
});
test('wire canonical equality rejects duplicates whitespace escapes and alternate numeric forms',()=>{
  const f=fixture(),q=request(f,'authorizeFixturePhase'),s=raw(response(f,q)).toString();
  for(const value of [' '+s,s+'\n','{"status":"AUTHORIZED",'+s.slice(1),s.replace('"checkedAtMs":1020000','"checkedAtMs":1020000.0'),s.replace('"checkedAtMs":1020000','"checkedAtMs":1.02e6'),s.replace('"requestId":"0','"requestId":"\\u0030')]){
    assert.notEqual(value,s);assert.deepEqual(JSON.parse(value),JSON.parse(s));assert.throws(()=>decode(f,q,Buffer.from(value)),/FIXTURE_WIRE_INVALID_RESPONSE/);
  }
});
test('wire schema correlation future decision and error replies never become stale false',()=>{
  const f=fixture(),q=request(f,'authorizeFixturePhase');
  for(const edit of [r=>r.requestId=id(99),r=>r.checkedAtMs=NOW+1,r=>r.context.identity.fence=9,r=>r.authorized=true,r=>r.status=false]){
    const r=response(f,q);edit(r);assert.throws(()=>decode(f,q,raw(r)),/FIXTURE_WIRE_INVALID_RESPONSE/);
  }
  const r={...profile,operation:q.operation,requestId:q.requestId,context:q.context,status:'ERROR',code:'INDETERMINATE'};
  assert.throws(()=>decode(f,q,raw(r)),/FIXTURE_WIRE_INVALID_RESPONSE/);
});
test('wire raw cap precedes parse and nested/nonfinite parsed data refuses',()=>{
  const f=fixture(),q=request(f,'authorizeFixturePhase');
  assert.throws(()=>decode(f,q,Buffer.alloc(MAX_FIXTURE_WIRE_BYTES+1,0x20)),/FIXTURE_WIRE_INVALID_RESPONSE/);
  const s=raw(response(f,q)).toString();
  for(const n of ['1e309','-1e309','NaN','Infinity'])assert.throws(()=>decode(f,q,Buffer.from(s.replace('1020000',n))),/FIXTURE_WIRE_INVALID_RESPONSE/);
  let deep=null;for(let i=0;i<40;i++)deep={deep};const r=response(f,q);r.extra=deep;assert.throws(()=>decode(f,q,Buffer.from(JSON.stringify(r))),/FIXTURE_WIRE_INVALID_RESPONSE/);
});
test('wire request validation rejects hidden/accessor/unknown operations before serialization',()=>{
  const f=fixture();let effects=0;
  const q=request(f,'authorizeFixturePhase');Object.defineProperty(q,'operation',{enumerable:true,get(){effects++;return 'authorizeFixturePhase';}});
  assert.throws(()=>encodeFixtureRequest(q,{nowMs:NOW}),/FIXTURE_WIRE_INVALID_REQUEST/);assert.equal(effects,0);
  const bad=request(f,'authorizeFixturePhase');bad.operation='arbitrary';assert.throws(()=>encodeFixtureRequest(bad,{nowMs:NOW}),/FIXTURE_WIRE_INVALID_REQUEST/);
});
test('wire accepts only exact validated stale denial and keeps original producer binding',()=>{
  const f=fixture(),q=request(f,'authorizeFixturePhase'),r={...response(f,q),status:'DENIED_STALE_BINDING',currentContext:f.current};
  assert.equal(decode(f,q,raw(r)).status,'STALE_BINDING_DENIED');
  const foreign=copy(f.producer);foreign.identity.canonical.actorId='foreign';
  assert.throws(()=>decodeFixtureResponse(raw(r),q,{producer:foreign,nowMs:NOW}),/FIXTURE_WIRE_INVALID_RESPONSE/);
});
