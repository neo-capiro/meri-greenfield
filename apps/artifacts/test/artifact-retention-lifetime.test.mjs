/** R2 remaining: the canonical generated-artifact owner and its version-storage fallback pass their own absolute
 * lifetime into the retention gate, so a cancelled or expired caller cannot start a second attempt. Actual
 * createArtifactService, canonical gate/watermarked store/journal over one synthetic pg client and an injected
 * clock only; no real driver, network, DB or cloud. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createArtifactService} from '../service.mjs';
import {v} from '../storage/boundary.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../../control/retention/postgres-watermark.mjs';
import {watermarkedJournal} from '../../control/retention/recovery-watermark.mjs';
import {createServingFence} from '../../control/retention/serving-fence.mjs';
import {createRetentionReadGate} from '../../control/retention/suppression.mjs';
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const timeout=()=>Object.assign(Error('lock timeout'),{code:'55P03'});
const codes=error=>error?.code??error?.message;
/** One synthetic client for the whole probe: statements are recorded in order and locks are counted. */
function composed(clock,onLock){
 const statements=[],releases=[];let locks=0;
 const client={async query(sql){statements.push(sql);if(sql.startsWith('SELECT pg_advisory_xact_lock_shared'))return onLock(++locks);if(sql.startsWith('SELECT s.projection,'))return {rows:[{projection:null,projection_sha256:null,state:null,ledger_sequence:null,watermark_sequence:0,watermark_entry_sha256:null}]};return {rows:[]};},release(error){releases.push(error);}};
 const journal=createPostgresRetentionJournal({pool:{async connect(){return client;}},now:()=>clock.t});
 const store=createPostgresWatermarkStore({journal}),fence=createServingFence();fence.enable({watermark:{sequence:0,entrySha256:null}});
 const tracked=watermarkedJournal({journal,watermark:store,fence,ledger:{async head(){return {sequence:0,entrySha256:null};}}});
 return {gate:createRetentionReadGate({journal:tracked,serving:fence,log(){}}),statements,releases,locks:()=>locks};
}
/** The actual canonical owner, with the gate call recorded as the service makes it. */
function owner(clock,composed,deadlineMs,calls){
 const context={binding:{tenantId:'t',actorId:'a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},scopes:[{tenantId:'t',kind:'client',resourceId:'c',policyRevision:'p'}],evidence:[],assets:[],deadlineMs,maxBytes:1048576};
 const noop=async()=>null;
 const service=createArtifactService({validators:v,
  authorize:async x=>({receiptId:'lifetime-receipt',decision:'allow',action:x.action,binding:structuredClone(x.binding),scopesSha256:v.hash(x.scopes),resourceSha256:v.hash(x.resource),requestSha256:x.requestSha256,expiresAtMs:x.deadlineMs}),
  versions:{read:noop,commit:noop},objects:{get:noop,put:noop},executor:{execute:noop},now:()=>clock.t,ids:noop,
  retention:{assertServable(...args){calls.push({count:args.length,deadlineMs:args[1]?.deadlineMs,signal:args[1]?.signal});return composed.gate.assertServable(...args);}}});
 return {service,context,versionId:id(9)};
}

test('actual artifact owner abort: one lock attempt, no second BEGIN, joined read, COMMIT or ROLLBACK',async()=>{
 const clock={t:0},abort=new AbortController(),calls=[];
 const c=composed(clock,()=>{abort.abort();throw timeout();});
 const {service,context,versionId}=owner(clock,c,1000,calls);
 let outer;try{await service.inspect(versionId,context,{signal:abort.signal});outer='accepted';}catch(error){outer=codes(error);}
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(outer,'ARTIFACT_CANCELLED');
 assert.ok(calls.length>0,'the gate was consulted');
 assert.equal(calls[0].count,2,'the owner passes its lifetime as the gate option');
 assert.equal(calls[0].deadlineMs,1000,'the absolute caller deadline reaches the gate');
 assert.equal(calls[0].signal instanceof AbortSignal,true,'the owner passes its own lifetime signal');
 assert.equal(calls[0].signal.aborted,true,'the caller abort reaches the gate signal');
 assert.equal(c.locks(),1,'the abort stops the read at the first lock attempt');
 const sql=c.statements;
 assert.equal(sql.filter(s=>s.startsWith('BEGIN')).length,1,'no second BEGIN after the abort');
 assert.equal(sql.some(s=>s.startsWith('SELECT s.projection,')),false,'no joined read after the abort');
 assert.equal(sql.includes('COMMIT'),false,'no COMMIT after the abort');
 assert.equal(sql.includes('ROLLBACK'),false,'no post-abort ROLLBACK work');
 assert.ok(c.releases.at(-1) instanceof Error,'the aborted lease is retired');
});

test('actual artifact owner remaining deadline: the absolute caller cutoff prevents a second attempt',async()=>{
 const clock={t:0},calls=[];
 const c=composed(clock,()=>{clock.t=2001;throw timeout();});
 const {service,context,versionId}=owner(clock,c,3000,calls);
 let outer;try{await service.inspect(versionId,context);outer='accepted';}catch(error){outer=codes(error);}
 assert.equal(outer,'RETENTION_READ_UNAVAILABLE');
 assert.equal(calls[0].deadlineMs,3000,'the owner passes its absolute deadline unchanged');
 assert.equal(c.locks(),1,'2001+2000 cannot fit the 3000ms cutoff');
 assert.equal(c.statements.filter(s=>s.startsWith('BEGIN')).length,1,'no second BEGIN after expiry');
 assert.equal(c.statements.some(s=>s.startsWith('SELECT s.projection,')),false);
 assert.equal(c.statements.includes('COMMIT'),false);
});

test('actual artifact owner already-expired lifetime starts no SQL and consults no gate',async()=>{
 const clock={t:5},calls=[];
 const c=composed(clock,()=>({rows:[]}));
 const {service,context,versionId}=owner(clock,c,1,calls);
 let outer;try{await service.inspect(versionId,context);outer='accepted';}catch(error){outer=codes(error);}
 assert.equal(outer,'ARTIFACT_DEADLINE');
 assert.equal(calls.length,0,'no gate call after expiry');
 assert.equal(c.locks(),0);
 assert.equal(c.statements.length,0,'no SQL after expiry');
});
