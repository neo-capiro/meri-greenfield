// DA-2 regression: a PDF revision must never hand its retained PDF bytes to the
// DOCX (python-docx) revision owner. Synthetic converter port; the PDF bytes are
// a structurally complete PDF 1.4 file (header, objects, exact xref, trailer).
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readdir,readFile,rm,writeFile,chmod} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import canonicalize from 'canonicalize';
import {createArtifactValidators} from '../../../packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createArtifactService} from '../service.mjs';
import {createLocalArtifactStore} from '../local-store.mjs';
import {createLocalArtifactExecutor} from '../local-executor.mjs';
import {createLibreOfficeTransformer} from '../office-transform.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pptxModulePath=process.env.MERI_PPTXGENJS??fileURLToPath(new URL('../../worker/qualification/node_modules/pptxgenjs',import.meta.url));
const entry=fileURLToPath(new URL('../python/entry.py',import.meta.url));
const hash=x=>createHash('sha256').update(canonicalize(x)).digest('hex');
const sha=b=>createHash('sha256').update(b).digest('hex');
const publicSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/meri.schema.json',import.meta.url)));
const privateSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(publicSchema);ajv.addSchema(privateSchema);
const shape=(schema,name,value)=>{const check=ajv.getSchema(schema+'#/$defs/'+name);if(!check(value))throw new Error(ajv.errorsText(check.errors));};
const validators=createArtifactValidators({validateShape:(name,value)=>shape(privateSchema.$id,name,value),validatePublicShape:(name,value)=>shape(publicSchema.$id,name,value),canonicalSha256:hash});

