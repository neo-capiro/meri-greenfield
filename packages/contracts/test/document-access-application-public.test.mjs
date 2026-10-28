/** The document access receiver against the frozen document receiver and the canonical artifact owners. Inspect receipts for every format are built as the
 * real producers emit them (presentation.mjs, local-executor.mjs PDF conversion, python/analysis.py), then checked by the canonical artifact validator, the frozen
 * receiver (which must keep refusing pptx/zip/pdf) and the access receiver. SYNTHETIC bytes and scopes: no real generator output, renderer, PostgreSQL, Core or
 * deployment is involved, and nothing here qualifies a preview renderer. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import * as access from '../dist/document-access-application.mjs';
import * as frozen from '../dist/document-application.mjs';
import {ARTIFACT_MIME_TYPES} from '../artifacts-0.2/artifact-formats.mjs';
import {artifactValidators as canonical} from '../retrieval-0.2/validate.mjs';
import catalog from '../retrieval-0.2/catalog.json' with {type:'json'};
import {admitDocumentDescriptor} from '../../../apps/control/document-application/format-admission.mjs';
import {PREVIEW_FORMATS} from '../../../apps/artifacts/preview/render.mjs';
const FORMATS=['docx','txt','xlsx','pptx','pdf','zip'],FROZEN_FORMATS=['txt','docx','xlsx'],NEW_FORMATS=['pptx','pdf','zip'];
const utf8=v=>new TextEncoder().encode(JSON.stringify(v)),hash=bytes=>createHash('sha256').update(bytes).digest('hex'),clone=v=>structuredClone(v);
const scopes=[{tenantId:'synthetic',kind:'client',resourceId:randomUUID(),policyRevision:'test'}];
const binding={tenantId:'synthetic',actorId:'actor',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
const BYTES=new TextEncoder().encode('bounded synthetic bytes');
/** Details exactly as each producer emits them: presentation.mjs, local-executor.mjs (PDF conversion), python/analysis.py. */
const DETAILS={
 txt:()=>({encoding:'UTF-8',whitespace:'unchanged'}),docx:()=>({paragraphs:1,tables:0,pictures:0}),xlsx:()=>({sheets:['Data'],formulas:1,formulaCache:'unverified-zero-placeholder; recalculation required'}),
 pptx:()=>({slides:3,editable:true,visualInspection:'pending'}),pdf:()=>({conversionCompleted:true,renderInspection:'pending',sourceDocxSha256:hash(utf8('source docx'))}),zip:()=>({rows:4,columns:['region','total'],chart:true}),
};
function receipt(format,title='Draft'){
 const version={contractVersion:'0.1.0',artifactId:randomUUID(),versionId:randomUUID(),parentVersionId:null,binding,object:{objectId:randomUUID(),versionId:'immutable-1',sha256:hash(BYTES),bytes:BYTES.length,scopes},filename:title+'.'+format,mimeType:ARTIFACT_MIME_TYPES[format],scopes,evidence:[],generationStatus:'draft',previewStatus:'pending',createdAt:'2026-10-13T07:00:00.000Z'};
 const inspection={sha256:hash(BYTES),bytes:BYTES.length,format,nativeOpened:false,rendered:false,recalculated:false,members:[],details:DETAILS[format]()};
 return {version,inspection,value:{version,inspection:{...inspection,currentBytesVerified:true}}};
}
/** One inspect exchange through a receiver module: its admitted result, or the refusal code. */
async function inspect(mod,value,versionId=value?.version?.versionId,status=200){
 try{const request=mod.receiveDocumentRequest('inspect',utf8({versionId}));return {ok:true,request,value:await mod.receiveDocumentResponse('inspect',status,utf8(value),request)};}
 catch(error){if(error instanceof mod.DocumentResponseError)return {ok:false,code:error.code};throw error;}
}
const plain=outcome=>outcome.ok?{ok:true,value:JSON.parse(JSON.stringify(outcome.value))}:outcome;
/** The download answer for a version (or for the receipt that holds it). */
const download=(subject,change={})=>{const v=subject.version??subject;return new Response(BYTES,{status:200,headers:{'content-type':v.mimeType,'content-length':String(BYTES.length),'content-disposition':`attachment; filename="${v.filename}"`,'cache-control':'no-store','x-content-type-options':'nosniff',...change}});};

