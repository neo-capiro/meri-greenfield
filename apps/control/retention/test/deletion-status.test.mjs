import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {compose,subjectOf,snapshot,ownership} from './fixture.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createMemoryWatermarkStore} from '../recovery-watermark.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {projectionToken} from '../memory-journal.mjs';

async function fixture({execute=true,enabled=true}={}){
 const f=compose(),subject=subjectOf(),key=subjectKey(subject),requestId=randomUUID(),at=f.clock.now();
 const trash={requestId,revision:'1',trashedAtMs:at,restoreUntilMs:at+30*86400000};
 const reference={requestId,conversationId:subject.subjectId,revision:'1',restoreUntil:new Date(trash.restoreUntilMs).toISOString(),metadataState:'present'};
 const inventory=enumerateReferences(snapshot(subject));f.current.inventories.set(key,inventory);f.rows.seed(key,inventory);
 for(const o of inventory.objects)f.store.put(f.keyFor(o),o.versionId);
 const state={office:true,core:true,finalized:0},watermark=createMemoryWatermarkStore({journal:f.journal});
 const purge={enabled:true,storage:f.storage,rows:f.rows,keyFor:f.keyFor,facts:{...f.facts,trashFor:async()=>({...trash,checkedAtMs:f.clock.now()})},
  office:{async retire(){return {fenced:true,remaining:false};},async verify(){return state.office;}},
  async finalize(){state.finalized++;reference.metadataState='absent';},async verify(){return state.core;}};
 const startup=createRetentionStartup({journal:f.journal,watermark,ledgerSink:f.sink,ownership,purge:enabled?purge:{enabled:false},now:f.clock.now});
 await startup.start();await startup.suppression.suppress({principal:f.principal,subject,reason:'conversation-trash:'+requestId});
 if(execute){f.clock.advance(31*86400000);await startup.purge.sweepSubject(subject);}
 const read=(overrides={},publish=value=>value)=>startup.deletionStatus.withStatus({principal:f.principal,reference:{...reference,...overrides},deadlineMs:f.clock.now()+1000},publish);
 return {...f,subject,key,reference,inventory,state,watermark,startup,read,purge};
}
test('completed status re-verifies exact targets, Office and Core without deleting again',async()=>{
 const f=await fixture(),before=f.state.finalized;
 assert.equal((await f.read()).state,'completed');assert.equal((await f.read()).state,'completed');assert.equal(f.state.finalized,before);
 f.state.core=false;assert.equal((await f.read()).state,'unknown');f.state.core=true;
 f.state.office=false;assert.equal((await f.read()).state,'unknown');
});
test('restored object, restored database row, and unavailable storage cannot reuse completion',async()=>{
 const f=await fixture(),o=f.inventory.objects[0];
 f.store.put(f.keyFor(o),o.versionId);assert.equal((await f.read()).state,'unknown');f.store.versions.clear();
 f.rows.seed(f.key,f.inventory);assert.equal((await f.read()).state,'unknown');
 const g=await fixture();g.store.fault.mode='forbidden';assert.equal((await g.read()).state,'unknown');
});
test('restore period, queued cleanup, wrong generation, and superseded request stay distinct',async()=>{
 const f=await fixture({execute:false});
 assert.deepEqual((await f.read()).reasons,['restore_period']);
 f.clock.advance(31*86400000);assert.deepEqual((await f.read()).reasons,['cleanup_pending']);
 assert.equal((await f.read({requestId:randomUUID()})).state,'unknown');
 assert.equal((await f.read({metadataState:'superseded'})).state,'superseded');
 const disabled=await fixture({execute:false,enabled:false});assert.deepEqual((await disabled.read()).reasons,['cleanup_disabled']);
});
test('blocked reasons are allowlisted and never disclose target or authority details',async()=>{
 const f=await fixture({execute:false});f.clock.advance(31*86400000);
 f.current.holds.set(f.inventory.objects[0].objectId+'@'+f.inventory.objects[0].versionId,{legalHold:true,objectLockRetainUntilMs:null});
 await f.startup.purge.sweepSubject(f.subject);
 const status=await f.read();assert.equal(status.state,'blocked');assert.ok(status.reasons.includes('legal_hold'));
 assert.equal(JSON.stringify(status).includes(f.inventory.objects[0].objectId),false);
});
test('restored projection is recovered from independent ledger; missing Core proof stays unknown',async()=>{
 const f=await fixture();const deleted=await f.journal.get(f.key);
 f.journal.restore(new Map());f.watermark.restore({sequence:0,entrySha256:null});
 assert.equal((await f.read()).state,'completed');assert.equal((await f.journal.get(f.key)).ownerActorId,deleted.ownerActorId);
 f.state.core=false;f.startup.serving.disable();assert.equal((await f.read()).state,'unknown');
});
test('foreign owner and projection changes during verification withhold release',async()=>{
 const f=await fixture(),original=await f.journal.get(f.key);
 await f.journal.set(f.key,{...original,ownerActorId:'other'},{expected:projectionToken(original)});
 await assert.rejects(f.read(),e=>e.code==='RETENTION_FORBIDDEN');
 const g=await fixture();let published=false;
 g.purge.office.verify=async()=>{g.journal.restore(new Map());return true;};
 await assert.rejects(g.read({},()=>{published=true;}),e=>e.code==='RETENTION_READ_UNAVAILABLE');
 assert.equal(published,false);
});
