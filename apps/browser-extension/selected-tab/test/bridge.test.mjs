import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSelectedTabBridge} from '../bridge.mjs';
import {SELECTED_TAB_SCHEMA as schema,receiveSelectedTabMessage} from '../contract.mjs';
const origin='https://portfolio-preview.app.capiro.ai';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function event(){const listeners=new Set();return {addListener:fn=>listeners.add(fn),emit:value=>{for(const fn of listeners)fn(value);}};}
function fixture(){
 let now=1000,active={id:2,active:true,url:'https://example.invalid/page?q=private#section'},documentId=randomUUID(),readHook=null;
 const calls=[],timers=new Map(),port={sender:{origin,url:origin+'/meri',frameId:0,documentId:randomUUID(),tab:{id:1}},
  onMessage:event(),onDisconnect:event(),sent:[],closed:false,
  postMessage(raw){this.sent.push(JSON.parse(raw));},disconnect(){if(!this.closed){this.closed=true;this.onDisconnect.emit();}}};
 let window={id:4,type:'normal'};
 const chrome={windows:{getLastFocused:async args=>{calls.push(['window',args]);return window;}},tabs:{query:async args=>{calls.push(['query',args]);return [active];}},scripting:{executeScript:async args=>{
  calls.push(['script',args]);if(readHook)await readHook(args);
  return [{frameId:0,documentId,result:args.target.documentIds?active.url:{url:'https://example.invalid/page',title:'Synthetic page',text:'Visible synthetic text'}}];
 }}};
 const bridge=createSelectedTabBridge(chrome,{origins:[origin],now:()=>now,setTimer:(fn,ms)=>{const key=randomUUID();timers.set(key,{fn,ms});return key;},clearTimer:key=>timers.delete(key)});
 const pair={schema,type:'pair',pairingId:randomUUID(),binding:{tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),clientId:null},
  labels:{account:'Test account',conversation:'Test chat'},expiresAtMs:601000};
 const send=async value=>{port.onMessage.emit(JSON.stringify(value));await tick();};
 const connect=async()=>{assert.equal(bridge.connect(port),true);await send(pair);};
 const ready=async()=>{await connect();bridge.approve();};
 return {bridge,port,pair,calls,timers,send,connect,ready,clock:value=>{now=value;},active:value=>{active=value;},document:value=>{documentId=value;},window:value=>{window=value;},hook:fn=>{readHook=fn;}};
}
test('pairing requires explicit popup approval and binds native origin/frame/document',async()=>{
 const f=fixture();await f.connect();assert.equal(f.bridge.view().state,'connected');await assert.rejects(f.bridge.capture(),/NOT_ACTIVE/u);
 f.bridge.approve();await f.bridge.capture();assert.equal(f.bridge.view().selection.text,'Visible synthetic text');
 const calls=f.calls.filter(([name])=>name==='script');assert.deepEqual(calls[0][1].target,{tabId:2,frameIds:[0]});assert.equal(calls[0][1].world,'ISOLATED');
 assert.deepEqual(calls[1][1].target,{tabId:2,documentIds:[calls[1][1].target.documentIds[0]]});f.bridge.dispose();
});
test('native Chrome token form remains exact at final document check',async()=>{
 const f=fixture(),token='CD'.repeat(16);f.port.sender.documentId='AB'.repeat(16);f.document(token);
 await f.ready();await f.bridge.capture();await f.bridge.share();
 assert.equal(f.port.sent.find(m=>m.type==='share').documentId,token);
 assert.equal(f.calls.filter(([name,args])=>name==='script'&&args.target.documentIds).every(([,args])=>args.target.documentIds[0]===token),true);f.bridge.dispose();
});
test('selection ignores popup focus and refuses an unavailable ordinary window before reading',async()=>{
 const f=fixture();await f.ready();await f.bridge.capture();
 assert.deepEqual(f.calls.filter(([name])=>name==='window').map(([,args])=>args),[{windowTypes:['normal']},{windowTypes:['normal']}]);
 assert.equal(f.calls.filter(([name])=>name==='query').every(([,args])=>args.active===true&&args.windowId===4&&!('lastFocusedWindow' in args)),true);f.bridge.dispose();
 for(const window of [null,{id:-1,type:'normal'},{id:4,type:'popup'}]){
  const g=fixture();g.window(window);await g.ready();await assert.rejects(g.bridge.capture(),/TAB_UNAVAILABLE/);
  assert.equal(g.calls.some(([name])=>name==='script'),false);g.bridge.dispose();
 }
});
test('wrong origin, subframe, missing document and external extension are refused before reading',()=>{
 for(const mutation of [{origin:'https://evil.invalid'}, {frameId:2}, {documentId:undefined}, {id:'other-extension'}, {url:'https://evil.invalid/'}]){
  const f=fixture();Object.assign(f.port.sender,mutation);assert.equal(f.bridge.connect(f.port),false);assert.equal(f.port.closed,true);assert.equal(f.calls.length,0);
 }
});
test('one recipient owns the connection; a second port cannot silently replace it',async()=>{
 const f=fixture(),other=fixture();await f.ready();assert.equal(f.bridge.connect(other.port),false);assert.equal(f.bridge.view().state,'active');f.bridge.dispose();
});
test('share consumes one exact selection; lost acknowledgement never replays it',async()=>{
 const f=fixture();await f.ready();await f.bridge.capture();await f.bridge.share();
 const shares=f.port.sent.filter(m=>m.type==='share');assert.equal(shares.length,1);
 const received=await receiveSelectedTabMessage('extension',JSON.stringify(shares[0]));assert.deepEqual(received.binding,f.pair.binding);
 assert.equal(received.url,'https://example.invalid/page');assert.equal(f.bridge.view().selection,null);assert.equal(f.bridge.view().outcome,'unknown');
 await assert.rejects(f.bridge.share(),/CAPTURE_REQUIRED/u);await assert.rejects(f.bridge.capture(),/CHECK_PREVIOUS_SHARE/u);
 await f.send({schema,type:'outcome',pairingId:f.pair.pairingId,selectionId:received.selectionId,state:'stored',requestId:randomUUID()});
 assert.equal(f.bridge.view().outcome,'stored');await f.bridge.capture();f.bridge.dispose();
});
test('pause, revoke, expiry and recipient navigation erase a pending capture',async()=>{
 for(const operation of ['pause','revoke','expiry','navigation']){
  const f=fixture();await f.ready();await f.bridge.capture();
  if(operation==='pause')await f.send({schema,type:'pause',pairingId:f.pair.pairingId});
  if(operation==='revoke')f.bridge.revoke();
  if(operation==='expiry'){f.clock(601001);await assert.rejects(f.bridge.share(),/EXPIRED/u);}
  if(operation==='navigation')f.bridge.tabChanged(1,{status:'loading'});
  assert.equal(f.bridge.view().selection,null);await assert.rejects(f.bridge.share());f.bridge.dispose();
 }
});
test('tab selection, same-origin navigation and close invalidate captured input',async()=>{
 for(const change of ['selection','navigation','close']){
  const f=fixture();await f.ready();await f.bridge.capture();
  if(change==='selection')f.bridge.selectionChanged();if(change==='navigation')f.bridge.tabChanged(2,{url:'https://example.invalid/new'});if(change==='close')f.bridge.tabClosed(2);
  await assert.rejects(f.bridge.share(),/CAPTURE_REQUIRED/u);assert.equal(f.port.sent.filter(m=>m.type==='share').length,0);f.bridge.dispose();
 }
});
test('a late capture result after pause cannot reappear',async()=>{
 const f=fixture();await f.ready();let entered,release;const reached=new Promise(r=>{entered=r;}),hold=new Promise(r=>{release=r;});
 f.hook(async()=>{entered();await hold;});const pending=f.bridge.capture();await reached;f.bridge.pause();release();
 await assert.rejects(pending,/NOT_ACTIVE/u);assert.equal(f.bridge.view().selection,null);f.bridge.dispose();
});
test('final document proof and capture age are checked before bytes cross the port',async()=>{
 for(const change of ['document','age']){
  const f=fixture();await f.ready();await f.bridge.capture();if(change==='document')f.document(randomUUID());else f.clock(61001);
  await assert.rejects(f.bridge.share(),/CHANGED|EXPIRED/u);assert.equal(f.port.sent.filter(m=>m.type==='share').length,0);f.bridge.dispose();
 }
});
test('changing account/chat on an existing port revokes it instead of inheriting consent',async()=>{
 const f=fixture();await f.ready();await f.send({...f.pair,binding:{...f.pair.binding,actorId:randomUUID()}});
 assert.equal(f.port.closed,true);assert.equal(f.bridge.view().state,'revoked');assert.equal(f.bridge.view().labels,null);
});
test('expired/overlong pairing and malformed commands do not retain data',async()=>{
 for(const expiresAtMs of [999,601001]){const f=fixture();f.pair.expiresAtMs=expiresAtMs;await f.connect();assert.equal(f.port.closed,true);}
 const f=fixture();await f.ready();f.port.onMessage.emit({type:'capture'});await tick();assert.equal(f.port.closed,true);
});
test('disconnect during share is never retried and status failure terminates without recursion',async()=>{
 const f=fixture();await f.ready();await f.bridge.capture();let count=0;
 f.port.postMessage=()=>{count++;throw Error('port disconnected');};await assert.rejects(f.bridge.share());assert.equal(count,1);
 f.bridge.pause();assert.equal(f.bridge.view().state,'disconnected');assert.equal(f.port.closed,true);
});
test('republished outcomes for settled attachments do not revoke a later capture or share',async()=>{
 const f=fixture();await f.ready();await f.bridge.capture();await f.bridge.share();
 const first=f.port.sent.find(m=>m.type==='share');
 const outcome={schema,type:'outcome',pairingId:f.pair.pairingId,selectionId:first.selectionId,state:'stored',requestId:randomUUID()};
 await f.send(outcome);await f.bridge.capture();await f.send(outcome);
 assert.equal(f.bridge.view().state,'active');assert.ok(f.bridge.view().selection);
 await f.bridge.share();await f.send(outcome);
 assert.equal(f.bridge.view().state,'active');assert.equal(f.bridge.view().outcome,'unknown');
 await assert.rejects(f.bridge.capture(),/CHECK_PREVIOUS_SHARE/u);
 const second=f.port.sent.filter(m=>m.type==='share')[1];
 await f.send({...outcome,selectionId:second.selectionId,requestId:randomUUID()});
 assert.equal(f.bridge.view().outcome,'stored');assert.equal(f.port.sent.filter(m=>m.type==='share').length,2);
 await f.send({...outcome,selectionId:randomUUID()});assert.equal(f.bridge.view().state,'revoked');f.bridge.dispose();
});
test('worker recreation restores neither consent, capture nor an unknown share',async()=>{
 const before=fixture();await before.ready();await before.bridge.capture();await before.bridge.share();
 assert.equal(before.bridge.view().outcome,'unknown');before.bridge.dispose();
 const after=fixture();assert.equal(after.bridge.view().state,'disconnected');
 assert.equal(after.bridge.view().selection,null);assert.equal(after.bridge.view().outcome,null);
 await assert.rejects(after.bridge.share(),/PAIRING_EXPIRED/u);assert.equal(after.calls.length,0);
 await after.connect();await assert.rejects(after.bridge.capture(),/NOT_ACTIVE/u);
 assert.equal(after.port.sent.filter(m=>m.type==='share').length,0);
 after.bridge.approve();await after.bridge.capture();assert.ok(after.bridge.view().selection);after.bridge.dispose();
});
