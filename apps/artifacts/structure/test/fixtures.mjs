/** Independent file builders for structural-validation tests: a minimal ZIP writer (stored or deflated), the smallest
 * OPC package per OOXML format and a minimal PDF with a cross-reference trailer. */
import {crc32,deflateRawSync} from 'node:zlib';
/** Minimal ZIP writer (stored or deflated entries) for building valid and corrupt packages. */
export function zip(entries,{method=8}={}){
 const locals=[],centrals=[];let offset=0;
 for(const [name,content] of Object.entries(entries)){
  const data=Buffer.from(content),nameBytes=Buffer.from(name),body=method===8?deflateRawSync(data):data,crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBytes.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(method,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,nameBytes,body);centrals.push(central,nameBytes);offset+=30+nameBytes.length+body.length;
 }
 const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(entries).length,8);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,cd,end]);
}
const MAIN={docx:['word/document.xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body/></w:document>'],
 xlsx:['xl/workbook.xml','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>'],
 pptx:['ppt/presentation.xml','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml','<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>']};
/** Smallest OPC package with content types, package relationship and the format's main part. */
export function ooxmlEntries(format,{mainType=MAIN[format][1],mainXml=MAIN[format][2]}={}){
 const [part]=MAIN[format];
 return {'[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/${part}" ContentType="${mainType}"/></Types>`,
  '_rels/.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${part}"/></Relationships>`,
  [part]:`<?xml version="1.0" encoding="UTF-8"?>${mainXml}`};
}
export const ooxml=(format,options)=>zip(ooxmlEntries(format,options));
export const pdf=(body='synthetic')=>{const head=`%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n% ${body}\n`;return Buffer.from(`${head}xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Root 1 0 R >>\nstartxref\n${Buffer.byteLength(head)}\n%%EOF\n`);};
