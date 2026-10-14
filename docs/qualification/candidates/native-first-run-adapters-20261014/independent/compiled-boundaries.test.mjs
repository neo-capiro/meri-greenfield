import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeFirstRunPorts} from '../../../../../apps/runtime/native-authority/first-run-ports.mjs';
import {createNativeTaskAuthority} from '../../../../../apps/runtime/native-authority/task-authority.mjs';
import {fixture,NOW,id} from '../../../../../apps/runtime/native-authority/test/fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';

function joined(revokedInLease=false){
 const f=fixture(),state={leased:false,currentReads:0,inLeaseChecks:0,replacements:0},scopes=[{tenantId:f.binding.tenantId,kind:'client',resourceId:id(6),policyRevision:'policy'}];
 class Admission{
  async currentRun(binding){assert.equal(this,state.admission);assert.equal(state.leased,false,'identity join cannot reacquire a held allocation lease');state.currentReads++;return JSON.stringify({binding,policyRevision:'policy',deadlineMs:NOW+4000,checkedAtMs:NOW});}
  async withCurrentAllocation(call,effect){assert.equal(this,state.admission);return f.admission.withCurrentAllocation(call,async value=>{assert.equal(state.leased,false);state.leased=true;try{return await effect(value);}finally{state.leased=false;}});}
 }
 class Native{async call(path,input){assert.equal(this,state.native);assert.equal(path,'worker/authorize');if(state.leased){state.inLeaseChecks++;if(revokedInLease)throw Error('synthetic native revocation');}return {binding:f.binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:'synthetic-identity',scopes,selectedClientId:id(6),policyRevision:'policy',authorizationDecisionId:'synthetic-native-decision',checkedAtMs:NOW,expiresAtMs:NOW+3000};}}
 class Observation{async read(){assert.equal(this,state.observation);return {binding:f.binding,key:f.key,sdkVersion:'0.3.295',cliVersion:'2.1.295',observationId:'independent-synthetic-observation',sessionEventSha256:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+2500};}}
 state.admission=new Admission();state.native=new Native();state.observation=new Observation();
 const principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId};
 const identity={origin:'https://authority.synthetic.invalid',commandContext:{binding:f.binding,clientResolution:{reference:id(6),clientId:id(6)}},async fetchImpl(url,options){const input=JSON.parse(options.body);return Response.json(url.endsWith('/identity')?{principal,identityRevision:'synthetic',checkedAtMs:NOW,expiresAtMs:NOW+3000}:{principal,identityRevision:'synthetic',identitySha256:input.identitySha256,conversationId:f.binding.conversationId,selectedClientId:id(6),contextRevision:'synthetic',checkedAtMs:NOW,expiresAtMs:NOW+3000});}};
 const ports=createNativeFirstRunPorts({identity,admission:state.admission,native:state.native,registration:state.observation,enabled:true,now:()=>NOW,limits:{maxRequestMs:100,maxFactBytes:65536}});
 // Replacements must never run: compiled owners retain exact methods + receivers.
 for(const [proto,name] of [[Admission.prototype,'currentRun'],[Admission.prototype,'withCurrentAllocation'],[Native.prototype,'call'],[Observation.prototype,'read']])Object.defineProperty(proto,name,{get(){state.replacements++;throw Error('replacement must not run');}});
 return {f,state,ports};
}
test('compiled methods survive prototype replacement and share one admitted current owner without lease reacquisition',async()=>{
 const {f,state,ports}=joined();assert.deepEqual(Object.keys(ports).sort(),['identityContext','sdkSessionOwner']);assert.equal(state.currentReads,0);
 const identity=await ports.identityContext.verifyIdentity({credential:'synthetic',deadlineMs:NOW+100});
 const context=await ports.identityContext.resolveContext({identityCredential:'synthetic',identity,identitySha256:hash(identity),hints:{},deadlineMs:NOW+100});
 assert.deepEqual(context.binding,f.binding);assert.equal(state.currentReads,2);
 await ports.sdkSessionOwner.register({credential:'synthetic-task',request:{binding:f.binding,key:f.key}});
 assert.equal(state.currentReads,2);assert.equal(state.inLeaseChecks,1);assert.equal(state.replacements,0);assert.equal(f.state().owner.owner.observationId,'independent-synthetic-observation');
});
test('native revocation during existing allocation lease refuses release and fixture rollback retains no registered owner',async()=>{
 const {f,state,ports}=joined(true);await assert.rejects(ports.sdkSessionOwner.register({credential:'synthetic-task',request:{binding:f.binding,key:f.key}}));
 assert.equal(state.inLeaseChecks,1);assert.equal(f.state().owner,null);assert.equal(state.currentReads,0);assert.equal(state.replacements,0);
});
test('caller cancellation aborts in-flight native verifier without a retry or accepted authority',async()=>{
 const f=fixture(),controller=new AbortController(),entered=Promise.withResolvers();let calls=0;
 const authority=createNativeTaskAuthority({enabled:true,now:()=>NOW,native:{call(_path,_input,{signal}){calls++;entered.resolve(signal);return new Promise(()=>{});}}});
 const work=authority.verify({capability:'synthetic-task',binding:f.binding,operation:'load',inputSha256:'a'.repeat(64),signal:controller.signal});
 const refusal=assert.rejects(work,{code:'WORKER_AUTHORITY_REFUSED'});const transported=await entered.promise;controller.abort();await refusal;assert.equal(transported.aborted,true);assert.equal(calls,1);
});
