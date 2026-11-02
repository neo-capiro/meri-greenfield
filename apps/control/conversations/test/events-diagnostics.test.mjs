/** A refused event-stream open or reconnect writes one code-only line; its public answer is unchanged. The live cases run through the
 * actual conversation HTTP owner, service and session owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveConversationRequest} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {allocatedApplicationFixture,binding} from './application-fixture.mjs';
import {createConversationApplication} from '../http.mjs';
import {createEventsDiagnostics} from '../events-diagnostics.mjs';

const other='00000000-0000-4000-8000-0000000000ee';
const reconnect=(credential,conversationId=binding.conversationId)=>new Request(`https://meri.invalid/api/conversations/events/${conversationId}/stream`,{headers:{...(credential?{authorization:`Bearer ${credential}`}:{}),'x-meri-resume-sequence':'0'}});
const open=(credential,conversationId)=>new Request('https://meri.invalid/api/conversations/events',{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify({command:{conversationId,intent:'view.subscribe'}})});
const line=(route,status,code)=>({event:'MERI_EVENTS_CONTROL',route,outcome:'refused',status,code});

async function settledRun(){
 const f=await allocatedApplicationFixture();
 const request=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(f.input)));
 assert.equal((await f.post('submit',request)).status,200);assert.equal((await f.post('cancel',{})).status,200);
 const lines=[],app=createConversationApplication({service:f.service,historyDiagnostics:()=>undefined,eventsDiagnostics:createEventsDiagnostics({write:value=>lines.push(JSON.parse(value))})});
 return {f,lines,app};
}

test('a refused reconnect or open logs its own 403 code; an accepted window and other routes log nothing',async()=>{
 const {f,lines,app}=await settledRun();
 try{
  const accepted=await app.handle(reconnect(f.credential));assert.equal(accepted.status,200);await accepted.text();
  assert.deepEqual(lines,[]);
  for(const [request,route] of [[reconnect(f.credential,other),'reconnect'],[open(f.credential,other),'events']]){
   const refused=await app.handle(request);
   assert.deepEqual({status:refused.status,body:await refused.json()},{status:403,body:{error:{code:'CONVERSATION_SELECTOR_REFUSED'}}});
   assert.deepEqual(lines.pop(),line(route,403,'CONVERSATION_SELECTOR_REFUSED'));
  }
  // A credential control no longer holds (expired or revoked) is refused before any Core recheck, which logs nothing of its own.
  f.sessions.revoke(f.credential);
  const unknown=await app.handle(reconnect(f.credential));
  assert.deepEqual({status:unknown.status,body:await unknown.json()},{status:403,body:{error:{code:'SESSION_REFUSED'}}});
  assert.deepEqual(lines,[line('reconnect',403,'SESSION_REFUSED')]);
  lines.length=0;
  const history=await app.handle(new Request('https://meri.invalid/api/conversations/history',{method:'POST',headers:{authorization:`Bearer ${f.credential}`,'content-type':'application/json'},body:'{}'}));
  assert.equal(history.status,403);assert.deepEqual(lines,[]);
 }finally{f.close();}
});

test('request refusals before the service log their code; a failing sink cannot change the answer',async()=>{
 const fails=async()=>{throw Error('unused');},service={submit:fails,history:fails,cancel:fails,observe:fails};
 const lines=[],logged=createConversationApplication({service,eventsDiagnostics:createEventsDiagnostics({write:value=>lines.push(JSON.parse(value))})});
 const broken=createConversationApplication({service,eventsDiagnostics:createEventsDiagnostics({write(){throw Error('sink unavailable');}})});
 const media=()=>new Request('https://meri.invalid/api/conversations/events',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'text/plain'},body:'{}'});
 for(const [request,status,code,route] of [[()=>reconnect(null),401,'SESSION_REFUSED','reconnect'],[media,415,'UNSUPPORTED_MEDIA_TYPE','events']]){
  const a=await logged.handle(request()),b=await broken.handle(request());
  assert.deepEqual({status:a.status,body:await a.json()},{status,body:{error:{code}}});
  assert.deepEqual({status:b.status,body:await b.json()},{status,body:{error:{code}}});
  assert.deepEqual(lines.pop(),line(route,status,code));
 }
});

test('bounded output: closed codes only, 4xx only, twenty lines and one suppression marker per minute',()=>{
 let at=0;const lines=[],report=createEventsDiagnostics({write:value=>lines.push(value),now:()=>at});
 report('events',502,'CONVERSATION_UNAVAILABLE');report('history',403,'SESSION_REFUSED');report('reconnect',403,'not a code: private');
 assert.deepEqual(lines.map(value=>JSON.parse(value)),[line('reconnect',403,'UNNAMED')]);
 for(let i=0;i<30;i++)report('reconnect',403,'SESSION_REFUSED');
 assert.equal(lines.length,21);assert.equal(lines.at(-1),'MERI_EVENTS_CONTROL_SUPPRESSED');
 at=60000;report('reconnect',403,'SCOPE_REFUSED');
 assert.deepEqual(JSON.parse(lines.at(-1)),line('reconnect',403,'SCOPE_REFUSED'));
});
