import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserViewerRelay,VIEWER_DISCONNECT_MS} from './browser-viewer-relay.mjs';
import {BROWSER_VIEWER_SCHEMA as schema} from '../../../../packages/contracts/browser-viewer/receive.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const binding={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),attemptId:id(5),workerId:id(6),writerFence:1};
const context={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),selectedClientId:null},ownerInstanceId=id(7);
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=';
async function fixture(t){
 let at=1000,mode='user',epoch=1,closed=false;const calls=[];
 const page={url:()=> 'https://example.test/private?token=hidden',isClosed:()=>closed};
 const controls={readState:async()=>({state:mode,leaseEpoch:epoch,leaseExpiresAtMs:100000}),
  view:async input=>{calls.push(['view',input]);return {frameId:'F'.repeat(43),width:1,height:1,image:{mimeType:'image/png',data:png}};},
  userInput:async input=>{calls.push(['input',input]);},
  handBack(){calls.push(['release']);mode='returning';epoch++;},
  endLease(reason){calls.push(['end',reason]);mode='returning';epoch++;},
  takeover(){throw Error('Must never allocate a second hold');},resume(){throw Error('Must never resume through viewer');}};
 const relay=createBrowserViewerRelay({ownerInstanceId,binding,expiresAtMs:100000,now:()=>at});
 await relay.bind({binding,pages:()=>[page],controls});t.after(()=>relay.close());
 const grant={context,sessionKey:'a'.repeat(64),expiresAtMs:90000,custody:{binding,ownerInstanceId,leaseEpoch:1,expiresAtMs:100000}};
 const execute=(route,request={},auth=grant)=>relay.execute({route,request:{schema,...request},grant:auth,signal:new AbortController().signal});
 const ticket=()=>execute('ticket',{requestId:id(10)});
 const connect=async()=>{const q=await ticket();const r=await execute('connect',{requestId:id(11),ticket:q.ticket});return {ownerId:ownerInstanceId,viewerId:r.lease.viewerId,leaseEpoch:r.lease.leaseEpoch};};
 return {relay,execute,ticket,connect,grant,calls,page,controls,expire:()=>{at=100001;},closePage:()=>{closed=true;}};
}
test('ticket consumption and recovery never create another hold or resume; full URLs stay private',async t=>{
 const f=await fixture(t),ticket=await f.ticket();
 await assert.rejects(f.execute('connect',{requestId:id(11),ticket:ticket.ticket},{...f.grant,sessionKey:'b'.repeat(64)}));
 const connected=await f.execute('connect',{requestId:id(11),ticket:ticket.ticket});
 await assert.rejects(f.execute('connect',{requestId:id(11),ticket:ticket.ticket}));
 const read=await f.execute('read');assert.equal(read.lease.viewerId,connected.lease.viewerId);
 assert.equal(read.lease.connectRequestId,id(11));assert.equal(read.pages[0].origin,'https://example.test');assert.equal(f.calls.length,0);
});
test('a different authenticated session cannot borrow an existing viewer or its pages',async t=>{
 const f=await fixture(t);await f.connect();
 await assert.rejects(f.execute('read',{}, {...f.grant,sessionKey:'b'.repeat(64)}),/BROWSER_VIEWER_BUSY/u);
 await assert.rejects(f.execute('read',{}, {...f.grant,context:{...context,actorId:id(99)}}),/AUTHORITY/u);
 await assert.rejects(f.execute('read',{}, {...f.grant,custody:{...f.grant.custody,ownerInstanceId:id(99)}}),/AUTHORITY/u);
});
test('input uses a native page and consumes the last displayed frame exactly once',async t=>{
 const f=await fixture(t),lease=await f.connect(),read=await f.execute('read'),pageId=read.pages[0].pageId;
 await f.execute('frame',{...lease,requestId:id(12),pageId});
 const input={...lease,requestId:id(13),pageId,frameId:'F'.repeat(43),events:[{type:'text',text:'private'}]};
 await f.execute('input',input);assert.equal(f.calls[1][1].page,f.page);assert.equal(f.calls[1][1].input.events[0].text,'private');
 await assert.rejects(f.execute('input',input));assert.equal(f.calls.filter(([kind])=>kind==='input').length,1);
});

test('explicit session renewal replaces the viewer without a second hold and fences its old frame',async t=>{
 const f=await fixture(t),old=await f.connect(),read=await f.execute('read'),pageId=read.pages[0].pageId;
 await f.execute('frame',{...old,requestId:id(12),pageId});
 const renewed={...f.grant,sessionKey:'b'.repeat(64)};
 await assert.rejects(f.execute('read',{},renewed),/BROWSER_VIEWER_BUSY/u);
 const ticket=await f.execute('ticket',{requestId:id(14)},renewed);
 const next=await f.execute('connect',{requestId:id(15),ticket:ticket.ticket},renewed);
 assert.notEqual(next.lease.viewerId,old.viewerId);assert.equal(next.lease.leaseEpoch,old.leaseEpoch);
 await assert.rejects(f.execute('input',{...old,requestId:id(16),pageId,frameId:'F'.repeat(43),events:[{type:'text',text:'old'}]}));
 assert.equal(f.calls.filter(([kind])=>kind==='input').length,0);
});
test('removed pages and caller-selected identifiers cannot reach native capture',async t=>{
 const f=await fixture(t),lease=await f.connect(),read=await f.execute('read');f.closePage();
 await assert.rejects(f.execute('frame',{...lease,requestId:id(12),pageId:read.pages[0].pageId}));
 await assert.rejects(f.execute('frame',{...lease,requestId:id(12),pageId:id(99)}));assert.equal(f.calls.length,0);
});
test('return control and expired authority prohibit subsequent device input',async t=>{
 const f=await fixture(t),lease=await f.connect();
 await f.execute('release',{...lease,requestId:id(12)});
 assert.equal((await f.execute('read')).state,'returning');
 await assert.rejects(f.execute('frame',{...lease,requestId:id(13),pageId:id(99)}));
 f.expire();await assert.rejects(f.execute('read'),/AUTHORITY/u);
});
test('a lost viewer heartbeat ends the lease and keeps the run paused',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=await fixture(t);await f.connect();t.mock.timers.tick(VIEWER_DISCONNECT_MS+1);
 assert.equal((await f.execute('read')).state,'returning');assert.deepEqual(f.calls,[['end','viewer-disconnect']]);
});
