#!/usr/bin/env node
/** ONE fixed, image-pinned inspection child (UID1000). Executable entrypoint launched only by the native host bootstrap.
 *
 * stdin: one bounded JSON document `{request, bytesBase64}` where `request` is the EXISTING closed upload-inspection
 * request. stdout: the EXISTING closed upload-inspection body. No command, argv, cwd, environment, program, plugin or
 * model/provider value is accepted: the program and its arguments are the bootstrap's, and the image paths are the pinned
 * constants of the upload owner. Qualifier, scanner and extractor run through `runUploadSandbox` and inherit the finite
 * cgroup and closed network of the launcher that started this process — this child never creates a placement or calls a
 * root launcher.
 */
import {composeUploadNativeHost} from '../uploads/composition.mjs';
import {runUploadSandbox} from '../uploads/native-sandbox.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {uploadInspectionRequest,uploadInspectionBody,uploadInspectionFault,UPLOAD_INSPECTION_WIRE_BYTES,
 uploadInspectionSha} from '../uploads/agentcore-contract.mjs';

const readStdin=async limit=>new Promise((resolve,reject)=>{
 let total=0;const chunks=[];
 process.stdin.on('data',chunk=>{total+=chunk.length;
  if(total>limit){reject(uploadInspectionFault('UPLOAD_INSPECTION_REQUEST_REFUSED'));process.stdin.destroy();return;}
  chunks.push(chunk);});
 process.stdin.on('end',()=>resolve(Buffer.concat(chunks)));
 process.stdin.on('error',reject);
 process.stdin.resume();
});

/** Pure-ish child operation: validate the closed request, compose the EXISTING host, then `inspect`. */
export async function inspectFixed({raw,deadlineMs,signal,config,compose=composeUploadNativeHost,run=runUploadSandbox,
 inspectionFactory=createUploadInspection,now=Date.now}){
 const {request,bytes}=uploadInspectionRequest(raw);
 const until=Number.isSafeInteger(request.deadlineMs)&&request.deadlineMs>0?Math.min(request.deadlineMs,deadlineMs):deadlineMs;
 const host=await compose({configuration:{uploads:{native:{enabled:true,imageDigest:request.imageDigest,
   definitionsRoot:config.paths.definitionsRoot,extractorPath:config.paths.extractorPath}}},
  run,tempRoot:config.paths.scratchRoot,deadlineMs:until,signal,now,credentialPaths:config.paths.credentialPaths});
 if(host.scanner===null||host.extractor===null)throw uploadInspectionFault('UPLOAD_INSPECTION_RESULT_REFUSED');
 const value=await inspectionFactory({scanner:host.scanner,extractor:host.extractor,now})
  .inspect(request.declaration,bytes,{deadlineMs:until,signal});
 return Object.freeze({request,body:uploadInspectionBody({requestId:request.requestId,imageDigest:request.imageDigest,value})});
}

export async function childMain({config,stdinLimit=UPLOAD_INSPECTION_WIRE_BYTES}={}){
 const started=Date.now();
 const raw=await readStdin(stdinLimit);
 let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{throw uploadInspectionFault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
 const out=await inspectFixed({raw:parsed.request,deadlineMs:parsed.deadlineMs??started+30000,config,now:Date.now});
 const body=Buffer.from(JSON.stringify(out.body));
 if(body.length>16*1024*1024)throw uploadInspectionFault('UPLOAD_INSPECTION_RESULT_REFUSED');
 process.stdout.write(body);
 return {requestId:out.request.requestId,sha256:uploadInspectionSha(body),bytes:body.length};
}

if(process.argv[1]&&process.argv[1].endsWith('child-cli.mjs')){
 const {nativeProcessingConfig}=await import('./config.mjs');
 try{await childMain({config:nativeProcessingConfig({env:process.env})});}
 catch(error){process.stderr.write(String(error?.code??'UPLOAD_INSPECTION_REQUEST_REFUSED'));process.exitCode=3;}
}
