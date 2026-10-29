/** Compose the pinned upstream createConnection(contextGetter) with the session owner.
 * The upstream MCP transport is private to the host. Its tool output is discarded by
 * the owner; SDK transport and user input use separate caller-supplied native relays. */
import {createBrowserSessionOwner} from './owner.mjs';
import {PLAYWRIGHT_MCP_VERSION} from '../policy.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export async function createPinnedBrowserSession({upstream,context,policy,manifest,current,hold,ports,now=Date.now,deadlineMs}){
 if(upstream?.version!==PLAYWRIGHT_MCP_VERSION||typeof upstream.createConnection!=='function')fail('BROWSER_CONFIGURATION');
 const config={browser:{browserName:'chromium',isolated:false},webmcp:false,saveSession:false,imageResponses:'omit',
  snapshot:{mode:'none'},codegen:'none',timeouts:{action:policy.timeouts.actionMs,navigation:policy.timeouts.navigationMs,idle:0}};
 const server=await upstream.createConnection(config,async()=>context),pending=new Map();let sequence=0,closed=false;
 const transport={async start(){},async close(){closed=true;for(const p of pending.values())p.reject(Error('BROWSER_CONNECTION_CLOSED'));pending.clear();},
  async send(message){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);
   message.error?p.reject(Error('BROWSER_UPSTREAM_REFUSED')):p.resolve(message.result);}};
 await server.connect(transport);
 const request=(method,params,signal)=>new Promise((resolve,reject)=>{
  if(closed||signal?.aborted){reject(Error('BROWSER_CONNECTION_CLOSED'));return;}
  const id=++sequence,abort=()=>{pending.delete(id);transport.onmessage?.({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:id}});
   clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Error('BROWSER_CALL_ABORTED'));};
  const timer=setTimeout(abort,Math.max(1,Math.min(deadlineMs-now(),130000)));
  pending.set(id,{resolve:v=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve(v);},reject:e=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(e);}});
  signal?.addEventListener('abort',abort,{once:true});transport.onmessage({jsonrpc:'2.0',id,method,params});
 });
 try{
  await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'meri-browser-session',version:'1'}});
  transport.onmessage({jsonrpc:'2.0',method:'notifications/initialized'});
  const owner=createBrowserSessionOwner({context,policy,manifest,current,hold,ports,now,deadlineMs,
   invoke:async({tool,args,signal})=>{const result=await request('tools/call',{name:tool,arguments:args},signal);
    if(result?.isError!==false&&result?.isError!==undefined)fail('BROWSER_UPSTREAM_REFUSED');}});
  return Object.freeze({...owner,
   async tools(){const result=await request('tools/list',{});if(!Array.isArray(result?.tools))fail('BROWSER_UPSTREAM_REFUSED');
    return result.tools.filter(tool=>policy.tools.includes(tool.name));},
   async destroy(input){try{return await owner.destroy(input);}finally{await server.close();}},
  });
 }catch(error){await server.close();await context.close();throw error;}
}