// A complete one-page PDF with byte-exact xref offsets.
function realPdf(text){
  const content=`BT /F1 18 Tf 72 720 Td (${text}) Tj ET`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let body='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';const offsets=[];
  for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(body,'latin1'));body+=`${i+1} 0 obj\n${o}\nendobj\n`;}
  const xref=Buffer.byteLength(body,'latin1');
  body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body,'latin1');
}
const word={operation:'create_word',format:'pdf',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','2']]}]}};
const revised={...word,content:{blocks:[{kind:'paragraph',runs:[{text:'Revised'}]}]}};

// Records every interpreter launch, then runs the real interpreter unchanged.
async function spyPython(dir){
  const log=join(dir,'python-launches.log'),script=join(dir,'python-spy.sh');
  await writeFile(script,`#!/bin/sh\necho launched >> '${log}'\nexec '${python}' "$@"\n`,{mode:0o700});await chmod(script,0o700);
  return {script,launches:async()=>existsSync(log)?(await readFile(log,'utf8')).trim().split('\n').length:0};
}
function syntheticConverter(){
  const calls=[];
  return {calls,transform:async({bytes,format,target})=>{calls.push({format,target,magic:bytes.subarray(0,5).toString('latin1')});const out=realPdf('Converted '+sha(bytes).slice(0,8));return {bytes:out,receipt:{inputSha256:sha(bytes),outputSha256:sha(out),format,target,nativeQualification:false,renderInspection:'pending',formulaEquivalence:'unqualified'}};}};
}
async function owned(fn){const dir=await mkdtemp(join(tmpdir(),'meri-pdf-revision-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}

test('the fixture PDF is a structurally complete PDF and not a ZIP/DOCX package',()=>{
  const pdf=realPdf('Parent');assert.equal(pdf.subarray(0,5).toString('latin1'),'%PDF-');assert.notEqual(pdf.subarray(0,2).toString('latin1'),'PK');
  const text=pdf.toString('latin1'),xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(xref,xref+4),'xref');
  for(const [i,offset] of [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map(m=>Number(m[1])).entries())assert.equal(text.slice(offset).split('\n')[0],`${i+1} 0 obj`);
});

test('executor refuses a PDF revision before any interpreter, DOCX parser or converter receives the PDF bytes',()=>owned(async dir=>{
  const spy=await spyPython(dir),converter=syntheticConverter(),root=join(dir,'tmp');await (await import('node:fs/promises')).mkdir(root);
  const executor=createLocalArtifactExecutor({pythonExecutable:spy.script,nodeExecutable:process.execPath,pptxModulePath,tempRoot:root,officeTransformer:converter});
  const parent=realPdf('Parent');
  await assert.rejects(executor.execute({request:revised,assets:[],base:{request:word,bytes:parent},deadlineMs:Date.now()+15000,maxBytes:1048576}),e=>e.code==='ARTIFACT_REVISION_UNSUPPORTED');
  assert.equal(await spy.launches(),0,'no generator process may be launched for a PDF revision');
  assert.deepEqual(converter.calls,[]);assert.deepEqual(await readdir(root),[]);
  // Positive control: creation (no base) still routes PDF through the DOCX builder and the converter.
  const created=await executor.execute({request:word,assets:[],base:null,deadlineMs:Date.now()+15000,maxBytes:1048576});
  assert.equal(await spy.launches(),1);assert.equal(converter.calls.length,1);assert.equal(converter.calls[0].format,'docx');assert.equal(converter.calls[0].target,'pdf');assert.ok(converter.calls[0].magic.startsWith('PK\u0003\u0004'),'the converter receives the DOCX intermediate');
  assert.equal(created.bytes.subarray(0,5).toString('latin1'),'%PDF-');assert.equal(created.inspection.format,'pdf');assert.deepEqual(await readdir(root),[]);
}));

test('python entry refuses any base whose retained format differs from the generation format, before parsing it',()=>owned(async dir=>{
  const run=(request,base)=>spawnSync(python,['-I','-B',entry],{cwd:dir,input:JSON.stringify({request,maxBytes:1048576,base,assets:[]}),env:{PATH:'/usr/bin:/bin',HOME:dir,TMPDIR:dir,LANG:'C.UTF-8'}});
  const docx={...revised,format:'docx'};
  const pdfBase=run(docx,{request:word,base64:realPdf('Parent').toString('base64')});
  assert.equal(pdfBase.status,2);assert.deepEqual(JSON.parse(pdfBase.stderr.toString()),{error:'ARTIFACT_GENERATION_FAILED',type:'BaseFormatMismatch'});
  assert.equal(existsSync(join(dir,'artifact.docx')),false);
  // Even a base labelled DOCX must carry a ZIP package; PDF bytes never reach python-docx.
  const mislabelled=run(docx,{request:{...word,format:'docx'},base64:realPdf('Parent').toString('base64')});
  assert.equal(mislabelled.status,2);assert.deepEqual(JSON.parse(mislabelled.stderr.toString()),{error:'ARTIFACT_GENERATION_FAILED',type:'BaseFormatMismatch'});
  // Positive control: a genuine DOCX base still revises through its own owner.
  const created=run({...word,format:'docx'},null);assert.equal(created.status,0,created.stderr.toString());
  const bytes=await readFile(join(dir,'artifact.docx'));await rm(join(dir,'artifact.docx'));
  const next=run(docx,{request:{...word,format:'docx'},base64:bytes.toString('base64')});assert.equal(next.status,0,next.stderr.toString());
  assert.equal(JSON.parse(next.stdout.toString()).details.paragraphs,1);
}));

async function serviceFixture(dir,transformer){
  const spy=await spyPython(dir),root=join(dir,'tmp'),settled=[],puts=[];await (await import('node:fs/promises')).mkdir(root);
  const store=await createLocalArtifactStore({root:join(dir,'store'),canonicalSha256:hash});
  const executor=createLocalArtifactExecutor({pythonExecutable:spy.script,nodeExecutable:process.execPath,pptxModulePath,tempRoot:root,timeoutMs:60000,officeTransformer:transformer});
  const service=createArtifactService({validators,executor,now:Date.now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),versions:store.versions,
    objects:{put:async(v,s)=>{puts.push(v.objectId);return store.objects.put(v,s);},get:store.objects.get},
    authorize:async i=>({receiptId:'authority',decision:'allow',action:i.action,binding:i.binding,scopesSha256:hash(i.scopes),resourceSha256:hash(i.resource),requestSha256:i.requestSha256,expiresAtMs:i.deadlineMs}),
    budget:{reserve:async i=>({ticketId:'ticket',binding:i.binding,requestSha256:i.requestSha256,maxBytes:i.maxBytes,deadlineMs:i.deadlineMs}),settle:async({ticketId,requestSha256,bytes,outcome})=>{settled.push(outcome);return {ticketId,requestSha256,bytes,outcome,status:'settled'};}}});
  return {service,store,spy,root,settled,puts};
}
const context=()=>({binding:{tenantId:'tenant',actorId:'actor',conversationId:'10000000-0000-4000-8000-000000000001',runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},scopes:[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'1'}],evidence:[],assets:[],deadlineMs:Date.now()+60000,maxBytes:8388608});

async function createInspectReviseReplay(transformer){
  return owned(async dir=>{
    const f=await serviceFixture(dir,transformer);
    try{
      const c=context(),created=await f.service.create(word,c);assert.equal(created.version.mimeType,'application/pdf');
      const download=await f.service.download(created.version.versionId,c),parent=Buffer.from(download.bytes);
      assert.equal(parent.subarray(0,5).toString('latin1'),'%PDF-');assert.equal(sha(parent),created.version.object.sha256);
      assert.equal((await f.service.inspect(created.version.versionId,c)).inspection.currentBytesVerified,true);
      const launches=await f.spy.launches(),puts=f.puts.length;assert.equal(launches,1);
      for(let attempt=0;attempt<2;attempt++){ // revise, then replay the same revision: same closed refusal, no effects
        await assert.rejects(f.service.revise(created.version.versionId,revised,c),e=>e.code==='ARTIFACT_REVISION_UNSUPPORTED');
        assert.equal(await f.spy.launches(),launches,'the retained PDF never reaches a generator process');assert.equal(f.puts.length,puts,'no object written');
      }
      assert.deepEqual(f.settled,['completed','failed','failed']);
      const again=await f.service.download(created.version.versionId,c);assert.deepEqual(again.bytes,parent,'exact parent bytes retained');
      assert.deepEqual(await readdir(f.root),[]);
    }finally{await f.store.dispose();}
  });
}
test('service create -> download/inspect -> revise -> replay: PDF revision is a closed refusal with the parent retained',()=>createInspectReviseReplay(syntheticConverter()));

// Local-only evidence: real LibreOffice conversion when an executable is explicitly supplied.
test('real LibreOffice PDF create then refused revision (opt-in MERI_ARTIFACT_SOFFICE)',{skip:!process.env.MERI_ARTIFACT_SOFFICE&&'MERI_ARTIFACT_SOFFICE not set'},()=>owned(async dir=>{
  await createInspectReviseReplay(createLibreOfficeTransformer({executable:process.env.MERI_ARTIFACT_SOFFICE,tempRoot:dir}));
}));
