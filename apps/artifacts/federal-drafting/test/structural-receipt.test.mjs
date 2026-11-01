import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertStructuralProjection} from '../../../../packages/contracts/federal-workbench/structural-receipt.mjs';
import {federalStructuralProjection} from '../structural-projection.mjs';
const parserVersion='federal-uslm-xml/3';
const bill=body=>`<bill xmlns="http://schemas.gpo.gov/xml/uslm" xmlns:h="http://www.w3.org/1999/xhtml"><meta/><main>${body}</main></bill>`;
function draft(text,anchor=null,replacement=null){
 let segments=[{kind:'unchanged',text}];
 if(anchor!==null){const at=text.indexOf(anchor);assert.ok(at>=0);segments=[
  {kind:'unchanged',text:text.slice(0,at)},{kind:'delete',text:anchor},
  {kind:'insert',text:replacement},{kind:'unchanged',text:text.slice(at+anchor.length)}].filter(s=>s.text.length);}
 const consolidated=segments.filter(s=>s.kind!=='delete').map(s=>s.text).join('');
 const source={parserVersion,text},outputs={segments,consolidated},removed=consolidated==='';
 return {parserVersion,source,outputs,...(removed?{resultKind:'source-text-removed'}:{}),structuralProjection:federalStructuralProjection(source,outputs,removed)};
}
const rejects=(original,mutate)=>{const copy=structuredClone(original);mutate(copy);assert.throws(()=>assertStructuralProjection(copy),{code:'STRUCTURAL_MISMATCH'});};

test('canonical official source, decoded edits, CDATA, table and empty visible body receipts validate',async()=>{
 const official=await readFile(new URL('../uslm-schema/test/fixtures/BILLS-114hres99eh.xml',import.meta.url),'utf8');
 for(const value of [draft(official),draft(official,'profound sorrow','deep sorrow'),
  draft(bill('<content>A &amp; 😀\r\n<b>bold</b><![CDATA[ <literal> ]]></content>'),'&amp;','&lt;'),
  draft(bill('<content>A &amp; 😀\r\n<b>bold</b><![CDATA[ <literal> ]]></content>'),'bold','new'),
  draft(bill('<h:table><h:tr><h:td>A &amp; B</h:td><h:td><![CDATA[<x>]]></h:td><h:td/></h:tr></h:table>')),
  draft(bill(''))]){
  assert.equal(value.structuralProjection.status,'supported');assert.doesNotThrow(()=>assertStructuralProjection(value));
 }
});

test('every run is bound to exact raw/decoded coordinates and exactly one zero-offset output target',()=>{
 const value=draft(bill('<content>A &amp; 😀 <b>bold</b></content>'));
 for(const mutate of [
  p=>p.mapping.pop(),p=>p.mapping.push({...p.mapping[0]}),p=>p.mapping.reverse(),
  p=>p.mapping[0].blockIndex++,p=>p.mapping[0].runIndex++,p=>p.mapping[0].rawStart++,
  p=>p.mapping[0].rawEnd--,p=>p.mapping[0].sourceEnd++,p=>p.mapping[0].decodedEnd--,
  p=>p.blocks[0].runs[0].text+='forged',p=>p.mapping[0].extra=true,
  p=>p.omissions.push({rawStart:0,rawEnd:999999,reason:'metadata'}),
  p=>p.omissions[0].reason='invented'
 ])rejects(value,d=>mutate(d.structuralProjection.consolidated));
 const unicode=draft(bill('<content>😀</content>'));
 rejects(unicode,d=>{const p=d.structuralProjection.consolidated;p.mapping[0].rawEnd--;p.mapping[0].decodedEnd--;p.blocks[0].runs[0].text='\ud83d';});
 const entity=draft(bill('<content>&#x1F600;</content>'));
 rejects(entity,d=>{const p=d.structuralProjection.consolidated;p.mapping[0].rawEnd--;});
});

