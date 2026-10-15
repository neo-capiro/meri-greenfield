/** The malformed files from dot's corrected browser review of 31ed4a73 (H1 and H2), rebuilt independently. Each must be
 * refused by the structure validator and graded as not usable. `reason` is the closed refusal reason expected. */
import {zip,zipOffsets,ooxmlEntries,contentTypesXml,relationshipsXml,OFFICE_DOCUMENT_TYPE} from './fixtures.mjs';
const WORD_MAIN='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const DOCX_TYPE='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const RELS_DEFAULT='<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
/** Central-directory-consistent ZIP whose first local header is altered by `edit(bytes, localOffset)`. */
const localEdit=edit=>{const bytes=zip({'a.txt':'synthetic member'});edit(bytes,zipOffsets(bytes).local);return bytes;};
export const REVIEW_PROBES=Object.freeze([
 {id:'H1-1 unterminated DOCX main part',format:'docx',reason:'XML_MALFORMED',
  bytes:()=>zip({...ooxmlEntries('docx'),'word/document.xml':`<w:document xmlns:w="${WORD_MAIN}">`})},
 {id:'H1-2 officeDocument relationship only inside a comment',format:'docx',reason:'OPC_RELATIONSHIPS',
  bytes:()=>zip({...ooxmlEntries('docx'),'_rels/.rels':relationshipsXml(`<!-- <Relationship Id="rId1" Type="${OFFICE_DOCUMENT_TYPE}" Target="word/document.xml"/> -->`)})},
 {id:'H1-3 main-part override only inside a comment',format:'docx',reason:'OPC_CONTENT_TYPES',
  bytes:()=>zip({...ooxmlEntries('docx'),'[Content_Types].xml':contentTypesXml(`${RELS_DEFAULT}<!-- <Override PartName="/word/document.xml" ContentType="${DOCX_TYPE}"/> -->`)})},
 {id:'H1-4 relationship under NotRelationships without the relationships namespace',format:'docx',reason:'OPC_RELATIONSHIPS',
  bytes:()=>zip({...ooxmlEntries('docx'),'_rels/.rels':`<NotRelationships><Relationship Id="rId1" Type="${OFFICE_DOCUMENT_TYPE}" Target="word/document.xml"/></NotRelationships>`})},
 {id:'H1-5 32-byte xref/startxref PDF',format:'pdf',reason:'PDF_XREF',bytes:()=>Buffer.from('%PDF-1.7\nxref\nstartxref\n9\n%%EOF\n','latin1')},
 {id:'H1-6 startxref pointing at an ordinary object',format:'pdf',reason:'PDF_XREF',bytes:()=>Buffer.from('%PDF-1.7\n1 0 obj <<>> endobj\nstartxref\n9\n%%EOF\n','latin1')},
 {id:'H2-1 local encryption flag set, central clear',format:'zip',reason:'ZIP_LOCAL_HEADER',bytes:()=>localEdit((b,at)=>b.writeUInt16LE(b.readUInt16LE(at+6)|1,at+6))},
 {id:'H2-2 local CRC-32 zeroed',format:'zip',reason:'ZIP_LOCAL_HEADER',bytes:()=>localEdit((b,at)=>b.writeUInt32LE(0,at+14))},
 {id:'H2-3 local sizes zeroed without the data-descriptor flag',format:'zip',reason:'ZIP_LOCAL_HEADER',bytes:()=>localEdit((b,at)=>{b.writeUInt32LE(0,at+18);b.writeUInt32LE(0,at+22);})},
 {id:'H2-4 drive-letter entry name C:/escape.txt',format:'zip',reason:'ZIP_ENTRY_NAME',bytes:()=>zip({'C:/escape.txt':'synthetic'})}]);
