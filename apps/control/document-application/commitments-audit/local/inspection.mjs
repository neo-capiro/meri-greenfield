/** Reopen/render every local synthetic DOCX page using the existing artifact processes. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runArtifactProcess} from '../../../../artifacts/process.mjs';
import {createLibreOfficeTransformer} from '../../../../artifacts/office-transform.mjs';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export async function inspectCommitmentsAuditCopy({bytes,label,pythonExecutable,sofficeExecutable,tempRoot,outputDirectory,deadlineMs}){
 assert(['original','revision'].includes(label));await mkdir(outputDirectory,{recursive:true});const processes=[];
 const retainedPath=join(outputDirectory,label+'.docx');
 try{await writeFile(retainedPath,bytes,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;assert.equal(sha(await readFile(retainedPath)),sha(bytes),'Retained DOCX bytes must match the exact download');}
 const opened=await runArtifactProcess(pythonExecutable,['-I','-B',fileURLToPath(new URL('../../local/inspect_docx.py',import.meta.url))],{cwd:tempRoot,input:bytes,deadlineMs});processes.push(opened.receipt);const content=JSON.parse(opened.stdout);assert.equal(content.sha256,sha(bytes));
 await writeFile(join(outputDirectory,label+'-content.json'),JSON.stringify(content,null,2)+'\n');
 const pdf=await createLibreOfficeTransformer({executable:sofficeExecutable,tempRoot}).transform({bytes,format:'docx',target:'pdf',deadlineMs,maxBytes:8388608});processes.push(pdf.receipt.process);await writeFile(join(outputDirectory,label+'-preview.pdf'),pdf.bytes);
 const pages=await mkdtemp(join(tempRoot,'meri-commitments-audit-pages-'));
 try{
  const rendered=await runArtifactProcess(pythonExecutable,['-I','-B',fileURLToPath(new URL('../test/tracking-evidence/inspect_tracking_pdf.py',import.meta.url))],{cwd:pages,input:pdf.bytes,deadlineMs});processes.push(rendered.receipt);const visual=JSON.parse(rendered.stdout);
  for(const page of visual.pages){assert.equal(page.png,`page-${page.page}.png`);const png=await readFile(join(pages,page.png));assert.equal(sha(png),page.sha256);await writeFile(join(outputDirectory,`${label}-preview-${page.page}.png`),png);}
  const receipt={sourceSha256:sha(bytes),content,visual,processes,localSyntheticOnly:true,nativeQualified:false};await writeFile(join(outputDirectory,label+'-inspection.json'),JSON.stringify(receipt,null,2)+'\n');
  const text=content.paragraphs.join('\n'),renderedText=visual.pages.map(page=>page.text).join('\n');
  for(const phrase of ['Commitments Audit','Commitment ledger','Suggestions and unresolved observations','Coverage and verification appendix','Bound-source-excerpt','Full body SHA256','tasks','client_knowledge_monday','Original skill and immutable revision provenance']){assert(text.includes(phrase),'DOCX '+phrase);assert(renderedText.includes(phrase),'PDF '+phrase);}
  assert(visual.pages.length>0);return receipt;
 }finally{await rm(pages,{recursive:true,force:true});}
}
