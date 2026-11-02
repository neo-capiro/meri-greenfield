/** Interaction classification against REAL pinned Chromium: the `aria-ref` locator resolves the refs Playwright's AI
 * snapshot assigns and the page function classifies them with no module scope. Needs the
 * pinned playwright-core root (MERI_PINNED_PLAYWRIGHT_ROOT), like session-native.browser.test.mjs; it does not run on a
 * host without it and is not evidence about the deployed image. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {classifyInteraction} from '../interaction-classifier.mjs';
const root=process.env.MERI_PINNED_PLAYWRIGHT_ROOT;
if(!root)throw Error('MERI_PINNED_PLAYWRIGHT_ROOT is required for native qualification');
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(pkg.name,'playwright-core');assert.equal(pkg.version,'1.64.0-alpha-1790635538000');
const {chromium}=await import(pathToFileURL(join(root,'index.mjs')));
const HTML=`<!doctype html><title>Synthetic</title>
<form id="login"><label>User <input id="user" autocomplete="username"></label><label>Password <input id="pw" type="password"></label>
<button id="submit">Sign in</button><button id="plain" type="button">Help</button><button id="odd" type="sumbit">Go</button></form>
<button id="outside" form="login">Submit from outside</button>
<form id="search"><input id="q" type="search" aria-label="Query"></form><a id="link" href="https://records.example/">Records</a>`;
/** `[ref=eN]` tokens from the AI snapshot, keyed by the accessible name on the same line. */
function refsByName(snapshot){
 const out={};
 for(const line of snapshot.split('\n')){const ref=/\[ref=([a-z0-9]+)\]/u.exec(line);const name=/"([^"]+)"/u.exec(line);if(ref&&name)out[name[1]]=ref[1];}
 return out;
}
test('refs resolve in real Chromium and ordinary, credential, submit and focused elements classify',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();
 try{
  const page=await context.newPage();
  await page.route('https://records.example/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:HTML}));
  await page.goto('https://records.example/login');
  const refs=refsByName(typeof page._snapshotForAI==='function'?await page._snapshotForAI().then(v=>typeof v==='string'?v:v.full).catch(()=>page.ariaSnapshot({mode:'ai'})):await page.ariaSnapshot({mode:'ai'}));
  for(const name of ['User','Password','Query','Sign in','Help','Go','Submit from outside','Records'])assert.ok(refs[name],`ref for ${name} in ${JSON.stringify(refs)}`);
  const at=(tool,ref,extra={})=>classifyInteraction({tool,input:{ref,...extra},pages:[page]});
  assert.equal(await at('browser_type',refs.Password,{text:'x'}),'credential');
  assert.equal(await at('browser_type',refs.Query,{text:'budget'}),'routine','an ordinary field is routine, not asked');
  assert.ok(refs.User,'ref for the username field');
  assert.equal(await at('browser_type',refs.User,{text:'x'}),'routine','the username field is not itself a credential field');
  assert.equal(await at('browser_click',refs['Sign in']),'submission');
  assert.equal(await at('browser_click',refs.Help),'routine');
  assert.equal(await at('browser_click',refs.Go),'submission','an invalid type defaults to submit');
  assert.equal(await at('browser_click',refs['Submit from outside']),'submission','form= owner outside the form');
  assert.equal(await at('browser_click',refs.Records),'routine');
  assert.equal(await at('browser_click','e999'),'submission','an unknown ref asks');
  await page.focus('#pw');assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key:'a'},pages:[page]}),'credential');
  await page.focus('#q');assert.equal(await classifyInteraction({tool:'browser_press_key',input:{key:'a'},pages:[page]}),'routine');
 }finally{await browser.close();}
});
