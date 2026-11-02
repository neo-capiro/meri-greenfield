/** The network submission gate over a scripted Playwright context and DevTools session: which requests continue, which
 * wait for the user, which are refused by policy without a question, and which redirects are never followed. The
 * real-Chromium case is submission-gate.browser.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSubmissionGate,MAX_QUESTIONS_PER_ACTION} from '../submission-gate.mjs';
import {validateBrowserPolicy,DEFAULT_BROWSER_POLICY} from '../../policy.mjs';

const policy=validateBrowserPolicy({...DEFAULT_BROWSER_POLICY,deniedHosts:['capiro.ai']});
function harness({approve=async()=>true,user=false,origin='https://shop.example/checkout'}={}){
 let handler,paused;const asked=[],state={user},sent=[],cdpState={enabled:null,detached:false};
 const cdp={on(event,fn){assert.equal(event,'Fetch.requestPaused');paused=fn;},
  async send(method,params){sent.push([method,params]);if(method==='Fetch.enable')cdpState.enabled=params;},async detach(){cdpState.detached=true;}};
 const context={async route(pattern,fn){assert.equal(pattern,'**/*');handler=fn;},async unroute(){handler=undefined;},
  browser:()=>({newBrowserCDPSession:async()=>cdp})};
 const page={url:()=>origin};
 const send=(method,url,{type='fetch',frame=()=>({page:()=>page})}={})=>new Promise(resolve=>{
  const route={fallback:async()=>resolve('sent'),abort:async reason=>{assert.equal(reason,'blockedbyclient');resolve('aborted');}};
  handler(route,{method:()=>method,url:()=>url,resourceType:()=>type,frame});
 });
 /** One response-stage pause of the browser-level redirect watch: 'failed' (not followed) or 'continued'. */
 const respond=async(method,url,status,location)=>{const before=sent.length;
  await paused({requestId:'r1',request:{method,url},responseStatusCode:status,responseHeaders:location?[{name:'Location',value:location}]:[]});
  const [command]=sent.slice(before).at(-1);return command==='Fetch.failRequest'?'failed':'continued';};
 return {context,send,respond,asked,state,cdpState,approve:async input=>{asked.push(input);return approve(input);},routed:()=>handler!==undefined};
}
const gateFor=async h=>createSubmissionGate({context:h.context,policy,approve:h.approve,userDriving:()=>h.state.user});
const begin=(gate,id='a',extra={})=>gate.begin({requestId:id.repeat(64),tool:'browser_click',signal:new AbortController().signal,...extra});

test('reads always continue; a sending request outside an agent action never leaves the browser; close removes both watches',async()=>{
 const h=harness(),gate=await gateFor(h);
 assert.deepEqual(h.cdpState.enabled.patterns.map(p=>p.requestStage),Array(6).fill('Response'));
 for(const method of ['GET','HEAD','OPTIONS'])assert.equal(await h.send(method,'https://shop.example/a'),'sent');
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(await h.send(method,'https://shop.example/a'),'aborted',method);
 assert.deepEqual(h.asked,[],'nobody is asked when no action is running');
 await gate.close();assert.equal(h.routed(),false);assert.equal(h.cdpState.detached,true);
});

test('during an action each method and destination host is asked once; an approval releases, a refusal aborts and is reported as declined',async()=>{
 const h=harness({approve:async({host})=>host==='shop.example'}),gate=await gateFor(h),action=begin(gate);
 const sends=[h.send('POST','https://shop.example/api/order'),h.send('POST','https://shop.example/api/order?again'),
  h.send('POST','https://pay.example/charge',{type:'document'}),h.send('GET','https://pay.example/receipt')];
 assert.deepEqual(await Promise.all(sends),['sent','sent','aborted','sent']);
 assert.deepEqual(h.asked.map(({method,host,path,pageOrigin,tool})=>({method,host,path,pageOrigin,tool})),[
  {method:'POST',host:'shop.example',path:'/api/order',pageOrigin:'https://shop.example',tool:'browser_click'},
  {method:'POST',host:'pay.example',path:'/charge',pageOrigin:'https://shop.example',tool:'browser_click'}]);
 assert.notEqual(h.asked[0].requestKey,h.asked[1].requestKey,'every question is its own approval subject');
 assert.deepEqual(await action.settled(),{asked:true,declined:['POST pay.example'],refused:[]});
 action.end();
 assert.equal(await h.send('POST','https://shop.example/api/order'),'aborted','the action ended: its approval does not carry over');
});

