/** Independent file builders for structural-validation tests: a minimal ZIP writer (stored or deflated, optional data
 * descriptors), the smallest OPC package per OOXML format and minimal PDFs (classic table, incremental update,
 * cross-reference stream with optional PNG predictor and object stream). */
import {crc32,deflateRawSync,deflateSync} from 'node:zlib';
/** Minimal ZIP writer. `descriptor`: false, 'unsigned' or 'signed' (bit 3 set, local CRC/sizes zero). */
export function zip(entries,{method=8,descriptor=false,utf8=false}={}){
 const locals=[],centrals=[];let offset=0;
 const flags=(descriptor?0x8:0)|(utf8?0x800:0);
 for(const [name,content] of Object.entries(entries)){
  const data=Buffer.from(content),nameBytes=Buffer.from(name),body=method===8?deflateRawSync(data):data,crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(flags,6);local.writeUInt16LE(method,8);
  if(!descriptor){local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);}
  local.writeUInt16LE(nameBytes.length,26);
  const trailer=Buffer.alloc(descriptor==='signed'?16:descriptor?12:0);
  if(descriptor){let o=0;if(descriptor==='signed'){trailer.writeUInt32LE(0x08074b50,0);o=4;}trailer.writeUInt32LE(crc,o);trailer.writeUInt32LE(body.length,o+4);trailer.writeUInt32LE(data.length,o+8);}
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,nameBytes,body,trailer);centrals.push(central,nameBytes);offset+=30+nameBytes.length+body.length+trailer.length;
 }
 const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,cd,end]);
}
/** Byte offset of the local header and central record of entry `index` in a `zip()` result without comments. */
export function zipOffsets(bytes,index=0){
 const eocd=bytes.length-22;let p=bytes.readUInt32LE(eocd+16);
 for(let n=0;n<index;n++)p+=46+bytes.readUInt16LE(p+28)+bytes.readUInt16LE(p+30)+bytes.readUInt16LE(p+32);
 return {central:p,local:bytes.readUInt32LE(p+42)};
}
const MAIN={docx:['word/document.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'],
 xlsx:['xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'],
 pptx:['ppt/presentation.xml','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml','<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>']};
export const OFFICE_DOCUMENT_TYPE='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';
const XML_DECL='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
/** Content-types part body (children inside `Types`). */
export const contentTypesXml=inner=>`${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${inner}</Types>`;
/** Relationships part body (children inside `Relationships`). */
export const relationshipsXml=inner=>`${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${inner}</Relationships>`;
/** Smallest OPC package with content types, package relationship and the format's main part. */
export function ooxmlEntries(format,{mainType=MAIN[format][1],mainXml=MAIN[format][2]}={}){
 const [part]=MAIN[format];
 return {'[Content_Types].xml':contentTypesXml(`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/${part}" ContentType="${mainType}"/>`),
  '_rels/.rels':relationshipsXml(`<Relationship Id="rId1" Type="${OFFICE_DOCUMENT_TYPE}" Target="${part}"/>`),
  [part]:`${XML_DECL}${mainXml}`};
}
export const ooxml=(format,options)=>zip(ooxmlEntries(format,options));
export const PDF_OBJECTS=Object.freeze(['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>']);
/** Objects 1..n laid out after `head`; returns the text and each object's byte offset. */
function layout(objects,head){
 let text=head;const offsets=[];
 objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text,'latin1'));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});
 return {text,offsets};
}
const entry=o=>`${String(o).padStart(10,'0')} 00000 n \n`;
/** Minimal classic-table PDF: catalog, page tree and one page. `comment` varies the bytes. */
export function pdf(comment='synthetic',{objects=PDF_OBJECTS}={}){
 const {text,offsets}=layout(objects,`%PDF-1.7\n% ${comment}\n`),at=Buffer.byteLength(text,'latin1');
 return Buffer.from(`${text}xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.map(entry).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`,'latin1');
}
/** `pdf()` plus one incremental update replacing the page object, linked through `/Prev`. */
export function pdfIncremental(){
 const base=pdf('base').toString('latin1'),prev=Number(/startxref\n(\d+)\n%%EOF\n$/u.exec(base)[1]);
 const pageAt=Buffer.byteLength(base,'latin1'),page='3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\n',at=pageAt+Buffer.byteLength(page,'latin1');
 return Buffer.from(`${base}${page}xref\n3 1\n${entry(pageAt)}trailer\n<< /Size 4 /Root 1 0 R /Prev ${prev} >>\nstartxref\n${at}\n%%EOF\n`,'latin1');
}
/** PDF whose cross-reference is a stream (W [1 4 2]); optionally PNG-predicted (Up), with the catalog (and optionally the
 * page tree root too) compressed inside an object stream, and with the catalog's /Pages reference replaced. */
export function pdfXrefStream({predictor=false,catalogInObjectStream=false,pagesInObjectStream=false,pagesRef='2 0 R'}={}){
 const objects=[...PDF_OBJECTS];let compressed=null;
 objects[0]=objects[0].replace('/Pages 2 0 R',`/Pages ${pagesRef}`);
 if(catalogInObjectStream||pagesInObjectStream){
  const catalog=objects[0],pages=objects[1],header=pagesInObjectStream?`1 0 2 ${catalog.length+1} `:'1 0 ';
  const data=deflateSync(Buffer.from(pagesInObjectStream?`${header}${catalog} ${pages}`:`${header}${catalog}`,'latin1'));
  objects[0]='<< /Type /Placeholder >>';if(pagesInObjectStream)objects[1]='<< /Type /Placeholder >>';
  objects.push(`<< /Type /ObjStm /N ${pagesInObjectStream?2:1} /First ${header.length} /Filter /FlateDecode /Length ${data.length} >>\nstream\n${data.toString('latin1')}\nendstream`);
  compressed={objstm:objects.length};
 }
 const {text,offsets}=layout(objects,'%PDF-1.7\n'),at=Buffer.byteLength(text,'latin1'),xrefNum=objects.length+1;
 const rows=[[0,0,65535],...offsets.map(o=>[1,o,0]),[1,at,0]];
 if(compressed){rows[1]=[2,compressed.objstm,0];if(pagesInObjectStream)rows[2]=[2,compressed.objstm,1];}
 const raw=Buffer.alloc(rows.length*7);rows.forEach(([t,a,b],i)=>{raw.writeUInt8(t,i*7);raw.writeUInt32BE(a,i*7+1);raw.writeUInt16BE(b,i*7+5);});
 let body=raw,parms='';
 if(predictor){body=Buffer.alloc(rows.length*8);for(let r=0;r<rows.length;r++){body[r*8]=2;for(let x=0;x<7;x++)body[r*8+1+x]=(raw[r*7+x]-(r?raw[(r-1)*7+x]:0))&0xff;}parms=' /DecodeParms << /Predictor 12 /Columns 7 >>';}
 const data=deflateSync(body);
 return Buffer.from(`${text}${xrefNum} 0 obj\n<< /Type /XRef /Size ${xrefNum+1} /W [1 4 2] /Root 1 0 R /Filter /FlateDecode${parms} /Length ${data.length} >>\nstream\n${data.toString('latin1')}\nendstream\nendobj\nstartxref\n${at}\n%%EOF\n`,'latin1');
}
