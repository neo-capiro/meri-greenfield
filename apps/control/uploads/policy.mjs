/** Product upload policy. Original bytes are inert data; this module never extracts, executes or fetches links. */
import {createHash} from 'node:crypto';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readZip} from '../../artifacts/structure/zip.mjs';
import {verifyOoxml,OPC_NAMESPACES} from '../../artifacts/structure/ooxml.mjs';
import {readXmlPart} from '../../artifacts/structure/xml.mjs';

import {UPLOAD_POLICY_VERSION,UPLOAD_LIMITS,UPLOAD_MIME} from '../../../packages/contracts/uploads-application/protocol.mjs';
export {UPLOAD_POLICY_VERSION,UPLOAD_LIMITS,UPLOAD_MIME};
export const uploadHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function uploadError(code){return Object.assign(new Error(code),{code});}
const refuse=code=>{throw uploadError(code);};
/** Closed original-file declaration, reusable by initiation and completion. Not an authority receipt. */
export function uploadDeclaration(value){
 const raw=own(data(value),['filename','mimeType','bytes','sha256']);
 if(typeof raw.filename!=='string'||!raw.filename.isWellFormed()||Buffer.byteLength(raw.filename)>255||
  /[\u0000-\u001f\u007f/\\]/u.test(raw.filename)||!raw.filename.trim()||raw.filename==='.'||raw.filename==='..')refuse('UPLOAD_FILENAME');
 const format=/\.([a-z0-9]+)$/iu.exec(raw.filename)?.[1].toLowerCase();
 if(!Object.hasOwn(UPLOAD_MIME,format)||raw.mimeType!==UPLOAD_MIME[format])refuse('UPLOAD_FORMAT');
 if(!Number.isSafeInteger(raw.bytes)||raw.bytes<1||raw.bytes>UPLOAD_LIMITS.originalBytes)refuse('UPLOAD_SIZE');
 if(typeof raw.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(raw.sha256))refuse('UPLOAD_HASH');
 return Object.freeze({...raw,format});
}
const REL_BASES=['http://schemas.openxmlformats.org/officeDocument/2006/relationships/','http://purl.oclc.org/ooxml/officeDocument/relationships/'];
const HYPERLINKS=new Set(REL_BASES.map(base=>`${base}hyperlink`));
const ACTIVE_RELATIONSHIPS=new Set(REL_BASES.flatMap(base=>['oleObject','package','control','attachedTemplate','aFChunk'].map(kind=>`${base}${kind}`)));
/** Every relationship part is checked, not only the main document. Hyperlinks remain inert text/targets. */
function passiveOffice(entries){
 for(const [name,bytes] of entries){
  if(/(?:^|\/)(?:activeX|embeddings|externalLinks)(?:\/|$)|(?:^|\/)(?:vbaProject|vbaData)\./iu.test(name))refuse('UPLOAD_ACTIVE_CONTENT');
  if(!name.endsWith('.rels'))continue;
  const {root,children}=readXmlPart(bytes,{elementOnlyRoot:true});
  if(root.uri!==OPC_NAMESPACES.relationships||root.local!=='Relationships')refuse('UPLOAD_RELATIONSHIP');
  const ids=new Set();
  for(const {uri,local,attributes:a} of children){
   if(uri!==OPC_NAMESPACES.relationships||local!=='Relationship'||!a.Id||ids.has(a.Id)||!a.Type||!a.Target||
    ![undefined,'Internal','External'].includes(a.TargetMode))refuse('UPLOAD_RELATIONSHIP');
   ids.add(a.Id);
   if(ACTIVE_RELATIONSHIPS.has(a.Type)||a.TargetMode==='External'&&!HYPERLINKS.has(a.Type))refuse('UPLOAD_ACTIVE_CONTENT');
  }
 }
}
/** Complete hash and structural preflight. A successful result is NOT a malware scan or an extraction receipt. */
export function inspectUploadOriginal(declaration,input){
 const file=uploadDeclaration(declaration);
 if(!Buffer.isBuffer(input)||input.length!==file.bytes||uploadHash(input)!==file.sha256)refuse('UPLOAD_ORIGINAL_MISMATCH');
 const bytes=Buffer.from(input);
 if(['txt','md'].includes(file.format)){
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{refuse('UPLOAD_ENCODING');}
  if(text.includes('\0'))refuse('UPLOAD_ENCODING');
 }else if(file.format==='pdf'){
  if(!/^%PDF-[12]\.[0-9]/u.test(bytes.subarray(0,8).toString('ascii')))refuse('UPLOAD_MAGIC');
 }else if(file.format==='png'){
  if(bytes.length<33||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR')refuse('UPLOAD_MAGIC');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width*height>UPLOAD_LIMITS.imagePixels)refuse('UPLOAD_IMAGE_LIMIT');
 }else if(file.format==='jpg'||file.format==='jpeg'){
  if(bytes.length<4||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)refuse('UPLOAD_MAGIC');
 }else{
  const entries=readZip(bytes,{maxEntries:UPLOAD_LIMITS.zipEntries,maxTotalUncompressed:UPLOAD_LIMITS.expandedBytes,maxRatio:UPLOAD_LIMITS.compressionRatio});
  verifyOoxml(entries,file.format);passiveOffice(entries);
 }
 return Object.freeze({...file,policyVersion:UPLOAD_POLICY_VERSION});
}
