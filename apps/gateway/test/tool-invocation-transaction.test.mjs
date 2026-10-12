/** Inert transaction-boundary controls: no driver, socket or SQL engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresBudgetStore, BudgetStateDenied, BudgetCommitUncertain } from '../budget/postgres-budget-store.mjs';

function fixture(park) {
  const commands=[],releases=[];let connects=0,active=true,enter,release;
  const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const stop=()=>{active=false;};
  const check=()=>{if(!active)throw new BudgetStateDenied('INVOCATION_STOPPED');};
  const pause=async name=>{if(name===park){enter();await gate;}};
  const client={async query(sql){commands.push(sql);await pause(sql);return {rows:[]};},release(error){releases.push(error);}};
  const pool={async connect(){connects++;await pause('connect');return client;}};
  const store=new PostgresBudgetStore(pool);
  return {store,check,stop,entered,release:()=>release(),commands,releases,connects:()=>connects};
}
test('already stopped live transaction does not acquire a borrowed connection',async()=>{
 const f=fixture();f.stop();await assert.rejects(f.store.transact(()=>assert.fail('operation'),f.check),BudgetStateDenied);
 assert.equal(f.connects(),0);assert.deepEqual(f.commands,[]);
});
for(const stage of ['connect','BEGIN',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'"])test(`cancelled parked ${stage} starts no next transaction port and releases its owned lease`,async()=>{
 const f=fixture(stage);let effects=0;
 const pending=f.store.transact(async()=>{effects++;},f.check);await f.entered;f.stop();f.release();
 await assert.rejects(pending,error=>error instanceof BudgetStateDenied&&!(error instanceof BudgetCommitUncertain));
 assert.equal(effects,0);assert.equal(f.releases.length,1);
 if(stage==='connect'){assert.deepEqual(f.commands,[]);assert.ok(f.releases[0] instanceof BudgetStateDenied);}
 else {assert.equal(f.commands.at(-1),'ROLLBACK');assert.equal(f.commands.at(-2),stage);assert.equal(f.releases[0],undefined);}
});
test('cancellation after operation prevents COMMIT and rolls back',async()=>{
 const f=fixture();await assert.rejects(f.store.transact(async()=>{f.stop();return 'unreleased';},f.check),BudgetStateDenied);
 assert.equal(f.commands.at(-1),'ROLLBACK');assert.equal(f.commands.includes('COMMIT'),false);
});
test('late successful COMMIT ACK after cancellation remains typed uncertainty and evicts connection',async()=>{
 const f=fixture('COMMIT');const pending=f.store.transact(async()=> 'unreleased',f.check);
 await f.entered;f.stop();f.release();await assert.rejects(pending,BudgetCommitUncertain);
 assert.equal(f.commands.at(-1),'COMMIT');assert.equal(f.commands.includes('ROLLBACK'),false);
 assert.ok(f.releases[0] instanceof BudgetCommitUncertain);
});
test('default historical transaction preserves operation and borrowed pool ownership',async()=>{
 const f=fixture();f.stop();assert.equal(await f.store.transact(async()=> 'observed'),'observed');
 assert.equal(f.commands.at(-1),'COMMIT');assert.deepEqual(f.releases,[undefined]);
});
