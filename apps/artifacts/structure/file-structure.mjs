/** Structural validation of downloaded files by format, using Node built-ins only (zlib inflate and CRC-32).
 * ZIP-family files must be a well-formed single-disk ZIP whose central directory, local headers, sizes and CRC-32 of
 * every entry agree; OOXML files must additionally be an OPC package whose content types, package relationship and
 * main part match the claimed format (macro-enabled parts refused). PDFs must have a header, a final `startxref`
 * pointing at a cross-reference section and `%%EOF`. Text must be strict UTF-8 without NUL.
 * This is structural evidence only: whether Word, Excel, PowerPoint or a PDF reader renders the file is NOT
 * qualified here (native open/render is UNRUN). */
import {crc32,inflateRawSync} from 'node:zlib';
const MAX_ENTRIES=10000,MAX_INFLATED=128*1024*1024;
const EOCD=0x06054b50,CEN=0x02014b50,LOC=0x04034b50;
const strict=new TextDecoder('utf-8',{fatal:true});
class Invalid extends Error{}
const bad=()=>{throw new Invalid();};
/** Parses and fully verifies a ZIP archive; returns Map(name → inflated bytes). */
export function readZip(bytes){
 if(bytes.length<22)bad();
 let eocd=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--)if(bytes.readUInt32LE(i)===EOCD&&i+22+bytes.readUInt16LE(i+20)===bytes.length){eocd=i;break;}
 if(eocd<0)bad();
 const disk=bytes.readUInt16LE(eocd+4),cdDisk=bytes.readUInt16LE(eocd+6),here=bytes.readUInt16LE(eocd+8),total=bytes.readUInt16LE(eocd+10),cdSize=bytes.readUInt32LE(eocd+12),cdOffset=bytes.readUInt32LE(eocd+16);
 if(disk||cdDisk||here!==total||!total||total>MAX_ENTRIES||total===0xffff||cdOffset===0xffffffff||cdOffset+cdSize!==eocd)bad();
 const entries=new Map();let p=cdOffset,inflated=0;
 for(let n=0;n<total;n++){
  if(p+46>eocd||bytes.readUInt32LE(p)!==CEN)bad();
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),crc=bytes.readUInt32LE(p+16),csize=bytes.readUInt32LE(p+20),usize=bytes.readUInt32LE(p+24),nlen=bytes.readUInt16LE(p+28),xlen=bytes.readUInt16LE(p+30),clen=bytes.readUInt16LE(p+32),local=bytes.readUInt32LE(p+42);
  if(flags&0x1||flags&0x40||method!==0&&method!==8||csize===0xffffffff||usize===0xffffffff||p+46+nlen+xlen+clen>eocd)bad();
  const nameBytes=bytes.subarray(p+46,p+46+nlen);let name;try{name=strict.decode(nameBytes);}catch{bad();}
  if(!name||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').some(s=>s==='..'||s==='.')||entries.has(name))bad();
  if(local+30>cdOffset||bytes.readUInt32LE(local)!==LOC)bad();
  const lnlen=bytes.readUInt16LE(local+26),lxlen=bytes.readUInt16LE(local+28),start=local+30+lnlen+lxlen;
  if(!bytes.subarray(local+30,local+30+lnlen).equals(nameBytes)||bytes.readUInt16LE(local+8)!==method||start+csize>cdOffset)bad();
  inflated+=usize;if(inflated>MAX_INFLATED)bad();
  const raw=bytes.subarray(start,start+csize);let data;
  if(method===0){if(csize!==usize)bad();data=raw;}else{try{data=inflateRawSync(raw,{maxOutputLength:Math.max(usize,1)});}catch{bad();}}
  if(data.length!==usize||crc32(data)!==crc)bad();
  entries.set(name,data);p+=46+nlen+xlen+clen;
 }
 if(p!==eocd)bad();
 return entries;
}
const OOXML=Object.freeze({
 docx:{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',root:'document',ns:['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']},
 xlsx:{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',root:'workbook',ns:['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main']},
 pptx:{contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',root:'presentation',ns:['http://schemas.openxmlformats.org/presentationml/2006/main','http://purl.oclc.org/ooxml/presentationml/main']}});
const OFFICE_DOCUMENT=/\bType="http:\/\/(?:schemas\.openxmlformats\.org\/officeDocument\/2006|purl\.oclc\.org\/ooxml\/officeDocument)\/relationships\/officeDocument"/u;
const attr=(tag,name)=>new RegExp(`\\b${name}="([^"]*)"`,'u').exec(tag)?.[1];
const xmlText=data=>{let text;try{text=strict.decode(data);}catch{bad();}return text.replace(/^\uFEFF/u,'');};
/** Root element local name and its namespace, after an optional XML declaration. */
function rootOf(text){
 const m=/^\s*(?:<\?xml[^>]*\?>\s*)?<(?:([A-Za-z_][\w.-]*):)?([A-Za-z_][\w.-]*)\b([^>]*)>/u.exec(text);if(!m)bad();
 const ns=attr(m[3],m[1]?`xmlns:${m[1]}`:'xmlns');return {name:m[2],ns};
}
function verifyOoxml(entries,format){
 const spec=OOXML[format],types=entries.get('[Content_Types].xml'),rels=entries.get('_rels/.rels');
 if(!types||!rels||[...entries.keys()].some(n=>/(?:^|\/)vbaProject\.bin$/iu.test(n)))bad();
 const typesText=xmlText(types),typesRoot=rootOf(typesText);
 if(typesRoot.name!=='Types'||typesRoot.ns!=='http://schemas.openxmlformats.org/package/2006/content-types'||/macroEnabled/iu.test(typesText))bad();
 const relationship=[...xmlText(rels).matchAll(/<(?:\w+:)?Relationship\b[^>]*>/gu)].map(m=>m[0]).find(t=>OFFICE_DOCUMENT.test(t));if(!relationship)bad();
 const target=attr(relationship,'Target');if(!target||/^[a-z]+:/iu.test(target)||attr(relationship,'TargetMode')==='External')bad();
 const part=target.replace(/^\//u,'');
 const override=[...typesText.matchAll(/<(?:\w+:)?Override\b[^>]*>/gu)].map(m=>m[0]).find(t=>attr(t,'PartName')===`/${part}`);
 if(!override||attr(override,'ContentType')!==spec.contentType||!entries.has(part))bad();
 const root=rootOf(xmlText(entries.get(part)));if(root.name!==spec.root||!spec.ns.includes(root.ns))bad();
}
function verifyPdf(bytes){
 if(!/^%PDF-(?:1\.[0-7]|2\.0)\b/u.test(bytes.subarray(0,16).toString('latin1')))bad();
 const tail=bytes.subarray(Math.max(0,bytes.length-1024)).toString('latin1'),m=/startxref\s+(\d{1,10})\s+%%EOF\s*$/u.exec(tail);if(!m)bad();
 const at=Number(m[1]);if(at<8||at>=bytes.length)bad();
 if(!/^(?:xref\b|\d{1,10}\s+\d{1,5}\s+obj\b)/u.test(bytes.subarray(at,at+32).toString('latin1')))bad();
}
/** True when `bytes` is structurally valid for `format` (one of the canonical artifact formats). */
export function structurallyValid(bytes,format){
 try{
  if(format==='txt'){strict.decode(bytes);return !bytes.includes(0);}
  if(format==='pdf'){verifyPdf(bytes);return true;}
  if(format==='zip'||Object.hasOwn(OOXML,format)){const entries=readZip(bytes);if(format!=='zip')verifyOoxml(entries,format);return true;}
  return false;
 }catch{return false;}
}
