import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase,readContext} from '../../bill-text/test/fixture.mjs';
import {createBusinessDevelopmentHandlers} from '../handler.mjs';
import {captureBusinessDevelopmentResource} from '../request-context.mjs';
const {rows}=JSON.parse(readFileSync(new URL('./brief-producer-pages.json',import.meta.url)));
for(const row of rows)test(`${row.name}: canonical saved projection retains source meaning`,()=>{
 const contract=resolveOperationContract({id:row.id,version:'0.2.0'});
 assert.deepEqual(contract.assertOutput(row.page,{request:row.input}),row.page);
});
test('full five-section payload, citation index and section provenance are retained',()=>{
 const row=rows[0],contract=resolveOperationContract({id:row.id,version:'0.2.0'});
 const page=contract.assertOutput(row.page,{request:row.input});
 assert.equal(Object.keys(page.brief.sections).length,5);assert.equal(page.brief.sections.companyAndFirmImplication.provenance,'edited');
 for(const mutate of [p=>p.brief.sections.judgment.citationIndexes=[1],p=>delete p.brief.sections.missingInformation,p=>p.data[0].id='substituted']){
  const changed=structuredClone(page);mutate(changed);assert.throws(()=>contract.assertOutput(changed,{request:row.input}));
 }
});
test('snapshot-only or unavailable metadata cannot become current or backed evidence',()=>{
 for(const name of ['snapshot_only','source_changed','none']){
  const row=rows.find(r=>r.name===name),contract=resolveOperationContract({id:row.id,version:'0.2.0'}),page=structuredClone(row.page);
  if(name==='snapshot_only')delete page.basisNote;else page.results=structuredClone(rows.find(r=>r.name==='current_dossier').page.results);
  assert.throws(()=>contract.assertOutput(page,{request:row.input}));
 }
});
test('saved brief refuses whole-envelope overflow without dropping sections',()=>{
 const row=rows[0],contract=resolveOperationContract({id:row.id,version:'0.2.0'}),page=structuredClone(row.page);
 page.brief.sections.judgment.text='界'.repeat(90000);assert.throws(()=>contract.assertOutput(page,{request:row.input}));
});
for(const name of ['saved-brief','snapshot_only'])test(`${name}: retained native handler uses explicit owned conversation and per-call credentials`,async()=>{
 const row=rows.find(r=>r.name===name),scene=billTextCase(),operation={id:row.id,version:'0.2.0'},contract=resolveOperationContract(operation),{authority,wire,now}=scene;
 authority.decision.operation=`${row.id}@0.2.0`;authority.sourceIds=contract.descriptor.sourceRequirements.map(s=>s.sourceId);
 authority.subject.scopes=[{tenantId:authority.binding.tenantId,kind:'private-user',resourceId:authority.binding.actorId,policyRevision:authority.policyRevision}];
 const {getCredentials,...transport}=scene.transport;
 const handler=createBusinessDevelopmentHandlers({...transport,now,credentialsForCall:()=>getCredentials,async fetchImpl(url,options){wire.push({url,body:JSON.parse(options.body)});return Response.json(row.page);}},[operation])[0];
 const normalized=contract.normalizeInput(row.input,{}),out=JSON.parse(await handler.execute({request:row.input,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:{},authority:readContext(authority)}));
 assert.deepEqual(out.result,row.page);assert.deepEqual(wire[0].body,row.input);assert.ok(wire[0].url.endsWith('/api/clio/tools/'+row.id));
 assert.deepEqual(captureBusinessDevelopmentResource(operation,row.input,authority.subject),{conversationId:row.input.conversationId,clientId:null});
 assert.throws(()=>captureBusinessDevelopmentResource(operation,{...row.input,prospectId:'invented'},authority.subject));
});
