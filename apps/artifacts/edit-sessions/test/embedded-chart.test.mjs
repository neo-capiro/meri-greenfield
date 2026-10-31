import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficeEdit} from '../inspect-office.mjs';
import {officeEditUnavailable,inspectOfficeEditAdmitted} from '../edit-admission.mjs';
import {chart} from './embedded-chart-fixture.mjs';
import {ooxmlEntries,zip,relationshipsXml} from '../../structure/test/fixtures.mjs';
const packageType='http://schemas.openxmlformats.org/officeDocument/2006/relationships/package';
test('workbook-bearing PPTX is structurally inspectable but not admitted for editing',()=>{
 const bytes=zip(chart()),inspection=inspectOfficeEdit(bytes,'pptx');
 assert.equal(inspection.members.includes('ppt/embeddings/data.xlsx'),true);
 assert.equal(officeEditUnavailable(inspection),true);
 assert.throws(()=>inspectOfficeEditAdmitted(bytes,'pptx'),{code:'EDITOR_CODE_ACTION_UNAVAILABLE'});
 const plain=zip(ooxmlEntries('pptx'));
 assert.equal(officeEditUnavailable(inspectOfficeEdit(plain,'pptx')),false);
 assert.equal(inspectOfficeEditAdmitted(plain,'pptx').format,'pptx');
});
test('native chart data workbook is validated without changing exact presentation bytes',()=>{
 const bytes=zip(chart()),before=Buffer.from(bytes),result=inspectOfficeEdit(bytes,'pptx');
 assert.deepEqual(bytes,before);assert.ok(result.members.includes('ppt/embeddings/data.xlsx'));assert.equal(result.nativeOpened,false);
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
