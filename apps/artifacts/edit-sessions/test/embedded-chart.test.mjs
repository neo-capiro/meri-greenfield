import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficeEdit} from '../inspect-office.mjs';
import {chart} from './embedded-chart-fixture.mjs';
import {ooxmlEntries,zip,relationshipsXml} from '../../structure/test/fixtures.mjs';
import {readZip} from '../../structure/zip.mjs';
import {preservationBytes} from './preservation-fixture.mjs';
const packageType='http://schemas.openxmlformats.org/officeDocument/2006/relationships/package';
test('workbook-bearing PPTX and plain PPTX pass the same structural edit admission',()=>{
 const bytes=zip(chart()),inspection=inspectOfficeEdit(bytes,'pptx');
 assert.equal(inspection.members.includes('ppt/embeddings/data.xlsx'),true);
 assert.equal(inspection.details.editable,true);
 const plain=zip(ooxmlEntries('pptx'));
 assert.equal(inspectOfficeEdit(plain,'pptx').format,'pptx');
});
test('native chart data workbook is validated without changing exact presentation bytes',()=>{
 const bytes=zip(chart()),before=Buffer.from(bytes),result=inspectOfficeEdit(bytes,'pptx');
 assert.deepEqual(bytes,before);assert.ok(result.members.includes('ppt/embeddings/data.xlsx'));assert.equal(result.nativeOpened,false);
});
test('two distinct chart workbooks retain exact nested bytes, values, caches and styles',()=>{
 const bytes=preservationBytes('pptx','after'),before=Buffer.from(bytes),parts=readZip(bytes);
 assert.equal(inspectOfficeEdit(bytes,'pptx').details.editable,true);assert.deepEqual(bytes,before);
 for(const [part,value] of [['data.xlsx',9],['data2.xlsx',11]]){
  const book=readZip(parts.get('ppt/embeddings/'+part)),sheet=book.get('xl/worksheets/sheet1.xml').toString();
  assert.match(sheet,new RegExp('<v>'+value+'</v>'));assert.match(sheet,new RegExp('<f>B2\\*2</f><v>'+value*2+'</v>'));
  assert.match(book.get('xl/styles.xml').toString(),/formatCode="&quot;\$&quot;#,##0.00"/u);
 }
});
for(const change of ['macro','nested','external-data','invalid-package','unreferenced','wrong-relation','wrong-source','wrong-chart-root']){
 test('embedded chart refuses '+change,()=>{
  const book=ooxmlEntries('xlsx');
  if(change==='macro')book['xl/vbaProject.bin']='macro';
  if(change==='nested')book['xl/embeddings/inner.xml']='<data/>';
  if(change==='external-data')book['xl/_rels/workbook.xml.rels']=relationshipsXml('<Relationship Id="rId2" Type="'+packageType+'" Target="https://external.invalid/data" TargetMode="External"/>');
  const entries=chart(book);
  if(change==='invalid-package')entries['ppt/embeddings/data.xlsx']=zip(ooxmlEntries('docx'));
  if(change==='unreferenced')delete entries['ppt/charts/_rels/chart1.xml.rels'];
  if(change==='wrong-relation')entries['ppt/charts/_rels/chart1.xml.rels']=entries['ppt/charts/_rels/chart1.xml.rels'].replace('/package','/oleObject');
  if(change==='wrong-source'){entries['ppt/_rels/presentation.xml.rels']=entries['ppt/charts/_rels/chart1.xml.rels'].replace('../embeddings','embeddings');delete entries['ppt/charts/_rels/chart1.xml.rels'];}
  if(change==='wrong-chart-root')entries['ppt/charts/chart1.xml']='<other/>';
  assert.throws(()=>inspectOfficeEdit(zip(entries),'pptx'),{code:'EDITOR_STRUCTURE_REFUSED'});
 });
}
test('nested workbook and outer presentation share the entry budget',()=>{
 const book=ooxmlEntries('xlsx');for(let n=0;n<4991;n++)book['xl/part'+n+'.xml']='<data/>';
 assert.throws(()=>inspectOfficeEdit(zip(chart(book)),'pptx'),{code:'EDITOR_STRUCTURE_REFUSED'});
});

