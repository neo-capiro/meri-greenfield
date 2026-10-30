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
/** Accept ONLY the raw flat host document; a normalized object is refused, so settings are normalized exactly once. */
export function childSettings(raw){
 const s=raw;
 const keys=s&&typeof s==='object'&&!Array.isArray(s)?Object.keys(s):null;
 const allowed=['runtimeUid','runtimeGid','imageDigest','definitionsRoot','extractorPath','scratchRoot','credentialPaths'];
 if(keys===null||keys.length!==allowed.length||keys.some(key=>!allowed.includes(key)))fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
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

/** Verify the exact host-pinned snapshot this child was given: same directory and sha256, nothing re-derived. */
export function pinnedDefinitions(snapshot){
 if(snapshot===null||typeof snapshot!=='object')fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 if(typeof snapshot.databaseDirectory!=='string'||!snapshot.databaseDirectory.startsWith('/')||
  typeof snapshot.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(snapshot.sha256))fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 return Object.freeze({async snapshot(){return Object.freeze({databaseDirectory:snapshot.databaseDirectory,
  sha256:snapshot.sha256,reader:{release:()=>true}});},async prune(){return Object.freeze({skipped:true});}});
}

export async function inspectFixed({raw,deadlineMs,signal,config,definitions,compose=composeUploadNativeHost,
 run=runUploadSandbox,inspectionFactory=createUploadInspection,now=Date.now}){
 if(config===undefined||config.paths===undefined||config.image===undefined)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 const childConfig=config;
 const started=now();
 const {request,bytes}=uploadInspectionRequest(raw);
 if(request.imageDigest!==childConfig.image.digest)fault('UPLOAD_INSPECTION_RESULT_REFUSED');
 const until=Math.min(request.deadlineMs>0?request.deadlineMs:deadlineMs,deadlineMs);
 const host=await compose({configuration:{uploads:{native:{enabled:true,imageDigest:childConfig.image.digest,
   definitionsRoot:childConfig.paths.definitionsRoot,extractorPath:childConfig.paths.extractorPath}}},
  run,tempRoot:childConfig.paths.scratchRoot,deadlineMs:until,signal,now,
  credentialPaths:childConfig.paths.credentialPaths,...(definitions===undefined?{}:{definitions})});
 if(host.scanner===null||host.extractor===null)fault('UPLOAD_INSPECTION_RESULT_REFUSED');
 const value=await inspectionFactory({scanner:host.scanner,extractor:host.extractor,now})
  .inspect(request.declaration,bytes,{deadlineMs:until,signal});
 const finished=now();
 const body=uploadInspectionBody({requestId:request.requestId,imageDigest:request.imageDigest,value});
 // The child validates its own output against the SAME closed result contract, using the REAL operation window.
 uploadInspectionResult(body,{requestId:request.requestId,declaration:request.declaration,imageDigest:request.imageDigest,
  fromMs:started,toMs:finished});
 return Object.freeze({request,body});
}

const readStdin=async(limit,stream)=>new Promise((resolve,reject)=>{
 let total=0;const chunks=[];
 stream.on('data',chunk=>{total+=chunk.length;
  if(total>limit){reject(uploadInspectionFault('UPLOAD_INSPECTION_REQUEST_REFUSED'));stream.destroy?.();return;}
  chunks.push(chunk);});
 stream.on('end',()=>resolve(Buffer.concat(chunks)));
 stream.on('error',reject);
 stream.resume();
});

export async function childMain({stdin,stdout,stdinLimit=UPLOAD_INSPECTION_WIRE_BYTES+65536,now=Date.now,
 inspect=inspectFixed,identity=()=>({uid:globalThis.process?.getuid?.(),gid:globalThis.process?.getgid?.()})}={}){
 const id=identity();
 if(id?.uid!==1000||id?.gid!==1000)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');   // the ACTUAL process identity, not a claim
 const started=now();
 const input=stdin??process.stdin,output=stdout??process.stdout;
 const raw=await readStdin(stdinLimit,input);
 let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{fault('UPLOAD_INSPECTION_REQUEST_REFUSED');}
 const top=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?Object.keys(parsed):[];
 if(top.length!==3||top.some(key=>!['settings','request','deadlineMs'].includes(key)))
  fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 const config=childSettings(parsed.settings);                     // normalized ONCE
 if(!Number.isSafeInteger(parsed.deadlineMs)||parsed.deadlineMs<=started)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
 const out=await inspect({raw:parsed.request,deadlineMs:parsed.deadlineMs,config,now});
 const body=Buffer.from(JSON.stringify(out.body));
 if(body.length>16*1024*1024)fault('UPLOAD_INSPECTION_RESULT_REFUSED');
 await new Promise((resolve,reject)=>output.write(body,error=>error?reject(error):resolve(true)));
 return {requestId:out.request.requestId,bytes:body.length};
}

if(process.argv[1]&&process.argv[1].endsWith('child-cli.mjs')){
 childMain().then(()=>{},error=>{process.stderr.write(String(error?.code??'UPLOAD_INSPECTION_REQUEST_REFUSED'));
  process.exitCode=3;});
}
