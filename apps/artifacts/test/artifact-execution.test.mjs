import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import canonicalize from 'canonicalize';
import {createArtifactValidators} from '../../../packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createArtifactService} from '../service.mjs';
import {createLocalArtifactStore} from '../local-store.mjs';
import {createLocalArtifactExecutor} from '../local-executor.mjs';
import {officeTransformArguments,createLibreOfficeTransformer} from '../office-transform.mjs';
import {createSandboxAnalysisBoundary} from '../sandbox-analysis.mjs';
const hash=x=>createHash('sha256').update(canonicalize(x)).digest('hex');
const bytesHash=x=>createHash('sha256').update(x).digest('hex');
const publicSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/meri.schema.json',import.meta.url)));
const privateSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(publicSchema);ajv.addSchema(privateSchema);
const shape=(schema,name,value)=>{const check=ajv.getSchema(schema+'#/$defs/'+name);if(!check(value))throw new Error(ajv.errorsText(check.errors));};
const validators=createArtifactValidators({validateShape:(name,value)=>shape(privateSchema.$id,name,value),validatePublicShape:(name,value)=>shape(publicSchema.$id,name,value),canonicalSha256:hash});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aR2kAAAAASUVORK5CYII=','base64');
const chart={kind:'bar',title:'Totals',categories:['A','B'],series:[{name:'Value',values:[2,3]}]};
const text={operation:'create_word',format:'txt',title:'Notes',content:{text:'  exact \n\nlast line\n'}};
const word={operation:'create_word',format:'docx',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','2']]},{kind:'chart',chart}]}};
const excel={operation:'create_excel',format:'xlsx',title:'Model',content:{sheets:[{name:'Data',rows:[[{value:'=SUM(A2:A3)'},{value:'00123'}],[{value:2}],[{value:3}],[{formula:'=SUM(A2:A3)'}]],charts:[chart]}]}};
const slides={operation:'create_powerpoint',format:'pptx',title:'Brief',content:{slides:[{title:'Summary',bullets:['First','Second'],notes:'Speaker notes',chart},{title:'Table',table:[['A','B'],['1','2']]}]}};
const analysis={operation:'run_analysis',format:'zip',title:'Analysis',content:{tables:[{name:'input',columns:['id','value'],rows:[['A',2],['B',3]]},{name:'rates',columns:['id','rate'],rows:[['A',4],['B',5]]}],source:'input',steps:[{kind:'join',right:'rates',leftOn:'id',rightOn:'id',how:'left',validate:'one_to_one'},{kind:'derive',name:'amount',left:'value',operator:'multiply',right:{column:'rate'}}],chart:{kind:'bar',x:'id',y:'amount',title:'Computed'}}};
const context=()=>({binding:{tenantId:'tenant',actorId:'actor',conversationId:'10000000-0000-4000-8000-000000000001',runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},scopes:[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'1'}],evidence:[],assets:[],deadlineMs:Date.now()+30000,maxBytes:8388608});
const ids=()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()});
const authorize=async input=>({receiptId:'authority',decision:'allow',action:input.action,binding:input.binding,scopesSha256:hash(input.scopes),resourceSha256:hash(input.resource),requestSha256:input.requestSha256,expiresAtMs:input.deadlineMs});
const budget={reserve:async input=>({ticketId:'ticket',binding:input.binding,requestSha256:input.requestSha256,maxBytes:input.maxBytes,deadlineMs:input.deadlineMs}),settle:async({ticketId,requestSha256,bytes,outcome})=>({ticketId,requestSha256,bytes,outcome,status:'settled'})};
const synthetic={execute:async({request})=>{const bytes=Buffer.from('synthetic');return {bytes,inspection:{sha256:bytesHash(bytes),bytes:bytes.length,format:request.format,nativeOpened:false,rendered:false,recalculated:false,members:[],details:{sourceControl:true}}};}};
const pptxPath='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs';
const require=createRequire(pptxPath+'/package.json'),JSZip=require('jszip');
async function fixture(fn,overrides={}){
  const root=await mkdtemp(join(tmpdir(),'meri-artifact-test-'));let store;
  try{
    store=await createLocalArtifactStore({root:join(root,'store'),canonicalSha256:hash});
    const executor=createLocalArtifactExecutor({pythonExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',nodeExecutable:process.execPath,pptxModulePath:pptxPath,tempRoot:root});
    const ports={validators,authorize,budget,versions:store.versions,objects:store.objects,executor,now:Date.now,ids,...overrides};
    const service=createArtifactService(ports);await fn({service,ports,root,store,executor});
    assert.deepEqual((await readdir(root)).sort(),['store']);
  }finally{await store?.dispose();await rm(root,{recursive:true,force:true});}
}

test('all four typed requests compile under strict private/public schemas',()=>{for(const x of [text,word,excel,slides,analysis])assert.deepEqual(validators.request(x),x);});
test('reject code, external inputs, malformed Unicode, unsafe functions and shape drift',()=>{
  for(const x of [{...text,code:'eval(1)'},{...text,path:'/tmp/x'},{...text,format:'exe'},{...text,content:{text:'\ud800'}},{...excel,content:{sheets:[{name:'X',rows:[[{formula:'=WEBSERVICE(A1)'}]]}]}}])assert.throws(()=>validators.request(x));
  let touched=false;assert.throws(()=>validators.request({get operation(){touched=true;return 'create_word';}}));assert.equal(touched,false);
});
test('context rejects foreign provenance and assets',()=>{const c=context();c.scopes[0].tenantId='other';assert.throws(()=>validators.context(c));});
test('exact UTF8 TXT download plus current-attempt authorization and owned cleanup',async()=>fixture(async({service})=>{
  const c=context(),r=await service.create(text,c);assert.equal(r.version.generationStatus,'draft');assert.equal(r.version.previewStatus,'pending');assert.equal(r.execution.nativeQualified,false);
  const fresh={...c,binding:{...c.binding,attemptId:randomUUID(),workerId:randomUUID(),writerFence:2}};
  const download=await service.download(r.version.versionId,fresh);assert.equal(download.bytes.toString('utf8'),text.content.text);
  assert.equal((await service.inspect(r.version.versionId,fresh)).inspection.currentBytesVerified,true);
}));
test('actual Word package contains rich runs, tables and embedded chart',async()=>fixture(async({service})=>{
  const c=context(),r=await service.create(word,c),d=await service.download(r.version.versionId,c),zip=await JSZip.loadAsync(d.bytes);
  const xml=await zip.file('word/document.xml').async('string');assert.match(xml,/Policy/);assert.match(xml,/<w:tbl>/);assert.match(xml,/<w:b\/>/);assert.ok(Object.keys(zip.files).some(p=>p.startsWith('word/media/')));assert.equal(r.inspection.nativeOpened,false);
}));
test('actual XLSX distinguishes literal formulas and preserves declared formulas with unverified cache',async()=>fixture(async({service})=>{
  const c=context(),r=await service.create(excel,c),d=await service.download(r.version.versionId,c),zip=await JSZip.loadAsync(d.bytes);
  assert.match(await zip.file('xl/sharedStrings.xml').async('string'),/=SUM\(A2:A3\)/);assert.match(await zip.file('xl/sharedStrings.xml').async('string'),/00123/);
  assert.match(await zip.file('xl/worksheets/sheet1.xml').async('string'),/<f>SUM\(A2:A3\)<\/f>/);assert.equal(r.inspection.details.formulas,1);assert.match(r.inspection.details.formulaCache,/unverified/);assert.equal(r.inspection.recalculated,false);assert.equal(Object.keys(zip.files).some(p=>p.includes('externalLinks')),false);
}));
test('actual editable PptxGenJS deck includes notes, chart, table and multiple slides',async()=>fixture(async({service})=>{
  const c=context(),r=await service.create(slides,c),d=await service.download(r.version.versionId,c),zip=await JSZip.loadAsync(d.bytes);
  assert.ok(zip.file('ppt/slides/slide1.xml'));assert.ok(zip.file('ppt/slides/slide2.xml'));assert.ok(Object.keys(zip.files).some(p=>/^ppt\/charts\/chart\d+\.xml$/.test(p)));assert.match(await zip.file('ppt/slides/slide2.xml').async('string'),/<a:tbl>/);assert.equal(r.inspection.rendered,false);
}));
test('actual pandas join, typed delta and chart produce inspectable result bundle',async()=>fixture(async({service})=>{
  const c=context(),r=await service.create(analysis,c),d=await service.download(r.version.versionId,c),zip=await JSZip.loadAsync(d.bytes),result=JSON.parse(await zip.file('result.json').async('string'));
  assert.deepEqual(result.data.map(row=>row.at(-1)),[8,15]);assert.ok(zip.file('chart.png'));assert.equal(result.semantics.codeExecution,false);
}));
test('immutable revision preserves original exact bytes and rejects stale parent',async()=>fixture(async({service})=>{
  const c=context(),first=await service.create(text,c),revised=await service.revise(first.version.versionId,{...text,content:{text:'revision'}},c);
  assert.equal(first.version.artifactId,revised.version.artifactId);assert.equal(revised.version.parentVersionId,first.version.versionId);assert.notEqual(first.version.object.sha256,revised.version.object.sha256);
  assert.equal((await service.download(first.version.versionId,c)).bytes.toString(),text.content.text);assert.equal((await service.download(revised.version.versionId,c)).bytes.toString(),'revision');
  await assert.rejects(service.revise(first.version.versionId,text,c),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_STALE_PARENT');
}));
test('denied authority stops before generation',async()=>fixture(async({service})=>assert.rejects(service.create(text,context()),/ARTIFACT_AUTHORITY/),{authorize:async x=>({...await authorize(x),decision:'deny'}),executor:{execute:()=>assert.fail('must not execute')}}));
test('changed authorization intent is rejected',async()=>fixture(async({service})=>assert.rejects(service.create(text,context()),/ARTIFACT_AUTHORITY/),{authorize:async x=>({...await authorize(x),requestSha256:'0'.repeat(64)}),executor:synthetic}));
test('changed budget binding is rejected',async()=>fixture(async({service})=>assert.rejects(service.create(text,context()),/ARTIFACT_BUDGET/),{budget:{...budget,reserve:async x=>({...await budget.reserve(x),binding:{...x.binding,actorId:'other'}})},executor:synthetic}));
test('unqualified inspection cannot claim rendered, native-opened or recalculated',async()=>{for(const key of ['rendered','nativeOpened','recalculated'])await fixture(async({service})=>assert.rejects(service.create(text,context()),/ARTIFACT_INSPECTION_MISMATCH/),{executor:{execute:async x=>{const r=await synthetic.execute(x);r.inspection[key]=true;return r;}}});});
test('revocation after generation prevents any object commit',async()=>{let n=0;await fixture(async({service,root})=>{await assert.rejects(service.create(text,context()),/ARTIFACT_AUTHORITY/);assert.deepEqual(await readdir(join(root,'store','objects')),[]);},{authorize:async x=>({...await authorize(x),decision:++n>=3?'deny':'allow'}),executor:synthetic});});
test('executor deadlines remain cancellation, not successful artifact publication',async()=>fixture(async({service})=>{const c=context();c.deadlineMs=Date.now()+30;await assert.rejects(service.create(text,c),e=>e.code==='ARTIFACT_DEADLINE'&&e.lifetime.physicalStopProven===false);},{executor:{execute:({signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))}}));
test('post-commit budget failure is explicit unknown effect',async()=>fixture(async({service})=>{await assert.rejects(service.create(text,context()),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.versionCommitted===true);},{budget:{...budget,settle:async()=>{throw new Error('settlement unavailable');}},executor:synthetic}));
test('read integrity detects corrupted object bytes',async()=>fixture(async({service,ports})=>{const c=context(),r=await service.create(text,c);const broken=createArtifactService({...ports,objects:{...ports.objects,get:async()=>Buffer.from('changed')}});await assert.rejects(broken.download(r.version.versionId,c),/ARTIFACT_OBJECT_MISMATCH/);}));
test('fixed Office conversion source arguments have no user option/path channel',()=>{const args=officeTransformArguments({workspace:'/tmp/owned',format:'docx',target:'pdf'});assert.deepEqual(args.slice(-4),['pdf','--outdir','/tmp/owned/out','/tmp/owned/input.docx']);assert.throws(()=>officeTransformArguments({workspace:'/tmp/owned',format:'txt',target:'exe'}));assert.throws(()=>createLibreOfficeTransformer({tempRoot:'/tmp'}),/UNAVAILABLE/);});
test('general analysis is unavailable without admitted native port',async()=>{const c=context(),program={objectId:randomUUID(),versionId:'stored',sha256:'a'.repeat(64),bytes:10,scopes:c.scopes};const boundary=createSandboxAnalysisBoundary({validatePublicShape:(n,v)=>shape(publicSchema.$id,n,v),canonicalSha256:hash});await assert.rejects(boundary.execute({program,inputs:[],outputs:['result.json'],binding:c.binding,deadlineMs:c.deadlineMs}),/UNAVAILABLE/);});
test('actual openpyxl cell revision keeps original XLSX and explicit literals/formulas',async()=>fixture(async({service})=>{
  const c=context(),request={...excel,content:{sheets:[{name:'Data',rows:[[{value:2}],[{formula:'=SUM(A1:A1)'}]]}]}},first=await service.create(request,c);
  const changed={...request,content:{sheets:[{name:'Data',rows:[[{value:7}],[{formula:'=SUM(A1:A1)'}],[{value:'=literal'}]]}]}},second=await service.revise(first.version.versionId,changed,c);
  assert.equal(second.inspection.details.revisionMethod,'openpyxl typed-cell replacement');assert.equal(second.inspection.recalculated,false);
  const old=await JSZip.loadAsync((await service.download(first.version.versionId,c)).bytes),next=await JSZip.loadAsync((await service.download(second.version.versionId,c)).bytes);
  assert.match(await old.file('xl/worksheets/sheet1.xml').async('string'),/<v>2<\/v>/);const xml=await next.file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/<v>7<\/v>/);assert.match(xml,/<f>SUM\(A1:A1\)<\/f>/);assert.match(xml,/=literal/);
}));
test('trusted immutable PNG asset produces Word and PPT image parts without URL fetch',async()=>fixture(async({service,store})=>{
  const c=context(),object=await store.objects.put({objectId:randomUUID(),bytes:png,scopes:c.scopes,requestSha256:'fixture'});c.assets=[{id:'logo',object}];
  const image={kind:'image',assetId:'logo',widthInches:1,heightInches:1};
  for(const request of [{...word,content:{blocks:[image]}},{...slides,content:{slides:[{title:'Image',image}]}}]){
    const r=await service.create(request,c),zip=await JSZip.loadAsync((await service.download(r.version.versionId,c)).bytes);assert.ok(Object.keys(zip.files).some(p=>p.includes('/media/')));
  }
}));
test('actual fixed child deadline rejects and removes owned output workspace',async()=>fixture(async({root})=>{
  const executor=createLocalArtifactExecutor({pythonExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',nodeExecutable:process.execPath,pptxModulePath:pptxPath,tempRoot:root,timeoutMs:1});
  await assert.rejects(executor.execute({request:text,assets:[],deadlineMs:Date.now()+10000,maxBytes:8388608}),e=>e.code==='ARTIFACT_DEADLINE'&&e.receipt.leaderClosed===true);
  assert.deepEqual((await readdir(root)).sort(),['store']);
}));
test('fixed child output failure remains a failure with owned workspace cleanup',async()=>fixture(async({executor})=>assert.rejects(executor.execute({request:text,assets:[],deadlineMs:Date.now()+10000,maxBytes:1}),/ARTIFACT_PROCESS_FAILED/)));
test('pure source PDF composition remains unavailable without explicit transformer',async()=>fixture(async({service})=>assert.rejects(service.create({...word,format:'pdf'},context()),/ARTIFACT_RENDERER_UNAVAILABLE/)));
test('all asset/provenance tuples participate in immutable intent',async()=>fixture(async({ports})=>{
  const calls=[],auth=async input=>{calls.push(input.requestSha256);return authorize(input);},service=createArtifactService({...ports,authorize:auth,executor:synthetic});
  const c=context();await service.create(text,c);const first=calls[0];calls.length=0;c.scopes=[{...c.scopes[0],policyRevision:'2'}];await service.create(text,c);assert.notEqual(first,calls[0]);
}));
test('stable version allocation cannot overwrite an immutable committed version',async()=>fixture(async({ports})=>{
  const allocation=ids(),service=createArtifactService({...ports,ids:()=>allocation,executor:synthetic}),c=context();await service.create(text,c);
  await assert.rejects(service.create({...text,content:{text:'different intent'}},c),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_COMMIT_RECONCILIATION_REQUIRED');
}));
test('sandbox input/receipt verifier gates general code before any port call',async()=>{
  const c=context(),program={objectId:randomUUID(),versionId:'stored',sha256:'a'.repeat(64),bytes:10,scopes:c.scopes},value={program,inputs:[],outputs:['result.json'],binding:c.binding,deadlineMs:c.deadlineMs,admission:{receiptSha256:'b'.repeat(64),imageDigest:'sha256:'+'c'.repeat(64)}};
  const boundary=createSandboxAnalysisBoundary({validatePublicShape:(n,v)=>shape(publicSchema.$id,n,v),canonicalSha256:hash,verifyAdmission:async()=>({allowed:false}),port:{execute:()=>assert.fail('not admitted')}});
  await assert.rejects(boundary.execute(value),/ADMISSION_REQUIRED/);
});
