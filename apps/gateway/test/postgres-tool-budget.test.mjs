import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresBudgetStore, BudgetCommitUncertain, BudgetStateDenied } from '../budget/postgres-budget-store.mjs';

for (const where of ['BEGIN','ROLLBACK','COMMIT']) test(`uncertain ${where} evicts connection and never retries`,async()=>{
 const calls=[];const releases=[];let connected=0;
 const store=new PostgresBudgetStore({async connect(){connected++;return {async query(sql){calls.push(sql);if(sql===where)throw Error('injected');return {rows:[]};},release(error){releases.push(error);}};}});
 await assert.rejects(store.transact(async()=>{if(where==='ROLLBACK')throw new BudgetStateDenied('DENIED');}),where==='COMMIT'?BudgetCommitUncertain:BudgetStateDenied);
 assert.equal(connected,1);assert.equal(releases.length,1);assert.ok(releases[0] instanceof Error);
 assert.equal(calls.filter(x=>x==='COMMIT').length,where==='COMMIT'?1:0);
});
test('release error preserves original commit uncertainty',async()=>{
 const store=new PostgresBudgetStore({async connect(){return {async query(sql){if(sql==='COMMIT')throw Error('lost');return {rows:[]};},release(){throw Error('release');}};}});
 await assert.rejects(store.transact(async()=>1),/^Error: COMMIT_ACKNOWLEDGEMENT_UNKNOWN$/);
});
test('database time is sampled only after budget lock acknowledgement',async()=>{
 const events=[];let unlock;const gate=new Promise(resolve=>unlock=resolve);const store=new PostgresBudgetStore({connect(){throw Error('unused');}});
 const pending=store.lock({async query(sql){events.push(sql);if(sql.includes('FOR UPDATE')){await gate;return {rows:[{id:1}]};}return {rows:[{now:new Date(0)}]};}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(events.length,1);unlock();assert.equal((await pending).now.getTime(),0);assert.equal(events.length,2);
});
