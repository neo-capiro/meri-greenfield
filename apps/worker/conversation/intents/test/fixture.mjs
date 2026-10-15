/** SYNTHETIC harness: the actual `meri_intents` runtime/server over the actual control intent mount and task.create
 * owners (`apps/control/intents/test/fixture.mjs`), reached through the MCP SDK in-memory client. The SDK's native
 * PreToolUse delivery is modelled by invoking the server's hook before each call. No SDK query, CLI, provider, model,
 * database or network call. */
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {commandComposition,mount,NOW} from '../../../../control/intents/test/fixture.mjs';
import {createIntentRuntime} from '../runtime.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
export {NOW};
export const SESSION='71000000-0000-4000-8000-000000000091';
/** A run whose trusted intent port is the control mount over a task.create composition. */
export function intentFixture(options){
 const c=commandComposition(options),m=mount({binding:c.binding,preparers:[c.preparer()],now:()=>c.f.state.now});
 return {...c,store:m.store,port:m.mount,now:()=>c.f.state.now,deadlineMs:NOW+60000};
}
/** @param {ReturnType<typeof intentFixture>} f */
export async function mountIntents(f,{policy={governedIntents:true},port=f.port,...rest}={}){
 const runtime=await createIntentRuntime({binding:f.binding,scopes:f.scopes,policy:assertCapabilityPolicy(policy),port,now:f.now,deadlineMs:f.deadlineMs,...rest});
 if(runtime===null)return null;
 const client=new Client({name:'synthetic-sdk',version:'1.0.0'}),[a,b]=InMemoryTransport.createLinkedPair();
 await runtime.sdkOptions.mcpServers.meri_intents.instance.connect(a);await client.connect(b);
 const hook=runtime.sdkOptions.hooks.PreToolUse[0].hooks[0];let n=0;
 async function call(name,input,{toolUseId=`toolu_synthetic_${n++}`,sessionId=SESSION,signal}={}){
  const decision=await hook({hook_event_name:'PreToolUse',session_id:sessionId,tool_name:`mcp__meri_intents__${name}`,tool_use_id:toolUseId,tool_input:input},undefined,{signal:new AbortController().signal});
  if(decision.hookSpecificOutput.permissionDecision==='deny')return {denied:decision.hookSpecificOutput.permissionDecisionReason};
  return client.callTool({name,arguments:decision.hookSpecificOutput.updatedInput},undefined,signal?{signal}:undefined);
 }
 return {runtime,client,hook,call,async close(){await client.close();await runtime.close();}};
}
