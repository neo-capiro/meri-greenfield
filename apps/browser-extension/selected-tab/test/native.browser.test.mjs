/** Actual unpacked MV3 extension, browser-assigned identities and toolbar grant.
 * All pages/recipient outcomes are synthetic; no account or upload service is contacted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {receiveSelectedTabMessage,selectedTabOriginal} from '../contract.mjs';
const {chromium}=await import(process.env.SELECTED_TAB_PLAYWRIGHT_MODULE??'playwright');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Extension popups are native targets outside Playwright's ordinary page list. */
async function popupOn(cdp,extensionId,targetId){
 await cdp.send('Extensions.triggerAction',{id:extensionId,targetId});
 let popup;for(let n=0;n<100&&!popup;n++){
  popup=(await cdp.send('Target.getTargets',{filter:[{}]})).targetInfos.find(t=>t.type==='page'&&t.url===`chrome-extension://${extensionId}/popup.html`);
  if(!popup)await delay(50);
 }assert.ok(popup,'Native extension popup');
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId:popup.targetId,flatten:false});let serial=0;const pending=new Map();
 cdp.on('Target.receivedMessageFromTarget',packet=>{
  if(packet.sessionId!==sessionId)return;const value=JSON.parse(packet.message),slot=pending.get(value.id);
  if(slot){pending.delete(value.id);value.error?slot.reject(Error(value.error.message)):slot.resolve(value.result);}
 });
 async function send(method,params={}){
  const id=++serial,result=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));
  await cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})});return result;
 }
 async function evaluate(expression){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw Error('Popup evaluation refused');return result.result.value;
 }
 async function waitFor(expression){for(let n=0;n<100;n++){if(await evaluate(expression))return;await delay(50);}throw Error('Popup condition timed out: '+expression);}
 return {send,evaluate,waitFor};
}

