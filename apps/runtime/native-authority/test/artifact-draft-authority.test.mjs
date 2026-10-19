/** Real current-authority adapters over explicit synthetic Core/admitted SQL.
 * Local drafts never change ordinary read or approved-command authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCurrentAuthorityAdapters} from '../current-authority-adapters.mjs';
import {fixture,BINDING,FILES,ORIGIN,TASK_CAPABILITY,uuid} from './current-authority-fixture.mjs';

function admittedDraft(f,id){
 const operation={id,version:'0.2.0'},a=f.set.allocation;
 a.manifest.allowedOperations.push(operation);a.manifestSha256=hash(a.manifest);
 a.schedule.operations.push({operation,chargeMicrousd:2500});
 const digest=hash(a);f.set.allocationJson=JSON.stringify(a);
 f.set.facts=f.set.facts.map(fact=>({...fact,allocationSha256:digest}));
 f.set.grantFactsJsons=f.set.facts.map(fact=>JSON.stringify(fact));
 f.rows.allocation.allocation=structuredClone(a);f.rows.allocation.allocation_sha256=digest;
 for(const fact of f.set.facts)f.rows.bindings.get(fact.grantId).facts=structuredClone(fact);
}
function owner(f,localArtifactDrafts){
 const a=createCurrentAuthorityAdapters({origin:ORIGIN,nativeCredentials:f.nativeCredentials,readSecret:f.readSecret,
  reservedFiles:[FILES.identity,FILES.task,FILES.control,FILES.proxy],sourceEnabled:true,now:f.now,fetchImpl:f.fetchImpl,
  newId:()=>uuid('7'),localArtifactDrafts});
 a.bind({pool:f.pool,conversations:f.conversations,approvalMetadata:f.approvalMetadata});return a;
}
const request=(a,id)=>{const d=resolveOperationContract({id,version:'0.2.0'}).descriptor;
 return a.authority.check({credential:TASK_CAPABILITY,descriptor:{operation:d.operation,requiredGrants:d.requiredGrants,sourceRequirements:d.sourceRequirements},input:{},limitDeadline(){}});};

test('only the dedicated artifact ports authorize an exact admitted local draft',async()=>{
 const f=fixture();admittedDraft(f,'create_powerpoint');
 const ordinary=owner(f,false),drafts=owner(f,true);
 const claims=JSON.parse(await ordinary.ports.verifyCapability(TASK_CAPABILITY));assert.deepEqual(claims.actions,['tool.read']);
 await assert.rejects(request(ordinary,'create_powerpoint'));
 assert.deepEqual((await request(drafts,'create_powerpoint')).binding,BINDING);
 await assert.rejects(request(drafts,'run_analysis'),'another draft operation needs its own allocation admission');
 await assert.rejects(request(drafts,'save_chat_attachments'),'no external filing authority is granted');
 f.state.session=null;await assert.rejects(request(drafts,'create_powerpoint'),'current session revocation is observed');
});

test('no draft manifest, foreign client, revoked grant or changed writer can authorize an artifact',async()=>{
 const noManifest=fixture(),a=owner(noManifest,true);
 assert.deepEqual(JSON.parse(await a.ports.verifyCapability(TASK_CAPABILITY)).actions,['tool.read']);
 await assert.rejects(request(a,'create_powerpoint'));
 for(const mutate of [f=>{f.state.contextClient=uuid('e');},f=>{f.state.grantState.set(f.facts.task.grantId,'REVOKED');},f=>{f.state.run={...f.state.run,binding:{...f.state.run.binding,writerFence:2}};}]){
  const f=fixture();admittedDraft(f,'create_powerpoint');const o=owner(f,true);mutate(f);await assert.rejects(request(o,'create_powerpoint'));
 }
});
