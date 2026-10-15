/** Qualification-only Messages API stand-in for composed rehearsals: an HTTPS server that answers POST /v1/messages with one
 * canned streamed text reply and refuses everything else. It never contacts a provider and carries no credential. The CLI
 * trusts it only when the host running the rehearsal maps the configured proxy host to this listener and trusts its
 * certificate; those two host-level bindings are the environment owner's decision, never made by this module. */
import {createServer} from 'node:https';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
const REPLY='Rehearsal stand-in reply: no provider was contacted.';
function sse(events){return events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');}
export async function startProviderStandIn(configuration){
 const c=own(configuration,['certFile','keyFile'],['host','port','reply','model']),host=c.host??'127.0.0.1',port=c.port??0,reply=c.reply??REPLY,calls=[];
 const server=createServer({cert:readFileSync(c.certFile),key:readFileSync(c.keyFile)},async(req,res)=>{
  const chunks=[];for await(const part of req)chunks.push(part);const body=Buffer.concat(chunks).toString('utf8');
  const call={at:new Date().toISOString(),method:req.method,path:req.url,authorizationPresent:typeof req.headers.authorization==='string'||typeof req.headers['x-api-key']==='string',bytes:body.length};calls.push(call);
  if(req.method!=='POST'||req.url!=='/v1/messages'){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({type:'error',error:{type:'not_found_error',message:'stand-in serves only POST /v1/messages'}}));return;}
  let request;try{request=JSON.parse(body);}catch{res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({type:'error',error:{type:'invalid_request_error',message:'invalid JSON'}}));return;}
  call.model=request.model??null;call.messages=Array.isArray(request.messages)?request.messages.length:null;call.stream=request.stream===true;
  const id='msg_standin_'+calls.length,model=c.model??request.model??'stand-in',usage={input_tokens:0,output_tokens:0};
  if(request.stream===true){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});res.end(sse([['message_start',{type:'message_start',message:{id,type:'message',role:'assistant',model,content:[],stop_reason:null,stop_sequence:null,usage}}],['content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}}],['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text:reply}}],['content_block_stop',{type:'content_block_stop',index:0}],['message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:0}}],['message_stop',{type:'message_stop'}]]));return;}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({id,type:'message',role:'assistant',model,content:[{type:'text',text:reply}],stop_reason:'end_turn',stop_sequence:null,usage}));
 });
 server.listen(port,host);await once(server,'listening');
 return Object.freeze({host,port:server.address().port,reply,calls,close:()=>new Promise(resolve=>server.close(()=>resolve()))});
}
