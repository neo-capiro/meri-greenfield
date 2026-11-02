/** The network submission gate against REAL Chromium: a script-driven submit (a `type=button` whose handler posts with
 * fetch, or calls requestSubmit) is invisible to the structural classifier but is held by the gate until the user
 * decides; a declined request never reaches the server. Needs a playwright-core root with its Chromium installed
 * (MERI_PINNED_PLAYWRIGHT_ROOT, as session-native.browser.test.mjs); it does not run on a host without it and is not
 * evidence about the deployed image. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSubmissionGate} from '../submission-gate.mjs';
import {classifyInteraction} from '../interaction-classifier.mjs';
import {validateBrowserPolicy,DEFAULT_BROWSER_POLICY} from '../../policy.mjs';
const root=process.env.MERI_PINNED_PLAYWRIGHT_ROOT;
if(!root)throw Error('MERI_PINNED_PLAYWRIGHT_ROOT is required for native qualification');
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert.equal(pkg.name,'playwright-core');
const {chromium}=await import(pathToFileURL(join(root,'index.mjs')));
const HTML=`<!doctype html><title>Shop</title>
<form id="order" method="post" action="/order"><input name="item" value="book"></form>
<button id="fetch" type="button" onclick="fetch('/api/charge',{method:'POST',body:'amount=10'}).catch(()=>{})">Pay</button>
<button id="submit" type="button" onclick="document.getElementById('order').requestSubmit()">Order</button>`;

test(`script-driven submits are held at the network in real Chromium (playwright-core ${pkg.version})`,{timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext(),received=[],asked=[];
 try{
  // The synthetic origin is served by an earlier route; the gate's released requests fall back to it.
  await context.route('https://shop.example/**',route=>{const r=route.request();received.push(`${r.method()} ${new URL(r.url()).pathname}`);
   return route.fulfill({contentType:'text/html; charset=utf-8',body:HTML});});
  let answer=false;
  const gate=await createSubmissionGate({context,policy:validateBrowserPolicy(DEFAULT_BROWSER_POLICY),userDriving:()=>false,
   approve:async q=>{asked.push(`${q.method} ${q.host} ${q.path}`);return answer;}});
  const page=await context.newPage();await page.goto('https://shop.example/');
  // The structural classifier sees an ordinary button and would run the click without a question.
  const ref=/\[ref=([a-z0-9]+)\]/u.exec((await page.ariaSnapshot({mode:'ai'})).split('\n').find(line=>line.includes('"Pay"')))[1];
  assert.equal(await classifyInteraction({tool:'browser_click',input:{ref},pages:[page]}),'routine');
  // Declined: the POST never reaches the server.
  let action=gate.begin({requestId:'a'.repeat(64),tool:'browser_click',signal:new AbortController().signal});
  await page.click('#fetch');await page.waitForTimeout(300);
  assert.deepEqual(await action.settled(),{asked:true,declined:['POST shop.example']});action.end();
  assert.deepEqual(received,['GET /']);
  // Approved: the requestSubmit navigation reaches the server.
  answer=true;action=gate.begin({requestId:'b'.repeat(64),tool:'browser_click',signal:new AbortController().signal});
  await Promise.all([page.waitForURL('https://shop.example/order'),page.click('#submit')]);
  assert.deepEqual(await action.settled(),{asked:true,declined:[]});action.end();
  assert.deepEqual(received,['GET /','POST /order']);
  // Outside an agent action, a page-initiated POST is aborted without a question.
  const before=asked.length;
  await page.evaluate(()=>fetch('/api/charge',{method:'POST',body:'x'}).then(()=>'sent',()=>'blocked')).then(outcome=>assert.equal(outcome,'blocked'));
  assert.equal(asked.length,before);assert.deepEqual(received,['GET /','POST /order']);
  assert.deepEqual(asked,['POST shop.example /api/charge','POST shop.example /order']);
  await gate.close();
 }finally{await browser.close();}
});
