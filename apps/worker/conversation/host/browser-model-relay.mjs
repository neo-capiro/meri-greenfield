/** Native model stdio terminates at the session owner. These streams must come
 * from the authenticated host broker; this adapter cannot admit a socket peer. */
import {Readable,Writable} from 'node:stream';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {playwrightServerConfig} from '../browser/server.mjs';
const fail=()=>{throw Error('BROWSER_RELAY_REFUSED');};
const refused=()=>({isError:true,content:[{type:'text',text:'BROWSER_CALL_REFUSED'}]});
export function createNativeBrowserModelRelay({binding,policy,installation,paths,readable,writable,onDisconnect}){
 if(!(readable instanceof Readable)||!(writable instanceof Writable)||typeof onDisconnect!=='function')fail();
 const expected=canonicalSha256(binding);let bound=false;
 return Object.freeze({async bind(raw){
  const q=own(raw,['binding','installation','call','tools']);
  if(bound||canonicalSha256(q.binding)!==expected||canonicalSha256(q.installation)!==canonicalSha256(installation)||typeof q.call!=='function'||typeof q.tools!=='function')fail();
  bound=true;
  const server=new Server({name:'meri-browser-session',version:'1.0.0'},{capabilities:{tools:{}}});
  const transport=new StdioServerTransport(readable,writable,{maxBufferSize:262144});
  let closed=false;
  const disconnect=()=>{if(!closed){void close().catch(()=>{}).then(()=>Promise.resolve(onDisconnect()).catch(()=>{}));}};
  async function close(){if(closed)return;closed=true;
   readable.off('end',disconnect);readable.off('close',disconnect);readable.off('error',disconnect);writable.off('error',disconnect);writable.off('close',disconnect);
   await server.close();
  }
  server.onerror=disconnect;
  server.setRequestHandler(ListToolsRequestSchema,async()=>{
   try{
   if(closed)fail();const tools=data(await q.tools());
   if(!Array.isArray(tools)||tools.length>policy.tools.length||tools.some(t=>!policy.tools.includes(t.name))||new Set(tools.map(t=>t.name)).size!==tools.length)fail();
   return {tools};
   }catch{throw Error('BROWSER_CALL_REFUSED');}
  });
  server.setRequestHandler(CallToolRequestSchema,async(request,extra)=>{
   try{
    if(closed)fail();
    // Preserve client request identity across retries. A reused ID cannot acquire
    // another effect merely by changing its arguments; the existing fence owns it.
    const requestId=canonicalSha256({type:typeof extra.requestId,id:extra.requestId});
    const result=data(await q.call({requestId,tool:request.params.name,args:request.params.arguments??{},signal:extra.signal}));
    own(result,['content']);
    if(closed||extra.signal.aborted||!Array.isArray(result.content)||!result.content.length||result.content.some(x=>Object.keys(x).sort().join(',')!=='text,type'||x.type!=='text'||typeof x.text!=='string')||Buffer.byteLength(JSON.stringify(result))>262144)fail();
    return result;
   }catch{return refused();}
  });
  readable.on('end',disconnect);readable.on('close',disconnect);readable.on('error',disconnect);writable.on('error',disconnect);writable.on('close',disconnect);
  try{await server.connect(transport);}catch{await close();fail();}
  return Object.freeze({mcpServers:{meri_browser:playwrightServerConfig(policy,installation,paths)},close});
 }});
}
