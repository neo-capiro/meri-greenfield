/** SYNTHETIC current-run and current-rights ports under the ACTUAL `createIntentResultRelease` consumer. No Core or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {createIntentResultRelease} from '../result-release.mjs';
import {createIntentResultReleaseAuthority} from '../result-release-authority.mjs';
import {intentFault} from '../faults.mjs';
const NOW=Date.parse('2026-10-18T14:00:00.000Z'),POLICY='a'.repeat(64),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'org_t',actorId:'user_a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scope={tenantId:'org_t',kind:'client',resourceId:id(9),policyRevision:POLICY};
const code=c=>e=>e?.code===c;
function setup({run={},rights={},runs}={}){
 const s={t:NOW,runReads:0,rightsReads:[]},now=()=>s.t;
 const authority=createIntentResultReleaseAuthority({binding,now,
  currentRun:async(b)=>{s.runReads++;const r=runs?.[s.runReads-1]??run;return JSON.stringify({binding:b,policyRevision:POLICY,deadlineMs:NOW+600000,checkedAtMs:s.t,...r});},
  currentRights:async v=>{s.rightsReads.push(v);return {tenantId:'org_t',actorId:'user_a',scopes:[scope],checkedAtMs:s.t,expiresAtMs:NOW+300000,...rights};}});
 const release=createIntentResultRelease({authority,binding,now});
 const life=()=>createOperationLifetime({deadlineMs:NOW+30000,now,errorFactory:c=>intentFault(c)});
 return {s,authority,release,life};
}
const call=life=>({operation:{id:'create_task',version:'0.2.0'},deliveryId:'sdk:'+'1'.repeat(64),argumentsSha256:'2'.repeat(64),life});
const proposalResult=(scopes=[scope])=>({status:'approval_required',proposal:{command:{binding,scopes},expiresAt:new Date(NOW+60000).toISOString()}});
test('capture and release (initial and replay) are authorized by the current run, current rights, exact selection and expiry',async()=>{
 const {s,release,life}=setup(),original=await release.capture(call(life()));
 assert.deepEqual(original,{binding,scopes:[scope],expiresAtMs:NOW+300000});
 assert.equal(s.runReads,2,'run read before rights and rechecked before the receipt');
 assert.deepEqual(s.rightsReads.map(v=>[v.binding,v.policyRevision,v.deadlineMs]),[[binding,POLICY,NOW+600000]]);
 const result=proposalResult();
 for(let replay=0;replay<2;replay++)assert.deepEqual(await release.release({...call(life()),owner:'command',result,original}),result);
 assert.equal(s.runReads,6);assert.equal(s.rightsReads.length,3);
});
test('the receipt binds the selection hash, binding, scopes and the tightest expiry',async()=>{
 const {authority}=setup(),limits=[];
 const selection={binding,operation:{id:'create_task',version:'0.2.0'},deliveryId:'sdk:'+'1'.repeat(64),argumentsSha256:'2'.repeat(64),original:{binding,scopes:[scope],expiresAtMs:NOW+100000},resultSha256:'3'.repeat(64)};
 const r=await authority.check({selection,selectionSha256:hash(selection),limitDeadline:d=>limits.push(d)});
 assert.deepEqual(r,{authorized:true,selectionSha256:hash(selection),binding,scopes:[scope],checkedAtMs:NOW,expiresAtMs:NOW+100000});assert.ok(limits.includes(NOW+100000));
 for(const bad of [{...selection,resultSha256:null},{...selection,original:null},{...selection,binding:{...binding,writerFence:2}}])
  await assert.rejects(authority.check({selection:bad,selectionSha256:hash(bad),limitDeadline:()=>{}}),code('ACCESS_DENIED'));
 await assert.rejects(authority.check({selection,selectionSha256:'0'.repeat(64),limitDeadline:()=>{}}),code('ACCESS_DENIED'));
});
test('a changed run, stale or foreign rights, a scope no longer current, or a policy change before release refuse',async()=>{
 const denied=async(options,original)=>{const {release,life}=setup(options);
  await assert.rejects(original?release.release({...call(life()),owner:'command',result:proposalResult(),original}):release.capture(call(life())),e=>code('ACCESS_DENIED')(e)||code('UNAVAILABLE')(e));};
 await denied({run:{binding:{...binding,writerFence:2}}});
 await denied({run:{checkedAtMs:NOW-1}});
 await denied({run:{deadlineMs:NOW}});
 await denied({rights:{actorId:'user_b'}});
 await denied({rights:{scopes:[{...scope,policyRevision:'b'.repeat(64)}]}});
 await denied({rights:{expiresAtMs:NOW}});
 await denied({runs:[{},{policyRevision:'c'.repeat(64)}]});
 await denied({rights:{scopes:[{...scope,resourceId:id(8)}]}},{binding,scopes:[scope],expiresAtMs:NOW+300000});
 await denied({},{binding,scopes:[scope],expiresAtMs:NOW});
});
test('missing owners refuse construction',()=>{
 for(const c of [{binding,currentRun:async()=>'{}',now:Date.now},{binding,currentRights:async()=>({}),now:Date.now},{binding:{},currentRun:async()=>'{}',currentRights:async()=>({}),now:Date.now}])
  assert.throws(()=>createIntentResultReleaseAuthority(c));
});
