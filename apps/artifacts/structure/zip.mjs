/** Strict single-disk ZIP reader using Node built-ins only (zlib raw inflate and CRC-32).
 *
 * Every entry must agree between its central-directory record and its local header: flags, method, name and, unless
 * the data-descriptor flag (bit 3) is set, CRC-32 and both sizes. With bit 3 the local fields must be zero or equal to
 * the central values and a data descriptor (optionally signed) carrying the central values must follow the data.
 * Local entries (header, data, descriptor) must tile the bytes before the central directory exactly, so entries never
 * overlap, share data or hide bytes between them. Each member is inflated and its length and CRC-32 compared with the
 * central record. Encryption, zip64, multi-disk and methods other than stored/deflate are refused.
 *
 * Bomb bounds: the sum of declared uncompressed sizes is at most ZIP_LIMITS.maxTotalUncompressed (128 MiB), a declared
 * size may not exceed ZIP_LIMITS.maxRatio (1032, the deflate maximum) times the compressed size, and inflation never
 * produces more than the declared size. Names must be portable: UTF-8 (non-ASCII only with the UTF-8 flag), relative,
 * no empty, `.` or `..` segment, no backslash, colon (drive letters, streams), NUL or control character, and unique
 * case-insensitively. */
import {crc32,inflateRawSync} from 'node:zlib';
import {refuse} from './refusal.mjs';
export const ZIP_LIMITS=Object.freeze({maxEntries:10000,maxTotalUncompressed:128*1024*1024,maxRatio:1032,maxNameLength:1024});
const EOCD=0x06054b50,ZIP64_LOCATOR=0x07064b50,CEN=0x02014b50,LOC=0x04034b50,DESCRIPTOR=0x08074b50;
const FLAG_ENCRYPTED=0x1,FLAG_DESCRIPTOR=0x8,FLAG_STRONG_ENCRYPTION=0x40,FLAG_UTF8=0x800,FLAG_MASKED_HEADERS=0x2000;
const strict=new TextDecoder('utf-8',{fatal:true});
// eslint-disable-next-line no-control-regex
const UNPORTABLE=/[\u0000-\u001f\u007f\\:]/u;
/** Locates and checks the end-of-central-directory record. */
function centralDirectory(bytes){
 if(bytes.length<22)refuse('ZIP_END_OF_CENTRAL_DIRECTORY');
 let eocd=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-22-65535);i--)if(bytes.readUInt32LE(i)===EOCD&&i+22+bytes.readUInt16LE(i+20)===bytes.length){eocd=i;break;}
 if(eocd<0)refuse('ZIP_END_OF_CENTRAL_DIRECTORY');
 const disk=bytes.readUInt16LE(eocd+4),cdDisk=bytes.readUInt16LE(eocd+6),here=bytes.readUInt16LE(eocd+8),total=bytes.readUInt16LE(eocd+10),cdSize=bytes.readUInt32LE(eocd+12),cdOffset=bytes.readUInt32LE(eocd+16);
 if(total===0xffff||cdSize===0xffffffff||cdOffset===0xffffffff||eocd>=20&&bytes.readUInt32LE(eocd-20)===ZIP64_LOCATOR||disk||cdDisk)refuse('ZIP_UNSUPPORTED');
 if(here!==total||!total||total>ZIP_LIMITS.maxEntries||cdOffset+cdSize!==eocd)refuse('ZIP_END_OF_CENTRAL_DIRECTORY');
 return {eocd,total,cdOffset};
}
/** Portable, unique entry name. `seen` holds lower-cased names already in the archive. */
function entryName(nameBytes,flags,seen){
 if(!(flags&FLAG_UTF8)&&nameBytes.some(b=>b>0x7e))refuse('ZIP_ENTRY_NAME');
 let name;try{name=strict.decode(nameBytes);}catch{refuse('ZIP_ENTRY_NAME');}
 const directory=name.endsWith('/'),segments=(directory?name.slice(0,-1):name).split('/');
 if(!name||name.length>ZIP_LIMITS.maxNameLength||UNPORTABLE.test(name)||segments.some(s=>!s||s==='.'||s==='..'))refuse('ZIP_ENTRY_NAME');
 const key=name.toLowerCase();if(seen.has(key))refuse('ZIP_ENTRY_NAME');seen.add(key);
 return name;
}
/** Length (16 signed, 12 unsigned) of the data descriptor at `at`, which must carry the central values. */
function descriptorLength(bytes,at,c,limit){
 const carries=o=>o+12<=limit&&bytes.readUInt32LE(o)===c.crc&&bytes.readUInt32LE(o+4)===c.csize&&bytes.readUInt32LE(o+8)===c.usize;
 if(at+16<=limit&&bytes.readUInt32LE(at)===DESCRIPTOR&&carries(at+4))return 16;
 if(carries(at))return 12;
 return refuse('ZIP_DATA_DESCRIPTOR');
}
/** Checks the local header against the central record; returns the entry's byte span and data offset. */
function localEntry(bytes,c,nameBytes,cdOffset){
 const at=c.local;
 if(at+30>cdOffset||bytes.readUInt32LE(at)!==LOC)refuse('ZIP_LOCAL_HEADER');
 const flags=bytes.readUInt16LE(at+6),method=bytes.readUInt16LE(at+8),crc=bytes.readUInt32LE(at+14),csize=bytes.readUInt32LE(at+18),usize=bytes.readUInt32LE(at+22),nlen=bytes.readUInt16LE(at+26),xlen=bytes.readUInt16LE(at+28);
 if(flags!==c.flags||method!==c.method||nlen!==nameBytes.length||!bytes.subarray(at+30,at+30+nlen).equals(nameBytes))refuse('ZIP_LOCAL_HEADER');
 const dataStart=at+30+nlen+xlen,dataEnd=dataStart+c.csize;
 if(dataEnd>cdOffset)refuse('ZIP_ENTRY_LAYOUT');
 const same=crc===c.crc&&csize===c.csize&&usize===c.usize;
 if(!(flags&FLAG_DESCRIPTOR)){if(!same)refuse('ZIP_LOCAL_HEADER');return {start:at,dataStart,end:dataEnd};}
 if(!same&&(crc!==0||csize!==0||usize!==0))refuse('ZIP_LOCAL_HEADER');
 return {start:at,dataStart,end:dataEnd+descriptorLength(bytes,dataEnd,c,cdOffset)};
}
/** Inflated member bytes whose length and CRC-32 match the central record. */
function memberData(raw,c){
 let data;
 if(c.method===0){if(c.csize!==c.usize)refuse('ZIP_ENTRY_DATA');data=raw;}
 else{try{data=inflateRawSync(raw,{maxOutputLength:Math.max(c.usize,1)});}catch{refuse('ZIP_ENTRY_DATA');}}
 if(data.length!==c.usize||crc32(data)!==c.crc)refuse('ZIP_ENTRY_DATA');
 return data;
}
/** Parses and fully verifies a ZIP archive; returns Map(name → inflated bytes) in central-directory order. */
export function readZip(bytes){
 const {eocd,total,cdOffset}=centralDirectory(bytes);
 const entries=new Map(),seen=new Set(),spans=[];let p=cdOffset,declared=0;
 for(let n=0;n<total;n++){
  if(p+46>eocd||bytes.readUInt32LE(p)!==CEN)refuse('ZIP_CENTRAL_DIRECTORY');
  const c={flags:bytes.readUInt16LE(p+8),method:bytes.readUInt16LE(p+10),crc:bytes.readUInt32LE(p+16),csize:bytes.readUInt32LE(p+20),usize:bytes.readUInt32LE(p+24),disk:bytes.readUInt16LE(p+34),local:bytes.readUInt32LE(p+42)};
  const nlen=bytes.readUInt16LE(p+28),xlen=bytes.readUInt16LE(p+30),clen=bytes.readUInt16LE(p+32);
  if(p+46+nlen+xlen+clen>eocd)refuse('ZIP_CENTRAL_DIRECTORY');
  if(c.flags&(FLAG_ENCRYPTED|FLAG_STRONG_ENCRYPTION|FLAG_MASKED_HEADERS)||c.method!==0&&c.method!==8||c.csize===0xffffffff||c.usize===0xffffffff||c.local===0xffffffff||c.disk!==0)refuse('ZIP_UNSUPPORTED');
  const nameBytes=bytes.subarray(p+46,p+46+nlen),name=entryName(nameBytes,c.flags,seen);
  declared+=c.usize;
  if(declared>ZIP_LIMITS.maxTotalUncompressed||c.usize>Math.max(c.csize,1)*ZIP_LIMITS.maxRatio)refuse('ZIP_SIZE_LIMIT');
  const span=localEntry(bytes,c,nameBytes,cdOffset);spans.push(span);
  const data=memberData(bytes.subarray(span.dataStart,span.dataStart+c.csize),c);
  if(name.endsWith('/')&&data.length)refuse('ZIP_ENTRY_NAME');
  entries.set(name,data);p+=46+nlen+xlen+clen;
 }
 if(p!==eocd)refuse('ZIP_CENTRAL_DIRECTORY');
 let next=0;for(const s of spans.sort((a,b)=>a.start-b.start)){if(s.start!==next)refuse('ZIP_ENTRY_LAYOUT');next=s.end;}
 if(next!==cdOffset)refuse('ZIP_ENTRY_LAYOUT');
 return entries;
}
