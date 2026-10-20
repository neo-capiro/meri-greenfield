/** Routines-enabled saved history over the actual HTTP, currentness, schedule, and retention owners on one bounded pool.
 * The SQL and membership fixtures are local; no PostgreSQL or Core service is contacted. */
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
function oneConnectionPool(origin){
 const state={live:0,active:0,peak:0,connects:0,queued:0,idle:[],waiters:[],originReads:[],releases:[]};
 const lease=()=>{let client=state.idle.pop();if(!client){state.live++;client={locks:0,async query(sql,args=[]){
   if(sql.startsWith('SELECT pg_advisory_lock_shared')){this.locks++;return {rows:[]};}
   if(sql.startsWith('SELECT pg_advisory_unlock_shared')){this.locks--;return {rows:[{unlocked:true}]};}
   if(sql.startsWith('SELECT pg_advisory_xact_lock_shared')||sql==='BEGIN ISOLATION LEVEL READ COMMITTED'||sql==='BEGIN'||sql==='COMMIT'||sql.startsWith('SET LOCAL'))return {rows:[]};
   if(sql.startsWith('SELECT s.projection,'))return {rows:[{projection:null,projection_sha256:null,state:null,ledger_sequence:null,watermark_sequence:0,watermark_entry_sha256:null}]};
   if(sql.startsWith('SELECT tenant_id,generation,occurrence_key')){
    state.originReads.push({held:this.locks>0,tenantId:args[0],conversationId:args[1]});
    return {rows:origin&&origin.tenant_id===args[0]&&origin.effect.binding.conversationId===args[1]?[structuredClone(origin)]:[]};
   }
   throw Error(`unscripted SQL: ${sql}`);
  },release(error){state.releases.push(error);state.active--;if(error)state.live--;else state.idle.push(this);
   if(state.waiters.length)state.waiters.shift()(checkout());}};}
  state.active++;state.peak=Math.max(state.peak,state.active);return client;};
 const checkout=()=>lease();
 return {state,connect(){state.connects++;if(state.idle.length||state.live<1)return Promise.resolve(checkout());state.queued++;return new Promise(resolve=>state.waiters.push(resolve));}};
}

for(const custody of ['absent','scheduled'])test(`one-connection history release preserves ${custody} custody and never nests a checkout`,async()=>{
 const fixture=await scheduledConversationFixture(),row=custody==='scheduled'?structuredClone(fixture.storedOrigin()):null;
 const pool=oneConnectionPool(row),journal=createPostgresRetentionJournal({pool,now:()=>NOW,maxRequestMs:1000});
 const watermark=createPostgresWatermarkStore({journal}),fence=createServingFence();fence.enable({watermark:position()});
 const tracked=watermarkedJournal({journal,watermark,fence,ledger:{head:async()=>position()}});
 const retention=createRetentionReadGate({journal:tracked,serving:fence});
 const scheduleOwner=createPostgresScheduleOwner({pool}),core={calls:0,async assertCurrent(){this.calls++;}};
 const currentness=createScheduledConversationCurrentness({scheduleOwner,gate:fixture.gate,core,now:()=>NOW,maxRequestMs:1000});
 const conversationId=custody==='scheduled'?fixture.call.conversationId:'77777777-7777-4777-8777-777777777777';
 const conversation={conversationId,scopes:fixture.p.scopes};
 const store={history:{async list(){return {conversations:[conversation],hasMore:false,nextCursor:null};},async transcript(){throw Error('unused');}}};
 const service=createConversationHistoryService({store,gate:fixture.gate,retention});
 const app=createConversationHistoryApplication({service,gate:fixture.gate,currentness,now:()=>NOW,
  limits:{maxRequestMs:1000,maxRequestBytes:131072,maxResponseBytes:2097152}});
 const response=await app.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer native','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,200);assert.deepEqual((await response.json()).conversations.map(c=>c.conversationId),[conversationId]);
 assert.equal(core.calls,custody==='absent'?1:0,'absent origin alone routes to Core, once, in the fenced release');
 assert.deepEqual(pool.state.originReads.map(r=>r.held),[true,true],'both custody reads are the final ones and use the fenced session');
 assert.ok(pool.state.originReads.every(r=>r.tenantId===fixture.principal.tenantId&&r.conversationId===conversationId));
 assert.equal(pool.state.peak,1);assert.equal(pool.state.queued,0);assert.equal(pool.state.active,0);
 assert.ok(pool.state.releases.every(error=>error===undefined));
});
