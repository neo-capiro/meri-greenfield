/** A usable file decodes, matches its declared checksum, size and canonical MIME type, opens in its format and carries the required text. */
import {createHash} from 'node:crypto';
import {ARTIFACT_MIME_TYPES} from '../../../packages/contracts/artifacts-0.2/artifact-formats.mjs';
const SIGNATURES={docx:'504b0304',xlsx:'504b0304',pptx:'504b0304',pdf:'255044462d'};
function opens(bytes,format){
 if(format==='txt'){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return null;}}
 return bytes.subarray(0,SIGNATURES[format].length/2).toString('hex')===SIGNATURES[format]?'':null;
}
function fileProblem(file,o){
 if(!file||typeof file.filename!=='string'||!file.filename.endsWith(`.${o.fileFormat}`))return 'FILENAME';
 if(file.mimeType!==ARTIFACT_MIME_TYPES[o.fileFormat])return 'MIME_TYPE';
 if(typeof file.base64!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/u.test(file.base64))return 'ENCODING';
 const bytes=Buffer.from(file.base64,'base64');
 if(bytes.toString('base64')!==file.base64)return 'ENCODING';
 if(!bytes.length||bytes.length>o.maxBytes||file.bytes!==bytes.length)return 'SIZE';
 if(file.sha256!==createHash('sha256').update(bytes).digest('hex'))return 'CHECKSUM';
 return opens(bytes,o.fileFormat)===null?'DOES_NOT_OPEN':null;
}
export function gradeUsableFile(output,c){
 const o=c.outputFormat,files=Array.isArray(output.files)?output.files:[];
 if(files.length!==o.files)return {pass:false,score:0,reason:`FILE_COUNT ${files.length}/${o.files}`};
 const problems=files.map((f,i)=>{const p=fileProblem(f,o);return p?`file ${i}: ${p}`:null;}).filter(Boolean);
 if(!problems.length){const latest=opens(Buffer.from(files.at(-1).base64,'base64'),o.fileFormat);for(const t of o.requiredText)if(!latest.includes(t))problems.push(`REQUIRED_TEXT_MISSING ${JSON.stringify(t)}`);}
 return {pass:problems.length===0,score:problems.length?0:1,reason:problems.length?problems.join('; '):`${files.length} usable ${o.fileFormat} file(s)`};
}
