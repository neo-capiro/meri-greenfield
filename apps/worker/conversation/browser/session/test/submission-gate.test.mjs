/** The network submission gate over a scripted Playwright context: which requests continue, which wait for the user and
 * which never leave the browser. The real-Chromium case is submission-gate.browser.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionGate} from '../submission-gate.mjs';
import {validateBrowserPolicy,DEFAULT_BROWSER_POLICY} from '../../policy.mjs';

const policy=validateBrowserPolicy({...DEFAULT_BROWSER_POLICY,deniedHosts:['capiro.ai']});
function harness({approve=async()=>true,user=false}={}){
 let handler;const asked=[],state={user};
 const context={async route(pattern,fn){assert.equal(pattern,'**/*');handler=fn;},async unroute(){handler=undefined;}};
 const page={url:()=>'https://shop.example/checkout'};
 const send=(method,url,{type='fetch'}={})=>new Promise(resolve=>{
  const route={fallback:async()=>resolve('sent'),abort:async reason=>{assert.equal(reason,'blockedbyclient');resolve('aborted');}};
  const request={method:()=>method,url:()=>url,resourceType:()=>type,frame:()=>({page:()=>page})};
  handler(route,request);
 });
 return {context,send,asked,state,approve:async input=>{asked.push(input);return approve(input);},routed:()=>handler!==undefined};
}
const gateFor=async h=>createSubmissionGate({context:h.context,policy,approve:h.approve,userDriving:()=>h.state.user});

test('reads always continue; a mutating request outside an agent action never leaves the browser',async()=>{
 const h=harness(),gate=await gateFor(h);
 for(const method of ['GET','HEAD','OPTIONS'])assert.equal(await h.send(method,'https://shop.example/a'),'sent');
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(await h.send(method,'https://shop.example/a'),'aborted',method);
 assert.deepEqual(h.asked,[],'nobody is asked when no action is running');
 await gate.close();assert.equal(h.routed(),false);
});

test('during an action each method and destination host is asked once; an approval releases, a refusal aborts and is reported',async()=>{
 const h=harness({approve:async({host})=>host==='shop.example'}),gate=await gateFor(h),signal=new AbortController().signal;
 const action=gate.begin({requestId:'a'.repeat(64),tool:'browser_click',signal});
 const sends=[h.send('POST','https://shop.example/api/order'),h.send('POST','https://shop.example/api/order?again'),
  h.send('POST','https://pay.example/charge',{type:'document'}),h.send('GET','https://pay.example/receipt')];
 assert.deepEqual(await Promise.all(sends),['sent','sent','aborted','sent']);
 assert.deepEqual(h.asked.map(({method,host,path,pageOrigin,tool})=>({method,host,path,pageOrigin,tool})),[
  {method:'POST',host:'shop.example',path:'/api/order',pageOrigin:'https://shop.example',tool:'browser_click'},
  {method:'POST',host:'pay.example',path:'/charge',pageOrigin:'https://shop.example',tool:'browser_click'}]);
 assert.notEqual(h.asked[0].requestKey,h.asked[1].requestKey,'every question is its own approval subject');
 assert.deepEqual(await action.settled(),{asked:true,declined:['POST pay.example']});
 action.end();
 assert.equal(await h.send('POST','https://shop.example/api/order'),'aborted','the action ended: its approval does not carry over');
});

test('a structurally approved submission covers its own page host; telemetry and denied or private destinations are aborted unasked',async()=>{
 const h=harness(),gate=await gateFor(h);
 const action=gate.begin({requestId:'b'.repeat(64),tool:'browser_click',coveredHost:'shop.example',signal:new AbortController().signal});
 assert.equal(await h.send('POST','https://shop.example/form'),'sent');
 assert.equal(await h.send('POST','https://shop.example/beacon',{type:'ping'}),'aborted');
 assert.equal(await h.send('POST','https://app.capiro.ai/api'),'aborted');
 assert.equal(await h.send('POST','http://10.0.0.1/admin'),'aborted');
 assert.deepEqual(h.asked,[]);
 assert.deepEqual(await action.settled(),{asked:false,declined:[]});action.end();
});

test('while the user holds the browser their own submissions continue; a takeover or session end withdraws an open question',async()=>{
 const h=harness({user:true}),gate=await gateFor(h);
 assert.equal(await h.send('POST','https://shop.example/login'),'sent');assert.deepEqual(h.asked,[]);
 h.state.user=false;
 // An unanswered question that is withdrawn (takeover interrupt, or the session closing) aborts the held request.
 for(const withdraw of [g=>g.interrupt(),g=>g.close()]){
  let release;const waiting=new Promise(resolve=>{release=resolve;});
  const slow=harness({approve:({signal})=>new Promise(resolve=>{signal.addEventListener('abort',()=>resolve(false),{once:true});release();})});
  const g=await gateFor(slow);
  g.begin({requestId:'c'.repeat(64),tool:'browser_click',signal:new AbortController().signal});
  const held=slow.send('POST','https://shop.example/order');await waiting;
  await withdraw(g);assert.equal(await held,'aborted');await g.close();
 }
 await gate.close();
});

test('one action at a time; the configuration is closed',async()=>{
 const gate=await gateFor(harness());
 gate.begin({requestId:'e'.repeat(64),tool:'browser_click',signal:new AbortController().signal});
 assert.throws(()=>gate.begin({requestId:'f'.repeat(64),tool:'browser_click',signal:new AbortController().signal}),{code:'BROWSER_SESSION_BUSY'});
 await assert.rejects(createSubmissionGate({context:{},policy,approve:async()=>true,userDriving:()=>false}),{code:'BROWSER_CONFIGURATION'});
 await assert.rejects(createSubmissionGate({context:harness().context,policy,userDriving:()=>false}),{code:'BROWSER_CONFIGURATION'});
});
