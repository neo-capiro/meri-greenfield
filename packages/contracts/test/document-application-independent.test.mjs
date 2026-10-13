// Independent receiving controls, frozen before candidate implementation inspection.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {receiveDocumentRequest,receiveDocumentResponse,receiveDocumentDownload,DocumentResponseError} from '../dist/document-application.mjs';
import {createDocumentApplication} from '../../../apps/control/document-application/index.mjs';
import {createLocalDocumentFixture} from '../../../apps/control/document-application/local/fixture.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),encode=x=>new TextEncoder().encode(typeof x==='string'?x:JSON.stringify(x));
const specs={txt:{operation:'create_word',format:'txt',title:'Independent Unicode',content:{text:'  Café 🙂\r\n=literal\n'}},docx:{operation:'create_word',format:'docx',title:'Independent brief',content:{blocks:[{kind:'paragraph',runs:[{text:'An editable synthetic paragraph.'}]}]}},xlsx:{operation:'create_excel',format:'xlsx',title:'A'.repeat(120),content:{sheets:[{name:'Budget',rows:[[{value:'Item'},{value:'Amount'}],[{value:'Synthetic'},{value:12}],[{value:'Total'},{formula:'=SUM(B2:B2)'}]]}]}}};
const raws={},success={},inspections={},downloads={},requests={},cleanups=[];let oldRoot;
before(async()=>{
 oldRoot=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;
 for(const format of ['txt','docx','xlsx']){
  const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',operation:specs[format].operation});
  try{
   const app=createDocumentApplication({sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,credential:f.credential,now:f.now,limits:f.limits,enabled:true});
   const session=await f.sessions.issue({identityCredential:f.nativeCredential});
   const post=(route,body)=>app.handle(new Request('http://127.0.0.1/api/documents/'+route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.credential},body:JSON.stringify(body)}));
   const body={deliveryId:'independent-'+format,request:specs[format]},response=await post('create',body);assert.equal(response.status,200);raws[format]=new Uint8Array(await response.arrayBuffer());
   requests[format]=receiveDocumentRequest('create',encode(body));success[format]=await receiveDocumentResponse('create',200,raws[format],requests[format]);
   const inspectBody={versionId:success[format].version.versionId},inspect=await post('inspect',inspectBody);assert.equal(inspect.status,200);
   inspections[format]={raw:new Uint8Array(await inspect.arrayBuffer()),request:receiveDocumentRequest('inspect',encode(inspectBody))};
   const download=await post('download',inspectBody);assert.equal(download.status,200);downloads[format]={bytes:new Uint8Array(await download.arrayBuffer()),headers:Object.fromEntries(download.headers)};
   if(format==='txt'){
    const revision={deliveryId:'independent-revision',baseVersionId:success.txt.version.versionId,request:{...specs.txt,content:{text:'Revised 🙂\n'}}};
    const revised=await post('revise',revision);assert.equal(revised.status,200);raws.revise=new Uint8Array(await revised.arrayBuffer());requests.revise=receiveDocumentRequest('revise',encode(revision));success.revise=await receiveDocumentResponse('revise',200,raws.revise,requests.revise);
   }
  }finally{await f.close();cleanups.push(f.stats().cleanup);}
 }
});
after(()=>{for(const c of cleanups)assert.deepEqual(c,{executorDirectoriesAbsent:true,storeRemoved:true});if(oldRoot===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=oldRoot;});
const change=(format,mutate)=>{const x=JSON.parse(new TextDecoder().decode(raws[format]));mutate(x);return encode(x);};
const binary=(format,changeHeaders=()=>{},bytes=downloads[format].bytes,status=200)=>{const headers={...downloads[format].headers};changeHeaders(headers);return new Response(bytes,{status,headers});};
const rejects=fn=>assert.rejects(fn,error=>error instanceof DocumentResponseError);
for(const format of ['txt','docx','xlsx'])test('actual '+format+' create/inspect/download accepted without authority claims',async()=>{
 const out=success[format];assert.equal(out.version.generationStatus,'draft');assert.equal(out.version.previewStatus,'pending');assert.equal(out.execution.nativeQualified,false);assert.equal(out.inspection.format,format);assert.ok(Object.isFrozen(out.version.object));
 const inspected=await receiveDocumentResponse('inspect',200,inspections[format].raw,inspections[format].request);assert.equal(inspected.inspection.currentBytesVerified,true);
 const got=await receiveDocumentDownload(binary(format),out.version);assert.deepEqual(got.bytes,downloads[format].bytes);assert.equal(got.version,out.version);
});
test('actual XLSX admits canonical 125-character filename',()=>assert.equal(success.xlsx.version.filename.length,125));
test('actual TXT preserves exact multibyte whitespace and newline bytes',()=>assert.equal(new TextDecoder().decode(downloads.txt.bytes),specs.txt.content.text));
test('actual revision correlates immutable parent and retains original',()=>{assert.equal(success.revise.version.parentVersionId,success.txt.version.versionId);assert.equal(success.revise.version.artifactId,success.txt.version.artifactId);assert.notEqual(success.revise.version.versionId,success.txt.version.versionId);assert.equal(new TextDecoder().decode(downloads.txt.bytes),specs.txt.content.text);});
test('closed request refuses browser authority injection',()=>assert.throws(()=>receiveDocumentRequest('create',encode({deliveryId:'x',request:specs.txt,context:{authorized:true}})),DocumentResponseError));
test('wrong operation and format pair refuses',()=>assert.throws(()=>receiveDocumentRequest('create',encode({deliveryId:'x',request:{...specs.txt,operation:'create_excel'}})),DocumentResponseError));
test('PDF remains outside document application',()=>assert.throws(()=>receiveDocumentRequest('create',encode({deliveryId:'x',request:{operation:'create_word',format:'pdf',title:'PDF',content:{blocks:[]}}})),DocumentResponseError));
test('request rejects invalid UTF8',()=>assert.throws(()=>receiveDocumentRequest('inspect',new Uint8Array([0xc3,0x28])),DocumentResponseError));
test('request rejects parsed objects without getters or proxy traps',()=>{let calls=0;const p=new Proxy({}, {get(){calls++;throw Error('trap');},getPrototypeOf(){calls++;throw Error('trap');}});assert.throws(()=>receiveDocumentRequest('create',p),DocumentResponseError);assert.equal(calls,0);});
test('request rejects proxy over byte view without traps',()=>{let calls=0;const p=new Proxy(encode({versionId:success.txt.version.versionId}),{get(){calls++;throw Error('trap');}});assert.throws(()=>receiveDocumentRequest('inspect',p),DocumentResponseError);assert.equal(calls,0);});
test('JSON byte access ignores hostile own iterator/getter',()=>{let calls=0;const b=encode({versionId:success.txt.version.versionId});Object.defineProperty(b,'buffer',{get(){calls++;throw Error('trap');}});b[Symbol.iterator]=()=>{calls++;throw Error('trap');};const out=receiveDocumentRequest('inspect',b);assert.equal(out.versionId,success.txt.version.versionId);assert.equal(calls,0);});
test('request bound counts UTF8 bytes not characters',()=>assert.throws(()=>receiveDocumentRequest('create',encode({deliveryId:'x',request:{...specs.txt,content:{text:'🙂'.repeat(600000)}}})),DocumentResponseError));
test('request deeply nested JSON refuses boundedly',()=>assert.throws(()=>receiveDocumentRequest('create',encode('['.repeat(80)+'0'+']'.repeat(80))),DocumentResponseError));
test('unknown dangerous JSON key refuses',()=>assert.throws(()=>receiveDocumentRequest('inspect',encode('{"versionId":"'+success.txt.version.versionId+'","__proto__":{}}')),DocumentResponseError));
test('request snapshots bytes and returns frozen values',()=>{const bytes=encode({deliveryId:'detach',request:specs.txt}),r=receiveDocumentRequest('create',bytes);bytes.fill(0);assert.equal(r.request.content.text,specs.txt.content.text);assert.ok(Object.isFrozen(r.request.content));});
test('shape-like unbranded request cannot admit response',async()=>rejects(()=>receiveDocumentResponse('create',200,raws.txt,structuredClone(requests.txt))));
test('wrong route request brand refuses',async()=>rejects(()=>receiveDocumentResponse('revise',200,raws.txt,requests.txt)));
for(const [name,mutate]of [
 ['unknown response field',x=>x.authorized=true],['format/MIME mismatch',x=>x.version.mimeType='application/pdf'],['bad filename',x=>x.version.filename='../bad.txt'],['oversize filename',x=>x.version.filename='a'.repeat(125)+'.txt'],['hash mismatch',x=>x.inspection.sha256='a'.repeat(64)],['byte length mismatch',x=>x.inspection.bytes++],['inspection format',x=>x.inspection.format='xlsx'],['rendered claim',x=>x.inspection.rendered=true],['native qualification claim',x=>x.execution.nativeQualified=true],['preview claim',x=>x.version.previewStatus='validated'],['generation claim',x=>x.version.generationStatus='final'],['foreign object scope',x=>x.version.object.scopes[0].tenantId='foreign'],['unexpected parent',x=>x.version.parentVersionId=x.version.versionId]])test('response refuses '+name,()=>rejects(()=>receiveDocumentResponse('create',200,change('txt',mutate),requests.txt)));
test('inspect expected version correlation refuses substitute',async()=>{const req=receiveDocumentRequest('inspect',encode({versionId:success.xlsx.version.versionId}));await rejects(()=>receiveDocumentResponse('inspect',200,inspections.txt.raw,req));});
test('revision parent correlation refuses substituted prior version',()=>rejects(()=>receiveDocumentResponse('revise',200,change('revise',x=>x.version.parentVersionId=success.xlsx.version.versionId),requests.revise)));
test('valid content-free error returned, status mismatch rejected',async()=>{const e=encode({error:{code:'SESSION_REFUSED',outcome:'NOT_DISPATCHED'}});assert.deepEqual(await receiveDocumentResponse('create',403,e,requests.txt),JSON.parse(new TextDecoder().decode(e)));await rejects(()=>receiveDocumentResponse('create',200,e,requests.txt));await rejects(()=>receiveDocumentResponse('create',500,e,requests.txt));});
test('error with source/private body rejected',()=>rejects(()=>receiveDocumentResponse('create',403,encode({error:{code:'SESSION_REFUSED',outcome:'NOT_DISPATCHED',message:'secret'}}),requests.txt)));
for(const [name,mutate]of [['wrong mime',h=>h['content-type']='application/pdf'],['wrong filename',h=>h['content-disposition']='attachment; filename="other.txt"'],['missing length',h=>delete h['content-length']],['wrong length',h=>h['content-length']='1'],['no-store missing',h=>delete h['cache-control']],['nosniff missing',h=>delete h['x-content-type-options']],['encoded content',h=>h['content-encoding']='gzip']])test('download refuses '+name,()=>rejects(()=>receiveDocumentDownload(binary('txt',mutate),success.txt.version)));
test('download rejects altered bytes despite matching headers',()=>{const b=downloads.txt.bytes.slice();b[0]^=1;return rejects(()=>receiveDocumentDownload(binary('txt',()=>{},b),success.txt.version));});
test('download rejects shortened EOF',()=>rejects(()=>receiveDocumentDownload(binary('txt',()=>{},downloads.txt.bytes.slice(1)),success.txt.version)));
test('download refuses redirect and error status',async()=>{for(const status of[302,403])await rejects(()=>receiveDocumentDownload(binary('txt',()=>{},downloads.txt.bytes,status),success.txt.version));});
test('download refuses unbranded version without proxy traps',async()=>{let calls=0;const proxy=new Proxy(success.txt.version,{get(){calls++;throw Error('trap');}});await rejects(()=>receiveDocumentDownload(binary('txt'),proxy));await rejects(()=>receiveDocumentDownload(binary('txt'),structuredClone(success.txt.version)));assert.equal(calls,0);});
test('download rejects Response proxy without traps',async()=>{let calls=0;const proxy=new Proxy(binary('txt'),{get(){calls++;throw Error('trap');}});await rejects(()=>receiveDocumentDownload(proxy,success.txt.version));assert.equal(calls,0);});
test('download configured byte limit refuses',()=>rejects(()=>receiveDocumentDownload(binary('txt'),success.txt.version,{maxBytes:1})));
test('download consumes bounded stream EOF and cancels stalled body',async()=>{let cancelled=false;const stream=new ReadableStream({cancel(){cancelled=true;}}),response=new Response(stream,{headers:downloads.txt.headers});await rejects(()=>receiveDocumentDownload(response,success.txt.version,{timeoutMs:20}));assert.equal(cancelled,true);});
test('download respects already cancelled caller',async()=>{const c=new AbortController();c.abort();await rejects(()=>receiveDocumentDownload(binary('txt'),success.txt.version,{signal:c.signal}));});
test('received binary is detached from source buffer',async()=>{const b=downloads.txt.bytes.slice(),r=binary('txt',()=>{},b),out=await receiveDocumentDownload(r,success.txt.version);b.fill(0);assert.deepEqual(out.bytes,downloads.txt.bytes);});
test('standalone browser module works with no Node or private graph',async()=>{const source=await readFile(new URL('../dist/document-application.mjs',import.meta.url),'utf8');const ctx=vm.createContext({TextEncoder,TextDecoder,Uint8Array,ArrayBuffer,DataView,Response,Request,Headers,ReadableStream,AbortController,AbortSignal,setTimeout,clearTimeout,crypto:webcrypto});const module=new vm.SourceTextModule(source,{context:ctx});await module.link(()=>{throw Error('External module forbidden');});await module.evaluate();const r=module.namespace.receiveDocumentRequest('create',encode({deliveryId:'browser',request:specs.txt}));assert.equal(r.request.format,'txt');const out=await module.namespace.receiveDocumentResponse('create',200,raws.txt,r);assert.equal(out.version.previewStatus,'pending');});
