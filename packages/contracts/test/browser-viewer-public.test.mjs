import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {receiveConversationLifecycleRequest,receiveBrowserTakeoverControlResponse} from '@capiro/meri-contracts/conversation-lifecycle';
import {generateBrowserViewerContracts} from '../generate-browser-viewer.mjs';
import {BROWSER_VIEWER_SCHEMA as schema,receiveBrowserViewerRequest as request,
 receiveBrowserViewerResponse as receive,browserViewerPng} from '@capiro/meri-contracts/browser-viewer';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,encode=v=>new TextEncoder().encode(JSON.stringify(v));
const context={tenantId:id(1),actorId:id(2),conversationId:id(3),runId:id(4),selectedClientId:null};
const lease={viewerId:id(7),leaseEpoch:1,expiresAtMs:10000,connectRequestId:id(8)};
const {selectedClientId,...identifiers}=context,binding={...identifiers,attemptId:id(20),workerId:id(21),writerFence:1};
const current={schema,context,binding,checkpoint:{checkpointId:context.runId,checkpointSha256:'a'.repeat(64)},ownerId:id(5),state:'user',lease,pages:[{pageId:id(9),origin:'https://example.invalid'}]};
const frameRequest={schema,requestId:id(10),ownerId:id(5),viewerId:id(7),leaseEpoch:1,pageId:id(9)};
function png(width=1,height=1){const p=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGZkAAAAASUVORK5CYII=','base64');p.writeUInt32BE(width,16);p.writeUInt32BE(height,20);return p;}
function frameResponse(){const {pageId,...base}=frameRequest;return {...base,context,frame:{pageId,frameId:'F'.repeat(43),width:1,height:1,image:{mimeType:'image/png',data:png().toString('base64')}}};}

test('current state is bound to the authenticated account/chat and contains only safe page origins',()=>{
 const q=request('read',encode({schema}));assert.deepEqual(receive('read',200,encode(current),q,context),current);
 for(const change of [{...current,context:{...context,actorId:id(90)}},{...current,lease:null},
  {...current,state:'returning'},{...current,pages:[{pageId:id(9),origin:'https://example.invalid/?token=secret'}]},
  {...current,pages:[...current.pages,...current.pages]}])assert.throws(()=>receive('read',200,encode(change),q,context));
});
test('one-use ticket and connection readback bind the original request and current owner',()=>{
 const q=request('ticket',encode({schema,requestId:id(10)}));
 const r={schema,context,ownerId:id(5),requestId:id(10),ticket:'T'.repeat(43),expiresAtMs:2000};
 assert.equal(receive('ticket',200,encode(r),q,context).ticket,r.ticket);
 assert.throws(()=>receive('ticket',200,encode({...r,ownerId:null}),q,context));
 const connect=request('connect',encode({schema,requestId:id(8),ticket:r.ticket}));
 const connected={schema,context,ownerId:id(5),requestId:id(8),state:'user',lease};
 assert.deepEqual(receive('connect',200,encode(connected),connect,context),connected);
 assert.throws(()=>receive('connect',200,encode({...connected,lease:{...lease,connectRequestId:id(90)}}),connect,context));
});
test('only admitted PNG bytes bound to the requested page and exact lease may become an image',()=>{
 const q=request('frame',encode(frameRequest)),r=frameResponse(),accepted=receive('frame',200,encode(r),q,context);
 assert.deepEqual(browserViewerPng(accepted.frame),new Uint8Array(png()));
 assert.throws(()=>browserViewerPng({...accepted.frame}));
 const bytes=browserViewerPng(accepted.frame);bytes[0]=0;assert.equal(browserViewerPng(accepted.frame)[0],137);
 for(const frame of [{...r.frame,pageId:id(90)},{...r.frame,width:2},{...r.frame,image:{mimeType:'image/svg+xml',data:'PHN2Zz4='}},
  {...r.frame,image:{mimeType:'image/png',data:png(2,2).toString('base64')}}])assert.throws(()=>receive('frame',200,encode({...r,frame}),q,context));
 assert.throws(()=>receive('frame',200,encode({...r,leaseEpoch:2}),q,context));
});
test('input is limited to the current displayed frame and supported device events',()=>{
 const input={...frameRequest,frameId:'F'.repeat(43),events:[{type:'mouse',action:'down',x:0,y:0,button:'left'}]};
 assert.deepEqual(request('input',encode(input)),input);
 for(const events of [[{type:'paste',text:'secret'}],[{type:'key',action:'down',key:'Control',shift:false}],
  [{type:'mouse',action:'down',x:-1,y:0,button:'left'}],Array.from({length:65},()=>input.events[0]),[]])
  assert.throws(()=>request('input',encode({...input,events})));
 assert.throws(()=>request('input',encode({...input,frameId:''})));
 assert.throws(()=>request('input',encode({...input,authorized:true})));
});
test('unknown writes remain unknown and cannot be reported as successful control',()=>{
 const q=request('release',encode({schema,ownerId:id(5),viewerId:id(7),leaseEpoch:1,requestId:id(10)}));
 const failure={schema,error:{code:'REFUSED',outcome:'UNKNOWN'}};
 assert.deepEqual(receive('release',502,encode(failure),q,context),failure);
 assert.throws(()=>receive('release',200,encode(failure),q,context));
 assert.throws(()=>receive('release',502,encode({...failure,error:{code:['REFUSED'],outcome:'UNKNOWN'}}),q,context));
 assert.throws(()=>receive('release',502,encode(failure),{...q},context));
});
test('the generated public receiver runs without Node imports or host authority',async()=>{
 await generateBrowserViewerContracts({check:true});
 const realm=vm.createContext({TextEncoder,TextDecoder,atob,btoa,URL});
 const module=new vm.SourceTextModule(await readFile(new URL('../dist/browser-viewer.mjs',import.meta.url),'utf8'),{context:realm});
 await module.link(()=>{throw Error('External dependency');});await module.evaluate();
 const q=module.namespace.receiveBrowserViewerRequest('read',encode({schema}));
 assert.equal(module.namespace.receiveBrowserViewerResponse('read',200,encode(current),q,context).state,'user');
 assert.equal(vm.runInContext('typeof process',realm),'undefined');
});
test('browser-only return uses canonical lifecycle correlation and requires an admitted browser read',async()=>{
 const read=receive('read',200,encode(current),request('read',encode({schema})),context);
 const input={controlId:id(22),intent:'takeover.end',...current.checkpoint};
 const q=receiveConversationLifecycleRequest('control',encode(input));
 const receipt={controlId:input.controlId,intent:input.intent,sourceBinding:binding,inputSha256:createHash('sha256').update(canonicalize(input)).digest('hex'),state:'PENDING',checkpointId:context.runId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};
 assert.deepEqual(await receiveBrowserTakeoverControlResponse(200,encode(receipt),q,read),receipt);
 await assert.rejects(receiveBrowserTakeoverControlResponse(200,encode(receipt),q,{...read}),/UNADMITTED_VIEW/u);
 await assert.rejects(receiveBrowserTakeoverControlResponse(200,encode({...receipt,inputSha256:'b'.repeat(64)}),q,read),/REQUEST_MISMATCH/u);
 await assert.rejects(receiveBrowserTakeoverControlResponse(200,encode({...receipt,sourceBinding:{...binding,writerFence:2}}),q,read),/VIEW_MISMATCH/u);
 const pause=receiveConversationLifecycleRequest('control',encode({controlId:id(23),intent:'pause'}));
 await assert.rejects(receiveBrowserTakeoverControlResponse(200,encode(receipt),pause,read),/INVALID_REQUEST/u);
});
