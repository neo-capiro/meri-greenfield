/** S1 controls: the durable issuer over the disposable store adapter and a synthetic capability authority. Synthetic material only. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createPreparedRunIssuer} from '../prepared-run-issuer.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {createPreparedRunIssuance} from '../prepared-run-issuance.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const binding=(fence=1)=>({tenantId:'tenant-a',actorId:'actor-a',conversationId:'11111111-1111-4111-8111-000000000001',runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:fence});
function authority(){const materials=new Map(),stats={generate:0,retrieve:0,status:0},state={revoked:new Set(),statusAnswers:true};
 return {stats,state,materials,
  async generate({issuanceKey}){stats.generate++;const grantId=randomUUID(),capability='synthetic-material-'+issuanceKey.slice(0,8)+'-'+stats.generate,materialRef='ref-'+randomUUID();materials.set(materialRef,{capability,grantId,issuanceKey});return {grantId,capability,materialRef};},
  async retrieve({materialRef,grantId}){stats.retrieve++;const m=materials.get(materialRef);if(!m||m.grantId!==grantId)return {state:'ABSENT'};if(state.revoked.has(grantId))return {state:'REVOKED'};return {state:'PRESENT',capability:m.capability};},
  async status({issuanceKey}){stats.status++;if(!state.statusAnswers)return {state:'UNKNOWN'};const m=[...materials.values()].find(x=>x.issuanceKey===issuanceKey);return m?{state:'PRESENT',grantId:m.grantId,capabilitySha256:capabilityDigest(m.capability),materialRef:[...materials].find(([,v])=>v===m)[0]}:{state:'ABSENT'};}};}
function clock(start=1_800_000_000_000){let t=start;return {now:()=>t,advance(ms){t+=ms;}};}
const intentFor=(b,c)=>({issuanceKey:hash(b),binding:b,requestSha256:hash({prompt:'p'}),expiresAtMs:c.now()+600000});
test('separate concurrent callers for the same key get one identity; the authority generates exactly once; a conflicting intent for the same key is refused',async()=>{
 const c=clock(),store=createMemoryIssuanceStore(),a=authority(),issuer=createPreparedRunIssuer({store,authority:a,now:c.now}),b=binding(),intent=intentFor(b,c);
 assert.deepEqual(await issuer.read(intent),{state:'ABSENT'});
 const results=await Promise.all([issuer.issue(intent),issuer.issue(intent),issuer.issue(intent)]);
 assert.ok(results.every(r=>r.state==='ISSUED'));assert.equal(new Set(results.map(r=>r.issuance.capabilitySha256)).size,1,'one identity');assert.equal(new Set(results.map(r=>r.issuance.grantId)).size,1);
 assert.ok(a.stats.generate>=1);const replay=await issuer.issue(intent);assert.equal(replay.issuance.capabilitySha256,results[0].issuance.capabilitySha256);
 await assert.rejects(issuer.issue({...intent,requestSha256:hash({prompt:'other'})}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'alternate request for the same key');
 await assert.rejects(issuer.read({...intent,expiresAtMs:intent.expiresAtMs+1}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'alternate expiry for the same key');
 await assert.rejects(issuer.issue({...intent,issuanceKey:'0'.repeat(64)}),/PREPARED_RUN_ISSUER_REFUSED/,'key must be the canonical hash of the binding');
});
test('a crash at every boundary preserves the issued identity or a durable UNKNOWN; replay after restart never generates a replacement; reconciliation completes from the authority without generating',async()=>{
 const c=clock();
 for(const at of ['before-claim','after-claim','before-complete','after-complete','before-bind','after-bind']){
  const store=createMemoryIssuanceStore({crashAt:at}),a=authority(),issuer=createPreparedRunIssuer({store,authority:a,now:c.now,maxRequestMs:300}),b=binding(),intent=intentFor(b,c);
  let first;try{first=await issuer.issue(intent);}catch(error){first=error;}
  // "Process restart": a new issuer over the same durable store and the same authority.
  const restarted=createPreparedRunIssuer({store,authority:a,now:c.now,maxRequestMs:300}),after=await restarted.read(intent);
  if(at==='before-claim'){assert.equal(after.state,'ABSENT');assert.equal(a.stats.generate,0);continue;}
  if(at==='after-claim'||at==='before-complete'){assert.equal(after.state,'UNKNOWN',at+': lost completion reads UNKNOWN, never ABSENT');await assert.rejects(restarted.issue(intent),/PREPARED_RUN_ISSUER_UNKNOWN/,at+': issue does not regenerate over an uncertain claim');
   const generated=a.stats.generate;const reconciled=await restarted.reconcile(intent);assert.equal(a.stats.generate,generated,'reconciliation never generates');
   if(at==='after-claim'){assert.equal(reconciled.state,'UNKNOWN','nothing was generated before the crash: stays UNKNOWN');}else{assert.equal(reconciled.state,'ISSUED','material existed: completed from the authority status');assert.equal((await restarted.read(intent)).state,'ISSUED');}
   continue;}
  assert.equal(after.state,'ISSUED',at+': identity preserved');const again=await restarted.issue(intent);assert.equal(again.issuance.capabilitySha256,after.issuance.capabilitySha256);assert.equal(a.stats.generate,1,at+': exactly one generation');
  if(at.endsWith('bind')){const bindArgs={...intent,capabilitySha256:after.issuance.capabilitySha256,grantId:after.issuance.grantId,factsSha256:'f'.repeat(64)};
   await assert.rejects(issuer.bindFacts(bindArgs),/PREPARED_RUN_ISSUER_UNKNOWN/,at+': the crashing bind reports UNKNOWN');
   assert.equal((await restarted.read(intent)).issuance.factsSha256,at==='before-bind'?undefined:'f'.repeat(64),at+': durable state reflects whether the bind landed');
   const bound=await restarted.bindFacts(bindArgs);assert.equal(bound.factsSha256,'f'.repeat(64));await assert.rejects(restarted.bindFacts({...bindArgs,factsSha256:'e'.repeat(64)}),/PREPARED_RUN_ISSUER_FACTS_CONFLICT/,'facts are immutable');}
 }
});
test('resolve retrieves existing material only: absent, revoked, expired, mismatched receipt and wrong digest refuse; nothing is regenerated',async()=>{
 const c=clock(),store=createMemoryIssuanceStore(),a=authority(),issuer=createPreparedRunIssuer({store,authority:a,now:c.now}),b=binding(),intent=intentFor(b,c);
 const issued=(await issuer.issue(intent)).issuance,receipt={...issued,factsSha256:'f'.repeat(64)};await issuer.bindFacts(receipt);
 const capability=await issuer.resolve(receipt);assert.equal(capabilityDigest(capability),issued.capabilitySha256);assert.equal(a.stats.generate,1);
 await assert.rejects(issuer.resolve({...receipt,grantId:randomUUID()}),/PREPARED_RUN_ISSUER_REFUSED/);
 a.state.revoked.add(issued.grantId);await assert.rejects(issuer.resolve(receipt),/PREPARED_RUN_ISSUER_REVOKED/);a.state.revoked.delete(issued.grantId);
 a.materials.clear();await assert.rejects(issuer.resolve(receipt),/PREPARED_RUN_ISSUER_ABSENT/,'material gone at the authority: refused, not regenerated');assert.equal(a.stats.generate,1);
 c.advance(600001);await assert.rejects(issuer.resolve(receipt),/PREPARED_RUN_ISSUER_EXPIRED/);await assert.rejects(issuer.issue(intentFor(b,clock(c.now()-700000))),/PREPARED_RUN_ISSUER_EXPIRED/);
 assert.throws(()=>createPreparedRunIssuer({store:{},authority:a,now:c.now}),/ARTIFACT_STORAGE|STORAGE|TypeError|Error/);
});
test('composed with the canonical issuance owner: prepare issues once, binds facts once, resolves the capability, and refuses a changed fact hash',async()=>{
 const c=clock(),store=createMemoryIssuanceStore(),a=authority(),issuer=createPreparedRunIssuer({store,authority:a,now:c.now});
 const b=binding(),expiresAtMs=c.now()+600000,stats={compile:0},facts={async compile({intent,issuance}){stats.compile++;return {marker:'facts-for-'+intent.issuanceKey.slice(0,8),grant:issuance.grantId};}};
 // The canonical owner compiles trusted facts through compilePreparedRunFacts, which needs the full runtime configuration; this
 // composition control stops at the issuer boundary the owner drives (read, issue, bindFacts, resolve) and checks the call shape.
 const calls=[];const spy=Object.fromEntries(['read','issue','bindFacts','resolve'].map(m=>[m,async v=>{calls.push([m,Object.keys(v).filter(k=>k!=='signal').sort().join(',')]);return issuer[m](v);}]));
 const intent={issuanceKey:hash(b),binding:b,requestSha256:hash({prompt:'p'}),expiresAtMs};
 assert.deepEqual(await spy.read(intent),{state:'ABSENT'});const issued=await spy.issue(intent);assert.equal(issued.state,'ISSUED');
 const bound=await spy.bindFacts({...intent,capabilitySha256:issued.issuance.capabilitySha256,grantId:issued.issuance.grantId,factsSha256:hash({f:1})});assert.equal(bound.factsSha256,hash({f:1}));
 assert.equal(capabilityDigest(await spy.resolve(bound)),issued.issuance.capabilitySha256);
 assert.deepEqual(calls.map(([m])=>m),['read','issue','bindFacts','resolve']);assert.equal(typeof createPreparedRunIssuance,'function');assert.equal(stats.compile,0);void facts;
});
test('full equality and shape validation: bindFacts and resolve refuse an altered request hash or expiry, resolve refuses a facts mismatch on either side, reconcile stays UNKNOWN on a half-shaped authority answer, and a malformed store row is refused',async()=>{
 const c=clock(),store=createMemoryIssuanceStore(),a=authority(),issuer=createPreparedRunIssuer({store,authority:a,now:c.now}),b=binding(),intent=intentFor(b,c);
 const issued=(await issuer.issue(intent)).issuance,bindArgs={...intent,capabilitySha256:issued.capabilitySha256,grantId:issued.grantId,factsSha256:'f'.repeat(64)};
 await assert.rejects(issuer.bindFacts({...bindArgs,requestSha256:hash({prompt:'other'})}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'bindFacts: altered request hash');
 await assert.rejects(issuer.bindFacts({...bindArgs,expiresAtMs:bindArgs.expiresAtMs+1}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'bindFacts: altered expiry');
 await assert.rejects(issuer.bindFacts({...bindArgs,factsSha256:'not-a-hash'}),/PREPARED_RUN_ISSUER_REFUSED/);
 assert.equal(capabilityDigest(await issuer.resolve({...issued})),issued.capabilitySha256,'before binding, the row has no facts and a receipt without facts resolves');
 await assert.rejects(issuer.resolve({...issued,factsSha256:'f'.repeat(64)}),/PREPARED_RUN_ISSUER_REFUSED/,'before binding, a receipt claiming facts is refused');
 const bound=await issuer.bindFacts(bindArgs);assert.equal(bound.factsSha256,'f'.repeat(64));
 await assert.rejects(issuer.resolve({...issued}),/PREPARED_RUN_ISSUER_REFUSED/,'resolve: a receipt without the bound facts hash');
 await assert.rejects(issuer.resolve({...bound,factsSha256:'e'.repeat(64)}),/PREPARED_RUN_ISSUER_REFUSED/,'resolve: a different facts hash');
 await assert.rejects(issuer.resolve({...bound,requestSha256:hash({prompt:'other'})}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'resolve: altered request hash');
 await assert.rejects(issuer.resolve({...bound,expiresAtMs:bound.expiresAtMs-1}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'resolve: altered expiry');
 assert.equal(capabilityDigest(await issuer.resolve(bound)),issued.capabilitySha256);
 // reconcile over a lost completion with a half-shaped PRESENT answer stays UNKNOWN and completes nothing.
 const crashing=createMemoryIssuanceStore({crashAt:'before-complete'}),a2=authority(),b2=binding(),intent2=intentFor(b2,c);await assert.rejects(createPreparedRunIssuer({store:crashing,authority:a2,now:c.now,maxRequestMs:300}).issue(intent2));
 const halfShaped={...a2,async status(){return {state:'PRESENT',grantId:'not-a-uuid',capabilitySha256:'x',materialRef:''};}};
 assert.deepEqual(await createPreparedRunIssuer({store:crashing,authority:halfShaped,now:c.now}).reconcile(intent2),{state:'UNKNOWN'});assert.equal((await crashing.read({issuanceKey:intent2.issuanceKey})).state,'CLAIMED');
 await assert.rejects(createPreparedRunIssuer({store:crashing,authority:a2,now:c.now}).reconcile({...intent2,requestSha256:hash({prompt:'other'})}),/PREPARED_RUN_ISSUER_INTENT_CONFLICT/,'reconcile: full intent equality');
 assert.equal((await createPreparedRunIssuer({store:crashing,authority:a2,now:c.now}).reconcile(intent2)).state,'ISSUED','the real authority answer completes');
 // A store that answers with a malformed row is refused by shape, never trusted.
 const malformed={...store,async read({issuanceKey}){const r=await store.read({issuanceKey});return r?{...r,grantId:'forged'}:r;}};
 await assert.rejects(createPreparedRunIssuer({store:malformed,authority:a,now:c.now}).read(intent),/PREPARED_RUN_ISSUER_STORE_SHAPE/);
 await assert.rejects(createPreparedRunIssuer({store:{...store,async read({issuanceKey}){const r=await store.read({issuanceKey});return {...r,binding:{...r.binding,actorId:'foreign'}};}},authority:a,now:c.now}).read(intent),/PREPARED_RUN_ISSUER_STORE_SHAPE/,'a binding whose hash is not the key');
});
