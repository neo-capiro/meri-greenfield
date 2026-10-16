/** SYNTHETIC Fetch mount over canonical sessions/store. No socket or provider. */
import test from 'node:test';import assert from 'node:assert/strict';
import {applicationFixture,id} from './application-fixture.mjs';
import {createConversationInputApplication} from '../input/http.mjs';
const url='https://meri.invalid/api/conversations/input/admit';
const request=(credential,body,extra={})=>new Request(url,{method:'POST',headers:{authorization:`Bearer ${credential}`,'content-type':'application/json',...extra},body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)});

test('fixed Fetch admission returns exact no-store receipt and existing history recovers its canonical input without starting work',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service}),r=await app.handle(request(f.credential,f.input));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');const body=await r.json();assert.deepEqual(Object.keys(body).sort(),['lastSequence','replayed','request','run']);assert.equal(body.lastSequence,1);assert.equal(body.request.prompt,f.input.prompt);assert.equal(body.replayed,false);assert.equal(f.state.starts,0);const repeat=await app.handle(request(f.credential,f.input));assert.equal((await repeat.json()).replayed,true);const history=await f.post('history',{});assert.deepEqual((await history.json()).request,body.request);assert.equal(f.state.starts,0);assert.equal(f.state.runs.size,1);}finally{f.close();}
});

test('closed canonical submit body rejects binding, scopes, client and dispatch flags before persistence',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service});for(const key of ['binding','tenantId','actorId','scopes','clientId','dispatch']){const response=await app.handle(request(f.credential,{...f.input,[key]:key==='dispatch'?false:'forged'}));assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{code:'INVALID_REQUEST'}});}assert.equal(f.state.runs.size,0);assert.equal(f.state.starts,0);}finally{f.close();}
});

test('only fixed POST path is mounted; credentials, media, cursors and native Request brands fail closed',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service});for(const [req,status]of[[new Request(url,{method:'GET'}),405],[new Request(url+'?dispatch=true',{method:'POST'}),404],[new Request(url+'/other',{method:'POST'}),404],[new Request(url,{method:'POST'}),401],[request(f.credential,f.input,{'content-type':'text/plain'}),415],[request(f.credential,f.input,{'content-encoding':'gzip'}),415],[request(f.credential,f.input,{'last-event-id':'1'}),400],[request(f.credential,f.input,{'x-meri-resume-sequence':'1'}),400],[{},400]])assert.equal((await app.handle(req)).status,status);let traps=0;assert.equal((await app.handle(new Proxy({},{get(){traps++;throw Error('private');}}))).status,400);assert.equal(traps,0);assert.equal(f.state.runs.size,0);}finally{f.close();}
});

test('malformed UTF8/JSON, declared lengths and public byte caps prevent admission',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service});for(const [body,headers,status]of[['{',{},400],[new Uint8Array([0xff]),{},400],['{}',{'content-length':'5'},400],['{}',{'content-length':'-1'},400],['{}',{'content-length':'131073'},413],[' '.repeat(131073),{},413]])assert.equal((await app.handle(request(f.credential,body,headers))).status,status);assert.equal(f.state.runs.size,0);assert.equal(f.state.starts,0);}finally{f.close();}
});

test('revoked session cannot admit, replay or release stored prompt bytes',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service});assert.equal((await app.handle(request(f.credential,f.input))).status,200);f.state.revoked=true;const denied=await app.handle(request(f.credential,f.input));assert.equal(denied.status,403);assert.equal((await denied.text()).includes(f.input.prompt),false);assert.equal(f.state.starts,0);assert.equal(f.state.runs.size,1);}finally{f.close();}
});

test('conflicting input maps existing public replay error without creating another identity/event',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service});await app.handle(request(f.credential,f.input));const conflict=await app.handle(request(f.credential,{...f.input,prompt:'different'}));assert.equal(conflict.status,400);assert.deepEqual(await conflict.json(),{error:{code:'REQUEST_REPLAY_REFUSED'}});assert.equal(f.state.runs.size,1);assert.equal(f.state.events.values().next().value.length,1);assert.equal(f.state.starts,0);}finally{f.close();}
});

test('unknown persistence response exposes no stored bytes and exact history recovery remains positive',async()=>{
 const f=await applicationFixture();try{const app=createConversationInputApplication({service:f.service}),connect=f.pool.connect;f.pool.connect=async()=>{const c=await connect();return {...c,async query(sql,p){if(sql.startsWith('INSERT INTO meri_conversations.events'))f.state.commitUnknown=true;return c.query(sql,p);}};};const unknown=await app.handle(request(f.credential,f.input));assert.equal(unknown.status,502);assert.deepEqual(await unknown.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});f.pool.connect=connect;f.state.commitUnknown=false;const history=await f.service.history({credential:f.credential});assert.equal(history.request.requestId,f.input.requestId);assert.equal((await (await app.handle(request(f.credential,f.input))).json()).replayed,true);assert.equal(f.state.starts,0);}finally{f.close();}
});

test('HTTP body read/admission share one abortable deadline and cancellation never calls dispatch/cancel',async()=>{
 const f=await applicationFixture();try{let aborted=false,calls=0;const service={async admitInput({signal}){calls++;await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();},{once:true}));signal.throwIfAborted();}},app=createConversationInputApplication({service,maxRequestMs:20});const expired=await app.handle(request(f.credential,f.input));assert.equal(expired.status,408);assert.equal(aborted,true);assert.equal(calls,1);const controller=new AbortController();controller.abort();const cancelled=new Request(url,{method:'POST',headers:{authorization:`Bearer ${f.credential}`,'content-type':'application/json'},body:JSON.stringify(f.input),signal:controller.signal});assert.equal((await app.handle(cancelled)).status,408);assert.equal(calls,1);assert.equal(f.state.starts,0);assert.equal(f.state.cancels,0);}finally{f.close();}
});

test('response cap and canonical closed response shape fail as content-free unavailable',async()=>{
 const f=await applicationFixture();try{const saved=await f.service.admitInput({credential:f.credential,input:f.input});for(const app of [createConversationInputApplication({service:{async admitInput(){return {...saved,dispatch:false};}}}),createConversationInputApplication({service:{async admitInput(){return saved;}},maxResponseBytes:1}),createConversationInputApplication({service:{async admitInput(){throw Error('private database detail');}}})]){const response=await app.handle(request(f.credential,f.input));assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});}assert.equal(f.state.starts,0);}finally{f.close();}
});

test('configuration cannot expand public transport limits',()=>{
 for(const options of [{maxRequestBytes:131073},{maxResponseBytes:2097153},{maxRequestMs:30001}])assert.throws(()=>createConversationInputApplication({service:{async admitInput(){}},...options}),/HTTP_CONFIGURATION/);
});
