/** API integration replay only; its synthetic reference is not an independent quality oracle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {actionLookupSlice} from './action-lookup-slice-fixture.mjs';
import {freezeCorpus} from '../../../evals/task-lookup/corpus.mjs';
import {scoreObservations} from '../../../evals/task-lookup/score.mjs';
import {hash,semanticResult} from '../../../evals/task-lookup/contracts.mjs';
import {input,sign,options,capture} from '../../../evals/task-lookup/test/fixtures.mjs';

async function replay(){
  const reference=await actionLookupSlice();await reference.lookup();const expected=await reference.read();
  const f=await actionLookupSlice(),value=input(),c=value.cases[0],at=new Date(f.h.f.state.now).toISOString();
  c.request={...f.c.request,clientId:f.c.context.selectedClientId};
  c.context={binding:f.h.f.binding,clientResolution:{reference:c.request.clientId,clientId:c.request.clientId}};
  c.scopes=f.c.context.scopes;
  c.expected={outcome:'returned',semanticSha256:hash(semanticResult(expected.observation)),replaySha256:null,
    recordIds:expected.observation.result.actions.map(row=>row.id),absence:false,exhaustive:false};
  value.sources[0].asOf=at;value.approval.issuedAt=at;
  sign(value);const frozen=freezeCorpus(value,options(value));
  const delivered=await f.lookup(),read=await f.read(),observed=capture(frozen);
  observed.run.startedAt=at;observed.run.completedAt=at;
  const o=observed.observations[0];Object.assign(o,{status:'returned',reason:null,failure:null,
    route:{operation:{id:'actions.query',version:'0.2.0'},request:c.request},delivery:delivered,read,
    authorization:f.trace.slice(-2).map(row=>({...row,error:null})),startedAt:at,completedAt:at});
  o.traceSha256=hash(o.authorization);
  return {f,frozen,observed:structuredClone(observed),expected};
}
test('actual full owner chain produces a fresh control capture consumed by the evaluator',async()=>{
  const {f,frozen,observed,expected}=await replay(),report=scoreObservations(frozen,observed);
  assert.equal(report.counts.passed,1);assert.equal(report.counts.failed,0);
  assert.notEqual(observed.observations[0].read.resultSha256,expected.resultSha256,'receipt IDs differ across fresh source observations');
  assert.equal(report.qualification.qualifiedRealRequests,0);assert.equal(report.byKind.synthetic.total,1);
  assert.equal(f.http.length,1);
});
test('old bare-binding callback mock cannot pass against the actual prepared-binding contract',async()=>{
  const {frozen,observed}=await replay(),release=observed.observations[0].authorization[1];
  release.binding.original=release.binding.original.context.binding;
  const {bindingSha256:ignored,...intent}=release.binding;release.binding.bindingSha256=hash(intent);
  release.receipt.bindingSha256=release.binding.bindingSha256;
  const report=scoreObservations(frozen,observed);assert.equal(report.counts.passed,0);assert.equal(report.counts.failed,1);
});
test('coherently rehashed changed evidence does not alter the separately frozen semantic expectation',async()=>{
  const {frozen,observed}=await replay(),o=observed.observations[0];
  o.read.observation.result.coverage.limitations.push('Changed source observation');
  o.read.resultSha256=hash(o.read.observation);o.delivery.resultSha256=o.read.resultSha256;
  const release=o.authorization[1];release.binding.resultSha256=o.read.resultSha256;
  const {bindingSha256:ignored,...intent}=release.binding;release.binding.bindingSha256=hash(intent);release.receipt.bindingSha256=release.binding.bindingSha256;
  const report=scoreObservations(frozen,observed);assert.equal(report.counts.failed,1);
  assert.deepEqual(report.rows[0].reasons,['EVAL_SEMANTIC_GOLD']);
});
