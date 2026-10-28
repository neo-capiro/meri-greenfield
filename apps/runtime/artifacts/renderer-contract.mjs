/** Private fixed renderer transport. Control alone selects a one-use session; no run, SDK credential or command is admitted. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const RENDERER_SESSION_PREFIX='meri-renderer-',RENDERER_WIRE_BYTES=12*1024*1024,RENDERER_BYTES=8*1024*1024;
export const rendererFault=code=>Object.assign(Error(code),{code});
export const rendererSha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function rendererSessionId(requestId){if(typeof requestId!=='string'||!/^[a-f0-9]{64}$/u.test(requestId))throw rendererFault('RENDERER_REQUEST_REFUSED');return RENDERER_SESSION_PREFIX+requestId;}
export function rendererInput(raw){
 const c=data(own(raw,['kind','action','requestId','imageDigest','deadlineMs'],['bytesBase64','inputSha256','format','target','maxBytes']));
 rendererSessionId(c.requestId);
 if(c.kind!=='artifact-renderer'||!['qualify','transform'].includes(c.action)||!/^sha256:[a-f0-9]{64}$/u.test(c.imageDigest??'')||!Number.isSafeInteger(c.deadlineMs)||c.deadlineMs<0)throw rendererFault('RENDERER_REQUEST_REFUSED');
 if(c.action==='qualify'){if(Object.keys(c).length!==5)throw rendererFault('RENDERER_REQUEST_REFUSED');return c;}
 if(Object.keys(c).length!==10||!['docx','xlsx','pptx'].includes(c.format)||c.target!=='pdf'||!Number.isSafeInteger(c.maxBytes)||c.maxBytes<1||c.maxBytes>RENDERER_BYTES||
  typeof c.bytesBase64!=='string'||c.bytesBase64.length>Math.ceil(RENDERER_BYTES/3)*4||!/^[a-f0-9]{64}$/u.test(c.inputSha256??''))throw rendererFault('RENDERER_REQUEST_REFUSED');
 const bytes=Buffer.from(c.bytesBase64,'base64');if(bytes.length<1||bytes.length>RENDERER_BYTES||bytes.toString('base64')!==c.bytesBase64||rendererSha(bytes)!==c.inputSha256)throw rendererFault('RENDERER_REQUEST_REFUSED');return c;
}
