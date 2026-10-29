import test from 'node:test';
import assert from 'node:assert/strict';
import wire from '../../../../../packages/contracts/test/fixtures/federal-draft-source.wire.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createFederalDraftSourceHandlers} from '../handler.mjs';
import {familyOperations} from '../../../general-reads/registration.mjs';
const operation={id:'read_federal_draft_source',version:'0.2.0'},contract=resolveOperationContract(operation);
function fixture(){
 const f=billTextCase();f.authority.decision.operation=operation.id+'@'+operation.version;
 f.authority.sourceIds=contract.descriptor.sourceRequirements.map(r=>r.sourceId);
 f.state.page=structuredClone(wire.response);
 f.transport.fetchImpl=async(url,options)=>{f.wire.push({url,options});return Response.json(f.state.page);};
 const normalized=contract.normalizeInput(wire.request);
 return {...f,call:()=>({request:wire.request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,authority:readContext(f.authority),normalizationContext:{}}),
  handler:()=>createFederalDraftSourceHandlers({...f.transport,now:f.now},[operation])[0].execute};
}
test('registered native producer uses fixed Core route with exact pins',async()=>{
 assert.ok(familyOperations('federal-draft-source').some(row=>row.id===operation.id));
 const f=fixture(),result=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(result.result,wire.response);assert.deepEqual(JSON.parse(f.wire[0].options.body),wire.request);
 assert.equal(new URL(f.wire[0].url).pathname,'/api/clio/tools/read_federal_draft_source');
});
test('native source refuses changed text at receiving boundary',async()=>{
 const f=fixture();f.state.page.source.text+='changed';await assert.rejects(f.handler()(f.call()),/INVALID_RESULT/);
});
test('current source unavailable remains unavailable, never substitutes a different revision',async()=>{
 const f=fixture();f.state.page={tool:operation.id,authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',reason:'exact_current_source_unavailable',selection:wire.request};
 const result=JSON.parse(await f.handler()(f.call()));assert.equal(result.result.currentStatus,'unavailable');
});
test('expired request never reads the source',async()=>{
 const f=fixture(),call=f.call();f.state.now=f.authority.deadlineMs+1;
 await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);
});
