import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMailBodySection,assertMailBodySection} from '../retrieval-0.2/mail-utf16.mjs';
const sha=text=>createHash('sha256').update(text,'utf8').digest('hex');
const corpus='ab😀🧭cd𐐀e';
for(let limit=1;limit<=8;limit++)test(`UTF16 budget${limit}: cursor progress reconstructs all scalars without loss or duplication`,()=>{
 let offset=0,text='',calls=0;
 do {
  const page=createMailBodySection(corpus,offset,limit);assertMailBodySection(page,offset,limit);
  assert.equal(page.start,offset);assert.equal(page.text.isWellFormed(),true);assert(page.endExclusive>offset);
  assert(page.endExclusive<=corpus.length);text+=page.text;offset=page.endExclusive;assert(++calls<=corpus.length);
 }while(offset<corpus.length);
 assert.equal(text,corpus);assert.equal(sha(text),sha(corpus));
});
test('2000-unit page clips before a boundary emoji and continuation includes the entire pair',()=>{
 const full='a'.repeat(1999)+'😀DECISIVE';
 const first=createMailBodySection(full,0,2000),next=createMailBodySection(full,first.endExclusive,2000);
 assert.equal(first.text,'a'.repeat(1999));assert.equal(first.endExclusive,1999);assert.equal(first.hasMore,true);
 assert.equal(next.start,1999);assert.equal(next.text,'😀DECISIVE');assert.equal(next.hasMore,false);
 assert.equal(first.text+next.text,full);assert.equal(sha(first.text+next.text),sha(full));
});
test('explicit offset within a pair returns its complete scalar and original absolute positions',()=>{
 const page=createMailBodySection('😀ab',1,1);assert.deepEqual(page,{start:0,endExclusive:2,totalCodeUnits:4,unit:'utf16-code-unit',text:'😀',hasMore:true});
 assertMailBodySection(page,1,1);
});
test('EOF, beyond EOF and empty full body are stable without another cursor',()=>{
 for(const [full,offset] of [['😀',2],['😀',9],['',0]]) {
  const page=createMailBodySection(full,offset,1);assertMailBodySection(page,offset,1);
  assert.equal(page.start,full.length);assert.equal(page.endExclusive,full.length);assert.equal(page.text,'');assert.equal(page.hasMore,false);
 }
});
test('invalid raw Unicode and arbitrary expansion/gaps/nonprogress cannot use boundary exception',()=>{
 for(const text of ['\ud83d','\udc00','a\ud83dx'])assert.throws(()=>createMailBodySection(text,0,1));
 const page=createMailBodySection('😀ab',0,1);
 for(const mutate of [p=>p.text='\ud83d',p=>p.endExclusive=3,p=>p.start=1,p=>p.hasMore=false,p=>p.endExclusive=0,p=>p.totalCodeUnits=1]) {
  const bad=structuredClone(page);mutate(bad);assert.throws(()=>assertMailBodySection(bad,0,1));
 }
 const ascii={start:0,endExclusive:2,totalCodeUnits:3,unit:'utf16-code-unit',text:'ab',hasMore:true};
 assert.throws(()=>assertMailBodySection(ascii,0,1));
});
