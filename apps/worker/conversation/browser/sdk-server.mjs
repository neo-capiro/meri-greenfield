/** SDK-native MCP transport to the existing host-owned browser session. The
 * canonical permission/page hooks still decide before effects; this transport
 * cannot activate a browser, grant approval or launch another SDK process.
 *
 * The run's browser host is provisioned on its first browser use, so the server lists one tool, `browser_navigate`,
 * until the browser is prepared (`prepared()` answers the host's metadata, or null before that). The first browser call
 * prepares it through the PreToolUse gate; the server then lists the host's own tool definitions and tells the SDK that
 * its tool list changed. */
import {createSdkMcpServer} from '@anthropic-ai/claude-agent-sdk';
import {CallToolRequestSchema,ListToolsRequestSchema,ToolSchema} from '@modelcontextprotocol/sdk/types.js';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {BROWSER_NATIVE_LIMITS} from '../../../../packages/contracts/runtime-0.2/browser-tools.mjs';
import {BROWSER_SERVER_NAME} from './server.mjs';
import {browserRefusalResult,isBrowserRefusalResult} from './refusals.mjs';
const MAX_BYTES=262144;
const fail=()=>{throw Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'});};
const refused=()=>browserRefusalResult('BROWSER_CALL_REFUSED');
/** The one tool listed before the browser exists: opening a page is how browsing starts. */
export const FIRST_BROWSER_TOOL=Object.freeze({name:'browser_navigate',
 description:'Open a web page in this conversation\'s browser. The browser starts on first use; the other browser tools appear once it is running.',
 inputSchema:Object.freeze({type:'object',properties:Object.freeze({url:Object.freeze({type:'string',description:'The URL to open'})}),required:Object.freeze(['url'])})});
/** The SDK's per-call ceiling: the longest page effect plus the longest approval window (the selected values clamp each call). */
const CALL_CEILING_MS=BROWSER_NATIVE_LIMITS.executionMs+BROWSER_NATIVE_LIMITS.approvalMs;
export function createBrowserSdkServer(configuration){
 const c=own(configuration,['binding','prepared','ensure','tools','call','deadlineMs'],['now','signal']),binding=data(c.binding),now=c.now??Date.now;
 validateShape('RunBinding',binding);
 if(typeof c.prepared!=='function'||typeof c.ensure!=='function'||typeof c.tools!=='function'||typeof c.call!=='function'||typeof now!=='function'||
  !Number.isSafeInteger(c.deadlineMs)||c.deadlineMs<=now())fail();
 const owner=new AbortController();
 const sdk=createSdkMcpServer({name:BROWSER_SERVER_NAME,version:'1.0.0',tools:[]});
 // McpServer's public protocol server preserves the pinned upstream JSON Schema
 // exactly. It avoids a second tool-schema vocabulary or a lossy conversion.
 const server=sdk.instance.server;let closed=false,closing;
 server.registerCapabilities({tools:{listChanged:true}});
 /** Each call is bounded by the prepared policy: its page effect plus the selected approval window. */
 async function within(extra,operation,metadata){
  if(closed)fail();const signals=[owner.signal,c.signal,extra?.signal].filter(Boolean);
  const budget=metadata===null?BROWSER_NATIVE_LIMITS.executionMs:Math.min(metadata.policy.timeouts.actionMs+metadata.policy.timeouts.navigationMs,BROWSER_NATIVE_LIMITS.executionMs)+metadata.approvalDeadlineMs;
  const life=createOperationLifetime({now,deadlineMs:Math.min(c.deadlineMs,now()+budget),signal:AbortSignal.any(signals),errorFactory:()=>Object.assign(Error('BROWSER_CALL_REFUSED'),{code:'BROWSER_CALL_REFUSED'})});
  try{const result=await life.run(operation);life.check();if(closed)fail();return result;}finally{life.close();}
 }
 server.setRequestHandler(ListToolsRequestSchema,async(_request,extra)=>{
  const metadata=c.prepared();
  if(metadata===null)return {tools:[structuredClone(FIRST_BROWSER_TOOL)]};
  try{return await within(extra,async signal=>{
   const tools=data(await c.tools({binding,signal})),policy=metadata.policy;
   if(!Array.isArray(tools)||tools.length>policy.tools.length||new Set(tools.map(t=>t.name)).size!==tools.length||Buffer.byteLength(JSON.stringify(tools))>MAX_BYTES)fail();
   for(const tool of tools){ToolSchema.parse(tool);if(!policy.tools.includes(tool.name))fail();}
   return {tools};
  },metadata);}catch{fail();}
 });
 server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
  try{const metadata=await c.ensure();return await within(extra,async signal=>{
   const tool=request.params.name,args=data(request.params.arguments??{});
   if(!metadata.policy.tools.includes(tool)||Buffer.byteLength(JSON.stringify(args))>MAX_BYTES||!['string','number'].includes(typeof extra.requestId))fail();
   // Preserve the MCP request identity through the run binding. No call is
   // retried here; replay and uncertain effects remain with the host fence.
   const requestId=canonicalSha256({binding,type:typeof extra.requestId,id:extra.requestId});
   // The CLI names the SDK tool use in the call's metadata; the host matches it to that use's approval.
   const toolUseId=request.params._meta?.['claudecode/toolUseId'];
   const result=data(await c.call({binding,requestId,tool,args,...(typeof toolUseId==='string'&&/^[A-Za-z0-9_-]{1,128}$/u.test(toolUseId)?{toolUseId}:{}),signal}));own(result,['content'],['isError']);
   // The host's closed refusal texts are the only `isError` results admitted; they carry no page content.
   if(Object.hasOwn(result,'isError')&&!isBrowserRefusalResult(result))fail();
   if(!Array.isArray(result.content)||!result.content.length||Buffer.byteLength(JSON.stringify(result))>MAX_BYTES)fail();
   for(const raw of result.content){const block=own(raw,['type','text']);if(block.type!=='text'||typeof block.text!=='string')fail();}
   return result;
  },metadata);}catch{return refused();}
 });
 return Object.freeze({server:Object.freeze({...sdk,timeout:CALL_CEILING_MS}),
  /** The browser is prepared: the SDK re-lists the host's own tool definitions. */
  async toolsChanged(){if(!closed)try{await server.sendToolListChanged();}catch{}},
  close(){
   if(closing)return closing;closed=true;owner.abort();closing=Promise.resolve().then(()=>sdk.instance.close());return closing;
  }});
}
