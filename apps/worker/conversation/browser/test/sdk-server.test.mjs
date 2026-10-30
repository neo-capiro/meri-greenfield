/** Actual pinned SDK/MCP in-memory transport; authenticated host is scripted. */
import test from 'node:test';import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createBrowserSdkServer} from '../sdk-server.mjs';
import {binding} from '../../../../control/conversations/test/store-fixture.mjs';
const descriptor={name:'browser_snapshot',description:'Pinned upstream snapshot',inputSchema:{type:'object',properties:{filename:{type:'string',description:'Exact upstream parameter'}},additionalProperties:false}};
async function fixture(t,over={}){
 const calls=[],owner=createBrowserSdkServer({binding,policy:{enabled:true,tools:['browser_snapshot']},deadlineMs:Date.now()+30000,
  tools:async()=>[descriptor],call:async input=>{calls.push(input);return {content:[{type:'text',text:'Filtered host snapshot'}]};},...over});
 const client=new Client({name:'synthetic-sdk-client',version:'1.0.0'}),[clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
 await owner.server.instance.connect(serverTransport);await client.connect(clientTransport);
 t.after(async()=>{await client.close();await owner.close();});return {owner,client,calls};
}
test('actual SDK MCP server preserves the host tool schema and forwards only the bound call',async t=>{
 const f=await fixture(t);assert.equal(f.owner.server.type,'sdk');assert.equal(f.owner.server.name,'meri_browser');assert.deepEqual((await f.client.listTools()).tools,[descriptor]);
 assert.deepEqual(await f.client.callTool({name:'browser_snapshot',arguments:{filename:'output'}}),{content:[{type:'text',text:'Filtered host snapshot'}]});
 assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].binding,binding);assert.deepEqual(f.calls[0].args,{filename:'output'});assert.match(f.calls[0].requestId,/^[a-f0-9]{64}$/u);
});
test('foreign listing or call cannot widen the policy and receives no host execution',async t=>{
 const f=await fixture(t,{tools:async()=>[{...descriptor,name:'browser_evaluate'}]});await assert.rejects(f.client.listTools());
 const result=await f.client.callTool({name:'browser_evaluate',arguments:{script:'not executed'}});assert.equal(result.isError,true);assert.equal(f.calls.length,0);
});
test('raw images, extra metadata and oversized host output never reach the SDK',async t=>{
 for(const result of [{content:[{type:'image',data:'private'}]},{content:[{type:'text',text:'private'}],metadata:'private'},{content:[{type:'text',text:'x'.repeat(262145)}]}]){
  const f=await fixture(t,{call:async()=>result}),answer=await f.client.callTool({name:'browser_snapshot'});assert.deepEqual(answer,{isError:true,content:[{type:'text',text:'BROWSER_CALL_REFUSED'}]});
 }
});
test('close aborts an outstanding authenticated host call without claiming browser absence',async t=>{
 let observed;const f=await fixture(t,{call:({signal})=>new Promise((resolve,reject)=>{observed=signal;signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});})});
 const pending=f.client.callTool({name:'browser_snapshot'});pending.catch(()=>{});while(!observed)await new Promise(resolve=>setImmediate(resolve));await f.owner.close();assert.equal(observed.aborted,true);await assert.rejects(pending);await f.owner.close();
});
