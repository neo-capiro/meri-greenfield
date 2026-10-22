import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerRequestWork} from './owner-request-work.mjs';

function fixture(query=async()=>({rows:[]})){
 const releases=[],client={query,release:error=>releases.push(error)};let poisoned=0;
 const work=createOwnerRequestWork({pool:{connect:async()=>client},onUnresolvedMutation:()=>poisoned++});
 return {work,releases,poisoned:()=>poisoned};
}
test('an aborted read evicts its client and cannot issue follow-on SQL',async()=>{
 let resolve,started;const entered=new Promise(r=>started=r);
 const f=fixture(()=>{started();return new Promise(r=>resolve=r);}),client=await f.work.pool.connect();
 const read=client.query('SELECT 1');await entered;f.work.close();f.work.close();
 assert.equal(f.releases.length,1);assert.ok(f.releases[0] instanceof Error);assert.equal(f.poisoned(),0);
 resolve({rows:[]});await assert.rejects(read,/STOPPED/);await assert.rejects(client.query('SELECT 2'),/STOPPED/);
 client.release();assert.equal(f.releases.length,1);
});
test('a late checkout after cancellation is discarded before any statement',async()=>{
 let resolve,queries=0;const releases=[];
 const work=createOwnerRequestWork({pool:{connect:()=>new Promise(r=>resolve=r)}}),pending=work.pool.connect();
 work.close();resolve({query(){queries++;},release:error=>releases.push(error)});
 await assert.rejects(pending,/STOPPED/);assert.equal(queries,0);assert.equal(releases.length,1);assert.ok(releases[0] instanceof Error);
});
test('unresolved mutation and transaction commit poison; capture and reads do not',async()=>{
 for(const pendingVerb of ['INSERT INTO holds VALUES (1)','COMMIT']){
  let release;const f=fixture(text=>text===pendingVerb?new Promise(r=>release=r):Promise.resolve({rows:[]}));
  const client=await f.work.pool.connect();await client.query('BEGIN');
  if(pendingVerb==='COMMIT')await client.query('INSERT INTO holds VALUES (1)');
  const pending=client.query(pendingVerb);f.work.close();assert.equal(f.poisoned(),1,pendingVerb);
  release({rows:[]});await assert.rejects(pending,/STOPPED/);
 }
});
test('acknowledged commit or rollback clears unresolved mutation ownership',async()=>{
 for(const end of ['COMMIT','ROLLBACK']){
  const f=fixture(),client=await f.work.pool.connect();await client.query('BEGIN');await client.query('UPDATE holds SET state=1');await client.query(end);
  client.release();f.work.close();assert.equal(f.poisoned(),0);assert.deepEqual(f.releases,[undefined]);
 }
});
test('read-only recovery cannot issue a write even on a fresh client',async()=>{
 let queries=0;const work=createOwnerRequestWork({pool:{connect:async()=>({query(){queries++;},release(){}})},readOnly:true});
 const client=await work.pool.connect();await assert.rejects(client.query('INSERT INTO holds VALUES (1)'),/READ_ONLY/);
 assert.equal(queries,0);work.close();
});
