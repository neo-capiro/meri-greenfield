import {SELECTED_TAB_SCHEMA as schema,SELECTED_TAB_LIMITS as limits,receiveSelectedTabMessage,createSelectedTabShare} from './contract.mjs';
import {captureRenderedText} from './capture.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f-]{36}$/u.test(v);
const webUrl=value=>{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('TAB_UNAVAILABLE');return u;};

/** Native Chrome ports establish origin/document identity. The receiving app's
 * current conversation owner, never these labels, authorizes the eventual upload. */
export function createSelectedTabBridge(chrome,{origins,now=Date.now,newId=()=>crypto.randomUUID(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const deviceId=newId(),listeners=new Set();let peer=null,pair=null,state='disconnected',selection=null,transfer=null;
 let epoch=0,timer=null,busy=false,targetTab=null;
 const view=()=>Object.freeze({state,busy,origin:peer?.origin??null,labels:pair?.labels??null,expiresAtMs:pair?.expiresAtMs??null,
  selection:selection?{title:selection.packet.title,url:selection.packet.url,text:selection.packet.text,bytes:selection.packet.bytes}:null,
  outcome:transfer?.state??null});
 const changed=()=>{for(const listener of listeners)listener(view());};
 const current=()=>peer&&pair&&pair.expiresAtMs>now();
 function status(closeOnFailure=true){if(peer&&pair)try{peer.port.postMessage(JSON.stringify({schema,type:'status',pairingId:pair.pairingId,deviceId,state}));}catch{if(closeOnFailure)end('disconnected');}}
 function clearSelection(){epoch++;selection=null;targetTab=null;busy=false;}
 function end(next){
  const old=peer;clearSelection();state=next;clearTimer(timer);timer=null;
  status(false);peer=null;pair=null;transfer=null;old?.port.disconnect();changed();
 }
 function assertActive(){if(!current()){end('expired');throw Error('PAIRING_EXPIRED');}if(state!=='active')throw Error('PAIRING_NOT_ACTIVE');}
 function assertAttempt(token){assertActive();if(token!==epoch)throw Error('SELECTION_CHANGED');}
 function connect(port){
  let origin;try{
   const s=port.sender,u=new URL(s?.url);
   if(s.id||s.frameId!==0||!uuid(s.documentId)||!Number.isSafeInteger(s.tab?.id)||s.origin!==u.origin||!origins.includes(u.origin)||u.protocol!=='https:'||u.username||u.password)throw Error();
   if(peer)throw Error();origin=u.origin;
  }catch{port.disconnect();return false;}
  const candidate={port,origin,tabId:port.sender.tab.id,documentId:port.sender.documentId};peer=candidate;
  timer=setTimer(()=>{if(peer===candidate)end('expired');},30000);
  let chain=Promise.resolve();
  port.onMessage.addListener(raw=>{chain=chain.then(async()=>{
   const message=await receiveSelectedTabMessage('application',raw);if(peer!==candidate)return;
   if(!pair){
    if(message.type!=='pair'||message.expiresAtMs<=now()||message.expiresAtMs-now()>limits.pairingMs)throw Error('PAIRING_INVALID');
    pair=message;state='connected';clearTimer(timer);timer=setTimer(()=>end('expired'),pair.expiresAtMs-now());status();changed();return;
   }
   if(message.pairingId!==pair.pairingId||message.type==='pair')throw Error('PAIRING_CHANGED');
   if(message.type==='revoke'){end('revoked');return;}
   if(!current()){end('expired');return;}
   if(message.type==='pause'){pause();return;}
   if(message.type==='outcome'){
    if(!transfer||message.selectionId!==transfer.selectionId)throw Error('UNKNOWN_SELECTION');
    if(transfer.state!=='stored')transfer={selectionId:transfer.selectionId,state:message.state};changed();
   }
  }).catch(()=>{if(peer===candidate)end('revoked');});});
  port.onDisconnect.addListener(()=>{if(peer===candidate){peer=null;end('disconnected');}});
  changed();return true;
 }
 function approve(){if(!current()){end('expired');throw Error('PAIRING_EXPIRED');}if(!['connected','paused'].includes(state))throw Error('PAIRING_NOT_WAITING');clearSelection();state='active';status();changed();}
 function pause(){if(!peer)return;clearSelection();state='paused';status();changed();}
 async function selectedTab(){const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if(tabs.length!==1||!Number.isSafeInteger(tabs[0].id)||!tabs[0].active||tabs[0].discarded||tabs[0].pendingUrl)throw Error('TAB_UNAVAILABLE');
  webUrl(tabs[0].url);if(tabs[0].id===peer?.tabId)throw Error('SELECT_SOURCE_TAB');return tabs[0];}
 async function stillSelected(tabId,documentId,rawUrl,token){
  const tab=await selectedTab();assertAttempt(token);if(tab.id!==tabId||tab.url!==rawUrl)throw Error('SELECTION_CHANGED');
  const rows=await chrome.scripting.executeScript({target:{tabId,documentIds:[documentId]},world:'ISOLATED',func:()=>location.href});
  assertAttempt(token);if(rows.length!==1||rows[0].frameId!==0||rows[0].documentId!==documentId||rows[0].result!==rawUrl)throw Error('SELECTION_CHANGED');
 }
 async function capture(){
  assertActive();if(busy||transfer?.state==='unknown')throw Error('CHECK_PREVIOUS_SHARE');clearSelection();transfer=null;busy=true;changed();
  const token=epoch,bound=pair,capturedAtMs=now();
  try{
   const tab=await selectedTab();assertAttempt(token);targetTab=tab.id;
   const rows=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'ISOLATED',func:captureRenderedText});
   assertAttempt(token);if(rows.length!==1||rows[0].frameId!==0||!uuid(rows[0].documentId))throw Error('CAPTURE_UNAVAILABLE');
   const captured=rows[0],snapshot=captured.result;
   const address=webUrl(tab.url);address.search='';address.hash='';if(snapshot?.url!==address.href)throw Error('SELECTION_CHANGED');
   const packet=await createSelectedTabShare({schema,type:'share',pairingId:bound.pairingId,deviceId,selectionId:newId(),binding:bound.binding,
    tabId:tab.id,documentId:captured.documentId,url:snapshot.url,title:snapshot.title,text:snapshot.text,capturedAtMs});
   await stillSelected(tab.id,captured.documentId,tab.url,token);
   if(now()-capturedAtMs>=limits.captureMs)throw Error('CAPTURE_EXPIRED');
   selection={packet,rawUrl:tab.url,token};
  }finally{if(token===epoch){busy=false;changed();}}
 }
 async function share(){
  assertActive();if(busy||!selection)throw Error('CAPTURE_REQUIRED');
  const chosen=selection,token=epoch;busy=true;changed();
  try{
   await stillSelected(chosen.packet.tabId,chosen.packet.documentId,chosen.rawUrl,token);
   if(now()-chosen.packet.capturedAtMs>=limits.captureMs)throw Error('CAPTURE_EXPIRED');
   // Spend before crossing the port. Lost acknowledgement is UNKNOWN, never a
   // reason to send the original again. The app's upload status owns recovery.
   selection=null;transfer={selectionId:chosen.packet.selectionId,state:'unknown'};
   peer.port.postMessage(JSON.stringify(chosen.packet));
  }finally{if(token===epoch){selection=null;busy=false;changed();}}
 }
 function tabChanged(tabId,change){
  if(peer?.tabId===tabId&&(change.status==='loading'||change.url)){end('disconnected');return;}
  if(targetTab===tabId&&(change.status==='loading'||change.url)){clearSelection();changed();}
 }
 return Object.freeze({connect,approve,pause,capture,share,revoke:()=>end('revoked'),view,
  subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
  selectionChanged:()=>{if(selection||busy){clearSelection();changed();}},
  tabChanged,tabClosed:id=>{if(peer?.tabId===id)end('disconnected');else if(targetTab===id){clearSelection();changed();}},
  dispose:()=>{end('disconnected');listeners.clear();}});
}
