/** Structural validation of downloaded or generated files by canonical artifact format. Entry point only; each format
 * has its own reader:
 *
 * - `zip.mjs`: strict single-disk ZIP (central/local agreement, data descriptors, exact entry layout, CRC-32 of every
 *   inflated member, bomb bounds, portable unique names);
 * - `ooxml.mjs` with `xml.mjs`: OPC package of the claimed DOCX/XLSX/PPTX format, every examined part parsed by the
 *   strict namespace-aware `saxes` XML parser;
 * - `pdf.mjs` with `pdf-objects.mjs`: coherent cross-reference sections, trailer and document catalog;
 * - text: strict UTF-8 without NUL.
 *
 * Refusals carry one closed reason (`refusal.mjs`). This is structural evidence only: whether Word, Excel, PowerPoint
 * or a PDF reader opens or renders the file is NOT qualified here (native open/render is UNRUN). */
import {readZip} from './zip.mjs';
import {verifyOoxml,OOXML_FORMATS} from './ooxml.mjs';
import {verifyPdf} from './pdf.mjs';
import {StructureInvalid,refuse} from './refusal.mjs';
export {readZip};
export {STRUCTURE_REASONS} from './refusal.mjs';
const strict=new TextDecoder('utf-8',{fatal:true});
function verify(bytes,format){
 if(format==='txt'){try{strict.decode(bytes);}catch{refuse('TEXT_ENCODING');}if(bytes.includes(0))refuse('TEXT_ENCODING');return;}
 if(format==='pdf')return verifyPdf(bytes);
 if(format==='zip'){readZip(bytes);return;}
 if(Object.hasOwn(OOXML_FORMATS,format))return verifyOoxml(readZip(bytes),format);
 refuse('FORMAT_UNSUPPORTED');
}
/** `{valid:true}` or `{valid:false,reason}` with a reason from STRUCTURE_REASONS. */
export function structureCheck(bytes,format){
 try{if(!Buffer.isBuffer(bytes))refuse('STRUCTURE_UNREADABLE');verify(bytes,format);return Object.freeze({valid:true});}
 catch(error){return Object.freeze({valid:false,reason:error instanceof StructureInvalid?error.reason:'STRUCTURE_UNREADABLE'});}
}
/** True when `bytes` is structurally valid for `format` (one of the canonical artifact formats). */
export function structurallyValid(bytes,format){return structureCheck(bytes,format).valid;}
