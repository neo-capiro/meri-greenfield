import {runArtifactProcess} from './process.mjs';
import {mkdtemp,readFile,lstat,rm} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=fileURLToPath(new URL('.',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const error=code=>Object.assign(new Error(code),{code});

export function createLocalArtifactExecutor({pythonExecutable,nodeExecutable,pptxModulePath,tempRoot,timeoutMs=30000}){
  if(![pythonExecutable,nodeExecutable,pptxModulePath,tempRoot].every(p=>typeof p==='string'&&isAbsolute(p))||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw error('ARTIFACT_CONFIGURATION');
  return Object.freeze({async execute({request,assets,deadlineMs,maxBytes,signal}){
    if(request.format==='pdf')throw error('ARTIFACT_RENDERER_UNAVAILABLE');
    const dir=await mkdtemp(join(tempRoot,'meri-artifact-'));let receipt;
    try{
      if(!['docx','txt','xlsx','pptx','zip'].includes(request.format))throw error('ARTIFACT_FORMAT');
      const input=Buffer.from(JSON.stringify({request,maxBytes,assets:assets.map(a=>({id:a.id,base64:a.bytes.toString('base64')}))}));if(input.length>16777216)throw error('ARTIFACT_INPUT_LIMIT');
      const presentation=request.format==='pptx';
      const run=await runArtifactProcess(presentation?nodeExecutable:pythonExecutable,presentation?['--max-old-space-size=256',join(here,'presentation.mjs'),pptxModulePath]:['-I','-B',join(here,'python/entry.py')],{cwd:dir,input,signal,deadlineMs:Math.min(deadlineMs,Date.now()+timeoutMs)});receipt=run.receipt;
      const output=join(dir,'artifact.'+request.format),stat=await lstat(output);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)throw error('ARTIFACT_OUTPUT_LIMIT');
      const bytes=await readFile(output),inspection=JSON.parse(run.stdout.toString('utf8'));
      if(inspection.sha256!==sha(bytes)||inspection.bytes!==bytes.length||inspection.format!==request.format||inspection.nativeOpened!==false||inspection.rendered!==false||inspection.recalculated!==false)throw error('ARTIFACT_INSPECTION_MISMATCH');
      if(signal?.aborted||Date.now()>=deadlineMs)throw error('ARTIFACT_CANCELLED');
      return {bytes,inspection,processReceipt:receipt};
    }catch(e){if(receipt&&!e.receipt)e.receipt=receipt;throw e;}
    finally{await rm(dir,{recursive:true,force:true});}
  }});
}
