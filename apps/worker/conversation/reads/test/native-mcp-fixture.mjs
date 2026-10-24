/** Production worker MCP and transport over synthetic Core source ports. */
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createGeneralReadRuntime} from '../runtime.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
export async function connect(t,f,{skill,policy={generalReads:true},port=f.port,...options}={}){
 const runtime=await createGeneralReadRuntime({binding:f.binding,scopes:f.scopes,policy:assertCapabilityPolicy(policy),port,now:f.now,deadlineMs:f.deadlineMs,...(skill?{skill}:{}),...options});
 if(runtime===null)return null;
 const client=new Client({name:'native-control-fixture',version:'1'}),[serverTransport,clientTransport]=InMemoryTransport.createLinkedPair();
 t.after(async()=>{await client.close();await runtime.close();});
 await runtime.sdkOptions.mcpServers.meri_reads.instance.connect(serverTransport);await client.connect(clientTransport);
 let count=0;const name=f.operation.id.replaceAll('.','_'),hook=runtime.sdkOptions.hooks.PreToolUse[0].hooks[0];
 async function call(args=f.scene.arguments,{sessionId='71000000-0000-4000-8000-000000000091',toolUseId=`native-${++count}`,signal}={}){
  const decision=await hook({hook_event_name:'PreToolUse',session_id:sessionId,tool_name:`mcp__meri_reads__${name}`,tool_use_id:toolUseId,tool_input:{arguments:args}},undefined,{signal});
  if(decision.hookSpecificOutput.permissionDecision==='deny')return {denied:decision.hookSpecificOutput.permissionDecisionReason};
  return client.callTool({name,arguments:decision.hookSpecificOutput.updatedInput},undefined,signal?{signal}:undefined);
 }
 return {runtime,client,name,call,hook};
}
