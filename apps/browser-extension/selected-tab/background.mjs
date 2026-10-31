import {createSelectedTabBridge} from './bridge.mjs';
const patterns=chrome.runtime.getManifest().externally_connectable.matches;
const origins=patterns.map(pattern=>{
 const url=new URL(pattern);if(url.protocol!=='https:'||url.hostname.includes('*')||url.pathname!=='/*')throw Error('Invalid app origin');return url.origin;
});
const bridge=createSelectedTabBridge(chrome,{origins});
chrome.runtime.onConnectExternal.addListener(port=>bridge.connect(port));
chrome.tabs.onActivated.addListener(()=>bridge.selectionChanged());
chrome.tabs.onUpdated.addListener((id,change)=>bridge.tabChanged(id,change));
chrome.tabs.onRemoved.addListener(id=>bridge.tabClosed(id));
chrome.runtime.onConnect.addListener(port=>{
 if(port.name!=='selected-tab-popup'||port.sender?.id!==chrome.runtime.id||port.sender?.url!==chrome.runtime.getURL('popup.html')){port.disconnect();return;}
 const send=view=>{try{port.postMessage({type:'view',view});}catch{}};
 const unsubscribe=bridge.subscribe(send);send(bridge.view());
 port.onMessage.addListener(async message=>{
  if(!message||Object.keys(message).length!==1||!['approve','pause','revoke','capture','share'].includes(message.action))return;
  // The bridge serializes capture/share and invalidates their epoch on pause or
  // revoke. A popup mutex must not discard those controls while a read awaits.
  try{await bridge[message.action]();}catch{try{port.postMessage({type:'error',message:'This selection is unavailable. Capture the current tab again or reconnect.'});}catch{}}
 });
 port.onDisconnect.addListener(unsubscribe);
});
