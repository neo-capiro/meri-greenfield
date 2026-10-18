/** SYNTHETIC: the execution-capability grant installer over a scripted product-namespace pool, with a production-shaped admitted
 * run and a rev 3 token signed by the synthetic production key. Proves install, idempotent replay, mismatch refusal, expiry,
 * revocation, that the EXISTING `bindTrustedGrant` accepts the installed row, and that the native admission's exact read/replay/
 * cleanup tolerates (and revokes) execution grants while still refusing any other grant on the run. No PostgreSQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {compileExecutionTrust,verifyExecutionCapability} from '../../../runtime/native-authority/execution-capability.mjs';
import {executionGrantFacts,bindExecutionGrant} from '../../../runtime/native-authority/execution-grant.mjs';
import {productionToken,productionTrust,admittedSet,ISSUED_AT,RUN_BINDING,POLICY_REVISION,QUALIFICATION,CAPABILITY_ID} from '../../../runtime/native-authority/test/execution-capability-fixture.mjs';
import {createExecutionGrantAdmission,assertExecutionGrantBinding} from '../execution-grant-admission.mjs';
import {createNativeAllocationAdmission} from '../native-allocation-admission.mjs';
import {createPostgresAdmittedRunOwner} from '../admitted-run-owner.mjs';
import {createPostgresToolBudget} from '../postgres-tool-budget.mjs';
import {BudgetStateDenied} from '../postgres-budget-store.mjs';
import {executionGrantFixture} from './execution-grant-fixture.mjs';
const denied=code=>e=>e instanceof BudgetStateDenied&&e.message===code;
const code=c=>e=>e?.code===c;
const START=ISSUED_AT*1000+1000,ADMITTED_EXPIRY=START+800000;
function harness({token=productionToken('clientAndDueDate')}={}){
 const set=admittedSet(),f=executionGrantFixture({allocation:set.allocation,facts:set.facts,expiresAtMs:ADMITTED_EXPIRY,clock:START});
 const limits={maxRequestMs:1000,maxFactBytes:65536},admitted={allocationJson:set.allocationJson,grantFactsJsons:set.grantFactsJsons};
 const installer=createExecutionGrantAdmission({pool:f.pool,...admitted,namespace:'product',now:f.now,limits});
 const verified=verifyExecutionCapability(token.credential,compileExecutionTrust(productionTrust()),{nowMs:START});
 const facts=executionGrantFacts({verified,admitted});
 const owner=()=>createPostgresToolBudget({pool:f.pool,allocationJson:set.allocationJson,namespace:'product',now:f.now});
 const bind=(value=facts)=>bindExecutionGrant({bindTrustedGrant:owner().bindTrustedGrant,facts:value,check:()=>{}});
 const native=()=>createNativeAllocationAdmission({pool:f.pool,allocationJson:set.allocationJson,binding:RUN_BINDING,qualification:{attempt:QUALIFICATION.attempt,policyRevision:POLICY_REVISION},
  grantIntents:set.facts.map(x=>({grantId:x.grantId,capabilitySha256:x.capabilitySha256,expiresAtMs:ADMITTED_EXPIRY})),now:f.now,limits});
 const run=()=>createPostgresAdmittedRunOwner({pool:f.pool,...admitted,namespace:'product',now:f.now,limits});
 return {f,set,installer,verified,facts,token,bind,native,run,limits};
}
test('install: an ACTIVE row for the token on the run\'s existing allocation, under the budget lock and the current-admission predicate, that the existing bindTrustedGrant then accepts',async()=>{
 const h=harness(),grants=()=>h.f.state().grants;
 await assert.rejects(h.bind(),code('EXECUTION_GRANT_UNAVAILABLE'),'before install the existing owner refuses: no ACTIVE row');
 const before=h.f.commands.length,receipt=await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});
 assert.deepEqual(receipt,{state:'ACTIVE',grantId:CAPABILITY_ID,expiresAtMs:h.verified.expiresAtMs,deadlineMs:receipt.deadlineMs});
 assert.ok(receipt.deadlineMs>START&&receipt.deadlineMs<=ADMITTED_EXPIRY,'the run deadline the predicate observed');
 const g=grants().get(CAPABILITY_ID),q=QUALIFICATION;
 assert.deepEqual({...g,expires_at:g.expires_at.getTime()},{grant_id:CAPABILITY_ID,run_id:RUN_BINDING.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,
  capability_sha256:createHash('sha256').update(h.token.credential).digest('hex'),expires_at:h.verified.expiresAtMs,state:'ACTIVE'});
 assert.deepEqual(h.f.state().bindings.get(CAPABILITY_ID),{grant_id:CAPABILITY_ID,run_id:RUN_BINDING.runId,facts:h.facts});
 assert.equal(grants().size,3,'the admitted task/model grants are untouched');assert.ok([...grants().values()].filter(x=>x.grant_id!==CAPABILITY_ID).every(x=>x.state==='ACTIVE'));
 const s=h.f.statements().slice(before);
 const at=prefix=>s.findIndex(x=>x.startsWith(prefix));
 assert.ok(at('SELECT * FROM meri_product_budget.budget')>=0&&at('SELECT * FROM meri_product_budget.budget')<at('INSERT INTO meri_product_budget.grants'),'budget lock before any insert');
 assert.ok(s.some(x=>x.startsWith('SELECT * FROM meri_product_budget.runs'))&&s.some(x=>x.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations')),'run and allocation currency read first');
 assert.equal(s[s.length-1],'COMMIT');
 await h.bind();
 assert.equal(JSON.parse(await h.run().currentRun(RUN_BINDING,{})).binding.runId,RUN_BINDING.runId,'the admitted-run owner still answers over the admitted set');
});
test('idempotent per grant id: a replay with the same facts and expiry answers the same ACTIVE row and writes nothing new',async()=>{
 const h=harness();const first=await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});
 const snapshot=structuredClone(h.f.state());h.f.setClock(START+5000);
 const again=await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});
 assert.deepEqual({...again,deadlineMs:0},{...first,deadlineMs:0});assert.deepEqual(h.f.state(),snapshot);
 await Promise.all([h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs}),h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs})]);
 assert.deepEqual(h.f.state(),snapshot,'concurrent replays serialize on the budget lock and leave one row');
});
test('the same grant id with another binding, qualification, token digest or expiry is refused and the stored facts never change; admitted grants are never reused',async()=>{
 const h=harness();await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});const snapshot=structuredClone(h.f.state());
 const digest='f'.repeat(64),before=()=>h.f.commands.length;
 // Pre-SQL refusals: facts that are not this run's exact binding/qualification, or that reuse an admitted grant id or digest.
 for(const facts of [{...h.facts,binding:{...RUN_BINDING,attemptId:'00000000-0000-4000-8000-000000000003'}},{...h.facts,qualificationBinding:{...QUALIFICATION,attempt:2}},
  {...h.facts,grantId:h.set.facts[0].grantId},{...h.facts,capabilitySha256:h.set.facts[1].capabilitySha256},{...h.facts,allocationSha256:'e'.repeat(64)},{...h.facts,extra:1}]){
  const n=before();await assert.rejects(h.installer.install({facts,expiresAtMs:h.verified.expiresAtMs}),denied('EXECUTION_GRANT_REFUSED'));assert.equal(h.f.commands.length,n,'no SQL');
 }
 // Conflicts read back inside the transaction: same id, different digest or expiry; another id with this token's digest.
 await assert.rejects(h.installer.install({facts:{...h.facts,capabilitySha256:digest},expiresAtMs:h.verified.expiresAtMs}),denied('EXECUTION_GRANT_CONFLICT'));
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs-1000}),denied('EXECUTION_GRANT_CONFLICT'));
 await assert.rejects(h.installer.install({facts:{...h.facts,grantId:'0d2f4c6e-1a3b-4c5d-8e7f-9a0b1c2d3e4f'},expiresAtMs:h.verified.expiresAtMs}),denied('EXECUTION_GRANT_CONFLICT'));
 assert.deepEqual(h.f.state(),snapshot,'facts are immutable: nothing was updated or added');
 assert.equal(h.f.statements().some(x=>x.startsWith('UPDATE')),false,'install never updates a row');
});
test('expiry: the row expires with the token exp, never later than the schedule, and an expired execution grant is refused by the existing owner while the admitted set stays current',async()=>{
 const h=harness(),n=h.f.commands.length;
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:START}),denied('EXECUTION_GRANT_REFUSED'));
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:Date.parse(h.set.allocation.schedule.expiresAt)+1}),denied('EXECUTION_GRANT_REFUSED'));
 assert.equal(h.f.commands.length,n);
 await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});
 assert.equal(h.f.state().grants.get(CAPABILITY_ID).expires_at.getTime(),(ISSUED_AT+120)*1000,'exactly the signed exp');
 h.f.setClock(h.verified.expiresAtMs);
 await assert.rejects(h.bind(),code('EXECUTION_GRANT_UNAVAILABLE'),'GRANT_ADMISSION_DENIED past exp');
 assert.equal(JSON.parse(await h.run().currentRun(RUN_BINDING,{})).binding.runId,RUN_BINDING.runId,'the run itself is still admitted');
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs}),denied('EXECUTION_GRANT_REFUSED'),'no re-install of an expired token');
});
test('a run that is not current (quarantined budget, missing admitted grant, other allocation) installs nothing',async()=>{
 const h=harness();
 h.f.state().budget.quarantined=true;await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs}),denied('ADMITTED_RUN_REFUSED'));h.f.state().budget.quarantined=false;
 const model=h.f.state().grants.get(h.set.facts[0].grantId);model.state='REVOKED';
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs}),denied('ADMITTED_RUN_REFUSED'));model.state='ACTIVE';
 h.f.state().allocations.get(RUN_BINDING.runId).allocation_sha256='d'.repeat(64);
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs}),denied('ADMITTED_RUN_REFUSED'));
 assert.equal(h.f.state().grants.has(CAPABILITY_ID),false);assert.equal(h.f.state().bindings.has(CAPABILITY_ID),false);
 const ac=new AbortController();ac.abort();await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs,signal:ac.signal}),denied('EXECUTION_GRANT_STOPPED'));
 for(const bad of [{pool:{}},{namespace:'qualification'},{limits:{maxRequestMs:0,maxFactBytes:1}}])
  assert.throws(()=>createExecutionGrantAdmission({pool:h.f.pool,allocationJson:h.set.allocationJson,grantFactsJsons:h.set.grantFactsJsons,now:h.f.now,limits:h.limits,...bad}),denied('EXECUTION_GRANT_CONFIGURATION'));
});
test('revocation: execution grants revoke under the budget lock, never the admitted set; a revoked grant never comes back',async()=>{
 const h=harness();await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});
 const second=productionToken('nullClientAndDueDate',{capabilityId:'3e5a7c9b-1d2f-4a6b-8c0d-2e4f6a8b0c1d',proposal:productionToken('nullClientAndDueDate').proposal});
 const facts2=executionGrantFacts({verified:verifyExecutionCapability(second.credential,compileExecutionTrust(productionTrust()),{nowMs:START}),admitted:{allocationJson:h.set.allocationJson,grantFactsJsons:h.set.grantFactsJsons}});
 await h.installer.install({facts:facts2,expiresAtMs:(ISSUED_AT+120)*1000});
 await assert.rejects(h.installer.revoke({grantId:h.set.facts[0].grantId}),denied('EXECUTION_GRANT_REFUSED'),'an admitted grant is never an execution grant');
 await assert.rejects(h.installer.revoke({grantId:'0d2f4c6e-1a3b-4c5d-8e7f-9a0b1c2d3e4f'}),denied('EXECUTION_GRANT_UNKNOWN'));
 assert.deepEqual(await h.installer.revoke({grantId:CAPABILITY_ID}),{state:'REVOKED',grantIds:[CAPABILITY_ID]});
 assert.equal(h.f.state().grants.get(CAPABILITY_ID).state,'REVOKED');assert.equal(h.f.state().grants.get(facts2.grantId).state,'ACTIVE');
 await assert.rejects(h.bind(),code('EXECUTION_GRANT_UNAVAILABLE'));await h.bind(facts2);
 await assert.rejects(h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs}),denied('EXECUTION_GRANT_REVOKED'));
 h.f.state().budget.quarantined=true;h.f.setClock(ADMITTED_EXPIRY+1);
 // Without a grant id every execution grant of the run is REVOKED (idempotent: already revoked ones are reported too).
 assert.deepEqual(await h.installer.revoke(),{state:'REVOKED',grantIds:[facts2.grantId,CAPABILITY_ID]},'revocation works after expiry and quarantine');
 assert.ok(h.set.facts.every(x=>h.f.state().grants.get(x.grantId).state==='ACTIVE'),'the admitted set is the native admission\'s to revoke');
 assert.equal(h.f.state().grants.get(facts2.grantId).state,'REVOKED');
 assert.deepEqual(await h.installer.revoke(),{state:'REVOKED',grantIds:[facts2.grantId,CAPABILITY_ID]},'idempotent');
});
test('native admission: exact read/replay tolerates installed execution grants, still refuses any other grant on the run, and run-terminal cleanup revokes the admitted set and the execution grants together',async()=>{
 const h=harness(),native=h.native(),taskArn=QUALIFICATION.workerArn;
 assert.equal((await native.read({taskArn})).state,'ADMITTED');
 await h.installer.install({facts:h.facts,expiresAtMs:h.verified.expiresAtMs});
 const read=await native.read({taskArn});assert.equal(read.state,'ADMITTED');
 assert.deepEqual(read.grantFactsJsons,h.set.grantFactsJsons,'the admitted set is reported unchanged');
 assert.equal((await native.admit({taskArn})).state,'ADMITTED','exact replay');
 // A grant row that is not bound to this run's allocation and qualification is still a conflict (unbound, foreign binding, foreign run).
 const foreign={...structuredClone(h.f.state().grants.get(CAPABILITY_ID)),grant_id:'0d2f4c6e-1a3b-4c5d-8e7f-9a0b1c2d3e4f',capability_sha256:'a'.repeat(64)};
 for(const bound of [null,{grant_id:foreign.grant_id,run_id:RUN_BINDING.runId,facts:{...h.facts,grantId:foreign.grant_id,capabilitySha256:'b'.repeat(64)}},
  {grant_id:foreign.grant_id,run_id:RUN_BINDING.runId,facts:{...h.facts,grantId:foreign.grant_id,capabilitySha256:'a'.repeat(64),qualificationBinding:{...QUALIFICATION,attempt:2}}},
  {grant_id:foreign.grant_id,run_id:'00000000-0000-4000-8000-000000000002',facts:{...h.facts,grantId:foreign.grant_id,capabilitySha256:'a'.repeat(64)}}]){
  h.f.state().grants.set(foreign.grant_id,structuredClone(foreign));if(bound)h.f.state().bindings.set(foreign.grant_id,structuredClone(bound));
  await assert.rejects(native.read({taskArn}),denied('NATIVE_ADMISSION_CONFLICT'));await assert.rejects(native.admit({taskArn}),denied('NATIVE_ADMISSION_CONFLICT'));
  assert.throws(()=>assertExecutionGrantBinding({grant:foreign,bound,allocation:h.set.allocation,mapping:QUALIFICATION}),denied('NATIVE_ADMISSION_CONFLICT'));
  h.f.state().grants.delete(foreign.grant_id);h.f.state().bindings.delete(foreign.grant_id);
 }
 assert.deepEqual(assertExecutionGrantBinding({grant:h.f.state().grants.get(CAPABILITY_ID),bound:h.f.state().bindings.get(CAPABILITY_ID),allocation:h.set.allocation,mapping:QUALIFICATION}),h.facts);
 assert.equal((await native.read({taskArn})).state,'ADMITTED');
 const proof=await native.revoke({taskArn});assert.equal(proof.revocationProven,true);assert.deepEqual(proof.grantIds,h.set.facts.map(x=>x.grantId));
 assert.ok([...h.f.state().grants.values()].every(g=>g.state==='REVOKED'),'admitted and execution grants are all REVOKED');
 assert.equal((await native.revoke({taskArn})).revocationProven,true,'cleanup replay');
 await assert.rejects(h.bind(),code('EXECUTION_GRANT_UNAVAILABLE'));
});
test('the verified token\'s own facts are the grant facts (hash equality), so a composition cannot install for another run',()=>{
 const h=harness();
 assert.equal(h.facts.allocationSha256,hash(h.set.allocation));assert.deepEqual(h.facts.qualificationBinding,QUALIFICATION);assert.equal(h.facts.grantId,h.verified.claims.capabilityId);
 assert.equal(h.facts.capabilitySha256,h.verified.credentialSha256);assert.deepEqual(h.facts.binding,RUN_BINDING);
});
