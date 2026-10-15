/** The L1 hold interleavings against actual Unix-only PostgreSQL 16 with the existing migrated schema: unique tenant
 * per test, no truncation, no migration execution. Same real worker activity + control service/journal/store as the
 * synthetic suite; only the SDK transport and native checkpoint capture are scripted. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import pg from 'pg';
import {holdComposition,holdScenarios} from './lifecycle-hold-harness.mjs';
import {id} from './lifecycle-fixture.mjs';
async function ownedPool(t){const host=process.env.MERI_INSPECTION_TEST_SOCKET,database=process.env.MERI_INSPECTION_TEST_DATABASE;if(host!=='/tmp/meri-prepared-kickoff-pg-20261014/socket'||database!=='meri_inspection_final')throw Error('NEW_OWNED_OPTIONAL_DATABASE_REQUIRED');
 const pool=new pg.Pool({host,database,user:'postgres',max:4});t.after(()=>pool.end());assert.equal((await pool.query("SELECT current_setting('listen_addresses') AS listen")).rows[0].listen,'');return pool;}
for(const [name,scenario] of Object.entries(holdScenarios))test(`PostgreSQL: ${name}`,async t=>{const pool=await ownedPool(t),made=[];
 try{await scenario(async options=>{const tenantId='hold-pg-'+randomUUID(),binding={tenantId,actorId:'actor-'+randomUUID(),conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},scopes=[{tenantId,kind:'client',resourceId:id(5),policyRevision:'policy1'}];
  const h=await holdComposition({...options,pool,binding,scopes});made.push(h);return h;});}finally{for(const h of made)h.f.close();}});