/** Compatibility: txt, docx and xlsx behave exactly as in the frozen receiver, accepted and refused. */
for(const format of FROZEN_FORMATS)test(`${format}: frozen and access receivers admit the same inspect receipt`,async()=>{
 const r=receipt(format),a=await inspect(access,r.value),f=await inspect(frozen,r.value);
 assert.equal(a.ok,true);assert.deepEqual(plain(a),plain(f));assert(Object.isFrozen(a.value.inspection));assert.equal(a.value.inspection.format,format);
});
const mutations={
 'extra property':v=>{v.authorized=true;},'inspection hash':v=>{v.inspection.sha256='b'.repeat(64);},'inspection bytes':v=>{v.inspection.bytes++;},'mime type':v=>{v.version.mimeType='application/octet-stream';},
 'filename traversal':v=>{v.version.filename='../draft.txt';},'filename extension':v=>{v.version.filename='Draft.bin';},'object scopes':v=>{v.version.object.scopes=[];},'tenant':v=>{v.version.binding.tenantId='other';},
 'object size':v=>{v.version.object.bytes=16777217;},'evidence scope':v=>{v.version.evidence=[{kind:'x'}];},'native opened':v=>{v.inspection.nativeOpened=true;},'rendered':v=>{v.inspection.rendered=true;},'recalculated':v=>{v.inspection.recalculated=true;},
 'bytes not verified':v=>{v.inspection.currentBytesVerified=false;},'bytes verification missing':v=>{delete v.inspection.currentBytesVerified;},
 'published generation':v=>{v.version.generationStatus='published';},'validated preview':v=>{v.version.previewStatus='validated';},'unsupported preview':v=>{v.version.previewStatus='unsupported';},'failed preview':v=>{v.version.previewStatus='failed';},
};
for(const format of FROZEN_FORMATS)for(const [name,mutate] of Object.entries(mutations))test(`${format}: both receivers refuse ${name} the same way`,async()=>{
 const r=receipt(format),value=clone(r.value);mutate(value);const a=await inspect(access,value,r.version.versionId),f=await inspect(frozen,value,r.version.versionId);
 assert.equal(a.ok,false,'refused');assert.deepEqual(a,f);
});
test('another version id, unadmitted request and invalid status refuse the same way in both receivers',async()=>{
 const r=receipt('docx');
 for(const mod of [access,frozen]){
  assert.deepEqual(await inspect(mod,r.value,randomUUID()),{ok:false,code:'VERSION_MISMATCH'});
  const request=mod.receiveDocumentRequest('inspect',utf8({versionId:r.version.versionId}));
  await assert.rejects(mod.receiveDocumentResponse('inspect',200,utf8(r.value),structuredClone(request)),e=>e.code==='UNADMITTED_REQUEST');
  await assert.rejects(mod.receiveDocumentResponse('inspect',99,utf8(r.value),request),e=>e.code==='INVALID_STATUS');
  await assert.rejects(mod.receiveDocumentResponse('download',200,utf8(r.value),request),e=>e.code==='UNADMITTED_REQUEST','a request admitted for inspect is not a download request');
 }
});

