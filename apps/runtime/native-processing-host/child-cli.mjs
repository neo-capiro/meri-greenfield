#!/usr/bin/env node
/** ONE fixed, image-pinned inspection child (UID1000). Launched only by the native host bootstrap.
 *
 * stdin: {settings, request, deadlineMs} where `settings` is the closed nonsecret host-owned document (fixed paths, image
 * digest, credential inventory by reference) and `request` is the EXISTING closed upload-inspection request. stdout: the
 * EXISTING closed upload-inspection body. No environment, argv, cwd or program choice is read here; qualifier, scanner and
 * extractor all run through `runUploadSandbox` inside the finite cgroup/no-egress network of the launcher.
 */
import {composeUploadNativeHost} from '../uploads/composition.mjs';
import {runUploadSandbox} from '../uploads/native-sandbox.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {uploadInspectionRequest,uploadInspectionBody,uploadInspectionFault,UPLOAD_INSPECTION_WIRE_BYTES,
 uploadInspectionResult} from '../uploads/agentcore-contract.mjs';

const fault=code=>{throw uploadInspectionFault(code);};

/** Strict child settings: pinned image, fixed paths, UID1000, nonempty credential inventory. No TLS or model data. */
export function childSettings(raw){
 const s=raw??{};
 if(s.runtimeUid!==1000||s.runtimeGid!==1000) fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 if(typeof s.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(s.imageDigest)) fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 for(const key of ['definitionsRoot','extractorPath','scratchRoot']) {
  if(typeof s[key]!=='string'||!s[key].startsWith('/')) fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 }
 if(!Array.isArray(s.credentialPaths)||s.credentialPaths.length===0||
  s.credentialPaths.some(p=>typeof p!=='string'||!p.startsWith('/'))) fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 return Object.freeze({paths:{definitionsRoot:s.definitionsRoot,extractorPath:s.extractorPath,scratchRoot:s.scratchRoot,
  credentialPaths:Object.freeze([...s.credentialPaths])},image:{digest:s.imageDigest}});
}

export async function inspectFixed({raw,deadlineMs,signal,settings,config,compose=composeUploadNativeHost,
 run=runUploadSandbox,inspectionFactory=createUploadInspection,now=Date.now}){
 const childConfig=config??childSettings(settings);
 const {request,bytes}=uploadInspectionRequest(raw);
 const until=Math.min(request.deadlineMs>0?request.deadlineMs:deadlineMs,deadlineMs);
 const host=await compose({configuration:{uploads:{native:{enabled:true,imageDigest:childConfig.image.digest,
   definitionsRoot:childConfig.paths.definitionsRoot,extractorPath:childConfig.paths.extractorPath}}},
  run,tempRoot:childConfig.paths.scratchRoot,deadlineMs:until,signal,now,
  credentialPaths:childConfig.paths.credentialPaths});
 if(host.scanner===null||host.extractor===null)fault('UPLOAD_INSPECTION_RESULT_REFUSED');
 const value=await inspectionFactory({scanner:host.scanner,extractor:host.extractor,now})
  .inspect(request.declaration,bytes,{deadlineMs:until,signal});
 const body=uploadInspectionBody({requestId:request.requestId,imageDigest:request.imageDigest,value});
 // The child validates its own output against the SAME closed result contract before writing anything.
 uploadInspectionResult(body,{requestId:request.requestId,declaration:request.declaration,imageDigest:request.imageDigest,
  fromMs:now()-1,toMs:now()+1});
 return Object.freeze({request,body});
}

const readStdin=async limit=>new Promise((resolve,reject)=>{
 let total=0;const chunks=[];
 process.stdin.on('data',chunk=>{total+=chunk.length;
  if(total>limit){reject(uploadInspectionFault('UPLOAD_INSPECTION_REQUEST_REFUSED'));process.stdin.destroy();return;}
  chunks.push(chunk);});
 process.stdin.on('end',()=>resolve(Buffer.concat(chunks)));
 process.stdin.on('error',reject);
 process.stdin.resume();
});

export async function childMain({stdinLimit=UPLOAD_INSPECTION_WIRE_BYTES+65536}={}){
 const started=Date.now();
 const raw=await readStdin(stdinLimit);
 let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
 const settings=childSettings(parsed.settings);
 const deadlineMs=Number.isSafeInteger(parsed.deadlineMs)?parsed.deadlineMs:started+30000;
 const out=await inspectFixed({raw:parsed.request,deadlineMs,settings,now:Date.now});
 const body=Buffer.from(JSON.stringify(out.body));
 if(body.length>16*1024*1024)fault('UPLOAD_INSPECTION_RESULT_REFUSED');
 process.stdout.write(body);
 return {requestId:out.request.requestId,bytes:body.length};
}

if(process.argv[1]&&process.argv[1].endsWith('child-cli.mjs')){
 childMain().then(()=>{},error=>{process.stderr.write(String(error?.code??'UPLOAD_INSPECTION_REQUEST_REFUSED'));
  process.exitCode=3;});
}
