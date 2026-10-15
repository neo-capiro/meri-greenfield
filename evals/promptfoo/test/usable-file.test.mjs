import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadCases} from '../cases/schema.mjs';
import {gradeUsableFile} from '../graders/usable-file.mjs';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {REVIEW_PROBES} from '../../../apps/artifacts/structure/test/review-probes.mjs';
import {ooxml,pdf,pdfXrefStream,zip} from '../../../apps/artifacts/structure/test/fixtures.mjs';
const base=loadCases().find(c=>c.caseId==='DL-01');
const caseFor=format=>({...base,outputFormat:{...base.outputFormat,fileFormat:format,requiredText:[],maxBytes:1048576}});
const fileOf=(bytes,format)=>({versionId:'v',filename:`synthetic.${format}`,mimeType:ARTIFACT_MIME_TYPES[format],bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')});
test('usable-file refuses every malformed probe from dot corrected review H1/H2 with the validator reason',()=>{
 for(const probe of REVIEW_PROBES){
  const r=gradeUsableFile({files:[fileOf(probe.bytes(),probe.format)]},caseFor(probe.format));
  assert.equal(r.pass,false,probe.id);assert.equal(r.score,0,probe.id);assert.equal(r.reason,`file 0: DOES_NOT_OPEN ${probe.reason}`,probe.id);
 }
});
test('usable-file still passes structurally valid files of each binary format, without a native usability claim',()=>{
 for(const [format,bytes] of [['docx',ooxml('docx')],['xlsx',ooxml('xlsx')],['pptx',ooxml('pptx')],['pdf',pdf()],['pdf',pdfXrefStream({catalogInObjectStream:true})],['zip',zip({'a.txt':'x'})]]){
  const r=gradeUsableFile({files:[fileOf(bytes,format)]},caseFor(format));
  assert.equal(r.pass,true,format);assert.match(r.reason,/structurally valid .* file\(s\); native open UNRUN/u);
 }
});
