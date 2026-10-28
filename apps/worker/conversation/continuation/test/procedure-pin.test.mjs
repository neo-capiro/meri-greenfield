import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {buildContinuationOptions,continuationContextSha256} from '../options.mjs';
import {continuationFixture,id} from './fixtures.mjs';

const builtin={source:'builtin',id:'briefing',version:1,manifestDigest:'d'.repeat(64)};
const firm={source:'firm',recordId:id(45),version:2,manifestDigest:'e'.repeat(64)};
function fixture(mode,selection=builtin){
 const f=continuationFixture(mode);
 f.target.sourceRequest.skill=null;f.target.request.skill=null;
 if(selection){f.target.sourceRequest.procedure=structuredClone(selection);f.target.request.procedure=structuredClone(selection);}
 f.continuation.sourceRequestSha256=canonicalSha256(f.target.sourceRequest);
 f.continuation.contextSha256=continuationContextSha256(f.target.sourceRequest,f.target.scopes);
 return f;
}
for(const mode of ['resume','fork']){
 test(`${mode}: exact built-in and firm procedure pins survive legacy checkpoint continuation`,()=>{
  for(const selection of [builtin,firm]){const f=fixture(mode,selection);assert.equal(buildContinuationOptions(f.continuation,f.target).resume,f.continuation.checkpoint.sessionId);}
 });
 const mutations={
  omitted:f=>{delete f.target.request.procedure;},
  differentIdentity:f=>{f.target.request.procedure.id='draft';},
  newerVersion:f=>{f.target.request.procedure.version++;},
  changedDigest:f=>{f.target.request.procedure.manifestDigest='f'.repeat(64);},
  differentSource:f=>{f.target.request.procedure=structuredClone(firm);},
  unsolicited:f=>{delete f.target.sourceRequest.procedure;f.continuation.sourceRequestSha256=canonicalSha256(f.target.sourceRequest);}
 };
 for(const [name,change] of Object.entries(mutations))test(`${mode}: ${name} procedure refuses before SDK continuation`,()=>{
  const f=fixture(mode);change(f);assert.throws(()=>buildContinuationOptions(f.continuation,f.target),/CONTINUATION_PIN_REFUSED/);
 });
}
