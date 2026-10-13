/** Synthetic SDK fixture in a separate OS process; exactly one canonical activity query. */
import {createRequire} from 'node:module';
import {createTaskSelectedSkills} from '../task.mjs';
import {createNativeCapabilityClient} from '../../native-client.mjs';
import {createConversationActivity} from '../../../worker/conversation/activity.mjs';
const require=createRequire(new URL('../../../worker/conversation/package.json',import.meta.url));
const {Client}=await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
const {InMemoryTransport}=await import(require.resolve('@modelcontextprotocol/sdk/inMemory.js'));
process.once('message',async fixture=>{let queries=0,closed=0,client;const now=()=>fixture.now,native=createNativeCapabilityClient({configuration:{origin:fixture.origin,maxResponseBytes:2097152},credential:'synthetic-task-capability',now}),selectedSkills=createTaskSelectedSkills({native,sourceEnabled:true,now});
 try{const execute=createConversationActivity({now,selectedSkills,runOwner:{load:input=>native.call('test-run/load',{binding:input.binding},{signal:input.signal}),append:input=>native.call('test-run/append',{binding:input.binding,event:input.event},{signal:input.signal})},prepareRuntime:async()=>({binding:fixture.binding,versions:fixture.versions,cwd:'/workspace/conversations/'+fixture.binding.conversationId,proxyUrl:'https://synthetic.invalid',proxyCredential:'SYNTHETIC_ONLY',model:'synthetic-no-provider',sessionStore:{async load(){return null;},async append(){}},deadlineMs:now()+20000,maxTurns:12,maxCostMicroUSD:1000,maxOutputBytes:1048576}),query({options}){queries++;return {async *[Symbol.asyncIterator](){client=new Client({name:'synthetic-process-sdk',version:'1.0.0'});const [a,b]=InMemoryTransport.createLinkedPair();await options.mcpServers.meri_original_reads.instance.connect(a);await client.connect(b);
  const args={arguments:{subject:{kind:'client',entityId:fixture.clientId},query:'briefing',limit:3,offset:0,asOf:new Date(now()).toISOString()}},hook=await options.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',session_id:'71000000-0000-4000-8000-000000000091',tool_name:'mcp__meri_original_reads__mail_search_messages',tool_use_id:'toolu_real_child_process',tool_input:args},undefined,{});
  const read=await client.callTool({name:'mail_search_messages',arguments:hook.hookSpecificOutput.updatedInput??args});if(read.isError)throw Error('SCRIPTED_SOURCE_REFUSED');yield {type:'result',subtype:'success',is_error:false,structured_output:fixture.input};},close(){closed++;}};}});
  const result=await execute({binding:fixture.binding});process.send({result,queries,closed,pid:process.pid});
 }catch(error){process.send({error:error.code??error.message,queries,closed});process.exitCode=1;}finally{await client?.close();await selectedSkills.close();process.disconnect();}
});
