import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadOriginalIdentity,uploadStructureRefusal,uploadHash,UPLOAD_MIME,UPLOAD_LIMITS} from '../policy.mjs';
import {createUploadInspection} from '../extraction.mjs';
import {inspectOfficeEdit} from '../../../artifacts/edit-sessions/inspect-office.mjs';
import {chart} from '../../../artifacts/edit-sessions/test/embedded-chart-fixture.mjs';
import {zip,ooxmlEntries,relationshipsXml} from '../../../artifacts/structure/test/fixtures.mjs';
import {readZip} from '../../../artifacts/structure/zip.mjs';
const rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
/** Identity then structure, as the inspection owner composes them: the first refusal code is thrown. */
const inspectUploadOriginal=(d,b)=>{const file=uploadOriginalIdentity(d,b),code=uploadStructureRefusal(file,b);if(code!==null)throw Object.assign(Error(code),{code});return file;};
const declaration=bytes=>({filename:'original.pptx',mimeType:UPLOAD_MIME.pptx,bytes:bytes.length,sha256:uploadHash(bytes)});
const inspect=entries=>{const bytes=zip(entries);return inspectUploadOriginal(declaration(bytes),bytes);};
const refused={code:'UPLOAD_ACTIVE_CONTENT'};
test('validated chart-linked workbook retains exact upload identity in transitional and strict OOXML',()=>{
 for(const strict of [false,true]){
  const entries=chart();
  if(strict)for(const key of ['ppt/charts/chart1.xml','ppt/charts/_rels/chart1.xml.rels'])entries[key]=entries[key]
   .replaceAll(rel.slice(0,-1),'http://purl.oclc.org/ooxml/officeDocument/relationships')
   .replaceAll('http://schemas.openxmlformats.org/drawingml/2006/chart','http://purl.oclc.org/ooxml/drawingml/chart');
  const bytes=zip(entries),before=Buffer.from(bytes),result=inspectUploadOriginal(declaration(bytes),bytes);
  assert.equal(result.sha256,uploadHash(before));assert.equal(result.bytes,before.length);assert.deepEqual(bytes,before);
 }
});
for(const change of ['orphan','wrong-id','duplicate-package','wrong-type','external-package','ole','unrelated-package','non-chart-source','nested','vbaData','activeX','externalLinks','renamed-active','renamed-vba-type','dtd','traversal']){
 test('upload chart exception still refuses '+change,()=>{
  const book=ooxmlEntries('xlsx');
  if(change==='nested')book['xl/embeddings/a.xlsx']=zip(ooxmlEntries('xlsx'));
  if(change==='vbaData')book['xl/vbaData.xml']='<data/>';
  if(change==='activeX')book['xl/activeX/a.xml']='<data/>';
  if(change==='externalLinks')book['xl/externalLinks/a.xml']='<data/>';
  if(change==='renamed-active'||change==='unrelated-package'){
   book['xl/data.xml']='<data/>';book['xl/_rels/workbook.xml.rels']=relationshipsXml(`<Relationship Id="x" Type="${rel}${change==='renamed-active'?'control':'package'}" Target="data.xml"/>`);
  }
  if(change==='renamed-vba-type')book['[Content_Types].xml']=book['[Content_Types].xml'].replace('application/xml','application/vnd.ms-office.vbaProject');
  if(change==='dtd')book['xl/workbook.xml']='<!DOCTYPE workbook>'+book['xl/workbook.xml'];
  if(change==='traversal')book['../escape.xml']='<data/>';
  const entries=chart(book),part='ppt/charts/chart1.xml',rels='ppt/charts/_rels/chart1.xml.rels';
  if(change==='orphan')delete entries[rels];
  if(change==='wrong-id')entries[part]=entries[part].replace('rId1','rId2');
  if(change==='duplicate-package')entries[rels]=entries[rels].replace('</Relationships>',`<Relationship Id="rId2" Type="${rel}package" Target="../embeddings/data.xlsx"/></Relationships>`);
  if(change==='wrong-type')entries['[Content_Types].xml']=entries['[Content_Types].xml'].replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream');
  if(change==='external-package')entries[rels]=entries[rels].replace('Target="../embeddings/data.xlsx"','Target="https://example.invalid/a.xlsx" TargetMode="External"');
  if(change==='ole')entries[rels]=entries[rels].replace('/package','/oleObject');
  if(change==='non-chart-source'){entries['ppt/_rels/presentation.xml.rels']=entries[rels].replace('../embeddings','embeddings');delete entries[rels];}
  assert.throws(()=>inspect(entries),refused);
 });
}
test('passive HTTPS links in a nested workbook remain inert; credentialed and external-data links refuse',()=>{
 for(const [kind,target,allowed] of [['hyperlink','https://example.invalid/citation',true],['hyperlink','https://user:pass@example.invalid/',false],['externalLink','https://example.invalid/data',false]]){
  const book=ooxmlEntries('xlsx');book['xl/_rels/workbook.xml.rels']=relationshipsXml(`<Relationship Id="link" Type="${rel}${kind}" Target="${target}" TargetMode="External"/>`);
  if(allowed)assert.equal(inspect(chart(book)).format,'pptx');else assert.throws(()=>inspect(chart(book)),refused);
 }
});
test('combined upload entry limit includes the nested workbook',()=>{
 const book=ooxmlEntries('xlsx');for(let i=0;i<4087;i++)book[`xl/data${i}.xml`]='<data/>';
 const bytes=zip(chart(book));assert.equal(inspectOfficeEdit(bytes,'pptx').format,'pptx');
 assert.throws(()=>inspectUploadOriginal(declaration(bytes),bytes),refused);
});
test('nested compression obeys upload ratio 100 even when the outer archive meets the limit',()=>{
 const book=ooxmlEntries('xlsx');book['xl/data.xml']='<data>'+'x'.repeat(8000)+'</data>';
 const bytes=zip(chart(book),{method:0});
 readZip(bytes,{maxRatio:UPLOAD_LIMITS.compressionRatio});assert.equal(inspectOfficeEdit(bytes,'pptx').format,'pptx');
 assert.throws(()=>inspectUploadOriginal(declaration(bytes),bytes),refused);
});
test('64MiB expanded upload budget counts both outer parts and nested workbook contents',()=>{
 // Different pseudo-random 2KiB blocks repeated within each 32KiB chunk keep
 // every archive member below ratio 100 while the original stays below 10MiB.
 let state=1;
 const padding=size=>{const bytes=Buffer.alloc(size),block=Buffer.alloc(2048);
  for(let offset=0;offset<size;offset+=32768){for(let i=0;i<block.length;i++){state^=state<<13;state^=state>>>17;state^=state<<5;block[i]=state&255;}
   for(let repeat=0;repeat<16&&offset+repeat*2048<size;repeat++)block.copy(bytes,offset+repeat*2048);}
  return bytes;};
 const add=(entries,path,size)=>{entries[path]=padding(size);entries['[Content_Types].xml']=entries['[Content_Types].xml'].replace('</Types>','<Default Extension="bin" ContentType="application/octet-stream"/></Types>');};
 const book=ooxmlEntries('xlsx');add(book,'xl/data.bin',33*1024*1024);
 const entries=chart(book);add(entries,'ppt/data.bin',32*1024*1024);
 const bytes=zip(entries);assert.ok(bytes.length<UPLOAD_LIMITS.originalBytes);
 readZip(bytes,{maxRatio:UPLOAD_LIMITS.compressionRatio,maxTotalUncompressed:UPLOAD_LIMITS.expandedBytes});
 readZip(entries['ppt/embeddings/data.xlsx'],{maxRatio:UPLOAD_LIMITS.compressionRatio,maxTotalUncompressed:UPLOAD_LIMITS.expandedBytes});
 assert.equal(inspectOfficeEdit(bytes,'pptx').format,'pptx');
 assert.throws(()=>inspectUploadOriginal(declaration(bytes),bytes),refused);
});
test('structural acceptance still requires clean scanning before extraction',async()=>{
 const bytes=zip(chart()),file=declaration(bytes),at=Date.now(),base={sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:at};
 const tool={name:'synthetic',version:'1',binarySha256:'b'.repeat(64)};let scans=0,extracts=0;
 const run=status=>createUploadInspection({now:()=>at,scanner:{async scan({bytes:input}){scans++;assert.deepEqual(input,bytes);return {...base,status,tool,definitionsSha256:'d'.repeat(64),reason:status==='infected'?'MALWARE_DETECTED':null};}},
  extractor:{async extract({bytes:input}){extracts++;assert.deepEqual(input,bytes);return {...base,status:'available',tool,segments:[],limitations:[]};}}}).inspect(file,bytes,{deadlineMs:at+30000});
 assert.equal((await run('infected')).extraction.status,'unavailable');assert.equal(extracts,0);
 assert.equal((await run('clean')).extraction.status,'available');assert.equal(scans,2);assert.equal(extracts,1);
 const unavailable=await createUploadInspection({now:()=>at}).inspect(file,bytes,{deadlineMs:at+30000});assert.equal(unavailable.scan.status,'unavailable');
});