test('refused by policy without a question, and reported as such: non-standard methods, denied or private destinations, no public page, the question limit',async()=>{
 const h=harness({approve:async()=>false}),gate=await gateFor(h),action=begin(gate);
 for(const [method,url] of [['PROPFIND','https://shop.example/dav'],['X'.repeat(300),'https://shop.example/x'],['POST','https://app.capiro.ai/api'],['POST','http://10.0.0.1/admin']])
  assert.equal(await h.send(method,url),'aborted',method.slice(0,10)+' '+url);
 assert.equal(await h.send('POST','https://pop.example/form',{frame:()=>({page:()=>({url:()=>'about:blank'})})}),'aborted','a popup still at about:blank has no page to ask about');
 assert.equal(await h.send('POST','https://sw.example/x',{frame:()=>{throw Error('service worker request has no frame');}}),'aborted');
 const destinations=Array.from({length:MAX_QUESTIONS_PER_ACTION+2},(_,i)=>`https://d${i}.example/x`);
 for(const url of destinations)assert.equal(await h.send('POST',url),'aborted');
 assert.equal(h.asked.length,MAX_QUESTIONS_PER_ACTION,'only the first destinations are asked about');
 assert.equal(await h.send('POST','https://shop.example/beacon',{type:'ping'}),'aborted');
 const outcome=await action.settled();
 assert.deepEqual(outcome.declined,destinations.slice(0,MAX_QUESTIONS_PER_ACTION).map(u=>`POST ${new URL(u).hostname}`).sort());
 assert.deepEqual(outcome.refused,['POST 10.0.0.1','POST app.capiro.ai','POST d3.example','POST d4.example','POST pop.example','POST sw.example','non-standard method shop.example'],
  'telemetry stays silent; every other refusal is reported as refused by policy');
 action.end();await gate.close();
});

test('a structurally approved submission covers its own page host; a redirect of a sending request to another host is never followed',async()=>{
 const h=harness(),gate=await gateFor(h),action=begin(gate,'b',{coveredHost:'shop.example'});
 assert.equal(await h.send('POST','https://shop.example/form'),'sent');assert.deepEqual(h.asked,[]);
 // 307/308 re-send the body: to another host they fail before the browser follows them; the same host stays approved.
 assert.equal(await h.respond('POST','https://shop.example/form',307,'https://bank.example/transfer'),'failed');
 assert.equal(await h.respond('PUT','https://shop.example/form',308,'//capiro.ai/api'),'failed');
 assert.equal(await h.respond('POST','https://shop.example/form',307,'/next'),'continued');
 assert.equal(await h.respond('POST','https://shop.example/form',302,'https://bank.example/'),'continued','302/303 turn into a GET without the body');
 assert.equal(await h.respond('GET','https://shop.example/page',307,'https://other.example/'),'continued');
 assert.equal(await h.respond('POST','https://shop.example/form',200),'continued');
 assert.deepEqual((await action.settled()).refused,['POST bank.example','PUT capiro.ai']);action.end();
 h.state.user=true;assert.equal(await h.respond('POST','https://shop.example/login',307,'https://idp.example/'),'continued','the user signs in through redirects');
 await gate.close();
});

test('while the user holds the browser their own submissions continue; a takeover or session end withdraws an open question',async()=>{
 const h=harness({user:true}),gate=await gateFor(h);
 assert.equal(await h.send('POST','https://shop.example/login'),'sent');assert.deepEqual(h.asked,[]);
 // An unanswered question that is withdrawn (takeover interrupt, or the session closing) aborts the held request.
 for(const withdraw of [g=>g.interrupt(),g=>g.close()]){
  let release;const waiting=new Promise(resolve=>{release=resolve;});
  const slow=harness({approve:({signal})=>new Promise(resolve=>{signal.addEventListener('abort',()=>resolve(false),{once:true});release();})});
  const g=await gateFor(slow);begin(g,'c');
  const held=slow.send('POST','https://shop.example/order');await waiting;
  await withdraw(g);assert.equal(await held,'aborted');await g.close();
 }
 await gate.close();
});

test('one action at a time; the configuration is closed and needs the browser-level session',async()=>{
 const gate=await gateFor(harness());begin(gate,'e');
 assert.throws(()=>begin(gate,'f'),{code:'BROWSER_SESSION_BUSY'});
 await assert.rejects(createSubmissionGate({context:{},policy,approve:async()=>true,userDriving:()=>false}),{code:'BROWSER_CONFIGURATION'});
 await assert.rejects(createSubmissionGate({context:harness().context,policy,userDriving:()=>false}),{code:'BROWSER_CONFIGURATION'});
 const {browser,...withoutBrowser}=harness().context;void browser;
 await assert.rejects(createSubmissionGate({context:withoutBrowser,policy,approve:async()=>true,userDriving:()=>false}),{code:'BROWSER_CONFIGURATION'});
});
