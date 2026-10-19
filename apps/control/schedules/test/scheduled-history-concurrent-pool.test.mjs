/** Concurrent actual HTTP history release on one scripted PostgreSQL lease. No database, Core or model connection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledConversationFixture} from './scheduled-conversation-fixture.mjs';
import {createPostgresScheduleOwner} from '../postgres-schedule-owner.mjs';
import {createScheduledConversationCurrentness} from '../scheduled-conversation-currentness.mjs';
import {createPostgresRetentionJournal} from '../../retention/postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../../retention/postgres-watermark.mjs';
import {watermarkedJournal} from '../../retention/recovery-watermark.mjs';
import {createServingFence} from '../../retention/serving-fence.mjs';
import {createRetentionReadGate} from '../../retention/suppression.mjs';
import {createConversationHistoryService} from '../../conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../../conversations/history/http.mjs';

const NOW=Date.parse('2026-10-15T12:00:01.000Z');
const position=()=>({sequence:0,entrySha256:null});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};

/** Capacity one, with an explicit pause on the first final custody read so the second HTTP request overlaps it. */
function boundedPool(origin){
 const firstHeldRead=deferred(),resumeHeldRead=deferred(),queuedCheckout=deferred();
 const state={live:0,active:0,peak:0,connects:0,queued:0,idle:[],waiters:[],originReads:[],releases:[],inFlight:0};
 let paused=false;
 const checkout=()=>{
  const client=state.idle.pop()??{locks:0,async query(sql,args=[]){
   state.inFlight++;
   try{
    if(sql.startsWith('SELECT pg_advisory_lock_shared')){this.locks++;return {rows:[]};}
    if(sql.startsWith('SELECT pg_advisory_unlock_shared')){this.locks--;return {rows:[{unlocked:true}]};}
    if(sql.startsWith('SELECT pg_advisory_xact_lock_shared')||sql==='BEGIN ISOLATION LEVEL READ COMMITTED'||sql==='BEGIN'||sql==='COMMIT'||sql.startsWith('SET LOCAL'))return {rows:[]};
    if(sql.startsWith('SELECT s.projection,'))return {rows:[{projection:null,projection_sha256:null,state:null,ledger_sequence:null,watermark_sequence:0,watermark_entry_sha256:null}]};
    if(sql.startsWith('SELECT tenant_id,generation,occurrence_key')){
     const held=this.locks>0;state.originReads.push({held,tenantId:args[0],conversationId:args[1]});
     if(held&&!paused){paused=true;firstHeldRead.resolve();await resumeHeldRead.promise;}
     return {rows:origin.tenant_id===args[0]&&origin.effect.binding.conversationId===args[1]?[structuredClone(origin)]:[]};
    }
    throw Error(`unscripted SQL: ${sql}`);
   }finally{state.inFlight--;}
  },release(error){
   state.releases.push({error,locks:this.locks,inFlight:state.inFlight});state.active--;
   if(error){state.live--;this.locks=0;}else state.idle.push(this);
   if(state.waiters.length)state.waiters.shift()(checkout());
  }};
  if(!state.live)state.live++;
  state.active++;state.peak=Math.max(state.peak,state.active);return client;
 };
 return {state,firstHeldRead,resumeHeldRead,queuedCheckout,connect(){
  state.connects++;if(state.idle.length||state.live<1)return Promise.resolve(checkout());
  state.queued++;queuedCheckout.resolve();return new Promise(resolve=>state.waiters.push(resolve));
 }};
}

test('concurrent scheduled and ordinary HTTP history requests complete on one connection with both final custody checks', {timeout:5000},async()=>{
 const fixture=await scheduledConversationFixture(),origin=structuredClone(fixture.storedOrigin()),pool=boundedPool(origin);
 const journal=createPostgresRetentionJournal({pool,now:()=>NOW,maxRequestMs:1000}),watermark=createPostgresWatermarkStore({journal}),fence=createServingFence();
 fence.enable({watermark:position()});
 const retention=createRetentionReadGate({journal:watermarkedJournal({journal,watermark,fence,ledger:{head:async()=>position()}}),serving:fence});
 const coreCalls=[],core={async assertCurrent(call){coreCalls.push(call.conversationId);}},scheduleOwner=createPostgresScheduleOwner({pool});
 const currentness=createScheduledConversationCurrentness({scheduleOwner,gate:fixture.gate,core,now:()=>NOW,maxRequestMs:1000});
 const scheduledId=fixture.call.conversationId,ordinaryId='77777777-7777-4777-8777-777777777777';
 const appFor=conversationId=>{
  const store={history:{async list(){return {conversations:[{conversationId,scopes:fixture.p.scopes}],hasMore:false,nextCursor:null};},async transcript(){throw Error('unused');}}};
  return createConversationHistoryApplication({service:createConversationHistoryService({store,gate:fixture.gate,retention}),gate:fixture.gate,currentness,now:()=>NOW,
   limits:{maxRequestMs:1000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 };
 const request=()=>new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'});
 const scheduled=appFor(scheduledId).handle(request());let ordinary;
 try{
  const first=await Promise.race([pool.firstHeldRead.promise.then(()=>null),scheduled.then(response=>({status:response.status}))]);
  assert.equal(first,null,'the first final origin read must use the held lease rather than wait for a nested checkout');
  ordinary=appFor(ordinaryId).handle(request());await pool.queuedCheckout.promise;
  assert.equal(pool.state.active,1);assert.equal(pool.state.peak,1);assert.equal(pool.state.waiters.length,1,'the independent overlapping request waits for the sole lease');
  pool.resumeHeldRead.resolve();
  const responses=await Promise.all([scheduled,ordinary]);
  for(const [index,response] of responses.entries()){
   assert.equal(response.status,200);const body=await response.json();
   assert.deepEqual(body.conversations.map(c=>c.conversationId),[index===0?scheduledId:ordinaryId]);
  }
  assert.deepEqual(coreCalls,[ordinaryId,ordinaryId],'only absent custody delegates to Core on both currentness passes');
  for(const conversationId of [scheduledId,ordinaryId]){
   const reads=pool.state.originReads.filter(r=>r.conversationId===conversationId);
   assert.deepEqual(reads.map(r=>r.held),[false,false,true,true],'first and last final custody reads both borrow the held session');
   assert.ok(reads.every(r=>r.tenantId===fixture.principal.tenantId));
  }
  assert.equal(pool.state.peak,1);assert.equal(pool.state.live,1);assert.equal(pool.state.active,0);
  assert.equal(pool.state.waiters.length,0);assert.equal(pool.state.inFlight,0);assert.equal(pool.state.idle.length,1);
  assert.equal(pool.state.connects,10,'each request has four preliminary reads and one serving checkout; no nested read checkout or retry');
  assert.ok(pool.state.releases.every(r=>r.error===undefined&&r.locks===0&&r.inFlight===0),'every returned session is unlocked and idle');
 }finally{pool.resumeHeldRead.resolve();await Promise.allSettled([scheduled,...(ordinary?[ordinary]:[])]);}
});