test('native selected tab: explicit permission, exact document identity, consumed share, navigation and worker restart', {timeout:60000}, async()=>{
 const parent=process.env.SELECTED_TAB_NATIVE_WORKDIR??tmpdir();await mkdir(parent,{recursive:true});
 const root=await mkdtemp(join(parent,'selected-tab-native-')),extension=fileURLToPath(new URL('../',import.meta.url));
 const context=await chromium.launchPersistentContext(join(root,'profile'),{channel:'chromium',headless:true,
  args:['--enable-unsafe-extension-debugging',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  const sw=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker',{timeout:15000}),extensionId=new URL(sw.url()).hostname;
  const browser=context.browser(),cdp=await browser.newBrowserCDPSession();
  const manifest=await sw.evaluate(()=>chrome.runtime.getManifest());assert.deepEqual(manifest.permissions,['activeTab','scripting']);
  await context.route('https://portfolio-preview.app.capiro.ai/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic recipient</title><h1>Isolated recipient</h1>'}));
  await context.route('https://source.synthetic.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic source</title><h1>Visible heading</h1><p>Visible public passage Café 日本語</p><form>PRIVATE FORM<input value="PRIVATE FIELD"></form><p hidden>PRIVATE HIDDEN</p><iframe srcdoc="PRIVATE FRAME"></iframe>'}));
  const app=await context.newPage();await app.goto('https://portfolio-preview.app.capiro.ai/isolated-qualification');
  const pair={schema:'meri.selected-tab/1',type:'pair',pairingId:randomUUID(),binding:{tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),clientId:null},
   labels:{account:'Synthetic local account',conversation:'Synthetic local chat'},expiresAtMs:Date.now()+600000};
  const connect=()=>app.evaluate(({extensionId,pair})=>{
   window.received=[];window.disconnected=false;window.connection=chrome.runtime.connect(extensionId,{name:'meri.selected-tab/1'});
   window.connection.onMessage.addListener(value=>window.received.push(JSON.parse(value)));window.connection.onDisconnect.addListener(()=>{void chrome.runtime.lastError;window.disconnected=true;});
   window.connection.postMessage(JSON.stringify(pair));
  },{extensionId,pair});
  await connect();await app.waitForFunction(()=>window.received.some(x=>x.type==='status'&&x.state==='connected'));
  const source=await context.newPage();await source.goto('https://source.synthetic.invalid/article?secret=PRIVATE_QUERY#PRIVATE_FRAGMENT');await source.bringToFront();
  assert.equal(await source.evaluate(()=>typeof chrome.runtime?.connect),'undefined','Unlisted origin cannot connect externally');
  const permissionRefused=await sw.evaluate(async()=>{
   const [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});try{await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.title});return false;}catch{return true;}
  });assert.equal(permissionRefused,true,'No read before native toolbar grant');
  const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab',exclude:false}]}),target=targetInfos.find(t=>t.type==='tab'&&t.url===source.url());assert.ok(target);
  const popup=await popupOn(cdp,extensionId,target.targetId),{evaluate,waitFor}=popup;
  await waitFor("document.getElementById('approve') && !document.getElementById('approve').hidden");
  assert.equal(await evaluate("document.getElementById('capture').hidden"),true);
  await evaluate("document.getElementById('approve').click()");await waitFor("!document.getElementById('capture').hidden");
  await evaluate("document.getElementById('capture').click()");await waitFor("!document.getElementById('preview').hidden || document.getElementById('error').textContent.length > 0");
  assert.equal(await evaluate("document.getElementById('error').textContent"),'');
  const text=await evaluate("document.getElementById('text').textContent");assert.match(text,/Visible public passage/);assert.doesNotMatch(text,/PRIVATE/);
  await writeFile(join(root,'popup-preview.png'),Buffer.from((await popup.send('Page.captureScreenshot')).data,'base64'));
  await evaluate("document.getElementById('share').click()");await app.waitForFunction(()=>window.received.some(x=>x.type==='share'));
  const shares=await app.evaluate(()=>window.received.filter(x=>x.type==='share'));assert.equal(shares.length,1);
  const share=await receiveSelectedTabMessage('extension',JSON.stringify(shares[0]));assert.deepEqual(share.binding,pair.binding);
  assert.equal(share.url,'https://source.synthetic.invalid/article');assert.doesNotMatch(JSON.stringify(share),/PRIVATE/);assert.ok(selectedTabOriginal(share).byteLength);
  await waitFor("document.getElementById('capture').disabled");
  await app.evaluate(({pair,share})=>window.connection.postMessage(JSON.stringify({schema:pair.schema,type:'outcome',pairingId:pair.pairingId,selectionId:share.selectionId,state:'stored',requestId:crypto.randomUUID()})),{pair,share});
  await waitFor("!document.getElementById('capture').disabled");await evaluate("document.getElementById('capture').click()");await waitFor("!document.getElementById('preview').hidden");
  await source.goto('https://source.synthetic.invalid/next');await waitFor("document.getElementById('preview').hidden");
  assert.equal(await evaluate("document.getElementById('text').textContent"),'');
  await evaluate("document.getElementById('share').click()");await waitFor("document.getElementById('error').textContent.length > 0");
  assert.equal(await app.evaluate(()=>window.received.filter(x=>x.type==='share').length),1);
  const workerControl=await context.newCDPSession(app);await workerControl.send('ServiceWorker.enable');
  await workerControl.send('ServiceWorker.stopAllWorkers');await app.waitForFunction(()=>window.disconnected);
  await connect();await app.waitForFunction(()=>window.received.some(x=>x.type==='status'&&x.state==='connected'));
  assert.equal(await app.evaluate(()=>window.received.some(x=>x.state==='active'||x.type==='share')),false,'Reload requires new consent and retains no capture');
  await writeFile(join(root,'result.json'),JSON.stringify({browser:browser.version(),nativeExtensionLoaded:true,nativeExternalPort:true,unlistedOriginRefused:true,readBeforeActionRefused:true,
   realActionPermission:true,filteredCapture:true,oneShare:true,unknownBlocksRecapture:true,navigationErasesCapture:true,restartRequiresConsent:true,
   scope:'Isolated native extension and synthetic recipient; no production authenticated upload.'},null,2)+'\n');
 }finally{await context.close();}
});
