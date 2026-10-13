import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createLocalActionIdentity} from '../identity.mjs';
import {createCurrentToolAuthority} from '../../authorization/current-tool-authority.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {fixture,NOW} from '../../test/fixtures.mjs';
const operation={id:'actions.query',version:'0.2.0'},contract=resolveOperationContract(operation);
const clientId='00000000-0000-4000-8000-000000000009',policy='a'.repeat(64),clone=structuredClone;
function setup(extra={}){
 const f=fixture();let clock=NOW;const config={mode:'synthetic-local',binding:f.binding,clientId,policyRevision:policy,deadlineMs:NOW+5000,
  budgets:f.claims.budgets,grants:contract.descriptor.requiredGrants,sourceEnabled:true,now:()=>clock,newId:randomUUID,...extra};
 const identity=createLocalActionIdentity(config),issued=identity.issueCredential({ttlMs:4000});
 const input=contract.normalizeInput({clientId},{binding:f.binding,clientResolution:{reference:clientId,clientId}}).input;
 const authority=createCurrentToolAuthority({ports:identity.authorityPorts,now:()=>clock,maxFactBytes:65536});
 const check=(credential=issued.credential,signal)=>authority.check({credential,descriptor:contract.descriptor,input,signal,limitDeadline:()=>{}});
 const update=(changes={})=>identity.updatePolicy({expectedRevision:identity.status().policyRevision,revision:identity.status().policyRevision,clientAllowed:true,sourceEnabled:true,grants:contract.descriptor.requiredGrants,...changes});
 return{f,config,identity,issued,input,authority,check,update,advance:n=>{clock=NOW+n;}};
}
test('local identity independent: actual canonical authority consumes owned facts and exposes no token in status',async()=>{
 const t=setup(),result=await t.check();assert.deepEqual(result.binding,t.f.binding);assert.deepEqual(result.subject.entityIds,[clientId]);
 assert.deepEqual(result.sourceIds,contract.descriptor.sourceRequirements.map(s=>s.sourceId));assert.equal(result.deadlineMs,NOW+4000);
 assert.ok(!JSON.stringify(t.identity.status()).includes(t.issued.credential));assert.ok(Object.isFrozen(t.issued.claims.binding));
});
test('local identity independent: random opaque credential is not caller-supplied claims or portable across owners',async()=>{
 const t=setup(),other=setup();assert.ok(t.issued.credential!==other.issued.credential);
 for(const token of [JSON.stringify(t.issued.claims),t.issued.capabilitySha256,other.issued.credential,t.issued.credential.slice(0,-1)+'!', 'local_action_'+'A'.repeat(43)])await assert.rejects(t.check(token),/ACCESS_DENIED/);
 assert.equal((await t.check()).binding.actorId,t.f.binding.actorId);
});
test('local identity independent: even valid credential text cannot be issued through raw claims/extra fields',()=>{
 const t=setup();for(const value of [{ttlMs:1000,claims:t.issued.claims},{ttlMs:1000,binding:t.f.binding},{ttlMs:0},{ttlMs:60001},{ttlMs:1.5}])assert.throws(()=>t.identity.issueCredential(value));
 let hits=0;assert.throws(()=>t.identity.issueCredential({get ttlMs(){hits++;return 1000;}}));assert.equal(hits,0);
 const proxy=new Proxy({}, {ownKeys(){hits++;return[];}});assert.throws(()=>t.identity.issueCredential(proxy));assert.equal(hits,0);
});
test('local identity independent: direct policy port rejects altered retained claims and normalized foreign scope',async()=>{
 const t=setup(),base={claims:t.issued.claims,operation,requiredGrants:contract.descriptor.requiredGrants,input:t.input};
 for(const mutate of [c=>c.binding.actorId='foreign',c=>c.binding.writerFence++,c=>c.policyRevision='b'.repeat(64),c=>c.scopes[0].resourceId=randomUUID(),c=>c.budgets.maxToolCalls++]){
  const claims=clone(t.issued.claims);mutate(claims);await assert.rejects(t.identity.authorityPorts.authorizeBusiness({...base,claims}));
 }
 const input=clone(t.input);input.selection.clientId=randomUUID();await assert.rejects(t.identity.authorityPorts.authorizeBusiness({...base,input}));
});
for(const [name,change] of [['client',{clientAllowed:false}],['grants',{grants:[]}],['source',{sourceEnabled:false}],['revision',{revision:'b'.repeat(64)}]])
 test(`local identity independent: current ${name} change refuses old execution`,async()=>{const t=setup();await t.check();t.update(change);await assert.rejects(t.check(),/ACCESS_DENIED/);});
