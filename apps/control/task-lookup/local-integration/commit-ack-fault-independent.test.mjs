import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommitAckFault} from './commit-ack-fault.mjs';

const selected={
 claim:"INSERT INTO meri_task_lookup.lookups(tenant_id,lookup_id,result_reference,payload,state) VALUES($1,$2,$3,$4::jsonb,'CLAIMED') ON CONFLICT DO NOTHING RETURNING lookup_id",
 dispatch:"UPDATE meri_task_lookup.lookups SET state='DISPATCHING' WHERE tenant_id=$1 AND lookup_id=$2",
 result:"UPDATE meri_task_lookup.lookups SET state='RESULT',record=$3::jsonb WHERE tenant_id=$1 AND lookup_id=$2"
};
function setup(phase,override={}){
 const log=[],releases=[];let connected=0,ended=0;
 const pool={async connect(){const n=++connected;return {processID:9000+n,async query(...args){log.push({n,args});if(override.query)return override.query(...args);return {rows:[{marker:'actual-delegate-result'}],rowCount:1};},release(error){releases.push({n,error});if(override.release)throw override.release;}};},end(){ended++;}};
 return {pool,log,releases,wrapper:createCommitAckFault({pool,phase}),get connected(){return connected;},get ended(){return ended;}};
}
async function transaction(client,sql){await client.query('BEGIN');await client.query(sql,['synthetic-tenant','synthetic-lookup','synthetic-record']);return client.query('COMMIT');}
for(const phase of ['claim','dispatch','result'])test(`independent ${phase} loses only post-successful COMMIT acknowledgment once`,async()=>{
 const h=setup(phase),c=await h.wrapper.pool.connect();await assert.rejects(transaction(c,selected[phase]));assert.equal(h.log.at(-1).args[0],'COMMIT');assert.equal(h.wrapper.receipt().fired,true);
 await transaction(c,selected[phase]);assert.equal(h.log.filter(x=>x.args[0]==='COMMIT').length,2);c.release();assert.equal(h.releases.length,1);assert.equal(h.ended,0);assert.equal(h.wrapper.receipt().phase,phase);
});
for(const phase of ['claim','dispatch','result'])test(`independent ${phase} ignores other lookup and budget transaction commits`,async()=>{
 const h=setup(phase),c=await h.wrapper.pool.connect();for(const [other,sql] of Object.entries(selected))if(other!==phase)await transaction(c,sql);
 await transaction(c,"UPDATE meri_qualification.tool_reservations SET state='SETTLED' WHERE invocation_id=$1");assert.equal(h.wrapper.receipt().fired,false);await assert.rejects(transaction(c,selected[phase]));c.release();assert.equal(h.ended,0);
});
test('independent native COMMIT rejection remains original and does not consume synthetic loss',async()=>{
 let rejectCommit=true;const native=new Error('synthetic-native-commit-failure');const h=setup('result',{query:async sql=>{if(sql==='COMMIT'&&rejectCommit)throw native;return {rows:[],rowCount:1};}}),c=await h.wrapper.pool.connect();
 await assert.rejects(transaction(c,selected.result),e=>e===native);assert.equal(h.wrapper.receipt().fired,false);rejectCommit=false;await assert.rejects(transaction(c,selected.result),e=>e!==native);assert.equal(h.wrapper.receipt().fired,true);c.release(native);assert.equal(h.releases[0].error,native);
});
test('independent rollback clears phase and cannot fault a later unrelated transaction',async()=>{
 const h=setup('result'),c=await h.wrapper.pool.connect();await c.query('BEGIN');await c.query(selected.result,[]);await c.query('ROLLBACK');await transaction(c,'SELECT 1');assert.equal(h.wrapper.receipt().fired,false);c.release();
});
test('independent forwarding preserves SQL argument and returned object identity',async()=>{
 const returned={rows:[{opaque:true}],rowCount:1};let passed;const h=setup('claim',{query:async(...args)=>{passed=args;return returned;}}),c=await h.wrapper.pool.connect();const values=['literal'],config={text:'SELECT $1',values};assert.equal(await c.query(config),returned);assert.equal(passed[0],config);c.release();assert.equal(h.ended,0);
});
test('independent concurrent clients share one fault but preserve each native COMMIT',async()=>{
 const h=setup('claim'),a=await h.wrapper.pool.connect(),b=await h.wrapper.pool.connect();const r=await Promise.allSettled([transaction(a,selected.claim),transaction(b,selected.claim)]);assert.equal(r.filter(x=>x.status==='rejected').length,1);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.log.filter(x=>x.args[0]==='COMMIT').length,2);a.release();b.release();assert.equal(h.releases.length,2);assert.equal(h.ended,0);
});
test('independent borrowed release error is not swallowed by fault forwarding',async()=>{
 const error=new Error('synthetic-release-failure'),h=setup('dispatch',{release:error}),c=await h.wrapper.pool.connect();assert.throws(()=>c.release(),e=>e===error);assert.equal(h.ended,0);
});
test('independent unknown fault phase refuses before borrowing a connection',()=>{let connects=0;assert.throws(()=>createCommitAckFault({pool:{connect(){connects++;}},phase:'any-commit'}));assert.equal(connects,0);});
test('independent receipt snapshot cannot change subsequent one-shot state',async()=>{
 const h=setup('result'),r=h.wrapper.receipt();try{r.fired=true;r.phase='claim';}catch{}assert.equal(h.wrapper.receipt().fired,false);assert.equal(h.wrapper.receipt().phase,'result');const c=await h.wrapper.pool.connect();await assert.rejects(transaction(c,selected.result));c.release();
});
