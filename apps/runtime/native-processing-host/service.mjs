/** One private authenticated fixed upload-inspection operation on the native processing host.
 *
 * `POST /internal/upload-inspection` over pinned TLS1.3 with an exact Control peer SAN and certificate fingerprint. The body
 * is a CLOSED request: requestId, the declared image digest and the original bytes (+ optional allowlisted format). It can
 * never carry a command, argv, cwd, environment, program, plugin or model/provider selection. Root bootstrap owns
 * privilege; the inspection child runs as the configured UID1000 under the finite placement.
 *
 * The canonical allocation/currentness envelope is Parent-owned and is NOT invented here: `authorize` is the exact
 * injected owner API `authorize({requestId,imageDigest,declarationId,deadlineMs,signal}) -> {authorized:true,...}` that
 * Parent will supply. Until it is bound, this service refuses every request.
 */
import {createHash} from 'node:crypto';

export const NATIVE_INSPECTION_PATH='/internal/upload-inspection';
export const NATIVE_INSPECTION_SCHEMA='meri-native-upload-inspection/1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST=/^sha256:[a-f0-9]{64}$/u;
const HEX64=/^[0-9a-f]{64}$/u;
const FORMATS=Object.freeze(['txt','md','pdf','docx','xlsx','pptx','png','jpg','jpeg']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

/** Validate the closed request. Unknown keys are refused, not ignored. */
export function inspectionRequest(raw,{deadlineMaxMs,bodyBytes,now=Date.now}={}){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail('NATIVE_INSPECTION_REQUEST');
 const keys=Object.keys(raw);
 if(keys.some(key=>!['schema','requestId','imageDigest','declarationId','format','bytesB64','deadlineMs'].includes(key)))
  fail('NATIVE_INSPECTION_REQUEST');
 if(raw.schema!==NATIVE_INSPECTION_SCHEMA||!UUID.test(raw.requestId??'')||!DIGEST.test(raw.imageDigest??'')||
  !HEX64.test(raw.declarationId??''))fail('NATIVE_INSPECTION_REQUEST');
 if(raw.format!==undefined&&!FORMATS.includes(raw.format))fail('NATIVE_INSPECTION_REQUEST');
 if(typeof raw.bytesB64!=='string'||raw.bytesB64.length%4!==0||raw.bytesB64.length>Math.ceil(bodyBytes/3)*4)
  fail('NATIVE_INSPECTION_REQUEST');
 const bytes=Buffer.from(raw.bytesB64,'base64');
 if(bytes.length<1||bytes.toString('base64')!==raw.bytesB64)fail('NATIVE_INSPECTION_REQUEST');
 if(!Number.isSafeInteger(raw.deadlineMs)||raw.deadlineMs<=now()||raw.deadlineMs>now()+deadlineMaxMs)
  fail('NATIVE_INSPECTION_DEADLINE');
 const file=Object.freeze({sha256:sha(bytes),bytes:bytes.length,...(raw.format===undefined?{}:{format:raw.format})});
 return Object.freeze({requestId:raw.requestId,imageDigest:raw.imageDigest,declarationId:raw.declarationId,
  deadlineMs:raw.deadlineMs,bytes,file});
}

/** Build the HTTP handler. `authenticate` is the TLS peer check (SAN + exact certificate fingerprint);
 *  `runInspection` is the fixed operation above. Both are production implementations in entrypoint.mjs. */
export function createInspectionHandler({authenticate,runInspection,readBody,limits,now=Date.now}={}){
 if(typeof authenticate!=='function'||typeof runInspection!=='function'||typeof readBody!=='function'||
  !limits||!Number.isSafeInteger(limits.deadlineMaxMs)||!Number.isSafeInteger(limits.bodyBytes))
  fail('NATIVE_INSPECTION_CONFIGURATION');
 return async function handle(req,res){
  try{
   if(req?.method!=='POST'||req?.url!==NATIVE_INSPECTION_PATH)fail('NATIVE_INSPECTION_ROUTE');
   if(req?.socket?.encrypted!==true||req.socket.alpnProtocol!=='h2'&&req.httpVersionMajor<2){
    if(req?.socket?.encrypted!==true)fail('NATIVE_INSPECTION_TLS');
   }
   const peer=await authenticate({socket:req.socket,headers:req.headers});
   if(peer?.verified!==true)fail('NATIVE_INSPECTION_PEER');
   const raw=await readBody(req,limits.bodyBytes);
   let parsed;try{parsed=JSON.parse(raw.toString('utf8'));}catch{fail('NATIVE_INSPECTION_REQUEST');}
   const request=inspectionRequest(parsed,{deadlineMaxMs:limits.deadlineMaxMs,bodyBytes:limits.bodyBytes,now});
   const out=await runInspection({request,peer,deadlineMs:request.deadlineMs});
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
   res.end(JSON.stringify(out));
  }catch(error){
   const code=typeof error?.code==='string'?error.code:'NATIVE_INSPECTION_UNKNOWN';
   const status=code==='NATIVE_INSPECTION_ROUTE'?404:code==='NATIVE_INSPECTION_TLS'||code==='NATIVE_INSPECTION_PEER'?403:400;
   try{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:code}));}catch{}
  }
 };
}
