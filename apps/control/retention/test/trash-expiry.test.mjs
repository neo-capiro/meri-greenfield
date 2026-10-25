import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {conversationTrashEligibility} from '../policy.mjs';
import {recomputePlan,createPurgeExecutor} from '../purge.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {compose,subjectOf,snapshot} from './fixture.mjs';
import {createConversationRetentionSweep} from '../sweep.mjs';

const day=86400000;
async function fixture(){
 const f=compose(),subject=subjectOf(),requestId=randomUUID(),suppressedAt=f.clock.now();
 await f.suppression.suppress({principal:f.principal,subject,reason:`conversation-trash:${requestId}`});
 // Core commits later than suppression. Only Core's committed deadline counts.
 const trashedAtMs=suppressedAt+day,restoreUntilMs=trashedAtMs+30*day;
 const trash=()=>({requestId,revision:'3',trashedAtMs,restoreUntilMs,checkedAtMs:f.clock.now()});
 const facts={...f.facts,trashFor:async()=>trash()};
 const inventory=enumerateReferences(snapshot(subject));
 f.current.inventories.set(subjectKey(subject),inventory);f.rows.seed(subjectKey(subject),inventory);
 const current=()=>f.journal.get(subjectKey(subject));
 const plan=async()=>recomputePlan(facts,subject,await current(),f.clock.now());
 return {...f,registry:f.current,subject,trash,facts,plan,current,restoreUntilMs};
}

test('Core committed Trash expiry, not earlier suppression, governs the exact 720-hour boundary',async()=>{
 const f=await fixture();f.clock.advance(30*day);
 assert.ok((await f.plan()).blocks.some(b=>b.reason==='TRASH_RESTORE_PERIOD'));
 f.clock.advance(day-1);assert.equal((await f.plan()).state,'BLOCKED');
 f.clock.advance(1);const plan=await f.plan();assert.equal(plan.state,'PLANNED');
 assert.equal(plan.trash.restoreUntilMs,f.restoreUntilMs);
 f.clock.advance(1);assert.equal((await f.plan()).planSha256,plan.planSha256,'observation time does not change immutable plan identity');
});

test('missing, differently trashed, stale and shortened Core authority never authorizes a purge',async()=>{
 const f=await fixture();f.clock.advance(31*day);const journalState=await f.current();
 const evaluate=trash=>conversationTrashEligibility({subject:f.subject,journalState,trash,nowMs:f.clock.now()});
 assert.throws(()=>evaluate(undefined),/RETENTION_TRASH_AUTHORITY_REQUIRED/);
 assert.throws(()=>evaluate({...f.trash(),requestId:randomUUID()}),/RETENTION_TRASH_GENERATION_REFUSED/);
 assert.throws(()=>evaluate({...f.trash(),restoreUntilMs:f.restoreUntilMs-1}),/RETENTION_TRASH_AUTHORITY_REQUIRED/);
 for(const offset of [-5001,5001])assert.throws(()=>evaluate({...f.trash(),checkedAtMs:f.clock.now()+offset}),/RETENTION_TRASH_AUTHORITY_REQUIRED/);
 for(const offset of [-5000,5000])assert.doesNotThrow(()=>evaluate({...f.trash(),checkedAtMs:f.clock.now()+offset}));
 assert.equal(evaluate({...f.trash(),checkedAtMs:f.restoreUntilMs-1}).expired,false,'clock tolerance never makes an unexpired Core decision expired');
});

test('Core authority is reread before effects; failure or changed Trash identity causes zero deletes',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();let deletes=0;
 const executor=facts=>createPurgeExecutor({...f,storage:{...f.storage,async deleteVersion(){deletes++;}},facts,rows:f.rows,enabled:true,now:f.clock.now});
 await assert.rejects(executor({...f.facts,trashFor:async()=>{throw new Error('offline');}}).execute(plan),/RETENTION_AUTHORITY_UNAVAILABLE/);
 await assert.rejects(executor({...f.facts,trashFor:async()=>({...f.trash(),requestId:randomUUID()})}).execute(plan),/RETENTION_TRASH_GENERATION_REFUSED/);
 assert.equal(deletes,0);assert.equal(f.sink.size(),1);
});

