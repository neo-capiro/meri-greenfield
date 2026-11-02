/** The network submission gate against REAL Chromium and a real HTTP server (synthetic hostnames mapped to loopback): a
 * script-driven submit (a `type=button` whose handler posts with fetch, or calls requestSubmit) is invisible to the
 * structural classifier but is held by the gate until the user decides; a declined request never reaches the server;
 * an approved send that the site redirects (307/308, which re-send the body) to another host is never followed, for
 * fetch and for a form navigation. Needs a playwright-core root with its Chromium installed (MERI_PINNED_PLAYWRIGHT_ROOT,
 * as session-native.browser.test.mjs); it does not run on a host without it and is not evidence about the deployed image. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
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
<form id="moved" method="post" action="/r307?to=bank.example"><input name="amount" value="10"></form>
<button id="fetch" type="button" onclick="fetch('/api/charge',{method:'POST',body:'amount=10'}).catch(()=>{})">Pay</button>
<button id="submit" type="button" onclick="document.getElementById('order').requestSubmit()">Order</button>`;

test(`script-driven submits and their redirects are held at the network in real Chromium (playwright-core ${pkg.version})`,{timeout:90000},async()=>{
 const received=[];
 const server=http.createServer((req,res)=>{const host=(req.headers.host||'').split(':')[0],u=new URL(req.url,'http://x');
  req.resume();req.on('end',()=>{
   if(u.pathname!=='/')received.push(`${req.method} ${host}${u.pathname}`);
   if(u.pathname==='/r307'||u.pathname==='/r308'){res.writeHead(u.pathname==='/r307'?307:308,{Location:`http://${u.searchParams.get('to')}:${port}/sink`});return res.end();}
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','access-control-allow-origin':'*'});res.end(u.pathname==='/'?HTML:'<!doctype html>ok');});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port,origin=`http://shop.example:${port}`;
 const browser=await chromium.launch({headless:true,args:['--host-resolver-rules=MAP *.example 127.0.0.1']});
 const context=await browser.newContext(),asked=[];
 try{
  let answer=false;
  const gate=await createSubmissionGate({context,policy:validateBrowserPolicy(DEFAULT_BROWSER_POLICY),userDriving:()=>false,
   approve:async q=>{asked.push(`${q.method} ${q.host} ${q.path}`);return answer;}});
  const page=await context.newPage();await page.goto(origin+'/');
  const act=id=>gate.begin({requestId:id.repeat(64),tool:'browser_click',signal:new AbortController().signal});
  // The structural classifier sees an ordinary button and would run the click without a question.
  const ref=/\[ref=([a-z0-9]+)\]/u.exec((await page.ariaSnapshot({mode:'ai'})).split('\n').find(line=>line.includes('"Pay"')))[1];
  assert.equal(await classifyInteraction({tool:'browser_click',input:{ref},pages:[page]}),'routine');
  // Declined: the POST never reaches the server.
  let action=act('a');await page.click('#fetch');await page.waitForTimeout(300);
  assert.deepEqual(await action.settled(),{asked:true,declined:['POST shop.example'],refused:[]});action.end();
  assert.deepEqual(received,[]);
  // Approved: the requestSubmit navigation reaches the server.
  answer=true;action=act('b');
  await Promise.all([page.waitForURL(`${origin}/order`),page.click('#submit')]);
  assert.deepEqual(await action.settled(),{asked:true,declined:[],refused:[]});action.end();
  assert.deepEqual(received,['POST shop.example/order']);await page.goto(origin+'/');
  // Approved for shop.example, redirected to bank.example: neither a fetch (307, 308) nor a form navigation follows it.
  action=act('c');
  const fetched=await page.evaluate(()=>Promise.all(['/r307?to=bank.example','/r308?to=bank.example','/r307?to=shop.example']
   .map(path=>fetch(path,{method:'POST',body:'amount=10'}).then(r=>'status:'+r.status,()=>'blocked'))));
  assert.deepEqual(fetched,['blocked','blocked','status:200'],'a same-host redirect stays inside what was approved');
  assert.deepEqual(await action.settled(),{asked:true,declined:[],refused:['POST bank.example']});action.end();
  action=act('d');await page.evaluate(()=>document.getElementById('moved').submit());await page.waitForTimeout(800);
  assert.deepEqual((await action.settled()).refused,['POST bank.example']);action.end();
  assert.equal(received.some(r=>r.startsWith('POST bank.example')),false,'the body never reached the other host');
  assert.deepEqual(received.filter(r=>r.includes('/sink')),['POST shop.example/sink']);
  // Outside an agent action, a page-initiated POST is aborted without a question.
  await page.goto(origin+'/');const before=asked.length;
  assert.equal(await page.evaluate(()=>fetch('/api/charge',{method:'POST',body:'x'}).then(()=>'sent',()=>'blocked')),'blocked');
  assert.equal(asked.length,before);
  await gate.close();
 }finally{await browser.close();server.close();}
});
