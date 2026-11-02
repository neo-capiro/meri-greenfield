/** Interaction classification against REAL pinned Chromium: the `aria-ref` locator resolves the refs Playwright's AI
 * snapshot assigns, the inspection runs in the utility world, and a hostile page cannot relabel its form. Needs the
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
<form id="search"><input id="q" type="search"></form><a id="link" href="https://records.example/">Records</a>
<script>Object.defineProperty(HTMLInputElement.prototype,'type',{get(){return 'text';}});HTMLElement.prototype.closest=function(){return null;};</script>`;
/** `[ref=eN]` tokens from the AI snapshot, keyed by the accessible name on the same line. */
function refsByName(snapshot){
 const out={};
 for(const line of snapshot.split('\n')){const ref=/\[ref=([a-z0-9]+)\]/u.exec(line);const name=/"([^"]+)"/u.exec(line);if(ref&&name)out[name[1]]=ref[1];}
 return out;
}
test('refs resolve in real Chromium and the pristine utility world ignores page-world prototype tampering',{timeout:30000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();
 try{
  const page=await context.newPage();
  await page.route('https://records.example/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:HTML}));
  await page.goto('https://records.example/login');
  const refs=refsByName(await page._snapshotForAI());
  for(const name of ['Password','Sign in','Help','Go','Submit from outside','Records'])assert.ok(refs[name],`ref for ${name} in ${JSON.stringify(refs)}`);
  const at=(tool,ref,extra={})=>classifyInteraction({tool,input:{ref,...extra},pages:[page]});
  assert.equal(await at('browser_type',refs.Password,{text:'x'}),'credential','page-world type getter cannot hide a password field');
  assert.equal(await at('browser_type',refs.User??refs.Password,{text:'x'}),'credential','the owning login form has a credential field');
  assert.equal(await at('browser_click',refs['Sign in']),'submission');
  assert.equal(await at('browser_click',refs.Help),'routine');
  assert.equal(await at('browser_click',refs.Go),'submission','an invalid type defaults to submit');
  assert.equal(await at('browser_click',refs['Submit from outside']),'submission','form= owner outside the form, page-world closest() tampering ignored');
  assert.equal(await at('browser_click',refs.Records),'routine');
  assert.equal(await at('browser_click','e999'),'submission','an unknown ref asks');
 }finally{await browser.close();}
});
