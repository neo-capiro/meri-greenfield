/** SOURCE ONLY: scripted Core and clocks, real O208 receipt owner. No live qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunCurrentAuthority,CURRENT_MAX_WAIT_MS} from '../run-current-authority.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
function fixture(){
 const s={mono:0,wall:1800000000000,calls:[],status:200,recorded:[],wait:null};
 const receipt=()=>({principal:{tenantId:'tenant',actorId:'actor'},role:'standard_user',permissions:['memory.propose.firm'],clientIds:[id(5)],identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64),conversationId:id(1),selectedClientId:id(5),checkedAtMs:s.wall,expiresAtMs:s.wall+120000});
 const owner=createRunCurrentAuthority({now:()=>s.wall,monotonic:()=>s.mono,record:k=>s.recorded.push(k),client:{async readCurrent(call){s.calls.push(call);await s.wait?.();if(s.status!==200)throw Object.assign(Error('Core refused'),{status:s.status});return {...receipt(),principal:{tenantId:call.testPrincipal??'tenant',actorId:'actor'},conversationId:call.conversationId};}}});
 const read=(extra={})=>owner.read({binding,selectedClientId:id(5),credential:'native-session',sessionFence:'session:revision',deadlineMs:s.wall+3000,...extra});
 return {s,owner,read,receipt};
}
test('O208 reuses at19.9s and sends fresh at20.0s',async()=>{
 const f=fixture();await f.read();f.s.mono=19900;await f.read();assert.equal(f.s.calls.length,1);f.s.mono=20000;await f.read();assert.equal(f.s.calls.length,2);assert.equal(f.s.calls[1].expect,undefined,'a refresh pins no revisions');
 assert.deepEqual(f.owner.status(),{freshCalls:2,reuses:1,entries:1});assert.deepEqual(f.s.recorded,['fresh','reuse','fresh']);
});
test('O208 revocation is observed at next recheck after20s',async()=>{
 const f=fixture();await f.read();f.s.status=403;f.s.mono=20000;await assert.rejects(f.read(),e=>e.status===403);assert.equal(f.s.calls.length,2);assert.equal(f.owner.status().entries,0);
});
test('O208 fresh403 mid-run invalidates the positive receipt',async()=>{
 const f=fixture();await f.read();f.s.mono=100;f.s.status=403;await assert.rejects(f.read({fresh:true}),e=>e.status===403);await assert.rejects(f.read(),e=>e.status===403);assert.equal(f.s.calls.length,3);assert.equal(f.owner.status().entries,0);
});
test('O208 warm cache cannot cover503,401 or409',async()=>{
 for(const status of [503,401,409]){const f=fixture();await f.read();f.s.status=status;await assert.rejects(f.read({fresh:true}),e=>e.status===status);await assert.rejects(f.read(),e=>e.status===status);assert.equal(f.s.calls.length,3);assert.equal(f.owner.status().entries,0);}
});
test('O208 cross-run/conversation/principal/session/fence/credential never reuse',async()=>{
 const f=fixture();await f.read();
 const variations=[{binding:{...binding,runId:id(6)}},{binding:{...binding,conversationId:id(7)}},{binding:{...binding,actorId:'foreign'}},{binding:{...binding,tenantId:'foreign'}},{sessionFence:'another:revision'},{binding:{...binding,writerFence:2}},{credential:'replaced-native'}];
 for(const extra of variations){const count=f.s.calls.length;await f.read(extra).catch(e=>{assert.equal(e.status,403);});assert.equal(f.s.calls.length,count+1);}
 assert.equal(f.owner.status().reuses,0);
});
test('O208 every write admission requests fresh even with a warm receipt',async()=>{
 const f=fixture();await f.read();await f.read({fresh:true});await f.read({fresh:true});assert.equal(f.s.calls.length,3);assert.equal(f.owner.status().reuses,0);
});
test('O208 reuse never refreshes sendStart; Core wall clocks do not set age',async()=>{
 const f=fixture();await f.read();f.s.mono=10000;await f.read();f.s.wall+=1;f.s.mono=19999;await f.read();f.s.mono=20000;await f.read();assert.equal(f.s.calls.length,2);assert.equal(f.owner.status().reuses,2);
});
test('O208 a fresh observation uses request send time, not response completion',async()=>{
 const f=fixture();f.s.wait=async()=>{f.s.mono=2900;};await f.read();f.s.wait=null;f.s.mono=20000;await f.read();assert.equal(f.s.calls.length,2);
});
test('O208 concurrent refusal cannot be overwritten by an older late positive',async()=>{
 const f=fixture();await f.read();let resume,entered;const barrier=new Promise(r=>entered=r),wait=new Promise(r=>resume=r);f.s.wait=async()=>{f.s.wait=null;entered();await wait;};
 const late=f.read({fresh:true});const caught=assert.rejects(late);await barrier;f.s.status=403;await assert.rejects(f.read({fresh:true}),e=>e.status===403);f.s.status=200;resume();await caught;assert.equal(f.owner.status().entries,0);
});
test('O208 a timeout with a warm cache refuses and leaves no positive fallback',async()=>{
 const f=fixture();await f.read();f.s.wait=()=>new Promise(()=>{});
 await assert.rejects(f.read({fresh:true,deadlineMs:f.s.wall+10}),e=>e.status===503);assert.equal(f.owner.status().entries,0);assert.equal(f.s.calls.length,2);
});
test('O208 the Core request deadline is at most three monotonic seconds',async()=>{
 const f=fixture();f.s.wait=async()=>{f.s.mono=CURRENT_MAX_WAIT_MS;};await assert.rejects(f.read(),e=>e.status===503);assert.equal(f.owner.status().entries,0);
});


test('S2 concurrent fresh positives both succeed without sharing admission or refreshing the older age',{timeout:5000},async t=>{
 const f=fixture();let resume,entered;const barrier=new Promise(r=>entered=r),wait=new Promise(r=>resume=r);t.after(()=>resume?.());
 f.s.wait=async()=>{f.s.wait=null;entered();await wait;};
 const first=f.read({fresh:true}),settled=Promise.allSettled([first]);await Promise.race([barrier,first.then(()=>{throw Error('first settled before entering');},e=>{throw e;})]);
 f.s.mono=100;const second=await Promise.allSettled([f.read({fresh:true})]);resume();const older=await settled;
 assert.deepEqual([older[0].status,second[0].status],['fulfilled','fulfilled']);assert.equal(f.s.calls.length,2,'each effect admission observed Core freshly');
 f.s.mono=20000;await f.read();assert.equal(f.s.calls.length,2,'the newer successful sendStart100 remains cached');f.s.mono=20100;await f.read();assert.equal(f.s.calls.length,3,'reuse never moves the newest sendStart');
});
test('S2 a refusal invalidates older observations but not a later successful fresh observation',{timeout:5000},async t=>{
 const f=fixture();await f.read();let resume,entered;const barrier=new Promise(r=>entered=r),wait=new Promise(r=>resume=r);t.after(()=>resume?.());
 f.s.wait=async()=>{f.s.wait=null;entered();await wait;};const first=f.read({fresh:true}),outcome=Promise.allSettled([first]);await Promise.race([barrier,first.then(()=>{throw Error('first settled before entering');},e=>{throw e;})]);
 f.s.status=403;await assert.rejects(f.read({fresh:true}),e=>e.status===403);f.s.status=200;await f.read({fresh:true});resume();
 assert.equal((await outcome)[0].status,'rejected','an older positive cannot cover a concurrent refusal');assert.equal(f.owner.status().entries,1,'the post-refusal fresh observation remains valid');await f.read();assert.equal(f.s.calls.length,4);assert.equal(f.owner.status().reuses,1);
});
