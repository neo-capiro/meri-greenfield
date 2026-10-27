/** Actual immutable prior package parity, plus explicit new named receiving surfaces. Synthetic bytes only. */
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {join} from 'node:path';import {readFile} from 'node:fs/promises';
import * as current from '../dist/document-access-application.mjs';import * as runs from '../dist/conversation-history.mjs';
import {record} from '../../../apps/artifacts/storage/test/sql-fixture.mjs';import {ARTIFACT_MIME_TYPES} from '../artifacts-0.2/artifact-formats.mjs';import {createHash} from 'node:crypto';
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)),payload=new TextEncoder().encode('Immutable synthetic content'),sha=createHash('sha256').update(payload).digest('hex');
const details={txt:{encoding:'UTF-8',whitespace:'unchanged'},docx:{paragraphs:1,tables:0,pictures:0},xlsx:{sheets:['Data'],formulas:0,formulaCache:'unverified-zero-placeholder; recalculation required'},pptx:{slides:1,editable:true,visualInspection:'pending'},pdf:{conversionCompleted:true,renderInspection:'pending',sourceDocxSha256:'1'.repeat(64)},zip:{rows:1,columns:['a'],chart:false}};
const priorRoot=process.env.MERI_PRIOR_CONTRACTS;
const imported=family=>import(pathToFileURL(join(priorRoot,'dist',family+'.mjs')).href);
async function response(module,route,value,body){return module.receiveDocumentResponse(route,200,bytes(value),module.receiveDocumentRequest(route,bytes(body)));}
test('physical0.1.23 and union match six inspect/download pairs, eighteen refusals and metadata-only history/list',{skip:priorRoot?false:'Exact immutable prior package is required'},async()=>{
 assert.equal(JSON.parse(await readFile(join(priorRoot,'package.json'),'utf8')).version,'0.1.23');const old=await imported('document-access-application');
 for(const format of Object.keys(details)){
  const r=record(),version={...r.version,parentVersionId:null,filename:'Synthetic.'+format,mimeType:ARTIFACT_MIME_TYPES[format],evidence:[]};version.object={...version.object,sha256:sha,bytes:payload.length};
  const value={version,inspection:{...r.inspection,format,sha256:sha,bytes:payload.length,currentBytesVerified:true,details:details[format]}},body={versionId:version.versionId};
  const a=await response(old,'inspect',value,body),b=await response(current,'inspect',value,body);assert.deepEqual(a,b);
  const download=()=>new Response(payload,{headers:{'content-type':version.mimeType,'content-length':String(payload.length),'content-disposition':`attachment; filename="${version.filename}"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
  assert.deepEqual(await old.receiveDocumentDownload(download(),a.version),await current.receiveDocumentDownload(download(),b.version));
  for(const mutate of [v=>v.inspection.sha256='f'.repeat(64),v=>v.inspection.currentBytesVerified=false,v=>v.authorized=true]){const changed=structuredClone(value);mutate(changed);await assert.rejects(response(old,'inspect',changed,body));await assert.rejects(response(current,'inspect',changed,body));}
  const history={artifactId:version.artifactId,anchorVersionId:version.versionId,headVersionId:version.versionId,versions:[version],nextCursor:null},historyInput={...body,limit:1,cursor:null};assert.deepEqual(await response(old,'history',history,historyInput),await response(current,'history',history,historyInput));
  // Metadata rows cannot acquire either receiver's byte-read brand.
  for(const module of [old,current]){const result=await response(module,'list',{scope:'owner',versions:[version],nextCursor:null},{scope:'owner',limit:1,cursor:null});await assert.rejects(module.receiveDocumentDownload(download(),result.versions[0]));}
 }
 for(const scope of ['owner','client','conversation']){const body={scope,limit:1,cursor:null},empty={scope,versions:[],nextCursor:'a'.repeat(64)};assert.deepEqual(await response(old,'list',empty,body),await response(current,'list',empty,body));}
});
test('prior package has no preview/run named receiver; old closed request routes refuse new families',{skip:priorRoot?false:'Exact immutable prior package is required'},async()=>{
 const old=await imported('document-access-application'),history=await imported('conversation-history');
 for(const name of ['receiveDocumentPreviewRequest','receiveDocumentPreviewPublication','receiveDocumentPreview']){assert.equal(old[name],undefined);assert.equal(typeof current[name],'function');}
 for(const name of ['receiveRunIndexRequest','receiveRunIndexResponse']){assert.equal(history[name],undefined);assert.equal(typeof runs[name],'function');}
 const id='00000000-0000-4000-8000-000000000001';for(const route of ['preview','preview-publish'])assert.throws(()=>old.receiveDocumentRequest(route,bytes({versionId:id})));
 assert.throws(()=>history.receiveConversationHistoryRequest('list',bytes({schemaVersion:'meri.run-index/1',scope:{kind:'general'},status:'all',limit:20,cursor:null})));
});
