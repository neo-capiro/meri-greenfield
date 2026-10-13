/** Independent counterexamples retained from artifact review at ddfcc398. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCommitmentsAudit} from './index.mjs';
import {fixture} from '../test/commitments-fixture.mjs';
const compile=f=>compileCommitmentsAudit(f.input,{context:f.context,reads:f.reads});

test('allowed operation from another source cannot bind a mail passage',()=>{
 const f=fixture();f.reads[0].operation={id:'query_tasks',version:'0.2.0'};
 assert.throws(()=>compile(f),/COMMITMENTS_READ_/u);
});
test('Monday source authority cannot be promoted above its canonical operation requirement',()=>{
 const f=fixture();f.reads.at(-1).sources[0].authority='authoritative';
 assert.throws(()=>compile(f),/COMMITMENTS_READ_/u);
});
test('actual canonical source authority is retained in coverage and bound passages',()=>{
 const f=fixture();f.input.observations.push(f.observation('monday-tracking','tracking','client_knowledge_monday'));
 const out=compile(f),promise=out.commitments[0];
 assert.equal(out.coverage.find(row=>row.sourceId==='mail').authority,'authoritative');
 assert.equal(out.coverage.find(row=>row.sourceId==='client_knowledge_monday').authority,'derived');
 assert.equal(promise.promise.authority,'authoritative');assert.equal(promise.tracking[0].passage.authority,'derived');
});
