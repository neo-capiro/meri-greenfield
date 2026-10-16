/** Public distribution controls; synthetic envelopes only, no services, provider or uncontrolled children. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,cp,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {receiveConversationHistoryRequest as request,receiveConversationHistoryResponse as receive,conversationHistoryMetadata as metadata,validateConversationHistoryRequest as validRequest} from '@capiro/meri-contracts/conversation-history';
import {assertConversationHistoryRequest,assertConversationHistoryResponse} from '../conversation-history/validate.mjs';
import {PRODUCT_ERROR_STATUSES} from '../../../apps/control/product-access/http.mjs';
import {id,bytes,binding,conversation,transcript,resumed} from './conversation-history-fixture.mjs';
const input={conversationId:binding.conversationId};
test('metadata supplies exact fixed transport limits, native auth, versions and statuses',()=>{
 assert.equal(metadata.packageVersion,'0.1.6');assert.equal(metadata.historyVersion,'1.0.0');assert.equal(metadata.limits.responseBytes,2097152);assert.equal(metadata.limits.requestBytes,131072);
 assert.deepEqual(Object.values(metadata.routes).map(v=>v.path),['/api/conversations/list','/api/conversations/transcript','/api/conversations/next-turn']);assert.equal(metadata.authentication.serverSideCredentialOnly,true);assert.equal(metadata.authentication.validationGrantsAuthority,false);
 for(const[code,status]of Object.entries(PRODUCT_ERROR_STATUSES))assert.deepEqual(metadata.errorStatuses[code],[status]);assert.ok(Object.isFrozen(metadata.limits));
});
for(const [route,raw]of [['list',{}],['list',{before:null,limit:1}],['transcript',input],['nextTurn',{...input,sourceRunId:binding.runId}]])test(`shared Node/public ${route} request shape and normalization agree`,()=>{
 const admitted=request(route,bytes(raw));assert.deepEqual(admitted,raw);assert.equal(validRequest(route,bytes(raw)),true);assert.deepEqual(assertConversationHistoryRequest(route,admitted),assertConversationHistoryRequest(route,raw));assert.ok(Object.isFrozen(admitted));
});
for(const[route,raw]of [['list',{limit:null}],['list',{limit:'1'}],['list',{before:{createdAt:'not-time',conversationId:id(1)}}],['list',{tenantId:'forged'}],['transcript',{...input,after:null}],['transcript',{...input,after:-1}],['transcript',{...input,after:Number.MAX_SAFE_INTEGER+1}],['transcript',{...input,limit:101}],['transcript',{...input,clientId:id(5)}],['nextTurn',{...input,sourceRunId:null}]])test(`closed ${route} refuses ${JSON.stringify(raw)}`,()=>{assert.throws(()=>request(route,bytes(raw)));assert.throws(()=>assertConversationHistoryRequest(route,raw));});
test('byte receiving rejects hostile objects, invalid UTF8/Unicode, prototype keys and fixed bound overflow',()=>{
 let traps=0;assert.throws(()=>request('list',new Proxy({}, {get(){traps++;throw Error('trap');}})));assert.equal(traps,0);
 for(const value of [new Uint8Array([255]),new TextEncoder().encode('{"__proto__":{}}'),bytes({before:{createdAt:'\ud800',conversationId:id(1)}}),new Uint8Array(metadata.limits.requestBytes+1)])assert.throws(()=>request('list',value));
});
test('list receiving preserves suppression-short pages, ordering and exclusive cursor',async()=>{
 const r=request('list',bytes({limit:2})),body={schema:'meri.conversation-list/1',conversations:[conversation],nextBefore:{createdAt:'2026-10-16T11:00:00.000Z',conversationId:id(9)}};
 assert.deepEqual(await receive('list',200,bytes(body),r),body);assert.deepEqual(await receive('list',200,bytes({...body,conversations:[]}),r),{...body,conversations:[]});
 await assert.rejects(receive('list',200,bytes({...body,conversations:[conversation,conversation]}),r));await assert.rejects(receive('list',200,bytes(body),request('list',bytes({before:{createdAt:conversation.createdAt,conversationId:conversation.conversationId}}))));
});
test('transcript gives direct typed envelope, frozen canonical rows and distinct global/local sequences',async()=>{
 const body=resumed(),r=request('transcript',bytes({...input,limit:10}));assert.deepEqual(await receive('transcript',200,bytes(body),r),body);assert.deepEqual(assertConversationHistoryResponse('transcript',body,{...input,limit:10}),body);
 assert.equal(body.turns[0].promptLineage.logicalRequestId,body.turns[1].promptLineage.logicalRequestId);assert.notEqual(body.turns[0].request.requestId,body.turns[1].request.requestId);assert.deepEqual(body.events.map(v=>v.event.sequence),[1,1]);assert.deepEqual(body.events.map(v=>v.sequence),[1,2]);
 const tail=transcript();tail.turns=[];tail.events=[];assert.deepEqual(await receive('transcript',200,bytes(tail),request('transcript',bytes({...input,after:1}))),tail);
 const received=await receive('transcript',200,bytes(transcript()),request('transcript',bytes(input)));assert.ok(Object.isFrozen(received.turns[0].run.scopes));
});
for(const[name,mutate]of [['foreign actor',v=>v.latestRun.binding.actorId='foreign'],['foreign scope',v=>v.events[0].event.scopes=[]],['global sequence',v=>v.events[0].sequence=2],['local sequence',v=>v.events[0].event.sequence=2],['tail cursor',v=>v.nextSequence=0],['unrepresented turn',v=>v.events=[]],['request identity',v=>v.turns[0].promptLineage.logicalRequestId=id(99)]])test(`transcript refuses ${name} substitution`,async()=>{const body=transcript();mutate(body);await assert.rejects(receive('transcript',200,bytes(body),request('transcript',bytes(input))));});
test('resume lineage cannot substitute source request/root while genuine same-text submission stays distinct',async()=>{
 for(const change of [v=>v.turns[1].promptLineage.sourceRequestId=id(99),v=>v.turns[1].promptLineage.logicalRequestId=id(99)]){const body=resumed();change(body);await assert.rejects(receive('transcript',200,bytes(body),request('transcript',bytes(input))));}
 const next=resumed();next.turns[1].promptLineage={kind:'submission',logicalRequestId:next.turns[1].request.requestId,sourceBinding:null,sourceRequestId:null};assert.deepEqual(await receive('transcript',200,bytes(next),request('transcript',bytes(input))),next);
});
test('next-turn response is correlated to immutable source and exact next target fence',async()=>{
 const r=request('nextTurn',bytes({...input,sourceRunId:binding.runId})),target={...binding,runId:id(30),attemptId:id(31),workerId:id(32),writerFence:2},body={schema:'meri.conversation-turn/1',sourceBinding:binding,targetBinding:target,state:'RESERVED',replayed:true};
 assert.deepEqual(await receive('nextTurn',200,bytes(body),r),body);for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']){const bad=structuredClone(body);bad.targetBinding[field]=field==='writerFence'?3:field==='tenantId'||field==='actorId'?'foreign':field==='conversationId'?id(99):binding[field];await assert.rejects(receive('nextTurn',200,bytes(bad),r));}
 await assert.rejects(receive('nextTurn',200,bytes(body),request('nextTurn',bytes({...input,sourceRunId:id(99)}))));
});
test('request provenance, route/status/error outcome and response bounds fail closed',async()=>{
 const r=request('transcript',bytes(input));await assert.rejects(receive('transcript',200,bytes(transcript()),structuredClone(r)));await assert.rejects(receive('list',200,bytes({}),r));await assert.rejects(receive('transcript',299,bytes(transcript()),r));
 const error={error:{code:'CONVERSATION_UNAVAILABLE',outcome:'NOT_DISPATCHED'}};assert.deepEqual(await receive('transcript',503,bytes(error),r),error);await assert.rejects(receive('transcript',503,bytes({error:{...error.error,outcome:'UNKNOWN'}}),r));await assert.rejects(receive('transcript',200,bytes(error),r));
 const next=request('nextTurn',bytes({...input,sourceRunId:binding.runId}));for(const[status,code,outcome]of [[408,'DEADLINE','UNKNOWN'],[409,'MEMBERSHIP_CHANGED','RESULT_NOT_RELEASED'],[503,'CONVERSATION_TURN_UNAVAILABLE','NOT_DISPATCHED']]){const raw={error:{code,outcome}};assert.deepEqual(await receive('nextTurn',status,bytes(raw),next),raw);}
 await assert.rejects(receive('transcript',200,new Uint8Array(metadata.limits.responseBytes+1),r));
});
test('browser distribution is self-contained and offline package resolves only public exports',async()=>{
 const source=await readFile(new URL('../dist/conversation-history.mjs',import.meta.url),'utf8'),browser=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));browser.receiveConversationHistoryRequest('list',bytes({}));
 const root=await mkdtemp(join(tmpdir(),'meri-history-consumer-'));try{const pkg=join(root,'node_modules/@capiro/meri-contracts');await mkdir(pkg,{recursive:true});for(const path of ['package.json','dist'])await cp(new URL('../'+path,import.meta.url),join(pkg,path),{recursive:true});
  const resolver=createRequire(pathToFileURL(join(root,'consumer.cjs'))),resolved=resolver.resolve('@capiro/meri-contracts/conversation-history');const installed=await import(pathToFileURL(resolved));assert.equal(installed.conversationHistoryMetadata.packageVersion,'0.1.6');assert.throws(()=>resolver.resolve('@capiro/meri-contracts/conversation-history/validate.mjs'));
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected cleanup target');await rm(root,{recursive:true,force:true});}
 const metadataFile=JSON.parse(await readFile(new URL('../dist/conversation-history.metadata.json',import.meta.url),'utf8'));for(const row of metadataFile.sources){const raw=await readFile(new URL('../'+row.path,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256,row.path);}
});
