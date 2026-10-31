/** Immutable private source for a downloaded browser file. This is NOT a public tool request and no
 * renderer produced it: the model's typed document schemas deliberately continue to refuse it. It keeps the
 * existing artifact format vocabulary (and therefore the mime/name owners) while recording the browser
 * provenance the download port already established. */
import {data,own} from './commands-0.2/execution-boundary.mjs';
import {ARTIFACT_MIME_TYPES} from './artifacts-0.2/artifact-formats.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
const SHA=/^[a-f0-9]{64}$/u;
export const BROWSER_IMPORT_KIND='meri.browser-download/1';
export const BROWSER_IMPORT_OPERATION='import_file';
export const BROWSER_IMPORT_FORMATS=Object.freeze(Object.keys(ARTIFACT_MIME_TYPES));
const FORMATS=new Set(BROWSER_IMPORT_FORMATS);
export const isBrowserImport=value=>value?.sourceKind===BROWSER_IMPORT_KIND;
/** Closed bound spec: the reviewed filename-derived title, the exact content facts and the acquisition provenance. */
export function browserImportSource(value){
 try{
  const s=data(own(value,['sourceKind','operation','format','title','source','sha256','bytes'],['originalFilename']));
  const p=own(s.source,['kind','origin','urlHost','acquiredAtMs','policySha256']);
  if(s.sourceKind!==BROWSER_IMPORT_KIND||s.operation!==BROWSER_IMPORT_OPERATION||typeof s.format!=='string'||!FORMATS.has(s.format)||
   typeof s.title!=='string'||!s.title.isWellFormed()||s.title.length<1||s.title.length>200||
   p.kind!=='browser-download'||typeof p.origin!=='string'||p.origin.length<8||p.origin.length>2048||
   typeof p.urlHost!=='string'||!p.urlHost||p.urlHost.length>253||new URL(p.origin).hostname!==p.urlHost||
   !Number.isSafeInteger(p.acquiredAtMs)||p.acquiredAtMs<0||p.acquiredAtMs>Number.MAX_SAFE_INTEGER||
   typeof p.policySha256!=='string'||!SHA.test(p.policySha256)||
   typeof s.sha256!=='string'||!SHA.test(s.sha256)||!Number.isSafeInteger(s.bytes)||s.bytes<1||s.bytes>16777216)fail('BROWSER_IMPORT_SOURCE');
  if(s.originalFilename!==undefined){
   const name=s.originalFilename;
   if(typeof name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._ -]{0,199}$/u.test(name)||name.includes('..')||
    name.slice(name.lastIndexOf('.')+1).toLowerCase()!==s.format||
    name.slice(0,-(s.format.length+1))!==s.title)fail('BROWSER_IMPORT_SOURCE');
  }
  return s;
 }catch{fail('BROWSER_IMPORT_SOURCE');}
}
/** Bytes were read and structure-checked by the download port; nothing was rendered, opened or recalculated. */
export function browserImportInspection(value){
 try{
  const i=data(own(value,['sha256','bytes','format','nativeOpened','rendered','recalculated','members','details']));
  const d=own(i.details,['mimeType']);
  if(typeof i.sha256!=='string'||!SHA.test(i.sha256)||!Number.isSafeInteger(i.bytes)||i.bytes<1||i.bytes>16777216||
   typeof i.format!=='string'||!FORMATS.has(i.format)||d.mimeType!==ARTIFACT_MIME_TYPES[i.format]||
   !Array.isArray(i.members)||i.members.length||
   i.nativeOpened!==false||i.rendered!==false||i.recalculated!==false)fail('BROWSER_IMPORT_INSPECTION');
  return i;
 }catch{throw Object.assign(Error('BROWSER_IMPORT_INSPECTION'),{code:'BROWSER_IMPORT_INSPECTION'});}
}
/** One deterministic identity per reviewed import: the same key, bytes and source never commit twice. */
export function browserImportRequestSha256(v,spec,idempotencyKey,context){
 if(typeof idempotencyKey!=='string'||!SHA.test(idempotencyKey))fail('BROWSER_IMPORT_KEY');
 const {deadlineMs,...stable}=context;
 return v.hash({action:'artifact.generate',import:browserImportSource(spec),idempotencyKey,context:stable});
}
export function assertBrowserImportRecord(spec,version){
 if(!isBrowserImport(spec))return;
 if(spec.sha256!==version.object.sha256||spec.bytes!==version.object.bytes)fail('BROWSER_IMPORT_RECORD');
}
