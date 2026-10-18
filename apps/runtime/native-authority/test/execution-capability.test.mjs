/** SYNTHETIC: Core's DRAFT rev 3 execution-capability codec vector (capiro-backend #84 0304b0ef
 * `docs/integration/meri-execution-capability.vector.json`, copied verbatim) and Meri's production-shaped vector, verified by
 * Meri's own verifier. Keys are synthetic. No Core, network or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {commandSourceBody} from '../../../control/commands/source-projection.mjs';
import {compileExecutionTrust,verifyExecutionCapability,assertExecutionCorrelation,executionBodyBinding,capabilityBudgets,executionRequestId,executionHeader,EXECUTION_KEYS,QUALIFICATION_KEYS} from '../execution-capability.mjs';
import {signExecution,productionToken,productionTrust,productionProposal,productionDecision,CASES,ISSUED_AT,RUN_BINDING,BUDGETS,POLICY_REVISION,QUALIFICATION,PRODUCTION_SEED_HEX,PRODUCTION_KID,keyFromSeed} from './execution-capability-fixture.mjs';
const json=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const core=json('./execution-capability.core-vector.json'),production=json('./execution-capability.production-vector.json');
const code=c=>e=>e?.code===c;
const coreTrust=()=>compileExecutionTrust({issuer:core.key.issuer,keys:[core.key.publicJwk]});
const AT=ISSUED_AT*1000+1000;
test('Core rev 3 golden vector: Meri verifies the exact claims JSON, execution request, expiry, the closed 13-member execution and every recomputed digest',()=>{
 const v=verifyExecutionCapability(core.expected.credential,coreTrust(),{nowMs:core.inputs.nowMs});
 assert.equal(v.claimsJson,core.expected.claimsJson);assert.equal(hash(v.request),hash(core.expected.execution));assert.equal(v.expiresAtMs,core.expected.expiresAtMs);
 assert.deepEqual(Object.keys(v.execution).sort(),[...EXECUTION_KEYS]);assert.deepEqual(Object.keys(v.execution.qualification).sort(),[...QUALIFICATION_KEYS].sort());
 assert.deepEqual(JSON.parse(JSON.stringify(v.execution)),core.expected.payload.execution,'the verified execution is the signed member, byte for byte');
 assert.equal(v.execution.argumentsSha256,hash(core.inputs.proposal.command.arguments));assert.equal(v.execution.decisionSha256,hash(core.inputs.decision));
 assert.equal(v.execution.allocationSha256,hash(core.inputs.allocation));assert.deepEqual(v.execution.qualification,core.inputs.qualification);
 assert.match(v.claims.policyRevision,/^[a-f0-9]{64}$/u);
 // Production-shaped since rev 3: closed task arguments project to Meri's exact Core body, so the trusted comparison succeeds
 // against the proposal, executor binding, request id, decision, allocation digest and qualification facts.
 const body=assertExecutionCorrelation({verified:v,proposal:core.inputs.proposal,executorBinding:core.inputs.executorBinding,requestId:core.inputs.requestId,decision:core.inputs.decision,allocationSha256:hash(core.inputs.allocation),qualification:core.inputs.qualification});
 assert.equal(body.sourceBodySha256,v.execution.sourceBodySha256);assert.equal(body.argumentsSha256,v.execution.argumentsSha256);
 assert.notEqual(body.sourceBodySha256,body.argumentsSha256,'dueDate null is dropped from the Core body');
 for(const extra of [{allocationSha256:'e'.repeat(64)},{qualification:{...core.inputs.qualification,attempt:3}},{qualification:{...core.inputs.qualification,workerArn:core.inputs.qualification.workerArn.replace(/0123/u,'4567')}}])
  assert.throws(()=>assertExecutionCorrelation({verified:v,proposal:core.inputs.proposal,...extra}),code('EXECUTION_CAPABILITY_MISMATCH'),JSON.stringify(extra));
});
test('Meri signer reproduces Core rev 3 golden vector byte-for-byte from Core synthetic seed (budgets copied from the allocation)',()=>{
 const i=core.inputs,t=signExecution({seedHex:core.key.seedHex,issuer:core.key.issuer,kid:core.key.kid,proposal:i.proposal,decision:i.decision,executorBinding:i.executorBinding,requestId:i.requestId,capabilityId:i.capabilityId,allocation:i.allocation,qualification:i.qualification,iat:Math.floor(i.nowMs/1000),exp:core.expected.payload.exp});
 assert.equal(t.credential,core.expected.credential);assert.deepEqual(t.payload,core.expected.payload);
});
test('production-shaped vector: 64-hex policy revision, realistic task arguments, pinned bytes; argumentsSha256 and the source body bound separately',()=>{
 assert.equal(production.key.publicJwk.x,keyFromSeed(PRODUCTION_SEED_HEX,PRODUCTION_KID).publicJwk.x);
 const trust=compileExecutionTrust({issuer:production.key.issuer,keys:[production.key.publicJwk]});
 for(const [name,c] of Object.entries(production.cases)){
  const t=productionToken(name,{allocation:production.inputs.allocation});
  assert.equal(t.credential,c.expected.credential,`${name} bytes are deterministic`);
  const v=verifyExecutionCapability(c.expected.credential,trust,{nowMs:AT});
  assert.equal(v.claimsJson,c.expected.claimsJson);assert.match(v.claims.policyRevision,/^[a-f0-9]{64}$/u);assert.equal(v.claims.policyRevision,POLICY_REVISION);
  assert.deepEqual(JSON.parse(v.claimsJson).budgets,BUDGETS);assert.equal(v.credentialSha256,c.expected.credentialSha256);
  const body=assertExecutionCorrelation({verified:v,proposal:c.proposal,executorBinding:c.executorBinding,requestId:c.requestId,decision:c.decision,allocationSha256:production.inputs.allocationSha256,qualification:production.inputs.qualification});
  assert.equal(body.argumentsSha256,c.expected.argumentsSha256);assert.equal(body.sourceBodySha256,c.expected.sourceBodySha256);assert.equal(body.sourceTool,'create_task');
  assert.equal(v.execution.sourceBodySha256,c.expected.sourceBodySha256);assert.equal(v.execution.allocationSha256,c.expected.allocationSha256);assert.deepEqual(v.execution.qualification,c.expected.qualification);
  assert.equal(c.expected.allocationSha256,hash(production.inputs.allocation));assert.deepEqual(c.expected.qualification,QUALIFICATION);
  assert.deepEqual(commandSourceBody(c.proposal.command,[]),c.expected.sourceBody);
 }
 const full=production.cases.clientAndDueDate.expected,bare=production.cases.nullClientAndDueDate.expected;
 assert.equal(full.argumentsSha256,full.sourceBodySha256,'with a client and due date the Core body is the arguments');
 assert.notEqual(bare.argumentsSha256,bare.sourceBodySha256,'null clientId/dueDate are omitted from the Core body: a body hash is NOT argumentsSha256');
 assert.deepEqual(Object.keys(bare.sourceBody),['title']);
 assert.equal(executionBodyBinding(production.cases.nullClientAndDueDate.proposal.command).sourceBodySha256,bare.sourceBodySha256);
});
test('verification refuses every malleation, foreign key, time and claim inconsistency',()=>{
 const trust=compileExecutionTrust(productionTrust()),good=productionToken('clientAndDueDate'),[h,p,s]=good.credential.split('.');
 const refused=(credential,nowMs=AT)=>assert.throws(()=>verifyExecutionCapability(credential,trust,{nowMs}),code('EXECUTION_CAPABILITY_REFUSED'));
 refused(`${h}.${p}.${Buffer.alloc(64).toString('base64url')}`);
 refused(`${Buffer.from(JSON.stringify({typ:'capiro-meri-execution+jwt',alg:'EdDSA',kid:PRODUCTION_KID})).toString('base64url')}.${p}.${s}`);
 refused(`${Buffer.from(executionHeader('other-kid')).toString('base64url')}.${p}.${s}`);
 refused(`${h}.${Buffer.from(JSON.stringify(JSON.parse(Buffer.from(p,'base64url').toString()),null,1)).toString('base64url')}.${s}`);
 refused(good.credential+'=');refused(good.credential.replace(/\.[^.]*$/u,''));
 refused(good.credential,ISSUED_AT*1000+120000);refused(good.credential,ISSUED_AT*1000-1);
 assert.equal(verifyExecutionCapability(good.credential,trust,{nowMs:ISSUED_AT*1000-500,skewMs:1000}).request.capabilityId,good.execution.capabilityId);
 const signed=mutate=>productionToken('clientAndDueDate',{mutate}).credential;
 refused(productionToken('clientAndDueDate',{exp:ISSUED_AT+121}).credential);
 refused(signed(x=>{x.nbf=x.iat-1;return x;}));refused(signed(x=>{x.aud='meri-broker';return x;}));refused(signed(x=>{x.iss='other';return x;}));
 refused(signed(x=>{x.capability.actions=['command.execute','tool.read'];return x;}));refused(signed(x=>{x.capability.capabilityId='00000000-0000-4000-8000-000000000001';return x;}));
 refused(signed(x=>{x.capability.scopes[0].policyRevision='b'.repeat(64);return x;}));refused(signed(x=>{x.execution.clientIds=[];return x;}));
 refused(signed(x=>{x.execution.requestSha256='c'.repeat(64);return x;}));refused(signed(x=>{x.execution.action='task.update';return x;}));
 refused(signed(x=>{x.execution.approver={tenantId:x.execution.approver.tenantId,actorId:'user_other'};return x;}));refused(signed(x=>{x.extra=1;return x;}));
 // Rev 3 members are required, closed and self-consistent; the rev 1 ten-member execution is no longer accepted.
 refused(signed(x=>{delete x.execution.qualification;return x;}));refused(signed(x=>{delete x.execution.allocationSha256;return x;}));refused(signed(x=>{delete x.execution.sourceBodySha256;return x;}));
 refused(signed(x=>{x.execution.qualification.fence=2;return x;}));refused(signed(x=>{x.execution.qualification.runId='00000000-0000-4000-8000-000000000002';return x;}));
 refused(signed(x=>{x.execution.qualification.policyRevision='c'.repeat(64);return x;}));refused(signed(x=>{x.execution.qualification.attempt='1';return x;}));
 refused(signed(x=>{x.execution.qualification.workerArn='arn:aws:ecs:us-east-1:967807252336:task/meri-preview/not-hex';return x;}));refused(signed(x=>{x.execution.qualification.extra=1;return x;}));
 refused(signed(x=>{x.execution.allocationSha256='E'.repeat(64);return x;}));refused(signed(x=>{x.execution.extra=1;return x;}));
 refused(signExecution({...good,seedHex:'1'.repeat(64),requestId:good.requestId,capabilityId:good.execution.capabilityId,budgets:BUDGETS,iat:ISSUED_AT,exp:ISSUED_AT+120}).credential);
});
test('correlation refuses a valid token for another proposal, executor binding, request, argument set, decision, allocation digest, qualification or source body',()=>{
 const trust=compileExecutionTrust(productionTrust()),t=productionToken('clientAndDueDate'),v=verifyExecutionCapability(t.credential,trust,{nowMs:AT});
 const mismatch=fn=>assert.throws(fn,code('EXECUTION_CAPABILITY_MISMATCH'));
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:t.proposal,allocationSha256:'e'.repeat(64)}));
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:t.proposal,qualification:{...QUALIFICATION,attempt:2}}));
 // A valid signature over a foreign source-body digest never correlates: the body is Meri's own projection of the command.
 const foreignBody=verifyExecutionCapability(productionToken('clientAndDueDate',{mutate:x=>{x.execution.sourceBodySha256='f'.repeat(64);return x;}}).credential,trust,{nowMs:AT});
 mismatch(()=>assertExecutionCorrelation({verified:foreignBody,proposal:t.proposal}));
 assertExecutionCorrelation({verified:v,proposal:t.proposal,allocationSha256:hash(t.allocation),qualification:QUALIFICATION});
 const other=productionProposal({...CASES.clientAndDueDate,title:'Something else'});
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:other}));
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:t.proposal,executorBinding:{...RUN_BINDING,writerFence:2}}));
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:t.proposal,requestId:'00000000-0000-4000-8000-000000000009'}));
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:t.proposal,decision:{...t.decision,decidedAt:'2026-10-18T14:01:42.000Z'}}));
 mismatch(()=>assertExecutionCorrelation({verified:v,proposal:t.proposal,decision:{...t.decision,decision:'rejected'}}));
 assertExecutionCorrelation({verified:v,proposal:t.proposal,executorBinding:RUN_BINDING,requestId:t.requestId,decision:productionDecision(t.proposal)});
});
test('budgets copy the admitted-run owner currentAllocation exactly (maxCostMicroUSD -> maxCostMicrousd) with allocation hash and tariffs',()=>{
 const allocation={run:{tenantId:RUN_BINDING.tenantId,actorId:RUN_BINDING.actorId,conversationId:RUN_BINDING.conversationId,runId:RUN_BINDING.runId},
  budgets:{maxTurns:3,maxToolCalls:1,maxRecoveryAttempts:0,maxRuntimeSeconds:900,maxCostMicroUSD:2000000,maxOutputBytes:262144},schedule:{revision:'d'.repeat(64),expiresAt:'2026-10-18T15:00:00.000Z',operations:[{operation:{id:'create_task',version:'0.2.0'},chargeMicrousd:1000}]}};
 const current={binding:RUN_BINDING,policyRevision:POLICY_REVISION,deadlineMs:AT+60000,checkedAtMs:AT,allocation,allocationSha256:hash(allocation)};
 const b=capabilityBudgets(JSON.stringify(current));
 assert.deepEqual(b.budgets,BUDGETS);assert.equal(b.allocationSha256,hash(allocation));assert.equal(b.tariffsSha256,hash(allocation.schedule.operations));assert.equal(b.scheduleRevision,'d'.repeat(64));
 for(const bad of [{...current,allocationSha256:'e'.repeat(64)},{...current,policyRevision:'policy-r1'},{...current,allocation:{...allocation,budgets:{...allocation.budgets,maxCostMicroUSD:0}},allocationSha256:hash({...allocation,budgets:{...allocation.budgets,maxCostMicroUSD:0}})},{...current,extra:1}])
  assert.throws(()=>capabilityBudgets(JSON.stringify(bad)),code('EXECUTION_ALLOCATION_REFUSED'));
});
test('request ids are UUIDv4-shaped, deterministic per proposal and executor binding, and differ across attempts',()=>{
 const p=productionProposal(CASES.clientAndDueDate),a=executionRequestId({proposalId:p.proposalId,commandSha256:p.commandSha256,executorBinding:RUN_BINDING});
 assert.match(a,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
 assert.equal(a,executionRequestId({proposalId:p.proposalId,commandSha256:p.commandSha256,executorBinding:{...RUN_BINDING}}));
 assert.notEqual(a,executionRequestId({proposalId:p.proposalId,commandSha256:p.commandSha256,executorBinding:{...RUN_BINDING,writerFence:2}}));
});
