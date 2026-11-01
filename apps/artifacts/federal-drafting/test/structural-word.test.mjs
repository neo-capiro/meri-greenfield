import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectUslmWord} from '../structural-word.mjs';
import {decodeXmlTextRun} from '../../../../packages/contracts/federal-workbench/xml-text-runs.mjs';
const ns='http://schemas.gpo.gov/xml/uslm',html='http://www.w3.org/1999/xhtml';
const bill=body=>`<bill xmlns="${ns}" xmlns:h="${html}"><meta/><main>${body}</main></bill>`;
const unsupported=work=>assert.throws(work,{code:'DRAFT_STRUCTURAL_UNSUPPORTED'});
function verifyMapping(source,projection,offset=0){
 for(const entry of projection.mapping){const block=projection.blocks[entry.blockIndex-offset];assert.ok(block);
  if(entry.kind==='run'){
   const run=block.runs[entry.runIndex],decoded=decodeXmlTextRun(source.slice(entry.sourceStart,entry.sourceEnd),entry.textKind).decoded;
   assert.equal(run.text,decoded.slice(entry.decodedStart,entry.decodedEnd));
   assert.equal(run.text,decodeXmlTextRun(source.slice(entry.rawStart,entry.rawEnd),entry.textKind).decoded);
  }else{
   const cell=block.rows[entry.rowIndex][entry.columnIndex];assert.equal(entry.decodedStart,0);assert.equal(entry.decodedEnd,cell.length);
   assert.equal(entry.segments.map(segment=>decodeXmlTextRun(source.slice(segment.rawStart,segment.rawEnd),segment.textKind).decoded).join(''),cell);
   for(const segment of entry.segments)assert.equal(cell.slice(segment.decodedStart,segment.decodedEnd),decodeXmlTextRun(source.slice(segment.rawStart,segment.rawEnd),segment.textKind).decoded);
  }
 }
 const count=projection.blocks.reduce((n,block)=>n+(block.kind==='paragraph'?block.runs.length:block.rows.reduce((m,row)=>m+row.length,0)),0);
 assert.equal(projection.mapping.length,count);
}

test('official schema fixture projects exact visible order, italic clauses and declared omissions',async()=>{
 const source=await readFile(new URL('../uslm-schema/test/fixtures/BILLS-114hres99eh.xml',import.meta.url),'utf8'),projection=projectUslmWord(source,{blockOffset:7});
 assert.deepEqual(projection.blocks.map(block=>block.runs.map(run=>run.text).join('')),[
  '•HRES 99 EH','H. Res. ','99','In the House of Representatives, U. S.,','February 10, 2015.','Resolved, ',
  'That the House has heard with profound sorrow of the death of the Honorable Alan Nunnelee, a Representative from the State of Mississippi.',
  'Resolved, ','That the Clerk communicate these resolutions to the Senate and transmit a copy thereof to the family of the deceased.',
  'Resolved, ','That when the House adjourns today, it adjourn as a further mark of respect to the memory of the deceased.','Attest: Clerk.']);
 assert.equal(projection.blocks[5].runs[0].italic,true);assert.equal(projection.mapping[0].blockIndex,7);
 assert.equal(projection.omissions.filter(o=>o.reason==='metadata').length,1);
 assert.equal(projection.omissions.filter(o=>o.reason==='display-no').length,4);
 assert.ok(projection.omissions.some(o=>o.reason==='prolog'&&source.slice(o.rawStart,o.rawEnd).includes('xml-stylesheet')));
 for(const omitted of projection.omissions.filter(o=>o.reason==='indentation-whitespace'))assert.match(source.slice(omitted.rawStart,omitted.rawEnd),/^[\r\n\t ]+$/);
 verifyMapping(source,projection,7);assert.equal(Object.isFrozen(projection.blocks[0].runs),true);
});

test('tags determine closed styles, exact inline text, entities and whitespace without quote invention',()=>{
 const source=`<bill xmlns="${ns}"><preface><coverTitle>Title</coverTitle></preface><main><section><num>1.</num><heading>Heading</heading><subheading>Subheading</subheading>`+
  '<content> A &amp; 😀\r\n<b>B <i>I</i></b> <strong>S</strong><em>E</em><ref href="/law">ref</ref><term>term</term><span>span</span><quotedText>quoted</quotedText> Z </content></section></main></bill>';
 const projected=projectUslmWord(source);
 assert.deepEqual(projected.blocks.map(b=>b.style),['Title','Normal','Heading 1','Heading 2','Normal']);
 assert.equal(projected.blocks[4].runs.map(r=>r.text).join(''),' A & 😀\nB I SEreftermspanquoted Z ');
 assert.ok(projected.blocks[4].runs.some(r=>r.text==='I'&&r.bold&&r.italic));
 assert.equal(projected.blocks[4].runs.some(r=>Object.hasOwn(r,'quoteDepth')),false);verifyMapping(source,projected);
});

test('quotedContent explicitly controls depth and keeps quotedText literal without inferred punctuation',()=>{
 const source=bill('<quotedContent><content>outer <quotedText>literal</quotedText></content><quotedContent><p>inner</p></quotedContent></quotedContent>');
 const projected=projectUslmWord(source);assert.deepEqual(projected.blocks.map(b=>b.quoteDepth),[1,2]);
 assert.deepEqual(projected.blocks.map(b=>b.runs.map(r=>r.text).join('')),['outer literal','inner']);verifyMapping(source,projected);
 const eight=bill('<quotedContent>'.repeat(8)+'<content>x</content>'+'</quotedContent>'.repeat(8));
 assert.equal(projectUslmWord(eight).blocks[0].quoteDepth,8);
 unsupported(()=>projectUslmWord(bill('<quotedContent>'.repeat(9)+'<content>x</content>'+'</quotedContent>'.repeat(9))));
});

