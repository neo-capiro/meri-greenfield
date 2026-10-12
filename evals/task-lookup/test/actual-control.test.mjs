import test from 'node:test';import assert from 'node:assert/strict';
import {createTaskLookupDelivery} from '../../../apps/control/task-lookup/index.mjs';
import {fixture,NOW} from '../../../apps/control/task-lookup/fixtures.mjs';
import {input,sign,options,capture} from './fixtures.mjs';import {freezeCorpus} from '../corpus.mjs';import {hash,semanticResult} from '../contracts.mjs';import {scoreObservations} from '../score.mjs';
// Actual source controller, actual callbacks, inert source/store only; no runtime proof.
export async function actualControl(){
 const f=fixture(),traces=[];const controller=createTaskLookupDelivery({...Object.fromEntries(['gateway','store','clock'].map(k=>[k,f[k]])),authorize:async q=>{const receipt=await f.authorize(q);traces.push({phase:q.phase,binding:structuredClone(q.binding),receipt:structuredClone(receipt),error:null,observedAtMs:NOW});return receipt;}});
 const delivery=await controller.lookup({request:f.request,context:f.context,credential:'inert-control-test'});traces.length=0;
 const read=await controller.read({resultReference:delivery.resultReference,context:f.readContext});
 const raw=input(),c=raw.cases[0];c.context={binding:structuredClone(f.context.binding),clientResolution:{reference:f.context.selectedClientId,clientId:f.context.selectedClientId}};c.request={...f.request,clientId:f.context.selectedClientId};c.scopes=structuredClone(f.context.scopes);c.expected={outcome:'returned',semanticSha256:hash(semanticResult(read.observation)),replaySha256:null,recordIds:[],absence:false,exhaustive:false};raw.sources[0].asOf=new Date(NOW).toISOString();sign(raw);
 const frozen=freezeCorpus(raw,options(raw)),observed=capture(frozen),o=observed.observations[0];observed.run.startedAt=observed.run.completedAt=new Date(NOW).toISOString();o.startedAt=o.completedAt=new Date(NOW).toISOString();Object.assign(o,{status:'returned',reason:null,failure:null,route:{operation:{id:'actions.query',version:'0.2.0'},request:structuredClone(c.request)},authorization:traces,delivery,read});
 return {f,frozen,observed};
}
test('actual control-produced immutable refs, source envelope and two read receipts satisfy scorer',async()=>{const t=await actualControl();assert.equal(t.observed.observations[0].authorization[1].binding.original.context.binding.writerFence,1);const r=scoreObservations(t.frozen,t.observed);assert.deepEqual(r.rows[0].reasons,[]);assert.equal(r.counts.passed,1);assert.equal(r.qualification.runtimeQualified,false);});

for(const denial of ['receipt','error'])test(`actual control denied read (${denial}) requires its callback and captured exception`,async()=>{
 const f=fixture(),traces=[];const controller=createTaskLookupDelivery({gateway:f.gateway,store:f.store,clock:f.clock,authorize:async q=>{
  if(q.phase==='before_read'){
   if(denial==='error'){traces.push({phase:q.phase,binding:structuredClone(q.binding),receipt:null,error:{code:'ACCESS_DENIED'},observedAtMs:NOW});throw Object.assign(new Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});}
   const receipt={authorized:false,bindingSha256:q.binding.bindingSha256,expiresAtMs:NOW+60000};traces.push({phase:q.phase,binding:structuredClone(q.binding),receipt,error:null,observedAtMs:NOW});return receipt;
  }return f.authorize(q);
 }});
 const delivery=await controller.lookup({request:f.request,context:f.context,credential:'inert-control-test'});let failure;
 try{await controller.read({resultReference:delivery.resultReference,context:f.readContext});assert.fail('read must refuse');}catch(e){failure={code:e.code,outcome:e.outcome};}
 const raw=input(),c=raw.cases[0];c.context={binding:structuredClone(f.context.binding),clientResolution:{reference:f.context.selectedClientId,clientId:f.context.selectedClientId}};c.request={...f.request,clientId:f.context.selectedClientId};c.scopes=structuredClone(f.context.scopes);sign(raw);
 const frozen=freezeCorpus(raw,options(raw)),observed=capture(frozen),o=observed.observations[0];observed.run.startedAt=observed.run.completedAt=o.startedAt=o.completedAt=new Date(NOW).toISOString();Object.assign(o,{authorization:traces,failure});
 assert.equal(scoreObservations(frozen,observed).counts.passed,1);o.failure=null;assert.equal(scoreObservations(frozen,observed).counts.failed,1);
});