test('fresh sweep and public execution each authorize once before preflight and freshly before every effect',async()=>{
 for(const sweep of [true,false]){const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();
  for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
  let inventories=0,preflights=0,effects=0;
  const facts={...f.facts,async inventoryFor(...args){inventories++;return f.facts.inventoryFor(...args);}};
  const beforeEffect=()=>{effects++;assert.equal(inventories,effects+1,'each effect has a new authoritative inventory after preflight');};
  const executor=createPurgeExecutor({...f,facts,enabled:true,now:f.clock.now,finalize:async()=>{},
   rows:{...f.rows,async preflight(...args){preflights++;assert.equal(inventories,1);return f.rows.preflight(...args);},async purge(...args){beforeEffect();return f.rows.purge(...args);}},
   storage:{...f.storage,async deleteVersion(...args){beforeEffect();return f.storage.deleteVersion(...args);}}});
  const result=sweep?await executor.sweepSubject(f.subject):await executor.execute(plan);
  assert.equal(result.state,'EXECUTED');assert.equal(preflights,1);assert.equal(effects,plan.steps.length+1);assert.equal(inventories,effects+1);
 }
});

test('fresh sweep rechecks Core generation, holds and local generation after preflight with zero effects',async()=>{
 for(const changed of ['Core','hold','generation']){const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();let afterPreflight=false,effects=0;
  for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
  const facts={...f.facts,async trashFor(){return changed==='Core'&&afterPreflight?{...f.trash(),requestId:randomUUID()}:f.trash();}};
  const executor=createPurgeExecutor({...f,facts,enabled:true,now:f.clock.now,finalize:async()=>{effects++;},
   storage:{...f.storage,async deleteVersion(){effects++;}},rows:{...f.rows,async purge(){effects++;},async preflight(...args){
    await f.rows.preflight(...args);afterPreflight=true;
    if(changed==='hold'){const st=plan.steps[0];f.registry.holds.set(st.objectId+'@'+st.versionId,{legalHold:true,objectLockRetainUntilMs:null});}
    if(changed==='generation'){const current=await f.current();await f.journal.set(subjectKey(f.subject),{...current,ledgerSequence:current.ledgerSequence+1});}
   }}});
  await assert.rejects(executor.sweepSubject(f.subject),new RegExp(changed==='Core'?'RETENTION_TRASH_GENERATION_REFUSED':changed==='hold'?'RETENTION_PURGE_BLOCKED':'RETENTION_(SUPPRESSION_GENERATION_REFUSED|STALE_WRITE)'));
  assert.equal(effects,0);assert.ok(plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)));
 }
});

test('expired Trash erases its private rows while preserving a surviving fork or artifact object',async()=>{
 const f=await fixture();f.clock.advance(31*day);
 const original=await f.plan(),shared=original.steps[0],holder=`${f.subject.tenantId}:artifact:${randomUUID()}`;
 f.registry.shared.set(subjectKey(f.subject),[{object:shared,heldBy:[holder],blocking:[{holder,reasons:['HOLDER_NOT_SUPPRESSED']}]}]);
 const plan=await f.plan();assert.equal(plan.state,'PLANNED');
 assert.equal(plan.steps.some(s=>s.workflowId===shared.workflowId),false);
 assert.deepEqual(plan.retainedObjects,[{objectId:shared.objectId,versionId:shared.versionId,sha256:shared.sha256,heldBy:[holder]}]);
 for(const st of original.steps)f.store.put(f.keyFor(st),st.versionId);
 const executor=createPurgeExecutor({...f,enabled:true,now:f.clock.now});
 const result=await executor.execute(plan);assert.equal(result.state,'EXECUTED');assert.deepEqual(result.retainedObjects,plan.retainedObjects);
 assert.equal(f.store.has(f.keyFor(shared),shared.versionId),true);
 for(const st of plan.rowSteps)assert.equal(await f.rows.present(plan.subjectKey,st),false);
 f.registry.holds.set(shared.objectId+'@'+shared.versionId,{legalHold:true,objectLockRetainUntilMs:null});
 assert.equal((await f.plan()).state,'BLOCKED','a surviving reference never overrides a legal hold');
});

test('existing subject exclusion prevents Restore crossing the storage effect boundary',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 let entered,unblock;const atDelete=new Promise(r=>{entered=r;}),blocked=new Promise(r=>{unblock=r;});
 const executor=createPurgeExecutor({...f,storage:{...f.storage,async deleteVersion(v){entered();await blocked;return f.storage.deleteVersion(v);}},enabled:true,now:f.clock.now});
 const execution=executor.execute(plan);await atDelete;
 let released=false;const restore=f.suppression.release({principal:f.principal,subject:f.subject,reason:'restore'}).then(()=>{released=true;},e=>e);
 await new Promise(r=>setImmediate(r));assert.equal(released,false);assert.equal(f.journal.lock.state().writer,false,'no recovery/global lock spans storage IO');
 unblock();assert.equal((await execution).state,'EXECUTED');
 assert.match((await restore).code,/RETENTION_PURGE_IN_PROGRESS/);assert.equal(released,false);
 assert.equal((await f.current()).state,'SUPPRESSED');
});