test('raw intersections mark whole decoded entities/supplementary scalars and preserve exact run mappings',()=>{
 const source=bill('<content>A &amp; 😀 C <b>bold</b></content>'),entity=source.indexOf('&amp;'),emoji=source.indexOf('😀'),bold=source.indexOf('bold');
 const changes=[{start:entity+2,end:entity+3},{start:emoji+1,end:emoji+2},{start:bold+1,end:bold+3}];
 const projected=projectUslmWord(source,{blockOffset:3,changes,mark:'strike'});
 assert.deepEqual(projected.blocks[0].runs.filter(r=>r.strike).map(r=>r.text),['&','😀','ol']);
 assert.equal(projected.blocks[0].runs.find(r=>r.text==='ol').bold,true);verifyMapping(source,projected,3);
 const inserted=projectUslmWord(source,{changes:[{start:bold,end:bold+4}],mark:'underline'});
 assert.deepEqual(inserted.blocks[0].runs.filter(r=>r.underline),[{text:'bold',bold:true,underline:true}]);
 const cdata=bill('<content><![CDATA[ A &\r\n😀 ]]></content>');verifyMapping(cdata,projectUslmWord(cdata,{changes:[{start:cdata.indexOf('😀'),end:cdata.indexOf('😀')+2}],mark:'underline'}));
});

test('plain rectangular XHTML tables preserve cell text/entities and final cell coordinates',()=>{
 const source=bill('<content>before<h:table>\n<h:tbody><h:tr><h:td>A &amp; B</h:td><h:td><![CDATA[<x>]]></h:td></h:tr>\n<h:tr><h:td/><h:td> C\nD </h:td></h:tr></h:tbody></h:table>after</content>');
 const projected=projectUslmWord(source,{blockOffset:9});
 assert.deepEqual(projected.blocks.map(b=>b.kind),['paragraph','table','paragraph']);
 assert.deepEqual(projected.blocks[1].rows,[['A & B','<x>'],['',' C\nD ']]);verifyMapping(source,projected,9);
 assert.equal(projected.mapping.filter(m=>m.kind==='cell').every(m=>m.blockIndex===10),true);
 const start=source.indexOf('A &amp; B');unsupported(()=>projectUslmWord(source,{changes:[{start,end:start+1}],mark:'strike'}));
 assert.doesNotThrow(()=>projectUslmWord(source,{changes:[{start,end:start+1}],mark:null}));
});

test('unsupported tables, rich cells, MathML, CSS, unknown tags and nonrepresentable structure refuse atomically',()=>{
 const bodies=[
  '<h:table><h:tr><h:td colspan="1">x</h:td></h:tr></h:table>',
  '<h:table><h:tr><h:td rowspan="2">x</h:td></h:tr></h:table>',
  '<h:table><h:thead><h:tr><h:td>x</h:td></h:tr></h:thead></h:table>',
  '<h:table><h:tr><h:th>x</h:th></h:tr></h:table>',
  '<h:table><h:tr><h:td><b>rich</b></h:td></h:tr></h:table>',
  '<h:table><h:tr><h:td><h:table/></h:td></h:tr></h:table>',
  '<h:table><h:tr><h:td>x</h:td></h:tr><h:tr><h:td>x</h:td><h:td>y</h:td></h:tr></h:table>',
  '<quotedContent><h:table><h:tr><h:td>x</h:td></h:tr></h:table></quotedContent>',
  '<content><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math></content>',
  '<content style="font-size:20px">x</content>','<mystery>text</mystery>','<section>unwrapped text</section>',
  '<content><br/></content>','<content><sup>2</sup></content>'
 ];
 for(const body of bodies)unsupported(()=>projectUslmWord(bill('<content>prior valid block</content>'+body)));
 unsupported(()=>projectUslmWord('<statute xmlns="'+ns+'"><main/></statute>'));
});

test('all current output limits and deep nesting refuse without truncation',()=>{
 unsupported(()=>projectUslmWord(bill('<content>x</content>'.repeat(1001))));
 assert.equal(projectUslmWord(bill('<content>x</content>'),{blockOffset:999}).mapping[0].blockIndex,999);
 unsupported(()=>projectUslmWord(bill('<content>x</content>'),{blockOffset:1000}));
 unsupported(()=>projectUslmWord(bill('<content>'+'<b>x</b>'.repeat(101)+'</content>')));
 assert.equal(projectUslmWord(bill('<content>'+'<b>x</b>'.repeat(100)+'</content>')).blocks[0].runs.length,100);
 unsupported(()=>projectUslmWord(bill('<content>'+'x'.repeat(100001)+'</content>')));
 unsupported(()=>projectUslmWord(bill('<h:table>'+'<h:tr><h:td>x</h:td></h:tr>'.repeat(1001)+'</h:table>')));
 unsupported(()=>projectUslmWord(bill('<h:table><h:tr>'+'<h:td>x</h:td>'.repeat(41)+'</h:tr></h:table>')));
 unsupported(()=>projectUslmWord(bill('<section>'.repeat(1000)+'<content>x</content>'+'</section>'.repeat(1000))));
 unsupported(()=>projectUslmWord(bill('<content>x</content>'),{mark:'bold'}));
 unsupported(()=>projectUslmWord(bill('<content>x</content>'),{changes:[{start:-1,end:2}],mark:'strike'}));
});
