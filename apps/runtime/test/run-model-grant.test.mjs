/** SYNTHETIC: real model-grant admission over a scripted durable issuer port. No credential/provider/DB operation. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {issueRunModelGrant} from '../run-model-grant.mjs';
const NOW=1900000000000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=v=>createHash('sha256').update(v).digest('hex');
const intent={issuanceKey:'a'.repeat(64),binding:{tenantId:'tenant',runId:id(1)},requestSha256:'b'.repeat(64),expiresAtMs:NOW+1000};
const credential='synthetic-run-model-capability-000001',taskGrant={grantId:id(2),capabilitySha256:'c'.repeat(64)},controlSha256='d'.repeat(64);
function fixture(change=r=>r){let calls=0;const owner={async issue({intent}){calls++;return change({...intent,grantId:id(3),capabilitySha256:hash(credential),proxyCredential:credential});}};
 return {call:extra=>issueRunModelGrant({owner,intent,taskGrant,controlSha256,now:()=>NOW,...extra}),calls:()=>calls};}
test('exact per-run model grant is distinct from task/control and its credential is absent from retained grant facts',async()=>{
 const f=fixture(),first=await f.call(),replay=await f.call();assert.deepEqual(replay,first);assert.equal(first.proxyCredential,credential);
 assert.deepEqual(first.grantIntent,{grantId:id(3),capabilitySha256:hash(credential),expiresAtMs:intent.expiresAtMs});assert.equal(JSON.stringify(first.grantIntent).includes(credential),false);
});
for(const field of ['binding','issuanceKey','requestSha256','expiresAtMs','capabilitySha256'])test(`retargeted or extended model grant ${field} is refused`,async()=>{
 const f=fixture(r=>({...r,[field]:field==='binding'?{...intent.binding,runId:id(4)}:field==='expiresAtMs'?NOW+2000:'e'.repeat(64)}));await assert.rejects(f.call(),/MODEL_GRANT_REFUSED/u);
});
test('task/control credential reuse, stale expiry and invalid clock are refused',async()=>{
 await assert.rejects(fixture(r=>({...r,grantId:taskGrant.grantId})).call(),/MODEL_GRANT_REFUSED/u);
 await assert.rejects(fixture().call({controlSha256:hash(credential)}),/MODEL_GRANT_REFUSED/u);
 await assert.rejects(fixture().call({taskGrant:{...taskGrant,capabilitySha256:hash(credential)}}),/MODEL_GRANT_REFUSED/u);
 await assert.rejects(fixture().call({now:()=>NOW+1000}),/MODEL_GRANT_REFUSED/u);
 await assert.rejects(fixture().call({now:()=>NaN}),/MODEL_GRANT_REFUSED/u);
});
test('cancelled issuance and missing owner fail closed; issuer uncertainty is never replaced with a static proxy credential',async()=>{
 const f=fixture(),ac=new AbortController();ac.abort();await assert.rejects(f.call({signal:ac.signal}),/MODEL_GRANT_REFUSED/u);assert.equal(f.calls(),0);
 await assert.rejects(f.call({owner:undefined}),/MODEL_GRANT_REFUSED/u);
 await assert.rejects(f.call({owner:{async issue(){throw Error('UNKNOWN');}}}),/UNKNOWN/u);
});
