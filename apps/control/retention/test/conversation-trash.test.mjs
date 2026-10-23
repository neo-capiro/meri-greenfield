import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,subjectOf,snapshot} from './fixture.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {planDigest,recomputePlan,createPurgeExecutor} from '../purge.mjs';
import {createRecoveryReconciler} from '../reconciliation.mjs';
import {withManagedConversationTrashFacts} from '../../../runtime/conversation-management-composition.mjs';
const day=86400000;
async function fixture({managed=true}={}){
 const f=compose(),subject=subjectOf(),start=f.clock.now(),inventory=enumerateReferences(snapshot(subject));
 const metadata={conversationId:subject.subjectId,scopeKind:'general',clientId:null,status:'trashed',revision:'1',trashedAt:new Date(start).toISOString(),restoreUntil:new Date(start+30*day).toISOString()};
 const control={actor:subject.ownerActorId,missing:false,reads:0};
 const owner={async ownerOf(){if(control.missing)throw Error('Core unavailable');return control.actor;},async readMetadata(){control.reads++;return structuredClone(metadata);}};
 const facts=withManagedConversationTrashFacts({facts:f.facts,owner});
 f.current.inventories.set(subjectKey(subject),inventory);f.rows.seed(subjectKey(subject),inventory);
 await f.suppression.suppress({principal:f.principal,subject,reason:managed?'conversation-trash':'owner request'});
 const plan=()=>f.journal.get(subjectKey(subject)).then(row=>recomputePlan(facts,subject,row,f.clock.now()));
 const executor=()=>createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,facts,serving:f.serving,rows:f.rows,enabled:true,now:f.clock.now});
 const recover=()=>createRecoveryReconciler({ledger:f.ledger,journal:f.journal,storage:f.storage,keyFor:f.keyFor,facts,serving:f.serving,rows:f.rows,now:f.clock.now}).reconcile();
 return {...f,subject,metadata,control,facts,plan,executor,recover,seed:p=>p.steps.forEach(step=>f.store.put(f.keyFor(step),step.versionId)),allPresent:p=>p.steps.every(step=>f.store.has(f.keyFor(step),step.versionId))};
}
test('managed Trash blocks until the exact thirty-day cutoff; canonical deadline proof is in the digest and older unbound plans refuse',async()=>{
 const f=await fixture();f.clock.advance(30*day-1);const before=await f.plan();assert.equal(before.state,'BLOCKED');assert.ok(before.blocks.some(x=>x.reason==='CONVERSATION_RESTORE_WINDOW'));
 f.clock.advance(1);const ready=await f.plan();assert.equal(ready.state,'PLANNED');assert.equal(ready.conversationTrash.restoreUntil,f.metadata.restoreUntil);f.seed(ready);
 const {conversationTrash,...old}=ready;const forged={...old,planSha256:planDigest(old)};
 await assert.rejects(f.executor().execute(forged),/RETENTION_PLAN_DIGEST_REFUSED/);assert.ok(f.allPresent(ready));
 assert.equal((await f.executor().execute(ready)).state,'EXECUTED');
});
test('fresh owner, revision, status and metadata outage refuse stale plans with zero deletes',async()=>{
 for(const mutation of ['owner','revision','restore','unavailable','scope']){
  const f=await fixture();f.clock.advance(30*day);const p=await f.plan();f.seed(p);
  if(mutation==='owner')f.control.actor='different-owner';
  if(mutation==='revision')f.metadata.revision='2';
  if(mutation==='scope'){f.metadata.scopeKind='client';f.metadata.clientId='00000005-0000-4000-8000-000000000000';}
  if(mutation==='restore')Object.assign(f.metadata,{status:'active',revision:'2',trashedAt:null,restoreUntil:null});
  if(mutation==='unavailable')f.control.missing=true;
  await assert.rejects(f.executor().execute(p));assert.ok(f.allPresent(p),mutation);
  assert.equal((await f.sink.read()).filter(x=>x.state.startsWith('PURGE')).length,0);
 }
});
test('managed deadline adds to legal holds and existing retention rules, while unrelated retention ignores unavailable management metadata',async()=>{
 const f=await fixture();f.clock.advance(30*day);let p=await f.plan();
 const first=p.steps[0];f.current.holds.set(first.objectId+'@'+first.versionId,{objectLockRetainUntilMs:null,legalHold:true});p=await f.plan();assert.ok(p.blocks.some(x=>x.reason==='LEGAL_HOLD'));
 f.current.holds.clear();f.current.policy.classes[first.classes[0]].retentionMs=60*day;f.current.lastActivity.set(subjectKey(f.subject),f.clock.now());p=await f.plan();assert.equal(p.state,'BLOCKED');
 const old=await fixture({managed:false});old.control.missing=true;old.clock.advance(2*day);const legacy=await old.plan();assert.equal(legacy.state,'PLANNED');assert.equal(Object.hasOwn(legacy,'conversationTrash'),false);assert.equal(old.control.reads,0);
});
test('restore and re-Trash create a new suppression generation and deadline; recovery reconstructs purpose from ledger and refuses missing authority',async()=>{
 const f=await fixture();f.clock.advance(30*day);const old=await f.plan();f.seed(old);
 await f.suppression.release({principal:f.principal,subject:f.subject,reason:'conversation-restore'});
 Object.assign(f.metadata,{revision:'3',trashedAt:new Date(f.clock.now()).toISOString(),restoreUntil:new Date(f.clock.now()+30*day).toISOString()});
 await f.suppression.suppress({principal:f.principal,subject:f.subject,reason:'conversation-trash'});
 await assert.rejects(f.executor().execute(old),/RETENTION_SUPPRESSION_GENERATION_REFUSED/);assert.ok(f.allPresent(old));
 const fresh=await f.plan();assert.equal(fresh.state,'BLOCKED');await f.executor().recordBlocked(fresh);
 // Simulate a lost projection response/restart: the ledger remains the authoritative purpose source.
 f.journal.restore([]);const report=await f.recover();assert.ok(report.stillBlocked.includes(subjectKey(f.subject)));
 assert.equal((await f.journal.get(subjectKey(f.subject))).purpose,'conversation-trash');
 f.control.missing=true;await f.recover();assert.equal((await f.journal.get(subjectKey(f.subject))).purge.state,'BLOCKED');assert.ok(f.allPresent(old));
});
test('an executed or unknown older managed plan cannot be certified during recovery after current metadata changes',async()=>{
 const f=await fixture();f.clock.advance(30*day);const p=await f.plan();f.seed(p);await f.executor().execute(p);
 f.metadata.revision='2';const report=await f.recover();assert.ok(report.unknown.includes(subjectKey(f.subject)));assert.equal(report.verified.includes(subjectKey(f.subject)),false);
 assert.equal((await f.journal.get(subjectKey(f.subject))).purge.state,'UNKNOWN');
});