for(const change of ['missing-id','unqualified-id','wrong-id-namespace','duplicate-data','nested-data','missing-data','wrong-id','extra-package','workbook-type','chart-type']){
 test('chart data admission refuses '+change,()=>{
  const entries=chart(),part='ppt/charts/chart1.xml',rels='ppt/charts/_rels/chart1.xml.rels';
  if(change==='missing-id')entries[part]=entries[part].replace(' r:id="rId1"','');
  if(change==='unqualified-id')entries[part]=entries[part].replace('r:id=','id=');
  if(change==='wrong-id-namespace')entries[part]=entries[part].replace('http://schemas.openxmlformats.org/officeDocument/2006/relationships','urn:untrusted');
  if(change==='duplicate-data')entries[part]=entries[part].replace('</c:chartSpace>','<c:externalData r:id="rId1"/></c:chartSpace>');
  if(change==='nested-data')entries[part]=entries[part].replace('<c:externalData','<c:chart><c:externalData').replace('</c:externalData>','</c:externalData></c:chart>');
  if(change==='missing-data')entries[part]=entries[part].replace(/<c:externalData.*<\/c:externalData>/u,'<!-- no chart data -->');
  if(change==='wrong-id')entries[part]=entries[part].replace('rId1','rId2');
  if(change==='extra-package')entries[rels]=entries[rels].replace('</Relationships>','<Relationship Id="rId2" Type="'+packageType+'" Target="../embeddings/data.xlsx"/></Relationships>');
  if(change==='workbook-type')entries['[Content_Types].xml']=entries['[Content_Types].xml'].replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream');
  if(change==='chart-type')entries['[Content_Types].xml']=entries['[Content_Types].xml'].replace('application/vnd.openxmlformats-officedocument.drawingml.chart+xml','application/xml');
  assert.throws(()=>inspectOfficeEdit(zip(entries),'pptx'),{code:'EDITOR_STRUCTURE_REFUSED'});
 });
}

test('strict OOXML chart and relationship namespaces retain the same admission',()=>{
 const entries=chart();
 entries['ppt/charts/chart1.xml']=entries['ppt/charts/chart1.xml'].replace('http://schemas.openxmlformats.org/drawingml/2006/chart','http://purl.oclc.org/ooxml/drawingml/chart')
  .replace('http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships');
 entries['ppt/charts/_rels/chart1.xml.rels']=entries['ppt/charts/_rels/chart1.xml.rels'].replace('http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships');
 assert.equal(inspectOfficeEdit(zip(entries),'pptx').details.editable,true);
});

for(const change of ['dtd','activeX','externalLinks','ole-binary','zip-traversal'])test('embedded workbook still refuses '+change,()=>{
 const book=ooxmlEntries('xlsx');
 if(change==='dtd')book['xl/workbook.xml']=book['xl/workbook.xml'].replace('<workbook','<!DOCTYPE workbook [<!ENTITY x "unsafe">]><workbook');
 if(change==='activeX')book['xl/activeX/control.xml']='<control/>';
 if(change==='externalLinks')book['xl/externalLinks/link.xml']='<link/>';
 if(change==='ole-binary')book['xl/embeddings/oleObject.bin']='unsafe';
 if(change==='zip-traversal')book['../outside.xml']='<outside/>';
 assert.throws(()=>inspectOfficeEdit(zip(chart(book)),'pptx'),{code:'EDITOR_STRUCTURE_REFUSED'});
});

for(const kind of ['oleObject','control','vbaProject','externalLink','xlMacrosheet'])test('renamed embedded '+kind+' relationship cannot bypass path checks',()=>{
 const book=ooxmlEntries('xlsx');book['xl/renamed.xml']='<payload/>';
 book['xl/_rels/workbook.xml.rels']=relationshipsXml('<Relationship Id="unsafe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/'+kind+'" Target="renamed.xml"/>');
 assert.throws(()=>inspectOfficeEdit(zip(chart(book)),'pptx'),{code:'EDITOR_STRUCTURE_REFUSED'});
});
for(const contentType of ['application/vnd.ms-office.activeX+xml','application/vnd.ms-office.vbaProject','application/vnd.ms-office.oleObject','application/vnd.ms-excel.macrosheet+xml']){
 test('renamed active embedded content type refuses '+contentType,()=>{
  const book=ooxmlEntries('xlsx');book['xl/renamed.xml']='<payload/>';
  book['[Content_Types].xml']=book['[Content_Types].xml'].replace('</Types>','<Override PartName="/xl/renamed.xml" ContentType="'+contentType+'"/></Types>');
  assert.throws(()=>inspectOfficeEdit(zip(chart(book)),'pptx'),{code:'EDITOR_STRUCTURE_REFUSED'});
 });
}
