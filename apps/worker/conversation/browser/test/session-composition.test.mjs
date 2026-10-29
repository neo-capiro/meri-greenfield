/** Source composition only. Scripted page/host ports are not native sandbox or IdP qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPinnedBrowserSession} from '../session/connection.mjs';
import {createBrowserSessionHost} from '../../host/browser-session-host.mjs';
import {enabledPolicy,binding,installation} from './fixtures.mjs';
const cwd='/workspace/'+binding.conversationId;
import {validateBrowserPolicy} from '../policy.mjs';
import {playwrightServerConfig} from '../server.mjs';
import {browserPaths} from '../workspace.mjs';
import {siteWorkflowPolicy} from '../site-workflows/manifest.mjs';
import {workflowCurrent,workflowManifest} from '../../../../../packages/contracts/test/site-workflow.fixture.mjs';
function fixture(t,options={}){
 const state={fields:[],text:'- heading "Public page"',url:'https://records.example/page?token=hidden#secret',calls:0,events:[],refused:false,hold:'APPLIED'};
 const frame={locator(){return {async evaluateAll(){return structuredClone(state.fields);}};}};
 const page={url:()=>state.url,frames:()=>[frame],async ariaSnapshot(){await options.capture?.(state);return state.text;}};
 const context={pages:()=>[page],async close(){state.events.push('context');}};
 const upstream={version:'0.0.83',async createConnection(config,getContext){
  assert.equal(await getContext(),context);assert.equal(config.webmcp,false);assert.equal(config.imageResponses,'omit');
  let transport;return {async connect(value){transport=value;transport.onmessage=async message=>{
   if(!Object.hasOwn(message,'id'))return;let result={};
   if(message.method==='initialize')result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'pinned',version:'0.0.83'}};
   if(message.method==='tools/list')result={tools:[{name:'browser_snapshot'},{name:'browser_evaluate'}]};
   if(message.method==='tools/call'){state.calls++;await options.invoke?.(state);result={content:[{type:'text',text:'RAW SECRET ERROR/CONSOLE'},{type:'image',data:'secret'}]};}
   await transport.send({jsonrpc:'2.0',id:message.id,result});
  };},async close(){await transport.close();}};}};
 const args={context,upstream,policy:validateBrowserPolicy(enabledPolicy()),manifest:null,now:Date.now,deadlineMs:Date.now()+60000,
  current:async()=>{if(state.refused)throw Error('revoked');},hold:async()=>({outcome:state.hold}),
  ports:{async waitForExit(){state.events.push('exit');return {exited:options.exited!==false};},async dispose(){state.events.push('dispose');return {disposed:true};}}};
 return {state,args,context,upstream};
}
const secret=value=>({kind:'field',label:'Password',type:'password',autocomplete:'current-password',selectorMatch:false,value});
const call=(session,id='one')=>session.call({requestId:id,tool:'browser_snapshot',args:{}});

test('scripted upstream connection has one execution boundary; only current filtered snapshots leave it',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 assert.deepEqual(await session.tools(),[{name:'browser_snapshot'}]);
 const result=JSON.stringify(await call(session));
 assert.match(result,/Public page/);assert.doesNotMatch(result,/RAW SECRET|hidden|secret|token=/);
 assert.equal(x.state.calls,1);await assert.rejects(call(session),/BROWSER_CALL_REFUSED/);assert.equal(x.state.calls,1);
});
test('credential values and reflected text stay private after a field disappears',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 x.state.fields=[secret('CANARY-CREDENTIAL')];x.state.text='CANARY-CREDENTIAL';
 assert.doesNotMatch(JSON.stringify(await call(session)),/CANARY-CREDENTIAL/);
 x.state.fields=[];assert.doesNotMatch(JSON.stringify(await call(session,'two')),/CANARY-CREDENTIAL/);
});
test('takeover requires applied canonical hold and explicit filtered hand-back; stale input is refused',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 x.state.hold='UNKNOWN';await assert.rejects(session.takeover(),/HOLD_NOT_APPLIED/);
 x.state.hold='APPLIED';
 await assert.rejects(call(session),/BROWSER_CALL_REFUSED/);assert.equal(x.state.calls,0);
 // The native hold port now resolves the original hold, permitting one lease.
 assert.equal((await session.takeover()).leaseEpoch,1);
});
test('user relay values are masked on resume and a released lease cannot send input',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 const lease=await session.takeover();let inputs=0;
 await session.userInput({...lease,perform:async()=>{inputs++;x.state.fields=[{...secret('POST-LEASE-VALUE'),type:'text',autocomplete:''}];x.state.text='POST-LEASE-VALUE';}});
 session.handBack();await assert.rejects(session.userInput({...lease,perform:async()=>{inputs++;}}),/STALE_LEASE/);
 await assert.rejects(session.resume({explicit:false}),/RESUME_REFUSED/);
 const response=await session.resume({explicit:true});assert.doesNotMatch(JSON.stringify(response),/POST-LEASE-VALUE/);
 assert.equal(inputs,1);assert.equal(session.state().state,'agent');
});
test('unknown in-flight outcome closes admission and destroys context before verified disposal',async t=>{
 const controller=new AbortController(),x=fixture(t,{invoke:()=>new Promise(()=>{})}),session=await createPinnedBrowserSession(x.args);
 const pending=session.call({requestId:'unknown',tool:'browser_snapshot',args:{},signal:controller.signal});
 while(x.state.calls===0)await new Promise(resolve=>setImmediate(resolve));controller.abort();
 await assert.rejects(pending,/BROWSER_ACTION_OUTCOME_UNKNOWN/);await assert.rejects(call(session,'next'),/SESSION_ENDING/);
 await session.destroy({trigger:'disconnect'});assert.deepEqual(x.state.events,['context','exit','dispose']);
});
test('a missing process absence proof preserves the profile and prevents reuse',async t=>{
 const x=fixture(t,{exited:false}),session=await createPinnedBrowserSession(x.args);
 await assert.rejects(session.destroy({trigger:'disconnect'}),/DISPOSE_INCOMPLETE/);
 assert.deepEqual(x.state.events,['context','exit']);await assert.rejects(call(session),/SESSION_ENDING/);
});
test('source revocation blocks page dispatch',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 x.state.refused=true;await assert.rejects(call(session),/BROWSER_CALL_REFUSED/);assert.equal(x.state.calls,0);
 await session.destroy({trigger:'revocation'});assert.deepEqual(x.state.events,['context','exit','dispose']);
});

test('revocation during preflight snapshot is rechecked before dispatch and destroys state',async t=>{
 const x=fixture(t,{capture:state=>{state.refused=true;}}),session=await createPinnedBrowserSession(x.args);
 await assert.rejects(call(session),/BROWSER_CALL_REFUSED/);assert.equal(x.state.calls,0);
 await session.destroy({trigger:'revocation'});assert.deepEqual(x.state.events,['context','exit','dispose']);
});

test('resume is cancelled while capture is pending and cannot release a late snapshot',async t=>{
 let capture,started=false,release;
 const waiting=new Promise(resolve=>{release=resolve;}),x=fixture(t,{capture:()=>capture?.()}),session=await createPinnedBrowserSession(x.args);
 t.after(()=>session.destroy({trigger:'conversation-end'}));
 await session.takeover();session.handBack();capture=()=>{started=true;return waiting;};
 const controller=new AbortController(),resume=session.resume({explicit:true,signal:controller.signal});
 while(!started)await new Promise(resolve=>setImmediate(resolve));controller.abort();
 await assert.rejects(resume,/CANCELLED/);release();assert.equal(session.state().state,'returning');
});

function hostedWorkflow(t,{resolver=true,widen=false}={}){
 const x=fixture(t),policy=widen?x.args.policy:siteWorkflowPolicy(x.args.policy,workflowManifest);
 const state={answer:workflowCurrent(),reads:0,created:0,model:null,user:null};
 const host=createBrowserSessionHost({binding,cwd,installation,upstream:x.upstream,now:Date.now,
  contexts:{async create(){state.created++;return x.context;}},current:x.args.current,hold:x.args.hold,
  ...(resolver?{siteWorkflows:{async resolve(request){assert.deepEqual(request.binding,binding);state.reads++;return state.answer;}}}:{}),
  processes:{waitForExit:x.args.ports.waitForExit},dispose:x.args.ports.dispose,
  relay:{async bind(port){state.model=port;return {mcpServers:{meri_browser:playwrightServerConfig(policy,installation,browserPaths(cwd))},async close(){}};}},
  controls:{async bind(port){state.user=port.controls;return {async close(){}};}}});
 return {...x,native:x.state,state,host,open:()=>host.open({binding,policy,deadlineMs:Date.now()+60000,manifest:workflowManifest})};
}

test('host refuses workflow creation without its canonical current resolver or with wider policy',async t=>{
 for(const options of [{resolver:false},{widen:true}]){
  const x=hostedWorkflow(t,options);await assert.rejects(x.open(),/BROWSER_WORKFLOW_(CURRENT_REQUIRED|POLICY_REFUSED)/);assert.equal(x.state.created,0);
 }
});

test('host rechecks the exact configured task at model execution and refuses a same-version manifest change',async t=>{
 const x=hostedWorkflow(t),session=await x.open();t.after(()=>session.destroy({trigger:'conversation-end'}));
 await call(x.state.model);const before=x.state.reads;
 x.state.answer.manifest.taskSummary='Changed synthetic task';
 await assert.rejects(call(x.state.model,'changed'),/BROWSER_CALL_REFUSED/);assert.ok(x.state.reads>before);
 assert.equal(x.native.calls,1);assert.equal(x.state.created,1);
 await session.destroy({trigger:'revocation'});assert.deepEqual(x.native.events,['context','exit','dispose']);
});

test('host workflow disablement denies takeover and leased user input without invoking it',async t=>{
 for(const leased of [false,true]){
  const x=hostedWorkflow(t),session=await x.open();t.after(()=>session.destroy({trigger:'conversation-end'}));
  const lease=leased?await x.state.user.takeover():null;
  x.state.answer.enabled=false;let performed=false;
  await assert.rejects(leased?x.state.user.userInput({...lease,perform:async()=>{performed=true;}}):x.state.user.takeover(),/BROWSER_(AUTHORITY_REFUSED|USER_INPUT_UNKNOWN)/);
  assert.equal(performed,false);await session.destroy({trigger:'revocation'});
 }
});

test('host workflow disablement at hand-back prevents resume',async t=>{
 const x=hostedWorkflow(t),session=await x.open();t.after(()=>session.destroy({trigger:'conversation-end'}));
 await x.state.user.takeover();x.state.user.handBack();x.state.answer.enabled=false;
 await assert.rejects(x.state.user.resume({explicit:true}),/BROWSER_AUTHORITY_REFUSED/);
 await session.destroy({trigger:'revocation'});
});
test('takeover drains an already-dispatched definite result without releasing it to the model',async t=>{
 let release;const wait=new Promise(resolve=>{release=resolve;}),x=fixture(t,{invoke:()=>wait}),session=await createPinnedBrowserSession(x.args);
 t.after(()=>session.destroy({trigger:'conversation-end'}));
 const result=call(session);const rejected=assert.rejects(result,/BROWSER_CALL_REFUSED/);
 while(x.state.calls===0)await new Promise(resolve=>setImmediate(resolve));
 const lease=session.takeover();await new Promise(resolve=>setImmediate(resolve));assert.equal(session.state().state,'fencing');
 release();await rejected;assert.equal((await lease).leaseEpoch,1);assert.equal(session.state().state,'user');
});
test('TTL expiry destroys context and refuses subsequent dispatch without an automatic relaunch',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession({...x.args,deadlineMs:Date.now()+30});
 await new Promise(resolve=>setTimeout(resolve,60));await session.destroy({trigger:'ttl-expiry'});
 assert.deepEqual(x.state.events,['context','exit','dispose']);await assert.rejects(call(session),/SESSION_ENDING/);
});
test('host composition binds separate model/control relays to the existing exact native shim and tears both down',async t=>{
 const x=fixture(t),events=[],policy=x.args.policy;
 const expected={meri_browser:playwrightServerConfig(policy,installation,browserPaths(cwd))};
 const host=createBrowserSessionHost({binding,cwd,installation,upstream:x.upstream,now:Date.now,
  contexts:{async create(){events.push('create');return x.context;}},current:x.args.current,hold:x.args.hold,
  processes:{waitForExit:x.args.ports.waitForExit},dispose:x.args.ports.dispose,
  relay:{async bind(port){assert.equal(typeof port.call,'function');assert.equal(typeof port.tools,'function');events.push('model');return {mcpServers:expected,async close(){events.push('model-close');}};}},
  controls:{async bind(port){assert.equal(typeof port.controls.takeover,'function');assert.equal(port.controls.call,undefined);events.push('user');return {async close(){events.push('user-close');}};}}});
 const session=await host.open({binding,policy,deadlineMs:Date.now()+60000,manifest:null});
 assert.deepEqual(session.mcpServers,expected);await session.destroy({trigger:'conversation-end'});
 assert.deepEqual(events,['create','model','user','model-close','user-close']);assert.deepEqual(x.state.events,['context','exit','dispose']);
 await assert.rejects(host.open({binding,policy,deadlineMs:Date.now()+60000,manifest:null}),/BINDING_REFUSED/);
});
