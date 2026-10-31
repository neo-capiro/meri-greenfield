import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {compositionFixture} from './composition-fixture.mjs';
import {assembleAgentCoreCandidate} from '../../agentcore-candidate.mjs';
import historicalCatalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const require=createRequire(new URL('../../../worker/conversation/package.json',import.meta.url));
const {Client}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const {InMemoryTransport}=await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/inMemory.js')).href);
async function connect(runtime){const client=new Client({name:'synthetic-selected-composition',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();await runtime.sdkOptions.mcpServers.meri_original_reads.instance.connect(a);await client.connect(b);return client;}
const args=x=>({arguments:{subject:{kind:'client',entityId:x.f.selection.subject.entityIds[0]},query:'briefing',limit:3,offset:0,asOf:new Date(x.f.configuration.now()).toISOString()}});
async function read(x,r,c){const input=args(x),hook=await r.sdkOptions.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',session_id:'71000000-0000-4000-8000-000000000091',tool_name:'mcp__meri_original_reads__mail_search_messages',tool_use_id:'toolu_composition',tool_input:input},undefined,{});return c.callTool({name:'mail_search_messages',arguments:hook.hookSpecificOutput.updatedInput??input});}
for(const skillId of ['quick_skill.commitments_audit','quick_skill.relationship_brief'])test(`${skillId}: assembled private HTTP, actual MCP/read owner/compiler and proposal publication`,async()=>{
 const x=await compositionFixture(skillId);let client;try{assert.deepEqual(x.assembly.intentTables,['meri_intents.preparations','meri_commands.approval_metadata']);const runtime=await x.prepare();client=await connect(runtime);assert.equal((await read(x,runtime,client)).isError,undefined);
  const output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:x.f.input});await x.task.publish({binding:x.f.context.binding,output});await x.task.publish({binding:x.f.context.binding,output});
  assert.equal(x.base.state.selectedOutputs.size,1);assert.equal(x.metadata.rows.size,1);assert.equal(x.intents.state.rows.size,1);
  const proposal=[...x.intents.state.rows.values()][0].outcome.result.proposal;assert.equal(proposal.command.action,'document.draft');
  const history=await x.assembly.store.read(x.f.context.binding,{after:0,limit:50},()=>{}),events=history.events.filter(e=>e.type==='approval.required');assert.equal(events.length,1);assert.equal(events[0].data.proposalId,proposal.proposalId);
  assert.equal(x.base.state.allocations.size,0);assert(x.state.readCalls>1);assert(x.metadata.calls.some(q=>q.query_timeout===5000));
 }finally{await client?.close();await x.close();}
});
test('assembled selected route refuses a foreign credential/binding before reads and revocation before persistence',async()=>{
 const x=await compositionFixture();try{const input={binding:x.f.context.binding,requestSha256:hash(x.f.request)};
  await assert.rejects(x.rpc('selected/prepare',input,{credential:'foreign'}));await assert.rejects(x.rpc('selected/prepare',{...input,binding:{...input.binding,writerFence:2}}));assert.equal(x.state.readCalls,0);
  const runtime=await x.prepare();x.state.revoked=true;await assert.rejects(runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:x.f.input}));assert.equal(x.base.state.selectedOutputs.size,0);assert.equal(x.metadata.rows.size,0);
 }finally{await x.close();}
});
test('assembly close aborts owned pending reads and prevents later prepare/publication',async()=>{
 const x=await compositionFixture();let client;try{const runtime=await x.prepare();client=await connect(runtime);x.state.blockedRead=Promise.withResolvers();x.state.readStarted=Promise.withResolvers();
  const pending=read(x,runtime,client);pending.catch(()=>{});await x.state.readStarted.promise;await x.assembly.close();const result=await pending;assert.equal(result.isError,true);assert.equal(x.state.abortedReads,1);
  await assert.rejects(x.prepare());assert.equal(x.metadata.rows.size,0);assert.equal(x.base.state.selectedOutputs.size,0);
 }finally{x.state.blockedRead?.resolve('{}');await client?.close();await x.close();}
});
test('failed initial source discovery leaves no proposal/output and a later fresh preparation works',async()=>{
 const x=await compositionFixture();try{x.state.availabilityError=true;await assert.rejects(x.prepare());assert.equal(x.state.readCalls,0);assert.equal(x.metadata.rows.size,0);assert.equal(x.intents.state.rows.size,0);
  x.state.availabilityError=false;const runtime=await x.prepare();const output=await runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:x.f.input});await x.task.publish({binding:x.f.context.binding,output});assert.equal(x.metadata.rows.size,1);
 }finally{await x.close();}
});
test('actual AgentCore candidate forwards only the four selected routes to the mounted control owner',async()=>{
 const x=await compositionFixture();let candidate;try{const forbidden=async()=>{throw Error('No provider or Core admission in this private forwarding control');};
  candidate=assembleAgentCoreCandidate({configuration:x.configuration,pool:x.pool,store:x.assembly.store,controlCredential:'synthetic-control-only-secret-long-enough',nativeCredentials:{nativeCredentialFor:forbidden},provider:{invoke:forbidden,stop:forbidden},fetchImpl:forbidden,now:x.f.configuration.now});candidate.bindApplication(x.assembly.application);
  const request=(suffix,credential='synthetic-execution')=>new Request('https://control.invalid/v1/runner/selected/'+suffix,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding:x.f.context.binding,requestSha256:hash(x.f.request)})});
  const response=await candidate.application.handle(request('prepare'));assert.equal(response.status,200);assert.deepEqual((await response.json()).binding,x.f.context.binding);
  assert.equal((await candidate.application.handle(request('prepare','foreign'))).status,403);assert.equal(await candidate.application.handle(request('replace')),null);
 }finally{await candidate?.close();await x.close();}
});

test('real reads and selected admission refuse historical or altered snapshots before publication',async()=>{
 const x=await compositionFixture();try{
  const current=x.state.installationCatalogSha256;
  for(const wrong of [hash(historicalCatalog),'d'.repeat(64)]){
   x.state.installationCatalogSha256=wrong;await assert.rejects(x.prepare());
   assert.equal(x.state.readCalls,0);assert.equal(x.base.state.selectedOutputs.size,0);assert.equal(x.metadata.rows.size,0);assert.equal(x.intents.state.rows.size,0);
  }
  x.state.installationCatalogSha256=current;assert(await x.prepare());
 }finally{await x.close();}
});

test('an established selected session refuses a later incompatible installation before source reads',async()=>{
 const x=await compositionFixture();let client;try{
  const runtime=await x.prepare();client=await connect(runtime);
  x.state.installationCatalogSha256=hash(historicalCatalog);
  assert.equal((await read(x,runtime,client)).isError,true);assert.equal(x.state.readCalls,0);
  await assert.rejects(runtime.finish({type:'result',subtype:'success',is_error:false,structured_output:x.f.input}));
  assert.equal(x.base.state.selectedOutputs.size,0);assert.equal(x.metadata.rows.size,0);assert.equal(x.intents.state.rows.size,0);
 }finally{await client?.close();await x.close();}
});
