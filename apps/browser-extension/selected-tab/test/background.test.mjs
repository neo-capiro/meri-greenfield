import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SELECTED_TAB_SCHEMA as schema} from '../contract.mjs';

function event(){const listeners=[];return {addListener:fn=>listeners.push(fn),emit:value=>{for(const fn of listeners)fn(value);}};}
function port(name,sender){return {name,sender,onMessage:event(),onDisconnect:event(),sent:[],closed:false,
 postMessage(value){this.sent.push(value);},disconnect(){if(!this.closed){this.closed=true;this.onDisconnect.emit();}}};}
async function until(check){for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}assert.ok(check(),'Expected state was not reached');}

for(const action of ['pause','revoke'])test(`popup ${action} invalidates an outstanding capture immediately`,async()=>{
 const origin='https://portfolio-preview.app.capiro.ai',extensionId='a'.repeat(32),documentId=randomUUID();
 let release,entered=false;const pending=new Promise(resolve=>{release=resolve;});
 const chrome={runtime:{id:extensionId,getURL:path=>`chrome-extension://${extensionId}/${path}`,
  getManifest:()=>({externally_connectable:{matches:[origin+'/*']}}),onConnect:event(),onConnectExternal:event()},
  tabs:{onActivated:event(),onUpdated:event(),onRemoved:event(),query:async()=>[{id:2,active:true,url:'https://example.invalid/page'}]},
  windows:{getLastFocused:async()=>({id:1,type:'normal'})},scripting:{executeScript:async()=>{entered=true;await pending;
   return [{frameId:0,documentId,result:{url:'https://example.invalid/page',title:'Fixture',text:'Visible text'}}];}}};
 const external=port(schema,{origin,url:origin+'/meri',frameId:0,documentId:randomUUID(),tab:{id:1}});
 const popup=port('selected-tab-popup',{id:extensionId,url:chrome.runtime.getURL('popup.html')});
 const view=()=>popup.sent.filter(m=>m.type==='view').at(-1)?.view;
 const previous=globalThis.chrome;globalThis.chrome=chrome;
 try{
  await import(new URL(`../background.mjs?fixture=${randomUUID()}`,import.meta.url));
  chrome.runtime.onConnectExternal.emit(external);chrome.runtime.onConnect.emit(popup);
  external.onMessage.emit(JSON.stringify({schema,type:'pair',pairingId:randomUUID(),
   binding:{tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),clientId:null},
   labels:{account:'Fixture account',conversation:'Fixture conversation'},expiresAtMs:Date.now()+60000}));
  await until(()=>view()?.state==='connected');popup.onMessage.emit({action:'approve'});await until(()=>view()?.state==='active');
  popup.onMessage.emit({action:'capture'});await until(()=>entered);
  popup.onMessage.emit({action});
  await until(()=>view()?.state===(action==='pause'?'paused':'revoked'));
  release();await new Promise(r=>setTimeout(r,10));
  assert.equal(view().selection,null);assert.equal(view().busy,false);
  assert.equal(external.sent.map(raw=>JSON.parse(raw)).filter(m=>m.type==='share').length,0);
 }finally{release();external.disconnect();globalThis.chrome=previous;}
});