test('lost row-erasure acknowledgement settles from exact absence without decoding erased source content',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 let rowEffects=0;
 const rows={...f.rows,async purge(key,value){rowEffects++;await f.rows.purge(key,value);
  throw Object.assign(new Error('lost commit acknowledgement'),{code:'RETENTION_COMMIT_UNKNOWN'});}};
 const facts={...f.facts,async inventoryFor(s){if(rowEffects)throw new Error('source bodies erased');return f.facts.inventoryFor(s);}};
 const executor=createPurgeExecutor({...f,facts,rows,enabled:true,now:f.clock.now});
 await assert.rejects(executor.execute(plan),{code:'RETENTION_COMMIT_UNKNOWN'});
 assert.equal((await f.current()).purge.state,'UNKNOWN');
 assert.equal((await executor.execute(plan)).state,'EXECUTED');assert.equal(rowEffects,1);
 assert.equal((await executor.execute(plan)).replayed,true);assert.equal(rowEffects,1);
 const revived=plan.steps[0];f.store.put(f.keyFor(revived),revived.versionId);
 await assert.rejects(executor.execute(plan),/RETENTION_RECOVERY_BARRIER/);
 assert.equal(f.serving.isEnabled(),false);assert.equal(rowEffects,1);
});

test('an UNKNOWN multi-step retry cannot skip a previously deleted version that storage restored',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();
 assert.ok(plan.steps.length>1);
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 let effects=0;
 const storage={...f.storage,async deleteVersion(value){effects++;
  if(effects===2)throw new Error('second delete unavailable');
  return f.storage.deleteVersion(value);
 }};
 const executor=createPurgeExecutor({...f,storage,enabled:true,now:f.clock.now});
 await assert.rejects(executor.execute(plan),/second delete unavailable/);
 assert.equal((await f.current()).purge.state,'UNKNOWN');
 const completed=plan.steps[0];f.store.put(f.keyFor(completed),completed.versionId);
 await assert.rejects(executor.execute(plan),/RETENTION_RECOVERY_BARRIER/);
 assert.equal(effects,2);assert.equal(f.serving.isEnabled(),false);
});

test('scheduled retry reconstructs the exact ledger plan after Core committed but its reply was lost',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 let finalized=0,erased=false;
 const facts={...f.facts,async inventoryFor(s){if(erased)throw Error('private rows already erased');return f.facts.inventoryFor(s);}};
 const rows={...f.rows,async purge(...args){const result=await f.rows.purge(...args);erased=true;return result;}};
 const executor=createPurgeExecutor({...f,facts,rows,enabled:true,now:f.clock.now,async finalize(s,trash){
  assert.deepEqual(s,f.subject);assert.deepEqual(trash,plan.trash);finalized++;
  if(finalized===1)throw Error('Core commit reply lost');return {erased:true,replayed:true};
 }});
 await assert.rejects(executor.sweepSubject(f.subject),/Core commit reply lost/);
 assert.equal((await f.current()).purge.state,'EXECUTED');
 assert.equal((await executor.sweepSubject(f.subject)).coreFinalized,true);assert.equal(finalized,2);
 assert.equal((await executor.sweepSubject(f.subject)).coreFinalized,true);assert.equal(finalized,2);
 await f.reconciler().reconcile();assert.equal((await f.current()).purge.coreFinalized,true);
});

test('bounded sweep records an uncertain effect and starts no later delete after its deadline',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan();let effects=0,finalized=0;
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 const executor=createPurgeExecutor({...f,enabled:true,now:f.clock.now,async finalize(){finalized++;},
  storage:{...f.storage,async deleteVersion(value){effects++;const r=await f.storage.deleteVersion(value);f.clock.advance(100);return r;}}});
 await assert.rejects(executor.sweepSubject(f.subject,{deadlineMs:f.clock.now()+50}),/RETENTION_DEADLINE/);
 assert.equal(effects,1);assert.equal(finalized,0);assert.equal((await f.current()).purge.state,'UNKNOWN');
});

test('sweep carries its abort and deadline through row preflight, mutation and absence recovery',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan(),controller=new AbortController(),deadlineMs=f.clock.now()+1000,seen=[];
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 const rows=Object.fromEntries(['preflight','purge','present'].map(method=>[method,async(...args)=>{
  const options=args[2];assert.equal(options.signal,controller.signal);assert.equal(options.deadlineMs,deadlineMs);assert.equal(typeof options.check,'function');options.check();seen.push(method);
  return f.rows[method]?.(...args);
 }]));
 const executor=createPurgeExecutor({...f,rows,enabled:true,now:f.clock.now,finalize:async()=>{}});
 const options={signal:controller.signal,deadlineMs};assert.equal((await executor.sweepSubject(f.subject,options)).coreFinalized,true);
 assert.ok(seen.includes('preflight'));assert.ok(seen.includes('purge'));
 assert.equal((await executor.sweepSubject(f.subject,options)).replayed,true);assert.ok(seen.includes('present'));
});

