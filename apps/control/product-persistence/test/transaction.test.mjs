/** SYNTHETIC: transaction ownership over a scripted pg-compatible client; no database. */
import test from 'node:test';import assert from 'node:assert/strict';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
import {transact} from '../transaction.mjs';
function pool(fail){const log=[],released=[];return {log,released,async connect(){return {async query(sql){log.push(sql);if(fail?.(sql))throw Error(`synthetic ${sql} failure`);return {rows:[]};},release(error){released.push(error===undefined?'reused':'evicted');}};}};}
test('commits inside bounded waits and returns the operation result',async()=>{
 const p=pool();assert.equal(await transact(p,async()=>42),42);
 assert.deepEqual(p.log,['BEGIN',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'",'COMMIT']);assert.deepEqual(p.released,['reused']);
});
test('an owned refusal rolls back and keeps its code; a foreign error becomes the unavailable code',async()=>{
 const p=pool();await assert.rejects(transact(p,async()=>{throw new ProductError('SETTINGS_REVISION_CONFLICT');}),e=>productFailure(e)?.code==='SETTINGS_REVISION_CONFLICT');
 assert.equal(p.log.at(-1),'ROLLBACK');
 await assert.rejects(transact(pool(),async()=>{throw Error('raw driver text');},{unavailable:'X_UNAVAILABLE'}),e=>productFailure(e)?.code==='X_UNAVAILABLE'&&!e.message.includes('driver'));
});
test('an unacknowledged COMMIT is uncertainty with an UNKNOWN outcome and evicts the client',async()=>{
 const p=pool(sql=>sql==='COMMIT');
 await assert.rejects(transact(p,async()=>1,{uncertain:'X_COMMIT_UNKNOWN'}),e=>productFailure(e)?.code==='X_COMMIT_UNKNOWN'&&productFailure(e).outcome==='UNKNOWN');
 assert.deepEqual(p.released,['evicted']);assert.equal(p.log.includes('ROLLBACK'),false);
});
