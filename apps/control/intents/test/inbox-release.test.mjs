/** The inbox route's retention release over a SYNTHETIC owner and retention fence: a suppressed (deleted) conversation drops its
 * rows from the page instead of failing it, the pending summary is rebuilt from what is served, and any other fence failure still
 * refuses. No PostgreSQL, Core or runtime mount. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createIntentApplication,INTENT_PATHS} from '../http.mjs';
const NOW=Date.UTC(2026,10,1,12),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sdk=n=>'sdk:'+String(n).padStart(64,'0');
const row=(conversation,n,phase='awaiting_approval')=>({conversationId:id(conversation),deliveryId:sdk(n),createdAt:new Date(NOW-n).toISOString(),operation:{id:'create_task',version:'0.2.0'},kind:'proposal',withheld:false,clientId:null,expiresAt:new Date(NOW+60000).toISOString(),phase});
const principal={tenantId:'tenant',actorId:'actor',role:'standard_user',permissions:[],clientIds:[],membershipRevision:'m1'};
function setup({page,suppressed=new Set(),fenceError=null}){
 const fence={released:[],asserted:[]};
 const retention={async withRelease(subjects,release,options){
  fence.released.push(subjects.map(s=>s.subjectId));assert.ok(options?.signal!==undefined||options===undefined);
  return release(undefined,async subject=>{fence.asserted.push(subject.subjectId);
   if(fenceError)throw Object.assign(Error(fenceError),{code:fenceError});
   if(suppressed.has(subject.subjectId))throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});});
 }};
 const gate={async admit(){return {principal,expiresAtMs:NOW+60000};},async recheck({principal:p}){fence.rechecks=(fence.rechecks??0)+1;return p;}};
 const owner={async inbox(){return page;},async list(){throw Error('unused');},async decide(){throw Error('unused');},async inboxCount(){return {open:page.rows.length,checkedAt:new Date(NOW).toISOString()};}};
 const app=createIntentApplication({owner,gate,now:()=>NOW,limits:{maxRequestMs:5000,maxRequestBytes:4096,maxResponseBytes:262144},retention});
 return {fence,post:async(path=INTENT_PATHS.inbox,body={})=>{const r=await app.handle(new Request('http://127.0.0.1'+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer token'},body:JSON.stringify(body)}));return {status:r.status,json:await r.json()};}};
}
const page={rows:[row(1,1),row(2,2),row(1,3,'completed'),row(3,4)],next:{conversationId:id(3),deliveryId:sdk(4)},pending:{count:3,complete:false}};

test('a suppressed conversation drops its rows and the pending summary is rebuilt; the other conversations are served',async()=>{
 const s=setup({page,suppressed:new Set([id(1)])}),answer=await s.post();
 assert.equal(answer.status,200);
 assert.deepEqual(answer.json.rows.map(r=>r.deliveryId),[sdk(2),sdk(4)]);assert.deepEqual(answer.json.pending,{count:2,complete:false});assert.deepEqual(answer.json.next,page.next,'the journal cursor is kept so paging continues past the dropped rows');
 assert.deepEqual(s.fence.released,[[id(1),id(2),id(3)]],'every conversation on the page is fenced once');
 assert.equal(s.fence.rechecks,1);assert.ok(s.fence.asserted.filter(x=>x===id(2)).length>=2,'served conversations are asserted before and after the membership recheck');
});
test('nothing suppressed serves the page unchanged; an empty page needs no fence; another fence failure still refuses the page',async()=>{
 const plain=await setup({page}).post();assert.deepEqual(plain.json,page);
 const empty=setup({page:{rows:[],next:null,pending:{count:0,complete:true}}});const nothing=await empty.post();assert.equal(nothing.status,200);assert.deepEqual(empty.fence.released,[]);
 const barrier=await setup({page,fenceError:'RETENTION_RECOVERY_BARRIER'}).post();assert.equal(barrier.status,502);assert.equal(barrier.json.error.code,'PRODUCT_UNAVAILABLE');
 const count=await setup({page}).post(INTENT_PATHS.inboxCount,{});assert.equal(count.status,200);assert.deepEqual(count.json,{open:4,checkedAt:new Date(NOW).toISOString()});
});
