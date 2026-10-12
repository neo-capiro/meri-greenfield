import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.MERI_TEST_CONTINUATION_ROOT;
if(!root)throw Error('Explicit immutable candidate root required');
const {priorVerticalBoundary,priorVerticalOriginal}=await import(pathToFileURL(root+'/packages/contracts/test/vertical-continuation-expectations.mjs'));
const {portfolioBoundaryBefore,portfolioBoundaryAfter}=await import(pathToFileURL(root+'/packages/contracts/test/vertical-source-expectations.mjs'));
const ids=['get_research_evidence','create_word','create_excel','create_powerpoint','run_analysis','create_task','update_task','save_memory','save_chat_attachments','schedule_task','list_scheduled_tasks','cancel_scheduled_task','update_scheduled_task'];
for(const id of ids){
 test(`${id} inverse is exact and refuses changed state or replacement`,()=>{
  const original={id,disposition:'selected',boundary:id==='get_research_evidence'?portfolioBoundaryBefore:'Retained immutable boundary',state:'pending',replacement:null,extra:{preserved:'sentinel'}};
  const current={...structuredClone(original),boundary:id==='get_research_evidence'?portfolioBoundaryAfter:original.boundary,state:'mapped',replacement:{id,version:'0.2.0'}};
  const before=structuredClone(current);
  assert.deepEqual(priorVerticalOriginal(current),original);assert.deepEqual(current,before);
  for(const change of [x=>x.state='pending',x=>x.replacement=null,x=>x.replacement.id='unrelated',x=>x.replacement.version='0.2.1',x=>x.replacement.extra=true]){
   const mutant=structuredClone(current);change(mutant);assert.throws(()=>priorVerticalOriginal(mutant));
  }
 });
}
test('Portfolio inverse requires the exact accepted boundary and leaves others untouched',()=>{
 assert.equal(priorVerticalBoundary('get_research_evidence',portfolioBoundaryAfter),portfolioBoundaryBefore);
 for(const boundary of [portfolioBoundaryBefore,'changed',null,undefined])assert.throws(()=>priorVerticalBoundary('get_research_evidence',boundary));
 assert.equal(priorVerticalBoundary('get_research_portfolio','unchanged'),'unchanged');
});
test('unallocated originals retain all fields and are not hidden by generic selection',()=>{
 for(const row of [{id:'query_action_items',state:'mapped',replacement:{id:'actions.query',version:'0.2.0'},boundary:'partial remains'}, {id:'manage_research_portfolio',state:'deferred',replacement:null,boundary:'not selected'}, {id:'unknown_future',state:'pending',replacement:null,boundary:'unapproved',marker:{a:1}}])assert.deepEqual(priorVerticalOriginal(row),row);
});
