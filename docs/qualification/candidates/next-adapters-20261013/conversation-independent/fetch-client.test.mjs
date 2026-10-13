/** Actual loopback Fetch and upstream AI SDK; synthetic service identity/SQL only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {once} from 'node:events';
import {DefaultChatTransport} from '../../../../../packages/ui-stream/node_modules/ai/dist/index.js';
import {applicationFixture,binding,id} from '../../../../../apps/control/conversations/test/application-fixture.mjs';
import {receiveConversationRequest,receiveConversationResponse,createConversationCursor,receiveConversationEvent,conversationReconnect} from '../../../../../packages/contracts/dist/conversation-application.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
async function loopback(f){
 const observed=[],server=createServer(async(req,res)=>{
  const controller=new AbortController();let reader;req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded){controller.abort();void reader?.cancel().catch(()=>{});}});
  try{
   const headers=new Headers();for(let i=0;i<req.rawHeaders.length;i+=2)headers.append(req.rawHeaders[i],req.rawHeaders[i+1]);
   observed.push({method:req.method,path:req.url,resume:headers.get('x-meri-resume-sequence')});
   const request=new Request(`http://127.0.0.1:${server.address().port}${req.url}`,{method:req.method,headers,signal:controller.signal,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
   const response=await f.app.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));
   if(response.body){reader=response.body.getReader();try{while(true){const next=await reader.read();if(next.done)break;if(!res.write(next.value))await once(res,'drain');}}finally{reader.releaseLock();}}
   res.end();
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 return {origin:`http://127.0.0.1:${server.address().port}`,observed,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
const collect=async stream=>{const reader=stream.getReader(),chunks=[];try{while(true){const next=await reader.read();if(next.done)break;chunks.push(next.value);if(chunks.length>30)throw Error('STREAM_LIMIT');}return chunks;}finally{reader.releaseLock();}};
async function fixture(body){const f=await applicationFixture(),http=await loopback(f);try{return await body(f,http);}finally{await http.close();f.close();}}
const auth=f=>({authorization:`Bearer ${f.credential}`});
const post=(f,http,route,value)=>fetch(http.origin+'/api/conversations/'+route,{method:'POST',headers:{...auth(f),'content-type':'application/json'},body:JSON.stringify(value)});

test('actual POST subscription and upstream DefaultChatTransport GET reconnect preserve durable events/cursor',()=>fixture(async(f,http)=>{
 const req=receiveConversationRequest('submit',bytes(f.input)),submitted=await post(f,http,'submit',f.input);assert.equal(submitted.status,200);
 const view=await receiveConversationResponse('submit',200,new Uint8Array(await submitted.arrayBuffer()),req);
 const cancel=await post(f,http,'cancel',{});assert.equal(cancel.status,200);
 const command={command:{conversationId:binding.conversationId,intent:'view.subscribe'}};
 const initial=new DefaultChatTransport({api:http.origin+'/api/conversations/events',headers:auth(f),prepareSendMessagesRequest:()=>({body:command})});
 const chunks=await collect(await initial.sendMessages({trigger:'submit-message',chatId:binding.conversationId,messages:[],abortSignal:new AbortController().signal}));
 let cursor=createConversationCursor(view,0);const events=chunks.filter(chunk=>chunk.type==='data-meri-event');assert.equal(events.length,2);
 for(const chunk of events){assert.equal(chunk.id,chunk.data.eventId);assert.equal(chunk.transient,true);cursor=receiveConversationEvent(bytes(chunk.data),cursor).cursor;}
 assert.equal(cursor.after,2);assert.deepEqual(events.map(chunk=>chunk.data.sequence),[1,2]);
 const historyRequest=receiveConversationRequest('history',bytes({after:0,limit:1})),historyResponse=await post(f,http,'history',{after:0,limit:1});
 const checkpoint=await receiveConversationResponse('history',historyResponse.status,new Uint8Array(await historyResponse.arrayBuffer()),historyRequest,view);
 const rewind=createConversationCursor(checkpoint),reconnect=conversationReconnect(rewind);
 const transport=new DefaultChatTransport({api:http.origin+'/api/conversations/events',headers:{...auth(f),...reconnect.headers}});
 const resumed=await collect(await transport.reconnectToStream({chatId:rewind.conversationId,abortSignal:new AbortController().signal}));
 const resumedEvents=resumed.filter(chunk=>chunk.type==='data-meri-event');assert.equal(resumedEvents.length,1);assert.equal(resumedEvents[0].id,events[1].id);
 assert.equal(receiveConversationEvent(bytes(resumedEvents[0].data),rewind).cursor.after,2);
 assert(http.observed.some(call=>call.method==='POST'&&call.path==='/api/conversations/events'&&call.resume===null));
 assert(http.observed.some(call=>call.method==='GET'&&call.path===reconnect.path&&call.resume==='1'));
 assert.equal(JSON.stringify(chunks).includes(f.credential),false);
}));

test('actual mount rejects foreign selector, malformed/conflicting cursors, invalid commands and unauthenticated subscription',()=>fixture(async(f,http)=>{
 await post(f,http,'submit',f.input);await post(f,http,'cancel',{});
 const failures=[
  ['POST','/api/conversations/events',{command:{conversationId:id(999),intent:'view.subscribe'}},{},403,'CONVERSATION_SELECTOR_REFUSED'],
  ['POST','/api/conversations/events',{command:{conversationId:binding.conversationId,intent:'run.cancel'}},{},400,'INVALID_REQUEST'],
  ['POST','/api/conversations/events',{command:{conversationId:binding.conversationId,intent:'view.subscribe'},tenantId:'foreign'},{},400,'INVALID_REQUEST'],
  ['GET',`/api/conversations/events/${id(999)}/stream`,null,{},403,'CONVERSATION_SELECTOR_REFUSED'],
  ['GET',`/api/conversations/events/${binding.conversationId}/stream`,null,{'x-meri-resume-sequence':'01'},400,'INVALID_CURSOR'],
  ['GET',`/api/conversations/events/${binding.conversationId}/stream`,null,{'x-meri-resume-sequence':'9007199254740992'},400,'INVALID_CURSOR'],
  ['GET',`/api/conversations/events/${binding.conversationId}/stream`,null,{'x-meri-resume-sequence':'1','last-event-id':'1'},400,'INVALID_CURSOR'],
  ['GET',`/api/conversations/events/${binding.conversationId}/stream?after=1`,null,{},404,'NOT_FOUND'],
  ['GET',`/api/conversations/events/${binding.conversationId}/stream`,null,{'content-type':'application/json'},400,'INVALID_REQUEST'],
 ];
 for(const [method,path,body,extra,status,code]of failures){const response=await fetch(http.origin+path,{method,headers:{...auth(f),...(method==='POST'?{'content-type':'application/json'}:{}),...extra},...(body===null?{}:{body:JSON.stringify(body)})});assert.equal(response.status,status,path);assert.deepEqual(await response.json(),{error:{code}});}
 const unauthenticated=await fetch(http.origin+`/api/conversations/events/${binding.conversationId}/stream`);assert.equal(unauthenticated.status,401);assert.deepEqual(await unauthenticated.json(),{error:{code:'SESSION_REFUSED'}});
 assert.equal(f.state.cancels,1);
}));

test('actual body-reader cancellation closes only subscription and leaves durable run queued',()=>fixture(async(f,http)=>{
 await post(f,http,'submit',f.input);
 const response=await post(f,http,'events',{command:{conversationId:binding.conversationId,intent:'view.subscribe'}});assert.equal(response.status,200);
 const reader=response.body.getReader();assert.equal((await reader.read()).done,false);await reader.cancel();reader.releaseLock();
 assert.equal(f.state.cancels,0);assert.equal((await f.service.history({credential:f.credential})).run.state,'queued');
}));

test('actual current-session revocation prevents reconnect release without leaking identity or source details',()=>fixture(async(f,http)=>{
 await post(f,http,'submit',f.input);f.state.revoked=true;
 const response=await fetch(http.origin+`/api/conversations/events/${binding.conversationId}/stream`,{headers:auth(f)});
 assert.equal(response.status,403);const text=await response.text();assert.equal(text.includes(f.credential),false);assert.equal(text.includes('synthetic-native'),false);assert.deepEqual(JSON.parse(text),{error:{code:'SESSION_REFUSED'}});assert.equal(f.state.cancels,0);
}));


test('actual malformed client JSON/UTF8 remains a bounded client error without source dispatch',()=>fixture(async(f,http)=>{
 for(const body of ['{',new Uint8Array([0xff])]){
  const response=await fetch(http.origin+'/api/conversations/submit',{method:'POST',headers:{...auth(f),'content-type':'application/json'},body});
  assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{code:'INVALID_REQUEST'}});
 }
 const oversized=await fetch(http.origin+'/api/conversations/submit',{method:'POST',headers:{...auth(f),'content-type':'application/json'},body:'x'.repeat(131073)});
 assert.equal(oversized.status,413);assert.deepEqual(await oversized.json(),{error:{code:'REQUEST_TOO_LARGE'}});assert.equal(f.state.starts,0);
}));
