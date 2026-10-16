/** Test-only PDF helpers. `syntheticConverter` is a SYNTHETIC converter port (not LibreOffice): it accepts only a
 * structurally valid DOCX, reads the paragraph and cell text of word/document.xml, and returns a structurally complete
 * PDF 1.4 file carrying that text, so a test can see which typed spec reached the converter. No native rendering. */
import {createHash} from 'node:crypto';
import {readZip,structureCheck} from '../structure/file-structure.mjs';

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pdfString=text=>'('+text.replace(/[^\x20-\x7e]/gu,'?').replace(/[\\()]/gu,m=>'\\'+m)+')';

/** A complete one-page PDF with byte-exact xref offsets; one text line per entry of `lines`. */
export function realPdf(lines){
  const content=['BT /F1 12 Tf 72 720 Td 14 TL',...[].concat(lines).map(line=>pdfString(line)+" '"),'ET'].join('\n');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',`<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let body='%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';const offsets=[];
  for(const [i,o] of objects.entries()){offsets.push(Buffer.byteLength(body,'latin1'));body+=`${i+1} 0 obj\n${o}\nendobj\n`;}
  const xref=Buffer.byteLength(body,'latin1');
  body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body,'latin1');
}

/** Text runs (`w:t`) of a DOCX main document part, in document order. */
export function docxTexts(bytes){
  const xml=readZip(bytes).get('word/document.xml');if(!xml)throw new Error('DOCX main part missing');
  return [...xml.toString('utf8').matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gu)].map(m=>m[1]);
}

/** Text lines shown by a PDF produced by `realPdf`. */
export const pdfLines=bytes=>[...bytes.toString('latin1').matchAll(/\(((?:\\.|[^\\)])*)\) '/gu)].map(m=>m[1].replace(/\\(.)/gu,'$1'));

export function syntheticConverter(){
  const calls=[];
  return {calls,synthetic:true,async transform({bytes,format,target}){
    const check=structureCheck(bytes,format),texts=check.valid?docxTexts(bytes):[];
    calls.push({format,target,inputSha256:sha(bytes),valid:check.valid,texts});
    if(format!=='docx'||target!=='pdf'||!check.valid)throw Object.assign(new Error('SYNTHETIC_CONVERTER_INPUT'),{code:'ARTIFACT_PROCESS_FAILED'});
    const out=realPdf(texts);
    return {bytes:out,receipt:{inputSha256:sha(bytes),outputSha256:sha(out),format,target,nativeQualification:false,renderInspection:'pending',formulaEquivalence:'unqualified'}};
  }};
}

/** SYNTHETIC preview converter port (not LibreOffice): accepts a structurally valid DOCX, XLSX or PPTX and returns a
 * one-page PDF naming the format and the input digest, so a test can see exactly which bytes were converted. */
export function syntheticOfficeConverter(){
  const calls=[];
  return {calls,synthetic:true,async transform({bytes,format,target}){
    const check=structureCheck(bytes,format);calls.push({format,target,inputSha256:sha(bytes),valid:check.valid});
    if(!['docx','xlsx','pptx'].includes(format)||target!=='pdf'||!check.valid)throw Object.assign(new Error('SYNTHETIC_CONVERTER_INPUT'),{code:'ARTIFACT_PROCESS_FAILED'});
    const out=realPdf([`synthetic ${format} preview`,sha(bytes)]);
    return {bytes:out,receipt:{inputSha256:sha(bytes),outputSha256:sha(out),format,target,nativeQualification:false,renderInspection:'pending',formulaEquivalence:'unqualified'}};
  }};
}

/** A complete synthetic renderer admission record for tests (never a qualification). */
export const syntheticAdmission=(overrides={})=>({rendererId:'libreoffice',rendererVersion:'24.2.7.2',executable:'/usr/bin/soffice',imageDigest:'sha256:'+'0'.repeat(64),qualificationId:'synthetic-test-admission',
  sandbox:{nonRootUser:true,noNetwork:true,readOnlyRootFilesystem:true,noNewPrivileges:true,dropAllCapabilities:true,privateWorkspace:true,boundedResources:true,noCredentials:true},...overrides});
