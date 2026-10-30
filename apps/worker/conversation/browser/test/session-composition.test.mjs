/** Source composition only. Scripted page/host ports are not native sandbox or IdP qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createPinnedBrowserSession} from '../session/connection.mjs';
import {createBrowserSessionHost} from '../../host/browser-session-host.mjs';
import {enabledPolicy,binding,installation,installationFor} from './fixtures.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
const cwd='/workspace/'+binding.conversationId;
import {validateBrowserPolicy} from '../policy.mjs';
import {playwrightServerConfig} from '../server.mjs';

test('authority refusal before context attachment closes the already prepared native context port',async()=>{
 const calls=[];
 const host=createBrowserSessionHost({binding,cwd,installation,upstream:{version:'0.0.83',createConnection:async()=>{throw Error('not reached');}},now:Date.now,
  contexts:{create:async()=>{calls.push('create');},close:async()=>{calls.push('close');}},
  relay:{bind:async()=>{throw Error('not reached');}},controls:{bind:async()=>{throw Error('not reached');}},
  current:async()=>{throw Error('authority refused');},hold:async()=>{throw Error('not reached');},
  processes:{waitForExit:async()=>{calls.push('absence');}},dispose:async()=>{calls.push('dispose');}});
 await assert.rejects(host.open({binding,policy:enabledPolicy(),deadlineMs:Date.now()+10000,manifest:null}),/authority refused/);
 assert.deepEqual(calls,['close']);
});
import {browserPaths} from '../workspace.mjs';
import {siteWorkflowPolicy} from '../site-workflows/manifest.mjs';
import {workflowCurrent,workflowManifest} from '../../../../../packages/contracts/test/site-workflow.fixture.mjs';
function fixture(t,options={}){
 const state={fields:[],text:'- heading "Public page"',url:'https://records.example/page?token=hidden#secret',calls:0,events:[],refused:false,hold:'APPLIED'};
 const lifecycle=new EventEmitter(),frame={locator(){return {async evaluateAll(){return structuredClone(state.fields);}};}};
 const page={url:()=>state.url,frames:()=>[frame],mainFrame:()=>frame,isClosed:()=>false,viewportSize:()=>({width:800,height:600}),
  on:(...args)=>lifecycle.on(...args),off:(...args)=>lifecycle.off(...args),
  keyboard:{async insertText(text){await state.onInput?.(text);},async press(key){await state.onInput?.(key);}},
  async screenshot(){const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(800,16);png.writeUInt32BE(600,20);return png;},
  async ariaSnapshot(){await options.capture?.(state);return state.text;}};
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
 const now=options.now??Date.now;
 const args={context,upstream,policy:validateBrowserPolicy(enabledPolicy()),manifest:null,now,deadlineMs:now()+60000,
  current:async()=>{if(state.refused)throw Error('revoked');},hold:async()=>({outcome:state.hold}),
  ports:{async waitForExit(){state.events.push('exit');return {exited:options.exited!==false};},async dispose(){state.events.push('dispose');return {disposed:true};}}};
 return {state,args,context,upstream,page};
}
const secret=value=>({kind:'field',label:'Password',type:'password',autocomplete:'current-password',selectorMatch:false,value});
const call=(session,id='one')=>session.call({requestId:id,tool:'browser_snapshot',args:{}});
const displayed=async(session,page)=>{const lease=await session.takeover();return {...lease,frameId:(await session.view({...lease,page})).frameId};};

test('host native stdio is actually routed through current snapshot masking and closes on transport loss',async t=>{
 const x=fixture(t),incoming=new PassThrough(),outgoing=new PassThrough();let raw='';outgoing.on('data',chunk=>{raw+=chunk;});
 const host=createBrowserSessionHost({binding,cwd,installation,upstream:x.upstream,now:Date.now,
  contexts:{create:async()=>x.context},current:x.args.current,hold:x.args.hold,
  processes:{waitForExit:x.args.ports.waitForExit},dispose:x.args.ports.dispose,
  modelTransport:{readable:incoming,writable:outgoing},controls:{bind:async()=>({close:async()=>{}})}});
 const session=await host.open({binding,policy:x.args.policy,deadlineMs:Date.now()+60000,manifest:null});
 const client=new Client({name:'synthetic-model',version:'1'});
 t.after(async()=>{await session.destroy({trigger:'conversation-end'});await client.close();incoming.destroy();outgoing.destroy();});
 await client.connect(new StdioServerTransport(outgoing,incoming));
 const result=await client.callTool({name:'browser_snapshot',arguments:{}});assert.match(JSON.stringify(result),/Public page/);
 assert.doesNotMatch(raw,/RAW SECRET|hidden|token=/);assert.equal(x.state.calls,1);
 incoming.end();for(let n=0;n<50&&!x.state.events.includes('dispose');n++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.deepEqual(x.state.events,['context','exit','dispose']);
});

test('disconnect while the viewer relay is attaching cannot return a closed session or leak its late relay',async t=>{
 const x=fixture(t),incoming=new PassThrough(),outgoing=new PassThrough();let closed=0;
 t.after(()=>{incoming.destroy();outgoing.destroy();});
 const host=createBrowserSessionHost({binding,cwd,installation,upstream:x.upstream,now:Date.now,
  contexts:{create:async()=>x.context},current:x.args.current,hold:x.args.hold,
  processes:{waitForExit:x.args.ports.waitForExit},dispose:x.args.ports.dispose,
  modelTransport:{readable:incoming,writable:outgoing},controls:{async bind(){
   incoming.end();for(let n=0;n<50&&!x.state.events.includes('dispose');n++)await new Promise(resolve=>setTimeout(resolve,5));
   return {async close(){closed++;}};
  }}});
 await assert.rejects(host.open({binding,policy:x.args.policy,deadlineMs:Date.now()+60000,manifest:null}),/BROWSER_SESSION_CLOSED/);
 assert.equal(closed,1);assert.deepEqual(x.state.events,['context','exit','dispose']);
});

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
 const lease=await displayed(session,x.page);let inputs=0;
 x.state.onInput=async text=>{inputs++;x.state.fields=[{...secret(text),type:'text',autocomplete:''}];x.state.text=text;};
 await session.userInput({...lease,page:x.page,input:{kind:'text',text:'POST-LEASE-VALUE'}});
 session.handBack();await assert.rejects(session.userInput({...lease,page:x.page,input:{kind:'key',key:'Enter'}}),/STALE_LEASE/);
 await assert.rejects(session.resume({explicit:false}),/RESUME_REFUSED/);
 const response=await session.resume({explicit:true});assert.doesNotMatch(JSON.stringify(response),/POST-LEASE-VALUE/);
 assert.equal(inputs,1);assert.equal(session.state().state,'agent');
});

test('cancelled or invalid takeover admission leaves the next valid takeover available',async t=>{
 const x=fixture(t);let holds=0;x.args.hold=async()=>{holds++;return {outcome:'APPLIED'};};
 const session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 const cancelled=new AbortController();cancelled.abort();
 for(const signal of [cancelled.signal,{}]){
  await assert.rejects(session.takeover({signal}));assert.equal(session.state().state,'agent');
 }
 assert.equal(holds,0);await call(session);assert.equal(x.state.calls,1);
 const lease=await session.takeover();assert.equal(lease.leaseEpoch,1);
 assert.equal(session.state().state,'user');assert.equal(holds,1);
});
test('native input uses one per-lease event bucket and refuses a whole over-budget press before injection',async t=>{
 let clock=0,inputs=0;const x=fixture(t,{now:()=>clock}),session=await createPinnedBrowserSession(x.args);
 t.after(()=>session.destroy({trigger:'conversation-end'}));x.state.onInput=async()=>{inputs++;};
 const lease=await displayed(session,x.page),press=()=>session.userInput({...lease,page:x.page,input:{kind:'key',key:'Enter'}});
 for(let n=0;n<60;n++)await press();assert.equal(inputs,60);
 await assert.rejects(press(),/RATE_LIMITED/);assert.equal(inputs,60);assert.equal(session.state().state,'user');
 clock+=1000;for(let n=0;n<30;n++)await press();await assert.rejects(press(),/RATE_LIMITED/);assert.equal(inputs,90);
 session.handBack();await assert.rejects(press(),/STALE_LEASE/);await session.resume({explicit:true});
 const next=await displayed(session,x.page);await session.userInput({...next,page:x.page,input:{kind:'key',key:'Enter'}});assert.equal(inputs,91);
});

test('hand-back during input authority checks prevents the delayed native event',async t=>{
 let handingBack=false,inputs=0,session;const x=fixture(t,{capture:()=>{if(handingBack){handingBack=false;session.handBack();}}});
 session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 const lease=await displayed(session,x.page);x.state.onInput=async()=>{inputs++;};handingBack=true;
 await assert.rejects(session.userInput({...lease,page:x.page,input:{kind:'text',text:'Synthetic private value'}}),/USER_INPUT_UNKNOWN/);
 assert.equal(inputs,0);
});

test('invalid input cannot refresh idle control or leave admission busy after an invalid signal',async t=>{
 let clock=0,inputs=0;const x=fixture(t,{now:()=>clock});x.args.deadlineMs=700000;
 const session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 const lease=await displayed(session,x.page);x.state.onInput=async()=>{inputs++;};
 await assert.rejects(session.userInput({...lease,page:x.page,input:{kind:'key',key:'Enter'},signal:{}}));
 await session.userInput({...lease,page:x.page,input:{kind:'key',key:'Enter'}});assert.equal(inputs,1);
 clock=599999;await assert.rejects(session.userInput({...lease,page:x.page,input:{kind:'text',text:''}}));
 clock=600001;assert.equal(session.state().state,'returning');
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
test('revocation during native input preflight prevents keyboard dispatch',async t=>{
 let preflight=false,performed=false;const x=fixture(t,{capture:state=>{if(preflight)state.refused=true;}});
 const session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 const lease=await displayed(session,x.page);x.state.onInput=async()=>{performed=true;};preflight=true;
 await assert.rejects(session.userInput({...lease,page:x.page,input:{kind:'text',text:'Synthetic private value'}}),/USER_INPUT_UNKNOWN/);
 assert.equal(performed,false);
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
  const lease=leased?await displayed(x.state.user,x.page):null;
  x.state.answer.enabled=false;let performed=false;x.native.onInput=async()=>{performed=true;};
  await assert.rejects(leased?x.state.user.userInput({...lease,page:x.page,input:{kind:'key',key:'Enter'}}):x.state.user.takeover(),/BROWSER_(AUTHORITY_REFUSED|USER_INPUT_UNKNOWN)/);
  assert.equal(performed,false);await session.destroy({trigger:'revocation'});
 }
});

test('host workflow disablement at hand-back prevents resume',async t=>{
 const x=hostedWorkflow(t),session=await x.open();t.after(()=>session.destroy({trigger:'conversation-end'}));
 await x.state.user.takeover();x.state.user.handBack();x.state.answer.enabled=false;
 assert.equal(x.state.user.resume,undefined);await assert.rejects(x.state.user.prepareResume({explicit:true}),/BROWSER_AUTHORITY_REFUSED/);
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

test('resume stays fenced until the exact fresh snapshot is committed once under current authority',async t=>{
 const x=fixture(t),session=await createPinnedBrowserSession(x.args);t.after(()=>session.destroy({trigger:'conversation-end'}));
 const lease=await session.takeover();assert.equal((await session.readState()).leaseEpoch,lease.leaseEpoch);
 assert.ok((await session.readState()).leaseExpiresAtMs<=x.args.deadlineMs);session.handBack();
 await assert.rejects(session.completeResume(),/TAKEOVER_RESUME_REFUSED/);
 const snapshot=await session.prepareResume({explicit:true});assert.equal(session.state().state,'returning');
 await assert.rejects(call(session),/BROWSER_CALL_REFUSED/);
 await assert.rejects(session.completeResume({snapshot:{...snapshot}}),/TAKEOVER_RESUME_REFUSED/);
 await session.completeResume({snapshot});assert.equal(session.state().state,'agent');
 await assert.rejects(session.completeResume({snapshot}),/TAKEOVER_RESUME_REFUSED/);
});

test('host grants native user lease only after SDK absence and exact canonical APPLIED receipt',async t=>{
 const x=fixture(t),events=[],controlId='00000000-0000-4000-8000-000000000005',ownerInstanceId='00000000-0000-4000-8000-000000000006';
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
  hostId:'00000000-0000-4000-8000-000000000007',imageDigest:'sha256:'+ 'a'.repeat(64),leaseDeadlineMs:Date.now()+60000};
 let user,applied=false;
 const host=createBrowserSessionHost({binding,cwd,installation,upstream:x.upstream,now:Date.now,allocation,ownerInstanceId,
  contexts:{create:async()=>x.context},current:x.args.current,hold:async()=>({outcome:applied?'APPLIED':'PENDING'}),
  processes:{waitForExit:x.args.ports.waitForExit},dispose:x.args.ports.dispose,
  relay:{bind:async()=>({mcpServers:{meri_browser:playwrightServerConfig(x.args.policy,installation,browserPaths(cwd))},close:async()=>{events.push('model-closed');}})},
  controls:{bind:async value=>{user=value.controls;return {close:async()=>{events.push('viewer-closed');}};}},
  retirement:{prepare:async()=>{events.push('retirement-prepared');},wait:async()=>{events.push('sdk-absent');},retain:async()=>{events.push('custody-retained');}}});
 const session=await host.open({binding,policy:x.args.policy,deadlineMs:Date.now()+50000,manifest:null});t.after(()=>session.destroy({trigger:'conversation-end'}));
 await session.prepareTakeover({controlId});assert.equal((await user.readState()).state,'drained');
 const custody=await session.captureTakeover({controlId});assert.deepEqual(events,['retirement-prepared','sdk-absent']);
 assert.equal(custody.ownerInstanceId,ownerInstanceId);assert.equal((await user.readState()).state,'drained');
 applied=true;const receipt={controlId,intent:'takeover.begin',sourceBinding:binding,inputSha256:'b'.repeat(64),state:'APPLIED',checkpointId:binding.runId,
  targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};
 assert.equal((await session.retainTakeover({receipt})).retained,true);assert.equal((await user.readState()).state,'user');
 assert.equal((await user.readState()).leaseEpoch,custody.leaseEpoch);
 assert.equal((await session.retainTakeover({receipt})).retained,true);assert.equal(events.filter(x=>x==='custody-retained').length,1);
 const [returned,replayed]=await Promise.all([host.prepareResume({binding,custody}),host.prepareResume({binding,custody})]);assert.equal(returned,replayed);assert.equal(returned.ownerInstanceId,ownerInstanceId);assert.equal(returned.leaseEpoch,2);assert.match(returned.snapshotSha256,/^[a-f0-9]{64}$/u);
 assert.deepEqual(await host.prepareResume({binding,custody}),returned);assert.equal((await user.readState()).state,'returning');
 await assert.rejects(host.prepareResume({binding:{...binding,writerFence:2},custody}),/BROWSER_CUSTODY_REFUSED/);
});

test('canonical successive handoffs retain one context and filter while replacing immutable model and viewer bindings',async t=>{
 const x=fixture(t),uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ownerInstanceId=uuid(101),models=[],viewers=[],events=[];
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
  hostId:uuid(102),imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+60000};
 let canonical,creations=0;
 const native=target=>({installation:installationFor(target),hold:async()=>({outcome:'APPLIED'}),
  retirement:{async prepare(){events.push('prepare');},async wait(){events.push('absent');},async retain(){events.push('retain');}},
  relay:{async bind(input){models.push(input);return {mcpServers:{meri_browser:playwrightServerConfig(x.args.policy,installationFor(target),browserPaths(cwd))},async close(){events.push('model-close');}};}},
  controls:{ownerInstanceId,async bind(input){viewers.push(input);return {async close(){events.push('viewer-close');}};}}});
 const first=native(binding),host=createBrowserSessionHost({binding,cwd,...first,allocation,ownerInstanceId,upstream:x.upstream,now:Date.now,
  contexts:{async create(){creations++;return x.context;}},current:async()=>{await x.args.current();return {browserHandoff:canonical};},
  processes:{waitForExit:x.args.ports.waitForExit},dispose:x.args.ports.dispose});
 t.after(()=>host.destroy({trigger:'conversation-end'}));
 let currentBinding=binding,run=await host.open({binding,policy:x.args.policy,deadlineMs:allocation.leaseDeadlineMs,manifest:null});
 x.state.fields=[secret('RETAINED-CREDENTIAL')];x.state.text='Public page RETAINED-CREDENTIAL';
 for(let n=0;n<2;n++){
  const sourceModel=models.at(-1),sourceViewer=viewers.at(-1),sourceRun=run,controlId=uuid(110+n*10);
  assert.doesNotMatch(JSON.stringify(await sourceModel.call({requestId:'sdk-reused-id',tool:'browser_snapshot',args:{}})),/RETAINED-CREDENTIAL/);
  await run.prepareTakeover({controlId});const custody=await run.captureTakeover({controlId});
  await run.retainTakeover({receipt:{controlId,intent:'takeover.begin',sourceBinding:currentBinding,inputSha256:'b'.repeat(64),state:'APPLIED',checkpointId:currentBinding.runId,
   targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false}});
  const returned=await host.prepareResume({binding:currentBinding,custody});
  const target={...binding,runId:uuid(111+n*10),attemptId:uuid(112+n*10),workerId:uuid(113+n*10),writerFence:currentBinding.writerFence+1};
  canonical={custody,returned,targetBinding:target,controlId:uuid(114+n*10)};
  const request={binding:target,policy:x.args.policy,deadlineMs:custody.expiresAtMs,manifest:null,handoff:canonical};
  await assert.rejects(host.adopt({...request,handoff:{...canonical,returned:{...returned,snapshotSha256:'f'.repeat(64)}}},native(target)),/BROWSER_CUSTODY_REFUSED/);
  assert.equal((await sourceViewer.controls.readState()).state,'returning');
  run=await host.adopt(request,native(target));
  assert.deepEqual(events.slice(-2),['model-close','viewer-close']);assert.equal(creations,1);
  assert.equal(canonicalSha256(run.resumeSnapshot),returned.snapshotSha256);assert.doesNotMatch(JSON.stringify(run.resumeSnapshot),/RETAINED-CREDENTIAL/);
  assert.equal((await viewers.at(-1).controls.readState()).state,'returning');
  assert.throws(()=>sourceViewer.controls.readState(),/BROWSER_CUSTODY_REFUSED/);
  assert.throws(()=>sourceRun.destroy({trigger:'disconnect'}),/BROWSER_CUSTODY_REFUSED/);
  await assert.rejects(sourceModel.call({requestId:'late',tool:'browser_snapshot',args:{}}),/BROWSER_CUSTODY_REFUSED/);
  await models.at(-1).tools();assert.equal((await viewers.at(-1).controls.readState()).state,'agent');
  await assert.rejects(host.adopt(request,native(target)),/BROWSER_CUSTODY_REFUSED/);
  currentBinding=target;
 }
 assert.equal(x.state.calls,2);assert.equal(viewers.length,3);assert.deepEqual(viewers.map(x=>x.binding.writerFence),[1,2,3]);
});
