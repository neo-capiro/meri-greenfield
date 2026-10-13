/** Offline inspection of both already retained source-only downloads, every page. */
import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {renderCopy,sha} from '../../../control/document-application/selected-output/test/render.mjs';
import {python,soffice} from './fixture.mjs';
const directory=fileURLToPath(new URL('./evidence/retained-docx-final/',import.meta.url)),receipt=JSON.parse(await readFile(join(directory,'receipt.json'))),bytes=[];
for(const [index,label]of ['original','revision'].entries()){const data=await readFile(join(directory,label+'.docx'));if(sha(data)!==receipt.versions[index].object.sha256)throw Error('RETAINED_HASH');bytes.push(data);}
const rendered=[];for(const [index,label]of ['original','revision'].entries())rendered.push(await renderCopy({bytes:bytes[index],label,outputDirectory:directory,tempRoot:'/tmp',pythonExecutable:python,sofficeExecutable:soffice}));
await writeFile(join(directory,'render-receipt.json'),JSON.stringify({mode:'OFFLINE_SOURCE_ONLY',nativeQualified:false,sourceSha256:bytes.map(sha),pages:rendered.map(r=>r.visual.pages.length),allPagesRetained:true,processes:rendered.flatMap(r=>r.processes)},null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({pages:rendered.map(r=>r.visual.pages.length),allPagesRetained:true,nativeQualified:false})+'\n');
