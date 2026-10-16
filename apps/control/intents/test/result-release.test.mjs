/** SYNTHETIC: real mount/journal/release/worker admission, scripted canonical-authority and preparer ports. No SDK or infrastructure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createIntentMount} from '../mount.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
const NOW=1900000000000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scope={kind:'client',tenantId:'tenant',resourceId:id(8),policyRevision:'p1'},operation={id:'create_word',version:'0.2.0'};
const call={operation,arguments:{title:'Draft'},deliveryId:'sdk:'+'a'.repeat(64)},denied=e=>e.code==='ACCESS_DENIED';
function fixture(){
 const state={now:NOW,expiresAtMs:NOW+1000,scopes:[scope],prepares:0,checks:[],entry:null,afterPrepare:()=>{},mutate:r=>r};
 const journalStore={async claim({record}){if(state.entry)return {claimed:false,entry:structuredClone(state.entry)};state.entry={record,state:'PENDING',outcome:null};return {claimed:true};},
  async settle({record,state:next,outcome}){state.entry={record,state:next,outcome};return structuredClone(state.entry);}};
 const result={status:'draft',version:{generationStatus:'draft',versionId:id(20),binding,scopes:[scope]}};
 const resultRelease={async check({selection,selectionSha256}){state.checks.push(selection);return state.mutate({authorized:true,selectionSha256,binding:selection.binding,scopes:state.scopes,checkedAtMs:state.now,expiresAtMs:state.expiresAtMs});}};
 const mount=(b=binding,authority=resultRelease)=>createIntentMount({binding:b,preparers:[{binding:b,owner:'document',operation,async prepare(){state.prepares++;state.afterPrepare();return result;}}],journalStore,resultRelease:authority,now:()=>state.now,limits:{maxRequestMs:1000},enabled:true});
 return {state,result,mount,journalStore};
}

test('fresh and retained results both reauthorize; replay preserves immutable output without redispatch',async()=>{
 const f=fixture(),m=f.mount(),first=await m.prepare(call),saved=hash(f.state.entry);
 assert.deepEqual(await m.prepare(call),first);assert.equal(f.state.prepares,1);assert.equal(f.state.checks.length,3);
 assert.equal(hash(f.state.entry),saved);assert.equal(f.state.checks.at(-1).resultSha256,hash(first));
});
test('revoked client on retained release is denied without changing custody or repeating preparation',async()=>{
 const f=fixture(),m=f.mount();await m.prepare(call);const saved=hash(f.state.entry);
 f.state.scopes=[{...scope,resourceId:id(9)}];await assert.rejects(m.prepare(call),denied);
 assert.equal(hash(f.state.entry),saved);assert.equal(f.state.prepares,1);
});
test('original authority expiry cannot be extended on replay',async()=>{
 const f=fixture(),m=f.mount();await m.prepare(call);const saved=hash(f.state.entry),checks=f.state.checks.length;
 f.state.now=NOW+1000;f.state.expiresAtMs=NOW+60000;await assert.rejects(m.prepare(call),denied);
 assert.equal(f.state.checks.length,checks);assert.equal(hash(f.state.entry),saved);assert.equal(f.state.prepares,1);
});
test('revocation during fresh preparation withholds release but retains exact result for later authorized read',async()=>{
 const f=fixture();f.state.afterPrepare=()=>{f.state.scopes=[{...scope,policyRevision:'revoked'}];};const m=f.mount();
 await assert.rejects(m.prepare(call),denied);assert.equal(f.state.entry.state,'PREPARED');
 f.state.scopes=[scope];assert.deepEqual(await m.prepare(call),f.result);assert.equal(f.state.prepares,1);
});
test('resumed run uses current authorization but preserves original run identity and expiry',async()=>{
 const f=fixture();await f.mount().prepare(call);
 const resumed={...binding,runId:id(30),attemptId:id(31),writerFence:2},out=await f.mount(resumed).prepare(call);
 assert.deepEqual(out.version.binding,binding);assert.deepEqual(f.state.checks.at(-1).binding,resumed);assert.equal(f.state.prepares,1);
});
test('legacy retained result without original authority receipt is withheld without redispatch',async()=>{
 const f=fixture(),m=f.mount();await m.prepare(call);delete f.state.entry.outcome.release;
 await assert.rejects(m.prepare(call),denied);assert.equal(f.state.prepares,1);
});
test('missing canonical result-release owner fails unavailable before any claim or preparation',async()=>{
 const f=fixture();
 const noOwner=createIntentMount({binding,preparers:[],journalStore:f.journalStore,now:()=>NOW,limits:{maxRequestMs:1000},enabled:true});
 await assert.rejects(noOwner.readAvailability(),e=>e.code==='UNAVAILABLE');await assert.rejects(noOwner.prepare(call),e=>e.code==='UNAVAILABLE');
 assert.equal(f.state.entry,null);assert.equal(f.state.prepares,0);
});
for(const field of ['authorized','binding','selectionSha256','checkedAtMs','expiresAtMs'])test(`invalid canonical release receipt ${field} refuses before preparation`,async()=>{
 const f=fixture();f.state.mutate=r=>({...r,[field]:field==='authorized'?false:field==='binding'?{...binding,writerFence:2}:field==='selectionSha256'?'f'.repeat(64):field==='checkedAtMs'?NOW+1:NOW});
 await assert.rejects(f.mount().prepare(call),denied);assert.equal(f.state.prepares,0);
});
test('worker rejects client scope revocation and changed policy revision for a resumed retained result',()=>{
 const f=fixture(),current={...binding,runId:id(30),attemptId:id(31),writerFence:2};
 assert.equal(assertPreparedResult('document',operation,f.result,current,{scopes:[scope],nowMs:NOW}).reference,id(20));
 for(const scopes of [[{...scope,resourceId:id(9)}],[{...scope,policyRevision:'p2'}],[]])assert.throws(()=>assertPreparedResult('document',operation,f.result,current,{scopes,nowMs:NOW}),e=>e.code==='INVALID_RESULT');
});
