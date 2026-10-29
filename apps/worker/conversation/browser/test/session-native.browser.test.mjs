/** Native pinned MCP/Chromium output qualification. Authority, lifecycle hold and
 * disposal ports are synthetic; this does not qualify D005 or a real account. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createPinnedBrowserSession} from '../session/connection.mjs';
const root=process.env.MERI_PINNED_PLAYWRIGHT_ROOT;
if(!root)throw Error('MERI_PINNED_PLAYWRIGHT_ROOT is required for native qualification');
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(pkg.name,'playwright-core');assert.equal(pkg.version,'1.64.0-alpha-1790635538000');
const {chromium}=await import(pathToFileURL(join(root,'index.mjs')));
const {tools}=createRequire(import.meta.url)(join(root,'lib/coreBundle.js'));
test('pinned native MCP snapshots resist hostile page prototypes and retain masks across navigation and takeover',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();let session;
 try{
  await context.route('https://records.example/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><title>Synthetic</title><h1>Public content</h1><button>Read record</button>'}));
  const page=await context.newPage();await page.goto('https://records.example/page?code=PRIVATE_URL#PRIVATE_FRAGMENT');
  let current=true,held='UNKNOWN',holdCalls=0;
  session=await createPinnedBrowserSession({upstream:{version:'0.0.83',createConnection:tools.createConnection},context,
   policy:{tools:['browser_snapshot','browser_take_screenshot'],timeouts:{actionMs:5000,navigationMs:5000}},now:Date.now,deadlineMs:Date.now()+30000,
   current:async()=>{if(!current)throw Error('Synthetic revocation');},hold:async()=>{holdCalls++;return {outcome:held};},
   ports:{waitForExit:async()=>{await browser.close();return {exited:true};},dispose:async()=>({disposed:true})}});
  const capture=async id=>JSON.stringify(await session.call({requestId:id,tool:'browser_snapshot',args:{}}));
  const first=await capture('first');assert.match(first,/Public content/);assert.doesNotMatch(first,/PRIVATE_URL|PRIVATE_FRAGMENT/);
  await page.evaluate(()=>{document.body.innerHTML='<input type="password" value="PRIVATE_PASSWORD"><p>PRIVATE_PASSWORD</p>';});
  assert.doesNotMatch(await capture('password'),/PRIVATE_PASSWORD/);
  await page.evaluate(()=>document.querySelector('input').remove());assert.doesNotMatch(await capture('removed'),/PRIVATE_PASSWORD/);
  await page.evaluate(()=>{const frame=document.createElement('iframe');frame.srcdoc='<input type="password" value="PRIVATE_FRAME"><p>PRIVATE_FRAME</p>';document.body.append(frame);});
  await page.frameLocator('iframe').locator('input').waitFor();
  await page.frames()[1].evaluate(()=>{Element.prototype.getAttribute=()=>null;Object.defineProperty(HTMLInputElement.prototype,'value',{get(){return '';}});});
  assert.doesNotMatch(await capture('hostile-frame'),/PRIVATE_FRAME/);
  await page.evaluate(()=>{
   document.body.innerHTML='<input type="password" value="PRIVATE_HOSTILE"><p>PRIVATE_HOSTILE</p>';
   const original=Element.prototype.getAttribute;
   Element.prototype.getAttribute=function(name){if(name==='type'||name==='autocomplete')return 'text';return original.call(this,name);};
   Element.prototype.matches=()=>false;Object.defineProperty(HTMLInputElement.prototype,'value',{get(){return '';}});
  });
  assert.doesNotMatch(await capture('hostile'),/PRIVATE_HOSTILE/);
  await page.goto('https://records.example/next');
  await page.evaluate(()=>document.body.append(Object.assign(document.createElement('p'),{textContent:'PRIVATE_HOSTILE PRIVATE_PASSWORD'})));
  assert.doesNotMatch(await capture('navigated'),/PRIVATE_HOSTILE|PRIVATE_PASSWORD/);
  await assert.rejects(session.takeover(),/HOLD_NOT_APPLIED/);assert.equal(holdCalls,1);
  held='APPLIED';const lease=await session.takeover();assert.equal(holdCalls,2);
  await assert.rejects(capture('fenced'),/BROWSER_CALL_REFUSED/);
  await page.evaluate(()=>{
   document.body.innerHTML='<label>Private user entry<input type="password"></label>';
   const input=document.querySelector('input');input.addEventListener('input',()=>{
    const reflected=document.createElement('p');reflected.textContent=input.value;document.body.replaceChildren(reflected);
   });input.focus();
  });
  const view=await session.view({...lease,page});
  assert.equal(view.image.mimeType,'image/png');assert.ok(Buffer.from(view.image.data,'base64').length>100);
  await session.userInput({...lease,frameId:view.frameId,page,input:{kind:'text',text:'PRIVATE_LEASE'}});
  assert.equal(await page.locator('input').count(),0,'Page removed the credential field synchronously');
  session.handBack();await assert.rejects(session.resume({explicit:false}),/RESUME_REFUSED/);
  const resumed=JSON.stringify(await session.resume({explicit:true}));assert.doesNotMatch(resumed,/PRIVATE_LEASE/);
  await assert.rejects(session.userInput({...lease,frameId:view.frameId,page,input:{kind:'key',key:'Enter'}}),/STALE_LEASE/);
  await assert.rejects(session.call({requestId:'image',tool:'browser_take_screenshot',args:{}}),/IMAGES_WITHHELD/);
  current=false;await assert.rejects(capture('revoked'),/BROWSER_CALL_REFUSED/);
 }finally{if(session)await session.destroy({trigger:'conversation-end'});else await context.close();await browser.close();}
});

test('native same-URL reload during current-authority checks cannot receive queued private input',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();let session,inputs=0,reload=false,reloaded=false;
 try{
  await context.route('https://records.example/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><label>Password<input autofocus type="password" oninput="window.nativeInputSeen()"></label>'}));
  const page=await context.newPage();await page.exposeFunction('nativeInputSeen',()=>{inputs++;});await page.goto('https://records.example/page');
  const frame=page.mainFrame(),url=page.url();
  session=await createPinnedBrowserSession({upstream:{version:'0.0.83',createConnection:tools.createConnection},context,
   policy:{tools:['browser_snapshot'],timeouts:{actionMs:5000,navigationMs:5000}},now:Date.now,deadlineMs:Date.now()+30000,
   current:async()=>{if(reload){reload=false;await page.reload();assert.equal(page.mainFrame(),frame);assert.equal(page.url(),url);reloaded=true;}},
   hold:async()=>({outcome:'APPLIED'}),ports:{waitForExit:async()=>{await browser.close();return {exited:true};},dispose:async()=>({disposed:true})}});
  const lease=await session.takeover(),view=await session.view({...lease,page});reload=true;
  await assert.rejects(session.userInput({...lease,frameId:view.frameId,page,input:{kind:'text',text:'SYNTHETIC_PRIVATE_INPUT'}}),/USER_INPUT_UNKNOWN/);
  assert.equal(reloaded,true);assert.equal(inputs,0);
 }finally{if(session)await session.destroy({trigger:'conversation-end'});else await context.close();await browser.close();}
});

test('native input refuses a displayed document after reload before admission, then accepts a fresh viewer frame',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();let session,inputs=0;
 try{
  await context.route('https://records.example/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><label>Password<input autofocus type="password" oninput="window.nativeInputSeen()"></label>'}));
  const page=await context.newPage();await page.exposeFunction('nativeInputSeen',()=>{inputs++;});await page.goto('https://records.example/page');
  session=await createPinnedBrowserSession({upstream:{version:'0.0.83',createConnection:tools.createConnection},context,
   policy:{tools:['browser_snapshot'],timeouts:{actionMs:5000,navigationMs:5000}},now:Date.now,deadlineMs:Date.now()+30000,
   current:async()=>{},hold:async()=>({outcome:'APPLIED'}),ports:{waitForExit:async()=>{await browser.close();return {exited:true};},dispose:async()=>({disposed:true})}});
  const lease=await session.takeover(),old=await session.view({...lease,page});await page.reload();
  await assert.rejects(session.userInput({...lease,frameId:old.frameId,page,input:{kind:'text',text:'DO_NOT_INJECT'}}),/FRAME_REFUSED/);
  assert.equal(inputs,0);assert.equal(session.state().state,'user');
  const fresh=await session.view({...lease,page});assert.notEqual(old.frameId,fresh.frameId);
  await session.userInput({...lease,frameId:fresh.frameId,page,input:{kind:'text',text:'SYNTHETIC_PRIVATE'}});assert.equal(inputs,1);
  session.handBack();assert.doesNotMatch(JSON.stringify(await session.resume({explicit:true})),/SYNTHETIC_PRIVATE/);
 }finally{if(session)await session.destroy({trigger:'conversation-end'});else await context.close();await browser.close();}
});
