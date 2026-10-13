/** Independent receiving controls. Execute only against root's exact frozen candidate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveConversationRequest as request,receiveConversationResponse as response,createConversationCursor,receiveConversationEvent,conversationReconnect,conversationApplicationMetadata as metadata} from '../../../../../packages/contracts/dist/conversation-application.mjs';
import {binding,scopes,versions,id} from '../../../../../apps/control/conversations/test/store-fixture.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const instant='2026-10-13T14:00:00.000Z';
const submit={requestId:id(700),prompt:'Independent request'};
const run=()=>({binding:structuredClone(binding),state:'running',scopes:structuredClone(scopes),createdAt:instant,policyRevision:scopes[0].policyRevision,versions:structuredClone(versions)});
const event=(sequence=1,eventId=id(800+sequence))=>({contractVersion:'0.1.0',eventId,binding:structuredClone(binding),sequence,createdAt:instant,scopes:structuredClone(scopes),type:'message.delta',data:{messageId:id(900),text:'Independent delta'}});
const stored=()=>({...submit,skill:null,window:null,windowRequest:null});
const history=()=>({run:run(),request:stored(),events:[event(1),event(2)],nextSequence:2,hasMore:false,lastSequence:2});
const admitted=async()=>response('submit',200,bytes({run:run(),requestId:submit.requestId,lastSequence:2,replayed:false}),request('submit',bytes(submit)));
const page=async(value=history(),req={},view)=>response('history',200,bytes(value),request('history',bytes(req)),view);

test('all four exact closed browser commands and package/wire metadata are admitted without authority',()=>{
 const examples={submit,history:{after:0,limit:2},cancel:{},events:{command:{conversationId:binding.conversationId,intent:'view.subscribe'}}};
 for(const [route,input]of Object.entries(examples)){const out=request(route,bytes(input));assert.deepEqual(out,input);assert(Object.isFrozen(out));}
 assert.equal(metadata.packageVersion,'0.1.3');assert.equal(metadata.wireContractVersion,'0.1.0');assert.equal(metadata.authentication.validationGrantsAuthority,false);
 assert.equal(metadata.routes.reconnect.path,'/api/conversations/events/{conversationId}/stream');assert(Object.isFrozen(metadata.routes));
});
for(const [label,route,input]of [
 ['submit authority','submit',{...submit,tenantId:'foreign'}],['submit unknown','submit',{...submit,unexpected:true}],['blank prompt','submit',{...submit,prompt:' \n\t'}],
 ['bad request ID','submit',{...submit,requestId:'foreign'}],['skill extra','submit',{...submit,skill:{skillId:'quick_skill.mail_history',skillVersion:'1.0.0',grants:['read']}}],
 ['unknown skill','submit',{...submit,skill:{skillId:'automatic-admin',skillVersion:'1.0.0'}}],['invalid window','submit',{...submit,windowRequest:{basis:'calendar-week',offset:3,timezone:'UTC',weekStartsOn:'monday'}}],
 ['negative history cursor','history',{after:-1}],['unsafe history cursor','history',{after:9007199254740992}],['history string cursor','history',{after:'1'}],['history excess limit','history',{limit:101}],
 ['cancel body','cancel',{runId:binding.runId}],['events authority','events',{command:{conversationId:binding.conversationId,intent:'view.subscribe',actorId:'foreign'}}],
 ['events wrong intent','events',{command:{conversationId:binding.conversationId,intent:'run.cancel'}}],['events missing command','events',{conversationId:binding.conversationId}],
 ['events extra cursor','events',{command:{conversationId:binding.conversationId,intent:'view.subscribe'},after:0}],['prototype key','cancel',JSON.parse('{"__proto__":{}}')]
])test(`request refuses ${label}`,()=>assert.throws(()=>request(route,bytes(input))));

test('byte boundary refuses malformed UTF8/JSON/Unicode, unsafe input type, resource excess and accessors',()=>{
 for(const value of [new Uint8Array([0xff]),new Uint8Array([0xc0,0xaf]),new TextEncoder().encode('{'),bytes({requestId:submit.requestId,prompt:'\ud800'}),bytes({...submit,prompt:'x'.repeat(131073)}),new Uint8Array(new SharedArrayBuffer(8)),new Proxy(new Uint8Array(),{})])assert.throws(()=>request('submit',value));
 let invoked=false;assert.throws(()=>request('submit',{get byteLength(){invoked=true;return 0;}}));assert.equal(invoked,false);
 assert.throws(()=>request('__proto__',bytes({})));assert.throws(()=>request('submit',new TextEncoder().encode('{"requestId":"'+submit.requestId+'","prompt":1e400}')));
});

test('admitted response provenance cannot be cloned or edited into request/view/cursor authority',async()=>{
 const view=await admitted(),cursor=createConversationCursor(view,0);assert.equal(conversationReconnect(cursor).headers['x-meri-resume-sequence'],'0');
 assert.throws(()=>createConversationCursor(structuredClone(view),0));assert.throws(()=>conversationReconnect({...cursor}));assert.throws(()=>view.run.binding.writerFence=99);
 await assert.rejects(response('submit',200,bytes({run:run(),requestId:submit.requestId,lastSequence:1,replayed:false}),structuredClone(request('submit',bytes(submit)))));
 assert.equal(createConversationCursor(view).after,0);
 for(const sequence of [-1,1,2,3,Number.MAX_SAFE_INTEGER+1,'1',NaN])assert.throws(()=>createConversationCursor(view,sequence));
});

for(const [label,edit]of [
 ['wrong request ID',value=>value.requestId=id(999)],['extra output',value=>value.policyOverride=true],
 ['scope tenant',value=>value.run.scopes[0].tenantId='foreign'],['scope policy',value=>value.run.scopes[0].policyRevision='foreign'],['empty scopes',value=>value.run.scopes=[]]
])test(`submit response refuses ${label}`,async()=>{
 const value={run:run(),requestId:submit.requestId,lastSequence:2,replayed:false};edit(value);await assert.rejects(response('submit',200,bytes(value),request('submit',bytes(submit))));
});

test('content-free error statuses reject disclosure, wrong status/code and non-JSON event responses',async()=>{
 const req=request('history',bytes({}));
 for(const [status,code]of [[401,'SESSION_REFUSED'],[403,'SESSION_REFUSED'],[403,'SCOPE_REFUSED'],[400,'INVALID_CURSOR'],[404,'NOT_FOUND'],[408,'CANCELLED'],[413,'REQUEST_TOO_LARGE'],[502,'CONVERSATION_UNAVAILABLE']])assert.deepEqual(await response('history',status,bytes({error:{code}}),req),{error:{code}});
 for(const [status,value]of [[200,{error:{code:'SESSION_REFUSED'}}],[400,{error:{code:'SESSION_REFUSED'}}],[403,{error:{code:'SESSION_REFUSED',detail:'private'}}],[502,{error:{code:'PRIVATE_SOURCE'}}],[99,{error:{code:'NOT_FOUND'}}]])await assert.rejects(response('history',status,bytes(value),req));
 await assert.rejects(response('events',200,bytes(history()),request('events',bytes({command:{conversationId:binding.conversationId,intent:'view.subscribe'}}))));
});

for(const [label,edit]of [
 ['event gap',value=>value.events[1].sequence=3],['duplicate event ID',value=>value.events[1].eventId=value.events[0].eventId],
 ['reordered events',value=>value.events.reverse()],['wrong next sequence',value=>value.nextSequence=1],['wrong hasMore',value=>value.hasMore=true],
 ['wrong last sequence',value=>value.lastSequence=1],['foreign event tenant',value=>value.events[1].binding.tenantId='foreign'],
 ['foreign event run',value=>value.events[1].binding.runId=id(999)],['obsolete event attempt',value=>value.events[1].binding.attemptId=id(999)],['obsolete event fence',value=>value.events[1].binding.writerFence=99],
 ['foreign event scopes',value=>value.events[1].scopes[0].resourceId=id(999)],['oversized page',value=>value.events.push(event(3))]
])test(`history refuses ${label}`,async()=>{const value=history();edit(value);await assert.rejects(page(value,{after:0,limit:2}));});

test('history binds exact admitted view, request ID and forward cursor while preserving valid pagination',async()=>{
 const view=await admitted(),value=history();value.events=[event(1)];value.nextSequence=1;value.hasMore=true;
 const first=await page(value,{after:0,limit:1},view);assert.equal(createConversationCursor(first).after,1);
 const second=history();second.events=[event(2)];const next=await page(second,{after:1,limit:1},first);assert.equal(createConversationCursor(next).after,2);
 for(const change of [v=>v.run.binding.conversationId=id(999),v=>v.run.scopes[0].resourceId=id(999),v=>v.request.requestId=id(999)]){const v=history();change(v);await assert.rejects(page(v,{},view));}
 const empty=history();empty.events=[];await assert.rejects(page(empty,{after:0},view));
});

test('history cannot substitute immutable saved prompt after admitted submit',async()=>{
 const view=await admitted(),value=history();value.request.prompt='Substituted original prompt';await assert.rejects(page(value,{},view));
});
test('normalized explicit window cannot diverge from the original immutable request',async()=>{
 const value=history(),startInclusive='2026-10-01T00:00:00.000Z',endExclusive='2026-10-02T00:00:00.000Z';
 value.request.windowRequest={basis:'explicit',startInclusive,endExclusive,timezone:'UTC'};
 value.request.window={...value.request.windowRequest,weekStartsOn:null,startInclusive:'2026-10-01T12:00:00.000Z'};
 await assert.rejects(page(value));
});

test('received events advance exactly once, retain stable IDs and reject old cursors or duplicate IDs',async()=>{
 const view=await page(),cursor=createConversationCursor(view,0),first=receiveConversationEvent(bytes(event(1)),cursor);
 assert.equal(first.cursor.after,1);assert.equal(first.event.eventId,id(801));assert(Object.isFrozen(first.event));
 assert.throws(()=>receiveConversationEvent(bytes(event(1)),cursor));assert.throws(()=>conversationReconnect(cursor));
 assert.throws(()=>receiveConversationEvent(bytes(event(2,id(801))),first.cursor));
 const second=receiveConversationEvent(bytes(event(2)),first.cursor);assert.equal(second.cursor.after,2);
 for(const change of [v=>v.sequence=4,v=>v.binding.tenantId='foreign',v=>v.binding.runId=id(999),v=>v.binding.attemptId=id(999),v=>v.binding.writerFence=99,v=>v.scopes[0].resourceId=id(999)]){const v=event(3);change(v);assert.throws(()=>receiveConversationEvent(bytes(v),second.cursor));}
});

test('cancel response recognizes only actual terminal run states and never treats stream end as completion',async()=>{
 const req=request('cancel',bytes({}));for(const state of ['completed','failed','cancelled'])assert.deepEqual(await response('cancel',200,bytes({state}),req),{state});
 for(const state of ['running','queued','stream-ended'])await assert.rejects(response('cancel',200,bytes({state}),req));
 assert.match(metadata.stream.completion,/subscription ended/u);assert.match(metadata.stream.abort,/cleanup only/u);
});


test('partial history cannot acknowledge unseen lastSequence or rewind before its admitted range',async()=>{
 const value=history();value.events=[event(1)];value.nextSequence=1;value.lastSequence=100;value.hasMore=true;
 const view=await page(value,{after:0,limit:1});assert.equal(createConversationCursor(view).after,1);
 for(const sequence of [2,50,100])assert.throws(()=>createConversationCursor(view,sequence));
 const middle=history();middle.events=[event(10)];middle.nextSequence=10;middle.lastSequence=11;middle.hasMore=true;
 const middleView=await page(middle,{after:9,limit:1});assert.throws(()=>createConversationCursor(middleView,8));assert.equal(createConversationCursor(middleView,9).after,9);
});

test('cursor replay memory has a finite checkpoint boundary',async()=>{
 let cursor=createConversationCursor(await page(),0);
 for(let sequence=1;sequence<=10000;sequence++)cursor=receiveConversationEvent(bytes(event(sequence,id(10000+sequence))),cursor).cursor;
 assert.equal(cursor.after,10000);assert.throws(()=>receiveConversationEvent(bytes(event(10001,id(20001))),cursor),/CURSOR_CHECKPOINT_REQUIRED/u);
 const checkpoint=history();checkpoint.events=[];checkpoint.nextSequence=10000;checkpoint.lastSequence=10000;
 const view=await page(checkpoint,{after:10000});const refreshed=createConversationCursor(view);
 assert.equal(receiveConversationEvent(bytes(event(10001,id(20001))),refreshed).cursor.after,10001);
});

test('source.available retains exact supplied source provenance and rejects nested scopes outside the admitted view',async()=>{
 const source=event(1);source.type='source.available';source.data={sourceId:'synthetic-source',recordId:'source-record',sourceVersionId:'immutable-v1',observedAt:instant,sourceUpdatedAt:null,citationId:id(940),scopes:structuredClone(scopes),contentSha256:'a'.repeat(64),authorizationDecisionId:id(941)};
 const view=await page(),received=receiveConversationEvent(bytes(source),createConversationCursor(view,0));
 assert.deepEqual(received.event.data,source.data);assert.equal(received.event.data.sourceVersionId,'immutable-v1');
 for(const mutate of [value=>value.data.scopes[0].tenantId='foreign',value=>value.data.scopes[0].resourceId=id(999),value=>value.data.scopes[0].policyRevision='foreign']){
  const changed=structuredClone(source);mutate(changed);assert.throws(()=>receiveConversationEvent(bytes(changed),createConversationCursor(view,0)));
 }
 const changed=history();changed.events[0]=structuredClone(source);changed.events[0].data.scopes[0].resourceId=id(999);await assert.rejects(page(changed));
});
