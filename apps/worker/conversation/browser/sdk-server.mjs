/** SDK-native MCP transport to the existing host-owned browser session. The
 * canonical permission/page hooks still decide before effects; this transport
 * cannot activate a browser, grant approval or launch another SDK process. */
import {createSdkMcpServer} from '@anthropic-ai/claude-agent-sdk';
import {CallToolRequestSchema,ListToolsRequestSchema,ToolSchema} from '@modelcontextprotocol/sdk/types.js';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {validateBrowserPolicy} from './policy.mjs';
import {BROWSER_SERVER_NAME} from './server.mjs';
const MAX_BYTES=262144;
const fail=()=>{throw Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'});};
const refused=()=>({isError:true,content:[{type:'text',text:'BROWSER_CALL_REFUSED'}]});
export function createBrowserSdkServer(configuration){
 const c=own(configuration,['binding','policy','tools','call','deadlineMs'],['now','signal']),binding=data(c.binding),policy=validateBrowserPolicy(c.policy),now=c.now??Date.now;
 validateShape('RunBinding',binding);
 if(!policy.enabled||typeof c.tools!=='function'||typeof c.call!=='function'||typeof now!=='function'||!Number.isSafeInteger(c.deadlineMs)||c.deadlineMs<=now())fail();
 const owner=new AbortController(),timeout=Math.min(policy.timeouts.actionMs+policy.timeouts.navigationMs,130000);
 const sdk=createSdkMcpServer({name:BROWSER_SERVER_NAME,version:'1.0.0',tools:[]});
 // McpServer's public protocol server preserves the pinned upstream JSON Schema
 // exactly. It avoids a second tool-schema vocabulary or a lossy conversion.
 const server=sdk.instance.server;let closed=false,closing;
 async function within(extra,operation){
  if(closed)fail();const signals=[owner.signal,c.signal,extra?.signal].filter(Boolean);
  const life=createOperationLifetime({now,deadlineMs:Math.min(c.deadlineMs,now()+timeout),signal:AbortSignal.any(signals),errorFactory:()=>Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'})});
  try{const result=await life.run(operation);life.check();if(closed)fail();return result;}finally{life.close();}
 }
 server.setRequestHandler(ListToolsRequestSchema,async(_request,extra)=>{
  try{return await within(extra,async signal=>{
   const tools=data(await c.tools({binding,signal}));
   if(!Array.isArray(tools)||tools.length>policy.tools.length||new Set(tools.map(t=>t.name)).size!==tools.length||Buffer.byteLength(JSON.stringify(tools))>MAX_BYTES)fail();
   for(const tool of tools){ToolSchema.parse(tool);if(!policy.tools.includes(tool.name))fail();}
   return {tools};
  });}catch{fail();}
 });
 server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
  try{return await within(extra,async signal=>{
   const tool=request.params.name,args=data(request.params.arguments??{});
   if(!policy.tools.includes(tool)||Buffer.byteLength(JSON.stringify(args))>MAX_BYTES||!['string','number'].includes(typeof extra.requestId))fail();
   // Preserve the MCP request identity through the run binding. No call is
   // retried here; replay and uncertain effects remain with the host fence.
   const requestId=canonicalSha256({binding,type:typeof extra.requestId,id:extra.requestId});
   const result=data(await c.call({binding,requestId,tool,args,signal}));own(result,['content']);
   if(!Array.isArray(result.content)||!result.content.length||Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)fail();
   for(const raw of result.content){const block=own(raw,['type','text']);if(block.type!=='text'||typeof block.text!=='string')fail();}
   return result;
  });}catch{return refused();}
 });
 return Object.freeze({server:Object.freeze({...sdk,timeout}),close(){
  if(closing)return closing;closed=true;owner.abort();closing=Promise.resolve().then(()=>sdk.instance.close());return closing;
 }});
}
