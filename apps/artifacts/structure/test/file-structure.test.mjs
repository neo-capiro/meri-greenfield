import test from 'node:test';import assert from 'node:assert/strict';
import {structurallyValid,readZip} from '../file-structure.mjs';
import {zip,ooxml,ooxmlEntries,pdf} from './fixtures.mjs';
test('valid minimal packages of every canonical format pass, stored or deflated',()=>{
 for(const format of ['docx','xlsx','pptx']){assert.equal(structurallyValid(ooxml(format),format),true,format);assert.equal(structurallyValid(zip(ooxmlEntries(format),{method:0}),format),true,`${format} stored`);}
 assert.equal(structurallyValid(zip({'a.txt':'a','dir/b.txt':'b'}),'zip'),true);assert.equal(structurallyValid(pdf(),'pdf'),true);assert.equal(structurallyValid(Buffer.from('text ✓\n'),'txt'),true);
 assert.deepEqual([...readZip(zip({'a.txt':'hello'})).entries()].map(([k,v])=>[k,v.toString()]),[['a.txt','hello']]);
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
