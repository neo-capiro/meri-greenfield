import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderCopy,sha} from '../../../../../apps/control/document-application/selected-output/test/render.mjs';
const here=fileURLToPath(new URL('./',import.meta.url)),rows=[];
for(const cohort of ['retained-docx','retained-docx-final'])for(const label of ['original','revision']){
 const dir=join(here,cohort),bytes=await readFile(join(dir,label+'.docx'));
 const receipt=await renderCopy({bytes,label,outputDirectory:dir,tempRoot:'/tmp',pythonExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',sofficeExecutable:'/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice'});
 rows.push({cohort,label,sha256:sha(bytes),pages:receipt.visual.pages.length,processes:receipt.processes});
}
await writeFile(join(here,'render-receipt.json'),JSON.stringify({source:'b7b47c2b73dab98c2ec7074b2153a14d6a1e618e',rows,nativeQualified:false},null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({docx:rows.length,pages:rows.reduce((a,r)=>a+r.pages,0),nativeQualified:false})+'\n');
