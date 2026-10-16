/** Focused synthetic public controls. One process; no services, provider, compiler or child process. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,cp,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
import {receiveConversationInputRequest as request,receiveConversationInputResponse as receive,conversationInputView,conversationInputMetadata as metadata,ConversationInputResponseError} from '@capiro/meri-contracts/conversation-input';
import {receiveConversationRequest,receiveConversationResponse,conversationApplicationMetadata} from '@capiro/meri-contracts/conversation-application';
import {assertConversationInputReceipt,assertInputShape} from '../conversation-input/validate.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'synthetic-input',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'p1'}];
const run={binding,scopes,state:'queued',policyRevision:'p1',createdAt:'2026-10-13T12:00:00Z',versions:{imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'}};
const input={requestId:id(6),prompt:'Hello'},context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:id(5)};
const receipt=()=>({run:structuredClone(run),request:{...input,skill:null,window:null,windowRequest:null},lastSequence:1,replayed:false});
const submitted=value=>({run:value.run,requestId:value.request.requestId,lastSequence:value.lastSequence,replayed:value.replayed});
const history=value=>({run:value.run,request:value.request,events:[],nextSequence:value.lastSequence,lastSequence:value.lastSequence,hasMore:false});

test('input metadata preserves exact canonical statuses and byte limits',()=>{
 assert.equal(metadata.packageVersion,'0.1.7');assert.equal(metadata.inputVersion,'1.0.0');assert.equal(metadata.routes.admit.path,'/api/conversations/input/admit');assert.equal(metadata.routes.admit.method,'POST');
 assert.deepEqual(metadata.limits,{requestBytes:131072,responseBytes:2097152});assert.deepEqual(metadata.errorStatuses,conversationApplicationMetadata.errorStatuses);assert.equal(metadata.authentication.validationGrantsAuthority,false);assert.ok(Object.isFrozen(metadata.limits));
});
test('strict receipt agrees across internal server assertion and public receiver',async()=>{
 const body=receipt(),received=await receive(200,bytes(body),request(bytes(input)),context);
 assert.deepEqual(received,body);assert.deepEqual(Object.keys(received).sort(),['lastSequence','replayed','request','run']);assert.ok(Object.isFrozen(received.request));assert.ok(Object.isFrozen(received.run.binding));
 assert.deepEqual(await assertConversationInputReceipt(body,input),body);assert.deepEqual(assertInputShape('ConversationInputAdmittedResponse',body),body);
 for(const change of [v=>v.dispatch=false,v=>v.request.authorized=true,v=>delete v.request.windowRequest,v=>v.lastSequence=0,v=>v.lastSequence=Number.MAX_SAFE_INTEGER+1]){const invalid=receipt();change(invalid);await assert.rejects(receive(200,bytes(invalid),request(bytes(input)),context));await assert.rejects(assertConversationInputReceipt(invalid,input));}
});
test('new requests and views share genuine canonical brands in both directions',async()=>{
 const body=receipt(),admitted=request(bytes(input));assert.deepEqual(await receiveConversationResponse('submit',200,bytes(submitted(body)),admitted),submitted(body));
 const oldRequest=receiveConversationRequest('submit',bytes(input)),received=await receive(200,bytes(body),oldRequest,context),view=conversationInputView(received);
 assert.deepEqual(await receiveConversationResponse('submit',200,bytes(submitted(body)),admitted,view),submitted(body));
 assert.deepEqual(await receiveConversationResponse('history',200,bytes(history(body)),receiveConversationRequest('history',bytes({after:1})),view),history(body));
 assert.deepEqual(await receive(200,bytes({...body,replayed:true}),admitted,context,received),{...body,replayed:true});
 assert.deepEqual(await receive(200,bytes(body),admitted,context,view),body);
 for(const currentView of [structuredClone(received),structuredClone(view),{}])await assert.rejects(receive(200,bytes(body),admitted,context,currentView),/UNADMITTED_VIEW/);
 assert.throws(()=>conversationInputView(structuredClone(received)),/UNADMITTED_VIEW/);await assert.rejects(receive(200,bytes(body),structuredClone(admitted),context),/UNADMITTED_REQUEST/);
});
for(const field of ['tenantId','actorId','conversationId','runId','clientId'])test(`positive receipt requires independent ${field} context`,async()=>{
 const expected={...context,[field]:['tenantId','actorId'].includes(field)?'foreign':id(90)};
 await assert.rejects(receive(200,bytes(receipt()),request(bytes(input)),expected),/INPUT_CONTEXT_MISMATCH/);
});
test('expected context is mandatory, closed, bounded and rejects accessors before reading them',async()=>{
 const cases=[undefined,null,{},input,{...context,scope:'forged'},{...context,tenantId:'x'.repeat(129)},{...context,clientId:'bad'}];
 for(const expected of cases)await assert.rejects(receive(200,bytes(receipt()),request(bytes(input)),expected),/INPUT_CONTEXT_INVALID/);
 let calls=0;const accessor={...context};Object.defineProperty(accessor,'clientId',{enumerable:true,get(){calls++;return context.clientId;}});
 await assert.rejects(receive(200,bytes(receipt()),request(bytes(input)),accessor),/INPUT_CONTEXT_INVALID/);assert.equal(calls,0);
});
test('context cannot be inferred from a wholly foreign but self-consistent receipt',async()=>{
 const body=receipt();body.run.binding.tenantId='foreign';body.run.scopes[0].tenantId='foreign';await assert.rejects(receive(200,bytes(body),request(bytes(input)),context),/INPUT_CONTEXT_MISMATCH/);
 const missing=receipt();missing.run.scopes[0].resourceId=id(91);await assert.rejects(receive(200,bytes(missing),request(bytes(input)),context),/INPUT_CONTEXT_MISMATCH/);
});
for(const [name,change]of [['request identity',v=>v.request.requestId=id(7)],['prompt',v=>v.request.prompt='Replaced'],['window request',v=>v.request.windowRequest={basis:'unbounded'}],['stored skill',v=>v.request.skill={skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0',manifestSha256:'a'.repeat(64),proseSha256:'b'.repeat(64),catalogSha256:'c'.repeat(64)}]])test(`full immutable ${name} correlates with the genuine submit input`,async()=>{
 const body=receipt();change(body);await assert.rejects(receive(200,bytes(body),request(bytes(input)),context));await assert.rejects(assertConversationInputReceipt(body,input));
});
test('canonical normalized window pairs and selected skill pins retain exact full identity on replay',async()=>{
 const specified={basis:'explicit',startInclusive:'2026-01-01T00:00:00Z',endExclusive:'2026-02-01T00:00:00Z',timezone:'Etc/UTC'},selected={skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'},original={...input,skill:selected,windowRequest:specified},body=receipt();
 Object.assign(body.request,{skill:{...selected,manifestSha256:'a'.repeat(64),proseSha256:'b'.repeat(64),catalogSha256:'c'.repeat(64)},windowRequest:specified,window:{...specified,weekStartsOn:null}});
 const admitted=request(bytes(original)),first=await receive(200,bytes(body),admitted,context);assert.deepEqual(await assertConversationInputReceipt(body,original),body);
 for(const change of [v=>v.request.window.endExclusive='2026-03-01T00:00:00Z',v=>v.request.windowRequest.timezone='America/New_York',v=>v.request.skill.skillVersion='2.0.0']){const bad=structuredClone(body);change(bad);await assert.rejects(receive(200,bytes(bad),admitted,context));}
 for(const field of ['manifestSha256','proseSha256','catalogSha256']){const bad=structuredClone(body);bad.request.skill[field]='d'.repeat(64);await assert.rejects(receive(200,bytes(bad),admitted,context,first),/REQUEST_MISMATCH/);}
});
test('fiscal and relative windows reuse existing semantic verification',async()=>{
 for(const [specified,normalized,field,wrong]of [
  [{basis:'fiscal-year',year:2027,calendarId:'us-federal',stage:'requested',revisionId:'request-v1',timezone:'Etc/UTC'},{basis:'fiscal-year',year:2027,calendarId:'us-federal',stage:'requested',revisionId:'request-v1',timezone:'Etc/UTC',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2027-10-01T00:00:00Z'},'stage','actual'],
  [{basis:'relative-duration',days:7,anchorAt:'2026-03-09T04:00:00Z',timezone:'America/New_York'},{basis:'relative-duration',timezone:'America/New_York',startInclusive:'2026-03-02T04:00:00Z',endExclusive:'2026-03-09T04:00:00Z',weekStartsOn:null},'startInclusive','2026-03-02T05:00:00Z'],
 ]){const body=receipt(),original={...input,windowRequest:specified},admitted=request(bytes(original));Object.assign(body.request,{windowRequest:specified,window:normalized});await receive(200,bytes(body),admitted,context);const bad=structuredClone(body);bad.request.window[field]=wrong;await assert.rejects(receive(200,bytes(bad),admitted,context),/WINDOW_MISMATCH/);}
});
test('subsequent responses cannot change binding, scopes, retained request or regress the sequence',async()=>{
 const body=receipt(),admitted=request(bytes(input)),first=await receive(200,bytes({...body,lastSequence:3}),admitted,context);
 for(const change of [v=>v.run.binding.attemptId=id(40),v=>v.run.binding.workerId=id(41),v=>v.run.binding.writerFence++,v=>v.run.scopes.push({...scopes[0],resourceId:id(42)}),v=>v.request.prompt='Replaced',v=>v.lastSequence=2]){const bad={...receipt(),lastSequence:3};change(bad);await assert.rejects(receive(200,bytes(bad),admitted,context,first));}
});
test('admission replay allows every canonical run state without claiming provider execution',async()=>{
 for(const state of ['queued','starting','running','waiting-for-approval','paused','completed','failed','cancelled']){const body=receipt();body.run.state=state;body.replayed=true;assert.equal((await receive(200,bytes(body),request(bytes(input)),context)).run.state,state);}
});
test('canonical error statuses, request provenance, and bytes remain enforced',async()=>{
 const admitted=request(bytes(input));for(const[code,statuses]of Object.entries(metadata.errorStatuses))for(const status of statuses){const body={error:{code}};assert.deepEqual(await receive(status,bytes(body),admitted,context),body);}
 for(const [status,body]of [[200,{error:{code:'CONVERSATION_UNAVAILABLE'}}],[299,receipt()],[500,{error:{code:'SESSION_REFUSED'}}],[502,{error:{code:'PRIVATE_FAILURE'}}]])await assert.rejects(receive(status,bytes(body),admitted,context));
 await assert.rejects(receive(403,bytes({error:{code:'SESSION_REFUSED'}}),structuredClone(admitted),context),/UNADMITTED_REQUEST/);
 for(const value of [new Uint8Array([255]),new TextEncoder().encode('{"__proto__":{}}'),bytes({...input,prompt:'\ud800'}),new Uint8Array(metadata.limits.requestBytes+1)])assert.throws(()=>request(value),ConversationInputResponseError);
 await assert.rejects(receive(200,new Uint8Array(metadata.limits.responseBytes+1),admitted,context),/BYTE_LIMIT/);let traps=0;assert.throws(()=>request(new Proxy({},{get(){traps++;throw Error('trap');}})));assert.equal(traps,0);
});
test('input-only generation records exact canonical provenance and one shared browser import',async()=>{
 const source=await readFile(new URL('../dist/conversation-input.mjs',import.meta.url),'utf8');assert.match(source,/from ["']\.\/conversation-application\.mjs["']/u);assert.doesNotMatch(source,/from ["']node:|require\(["']node:/u);
 const evidence=JSON.parse(await readFile(new URL('../dist/conversation-input.metadata.json',import.meta.url),'utf8'));assert.equal(evidence.packageVersion,'0.1.7');assert.equal(evidence.browserImports.length,1);assert.equal(evidence.browserImports[0].path,'./conversation-application.mjs');
 for(const row of evidence.sources){const raw=await readFile(new URL('../'+row.path,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),row.sha256,row.path);}
 assert.equal(evidence.browserImports[0].sha256,evidence.sources.find(row=>row.path==='dist/conversation-application.mjs').sha256);
});
test('offline public package preserves cross-entrypoint brands and private source boundaries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'meri-input-consumer-'));try{
  const pkg=join(root,'node_modules/@capiro/meri-contracts');await mkdir(pkg,{recursive:true});for(const path of ['package.json','dist'])await cp(new URL('../'+path,import.meta.url),join(pkg,path),{recursive:true});
  const resolver=createRequire(pathToFileURL(join(root,'consumer.cjs'))),installed=await import(pathToFileURL(resolver.resolve('@capiro/meri-contracts/conversation-input'))),old=await import(pathToFileURL(resolver.resolve('@capiro/meri-contracts/conversation-application'))),admitted=installed.receiveConversationInputRequest(bytes(input)),body=receipt();
  const received=await installed.receiveConversationInputResponse(200,bytes(body),admitted,context);await old.receiveConversationResponse('submit',200,bytes(submitted(body)),admitted,installed.conversationInputView(received));
  assert.equal(installed.conversationInputMetadata.packageVersion,'0.1.7');assert.equal(resolver.resolve('@capiro/meri-contracts/conversation-input/schema'),join(pkg,'dist','conversation-input.schema.json'));assert.throws(()=>resolver.resolve('@capiro/meri-contracts/conversation-input/validate.mjs'));
 }finally{if(!resolve(root).startsWith(resolve(tmpdir())+sep))throw Error('Unexpected cleanup target');await rm(root,{recursive:true,force:true});}
});
