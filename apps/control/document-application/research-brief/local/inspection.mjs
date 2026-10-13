/** Reopen and render retained synthetic DOCX downloads. Rendered copies never replace versions. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runArtifactProcess} from '../../../../artifacts/process.mjs';
import {createLibreOfficeTransformer} from '../../../../artifacts/office-transform.mjs';
import {sha} from '../evidence.mjs';
export async function inspectBriefCopies({bytes,label,pythonExecutable,sofficeExecutable,tempRoot,outputDirectory,deadlineMs}){
  assert.ok(['original','revision'].includes(label));const sourceSha256=sha(bytes),processes=[];
  await writeFile(join(outputDirectory,label+'.docx'),bytes,{flag:'wx',mode:0o600});
  const opened=await runArtifactProcess(pythonExecutable,['-I','-B',fileURLToPath(new URL('../../local/inspect_docx.py',import.meta.url))],{cwd:tempRoot,input:bytes,deadlineMs});
  processes.push(opened.receipt);const content=JSON.parse(opened.stdout);assert.equal(content.sha256,sourceSha256);
  await writeFile(join(outputDirectory,label+'-content.json'),JSON.stringify(content,null,2)+'\n',{flag:'wx',mode:0o600});
  const transformed=await createLibreOfficeTransformer({executable:sofficeExecutable,tempRoot}).transform({bytes,format:'docx',target:'pdf',deadlineMs,maxBytes:8388608});
  processes.push(transformed.receipt.process);await writeFile(join(outputDirectory,label+'-preview.pdf'),transformed.bytes,{flag:'wx',mode:0o600});
  const directory=await mkdtemp(join(tempRoot,'meri-brief-pages-'));
  try{
    const rendered=await runArtifactProcess(pythonExecutable,['-I','-B',fileURLToPath(new URL('../../local/workbook/inspect_pdf.py',import.meta.url))],{cwd:directory,input:transformed.bytes,deadlineMs});
    processes.push(rendered.receipt);const visual=JSON.parse(rendered.stdout);assert.equal(visual.sha256,sha(transformed.bytes));
    for(const page of visual.pages){assert.equal(page.png,`page-${page.page}.png`);const png=await readFile(join(directory,page.png));assert.equal(sha(png),page.sha256);
      await writeFile(join(outputDirectory,`${label}-preview-${page.page}.png`),png,{flag:'wx',mode:0o600});}
    const result={sourceSha256,content,visual,transformReceipt:transformed.receipt,processes,localCopiesOnly:true,nativeQualified:false};
    // Preserve all actual bytes/pages before any content/layout assertion.
    await writeFile(join(outputDirectory,label+'-inspection.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    const docText=content.paragraphs.join('\n'),pdfText=visual.pages.map(p=>p.text).join('\n');
    for(const expected of ['Congress 119','Session 2','119-hr-4242','Bill version ih','FY 2027','Budget stage authorized','Facts and evidence','Proposed language','Coverage and verification appendix','unverified-claim','missing-evidence','program_elements: unavailable','Full text SHA256','Passage SHA256','Original skill and immutable revision provenance']){
      assert.ok(docText.includes(expected),'DOCX '+expected);assert.ok(pdfText.includes(expected),'PDF '+expected);
    }
    assert.equal(sha(bytes),sourceSha256);return result;
  }finally{await rm(directory,{recursive:true,force:true});}
}
