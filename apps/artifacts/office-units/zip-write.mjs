/** Minimal single-disk ZIP writer for a bounded Office rewrite: every entry deflated (or stored when deflate
 * would not shrink it), CRC-32 and sizes in both headers, no data descriptors, no zip64, no comments. The
 * output is exactly what `../structure/zip.mjs readZip` admits, in the caller's entry order. Node built-ins only. */
import {crc32,deflateRawSync} from 'node:zlib';
import {refuse} from '../structure/refusal.mjs';
const LOC=0x04034b50,CEN=0x02014b50,EOCD=0x06054b50,FLAG_UTF8=0x800;
export function writeZip(entries){
 const locals=[],centrals=[];let offset=0,count=0;
 for(const [name,content] of entries){
  const data=Buffer.isBuffer(content)?content:Buffer.from(content),nameBytes=Buffer.from(name,'utf8');
  if(!name||nameBytes.length>1024)refuse('ZIP_ENTRY_NAME');
  const deflated=deflateRawSync(data),method=deflated.length<data.length?8:0,body=method===8?deflated:data,crc=crc32(data);
  const flags=nameBytes.some(b=>b>0x7e)?FLAG_UTF8:0;
  const local=Buffer.alloc(30);local.writeUInt32LE(LOC,0);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(CEN,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);
  central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,nameBytes,body);centrals.push(central,nameBytes);offset+=30+nameBytes.length+body.length;count++;
  if(offset>0xffffffff||count>0xffff)refuse('ZIP_UNSUPPORTED');
 }
 const directory=Buffer.concat(centrals),end=Buffer.alloc(22);
 end.writeUInt32LE(EOCD,0);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,directory,end]);
}
