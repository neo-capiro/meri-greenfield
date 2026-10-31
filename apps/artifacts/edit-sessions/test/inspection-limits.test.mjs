import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOfficeEdit} from '../inspect-office.mjs';
import {chart} from './embedded-chart-fixture.mjs';
import {zip,ooxmlEntries} from '../../structure/test/fixtures.mjs';
const refused={code:'EDITOR_STRUCTURE_REFUSED'};
test('inspection limits are closed, positive and can only tighten defaults without invoking accessors',()=>{
 const bytes=zip(chart());let invoked=0;
 for(const limits of [null,[],{unknown:1},{maxEntries:5001},{maxRatio:1033},{maxOriginalBytes:20*1024*1024+1},
  {maxTotalUncompressed:128*1024*1024+1},{maxEntries:0},{maxEntries:1.5},{maxRatio:NaN},
  {get maxEntries(){invoked++;return 1;}}])assert.throws(()=>inspectOfficeEdit(bytes,'pptx',limits),refused);
 assert.equal(invoked,0);
 assert.throws(()=>inspectOfficeEdit(bytes,'pptx',{maxOriginalBytes:bytes.length-1}),refused);
 assert.equal(inspectOfficeEdit(bytes,'pptx',{maxOriginalBytes:bytes.length}).format,'pptx');
});
test('tightened entries and expanded bytes are cumulative across the presentation and workbook',()=>{
 const entries=chart(),book=ooxmlEntries('xlsx'),bytes=zip(entries);
 const count=Object.keys(entries).length+Object.keys(book).length;
 const expanded=[...Object.values(entries),...Object.values(book)].reduce((sum,b)=>sum+Buffer.byteLength(b),0);
 assert.equal(inspectOfficeEdit(bytes,'pptx',{maxEntries:count,maxTotalUncompressed:expanded}).format,'pptx');
 assert.throws(()=>inspectOfficeEdit(bytes,'pptx',{maxEntries:count-1}),refused);
 assert.throws(()=>inspectOfficeEdit(bytes,'pptx',{maxTotalUncompressed:expanded-1}),refused);
});