test('interrupted SDK-style row preflight performs no storage or row effect',async()=>{
 const f=await fixture();f.clock.advance(31*day);const plan=await f.plan(),controller=new AbortController();let effects=0;
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 const executor=createPurgeExecutor({...f,enabled:true,now:f.clock.now,finalize:async()=>{effects++;},storage:{...f.storage,async deleteVersion(){effects++;}},
  rows:{...f.rows,async preflight(_key,_plan,options){controller.abort(Error('interrupted transcript scan'));options.check();},async purge(){effects++;}}});
 await assert.rejects(executor.sweepSubject(f.subject,{signal:controller.signal,deadlineMs:f.clock.now()+1000}),/RETENTION_ROW_PURGE_UNAVAILABLE/);
 assert.equal(effects,0);assert.equal((await f.current()).purge,null);
});

test('ordinary hourly sweep before expiry leaves Restore available with no purge record',async()=>{
 const f=await fixture();let effects=0;
 const purge=createPurgeExecutor({...f,enabled:true,now:f.clock.now,finalize:async()=>{effects++;}});
 const sweep=createConversationRetentionSweep({startup:{ensureServing:async()=>{},ledger:f.ledger,purge},now:f.clock.now});
 assert.equal((await sweep()).outcome,'blocked');assert.equal((await f.current()).purge,null);
 assert.equal(f.sink.size(),1);assert.equal(effects,0);
 assert.equal((await f.suppression.release({principal:f.principal,subject:f.subject,reason:'restore'})).state,'RELEASED');
});

for(const scheduled of [false,true])test(`cleared hold replans never-started BLOCKED in healthy process (${scheduled?'sweep':'direct'})`,async()=>{
 const f=await fixture();f.clock.advance(31*day);const initial=await f.plan();
 for(const step of initial.steps)f.store.put(f.keyFor(step),step.versionId);
 const held=initial.steps[0],holdKey=held.objectId+'@'+held.versionId;
 f.registry.holds.set(holdKey,{legalHold:true,objectLockRetainUntilMs:null});
 let finalized=0;const purge=createPurgeExecutor({...f,enabled:true,now:f.clock.now,finalize:async()=>{finalized++;}});
 assert.equal((await purge.sweepSubject(f.subject)).state,'BLOCKED');assert.equal((await f.current()).purge.state,'BLOCKED');
 f.registry.holds.delete(holdKey);
 const result=scheduled?await purge.sweepSubject(f.subject):await purge.execute(await f.plan());
 assert.equal(result.state,'EXECUTED');assert.equal(f.serving.isEnabled(),true);assert.equal(finalized,scheduled?1:0);
});

test('pre-expiry sweep retries normally at the actual deadline without recovery or new suppression',async()=>{
 const f=await fixture();let finalized=0;
 const purge=createPurgeExecutor({...f,enabled:true,now:f.clock.now,finalize:async()=>{finalized++;}});
 assert.equal((await purge.sweepSubject(f.subject)).state,'BLOCKED');assert.equal((await f.current()).purge,null);
 f.clock.advance(31*day);const plan=await f.plan();for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 assert.equal((await purge.sweepSubject(f.subject)).coreFinalized,true);assert.equal(finalized,1);
});

test('a recovery-projected block cannot replace a consumed UNKNOWN ledger plan',async()=>{
 const f=await fixture();f.clock.advance(31*day);const original=await f.plan();
 for(const step of original.steps)f.store.put(f.keyFor(step),step.versionId);
 const purge=createPurgeExecutor({...f,enabled:true,now:f.clock.now,finalize:async()=>{},
  storage:{...f.storage,async deleteVersion(){throw Error('lost storage response');}}});
 await assert.rejects(purge.execute(original),/lost storage response/);
 const held=original.steps[0],key=subjectKey(f.subject);
 f.registry.holds.set(held.objectId+'@'+held.versionId,{legalHold:true,objectLockRetainUntilMs:null});
 await f.reconciler().reconcile();assert.equal((await f.current()).purge.state,'BLOCKED');
 const before=await f.ledger.latest();assert.equal(before.get(key).state,'PURGE_UNKNOWN');
 await assert.rejects(purge.sweepSubject(f.subject),{code:'RETENTION_PURGE_PLAN_MISMATCH'});
 f.registry.holds.clear();await assert.rejects(purge.execute(await f.plan()),{code:'RETENTION_PURGE_PLAN_MISMATCH'});
 assert.deepEqual((await f.ledger.latest()).get(key),before.get(key),'ordinary retries cannot replace consumed facts');
});
