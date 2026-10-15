/** Synthetic harness: the actual `meri_reads` server over the actual gateway general-read mount (fake mail Fetch,
 * scripted SQL), reached through the MCP SDK in-memory client. The SDK's native PreToolUse delivery is modelled by
 * invoking the server's hook before each call. No SDK query, CLI, provider or model call. */
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {generalReadFixture,MAIL_OPERATIONS,NOW} from '../../../../gateway/general-reads/fixture.mjs';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
export {generalReadFixture,MAIL_OPERATIONS,NOW};
export const SESSION='71000000-0000-4000-8000-000000000091';
/** @param {Awaited<ReturnType<typeof generalReadFixture>>} f */
export async function mountReads(f,{policy={generalReads:true},port=f.mount(),deadlineMs=f.deadlineMs,...rest}={}){
 const runtime=await createGeneralReadRuntime({binding:f.binding,scopes:f.scopes,policy:assertCapabilityPolicy(policy),port,now:f.now,deadlineMs,...rest});
 if(runtime===null)return null;
 const client=new Client({name:'synthetic-sdk',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
 await runtime.sdkOptions.mcpServers.meri_reads.instance.connect(a);await client.connect(b);
 const hook=runtime.sdkOptions.hooks.PreToolUse[0].hooks[0];let n=0;
 /** Delivers PreToolUse then, if not denied, the MCP call with the hook's updated input. */
 async function call(name,args,{toolUseId=`toolu_synthetic_${n++}`,sessionId=SESSION,signal}={}){
  const decision=await hook({hook_event_name:'PreToolUse',session_id:sessionId,tool_name:`mcp__meri_reads__${name}`,tool_use_id:toolUseId,tool_input:{arguments:args}},undefined,{signal:new AbortController().signal});
  if(decision.hookSpecificOutput.permissionDecision==='deny')return {denied:decision.hookSpecificOutput.permissionDecisionReason};
  return client.callTool({name,arguments:decision.hookSpecificOutput.updatedInput},undefined,signal?{signal}:undefined);
 }
 return {runtime,client,hook,call,async close(){await client.close();await runtime.close();}};
}