/** New variants: admitted by the access receiver, valid for the canonical owner, and still refused by the frozen receiver. */
for(const format of NEW_FORMATS)test(`${format}: canonical owner and access receiver admit the producer-shaped receipt; the frozen receiver keeps refusing it`,async()=>{
 const r=receipt(format);assert.deepEqual(canonical.inspection(r.inspection),r.inspection,'canonical artifact validator');
 const a=await inspect(access,r.value);assert.equal(a.ok,true);assert.equal(a.value.inspection.format,format);assert.equal(a.value.version.mimeType,ARTIFACT_MIME_TYPES[format]);assert.equal(a.value.inspection.nativeOpened,false);assert.equal(a.value.inspection.rendered,false);
 assert.deepEqual(await inspect(frozen,r.value),{ok:false,code:'INVALID_RESPONSE'});
});
const variantMutations={
 pptx:{'visual inspection claimed':v=>{v.inspection.details.visualInspection='validated';},'not editable':v=>{v.inspection.details.editable=false;},'negative slides':v=>{v.inspection.details.slides=-1;},'fractional slides':v=>{v.inspection.details.slides=1.5;},'extra detail':v=>{v.inspection.details.theme='x';},'missing slides':v=>{delete v.inspection.details.slides;}},
 pdf:{'render inspection claimed':v=>{v.inspection.details.renderInspection='validated';},'conversion not completed':v=>{v.inspection.details.conversionCompleted=false;},'bad source hash':v=>{v.inspection.details.sourceDocxSha256='nothex';},'missing source hash':v=>{delete v.inspection.details.sourceDocxSha256;},'extra detail':v=>{v.inspection.details.pages=3;}},
 zip:{'negative rows':v=>{v.inspection.details.rows=-1;},'columns not an array':v=>{v.inspection.details.columns='a,b';},'too many columns':v=>{v.inspection.details.columns=Array.from({length:201},(_,i)=>'c'+i);},'chart not boolean':v=>{v.inspection.details.chart='yes';},'missing chart':v=>{delete v.inspection.details.chart;},'extra detail':v=>{v.inspection.details.sheets=['x'];}},
};
for(const [format,table] of Object.entries(variantMutations))for(const [name,mutate] of Object.entries(table))test(`${format}: access receiver refuses ${name}`,async()=>{
 const r=receipt(format),value=clone(r.value);mutate(value);assert.deepEqual(await inspect(access,value,r.version.versionId),{ok:false,code:'INVALID_RESPONSE'});
});
for(const format of NEW_FORMATS)for(const [name,mutate] of Object.entries(mutations))test(`${format}: access receiver refuses ${name}`,async()=>{
 const r=receipt(format),value=clone(r.value);mutate(value);assert.equal((await inspect(access,value,r.version.versionId)).ok,false);
});
test('a format must agree across inspection, MIME type and file extension, and unknown formats are refused',async()=>{
 for(const [format,other] of [['pptx','docx'],['zip','xlsx'],['pdf','txt'],['docx','pdf'],['txt','zip']]){
  const r=receipt(format),mime=clone(r.value);mime.version.mimeType=ARTIFACT_MIME_TYPES[other];
  const out=await inspect(access,mime,r.version.versionId);assert.equal(out.ok,false);assert.ok(['INSPECTION_MISMATCH','INVALID_RESPONSE'].includes(out.code));
  const ext=clone(r.value);ext.version.filename='Draft.'+other;const e=await inspect(access,ext,r.version.versionId);assert.equal(e.ok,false);assert.equal(e.code,'INSPECTION_MISMATCH');
 }
 for(const format of ['sandbox','csv','odt','']){const r=receipt('txt'),value=clone(r.value);value.inspection.format=format;assert.equal((await inspect(access,value,r.version.versionId)).ok,false);}
});

