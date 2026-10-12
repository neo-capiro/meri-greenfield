import {mkdtemp,mkdir,writeFile,readFile,lstat,rm} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {runArtifactProcess} from './process.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
// Source adapter only; caller must admit exact CLI/image/sandbox independently.
export function officeTransformArguments({workspace,format,target}){
  if(!isAbsolute(workspace)||!((format==='docx'&&target==='pdf')||(format==='xlsx'&&target==='xlsx')))fail('ARTIFACT_TRANSFORM_UNSUPPORTED');
  return ['-env:UserInstallation='+pathToFileURL(join(workspace,'profile')).href,'--headless','--nologo','--nodefault','--norestore','--convert-to',target,'--outdir',join(workspace,'out'),join(workspace,'input.'+format)];
}
export function createLibreOfficeTransformer({executable,tempRoot}){
  if(typeof executable!=='string'||!isAbsolute(executable)||!isAbsolute(tempRoot))fail('ARTIFACT_RENDERER_UNAVAILABLE');
  return Object.freeze({async transform({bytes,format,target,deadlineMs,maxBytes,signal}){
    if(!Buffer.isBuffer(bytes)||bytes.length>8388608)fail('ARTIFACT_INPUT_LIMIT');
    const workspace=await mkdtemp(join(tempRoot,'meri-office-'));
    try{
      const args=officeTransformArguments({workspace,format,target});await mkdir(join(workspace,'out'),{mode:0o700});await writeFile(join(workspace,'input.'+format),bytes,{flag:'wx',mode:0o600});
      const run=await runArtifactProcess(executable,args,{cwd:workspace,input:Buffer.alloc(0),signal,deadlineMs});
      const output=join(workspace,'out','input.'+target),stat=await lstat(output);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>maxBytes)fail('ARTIFACT_OUTPUT_LIMIT');
      const result=await readFile(output);if(target==='pdf'&&!result.subarray(0,5).equals(Buffer.from('%PDF-')))fail('ARTIFACT_FORMAT');
      if(target==='xlsx'&&!result.subarray(0,2).equals(Buffer.from('PK')))fail('ARTIFACT_FORMAT');
      return {bytes:result,receipt:{inputSha256:createHash('sha256').update(bytes).digest('hex'),outputSha256:createHash('sha256').update(result).digest('hex'),format,target,process:run.receipt,nativeQualification:false,renderInspection:'pending',formulaEquivalence:'unqualified'}};
    }finally{await rm(workspace,{recursive:true,force:true});}
  }});
}
