/** Narrow fixtures for the custody-mediated inspection crossing checks.
 *
 * Two things are deliberately REAL: the fixed inspection owner (`createUploadInspection`) that builds and validates
 * the receipts, and the purpose-locked AgentCore application that routes the session. The scanner/extractor ports
 * stand in for the upload sandbox and the signed-definition store, and the transport stands in for the AWS SDK, so
 * nothing here claims that any host, image, tool or definition snapshot is actually available. */
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createUploadInspection} from '../../../control/uploads/extraction.mjs';
import {UPLOAD_MIME,uploadHash} from '../../../control/uploads/policy.mjs';
import {createAgentCoreApplication} from '../../agentcore-http.mjs';
import {AGENTCORE_SESSION_HEADER} from '../../agentcore-contract.mjs';
import {createUploadInspectionApplication} from '../agentcore-http.mjs';

export const IMAGE_DIGEST='sha256:'+'d'.repeat(64);
export const BYTES=Buffer.from('wave5 custody-mediated native inspection fixture\n','utf8');
export const DECLARATION=Object.freeze({filename:'note.txt',mimeType:UPLOAD_MIME.txt,bytes:BYTES.length,sha256:uploadHash(BYTES)});
export const SEGMENT=Object.freeze({ordinal:0,text:'fixture text',method:'native',confidence:null,
 location:Object.freeze({page:null,slide:null,sheet:null,rowStart:null,rowEnd:null})});
/** The existing fixed owner over two narrow tool ports. `status` is the scanner's own verdict. */
export function nativeInspection({status='clean',now=Date.now}={}){
 const scanner={async scan({file}){
  return {sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:now(),status,
   tool:status==='unavailable'?null:{name:'clamav',version:'1.5.2',binarySha256:'a'.repeat(64)},
   definitionsSha256:status==='unavailable'?null:'b'.repeat(64),reason:status==='clean'?null:'UPLOAD_DEFINITIONS_UNAVAILABLE'};}};
 const extractor={async extract({file}){
  return {sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:now(),status:'available',
   tool:{name:'meri-upload-extractor',version:'3.13.16',binarySha256:'c'.repeat(64)},segments:[{...SEGMENT}],limitations:[]};}};
 return createUploadInspection({scanner,extractor,now});
}
/** A narrow transport that routes every invoke into the REAL purpose-locked application, exactly as the platform
 * would, and records the operations this purpose issued. */
export function crossing({inspection,imageDigest=IMAGE_DIGEST,stopFails=false,tamper=value=>value}={}){
 const calls=[],apps=new Map();
 const application=session=>{
  let app=apps.get(session);
  if(!app){
   app=createAgentCoreApplication({execute:()=>assert.fail('the inspection purpose must never reach SDK execution'),
    inspection:createUploadInspectionApplication({imageDigest,inspection})});
   apps.set(session,app);
  }
  return app;
 };
 const transport={
  async invoke(input){
   calls.push({operation:'invoke',input});
   const response=await application(input.runtimeSessionId).handle(new Request('http://runtime.invalid/invocations',
    {method:'POST',headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:input.runtimeSessionId},body:input.payload}));
   const value=tamper(await response.json());
   return {statusCode:response.status,$metadata:{httpStatusCode:200},runtimeSessionId:input.runtimeSessionId,
    contentType:'application/json',response:Readable.from([Buffer.from(JSON.stringify(value))])};
  },
  async stop(input){
   calls.push({operation:'stop',input});
   if(stopFails)throw Error('synthetic stop failure');
   return {statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:input.runtimeSessionId};
  },
 };
 return {transport,calls,apps};
}
