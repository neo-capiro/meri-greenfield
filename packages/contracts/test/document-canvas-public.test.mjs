/** Public canvas boundary: canonical document validators, no private source or authority. */
import test from 'node:test';import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {receiveCanvasRequest,receiveCanvasResponse} from '@capiro/meri-contracts/document-canvas';
const encode=value=>new TextEncoder().encode(JSON.stringify(value));
function fixture(){
 const bytes=encode('Synthetic source'),sha256=createHash('sha256').update(bytes).digest('hex');
 const scopes=[{tenantId:'synthetic',kind:'client',resourceId:randomUUID(),policyRevision:'r1'}];
 const binding={tenantId:'synthetic',actorId:'synthetic-actor',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const version={contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,binding,
  object:{objectId:randomUUID(),versionId:'immutable-1',sha256,bytes:bytes.length,scopes},filename:'Synthetic.txt',mimeType:'text/plain; charset=utf-8',scopes,evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-11-04T00:00:00.000Z'};
 const inspection={sha256,bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'},currentBytesVerified:true};
 const request={operation:'create_word',format:'txt',title:'Synthetic',content:{text:'Full editable source\n'}};
 const selection={artifactId:version.artifactId,versionId:version.versionId,objectSha256:sha256};
 const source={version,inspection,request,headVersionId:version.versionId};
 return {selection,source,request};
}
test('read correlates an immutable source with exact selector and canonical inspection',async()=>{
 const f=fixture(),q=receiveCanvasRequest('canvas-read',encode({selection:f.selection}));
 const source=await receiveCanvasResponse('canvas-read',200,encode(f.source),q);
 assert.deepEqual(source,f.source);assert(Object.isFrozen(q.selection));assert(Object.isFrozen(source.request.content));
 await assert.rejects(receiveCanvasResponse('canvas-read',200,encode(f.source),structuredClone(q)));
});
test('source receiver refuses foreign, unverified, widened and unsupported sources',async()=>{
 const f=fixture(),q=receiveCanvasRequest('canvas-read',encode({selection:f.selection}));
 for(const mutate of [s=>s.version.artifactId=randomUUID(),s=>s.version.object.sha256='f'.repeat(64),s=>s.inspection.currentBytesVerified=false,
  s=>s.assets=[],s=>s.request.format='xml',s=>s.request.sourceKind='meri.office-edit/1',s=>s.request.title='Substituted',s=>s.headVersionId='not-a-version']){
  const source=structuredClone(f.source);mutate(source);await assert.rejects(receiveCanvasResponse('canvas-read',200,encode(source),q));
 }
});
test('canvas requests expose no authority and accept only DOCX/TXT canonical content',()=>{
 const f=fixture();
 for(const raw of [{selection:{...f.selection,credential:'authority'}},{selection:f.selection,assets:[]},{selection:{...f.selection,objectSha256:'F'.repeat(64)}}])assert.throws(()=>receiveCanvasRequest('canvas-read',encode(raw)));
 const save={selection:f.selection,deliveryId:'save-1',request:f.request};
 assert.deepEqual(receiveCanvasRequest('canvas-save',encode(save)),save);
 for(const raw of [{...save,retained:{}},{...save,request:{...f.request,format:'xml'}},{...save,request:{...f.request,operation:'create_powerpoint',format:'pptx'}},{...save,request:{...f.request,content:{text:'\ud800'}}}])assert.throws(()=>receiveCanvasRequest('canvas-save',encode(raw)));
 assert.throws(()=>receiveCanvasRequest('canvas-read',new Uint8Array(8193)));
});
test('save returns a standard created receipt bound to exact parent and artifact',async()=>{
 const f=fixture(),q=receiveCanvasRequest('canvas-save',encode({selection:f.selection,deliveryId:'save-1',request:f.request}));
 const {currentBytesVerified,...inspection}=f.source.inspection;
 const created={version:{...f.source.version,versionId:randomUUID(),parentVersionId:f.selection.versionId},inspection,
  execution:{requestSha256:'a'.repeat(64),authorizationReceiptId:'synthetic-receipt',budgetTicketId:'synthetic-budget',objectCommitted:true,versionCommitted:true,nativeQualified:false}};
 assert.deepEqual(await receiveCanvasResponse('canvas-save',200,encode(created),q),created);
 for(const mutate of [s=>s.version.artifactId=randomUUID(),s=>s.version.parentVersionId=randomUUID(),s=>s.version.versionId=f.selection.versionId]){
  const changed=structuredClone(created);mutate(changed);await assert.rejects(receiveCanvasResponse('canvas-save',200,encode(changed),q));
 }
 for(const [status,code,outcome] of [[409,'CONFLICT','NOT_DISPATCHED'],[502,'ARTIFACT_EFFECT_UNKNOWN','UNKNOWN'],[408,'DEADLINE','RESULT_NOT_RELEASED']]){
  const error={error:{code,outcome}};assert.deepEqual(await receiveCanvasResponse('canvas-save',status,encode(error),q),error);
  await assert.rejects(receiveCanvasResponse('canvas-save',200,encode(error),q));
 }
});
test('packed browser receiver has no Node globals or external imports',async()=>{
 const f=fixture(),path=fileURLToPath(new URL('../dist/document-canvas.mjs',import.meta.url));
 const script=`import{readFileSync}from'node:fs';import{SourceTextModule,createContext}from'node:vm';import{webcrypto}from'node:crypto';const c=createContext({TextEncoder,TextDecoder,crypto:webcrypto});const m=new SourceTextModule(readFileSync(${JSON.stringify(path)},'utf8'),{context:c});await m.link(()=>{throw Error('external import')});await m.evaluate({timeout:2000});const e=v=>new TextEncoder().encode(JSON.stringify(v)),q=m.namespace.receiveCanvasRequest('canvas-read',e({selection:${JSON.stringify(f.selection)}}));const r=await m.namespace.receiveCanvasResponse('canvas-read',200,e(${JSON.stringify(f.source)}),q);if(r.request.content.text!=='Full editable source\\n')throw Error('source');`;
 const result=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],{timeout:10000,maxBuffer:65536});assert.equal(result.status,0,result.stderr.toString());
 const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(manifest.exports['./document-canvas'].default,'./dist/document-canvas.mjs');assert(manifest.files.includes('dist'));
});
