/** Actual XLSX generator and immutable artifact owners; scripted accounting, no SQL engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDocumentApplication} from '../index.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {ARTIFACT_MIME_TYPES} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const workbook={operation:'create_excel',format:'xlsx',title:'Editable planning workbook',content:{sheets:[{name:'Plan',rows:[[{value:'Initiative'},{value:'Budget'}],[{value:'First draft'},{value:1200}],[{value:'Total'},{formula:'=SUM(B2:B2)'}]]}]}};
const word={operation:'create_word',format:'txt',title:'Word text',content:{text:'Word remains separate.'}};
const descriptor=id=>{const e=catalog.operations.find(e=>e.operation.id===id);return structuredClone({operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements});};
async function setup(t,operation='create_excel',change=x=>x){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation});
 t.after(async()=>{await f.close();assert.deepEqual(f.stats().cleanup,{executorDirectoriesAbsent:true,storeRemoved:true});});
 const options={sessions:f.sessions,selectedClientId:f.selectedClientId,artifactOptions:f.artifactOptions,credential:f.credential,now:f.now,limits:f.limits,enabled:true};
 const app=createDocumentApplication(change(options)),session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const req=(route,body)=>new Request(`http://127.0.0.1/api/documents/${route}`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.credential}`},body:JSON.stringify(body)});
 return {f,app,options,req,post:(route,body)=>app.handle(req(route,body))};
}
test('Excel create/revise/read preserves both immutable XLSX versions and canonical accounting',async t=>{
 const a=await setup(t),r=await a.post('create',{deliveryId:'xlsx-first',request:workbook});assert.equal(r.status,200);const first=await r.json();
 const changed=structuredClone(workbook);changed.content.sheets[0].rows[1][0].value='Revised initiative';changed.content.sheets[0].rows[1][1].value=2400;
 const revision=await a.post('revise',{deliveryId:'xlsx-second',baseVersionId:first.version.versionId,request:changed});assert.equal(revision.status,200);const second=await revision.json();
 assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);assert.notEqual(second.version.versionId,first.version.versionId);assert.notEqual(second.version.object.sha256,first.version.object.sha256);
 for(const result of[first,second]){
  assert.equal(result.version.mimeType,ARTIFACT_MIME_TYPES.xlsx);assert.equal(result.version.filename,'Editable planning workbook.xlsx');assert.equal(result.version.generationStatus,'draft');assert.equal(result.version.previewStatus,'pending');
  assert.equal(result.inspection.format,'xlsx');assert.equal(result.inspection.nativeOpened,false);assert.equal(result.inspection.rendered,false);assert.equal(result.inspection.recalculated,false);assert.equal(result.execution.nativeQualified,false);
  const inspection=await a.post('inspect',{versionId:result.version.versionId});assert.equal(inspection.status,200);const inspected=await inspection.json();assert.equal(inspected.inspection.format,'xlsx');assert.equal(inspected.inspection.currentBytesVerified,true);
  const download=await a.post('download',{versionId:result.version.versionId});assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),ARTIFACT_MIME_TYPES.xlsx);assert.equal(download.headers.get('content-disposition'),`attachment; filename="${result.version.filename}"`);assert.equal(download.headers.get('cache-control'),'no-store');assert.equal(download.headers.get('x-content-type-options'),'nosniff');
  const bytes=Buffer.from(await download.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');assert.equal(bytes.length,result.version.object.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),result.version.object.sha256);
 }
 assert.equal(a.f.stats().generations,2);assert.equal(a.f.stats().versionCharges,2);assert.equal(a.f.stats().settled,2);assert.equal(a.f.stats().consumedMicroUsd,'20');
 const repeated=await a.post('create',{deliveryId:'xlsx-first',request:workbook});assert.equal(repeated.status,200);assert.deepEqual((await repeated.json()).version,first.version);assert.equal(a.f.stats().generations,2);assert.equal(a.f.stats().versionCharges,2);
});
for(const [operation,request]of[['create_word',workbook],['create_excel',word]])test(`${operation} refuses opposite-family create and revise before authority/accounting`,async t=>{
 const a=await setup(t,operation),before=a.f.stats();
 for(const route of['create','revise']){const body={deliveryId:'wrong-family',request};if(route==='revise')body.baseVersionId='00000000-0000-4000-8000-000000000001';const r=await a.post(route,body);assert.equal(r.status,400);assert.equal((await r.json()).error.outcome,'NOT_DISPATCHED');}
 const after=a.f.stats();for(const key of['artifactChecks','generations','versionCharges','consumedMicroUsd'])assert.equal(after[key],before[key]);
});
test('canonical workbook errors and caller authority fields refuse before allocation',async t=>{
 const a=await setup(t),badFormula=structuredClone(workbook);badFormula.content.sheets[0].rows[2][1]={formula:'=WEBSERVICE(A1)'};
 const repeatedSheet=structuredClone(workbook);repeatedSheet.content.sheets.push({name:'PLAN',rows:[]});
 for(const body of[{deliveryId:'formula',request:badFormula},{deliveryId:'duplicate',request:repeatedSheet},{deliveryId:'authority',request:workbook,descriptor:descriptor('create_word')}])assert.equal((await a.post('create',body)).status,400);
 assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);assert.equal(a.f.stats().artifactChecks,0);
});
test('only the exact canonical Excel descriptor is admitted, without arbitrary registry expansion',async t=>{
 const a=await setup(t);
 for(const mutate of[d=>{d.operation.version='0.1.0';},d=>{d.requiredGrants=[];},d=>{d.sourceRequirements=[];},d=>{d.operation.id='create_excel_typo';}]){
  const d=descriptor('create_excel');mutate(d);assert.throws(()=>createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:d}}));
 }
 for(const id of['create_powerpoint','run_analysis'])assert.throws(()=>createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:descriptor(id)}}));
 assert.equal(a.f.stats().generations,0);
});
for(const operation of['create_word','create_excel'])test(`${operation} read cannot release an otherwise valid opposite-family stored version`,async t=>{
 const a=await setup(t,operation),request=operation==='create_word'?word:workbook;
 const first=await a.post('create',{deliveryId:'stored',request});assert.equal(first.status,200);const out=await first.json();
 // Read-port correlation only: the original trusted authority/store remains unchanged.
 const other=operation==='create_word'?'create_excel':'create_word',app=createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:descriptor(other)}});
 for(const route of['inspect','download']){const r=await app.handle(a.req(route,{versionId:out.version.versionId}));assert.equal(r.status,502);assert.equal((await r.json()).error.outcome,'RESULT_NOT_RELEASED');}
 assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().versionCharges,1);
});
test('fresh revocation blocks XLSX read without another generation or debit',async t=>{
 const a=await setup(t),created=await a.post('create',{deliveryId:'revocation',request:workbook});assert.equal(created.status,200);const out=await created.json();a.f.revoke();
 for(const route of['inspect','download'])assert.equal((await a.post(route,{versionId:out.version.versionId})).status,403);
 assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().versionCharges,1);assert.equal(a.f.stats().consumedMicroUsd,'10');
});
test('Excel descriptor is detached from later caller mutation',async t=>{
 const a=await setup(t,'create_excel',c=>{c.artifactOptions={...c.artifactOptions,descriptor:structuredClone(c.artifactOptions.descriptor)};return c;});a.options.artifactOptions.descriptor.operation.id='create_word';a.options.artifactOptions.descriptor.requiredGrants.length=0;
 const r=await a.post('create',{deliveryId:'detached',request:workbook});assert.equal(r.status,200);assert.equal(a.f.stats().generations,1);
});
test('Excel application remains disabled by default with no allocation',async t=>{
 const a=await setup(t,'create_excel',c=>{delete c.enabled;return c;});const r=await a.post('create',{deliveryId:'disabled',request:workbook});assert.equal(r.status,503);assert.equal((await r.json()).error.outcome,'NOT_DISPATCHED');assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);
});
for(const [operation,format]of[['create_excel','xlsx'],['create_word','docx']])for(const titleLength of[120,200])test(`canonical ${format} title length${titleLength} releases exact125-character filename`,async t=>{
 const a=await setup(t,operation),request=operation==='create_excel'?structuredClone(workbook):{operation,format,title:'',content:{blocks:[{kind:'paragraph',runs:[{text:'Boundary title'}]}]}};
 request.title='A'.repeat(titleLength);
 const response=await a.post('create',{deliveryId:'canonical-filename',request});assert.equal(response.status,200);const out=await response.json();
 assert.equal(out.version.filename,'A'.repeat(120)+'.'+format);assert.equal(out.version.filename.length,125);
 const inspection=await a.post('inspect',{versionId:out.version.versionId});assert.equal(inspection.status,200);assert.equal((await inspection.json()).version.filename,out.version.filename);
 const download=await a.post('download',{versionId:out.version.versionId});assert.equal(download.status,200);assert.equal(download.headers.get('content-disposition'),`attachment; filename="${out.version.filename}"`);
 const bytes=Buffer.from(await download.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),out.version.object.sha256);assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().consumedMicroUsd,'10');
});
test('forged126-character stored filename cannot be inspected or downloaded',async t=>{
 const a=await setup(t),first=await a.post('create',{deliveryId:'filename-negative',request:workbook});assert.equal(first.status,200);const out=await first.json();
 const read=a.options.artifactOptions.versions.read;
 const app=createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,versions:{...a.options.artifactOptions.versions,async read(...args){const row=await read(...args);return {...row,version:{...row.version,filename:'A'.repeat(121)+'.xlsx'}};}}}});
 for(const route of['inspect','download']){const response=await app.handle(a.req(route,{versionId:out.version.versionId}));assert.equal(response.status,502);const body=await response.json();assert.equal(body.error.outcome,'READ_UNAVAILABLE');}
 assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().versionCharges,1);
});
