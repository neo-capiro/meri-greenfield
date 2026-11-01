/** The bounded unit editor over synthetic retained packages: outline per format, byte-for-byte preservation of
 * every untouched part and span across an applied proposal, determinism, and the closed refusals. Structure
 * only; no engine, rendering or recalculation claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readZip} from '../../structure/zip.mjs';
import {inspectOfficeEdit} from '../../edit-sessions/inspect-office.mjs';
import {officeOutline,applyOfficeOperations} from '../index.mjs';
import {docx,xlsx,pptx,docxEntries,xlsxEntries,pptxEntries} from './fixtures.mjs';
const units=outline=>Object.fromEntries(outline.units.map(u=>[u.unit,u]));
const replace=(unit,before,after)=>({unit,kind:'replace_text',before,after});
/** Every part other than `changed` is byte-identical; the changed part differs only inside the expected spans. */
function assertPreserved(before,after,format,changed){
 const a=readZip(before),b=readZip(after);
 assert.deepEqual([...b.keys()],[...a.keys()],'entry order and set are kept');
 for(const [name,bytes] of a)if(!changed.includes(name))assert.ok(bytes.equals(b.get(name)),`${name} is byte-identical`);
 assert.equal(inspectOfficeEdit(after,format).format,format,'the rewritten package passes the edit inspector');
 return {a,b};
}
test('docx: outline addresses every paragraph in document order, renders tabs, and marks a hyperlink paragraph read-only',()=>{
 const o=officeOutline(docx(),'docx'),u=units(o);
 assert.equal(o.truncated,false);assert.equal(o.units.length,5);
 assert.equal(u['p:1'].text,'Quarterly report — Ω');assert.equal(u['p:1'].editable,true);
 assert.equal(u['p:2'].text,'Manual edit: revenue\tgrew & held');
 assert.equal(u['p:3'].text,'See the site');assert.equal(u['p:3'].editable,false);
 assert.equal(u['p:4'].text,'Cell text');assert.equal(u['p:4'].kind,'paragraph');
 assert.equal(u['p:5'].text,'Section paragraph');
});
test('docx: apply keeps every other part and every other paragraph byte for byte, keeps pPr/rPr and the manual edit',()=>{
 const before=docx(),after=applyOfficeOperations(before,'docx',[replace('p:1','Quarterly report — Ω','Quarterly report — Ω (final)'),{unit:'p:4',kind:'insert_after',before:null,after:'Added\tline'}]);
 const {a,b}=assertPreserved(before,after,'docx',['word/document.xml']);
 const was=a.get('word/document.xml').toString('utf8'),now=b.get('word/document.xml').toString('utf8');
 // The manual paragraph (with its italic run and tab) and the hyperlink paragraph are untouched spans.
 for(const span of ['<w:p><w:r><w:t xml:space="preserve">Manual edit: </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>revenue</w:t></w:r><w:r><w:tab/><w:t>grew &amp; held</w:t></w:r></w:p>','<w:hyperlink r:id="link1">','<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body>'])assert.ok(now.includes(span),span);
 assert.ok(now.includes('<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Quarterly report — Ω (final)</w:t></w:r></w:p>'),'style and run properties survive the replacement');
 assert.ok(now.includes('<w:bookmarkEnd w:id="0"/></w:p><w:p><w:r><w:t xml:space="preserve">Added</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">line</w:t></w:r></w:p></w:tc>'),'the inserted paragraph follows its anchor inside the cell');
 assert.equal(was.length+ ' (final)'.length+'<w:p><w:r><w:t xml:space="preserve">Added</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t xml:space="preserve">line</w:t></w:r></w:p>'.length+' xml:space="preserve"'.length,now.length,'only the two spans changed');
 const again=officeOutline(after,'docx');assert.equal(units(again)['p:5'].text,'Added\tline');assert.equal(again.units.length,6);
});
test('docx: delete removes one paragraph but never a section break or the last cell paragraph; mismatched before refuses',()=>{
 const before=docx();
 const deleted=applyOfficeOperations(before,'docx',[{unit:'p:2',kind:'delete',before:'Manual edit: revenue\tgrew & held',after:null}]);
 assert.equal(officeOutline(deleted,'docx').units.length,4);assertPreserved(before,deleted,'docx',['word/document.xml']);
 assert.throws(()=>applyOfficeOperations(before,'docx',[{unit:'p:5',kind:'delete',before:'Section paragraph',after:null}]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED',unit:'p:5'});
 assert.throws(()=>applyOfficeOperations(before,'docx',[{unit:'p:4',kind:'delete',before:'Cell text',after:null}]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED',unit:'p:4'});
 assert.throws(()=>applyOfficeOperations(before,'docx',[replace('p:1','Old text','New')]),{code:'OFFICE_EDIT_UNIT_CHANGED',unit:'p:1'});
 assert.throws(()=>applyOfficeOperations(before,'docx',[replace('p:3','See the site','Changed link')]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED',unit:'p:3'});
 assert.throws(()=>applyOfficeOperations(before,'docx',[replace('p:9','x','y')]),{code:'OFFICE_EDIT_UNIT_UNKNOWN',unit:'p:9'});
 assert.throws(()=>applyOfficeOperations(before,'docx',[replace('p:1','Quarterly report — Ω','A'),replace('p:1','Quarterly report — Ω','B')]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED'});
});
test('xlsx: outline resolves shared and inline strings, keeps formula cells read-only, addresses every sheet',()=>{
 const u=units(officeOutline(xlsx(),'xlsx'));
 assert.deepEqual(Object.keys(u),['Data!A1','Data!B1','Data!A2','Data!B2','Data!C2','Data!D2','Notes!A1']);
 assert.equal(u['Data!A1'].text,'Revenue');assert.equal(u['Data!A2'].text,'Units sold');assert.equal(u['Data!B1'].text,'1250.5');
 assert.equal(u['Data!C2'].text,'8753.5');assert.equal(u['Data!C2'].editable,false);assert.equal(u['Data!D2'].text,'');assert.equal(u['Notes!A1'].text,'Manual note — keep');
});
test('xlsx: apply rewrites only the touched cells, keeps styles, numbers stay numbers, strings become inline, formulas refuse',()=>{
 const before=xlsx(),after=applyOfficeOperations(before,'xlsx',[replace('Data!B2','7','9'),replace('Data!D2','','Q4 — note'),replace('Data!A1','Revenue','Net revenue')]);
 const {b}=assertPreserved(before,after,'xlsx',['xl/worksheets/sheet1.xml']);
 const now=b.get('xl/worksheets/sheet1.xml').toString('utf8');
 assert.ok(now.includes('<c r="B2"><v>9</v></c>'));assert.ok(now.includes('<c r="D2" s="2" t="inlineStr"><is><t xml:space="preserve">Q4 — note</t></is></c>'));
 assert.ok(now.includes('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Net revenue</t></is></c>'));
 assert.ok(now.includes('<c r="B1" s="1"><v>1250.5</v></c>'),'the manually typed number keeps its style and value');
 assert.ok(now.includes('<c r="C2" s="1"><f>B1*B2</f><v>8753.5</v></c>'),'the formula and its cache are untouched');
 const u=units(officeOutline(after,'xlsx'));assert.equal(u['Data!B2'].text,'9');assert.equal(u['Data!D2'].text,'Q4 — note');
 assert.throws(()=>applyOfficeOperations(before,'xlsx',[replace('Data!C2','8753.5','1')]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED',unit:'Data!C2'});
 assert.throws(()=>applyOfficeOperations(before,'xlsx',[{unit:'Data!B2',kind:'delete',before:'7',after:null}]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED'});
 assert.throws(()=>applyOfficeOperations(before,'xlsx',[replace('Data!Z9','','x')]),{code:'OFFICE_EDIT_UNIT_UNKNOWN'});
});
test('pptx: outline lists text shapes per slide, joins paragraphs, marks field shapes read-only, skips pictures and notes',()=>{
 const o=officeOutline(pptx(),'pptx'),u=units(o);
 assert.deepEqual(Object.keys(u),['slide:1/shape:2','slide:1/shape:3','slide:1/shape:4','slide:2/shape:2']);
 assert.equal(u['slide:1/shape:2'].text,'Agenda');assert.equal(u['slide:1/shape:3'].text,'First point\nManual second point');
 assert.equal(u['slide:1/shape:4'].editable,false);assert.equal(u['slide:2/shape:2'].text,'Thank you');
});
test('pptx: apply rewrites only the touched text body, keeps bodyPr/lstStyle/pPr/rPr and every other slide and part',()=>{
 const before=pptx(),after=applyOfficeOperations(before,'pptx',[replace('slide:1/shape:2','Agenda','Agenda (revised)'),replace('slide:2/shape:2','Thank you','Thank you\nQuestions?')]);
 const {b}=assertPreserved(before,after,'pptx',['ppt/slides/slide1.xml','ppt/slides/slide2.xml']);
 const one=b.get('ppt/slides/slide1.xml').toString('utf8'),two=b.get('ppt/slides/slide2.xml').toString('utf8');
 assert.ok(one.includes('<p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" b="1"/><a:t>Agenda (revised)</a:t></a:r></a:p></p:txBody>'));
 assert.ok(one.includes('<a:r><a:rPr lang="en-US" b="1"/><a:t>Manual </a:t></a:r>'),'the manual bold run of the other shape is untouched');
 assert.ok(two.includes('<a:p><a:r><a:rPr lang="en-US"/><a:t>Thank you</a:t></a:r></a:p><a:p><a:r><a:rPr lang="en-US"/><a:t>Questions?</a:t></a:r></a:p>'));
 assert.ok(two.includes('<p:pic>'));
 assert.throws(()=>applyOfficeOperations(before,'pptx',[replace('slide:1/shape:4','1','2')]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED'});
 assert.throws(()=>applyOfficeOperations(before,'pptx',[{unit:'slide:1/shape:2',kind:'insert_after',before:null,after:'x'}]),{code:'OFFICE_EDIT_UNIT_UNSUPPORTED'});
});
test('apply is deterministic and refuses a package that is not the claimed format',()=>{
 for(const [format,build] of [['docx',docx],['xlsx',xlsx],['pptx',pptx]]){
  const op=format==='docx'?replace('p:1','Quarterly report — Ω','Same'):format==='xlsx'?replace('Data!B2','7','8'):replace('slide:2/shape:2','Thank you','Same');
  assert.ok(applyOfficeOperations(build(),format,[op]).equals(applyOfficeOperations(build(),format,[op])));
 }
 assert.throws(()=>officeOutline(docx(),'xlsx'),{code:'OFFICE_EDIT_SOURCE'});
 assert.throws(()=>applyOfficeOperations(docx(),'docx',[]),{code:'OFFICE_EDIT_OPERATIONS'});
 void docxEntries;void xlsxEntries;void pptxEntries;
});
