/** The conversation intent mount's preparation budget, through the real `createIntentMount` and journal with mocked timers.
 * 2 Nov: a PDF preparation on a cold renderer microVM (about 30 s) ran inside the mount's 25 s lifetime (control's HTTP request
 * budget), and an expired lifetime could not even settle the claimed row, leaving it PENDING. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createIntentMount} from '../mount.mjs';
import {createMemoryJournalStore,delivery} from './fixture.mjs';
import {fixture as commandFixture} from '../../test/commands-fixture.mjs';
import {DOCUMENT_PREPARATION_MS,INTENT_MOUNT_PREPARE_MS,INTENT_SETTLE_MS,INTENT_PREPARE_CONTROL_MS} from '../../../../packages/runtime/runner-load-budget.mjs';

const WORD={id:'create_word',version:'0.2.0'},COLD_RENDERER_MS=40000;
const {binding,scopes}=commandFixture('task.create');
function setup(t,{maxRequestMs,prepare}){
 t.mock.timers.enable({apis:['setTimeout','Date'],now:1_000_000});
 const store=createMemoryJournalStore(),now=()=>Date.now();
 const resultRelease={async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:now(),expiresAtMs:now()+600000};}};
 const preparer={operation:WORD,owner:'document',binding,formats:['docx','pdf'],prepare};
 const mount=createIntentMount({binding,preparers:[preparer],journalStore:store.port,now,limits:{maxRequestMs},enabled:true,resultRelease});
 return {store,mount,row:()=>[...store.rows.values()][0]};
}
const flush=async()=>{for(let i=0;i<30;i++)await new Promise(resolve=>setImmediate(resolve));};
const call={operation:WORD,arguments:{operation:'create_word',format:'pdf',title:'One page',content:{blocks:[]}},deliveryId:delivery(31)};

test('the mount budget encloses a document preparation and its settlement inside control\'s prepare route',()=>{
 assert.ok(DOCUMENT_PREPARATION_MS>COLD_RENDERER_MS&&DOCUMENT_PREPARATION_MS<INTENT_MOUNT_PREPARE_MS);
 assert.ok(INTENT_MOUNT_PREPARE_MS+INTENT_SETTLE_MS<INTENT_PREPARE_CONTROL_MS);
});

test('a cold-renderer preparation completes inside the conversation mount budget and its row is PREPARED',async t=>{
 const s=setup(t,{maxRequestMs:INTENT_MOUNT_PREPARE_MS,prepare:({signal})=>new Promise((resolve,reject)=>{
  setTimeout(()=>resolve({status:'draft',version:{synthetic:true}}),COLD_RENDERER_MS);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});})});
 const pending=s.mount.prepare(call).catch(error=>error);await flush();
 t.mock.timers.tick(COLD_RENDERER_MS);await flush();await pending;
 // The synthetic result is not a releasable draft; what matters here is that the owner's result was recorded.
 assert.equal(s.row().state,'PREPARED');assert.deepEqual(s.row().outcome.result,{status:'draft',version:{synthetic:true}});
});

test('at the former 25 s budget the same preparation expires, and the row is still settled UNKNOWN, never left PENDING',async t=>{
 let aborted=false;
 const s=setup(t,{maxRequestMs:25000,prepare:({signal})=>new Promise((resolve,reject)=>{
  setTimeout(()=>resolve({status:'draft'}),COLD_RENDERER_MS);signal.addEventListener('abort',()=>{aborted=true;reject(signal.reason);},{once:true});})});
 const pending=s.mount.prepare(call).catch(error=>error);await flush();
 t.mock.timers.tick(25000);await flush();const error=await pending;
 assert.equal(error.code,'UNKNOWN');assert.equal(aborted,true);assert.equal(s.row().state,'UNKNOWN');
 // A replay is answered from the settled row; the owner is never called again.
 const replay=await s.mount.prepare(call).catch(value=>value);assert.equal(replay.code,'UNKNOWN');
});

test('a caller that leaves mid-preparation still gets its row settled UNKNOWN, never left PENDING',async t=>{
 const s=setup(t,{maxRequestMs:INTENT_MOUNT_PREPARE_MS,prepare:()=>new Promise(()=>{})}),caller=new AbortController();
 const pending=s.mount.prepare({...call,signal:caller.signal}).catch(error=>error);await flush();
 caller.abort();await flush();assert.equal((await pending).code,'UNKNOWN');assert.equal(s.row().state,'UNKNOWN');
});
