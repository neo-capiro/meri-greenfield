import test from 'node:test';import assert from 'node:assert/strict';
import {structurallyValid,structureCheck,readZip,STRUCTURE_REASONS} from '../file-structure.mjs';
import {zip,zipOffsets,ooxml,ooxmlEntries,contentTypesXml,relationshipsXml,OFFICE_DOCUMENT_TYPE,pdf,pdfIncremental,pdfXrefStream} from './fixtures.mjs';
import {REVIEW_PROBES} from './review-probes.mjs';
const refused=(bytes,format,reason,label)=>{assert.deepEqual(structureCheck(bytes,format),{valid:false,reason},label);assert.equal(structurallyValid(bytes,format),false,label);};
test('valid minimal packages of every canonical format pass, stored or deflated',()=>{
 for(const format of ['docx','xlsx','pptx']){assert.equal(structurallyValid(ooxml(format),format),true,format);assert.equal(structurallyValid(zip(ooxmlEntries(format),{method:0}),format),true,`${format} stored`);}
 assert.equal(structurallyValid(zip({'a.txt':'a','dir/b.txt':'b'}),'zip'),true);assert.equal(structurallyValid(pdf(),'pdf'),true);assert.equal(structurallyValid(Buffer.from('text ✓\n'),'txt'),true);
 assert.deepEqual([...readZip(zip({'a.txt':'hello'})).entries()].map(([k,v])=>[k,v.toString()]),[['a.txt','hello']]);
 assert.deepEqual(structureCheck(pdf(),'pdf'),{valid:true});
});
test('a ZIP signature alone, or any corrupt archive, is not a usable package',()=>{
 const prefix=Buffer.from('PK\x03\x04rest','latin1');
 for(const format of ['docx','xlsx','pptx','zip'])assert.equal(structurallyValid(prefix,format),false,`${format} prefix bytes`);
 const stored=zip(ooxmlEntries('docx'),{method:0}),flipped=Buffer.from(stored);flipped[stored.indexOf('<w:body/>')+3]^=0x20;
 assert.equal(structurallyValid(flipped,'docx'),false,'CRC-32 mismatch in a stored entry');
 const truncated=ooxml('docx').subarray(0,-10);assert.equal(structurallyValid(truncated,'docx'),false,'no end of central directory');
 const trailing=Buffer.concat([ooxml('docx'),Buffer.from('junk')]);assert.equal(structurallyValid(trailing,'docx'),false,'bytes after the central directory');
 assert.equal(structurallyValid(zip({'../evil.txt':'x'}),'zip'),false,'path traversal entry');assert.equal(structurallyValid(zip({'/abs.txt':'x'}),'zip'),false,'absolute entry');
 const encrypted=zip({'a.txt':'x'});encrypted.writeUInt16LE(1,6);encrypted.writeUInt16LE(1,encrypted.length-22-46-5+8);assert.equal(structurallyValid(encrypted,'zip'),false,'encrypted entry');
});
test('OOXML needs content types, the officeDocument relationship and the claimed main part; macro packages refuse',()=>{
 assert.equal(structurallyValid(zip({'a.txt':'x'}),'docx'),false,'plain zip');
 assert.equal(structurallyValid(ooxml('xlsx'),'docx'),false,'workbook claimed as document');assert.equal(structurallyValid(ooxml('docx'),'pptx'),false,'document claimed as presentation');
 const {['_rels/.rels']:_,...noRels}=ooxmlEntries('docx');assert.equal(structurallyValid(zip(noRels),'docx'),false,'no package relationship');
 assert.equal(structurallyValid(ooxml('docx',{mainXml:'<html/>'}),'docx'),false,'wrong root element');
 assert.equal(structurallyValid(ooxml('docx',{mainXml:'<w:document xmlns:w="urn:other"/>'}),'docx'),false,'wrong namespace');
 assert.equal(structurallyValid(ooxml('docx',{mainType:'application/vnd.ms-word.document.macroEnabled.main+xml'}),'docx'),false,'macro-enabled content type');
 assert.equal(structurallyValid(zip({...ooxmlEntries('docx'),'word/vbaProject.bin':'x'}),'docx'),false,'VBA project part');
 const entries=ooxmlEntries('docx'),{['word/document.xml']:__,...noMain}=entries;assert.equal(structurallyValid(zip(noMain),'docx'),false,'missing main part');
});
test('PDF needs a header and a final startxref pointing at a cross-reference section; text must be strict UTF-8 without NUL',()=>{
 assert.equal(structurallyValid(Buffer.from('%PDF-1.7\n%%EOF\n'),'pdf'),false);assert.equal(structurallyValid(Buffer.from('%PDF-1.7\nstartxref\n999\n%%EOF\n'),'pdf'),false);
 assert.equal(structurallyValid(Buffer.from('<html>%PDF-1.7</html>'),'pdf'),false);assert.equal(structurallyValid(pdf().subarray(0,-8),'pdf'),false);
 assert.equal(structurallyValid(Buffer.from([0xff,0xfe]),'txt'),false);assert.equal(structurallyValid(Buffer.from('a\0b'),'txt'),false);
 assert.equal(structurallyValid(Buffer.from('x'),'exe'),false);
});
test('dot corrected review H1/H2: every malformed probe is refused with its closed reason',()=>{
 for(const probe of REVIEW_PROBES){assert.ok(STRUCTURE_REASONS.includes(probe.reason));refused(probe.bytes(),probe.format,probe.reason,probe.id);}
 const wrapped=format=>edit=>{const bytes=ooxml(format);edit(bytes,zipOffsets(bytes).local);return bytes;};
 for(const format of ['docx','xlsx','pptx']){
  refused(wrapped(format)((b,at)=>b.writeUInt16LE(b.readUInt16LE(at+6)|1,at+6)),format,'ZIP_LOCAL_HEADER',`${format} local encryption flag`);
  refused(wrapped(format)((b,at)=>b.writeUInt32LE(0,at+14)),format,'ZIP_LOCAL_HEADER',`${format} local CRC zeroed`);
  refused(wrapped(format)((b,at)=>{b.writeUInt32LE(0,at+18);b.writeUInt32LE(0,at+22);}),format,'ZIP_LOCAL_HEADER',`${format} local sizes zeroed`);}
});
test('ZIP: local headers, data descriptors and entry layout must agree with the central directory',()=>{
 for(const descriptor of ['signed','unsigned'])for(const method of [0,8]){
  assert.equal(structurallyValid(zip(ooxmlEntries('docx'),{descriptor,method}),'docx'),true,`${descriptor} descriptor, method ${method}`);}
 const described=zip({'a.txt':'synthetic member','b.txt':'second'},{descriptor:'signed'}),{local}=zipOffsets(described);
 const descriptorAt=local+30+5+described.readUInt32LE(zipOffsets(described).central+20);
 const wrongDescriptor=Buffer.from(described);wrongDescriptor.writeUInt32LE(0,descriptorAt+4);refused(wrongDescriptor,'zip','ZIP_DATA_DESCRIPTOR','descriptor CRC differs from the central record');
 const localValues=Buffer.from(described);localValues.writeUInt32LE(1,local+14);refused(localValues,'zip','ZIP_LOCAL_HEADER','descriptor flag with a local CRC neither zero nor central');
 const noDescriptor=zip({'a.txt':'synthetic member'});const flagOnly=Buffer.from(noDescriptor),c=zipOffsets(flagOnly);
 flagOnly.writeUInt16LE(8,c.local+6);flagOnly.writeUInt16LE(8,c.central+8);refused(flagOnly,'zip','ZIP_DATA_DESCRIPTOR','descriptor flag set but no descriptor follows the data');
 const utf8Local=Buffer.from(noDescriptor);utf8Local.writeUInt16LE(0x800,c.local+6);refused(utf8Local,'zip','ZIP_LOCAL_HEADER','any local flag difference');
 const methodLocal=Buffer.from(noDescriptor);methodLocal.writeUInt16LE(0,c.local+8);refused(methodLocal,'zip','ZIP_LOCAL_HEADER','local method differs');
 const two=zip({'a.txt':'first','b.txt':'second'}),gap=Buffer.concat([Buffer.from('HIDDEN'),two]);
 for(let n=0;n<2;n++){const o=zipOffsets(gap.subarray(6),n);gap.writeUInt32LE(o.local+6,6+o.central+42);}gap.writeUInt32LE(gap.readUInt32LE(gap.length-6)+6,gap.length-6);
 refused(gap,'zip','ZIP_ENTRY_LAYOUT','bytes hidden before the first entry');
 const shared=Buffer.from(two),second=zipOffsets(shared,1);shared.writeUInt32LE(0,second.central+42);refused(shared,'zip','ZIP_LOCAL_HEADER','second central record reuses the first local entry');
});
test('ZIP: bomb bounds and member data are enforced before and during inflation',()=>{
 const set=(bytes,field,value)=>{const c=zipOffsets(bytes);bytes.writeUInt32LE(value,c.central+{csize:20,usize:24}[field]);bytes.writeUInt32LE(value,c.local+{csize:18,usize:22}[field]);return bytes;};
 refused(set(zip({'a.txt':'x'.repeat(1000)}),'usize',129*1024*1024),'zip','ZIP_SIZE_LIMIT','declared total over 128 MiB');
 const small=zip({'a.txt':'x'.repeat(4000)}),csize=small.readUInt32LE(zipOffsets(small).central+20);refused(set(small,'usize',csize*1033),'zip','ZIP_SIZE_LIMIT','declared ratio over the deflate maximum');
 refused(set(zip({'a.txt':'x'.repeat(100000)}),'usize',1000),'zip','ZIP_ENTRY_DATA','inflation beyond the declared size stops at the bound');
});
test('ZIP: entry names must be portable, relative and unique',()=>{
 for(const name of ['C:/escape.txt','c:escape.txt','a\\b.txt','../x','a/../b','./a','/abs','a//b','nul\0.txt','tab\t.txt','stream.txt:alt','dup.txt|DUP.TXT'])
  refused(zip(Object.fromEntries(name.split('|').map((n,i)=>[n,`v${i}`]))),'zip','ZIP_ENTRY_NAME',JSON.stringify(name));
 refused(zip({'café.txt':'x'}),'zip','ZIP_ENTRY_NAME','non-ASCII name without the UTF-8 flag');
 assert.equal(structurallyValid(zip({'café.txt':'x'},{utf8:true}),'zip'),true,'non-ASCII name with the UTF-8 flag');
 assert.equal(structurallyValid(zip({'dir/':'','dir/a.txt':'x'}),'zip'),true,'empty directory entry');
 refused(zip({'dir/':'data'}),'zip','ZIP_ENTRY_NAME','directory entry with data');
});
test('OOXML parts are parsed as namespaced XML: comments, DTDs, wrong encodings and incoherent relationships refuse',()=>{
 const docx=over=>zip({...ooxmlEntries('docx'),...over});
 refused(docx({'word/document.xml':'<!DOCTYPE w:document [<!ENTITY x "y">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'}),'docx','XML_DOCTYPE','DTD in the main part');
 refused(docx({'_rels/.rels':`<?xml version="1.0" encoding="ISO-8859-1"?>${relationshipsXml('').slice(55)}`}),'docx','XML_ENCODING','declared non-UTF-8 encoding');
 refused(docx({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><x:body/></w:document>'}),'docx','XML_MALFORMED','unbound prefix');
 refused(docx({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body></w:document>'}),'docx','XML_MALFORMED','mismatched end tag');
 refused(docx({'word/document.xml':'<!-- <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/> --><other/>'}),'docx','OPC_MAIN_PART','root inside a comment does not count');
 refused(docx({'word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'}),'docx','XML_MALFORMED','two roots');
 const rel=(id,target,mode='')=>`<Relationship Id="${id}" Type="${OFFICE_DOCUMENT_TYPE}" Target="${target}"${mode}/>`;
 refused(docx({'_rels/.rels':relationshipsXml(rel('rId1','word/document.xml')+rel('rId2','word/document.xml'))}),'docx','OPC_RELATIONSHIPS','two officeDocument relationships');
 refused(docx({'_rels/.rels':relationshipsXml(rel('rId1','https://example.com/doc.xml',' TargetMode="External"'))}),'docx','OPC_RELATIONSHIPS','external officeDocument target');
 refused(docx({'_rels/.rels':relationshipsXml(`<Relationship Type="${OFFICE_DOCUMENT_TYPE}" Target="word/document.xml"/>`)}),'docx','OPC_RELATIONSHIPS','relationship without Id');
 refused(docx({'_rels/.rels':relationshipsXml(`text${rel('rId1','word/document.xml')}`)}),'docx','XML_MALFORMED','text in an element-only relationships root');
 assert.equal(structurallyValid(docx({'_rels/.rels':relationshipsXml(rel('rId1','/word/document.xml'))}),'docx'),true,'absolute internal target');
 const types=inner=>docx({'[Content_Types].xml':contentTypesXml(inner)});
 const main='<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',defaults='<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
 refused(types(defaults+main+main),'docx','OPC_CONTENT_TYPES','duplicate override');
 refused(types(defaults+main+'<Unknown/>'),'docx','OPC_CONTENT_TYPES','unknown content-types child');
 refused(types(main),'docx','OPC_CONTENT_TYPES','a part without a content type');
 refused(docx({'[Content_Types].xml':`<Types>${defaults}${main}</Types>`}),'docx','OPC_CONTENT_TYPES','content types without namespace');
 const partRels=xml=>docx({'word/_rels/document.xml.rels':xml,'word/styles.xml':'<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>'});
 const styles=target=>relationshipsXml(`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="${target}"/>`);
 assert.equal(structurallyValid(partRels(styles('styles.xml')),'docx'),true,'main-part relationships with an existing target');
 refused(partRels(styles('missing.xml')),'docx','OPC_PART_RELATIONSHIPS','main-part relationship to a missing part');
 refused(partRels('<Relationships xmlns="urn:wrong"/>'),'docx','OPC_PART_RELATIONSHIPS','main-part relationships namespace');
 refused(partRels(`${styles('styles.xml').slice(0,-16)}`),'docx','XML_MALFORMED','unterminated main-part relationships');
});
test('PDF: cross-reference sections, trailer and catalog must be coherent; xref streams and object streams are read',()=>{
 for(const [label,bytes] of [['incremental update',pdfIncremental()],['xref stream',pdfXrefStream()],['PNG predictor',pdfXrefStream({predictor:true})],['catalog in object stream',pdfXrefStream({catalogInObjectStream:true})],['both',pdfXrefStream({predictor:true,catalogInObjectStream:true})]])
  assert.deepEqual(structureCheck(bytes,'pdf'),{valid:true},label);
 const text=pdf().toString('latin1'),edit=(from,to)=>Buffer.from(text.replace(from,to),'latin1');
 const firstEntry=/\n(\d{10}) 00000 n \n/u.exec(text)[1];
 refused(edit(`${firstEntry} 00000 n`,`${String(Number(firstEntry)+1).padStart(10,'0')} 00000 n`),'pdf','PDF_XREF','in-use entry off by one byte');
 refused(edit('2 0 obj','7 0 obj'),'pdf','PDF_XREF','entry points at a different object number');
 refused(edit(' 00000 n \n',' 00000 n\n'),'pdf','PDF_XREF','19-byte entry');
 refused(edit('0000000000 65535 f ','0000000009 00000 n '),'pdf','PDF_XREF','object 0 in use');
 refused(edit('/Size 4','/Size 3'),'pdf','PDF_XREF','object number at or above /Size');
 refused(edit('/Size 4 /Root 1 0 R','/Size 4'),'pdf','PDF_TRAILER','no /Root');
 refused(edit('/Root 1 0 R','/Root 2 0 R'),'pdf','PDF_CATALOG','/Root is not a catalog');
 refused(edit('/Type /Catalog /Pages 2 0 R','/Type /Catalog /Pagez 2 0 R'),'pdf','PDF_CATALOG','catalog without /Pages');
 refused(edit('/Type /Catalog /Pages 2 0 R','/Type /Catalog /Pages 2 5 R'),'pdf','PDF_PAGE_TREE','/Pages generation differs from the cross-reference');
 refused(edit('/Type /Catalog /Pages 2 0 R','/Type /Catalog /Pages 2 1 R'),'pdf','PDF_PAGE_TREE','review probe: /Pages 2 1 R where the xref defines object 2 generation 0');
 assert.deepEqual(structureCheck(pdfXrefStream({pagesInObjectStream:true}),'pdf'),{valid:true},'page tree root compressed in an object stream');
 refused(pdfXrefStream({pagesInObjectStream:true,pagesRef:'2 1 R'}),'pdf','PDF_PAGE_TREE','compressed /Pages referenced with a nonzero generation');
 refused(pdfXrefStream({catalogInObjectStream:true,pagesRef:'2 1 R'}),'pdf','PDF_PAGE_TREE','compressed catalog naming /Pages with the wrong generation');
 refused(edit('/Type /Catalog /Pages 2 0 R','/Type /Catalog /Pages 3 0 R'),'pdf','PDF_PAGE_TREE','/Pages names a page leaf, not a page tree');
 refused(edit('/Type /Catalog /Pages 2 0 R','/Type /Catalog /Pages 1 0 R'),'pdf','PDF_PAGE_TREE','/Pages names the catalog itself');
 refused(edit('/Type /Pages /Kids [3 0 R]','/Type /Pagez /Kids [3 0 R]'),'pdf','PDF_PAGE_TREE','page tree root is not /Type /Pages');
 refused(edit('/Kids [3 0 R] /Count 1','/Kids [3 0 R] /Count 2'),'pdf','PDF_PAGE_TREE','/Count disagrees with the leaves');
 refused(edit('/Kids [3 0 R]','/Kids  3 0 R '),'pdf','PDF_PAGE_TREE','/Kids is not an array');
 refused(edit('/Kids [3 0 R]','/Kids [2 0 R]'),'pdf','PDF_PAGE_TREE','page tree node lists itself');
 refused(edit('/Type /Page /Parent 2 0 R','/Type /Page /Parent 1 0 R'),'pdf','PDF_PAGE_TREE','leaf /Parent names another node');
 refused(edit('/Type /Page /Parent 2 0 R','/Type /Page /Parenz 2 0 R'),'pdf','PDF_PAGE_TREE','leaf without /Parent');
 refused(edit('trailer\n<<','trailer\n<< /Root 1 0 R'),'pdf','PDF_OBJECT','duplicate trailer key');
 const at=/startxref\n(\d+)/u.exec(text)[1];refused(edit('/Root 1 0 R >>',`/Root 1 0 R /Prev ${at} >>`),'pdf','PDF_LIMIT','/Prev loop');
 const xs=pdfXrefStream().toString('latin1'),streamAt=xs.indexOf('stream\n',xs.indexOf('/Type /XRef'))+7,broken=Buffer.from(xs,'latin1');broken[streamAt+3]^=0xff;
 refused(broken,'pdf','PDF_XREF_STREAM','corrupt cross-reference stream data');
 refused(Buffer.from(xs.replace('/Type /XRef','/Type /XRaf'),'latin1'),'pdf','PDF_XREF','stream object that is not /Type /XRef');
 refused(Buffer.from('%PDF-1.7\n%comment xref\nstartxref\n10\n%%EOF\n','latin1'),'pdf','PDF_XREF','xref keyword only inside a comment');
});
