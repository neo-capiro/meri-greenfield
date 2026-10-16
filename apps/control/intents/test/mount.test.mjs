/** SYNTHETIC: intent mount + journal + command preparer over the real task.create owners (see fixture.mjs). */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {CommandError} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createCommandIntentPreparer} from '../command-preparer.mjs';
import {createIntentMount} from '../mount.mjs';
import {commandComposition,mount,delivery,createMemoryJournalStore,NOW} from './fixture.mjs';
const CREATE={id:'create_task',version:'0.2.0'},ARGS={title:'Task'},DEFERRED=catalog.originals.filter(o=>o.disposition==='deferred').map(o=>o.id);
const call=(m,extra={})=>m.prepare({operation:CREATE,arguments:ARGS,deliveryId:delivery(1),...extra});
const code=c=>e=>e.code===c;
function setup(options){const c=commandComposition(options),{store,mount:m}=mount({binding:c.binding,preparers:[c.preparer()]});return {c,store,m};}

test('prepare-only: an immutable approval_required proposal, no command journal claim, no source effect',async()=>{
 const {c,store,m}=setup(),out=await call(m);
 assert.equal(out.status,'approval_required');assert.equal(out.proposal.command.action,'task.create');assert.deepEqual(out.proposal.command.binding,c.binding);
 assert.equal(c.f.state.fetches,0);assert.equal(c.f.pg.rows.size,0);assert.equal(c.f.state.reserves??0,0);
 assert.equal(c.sql.rows.size,1,'the metadata owner stored exactly one pending proposal');
 assert.deepEqual([...store.rows.values()].map(r=>r.state),['PREPARED']);
});

test('approval required before effect: the existing executor refuses until the approval control approves this exact proposal',async()=>{
 const {c,m}=setup(),{proposal}=await call(m);
 await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0);assert.equal(c.f.pg.rows.size,0);
 c.approve({...proposal,commandSha256:'f'.repeat(64)});await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0,'an approval of other content does not apply');
 c.approve(proposal);c.f.state.approvalRevoked=true;await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0,'a revoked approval does not apply');
 c.f.state.approvalRevoked=false;const done=await c.executeApproved(proposal);assert.equal(done.status,'observed');assert.equal(c.f.state.fetches,1);
 assert.deepEqual(await c.executeApproved(proposal),done);assert.equal(c.f.state.fetches,1,'the existing journal replays; no second effect');
});

test('authority revoked between prepare and approve: approved execution is refused with no effect',async()=>{
 const {c,m}=setup(),{proposal}=await call(m);c.approve(proposal);c.f.state.revoked=true;
 await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0);assert.equal(c.f.state.reserves??0,0);
 c.f.state.revoked=false;c.f.state.fence=2;await assert.rejects(c.executeApproved(proposal));assert.equal(c.f.state.fetches,0,'a stale writer fence is refused as well');
});

test('preparation itself rechecks current authority: a refused policy prepares nothing and replays the refusal',async()=>{
 const {c,store,m}=setup();c.policy.state.denyPhase='prepare';
 await assert.rejects(call(m),code('REFUSED'));assert.equal(c.sql.rows.size,0);assert.deepEqual([...store.rows.values()].map(r=>r.state),['FAILED']);
 c.policy.state.denyPhase=null;await assert.rejects(call(m),code('REFUSED'));assert.equal(c.metadataCalls.prepare,1,'the same delivery is never prepared again');
 assert.equal((await call(m,{deliveryId:delivery(2)})).status,'approval_required','a new request is prepared normally');
});

test('replay/idempotency: the same delivery returns the same proposal without a second owner call; changed content conflicts',async()=>{
 const {c,m}=setup(),first=await call(m),again=await call(m);
 assert.deepEqual(again,first);assert.equal(c.metadataCalls.prepare,1);assert.equal(c.sql.rows.size,1);
 await assert.rejects(m.prepare({operation:CREATE,arguments:{title:'Other'},deliveryId:delivery(1)}),code('CONFLICT'));assert.equal(c.metadataCalls.prepare,1);
 const second=await call(m,{deliveryId:delivery(2)});assert.notEqual(second.proposal.proposalId,first.proposal.proposalId);assert.equal(c.metadataCalls.prepare,2);
});

test('UNKNOWN after a lost owner acknowledgement: never prepared again, never released as success',async()=>{
 const {c,store,m}=setup();
 c.hooks.prepare=async(v,owner)=>{await owner.prepare(v);throw Object.assign(new CommandError('APPROVAL_METADATA_UNKNOWN'),{outcome:'UNKNOWN'});};
 await assert.rejects(call(m),code('UNKNOWN'));assert.equal(c.sql.rows.size,1,'the proposal may exist');
 c.hooks.prepare=undefined;await assert.rejects(call(m),code('UNKNOWN'));await assert.rejects(call(m),code('UNKNOWN'));
 assert.equal(c.metadataCalls.prepare,1);assert.deepEqual([...store.rows.values()].map(r=>r.state),['UNKNOWN']);
});

