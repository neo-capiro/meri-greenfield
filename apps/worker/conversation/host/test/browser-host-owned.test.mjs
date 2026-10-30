/** Actual SDK MCP and session/filter/fence composition; browser/Core/kernel ports are scripted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createBrowserSdkServer} from '../../browser/sdk-server.mjs';
import {createBrowserSessionHost} from '../browser-session-host.mjs';
import {binding,enabledPolicy,installation} from '../../browser/test/fixtures.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';

const {launch,...contextInstallation}=installation;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const descriptor={name:'browser_snapshot',description:'Snapshot',inputSchema:{type:'object',properties:{}}};
function fixture(){
 const policy=validateBrowserPolicy(enabledPolicy()),events=[],state={calls:0,creations:0,revoked:false,canonical:undefined},viewers=[];
 const lifecycle=new EventEmitter(),frame={locator:()=>({evaluateAll:async()=>[{kind:'field',label:'Password',type:'password',autocomplete:'current-password',selectorMatch:false,value:'PRIVATE-CREDENTIAL'}]})};
 const page={url:()=> 'https://records.example/page?token=hidden#secret',frames:()=>[frame],mainFrame:()=>frame,isClosed:()=>false,
  on:(...args)=>lifecycle.on(...args),off:(...args)=>lifecycle.off(...args),ariaSnapshot:async()=>'- heading "Public page PRIVATE-CREDENTIAL"'};
 const context={pages:()=>[page],close:async()=>{events.push('context');}};
 const upstream={version:'0.0.83',async createConnection(_config,getContext){assert.equal(await getContext(),context);let wire;return {
  async connect(transport){wire=transport;wire.onmessage=async q=>{
   if(!Object.hasOwn(q,'id'))return;let result={};
   if(q.method==='initialize')result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'0.0.83'}};
   if(q.method==='tools/list'){if(state.parkList)return;result={tools:[descriptor,{...descriptor,name:'browser_evaluate'}]};}
   if(q.method==='tools/call'){state.calls++;result={content:[{type:'text',text:'RAW PRIVATE OUTPUT'}]};}
   await wire.send({jsonrpc:'2.0',id:q.id,result});
  };},async close(){await wire.close();}
 };}};
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,hostId:uuid(101),imageDigest:'sha256:'+'a'.repeat(64),leaseDeadlineMs:Date.now()+60000};
 const native=()=>({installation:contextInstallation,modelTransport:'host-owned',hold:async()=>({outcome:'APPLIED'}),
  retirement:{prepare:async()=>events.push('retirement'),wait:async()=>events.push('remote-sdk-absence'),retain:async()=>events.push('retain')},
  controls:{bind:async input=>{viewers.push(input);return {close:async()=>events.push('viewer-close')};}}});
 const host=createBrowserSessionHost({binding,cwd:'/workspace/'+binding.conversationId,...native(),allocation,ownerInstanceId:uuid(102),upstream,now:Date.now,
  contexts:{create:async()=>{state.creations++;return context;}},current:async()=>{if(state.revoked)throw Error('revoked');return {browserHandoff:state.canonical};},
  processes:{waitForExit:async()=>{events.push('browser-absence');return {exited:true};}},dispose:async()=>{events.push('dispose');return {disposed:true};}});
 return {host,policy,allocation,native,state,events,viewers};
}
const request=(bound=binding)=>({binding:bound,requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}});

test('real SDK MCP reaches host-owned session filtering without a native shim or second SDK',async t=>{
 const f=fixture();const run=await f.host.open({binding,policy:f.policy,deadlineMs:f.allocation.leaseDeadlineMs,manifest:null});
 assert.deepEqual(run.mcpServers,{});
 const sdk=createBrowserSdkServer({binding,policy:f.policy,deadlineMs:f.allocation.leaseDeadlineMs,
  tools:async input=>(await f.host.readModelTools(input)).tools,call:f.host.callModelTool});
 const client=new Client({name:'scripted-agentcore',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();
 await sdk.server.instance.connect(b);await client.connect(a);
 t.after(async()=>{await client.close();await sdk.close();await f.host.destroy({trigger:'conversation-end'});});
 assert.deepEqual((await client.listTools()).tools,[descriptor]);
 const response=JSON.stringify(await client.callTool({name:'browser_snapshot'}));
 assert.match(response,/sign-in page; content withheld/);assert.doesNotMatch(response,/PRIVATE|hidden|token=|profile|shim/);assert.equal(f.state.calls,1);
 f.state.revoked=true;assert.equal((await client.callTool({name:'browser_snapshot'})).isError,true);assert.equal(f.state.calls,1);
});

test('two logical takeovers retain one context and old host handles cannot call or discover successor tools',async t=>{
 const f=fixture();let bound=binding,run=await f.host.open({binding,policy:f.policy,deadlineMs:f.allocation.leaseDeadlineMs,manifest:null});
 t.after(()=>f.host.destroy({trigger:'conversation-end'}));
 for(let n=0;n<2;n++){
  const old=run,oldBinding=bound,controlId=uuid(110+n*10);
  assert.doesNotMatch(JSON.stringify(await run.callModelTool(request(bound))),/PRIVATE-CREDENTIAL/);
  await run.prepareTakeover({controlId});const custody=await run.captureTakeover({controlId});
  await run.retainTakeover({receipt:{controlId,intent:'takeover.begin',sourceBinding:bound,inputSha256:'b'.repeat(64),state:'APPLIED',checkpointId:bound.runId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false}});
  const returned=await f.host.prepareResume({binding:bound,custody});
  bound={...bound,runId:uuid(111+n*10),attemptId:uuid(112+n*10),workerId:uuid(113+n*10),writerFence:bound.writerFence+1};
  const handoff={custody,returned,targetBinding:bound,controlId:uuid(114+n*10)};f.state.canonical=handoff;
  run=await f.host.adopt({binding:bound,policy:f.policy,deadlineMs:custody.expiresAtMs,manifest:null,handoff},f.native());
  assert.equal(canonicalSha256(run.resumeSnapshot),returned.snapshotSha256);
  await assert.rejects(old.callModelTool(request(oldBinding)),/BROWSER_CUSTODY_REFUSED/);
  await assert.rejects(old.readModelTools({binding:oldBinding}),/BROWSER_CUSTODY_REFUSED/);
  await assert.rejects(f.host.callModelTool(request(oldBinding)),/BROWSER_CALL_REFUSED/);
  assert.deepEqual(await f.host.readModelTools({binding:bound}),{tools:[descriptor]});
  assert.equal((await f.viewers.at(-1).controls.readState()).state,'agent');
 }
 assert.equal(f.state.creations,1);assert.equal(f.state.calls,2);
 assert.equal(f.events.filter(x=>x==='remote-sdk-absence').length,2);
});

test('cancelled tool discovery leaves no pending upstream read and closed host refuses future work',async()=>{
 const f=fixture(),run=await f.host.open({binding,policy:f.policy,deadlineMs:f.allocation.leaseDeadlineMs,manifest:null});
 f.state.parkList=true;const controller=new AbortController();
 const pending=assert.rejects(f.host.readModelTools({binding,signal:controller.signal}),/BROWSER_CALL_REFUSED/);
 await new Promise(resolve=>setImmediate(resolve));controller.abort();await pending;
 await run.destroy({trigger:'conversation-end'});
 await assert.rejects(f.host.callModelTool(request()),/BROWSER_CUSTODY_REFUSED/);
 assert.deepEqual(f.events.slice(-3),['context','browser-absence','dispose']);
});