test('comparison flags exactly follow source deletions and revised insertions; consolidated and revised layout agree',()=>{
 const value=draft(bill('<content>before <b>old</b> after</content>'),'old','new');
 assert.doesNotThrow(()=>assertStructuralProjection(value));
 rejects(value,d=>delete d.structuralProjection.original.blocks[0].runs.find(r=>r.strike).strike);
 rejects(value,d=>delete d.structuralProjection.revised.blocks[0].runs.find(r=>r.underline).underline);
 rejects(value,d=>d.structuralProjection.original.blocks[0].runs[0].strike=true);
 rejects(value,d=>d.structuralProjection.revised.blocks[0].runs[0].underline=true);
 rejects(value,d=>d.structuralProjection.consolidated.blocks[0].runs[0].underline=true);
 rejects(value,d=>d.structuralProjection.revised.blocks[0].style='Title');
 rejects(value,d=>d.structuralProjection.revised.blocks[0].runs.find(r=>r.bold).bold=undefined);
 rejects(value,d=>d.outputs.segments.find(s=>s.kind==='delete').text='unbound');
 // An entity spelling edit marks the indivisible decoded scalar on both sides.
 assert.doesNotThrow(()=>assertStructuralProjection(draft(bill('<content>&amp;</content>'),'amp','#38')));
});

test('plain cells require exact concatenated decoding and unique row/column provenance',()=>{
 const value=draft(bill('<h:table><h:tr><h:td>A &amp; B<![CDATA[ C ]]></h:td><h:td/></h:tr></h:table>'));
 assert.doesNotThrow(()=>assertStructuralProjection(value));
 for(const mutate of [
  p=>p.blocks[0].rows[0][0]='forged',p=>p.mapping[0].columnIndex=1,
  p=>p.mapping[0].segments.pop(),p=>p.mapping[0].segments[0].decodedEnd++,
  p=>p.mapping[0].segments[0].sourceStart++,p=>p.mapping[0].segments.reverse(),
  p=>p.mapping[1].segments.push({...p.mapping[0].segments[0]}),
  p=>p.mapping[0].rawStart=p.mapping[0].segments[0].rawStart+1
 ])rejects(value,d=>mutate(d.structuralProjection.consolidated));
 const changed=draft(value.source.text,'A &amp; B','changed');
 assert.equal(changed.structuralProjection.status,'unsupported');assert.doesNotThrow(()=>assertStructuralProjection(changed));
});

test('typed removal retains marked original and requires null final views; unsupported is explicit and closed',()=>{
 const raw=bill('<content>remove</content>'),removed=draft(raw,raw,'');
 assert.equal(removed.structuralProjection.status,'supported');assert.doesNotThrow(()=>assertStructuralProjection(removed));
 rejects(removed,d=>d.structuralProjection.original=null);
 rejects(removed,d=>d.structuralProjection.consolidated={blocks:[],mapping:[],omissions:[]});
 rejects(removed,d=>delete d.resultKind);
 const unsupported=draft(bill('<content><sup>unsupported</sup></content>'));
 assert.equal(unsupported.structuralProjection.status,'unsupported');assert.doesNotThrow(()=>assertStructuralProjection(unsupported));
 rejects(unsupported,d=>d.structuralProjection.code='OTHER');
 rejects(unsupported,d=>d.structuralProjection.original=null);
 rejects(unsupported,d=>d.structuralProjection.profile='uslm-word/2');
});

test('legacy profiles omit structural receipt; source3 requires it and binds both reconstructed byte strings',()=>{
 const value=draft(bill('<content>one</content>'));
 for(const parser of ['federal-uslm-xml/1','federal-uslm-xml/2','federal-flat-text/1']){
  const legacy={parserVersion:parser,source:{parserVersion:parser}};assert.doesNotThrow(()=>assertStructuralProjection(legacy));
  assert.throws(()=>assertStructuralProjection({...legacy,structuralProjection:value.structuralProjection}),{code:'STRUCTURAL_MISMATCH'});
 }
 rejects(value,d=>delete d.structuralProjection);
 rejects(value,d=>d.source.parserVersion='federal-uslm-xml/2');
 rejects(value,d=>d.source.text+=' ');
 rejects(value,d=>d.outputs.consolidated+=' ');
});
