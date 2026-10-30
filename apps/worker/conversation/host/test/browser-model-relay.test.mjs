import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {EmptyResultSchema} from '@modelcontextprotocol/sdk/types.js';
import {createNativeBrowserModelRelay} from '../browser-model-relay.mjs';
import {binding,installation,enabledPolicy} from '../../browser/test/fixtures.mjs';
import {browserPaths} from '../../browser/workspace.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {createControlFence} from '../../browser/session/fence.mjs';
const cwd='/workspace/'+binding.conversationId;

test('an authenticated native stream lost before binding cannot expose a model server',async()=>{
 const incoming=new PassThrough(),outgoing=new PassThrough(),policy=validateBrowserPolicy(enabledPolicy());
 const owner=createNativeBrowserModelRelay({binding,policy,installation,paths:browserPaths(cwd),readable:incoming,writable:outgoing,onDisconnect:()=>{}});
 incoming.destroy();
 await assert.rejects(owner.bind({binding,installation,tools:async()=>[],call:async()=>({})}),/BROWSER_RELAY_REFUSED/);
 assert.throws(()=>createNativeBrowserModelRelay({binding,policy,installation,paths:browserPaths(cwd),readable:incoming,writable:outgoing,onDisconnect:()=>{}}),/BROWSER_RELAY_REFUSED/);
 outgoing.destroy();
});

async function fixture(t){
 const incoming=new PassThrough(),outgoing=new PassThrough(),policy=validateBrowserPolicy(enabledPolicy()),fence=createControlFence({now:Date.now});
 const state={calls:[],disconnected:0,raw:'',mode:'text'};outgoing.on('data',chunk=>{state.raw+=chunk;});
 const owner=createNativeBrowserModelRelay({binding,policy,installation,paths:browserPaths(cwd),readable:incoming,writable:outgoing,onDisconnect:()=>{state.disconnected++;}});
 const server=await owner.bind({binding,installation,tools:async()=>{if(state.mode==='throw')throw Error('CONFIDENTIAL_NATIVE_ERROR');return [{name:'browser_snapshot',description:'Snapshot',inputSchema:{type:'object',properties:{}}}];},
  async call(input){assert.equal(input.signal.aborted,false);state.calls.push(input);fence.admit({requestId:input.requestId,tool:input.tool,timeoutMs:1000});
   if(state.mode==='throw')throw Error('CONFIDENTIAL_NATIVE_ERROR');
   if(state.mode==='park')await new Promise(resolve=>input.signal.addEventListener('abort',resolve,{once:true}));
   fence.settle(input.requestId,{outcome:'result'});
   return {content:[state.mode==='image'?{type:'image',mimeType:'image/png',data:'PRIVATE_IMAGE'}:{type:'text',text:'filtered snapshot'}]};
  }});
 const client=new Client({name:'synthetic-model',version:'1'});client.onerror=()=>{};
 await client.connect(new StdioServerTransport(outgoing,incoming));
 t.after(async()=>{await server.close();await client.close();incoming.destroy();outgoing.destroy();});
 return {owner,server,client,state,incoming,outgoing};
}
test('native model stream exposes only listed browser tools and forwards filtered text through the owner',async t=>{
 const f=await fixture(t);assert.deepEqual((await f.client.listTools()).tools.map(t=>t.name),['browser_snapshot']);
 assert.deepEqual(await f.client.callTool({name:'browser_snapshot',arguments:{}}),{content:[{type:'text',text:'filtered snapshot'}]});
 assert.match(f.state.calls[0].requestId,/^[0-9a-f]{64}$/);assert.equal(f.state.calls[0].signal.aborted,true);
 await assert.rejects(f.client.request({method:'takeover.begin',params:{}},EmptyResultSchema));
 assert.equal(f.state.calls.length,1);
 await assert.rejects(f.owner.bind({binding,installation,call:async()=>{},tools:async()=>[]}));
});
test('native private errors and images cannot cross the model stream',async t=>{
 const f=await fixture(t);
 for(const mode of ['throw','image']){f.state.mode=mode;const result=await f.client.callTool({name:'browser_snapshot',arguments:{}});
  assert.equal(result.isError,true);assert.equal(result.content[0].text,'BROWSER_CALL_REFUSED');}
 f.state.mode='throw';await assert.rejects(f.client.listTools(),/BROWSER_CALL_REFUSED/);
 assert.equal(f.state.raw.includes('CONFIDENTIAL_NATIVE_ERROR'),false);assert.equal(f.state.raw.includes('PRIVATE_IMAGE'),false);
});
test('repeated native request identity cannot repeat a completed effect',async t=>{
 const f=await fixture(t),message=JSON.stringify({jsonrpc:'2.0',id:900,method:'tools/call',params:{name:'browser_snapshot',arguments:{}}})+'\n';
 const wait=async()=>{for(let n=0;n<50&&!f.state.raw.includes('"id":900');n++)await new Promise(resolve=>setTimeout(resolve,5));};
 f.incoming.write(message);await wait();const first=f.state.calls.at(-1).requestId;f.state.raw='';
 f.incoming.write(message);await wait();assert.equal(f.state.calls.at(-1).requestId,first);
 assert.match(f.state.raw,/BROWSER_CALL_REFUSED/);
});
test('native stream loss aborts pending work and invokes the host destruction path once',async t=>{
 const f=await fixture(t);f.state.mode='park';
 const pending=f.client.callTool({name:'browser_snapshot',arguments:{}}).catch(()=>{});
 while(!f.state.calls.length)await new Promise(resolve=>setImmediate(resolve));
 f.incoming.end();
 for(let n=0;n<50&&!f.state.disconnected;n++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.state.disconnected,1);assert.equal(f.state.calls[0].signal.aborted,true);
 assert.equal(f.state.raw.includes('filtered snapshot'),false);
 await f.client.close();await pending;
});
