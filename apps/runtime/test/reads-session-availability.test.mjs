/** The reads composer's availability answer under a session observation (selection admission before any run exists) is the
 * same gateway answer a worker reads: the real family handlers, installation receipt and policy-gated discovery, with no
 * execution identity, credential, Core data read or dispatch. Synthetic policy, role and Core transport only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createControlReadsComposer} from '../reads-composer.mjs';
import {binding,id} from '../../control/conversations/test/application-fixture.mjs';
const at=1800000000000,readOperation={id:'read_bill_text',version:'0.2.0'},scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'policy-v1'}];
const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[readOperation],maxExecuteMs:1000,maxRequestBytes:4096,maxResponseBytes:8192};
async function fixture({policy={generalReads:true,readFamilies:['bill-text'],activeReadOperations:[readOperation]}}={}){
 const calls={fetch:0,policy:[],role:0};
 const composer=await createControlReadsComposer({coreOrigin:'https://core.synthetic.invalid',familyIds:['bill-text'],defaultCongress:119,
  nativeCredentials:{nativeCredentialFor:()=>assert.fail('availability never borrows a credential')},readSecret:async()=>Buffer.from('SYNTHETIC_SERVICE'),serviceSecretFile:'synthetic',now:()=>at,newId:()=>id(90),
  fetchImpl:async()=>{calls.fetch++;assert.fail('availability never reaches Core');}});
 const expiresAtMs=at+3000,observation={binding,scopes,policyRevision:'policy-v1',selectedClientId:null,expiresAtMs};
 const current=async()=>({execution:{expiresAtMs},executionSha256:hash(observation),scopes,policyRevision:'policy-v1',selectedClientId:null});
 const read=()=>composer.readAvailability({binding,current,approvedReads,deadlineMs:expiresAtMs,
  capabilityPolicy:{async forRun(call){calls.policy.push(call);return policy;}},readCapabilityRole:async()=>{calls.role++;return {actorRole:'standard_user',checkedAtMs:at,expiresAtMs:at+120000};}});
 return {calls,read,expiresAtMs};
}
test('a session observation answers the real installation and the policy-gated discovery without any execution or Core read',async()=>{
 const f=await fixture(),snapshot=await f.read();
 assert.equal(snapshot.installation.baseCatalogSha256,hash(catalog));assert.deepEqual(snapshot.installation.operations,[readOperation]);
 assert.deepEqual(snapshot.discovery.operations,[readOperation]);assert.deepEqual(snapshot.discovery.binding,binding);assert.equal(snapshot.discovery.policyRevision,'policy-v1');
 assert.equal(snapshot.installation.expiresAtMs,f.expiresAtMs,'availability expires with the session observation');assert.equal(snapshot.discovery.expiresAtMs,f.expiresAtMs);
 assert.equal(f.calls.fetch,0);assert.equal(f.calls.role,1);assert.equal(f.calls.policy.length,1);assert.equal(f.calls.policy[0].actorRole,'standard_user');assert.equal(f.calls.policy[0].conversationId,binding.conversationId);
});
test('a policy that does not grant the family leaves the operation installed but undiscovered, which is exactly what the worker gate refuses',async()=>{
 const f=await fixture({policy:{generalReads:true,readFamilies:['mail'],activeReadOperations:[]}}),snapshot=await f.read();
 assert.deepEqual(snapshot.installation.operations,[readOperation]);assert.deepEqual(snapshot.discovery.operations,[]);
 const off=await fixture({policy:null});assert.deepEqual((await off.read()).discovery.operations,[]);
});
test('the composer refuses availability without a policy producer or a current observation',async()=>{
 const composer=await createControlReadsComposer({coreOrigin:'https://core.synthetic.invalid',familyIds:['bill-text'],defaultCongress:119,nativeCredentials:{nativeCredentialFor(){}},readSecret:async()=>Buffer.from('x'),serviceSecretFile:'synthetic',now:()=>at,newId:()=>id(90),fetchImpl:async()=>assert.fail('unused')});
 await assert.rejects(composer.readAvailability({binding,current:async()=>({}),approvedReads,deadlineMs:at+1000,readCapabilityRole:async()=>({})}),/CONFIGURATION/);
 await assert.rejects(composer.readAvailability({binding,approvedReads,deadlineMs:at+1000,capabilityPolicy:{forRun:async()=>null},readCapabilityRole:async()=>({})}),/CONFIGURATION/);
});
