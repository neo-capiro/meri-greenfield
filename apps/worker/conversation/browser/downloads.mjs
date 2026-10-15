/** Downloaded files leave the browser output directory only through the artifact owner, after source, type, content and size checks. */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,realpath,unlink} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {ARTIFACT_MIME_TYPES} from '../../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {urlHost} from './receipts.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const SIGNATURES=Object.freeze({docx:'504b0304',xlsx:'504b0304',pptx:'504b0304',zip:'504b0304',pdf:'255044462d'});
const NAME=/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/u;
function contentMatches(bytes,format){
 if(format==='txt'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);return true;}catch{return false;}}
 return bytes.subarray(0,SIGNATURES[format].length/2).toString('hex')===SIGNATURES[format];
}
async function readBounded(path,maxBytes){
 const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const buffer=Buffer.alloc(maxBytes+1),{bytesRead}=await handle.read(buffer,0,maxBytes+1,0);if(bytesRead>maxBytes)fail('BROWSER_DOWNLOAD_SIZE');return buffer.subarray(0,bytesRead);}finally{await handle.close();}
}
export const disabledDownloads=Object.freeze({async accept(){fail('BROWSER_DOWNLOADS_DISABLED');}});
export function createDownloadPort({binding,policy,paths,artifacts,receipts,now}){
 const {downloads:limits,allowedOrigins,sourceScopes}=policy;
 if(!limits.enabled)return disabledDownloads;
 let accepted=0;
 return Object.freeze({async accept({filename,url}={},{signal}={}){
  if(signal?.aborted)fail('BROWSER_DOWNLOAD_CANCELLED');
  if(accepted>=limits.maxFiles)fail('BROWSER_DOWNLOAD_LIMIT');
  if(typeof filename!=='string'||!NAME.test(filename)||filename.includes('..'))fail('BROWSER_DOWNLOAD_NAME');
  const format=extname(filename).slice(1).toLowerCase();if(!limits.formats.includes(format))fail('BROWSER_DOWNLOAD_TYPE');
  let source;try{source=new URL(url);}catch{fail('BROWSER_DOWNLOAD_SOURCE');}if(!allowedOrigins.includes(source.origin))fail('BROWSER_DOWNLOAD_SOURCE');
  const path=join(paths.output,filename);let stat;try{stat=await lstat(path);}catch{fail('BROWSER_DOWNLOAD_MISSING');}
  if(!stat.isFile()||stat.isSymbolicLink()||await realpath(paths.output)!==paths.output)fail('BROWSER_DOWNLOAD_PATH');
  if(stat.size<1||stat.size>limits.maxBytes)fail('BROWSER_DOWNLOAD_SIZE');
  const bytes=await readBounded(path,limits.maxBytes);if(!bytes.length||!contentMatches(bytes,format))fail('BROWSER_DOWNLOAD_TYPE');
  const sha256=createHash('sha256').update(bytes).digest('hex'),mimeType=ARTIFACT_MIME_TYPES[format],host=urlHost(source.href);
  accepted++;
  const stored=await artifacts.ingest({binding:structuredClone(binding),scopes:structuredClone(sourceScopes),filename,format,mimeType,bytes:Buffer.from(bytes),sha256,source:{kind:'browser-download',urlHost:host}},{signal});
  if(typeof stored?.versionId!=='string'||!stored.versionId||stored.sha256!==sha256||stored.bytes!==bytes.length)fail('BROWSER_DOWNLOAD_INGEST');
  await receipts.record({schema:'meri-browser-receipt/1',kind:'browser.download',binding:structuredClone(binding),urlHost:host,atMs:now(),reference:stored.versionId,sha256,bytes:bytes.length,mimeType},{signal});
  await unlink(path);
  return Object.freeze({versionId:stored.versionId,sha256,bytes:bytes.length,mimeType});
 }});
}
