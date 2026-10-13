import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalActionCaseFactory} from '../case.mjs';
import {assertTaskLookupStoredBinding} from '../../../control/task-lookup/index.mjs';
const NOW=Date.parse('2026-10-13T01:00:00.000Z');
function setup(failure){
 const trace=[],releases=[];let connections=0;
 const pool={async connect(){connections++;if(connections>1)throw Error('unexpected bind after failed connection cleanup');return{
  async query(sql){trace.push(sql);if(failure==='begin'&&sql==='BEGIN')throw Error('synthetic BEGIN ACK loss');
   if(failure==='rollback'&&(sql.startsWith('INSERT')||sql==='ROLLBACK'))throw Error('synthetic write/rollback failure');return{rows:[],rowCount:0};},
  release(error){releases.push(error);if(failure==='release')throw Error('synthetic release failure');}
 };}};
 const create=createLocalActionCaseFactory({mode:'synthetic-local',now:()=>NOW,assertStoredBinding:assertTaskLookupStoredBinding});
 return{trace,releases,connections:()=>connections,run:()=>create({pool,name:'review-cleanup',deadlineMs:NOW+2000})};
}
for(const failure of ['begin','rollback'])test(`local case independent: ${failure} uncertainty evicts the owned borrowed connection`,async()=>{
 const t=setup(failure);await assert.rejects(t.run());assert.equal(t.connections(),1);assert.equal(t.releases.length,1);
 assert.ok(t.releases[0] instanceof Error,'uncertain transaction must not return a reusable connection');
 if(failure==='rollback')assert.ok(t.trace.includes('ROLLBACK'));
});
test('local case independent: release failure after committed seed prevents later grant-binding ports',async()=>{
 const t=setup('release');await assert.rejects(t.run());assert.ok(t.trace.includes('COMMIT'));assert.equal(t.connections(),1);
});
