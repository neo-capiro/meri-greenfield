/** Independent exact application controls; actual local XLSX bytes, scripted accounting. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createDocumentApplication} from '../index.mjs';
import {createLocalDocumentFixture} from '../local/fixture.mjs';
import {runArtifactProcess} from '../../../artifacts/process.mjs';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipts=[];
const descriptor=id=>{const e=catalog.operations.find(x=>x.operation.id===id);return structuredClone({operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements});};
const workbook=()=>({operation:'create_excel',format:'xlsx',title:'Independent workbook',content:{sheets:[
 {name:'Budget',rows:[[{value:'Item'},{value:'Units'},{value:'Unit cost'},{value:'Total'}],[{value:'Analysis'},{value:3},{value:12.5,numberFormat:'$0.00'},{formula:'=B2*C2',numberFormat:'$0.00'}],[{value:'Literal'},{value:'=1+1'},{value:'https://example.invalid/x'},{value:false}],[{value:'Total'},{formula:'=SUM(D2:D2)',numberFormat:'$0.00'}]]},
 {name:'Notes',rows:[[{value:'Unicode π'},{value:0}],[{value:'Retain this text'}]]}
]}});
const word=(format='txt')=>({operation:'create_word',format,title:'Word stays supported',content:format==='txt'?{text:'Stable Word text\n'}:{blocks:[{kind:'paragraph',runs:[{text:'Stable Word paragraph'}]}]}});
async function setup(t,{operation='create_excel',change=x=>x}={}){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation});
 t.after(async()=>{receipts.push(...f.stats().processReceipts);await f.close();assert.equal(f.stats().cleanup.executorDirectoriesAbsent,true);assert.equal(f.stats().cleanup.storeRemoved,true);await assert.rejects(access(f.directory));});
 const options=change({sessions:{authenticateSession:f.sessions.authenticateSession,readCurrentState:f.sessions.readCurrentState},selectedClientId:f.selectedClientId,artifactOptions:{...f.artifactOptions,context:structuredClone(f.artifactOptions.context),descriptor:structuredClone(f.artifactOptions.descriptor)},credential:f.credential,now:f.now,limits:{...f.limits},enabled:true});
 let app=createDocumentApplication(options);const session=await f.sessions.issue({identityCredential:f.nativeCredential});
 const request=(route,body,extra={})=>new Request('http://127.0.0.1/api/documents/'+route,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+session.credential},body:JSON.stringify(body),...extra});
 return{f,options,session,request,app,post:(route,body,extra)=>app.handle(request(route,body,extra)),reconstruct(){app=createDocumentApplication(options);}};
}
async function good(response){const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body;}
async function denied(response,outcome){const body=await response.json();assert.notEqual(response.status,200);assert.deepEqual(Object.keys(body),['error']);assert.deepEqual(Object.keys(body.error).sort(),['code','outcome']);if(outcome)assert.equal(body.error.outcome,outcome);assert.equal(response.headers.get('cache-control'),'no-store');return body;}
async function download(a,id){const r=await a.post('download',{versionId:id});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),mime);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('access-control-allow-origin'),null);assert.match(r.headers.get('content-disposition'),/\.xlsx"$/);return Buffer.from(await r.arrayBuffer());}
async function inspectBytes(a,bytes){const code=`import io,json,sys,zipfile,openpyxl
raw=sys.stdin.buffer.read()
book=openpyxl.load_workbook(io.BytesIO(raw),data_only=False,keep_links=False)
try:
 data={'sheets':book.sheetnames,'cells':{p.title:{c.coordinate:{'value':c.value,'type':c.data_type,'format':c.number_format,'hyperlink':None if c.hyperlink is None else c.hyperlink.target} for row in p for c in row} for p in book},'calc':{'full':book.calculation.fullCalcOnLoad,'force':book.calculation.forceFullCalc},'members':zipfile.ZipFile(io.BytesIO(raw)).namelist()}
 print(json.dumps(data,ensure_ascii=False))
finally:book.close()
`;
 const out=await runArtifactProcess(python,['-I','-B','-c',code],{cwd:a.f.directory,input:bytes,deadlineMs:a.f.artifactOptions.context.deadlineMs});receipts.push(out.receipt);return JSON.parse(out.stdout);
}
after(()=>{for(const r of receipts){assert.equal(r.groupAbsent,true);assert.equal(r.leaderClosed,true);assert.equal(r.sandboxQualified,false);assert.throws(()=>process.kill(-r.pid,0),e=>e.code==='ESRCH');}console.log('INDEPENDENT_WORKBOOK_PROCESSES',JSON.stringify(receipts.map(r=>({pid:r.pid,exitCode:r.exitCode,groupAbsent:r.groupAbsent,leaderClosed:r.leaderClosed,sandboxQualified:r.sandboxQualified}))));});

test('actual workbook immutable create revise reopen replay and reconstruction preserve exact cells and original bytes',async t=>{
 const a=await setup(t);assert.deepEqual(a.f.artifactOptions.descriptor,descriptor('create_excel'));
 const first=await good(await a.post('create',{deliveryId:'xlsx-first',request:workbook()}));assert.equal(first.version.mimeType,mime);assert.equal(first.version.parentVersionId,null);assert.equal(first.version.previewStatus,'pending');assert.equal(first.execution.nativeQualified,false);assert.equal(first.inspection.nativeOpened,false);assert.equal(first.inspection.rendered,false);assert.equal(first.inspection.recalculated,false);
 const original=await download(a,first.version.versionId),before=await inspectBytes(a,original);assert.equal(hash(original),first.version.object.sha256);assert.equal(original.length,first.version.object.bytes);assert.deepEqual(before.sheets,['Budget','Notes']);assert.equal(before.cells.Budget.D2.value,'=B2*C2');assert.equal(before.cells.Budget.D2.type,'f');assert.equal(before.cells.Budget.C2.format,'$0.00');assert.equal(before.cells.Budget.B3.value,'=1+1');assert.equal(before.cells.Budget.B3.type,'s');assert.equal(before.cells.Budget.C3.hyperlink,null);assert.equal(before.cells.Notes.A1.value,'Unicode π');assert.equal(before.cells.Budget.D3.value,false);assert(!before.members.some(p=>/vbaProject|externalLinks/.test(p)));
 const changed=workbook();changed.content.sheets[0].rows[1][1].value=7;changed.content.sheets[0].rows[1][3].formula='=B2*C2+5';changed.content.sheets[1].rows[1][0].value='Revised note';
 const second=await good(await a.post('revise',{deliveryId:'xlsx-next',baseVersionId:first.version.versionId,request:changed}));assert.equal(second.version.artifactId,first.version.artifactId);assert.equal(second.version.parentVersionId,first.version.versionId);assert.notEqual(second.version.versionId,first.version.versionId);assert.equal(second.inspection.details.revisionMethod,'openpyxl typed-cell replacement');assert.equal(second.inspection.recalculated,false);
 a.reconstruct();const next=await download(a,second.version.versionId),after=await inspectBytes(a,next);assert.equal(hash(next),second.version.object.sha256);assert.equal(after.cells.Budget.B2.value,7);assert.equal(after.cells.Budget.D2.value,'=B2*C2+5');assert.equal(after.cells.Budget.D2.format,'$0.00');assert.equal(after.cells.Budget.B3.type,'s');assert.equal(after.cells.Notes.A2.value,'Revised note');assert.equal(after.calc.full,true);assert.equal(after.calc.force,true);assert.deepEqual(await download(a,first.version.versionId),original);
 for(const v of[first.version,second.version]){const r=await good(await a.post('inspect',{versionId:v.versionId}));assert.equal(r.inspection.format,'xlsx');assert.equal(r.inspection.currentBytesVerified,true);assert.equal(r.inspection.sha256,v.object.sha256);}
 await denied(await a.post('create',{deliveryId:'xlsx-first',request:workbook()}),'UNKNOWN');await denied(await a.post('create',{deliveryId:'xlsx-first',request:changed}),'UNKNOWN');assert.equal(a.f.stats().generations,2);assert.equal(a.f.stats().versionCharges,2);assert.equal(a.f.stats().consumedMicroUsd,'20');
 a.f.revoke();for(const v of[first.version,second.version])await denied(await a.post('download',{versionId:v.versionId}));await denied(await a.post('create',{deliveryId:'revoked',request:workbook()}));assert.equal(a.f.stats().generations,2);
});
for(const format of ['txt','docx'])test(`Word ${format} remains in its original grant family`,async t=>{const a=await setup(t,{operation:'create_word'});const out=await good(await a.post('create',{deliveryId:'word-'+format,request:word(format)}));assert.equal(out.inspection.format,format);assert.equal(out.execution.nativeQualified,false);const read=await a.post('download',{versionId:out.version.versionId});assert.equal(read.status,200);if(format==='txt')assert.equal(await read.text(),word().content.text);else assert.equal(Buffer.from(await read.arrayBuffer()).subarray(0,2).toString(),'PK');});
for(const [selected,body]of[['create_word',workbook()],['create_excel',word()],['create_excel',word('docx')],['create_excel',{...workbook(),format:'pdf'}],['create_excel',{...workbook(),operation:'create_powerpoint'}]])for(const route of ['create','revise'])test(`${selected} cannot dispatch ${body.operation}/${body.format} through ${route}`,async t=>{const a=await setup(t,{operation:selected});const initial=a.f.stats();await denied(await a.post(route,{deliveryId:'wrong-family',...(route==='revise'?{baseVersionId:'11111111-1111-4111-8111-111111111111'}:{}),request:body}),'NOT_DISPATCHED');assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);assert.equal(a.f.stats().artifactChecks,initial.artifactChecks);});
test('Excel descriptor is exact canonical data and cannot redefine grants source requirements version or format',async t=>{const a=await setup(t);for(const edit of[d=>d.requiredGrants=[],d=>d.sourceRequirements=[],d=>d.operation.version='0.1.0',d=>d.format='xlsx',d=>d.operation.id='create_spreadsheet']){const d=descriptor('create_excel');edit(d);assert.throws(()=>createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:d}}));}});
for(const key of ['context','credential','scopes','descriptor','operation'])test(`raw ${key} cannot choose workbook authority`,async t=>{const a=await setup(t);await denied(await a.post('create',{deliveryId:'injected',request:workbook(),[key]:'forged'}),'NOT_DISPATCHED');assert.equal(a.f.stats().versionCharges,0);});
test('Word application cannot release an Excel version through inspect or download',async t=>{const a=await setup(t),out=await good(await a.post('create',{deliveryId:'xlsx',request:workbook()}));const other=createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:descriptor('create_word')}});for(const route of['inspect','download'])await denied(await other.handle(a.request(route,{versionId:out.version.versionId})));assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().versionCharges,1);});
test('Excel application cannot release a Word version through inspect or download',async t=>{const a=await setup(t,{operation:'create_word'}),out=await good(await a.post('create',{deliveryId:'txt',request:word()}));const other=createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:descriptor('create_excel')}});for(const route of['inspect','download'])await denied(await other.handle(a.request(route,{versionId:out.version.versionId})));assert.equal(a.f.stats().generations,1);});
test('separate workbook stores and session tokens cannot release another instance version',async t=>{const a=await setup(t),b=await setup(t);assert.notEqual(a.f.directory,b.f.directory);assert.notEqual(a.session.credential,b.session.credential);const out=await good(await a.post('create',{deliveryId:'private-store',request:workbook()}));await denied(await b.post('download',{versionId:out.version.versionId}));await denied(await b.app.handle(b.request('download',{versionId:out.version.versionId},{headers:{'content-type':'application/json',authorization:'Bearer '+a.session.credential}})));assert.equal(b.f.stats().generations,0);assert.equal(b.f.stats().versionCharges,0);});
for(const label of['tenant','actor','fence','client'])test(`Excel current ${label} substitution refuses before accounting`,async t=>{const a=await setup(t,{change:c=>{const original=c.sessions.readCurrentState;c.sessions.readCurrentState=async call=>{const r=await original(call);if(label==='tenant')r.binding.tenantId='other';if(label==='actor')r.binding.actorId='other';if(label==='fence')r.binding.writerFence++;if(label==='client')r.selectedClientId='11111111-1111-4111-8111-111111111111';return r;};return c;}});await denied(await a.post('create',{deliveryId:'foreign',request:workbook()}),'NOT_DISPATCHED');assert.equal(a.f.stats().versionCharges,0);});
test('Excel remains unavailable by default without closing borrowed session',async t=>{const a=await setup(t,{change:c=>{delete c.enabled;return c;}});assert.equal((await a.post('create',{deliveryId:'disabled',request:workbook()})).status,503);assert.equal(a.f.stats().generations,0);assert.equal(a.f.sessions.status().closed,false);});
test('Excel original deadline aborts parked current authority before dispatch',async t=>{let aborted=false;const a=await setup(t,{change:c=>{c.limits.maxRequestMs=35;c.sessions.readCurrentState=call=>new Promise((_,reject)=>{call.signal.addEventListener('abort',()=>{aborted=true;reject(Error('stopped'));},{once:true});});return c;}});const at=Date.now();await denied(await a.post('create',{deliveryId:'parked',request:workbook()}),'NOT_DISPATCHED');assert.equal(aborted,true);assert(Date.now()-at<1000);assert.equal(a.f.stats().versionCharges,0);});
test('Excel completed bytes remain withheld after object-read session revocation',async t=>{let afterGet=()=>{};const a=await setup(t,{change:c=>{const original=c.artifactOptions.objects.get;c.artifactOptions.objects={...c.artifactOptions.objects,async get(...args){const bytes=await original(...args);afterGet();return bytes;}};return c;}});const out=await good(await a.post('create',{deliveryId:'original',request:workbook()}));afterGet=()=>a.f.revoke();await denied(await a.post('download',{versionId:out.version.versionId}));assert.equal(a.f.stats().versionCharges,1);});

test('a canonical Word descriptor cannot turn an Excel-only allocation into Word generation',async t=>{const a=await setup(t);const other=createDocumentApplication({...a.options,artifactOptions:{...a.options.artifactOptions,descriptor:descriptor('create_word')}});await denied(await other.handle(a.request('create',{deliveryId:'wrong-allocation',request:word()})));assert.equal(a.f.stats().generations,0);assert.equal(a.f.stats().versionCharges,0);});

// Added after the separate, frozen root CLI became reviewable; no workbook regeneration.
test('workbook CLI help imports no fixture graph and leaves environment unchanged',async()=>{
 const {main}=await import('../../../../scripts/local-workbook/run.mjs');
 const before=process.env.MERI_REVIEW_SOURCE_ROOT;let output='';
 assert.equal(await main(['--help'],text=>{output+=text;}),0);
 assert.match(output,/Usage:/);assert.match(output,/No model, native qualification or production activation/);
 assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,before);
});
test('workbook CLI malformed arguments refuse before graph and output allocation',async()=>{
 const {main}=await import('../../../../scripts/local-workbook/run.mjs');
 const before=process.env.MERI_REVIEW_SOURCE_ROOT;
 for(const args of[[],['--run'],['--help','--run'],['--run','--python','relative','--soffice','/abs','--output','/tmp/unused'],['--run','--python','/abs','--soffice','/abs','--output','relative'],['--run','--output','/tmp/unused','--python','/abs','--soffice','/abs']]){
  let output='';assert.equal(await main(args,text=>{output+=text;}),2);assert.match(output,/Usage:/);
 }
 assert.equal(process.env.MERI_REVIEW_SOURCE_ROOT,before);
});