test('UNKNOWN after a lost journal acknowledgement: claim loss prepares nothing; settle loss withholds, then replays the retained result',async()=>{
 const a=setup();a.store.state.loseClaimAck=true;
 await assert.rejects(call(a.m),code('UNAVAILABLE'));assert.equal(a.c.metadataCalls.prepare,0);
 await assert.rejects(call(a.m),code('UNKNOWN'),'a claimed but unsettled delivery is UNKNOWN');assert.equal(a.c.metadataCalls.prepare,0);
 const b=setup();b.store.state.loseSettleAck=true;
 await assert.rejects(call(b.m),code('UNKNOWN'));const replay=await call(b.m);assert.equal(replay.status,'approval_required');assert.equal(b.c.metadataCalls.prepare,1);
 const c=setup();c.store.state.claimDown=true;await assert.rejects(call(c.m),code('UNAVAILABLE'));assert.equal(c.c.metadataCalls.prepare,0);
});

test('UNKNOWN when the owner is still running at the deadline; nothing is re-prepared',async()=>{
 const c=commandComposition();let now=NOW;const store=createMemoryJournalStore();
 const m=createIntentMount({binding:c.binding,preparers:[c.preparer()],journalStore:store.port,now:()=>now,limits:{maxRequestMs:50},enabled:true});
 c.hooks.prepare=()=>new Promise(()=>{});const pending=assert.rejects(call(m),code('UNKNOWN'));await new Promise(r=>setTimeout(r,80));now+=60;
 await pending;c.hooks.prepare=undefined;await assert.rejects(call(m),code('UNKNOWN'));assert.equal(c.metadataCalls.prepare,1);
});

test('cross-tenant denial: foreign preparers are refused, journal entries never cross tenants, argument authority is refused',async()=>{
 const own=commandComposition(),foreign=commandComposition({tenantId:'other'});
 assert.throws(()=>createIntentMount({binding:own.binding,preparers:[foreign.preparer()],journalStore:createMemoryJournalStore().port,now:()=>NOW,limits:{maxRequestMs:1000},enabled:true}),code('INTENT_CONFIGURATION'));
 const store=createMemoryJournalStore(),a=mount({binding:own.binding,preparers:[own.preparer()],store}).mount,b=mount({binding:foreign.binding,preparers:[foreign.preparer()],store}).mount;
 const mine=await call(a),theirs=await call(b);
 assert.equal(mine.proposal.command.binding.tenantId,'tenant');assert.equal(theirs.proposal.command.binding.tenantId,'other');
 assert.equal(foreign.metadataCalls.prepare,1,'same delivery ID in another tenant is not a replay');assert.equal(store.rows.size,2);
 for(const key of ['binding','tenantId','scopes','requiredApprover','proposalId','commandId']){
  const t=setup();await assert.rejects(t.m.prepare({operation:CREATE,arguments:{...ARGS,[key]:'model'},deliveryId:delivery(9)}),code('INVALID_ARGUMENTS'),key);assert.equal(t.c.metadataCalls.prepare,0,key);
 }
});

test('only owner-backed operations mount; disabled, unknown and malformed calls prepare nothing',async()=>{
 const c=commandComposition();
 for(const action of ['task.update','memory.propose','artifact.file'])assert.throws(()=>createCommandIntentPreparer({commandOptions:{...c.commandOptions,action,operation:{id:'update_task',version:'0.2.0'}}}),code('INTENT_CONFIGURATION'),action);
 assert.throws(()=>createIntentMount({binding:c.binding,preparers:[c.preparer(),c.preparer()],journalStore:createMemoryJournalStore().port,now:()=>NOW,limits:{maxRequestMs:1000}}),code('INTENT_CONFIGURATION'));
 const off=mount({binding:c.binding,preparers:[c.preparer()],enabled:false}).mount;
 await assert.rejects(off.readAvailability(),code('UNAVAILABLE'));await assert.rejects(call(off),code('UNAVAILABLE'));
 const {m}=setup();
 await assert.rejects(m.prepare({operation:{id:'update_task',version:'0.2.0'},arguments:ARGS,deliveryId:delivery(1)}),code('UNAVAILABLE'));
 for(const id of DEFERRED)await assert.rejects(m.prepare({operation:{id,version:'0.2.0'},arguments:ARGS,deliveryId:delivery(1)}),code('UNAVAILABLE'),id);
 for(const deliveryId of ['plain','sdk:'+'g'.repeat(64),'sdk:'+'a'.repeat(63)])await assert.rejects(call(m,{deliveryId}),code('INVALID_ARGUMENTS'));
 await assert.rejects(m.prepare({operation:CREATE,arguments:[ARGS],deliveryId:delivery(1)}),code('INVALID_ARGUMENTS'));
 assert.equal(c.metadataCalls.prepare,0);
 const availability=await m.readAvailability();assert.deepEqual(availability.operations,[CREATE]);assert.ok(availability.expiresAtMs>availability.checkedAtMs);
});
