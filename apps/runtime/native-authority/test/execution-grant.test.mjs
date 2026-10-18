/** SYNTHETIC: execution-capability grant facts over a production-shaped admitted grant set. No database: `bindTrustedGrant` is
 * a recording port, because the real owner's only job here is to REQUIRE an already ACTIVE row (it never creates one). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {compileExecutionTrust,verifyExecutionCapability} from '../execution-capability.mjs';
import {executionGrantFacts,bindExecutionGrant,EXECUTION_GRANT_ADMISSION} from '../execution-grant.mjs';
import {productionToken,productionTrust,admittedSet,ISSUED_AT,RUN_BINDING,POLICY_REVISION,CAPABILITY_ID,WORKER_ARN} from './execution-capability-fixture.mjs';
const code=c=>e=>e?.code===c;
const verified=(options)=>verifyExecutionCapability(productionToken('clientAndDueDate',options).credential,compileExecutionTrust(productionTrust()),{nowMs:ISSUED_AT*1000+1000});
test('grant facts: capability id, exact executor binding, the admitted qualification (numeric attempt, actual ARN), token and allocation digests',()=>{
 const set=admittedSet(),v=verified(),facts=executionGrantFacts({verified:v,admitted:{allocationJson:set.allocationJson,grantFactsJsons:set.grantFactsJsons}});
 assert.deepEqual(facts,{grantId:CAPABILITY_ID,binding:RUN_BINDING,qualificationBinding:{runId:RUN_BINDING.runId,attempt:1,workerArn:WORKER_ARN,fence:1,policyRevision:POLICY_REVISION},
  capabilitySha256:createHash('sha256').update(productionToken('clientAndDueDate').credential).digest('hex'),allocationSha256:hash(set.allocation)});
 assert.notEqual(facts.qualificationBinding.workerArn,RUN_BINDING.workerId,'the token UUID worker id never substitutes for the actual task ARN');
});
test('grant facts refuse another executor binding, policy revision, or reuse of the run task/model grant id or digest',()=>{
 const v=verified(),refused=admitted=>assert.throws(()=>executionGrantFacts({verified:v,admitted}),code('EXECUTION_GRANT_REFUSED'));
 const pick=s=>({allocationJson:s.allocationJson,grantFactsJsons:s.grantFactsJsons});
 refused(pick(admittedSet({binding:{...RUN_BINDING,attemptId:'00000000-0000-4000-8000-000000000003'}})));
 refused(pick(admittedSet({policyRevision:'c'.repeat(64)})));
 refused(pick(admittedSet({grants:[[CAPABILITY_ID,'model'],['1b2c3d4e-0000-4000-8000-00000000000b','task']]})));
 const set=admittedSet(),reused=set.facts.map((f,i)=>i===0?{...f,capabilitySha256:v.credentialSha256}:f);
 refused({allocationJson:set.allocationJson,grantFactsJsons:reused.map(f=>JSON.stringify(f))});
 refused({allocationJson:set.allocationJson,grantFactsJsons:[]});
});
test('binding goes through the existing bindTrustedGrant only; a missing ACTIVE row is EXECUTION_GRANT_UNAVAILABLE',async()=>{
 const set=admittedSet(),facts=executionGrantFacts({verified:verified(),admitted:{allocationJson:set.allocationJson,grantFactsJsons:set.grantFactsJsons}}),calls=[];
 const check=()=>{};
 await bindExecutionGrant({bindTrustedGrant:async(json,c)=>{calls.push([JSON.parse(json),c]);},facts,check});
 assert.deepEqual(calls,[[{...facts,invocationId:EXECUTION_GRANT_ADMISSION},check]]);
 await assert.rejects(bindExecutionGrant({bindTrustedGrant:async()=>{throw Object.assign(Error('GRANT_ADMISSION_DENIED'),{code:'GRANT_ADMISSION_DENIED'});},facts,check}),code('EXECUTION_GRANT_UNAVAILABLE'));
});