test('local identity independent: expiry and explicit revoke are exact and close cannot resurrect a token',async()=>{
 const expired=setup();expired.advance(4000);await assert.rejects(expired.check(),/ACCESS_DENIED/);
 const revoked=setup();revoked.identity.revoke(revoked.issued.credential);await assert.rejects(revoked.check(),/ACCESS_DENIED/);
 const closed=setup();closed.identity.close();closed.identity.close();await assert.rejects(closed.check(),/ACCESS_DENIED/);assert.throws(()=>closed.identity.issueCredential({ttlMs:1}));assert.equal(closed.identity.status().issuedCredentials,0);
});
test('local identity independent: run replacement requires exact old binding and invalidates task A',async()=>{
 const t=setup(),b={...t.f.binding,attemptId:randomUUID(),workerId:randomUUID(),writerFence:t.f.binding.writerFence+1};
 for(const change of [{expectedBinding:{...t.f.binding,actorId:'foreign'}},{binding:{...b,tenantId:'foreign'}},{binding:{...b,writerFence:b.writerFence+1}},{deadlineMs:NOW+5001}])
  assert.throws(()=>t.identity.replaceRun({expectedBinding:t.f.binding,binding:b,policyRevision:policy,deadlineMs:NOW+5000,...change}));
 t.identity.replaceRun({expectedBinding:t.f.binding,binding:b,policyRevision:policy,deadlineMs:NOW+5000});await assert.rejects(t.check(),/ACCESS_DENIED/);
 const current=t.identity.issueCredential({ttlMs:500});const facts=await t.authority.identify({credential:current.credential,limitDeadline:()=>{}});assert.deepEqual(facts.claims.binding,b);
});
test('local identity independent: reentrant policy narrowing between real owned ports cannot become release authority',async()=>{
 const t=setup();let calls=0;const ports={...t.identity.authorityPorts,currentRun:async(...args)=>{const result=await t.identity.authorityPorts.currentRun(...args);if(++calls===1)t.identity.revoke(t.issued.credential);return result;}};
 const authority=createCurrentToolAuthority({ports,now:()=>NOW,maxFactBytes:65536});await assert.rejects(authority.check({credential:t.issued.credential,descriptor:contract.descriptor,input:t.input,limitDeadline:()=>{}}),/ACCESS_DENIED/);
});
test('local identity independent: abort remains active through actual policy/source ports',async()=>{
 const t=setup(),controller=new AbortController();controller.abort();await assert.rejects(t.check(t.issued.credential,controller.signal));
 let hits=0;const hostile=new Proxy({}, {get(){hits++;throw Error('do not inspect');}});
 await assert.rejects(t.identity.authorityPorts.verifyCapability(t.issued.credential,{signal:hostile}));assert.equal(hits,0);
});
test('local identity independent: bounded token owner refuses overflow and frees only expired or revoked issuance',()=>{
 const t=setup();for(let i=1;i<128;i++)t.identity.issueCredential({ttlMs:1000});assert.equal(t.identity.status().issuedCredentials,128);
 assert.throws(()=>t.identity.issueCredential({ttlMs:1000}),/RESOURCE_LIMIT/);t.identity.revoke(t.issued.credential);t.identity.issueCredential({ttlMs:1000});assert.equal(t.identity.status().issuedCredentials,128);
 t.advance(1000);t.identity.issueCredential({ttlMs:1000});assert.equal(t.identity.status().issuedCredentials,1);
});
