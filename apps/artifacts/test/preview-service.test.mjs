/** Preview publication and serving through the artifact owner. Default: real generators, real local immutable store, the
 * SYNTHETIC office converter behind a synthetic renderer admission. Opt-in: real LibreOffice (MERI_ARTIFACT_SOFFICE), with
 * the preview text read back by pypdf. Local evidence only; previews stay nativeQualified=false. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {artifactHarness,specs,context,validators as v,hash,python} from './artifact-harness.mjs';
import {realPdf,sha,syntheticConverter,syntheticOfficeConverter,syntheticAdmission} from './pdf-fixtures.mjs';
import {createRendererPort,createLibreOfficeRendererPort} from '../renderer.mjs';
import {createArtifactPreviewService} from '../preview/service.mjs';
import {createLocalPreviewStore} from '../preview/local-store.mjs';
import {PREVIEW_RECORD_VERSION} from '../preview/record.mjs';
import {structureCheck} from '../structure/file-structure.mjs';
import {runArtifactProcess} from '../process.mjs';
const soffice=process.env.MERI_ARTIFACT_SOFFICE;

async function setup(t,{renderer='synthetic',maxPreviewBytes}={}){
 const h=await artifactHarness(t,{converter:syntheticConverter()}),office=syntheticOfficeConverter();
 const port=renderer==='synthetic'?createRendererPort({admission:syntheticAdmission(),transformer:office}):renderer==='real'?createLibreOfficeRendererPort({admission:syntheticAdmission({executable:soffice}),executable:soffice,tempRoot:h.root}):renderer;
 const previews=await createLocalPreviewStore({root:join(h.root,'previews'),canonicalSha256:hash});
 const counted={read:(...a)=>previews.read(...a),claim:(...a)=>previews.claim(...a),recordObject:(...a)=>previews.recordObject(...a),commits:0,async commit(...a){counted.commits++;return previews.commit(...a);}};
 const service=createArtifactPreviewService({validators:v,artifacts:h.service,objects:h.objects,previews:counted,renderer:port,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),now:Date.now,...(maxPreviewBytes?{maxPreviewBytes}:{})});
 const ctx=context(),create=async format=>(await h.service.create(specs[format],ctx)).version;
 return {...h,office,port,previews,counted,service,ctx,create};
}
const pdf=bytes=>{assert.equal(bytes.subarray(0,5).toString('latin1'),'%PDF-');assert.deepEqual(structureCheck(bytes,'pdf'),{valid:true});return bytes;};

for(const format of ['docx','xlsx','pptx','pdf'])test(`${format}: publish renders one bounded PDF preview bound to the exact version; read serves it; republish is idempotent`,async t=>{
 const a=await setup(t),version=await a.create(format),puts=a.state.puts;
 const published=await a.service.publish(version.versionId,a.ctx);assert.equal(published.status,'published');const r=published.preview;
 assert.equal(r.recordVersion,PREVIEW_RECORD_VERSION);assert.equal(r.versionId,version.versionId);assert.equal(r.artifactId,version.artifactId);assert.equal(r.status,'published');assert.equal(r.nativeQualified,false);
 assert.deepEqual(r.source,{sha256:version.object.sha256,bytes:version.object.bytes,mimeType:version.mimeType});assert.equal(r.preview.mimeType,'application/pdf');assert.equal(r.preview.pages,1);
 assert.deepEqual(r.preview.object.scopes,version.scopes);assert.equal(a.state.puts,puts+1);assert.equal(a.counted.commits,1);
 if(format==='pdf'){assert.equal(r.conversion.method,'source-pdf');assert.equal(r.preview.object.sha256,version.object.sha256);assert.equal(a.office.calls.length,0);assert.equal(r.conversion.qualificationId,null);}
 else{assert.equal(r.conversion.method,'office-pdf');assert.deepEqual(a.office.calls.map(c=>[c.format,c.inputSha256,c.valid]),[[format,version.object.sha256,true]]);
  assert.equal(r.conversion.qualificationId,'synthetic-test-admission');assert.equal(r.conversion.imageDigest,'sha256:'+'0'.repeat(64));}
 const served=await a.service.read(version.versionId,a.ctx);pdf(served.bytes);assert.equal(sha(served.bytes),r.preview.object.sha256);assert.deepEqual(served.preview,r);assert.deepEqual(served.version,version);
 const again=await a.service.publish(version.versionId,a.ctx);assert.equal(again.status,'existing');assert.deepEqual(again.preview,r);
 assert.equal(a.state.puts,puts+1);assert.equal(a.counted.commits,1);assert.equal(a.office.calls.length,format==='pdf'?0:1);
 assert.deepEqual((await readdir(a.root)).sort(),['previews','store']);
});
test('a version without a preview reads PENDING; unsupported formats are refused before any write',async t=>{
 const a=await setup(t),docx=await a.create('docx'),txt=await a.create('txt'),puts=a.state.puts;
 await assert.rejects(a.service.read(docx.versionId,a.ctx),{code:'ARTIFACT_PREVIEW_PENDING'});
 await assert.rejects(a.service.publish(txt.versionId,a.ctx),{code:'ARTIFACT_PREVIEW_UNSUPPORTED'});await assert.rejects(a.service.read(txt.versionId,a.ctx),{code:'ARTIFACT_PREVIEW_UNSUPPORTED'});
 assert.equal(a.state.puts,puts);assert.equal(a.counted.commits,0);
});
test('without an admitted renderer office previews fail closed; a PDF version still previews as itself',async t=>{
 for(const renderer of [null,createRendererPort({admission:undefined,transformer:syntheticOfficeConverter()})]){
  const a=await setup(t,{renderer}),docx=await a.create('docx'),puts=a.state.puts;
  await assert.rejects(a.service.publish(docx.versionId,a.ctx),{code:'ARTIFACT_RENDERER_UNAVAILABLE'});assert.equal(a.state.puts,puts);
  const printable=await a.create('pdf');assert.equal((await a.service.publish(printable.versionId,a.ctx)).preview.conversion.method,'source-pdf');
 }
 const h=await artifactHarness(t);
 assert.throws(()=>createArtifactPreviewService({validators:v,artifacts:h.service,objects:h.objects,previews:{read(){},commit(){}},renderer:syntheticOfficeConverter(),ids:()=>({}),now:Date.now}),{code:'ARTIFACT_CONFIGURATION'});
});
test('previews are bounded: an oversize preview is refused before any write',async t=>{
 const a=await setup(t,{maxPreviewBytes:64}),docx=await a.create('docx'),puts=a.state.puts;
 await assert.rejects(a.service.publish(docx.versionId,a.ctx),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code==='ARTIFACT_PREVIEW_LIMIT');assert.equal(a.state.puts,puts);assert.equal(a.counted.commits,0);
});
test('converter output must be a structurally valid PDF with a matching receipt',async t=>{
 const outputs=[{bytes:Buffer.from('%PDF-1.4 not really'),fix:r=>r},{bytes:realPdf(['x']),fix:r=>({...r,inputSha256:'0'.repeat(64)})},{bytes:realPdf(['x']),fix:r=>({...r,nativeQualification:true})}];
 for(const [i,output] of outputs.entries()){
  const transformer={async transform({bytes}){return {bytes:output.bytes,receipt:output.fix({inputSha256:sha(bytes),outputSha256:sha(output.bytes),nativeQualification:false})};}};
  const a=await setup(t,{renderer:createRendererPort({admission:syntheticAdmission(),transformer})}),docx=await a.create('docx'),puts=a.state.puts;
  await assert.rejects(a.service.publish(docx.versionId,a.ctx),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.code===(i===0?'ARTIFACT_PREVIEW_STRUCTURE':'ARTIFACT_TRANSFORM_MISMATCH'));assert.equal(a.state.puts,puts);
 }
});
test('suppression, a recovery barrier and revoked authority refuse publish and read; a suppression during serving releases nothing',async t=>{
 const a=await setup(t),version=await a.create('docx');await a.service.publish(version.versionId,a.ctx);
 const reset=()=>{a.state.suppressed.clear();a.state.barrier=false;a.state.deny=false;};
 for(const [arm,code] of [[v=>a.state.suppressed.add(v.artifactId),'RETENTION_SUPPRESSED'],[()=>{a.state.barrier=true;},'RETENTION_RECOVERY_BARRIER'],[()=>{a.state.deny=true;},'ARTIFACT_AUTHORITY']]){
  arm(version);await assert.rejects(a.service.read(version.versionId,a.ctx),{code});reset();
  const other=await a.create('xlsx'),before=a.state.puts;arm(other);await assert.rejects(a.service.publish(other.versionId,a.ctx),{code});assert.equal(a.state.puts,before);reset();
 }
 assert.equal(a.counted.commits,1);
 // The suppression commits while the preview bytes are being read: the post-read authorized read refuses release.
 const get=a.objects.get;a.objects.get=async(object,signal)=>{const bytes=await get(object,signal);if(object.sha256!==version.object.sha256)a.state.suppressed.add(version.artifactId);return bytes;};
 await assert.rejects(a.service.read(version.versionId,a.ctx),{code:'RETENTION_SUPPRESSED'});a.objects.get=get;reset();
 assert.equal((await a.service.read(version.versionId,a.ctx)).preview.versionId,version.versionId);
});
test('a failure after the preview object write is UNKNOWN, never no-effect; a tampered record is refused',async t=>{
 const a=await setup(t),version=await a.create('docx'),commit=a.counted.commit;
 a.counted.commit=async()=>{throw Object.assign(Error('ARTIFACT_PREVIEW_CONFLICT'),{code:'ARTIFACT_PREVIEW_CONFLICT'});};
 const failure=await a.service.publish(version.versionId,a.ctx).then(()=>assert.fail('committed'),e=>e);
 assert.equal(failure.code,'ARTIFACT_EFFECT_UNKNOWN');assert.equal(failure.previewCommitted,false);assert.match(failure.objectId,/^[0-9a-f-]{36}$/);assert.equal(failure.cause.code,'ARTIFACT_PREVIEW_CONFLICT');
 await assert.rejects(a.service.read(version.versionId,a.ctx),{code:'ARTIFACT_PREVIEW_PENDING'});a.counted.commit=commit;
 await assert.rejects(a.service.publish(version.versionId,a.ctx),{code:'ARTIFACT_EFFECT_UNKNOWN'});const fresh=await a.create('docx');
 const published=(await a.service.publish(fresh.versionId,a.ctx)).preview,read=a.counted.read;
 for(const tamper of [r=>{r.source.sha256='0'.repeat(64);},r=>{r.versionId=randomUUID();},r=>{r.nativeQualified=true;},r=>{r.conversion.outputSha256='0'.repeat(64);},r=>{r.extra=1;}]){
  a.counted.read=async()=>{const r=structuredClone(published);tamper(r);return r;};await assert.rejects(a.service.read(fresh.versionId,a.ctx),{code:'ARTIFACT_PREVIEW_CORRUPT'});
 }
 a.counted.read=read;assert.deepEqual((await a.service.read(fresh.versionId,a.ctx)).preview,published);
});
test('real LibreOffice previews for DOCX, XLSX (recalculated) and PPTX (opt-in MERI_ARTIFACT_SOFFICE)',{skip:!soffice&&'MERI_ARTIFACT_SOFFICE not set'},async t=>{
 const a=await setup(t,{renderer:'real'}),texts={};
 for(const format of ['docx','xlsx','pptx']){
  const version=await a.create(format),published=(await a.service.publish(version.versionId,a.ctx)).preview,served=await a.service.read(version.versionId,a.ctx);
  assert.equal(published.conversion.method,'office-pdf');assert.ok(published.preview.pages>=1);pdf(served.bytes);
  const scratch=await mkdtemp(join(tmpdir(),'meri-preview-text-'));t.after(()=>rm(scratch,{recursive:true,force:true}));
  const read=await runArtifactProcess(python,['-I','-B','-c','import io,sys,pypdf;print("\\n".join(p.extract_text() for p in pypdf.PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages))'],{cwd:scratch,input:served.bytes,deadlineMs:Date.now()+20000});
  texts[format]=read.stdout.toString('utf8');
 }
 assert.match(texts.docx,/Policy brief/);assert.match(texts.pptx,/Summary/);
 // The generated workbook's SUM cache is a placeholder; the preview loads with the recalculation profile, so the total shows 5.
 assert.match(texts.xlsx,/Total\s*5/);
});
