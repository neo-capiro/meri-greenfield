// PDF revision (DA-2 follow-through): a PDF revision is a full re-render of the complete revised typed spec from the
// default template, through the same DOCX -> PDF route as creation, recorded as a new immutable version with
// exact-parent lineage. The parent's PDF bytes are verified by the service but never reach a generator, parser or
// converter (the DA-2 wrong-parser guard in entry.py stays). Default suite: SYNTHETIC converter port (pdf-fixtures.mjs)
// with the real DOCX generator; opt-in real LibreOffice variant with MERI_ARTIFACT_SOFFICE.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readdir,readFile,rm,writeFile,chmod} from 'node:fs/promises';
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
import {structureCheck} from '../structure/file-structure.mjs';
import {realPdf,pdfLines,sha,syntheticConverter} from './pdf-fixtures.mjs';

const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const pptxModulePath=process.env.MERI_PPTXGENJS??fileURLToPath(new URL('../../worker/qualification/node_modules/pptxgenjs',import.meta.url));
const entry=fileURLToPath(new URL('../python/entry.py',import.meta.url));
const hash=x=>createHash('sha256').update(canonicalize(x)).digest('hex');
const publicSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/meri.schema.json',import.meta.url)));
const privateSchema=JSON.parse(await readFile(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(publicSchema);ajv.addSchema(privateSchema);
const shape=(schema,name,value)=>{const check=ajv.getSchema(schema+'#/$defs/'+name);if(!check(value))throw new Error(ajv.errorsText(check.errors));};
const validators=createArtifactValidators({validateShape:(name,value)=>shape(privateSchema.$id,name,value),validatePublicShape:(name,value)=>shape(publicSchema.$id,name,value),canonicalSha256:hash});

const word={operation:'create_word',format:'pdf',title:'Brief',content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Policy',bold:true}]},{kind:'table',rows:[['Name','Value'],['A','2']]}]}};
// A complete revised typed spec (full replacement), not a patch.
const revised={...word,content:{blocks:[{kind:'paragraph',style:'Title',runs:[{text:'Revised policy',bold:true}]},{kind:'paragraph',runs:[{text:'Second paragraph'}]},{kind:'table',rows:[['Name','Value'],['A','3']]}]}};
const parentLines=['Policy','Name','Value','A','2'],revisedLines=['Revised policy','Second paragraph','Name','Value','A','3'];

// Records every interpreter launch and its exact stdin, then runs the real interpreter unchanged.
async function spyPython(dir){
  const log=join(dir,'python-launches'),script=join(dir,'python-spy.sh');await mkdir(log);
  await writeFile(script,`#!/bin/sh\nn=$(ls '${log}' | wc -l)\ncat > '${log}'/$n.json\nexec '${python}' "$@" < '${log}'/$n.json\n`,{mode:0o700});await chmod(script,0o700);
  const inputs=async()=>{const names=(await readdir(log)).sort((a,b)=>parseInt(a)-parseInt(b));return Promise.all(names.map(async n=>JSON.parse(await readFile(join(log,n),'utf8'))));};
  return {script,inputs,launches:async()=>(await readdir(log)).length};
}
async function owned(fn){const dir=await mkdtemp(join(tmpdir(),'meri-pdf-revision-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
const isPdf=bytes=>{assert.equal(bytes.subarray(0,5).toString('latin1'),'%PDF-');assert.deepEqual(structureCheck(bytes,'pdf'),{valid:true});};

test('the fixture PDF is a structurally complete PDF and not a ZIP/DOCX package',()=>{
  const pdf=realPdf(parentLines);isPdf(pdf);assert.notEqual(pdf.subarray(0,2).toString('latin1'),'PK');assert.deepEqual(pdfLines(pdf),parentLines);
  const text=pdf.toString('latin1'),xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(text.slice(xref,xref+4),'xref');
  for(const [i,offset] of [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map(m=>Number(m[1])).entries())assert.equal(text.slice(offset).split('\n')[0],`${i+1} 0 obj`);
});

test('executor re-renders a PDF revision from the complete revised spec and the default template; parent PDF bytes reach no generator',()=>owned(async dir=>{
  const spy=await spyPython(dir),converter=syntheticConverter(),root=join(dir,'tmp');await mkdir(root);
  const executor=createLocalArtifactExecutor({pythonExecutable:spy.script,nodeExecutable:process.execPath,pptxModulePath,tempRoot:root,officeTransformer:converter});
  const parent=realPdf(parentLines);
  const result=await executor.execute({request:revised,assets:[],base:{request:word,bytes:parent},deadlineMs:Date.now()+15000,maxBytes:1048576});
  assert.equal(await spy.launches(),1,'one DOCX build, as for creation');
  const [input]=await spy.inputs();
  assert.equal(input.base,null,'the generator receives no base: default template, never the parent PDF');assert.deepEqual(input.request,{...revised,format:'docx'});
  assert.equal(JSON.stringify(input).includes(parent.toString('base64')),false);
  assert.equal(converter.calls.length,1);assert.equal(converter.calls[0].format,'docx');assert.equal(converter.calls[0].valid,true,'the converter receives a valid DOCX intermediate');
  assert.deepEqual(converter.calls[0].texts,revisedLines,'only the revised spec is rendered');
  isPdf(result.bytes);assert.deepEqual(pdfLines(result.bytes),revisedLines);
  assert.deepEqual(result.inspection,{sha256:sha(result.bytes),bytes:result.bytes.length,format:'pdf',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{conversionCompleted:true,renderInspection:'pending',sourceDocxSha256:converter.calls[0].inputSha256}});
  validators.inspection(result.inspection);assert.deepEqual(await readdir(root),[]);
  // A PDF revision over a base recorded as another format is refused before any process or workspace.
  await assert.rejects(executor.execute({request:revised,assets:[],base:{request:{...word,format:'docx'},bytes:parent},deadlineMs:Date.now()+15000,maxBytes:1048576}),e=>e.code==='ARTIFACT_REVISION_FORMAT');
  assert.equal(await spy.launches(),1);assert.equal(converter.calls.length,1);assert.deepEqual(await readdir(root),[]);
  // DA-2 guard kept: PDF bytes handed to the DOCX revision owner still fail BaseFormatMismatch before python-docx parses them.
  await assert.rejects(executor.execute({request:{...revised,format:'docx'},assets:[],base:{request:{...word,format:'docx'},bytes:parent},deadlineMs:Date.now()+15000,maxBytes:1048576}),
    e=>e.code==='ARTIFACT_PROCESS_FAILED'&&JSON.parse(e.stderr.toString()).type==='BaseFormatMismatch');
  assert.equal(converter.calls.length,1);assert.deepEqual(await readdir(root),[]);
}));

test('python entry refuses any base whose retained format differs from the generation format, before parsing it',()=>owned(async dir=>{
  const run=(request,base)=>spawnSync(python,['-I','-B',entry],{cwd:dir,input:JSON.stringify({request,maxBytes:1048576,base,assets:[]}),env:{PATH:'/usr/bin:/bin',HOME:dir,TMPDIR:dir,LANG:'C.UTF-8'}});
  const docx={...revised,format:'docx'};
  const pdfBase=run(docx,{request:word,base64:realPdf(parentLines).toString('base64')});
  assert.equal(pdfBase.status,2);assert.deepEqual(JSON.parse(pdfBase.stderr.toString()),{error:'ARTIFACT_GENERATION_FAILED',type:'BaseFormatMismatch'});
  assert.equal(existsSync(join(dir,'artifact.docx')),false);
  // Even a base labelled DOCX must carry a ZIP package; PDF bytes never reach python-docx.
  const mislabelled=run(docx,{request:{...word,format:'docx'},base64:realPdf(parentLines).toString('base64')});
  assert.equal(mislabelled.status,2);assert.deepEqual(JSON.parse(mislabelled.stderr.toString()),{error:'ARTIFACT_GENERATION_FAILED',type:'BaseFormatMismatch'});
  // Positive control: a genuine DOCX base still revises through its own owner.
  const created=run({...word,format:'docx'},null);assert.equal(created.status,0,created.stderr.toString());
  const bytes=await readFile(join(dir,'artifact.docx'));await rm(join(dir,'artifact.docx'));
  const next=run(docx,{request:{...word,format:'docx'},base64:bytes.toString('base64')});assert.equal(next.status,0,next.stderr.toString());
  assert.equal(JSON.parse(next.stdout.toString()).details.paragraphs,2);
}));

async function serviceFixture(dir,transformer){
  const spy=await spyPython(dir),root=join(dir,'tmp'),settled=[],puts=[],state={deny:false};await mkdir(root);
  const store=await createLocalArtifactStore({root:join(dir,'store'),canonicalSha256:hash});
  const executor=createLocalArtifactExecutor({pythonExecutable:spy.script,nodeExecutable:process.execPath,pptxModulePath,tempRoot:root,timeoutMs:60000,officeTransformer:transformer});
  const service=createArtifactService({validators,executor,now:Date.now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),versions:store.versions,
    objects:{put:async(v,s)=>{puts.push(v.objectId);return store.objects.put(v,s);},get:store.objects.get},
    authorize:async i=>({receiptId:'authority',decision:state.deny?'deny':'allow',action:i.action,binding:i.binding,scopesSha256:hash(i.scopes),resourceSha256:hash(i.resource),requestSha256:i.requestSha256,expiresAtMs:i.deadlineMs}),
    budget:{reserve:async i=>({ticketId:'ticket',binding:i.binding,requestSha256:i.requestSha256,maxBytes:i.maxBytes,deadlineMs:i.deadlineMs}),settle:async({ticketId,requestSha256,bytes,outcome})=>{settled.push(outcome);return {ticketId,requestSha256,bytes,outcome,status:'settled'};}}});
  return {service,store,spy,root,settled,puts,state};
}
const context=()=>({binding:{tenantId:'tenant',actorId:'actor',conversationId:'10000000-0000-4000-8000-000000000001',runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},scopes:[{tenantId:'tenant',kind:'tenant',resourceId:'tenant',policyRevision:'1'}],evidence:[],assets:[],deadlineMs:Date.now()+60000,maxBytes:8388608});

// Service create -> download/inspect -> revise (full revised spec) -> download/inspect both -> stale parent -> no authority.
async function createReviseLineage(transformer,readText){ // readText(bytes,dir) -> extracted text, one line per row
  return owned(async dir=>{
    const f=await serviceFixture(dir,transformer);
    try{
      const c=context(),created=await f.service.create(word,c);assert.equal(created.version.mimeType,'application/pdf');assert.equal(created.version.parentVersionId,null);
      const parent=Buffer.from((await f.service.download(created.version.versionId,c)).bytes);isPdf(parent);assert.equal(sha(parent),created.version.object.sha256);
      assert.equal((await f.service.inspect(created.version.versionId,c)).inspection.currentBytesVerified,true);
      const revision=await f.service.revise(created.version.versionId,revised,c);
      assert.equal(revision.version.parentVersionId,created.version.versionId,'exact parent');assert.equal(revision.version.artifactId,created.version.artifactId);
      assert.notEqual(revision.version.versionId,created.version.versionId);assert.notEqual(revision.version.object.objectId,created.version.object.objectId);
      assert.equal(revision.version.mimeType,'application/pdf');assert.equal(revision.version.filename,created.version.filename);assert.equal(revision.inspection.format,'pdf');assert.equal(revision.execution.nativeQualified,false);
      const [, second]=await f.spy.inputs();assert.equal(second.base,null,'revision generator input carries no base');assert.equal(second.request.format,'docx');
      const child=Buffer.from((await f.service.download(revision.version.versionId,c)).bytes);isPdf(child);assert.equal(sha(child),revision.version.object.sha256);assert.notDeepEqual(child,parent);
      const inspected=await f.service.inspect(revision.version.versionId,c);assert.equal(inspected.inspection.currentBytesVerified,true);assert.equal(inspected.inspection.details.renderInspection,'pending');
      const record=await f.store.versions.read(revision.version.versionId);assert.deepEqual(record.spec,revised,'the retained spec is the complete revised spec');
      assert.deepEqual((await f.service.download(created.version.versionId,c)).bytes,parent,'parent bytes untouched');
      const [parentText,childText]=[await readText(parent,dir),await readText(child,dir)];
      for(const line of parentLines)assert.ok(parentText.includes(line),line);for(const line of revisedLines)assert.ok(childText.includes(line),line);
      assert.equal(parentText.includes('Revised'),false);assert.equal(childText.includes('Policy\n'),false);
      assert.deepEqual(f.settled,['completed','completed']);assert.equal(f.puts.length,2);assert.equal(await f.spy.launches(),2);
      // CAS: a second revision from the superseded parent is refused at commit; the head and both versions are unchanged.
      const stale=await f.service.revise(created.version.versionId,{...revised,title:'Stale'},c).then(()=>assert.fail('stale parent committed'),e=>e);
      assert.equal(stale.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(stale.cause.code,'ARTIFACT_STALE_PARENT');assert.equal(stale.versionCommitted,false);
      await assert.rejects(f.store.versions.read(stale.versionId),e=>e.code==='ENOENT');
      assert.deepEqual((await f.service.download(created.version.versionId,c)).bytes,parent);assert.deepEqual((await f.service.download(revision.version.versionId,c)).bytes,child);
      // Revision without authority: refused before any generator launch, object write or budget reservation.
      const launches=await f.spy.launches(),puts=f.puts.length,settled=f.settled.length;f.state.deny=true;
      await assert.rejects(f.service.revise(revision.version.versionId,revised,c),e=>e.code==='ARTIFACT_AUTHORITY');
      assert.equal(await f.spy.launches(),launches);assert.equal(f.puts.length,puts);assert.equal(f.settled.length,settled);
      assert.deepEqual(await readdir(f.root),[]);
    }finally{await f.store.dispose();}
  });
}
test('service create -> inspect/download -> revise -> stale parent and missing authority refused (synthetic converter)',()=>createReviseLineage(syntheticConverter(),async bytes=>pdfLines(bytes).join('\n')+'\n'));

// Local-only evidence: real LibreOffice conversion when an executable is explicitly supplied. Not native qualification.
test('real LibreOffice PDF create then full re-render revision (opt-in MERI_ARTIFACT_SOFFICE)',{skip:!process.env.MERI_ARTIFACT_SOFFICE&&'MERI_ARTIFACT_SOFFICE not set'},()=>owned(async dir=>{
  // Text extraction of the real converter output (pypdf from the document Python); local evidence only.
  const text=async(bytes,cwd)=>{const r=spawnSync(python,['-I','-c','import io,sys,pypdf;print("\\n".join(p.extract_text() for p in pypdf.PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages))'],{cwd,input:bytes});assert.equal(r.status,0,r.stderr.toString());return r.stdout.toString().split('\n').map(l=>l.trim()).join('\n')+'\n';};
  await createReviseLineage(createLibreOfficeTransformer({executable:process.env.MERI_ARTIFACT_SOFFICE,tempRoot:dir}),text);
}));
