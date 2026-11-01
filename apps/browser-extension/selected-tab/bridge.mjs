import {SELECTED_TAB_SCHEMA as schema,SELECTED_TAB_LIMITS as limits,receiveSelectedTabMessage,createSelectedTabShare} from './contract.mjs';
import {captureRenderedText} from './capture.mjs';
// Native Chrome document tokens are compared exactly, never normalized into a
// different ID before the final document-targeted permission check.
const documentId=v=>typeof v==='string'&&/^(?:[0-9A-Fa-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u.test(v);
const webUrl=value=>{const u=new URL(value);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('TAB_UNAVAILABLE');return u;};

/** Every bridge refusal the popup may show, one fixed sentence each; an unknown error keeps the generic text. */
export const SELECTED_TAB_ERROR_TEXTS=Object.freeze({
 PAIRING_NOT_ACTIVE:'This chat has not allowed sharing yet. Allow it in the popup first.',
 PAIRING_NOT_WAITING:'Nothing is waiting for approval right now.',
 PAIRING_EXPIRED:'The connection to Capiro expired. Reconnect from Capiro.',
 CHECK_PREVIOUS_SHARE:'Check the previous share\'s upload status in Capiro before capturing again.',
 CAPTURE_REQUIRED:'Capture the current tab before sharing.',
 CAPTURE_EXPIRED:'The capture is too old. Capture the current tab again.',
 SELECTION_CHANGED:'The selected tab changed. Capture the current tab again.',
 SELECT_SOURCE_TAB:'Select the tab you want to share, not the Capiro tab.',
 TAB_UNAVAILABLE:'The current tab cannot be shared (no ordinary window, loading, discarded or not a web page).',
 PAGE_UNAVAILABLE:'This page cannot be read (no document body or not a web page).',
 PAGE_LIMIT:'This page is too large to share. Share a smaller page.',
 CAPTURE_UNAVAILABLE:'The page could not be read. Reload the tab and capture again.',
 SHARE_NOT_SENT:'The share could not be sent; the connection to Capiro was lost. Reconnect from Capiro.',
});
export const describeSelectedTabError=error=>SELECTED_TAB_ERROR_TEXTS[error?.message]??'This selection is unavailable. Capture the current tab again or reconnect.';

/** Native Chrome ports establish origin/document identity. The receiving app's
 * current conversation owner, never these labels, authorizes the eventual upload. */
export function createSelectedTabBridge(chrome,{origins,now=Date.now,newId=()=>crypto.randomUUID(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 const deviceId=newId(),listeners=new Set();let peer=null,pair=null,state='disconnected',selection=null,transfer=null;
 // Correlation only, never receipts or captured bytes. The app republishes its
 // earlier attachment outcomes when any upload changes in the same pairing.
 const settledSelections=new Set();
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
  status(false);peer=null;pair=null;transfer=null;settledSelections.clear();old?.port.disconnect();changed();
 }
 function assertActive(){if(!current()){end('expired');throw Error('PAIRING_EXPIRED');}if(state!=='active')throw Error('PAIRING_NOT_ACTIVE');}
 function assertAttempt(token){assertActive();if(token!==epoch)throw Error('SELECTION_CHANGED');}
 function connect(port){
  let origin;try{
   const s=port.sender,u=new URL(s?.url);
   if(s.id||s.frameId!==0||!documentId(s.documentId)||!Number.isSafeInteger(s.tab?.id)||s.origin!==u.origin||!origins.includes(u.origin)||u.protocol!=='https:'||u.username||u.password)throw Error();
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
    if(settledSelections.has(message.selectionId))return;
    if(!transfer||message.selectionId!==transfer.selectionId)throw Error('UNKNOWN_SELECTION');
    if(transfer.state!=='stored')transfer={selectionId:transfer.selectionId,state:message.state};changed();
   }
  // A changed account/chat on the same port revokes the earlier consent; any other protocol failure from the
  // app (invalid message, invalid pairing, unknown selection) is a lost connection, not a user revocation.
  }).catch(error=>{if(peer===candidate)end(error?.message==='PAIRING_CHANGED'?'revoked':'disconnected');});});
  port.onDisconnect.addListener(()=>{if(peer===candidate){peer=null;end('disconnected');}});
  changed();return true;
 }
 function approve(){if(!current()){end('expired');throw Error('PAIRING_EXPIRED');}if(!['connected','paused'].includes(state))throw Error('PAIRING_NOT_WAITING');clearSelection();state='active';status();changed();}
 function pause(){if(!peer)return;clearSelection();state='paused';status();changed();}
 async function selectedTab(){
  // The action popup can become the last focused window. Scope selection to
  // the last ordinary browser window, then retain all activeTab/document checks.
  const window=await chrome.windows.getLastFocused({windowTypes:['normal']});
  if(!Number.isSafeInteger(window?.id)||window.id<0||window.type!=='normal')throw Error('TAB_UNAVAILABLE');
  const tabs=await chrome.tabs.query({active:true,windowId:window.id});
  if(tabs.length!==1||!Number.isSafeInteger(tabs[0].id)||!tabs[0].active||tabs[0].discarded||tabs[0].pendingUrl)throw Error('TAB_UNAVAILABLE');
  webUrl(tabs[0].url);if(tabs[0].id===peer?.tabId)throw Error('SELECT_SOURCE_TAB');return tabs[0];}
 async function stillSelected(tabId,documentId,rawUrl,token){
  const tab=await selectedTab();assertAttempt(token);if(tab.id!==tabId||tab.url!==rawUrl)throw Error('SELECTION_CHANGED');
  const rows=await chrome.scripting.executeScript({target:{tabId,documentIds:[documentId]},world:'ISOLATED',func:()=>location.href});
  assertAttempt(token);if(rows.length!==1||rows[0].frameId!==0||rows[0].documentId!==documentId||rows[0].result!==rawUrl)throw Error('SELECTION_CHANGED');
 }
 async function capture(){
  assertActive();if(busy||transfer?.state==='unknown')throw Error('CHECK_PREVIOUS_SHARE');clearSelection();busy=true;changed();
  const token=epoch,bound=pair,capturedAtMs=now();
  try{
   const tab=await selectedTab();assertAttempt(token);targetTab=tab.id;
   const rows=await chrome.scripting.executeScript({target:{tabId:tab.id,frameIds:[0]},world:'ISOLATED',func:captureRenderedText});
   assertAttempt(token);if(rows.length!==1||rows[0].frameId!==0||!documentId(rows[0].documentId))throw Error('CAPTURE_UNAVAILABLE');
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
   if(transfer){
    settledSelections.add(transfer.selectionId);
    // The application admits at most eight shares per pairing. Bound retained
    // correlation even if a future consumer has a different lifetime policy.
    if(settledSelections.size>8)settledSelections.delete(settledSelections.values().next().value);
   }
   selection=null;transfer={selectionId:chosen.packet.selectionId,state:'unknown'};
   // A synchronous port failure means the share was never handed to Chrome: nothing was sent, so this is a
   // lost connection, never a share whose acknowledgement is pending.
   try{peer.port.postMessage(JSON.stringify(chosen.packet));}
   catch{const broken=peer;peer=null;end('disconnected');broken.port.disconnect();throw Error('SHARE_NOT_SENT');}
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
