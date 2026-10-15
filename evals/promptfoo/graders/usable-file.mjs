/** A file passes when it decodes, matches its declared checksum, size and canonical MIME type, is STRUCTURALLY valid for
 * its format (`apps/artifacts/structure/file-structure.mjs`: strict ZIP with central/local agreement and CRC-32 of every
 * member, OPC package parsed as namespaced XML with the claimed main part, coherent PDF cross-reference/trailer/catalog,
 * strict UTF-8 text) and carries the required text. A structural refusal is reported as `DOES_NOT_OPEN <reason>` with
 * the validator's closed reason. Required text is checked only for text files; for other formats a non-empty
 * requirement fails closed as REQUIRED_TEXT_UNVERIFIED. Native open/render (Word, Excel, PowerPoint, PDF reader) is NOT
 * exercised here: that qualification is UNRUN and a pass is not a native usability claim. */
import {createHash} from 'node:crypto';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
import {structureCheck} from '../../../apps/artifacts/structure/file-structure.mjs';
/** Text content for text files, '' for other structurally valid files; `{refused:reason}` when the structure is invalid. */
function opens(bytes,format){
 const check=structureCheck(bytes,format);
 if(!check.valid)return {refused:check.reason};
 return format==='txt'?new TextDecoder('utf-8',{fatal:true}).decode(bytes):'';
}
function fileProblem(file,o){
 if(!file||typeof file.filename!=='string'||!file.filename.endsWith(`.${o.fileFormat}`))return 'FILENAME';
 if(file.mimeType!==ARTIFACT_MIME_TYPES[o.fileFormat])return 'MIME_TYPE';
 if(typeof file.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/u.test(file.base64))return 'ENCODING';
 const bytes=Buffer.from(file.base64,'base64');
 if(bytes.toString('base64')!==file.base64)return 'ENCODING';
 if(!bytes.length||bytes.length>o.maxBytes||file.bytes!==bytes.length)return 'SIZE';
 if(file.sha256!==createHash('sha256').update(bytes).digest('hex'))return 'CHECKSUM';
 const opened=opens(bytes,o.fileFormat);
 return typeof opened==='string'?null:`DOES_NOT_OPEN ${opened.refused}`;
}
export function gradeUsableFile(output,c){
 const o=c.outputFormat,files=Array.isArray(output.files)?output.files:[];
 if(files.length!==o.files)return {pass:false,score:0,reason:`FILE_COUNT ${files.length}/${o.files}`};
 const problems=files.map((f,i)=>{const p=fileProblem(f,o);return p?`file ${i}: ${p}`:null;}).filter(Boolean);
 if(!problems.length){const latest=opens(Buffer.from(files.at(-1).base64,'base64'),o.fileFormat);if(o.fileFormat!=='txt'&&o.requiredText.length)problems.push('REQUIRED_TEXT_UNVERIFIED');else for(const t of o.requiredText)if(!latest.includes(t))problems.push(`REQUIRED_TEXT_MISSING ${JSON.stringify(t)}`);}
 return {pass:problems.length===0,score:problems.length?0:1,reason:problems.length?problems.join('; '):`${files.length} structurally valid ${o.fileFormat} file(s); native open UNRUN`};
}