/** Download: inspect first, never a link or bytes alone, and provenance never crosses receiver modules. */
for(const format of FORMATS)test(`${format}: bytes are released only for a version admitted from an inspect answer, verified against it`,async()=>{
 const r=receipt(format),a=await inspect(access,r.value),version=a.value.version;
 const out=await access.receiveDocumentDownload(download(version),version);assert.deepEqual([...out.bytes],[...BYTES]);assert.equal(out.version,version);assert(Object.isFrozen(out));assert.notEqual(out.bytes,BYTES);
 for(const change of [{'content-type':'application/octet-stream'},{'content-disposition':'attachment; filename="Other.'+format+'"'},{'content-length':'1'},{'cache-control':'public'},{'x-content-type-options':'sniff'},{'content-encoding':'gzip'}])
  await assert.rejects(access.receiveDocumentDownload(download(version,change),version),e=>e.code==='DOWNLOAD_HEADERS');
 await assert.rejects(access.receiveDocumentDownload(new Response(new TextEncoder().encode('bounded synthetic bytez'),{status:200,headers:download(version).headers}),version),e=>e.code==='DOWNLOAD_HASH');
 await assert.rejects(access.receiveDocumentDownload(download(version),structuredClone(version)),e=>e.code==='UNADMITTED_VERSION','a copy of an admitted version is not admitted');
 await assert.rejects(access.receiveDocumentDownload(download(version),r.version),e=>e.code==='UNADMITTED_VERSION','the raw JSON version is not admitted');
});
test('provenance is module-local: a version admitted by one receiver cannot release bytes through the other',async()=>{
 const r=receipt('docx'),a=await inspect(access,r.value),f=await inspect(frozen,r.value);
 await assert.rejects(access.receiveDocumentDownload(download(r),f.value.version),e=>e.code==='UNADMITTED_VERSION');
 await assert.rejects(frozen.receiveDocumentDownload(download(r),a.value.version),e=>e.code==='UNADMITTED_VERSION');
 assert.deepEqual([...(await access.receiveDocumentDownload(download(r),a.value.version)).bytes],[...BYTES]);
});
test('the download route admits only an error body from a non-200 answer and never a JSON 200',async()=>{
 const r=receipt('pptx'),request=access.receiveDocumentRequest('download',utf8({versionId:r.version.versionId}));
 await assert.rejects(access.receiveDocumentResponse('download',200,utf8(r.value),request),e=>e.code==='BINARY_RESPONSE_REQUIRED');
 assert.deepEqual(await access.receiveDocumentResponse('download',403,utf8({error:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'}}),request),{error:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'}});
});

/** Requests and errors: the frozen vocabulary, over the two read routes only. */
test('requests are the frozen read requests; create and revise do not exist here',()=>{
 const id=randomUUID(),bytes=utf8({versionId:id});
 for(const route of ['inspect','download']){assert.deepEqual(access.receiveDocumentRequest(route,bytes),{versionId:id});assert.deepEqual(frozen.receiveDocumentRequest(route,bytes),{versionId:id});}
 for(const bad of [{},{versionId:'x'},{versionId:id,extra:1},{versionId:id.toUpperCase().replace(/-/g,'')},null,[]]){
  for(const route of ['inspect','download']){assert.throws(()=>access.receiveDocumentRequest(route,utf8(bad)),e=>e.code==='INVALID_REQUEST');assert.throws(()=>frozen.receiveDocumentRequest(route,utf8(bad)),e=>e.code==='INVALID_REQUEST');}
 }
 for(const route of ['create','revise','preview','preview-publish','approve',undefined,1])assert.throws(()=>access.receiveDocumentRequest(route,bytes),e=>e.code==='INVALID_ROUTE');
 assert.doesNotThrow(()=>frozen.receiveDocumentRequest('create',utf8({deliveryId:'d',request:{operation:'create_word',format:'txt',title:'T',content:{text:'x'}}})));
});
test('prior error codes retain frozen admission and the new history refusal stays outside the old receiver',async()=>{
 const r=receipt('zip'),request=access.receiveDocumentRequest('inspect',utf8({versionId:r.version.versionId})),old=frozen.receiveDocumentRequest('inspect',utf8({versionId:r.version.versionId}));
 for(const [code,status] of Object.entries(access.documentAccessMetadata.errorStatuses))for(const outcome of ['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','READ_UNAVAILABLE']){
  const body=utf8({error:{code,outcome}}),received=await access.receiveDocumentResponse('inspect',status,body,request);
  if(['ARTIFACT_HISTORY_CURSOR','ARTIFACT_LIBRARY_CURSOR'].includes(code))await assert.rejects(frozen.receiveDocumentResponse('inspect',status,body,old),e=>e.code==='INVALID_ERROR_RESPONSE');
  else assert.deepEqual(received,await frozen.receiveDocumentResponse('inspect',status,body,old));
  await assert.rejects(access.receiveDocumentResponse('inspect',status===599?598:status+1,body,request),e=>e.code==='INVALID_ERROR_RESPONSE');
 }
 for(const bad of [{error:{code:'NOT_A_CODE',outcome:'UNKNOWN'}},{error:{code:'ACCESS_DENIED'}},{error:{code:'ACCESS_DENIED',outcome:'DONE'}},{error:{code:'ACCESS_DENIED',outcome:'UNKNOWN',detail:'x'}}])
  await assert.rejects(access.receiveDocumentResponse('inspect',403,utf8(bad),request),e=>e.code==='INVALID_ERROR_RESPONSE');
});

/** Metadata and distribution. */
test('metadata is derived from the artifact vocabulary, the real admission function and the preview owner',async()=>{
 const m=access.documentAccessMetadata,descriptor=id=>{const e=catalog.operations.find(x=>x.operation.id===id);return {operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements};};
 assert.deepEqual(m.formats,Object.keys(ARTIFACT_MIME_TYPES));assert.deepEqual(m.mimeTypes,ARTIFACT_MIME_TYPES);assert.deepEqual(m.previewFormats,[...PREVIEW_FORMATS]);
 assert.deepEqual(m.operationFormats,{create_word:[...admitDocumentDescriptor(descriptor('create_word')).formats],create_word_with_pdf:[...admitDocumentDescriptor(descriptor('create_word'),{pdf:true}).formats],create_excel:[...admitDocumentDescriptor(descriptor('create_excel')).formats],create_powerpoint:[...admitDocumentDescriptor(descriptor('create_powerpoint')).formats],run_analysis:[...admitDocumentDescriptor(descriptor('run_analysis')).formats]});
 assert.deepEqual(new Set(Object.values(m.operationFormats).flat()),new Set(m.formats));
 assert.deepEqual(m.previewFormats.filter(format=>!m.formats.includes(format)),[]);assert.deepEqual(m.formats.filter(format=>!m.previewFormats.includes(format)).sort(),['txt','zip'],'txt and zip have no preview');
 assert.deepEqual(Object.keys(m.routes),['inspect','download','history','list']);assert.deepEqual(m.routes.download,{method:'POST',path:'/api/documents/download',response:'bytes'});assert.deepEqual(m.routes.history,{method:'POST',path:'/api/documents/history',response:'json'});assert.deepEqual(m.routes.list,{method:'POST',path:'/api/documents/list',response:'json'});assert(Object.isFrozen(m)&&Object.isFrozen(m.errorStatuses));
 const frozenSchema=JSON.parse(await readFile(new URL('../dist/document-application.schema.json',import.meta.url),'utf8')),schema=JSON.parse(await readFile(new URL('../dist/document-access-application.schema.json',import.meta.url),'utf8'));
 const oldCodes=frozenSchema.$defs.DocumentErrorResponse.properties.error.properties.code.enum;
 assert(oldCodes.every(code=>Object.hasOwn(m.errorStatuses,code)),'all prior error codes remain admitted');
 assert.deepEqual(schema.$defs.DocumentErrorResponse.properties.error.properties.outcome,frozenSchema.$defs.DocumentErrorResponse.properties.error.properties.outcome,'outcome vocabulary is unchanged');
 assert.equal(schema.$id,'urn:meri:document-access-application:0.2.0');assert(!/"\$ref":"(?!#)/u.test(JSON.stringify(schema)),'every reference is local to the distribution');
});
test('distribution is self-contained, layout-independent and its recorded sources bind the owners',async()=>{
 const source=await readFile(new URL('../dist/document-access-application.mjs',import.meta.url),'utf8'),metadata=JSON.parse(await readFile(new URL('../dist/document-access-application.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.browserImports,[]);assert(!/(?:^|\n)\s*import\s/u.test(source));assert(!/from ['"](?:node:|ajv|canonicalize)/u.test(source));
 const layout=/\.\.\/|(?<![A-Za-z0-9])[A-Za-z]:[\\/](?!\/)|\/(?:home|Users)\/|wt-/u;assert(!layout.test(source),'no parent-relative, drive-letter, home or worktree path in the bundle');assert(metadata.browserInputs.every(entry=>!layout.test(entry)));
 const labels=[...source.matchAll(/^\/\/ (.+)$/gmu)].map(m=>m[1]).filter(label=>/\.m?js$/u.test(label));assert(labels.length>=5&&labels.every(label=>/^(?:node_modules\/|document-access-generated:\.\/generated-|(?:document-access-application|document-application|artifacts-0\.2)\/)/u.test(label)),labels.join(', '));
 for(const path of ['../../apps/control/document-application/format-admission.mjs','../../apps/control/document-application/index.mjs','../../apps/artifacts/preview/render.mjs','../../apps/artifacts/preview/service.mjs','artifacts-0.2/artifact.schema.json','artifacts-0.2/artifact-formats.mjs','retrieval-0.2/catalog.json','document-application/download.mjs','document-application/boundary.mjs'])assert(metadata.sources.some(entry=>entry.path===path),path);
 const previewService=await readFile(new URL('../../../apps/artifacts/preview/service.mjs',import.meta.url),'utf8');
 assert(/PREVIEW_FORMATS\.includes\(format\)\)fail\('ARTIFACT_PREVIEW_UNSUPPORTED'\)/u.test(previewService)&&/format!=='pdf'&&!converter\)fail\('ARTIFACT_RENDERER_UNAVAILABLE'\)/u.test(previewService),'the preview rules the semantics text states are still the owner\'s');
});
