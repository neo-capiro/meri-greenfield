/** The composed selection admission decides availability from the real inputs the worker mounts from: the reads composer's
 * availability answer for the session's authority, the run capability policy for the session's Core role, and the worker's own
 * availability gate. Scripted composer, policy and role; the real admission owner, store and gate. No database, Core or provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {createNativeSelectedComposition} from '../composition.mjs';
import {createPostgresConversationStore} from '../../../control/conversations/postgres-store.mjs';
import {binding,id} from '../../../control/conversations/test/store-fixture.mjs';
const denied=()=>assert.fail('admission must not query, authenticate an execution or serve a run');
const mail=selectSkill('quick_skill.mail_history','1.0.1'),NOW=1800000000000,now=()=>NOW;
const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'policy-1'}];
const request={requestId:id(60),prompt:'Summarize the last three email threads',skill:mail.pin,window:{basis:'unbounded'},windowRequest:null};
const approvedReads={enabled:true,operations:mail.manifest.allowedOperations,maxRequestBytes:65536,maxResponseBytes:1048576,maxExecuteMs:3000};
function fixture({installed=mail.manifest.allowedOperations,discovered=installed,policy={generalReads:true,readFamilies:['mail','entity-candidates','tenant-contacts'],activeReadOperations:mail.manifest.allowedOperations,skillPlugin:true},role='standard_user'}={}){
 const calls={availability:[],policy:[],role:[]};
 const pool={query:denied,connect:denied,options:{connectionTimeoutMillis:25000,query_timeout:25000}};
 const selected=createNativeSelectedComposition({configuration:{agentcore:{approvedReads},reads:{defaultCongress:119},limits:{requestMs:25000}},pool,store:createPostgresConversationStore({pool}),execution:{authenticate:denied},
  createReadsRuntime:denied,serviceFor:denied,now,
  async readAvailability(call){calls.availability.push(call);const observed=await call.current();assert.deepEqual(observed.scopes,scopes);assert.equal(observed.policyRevision,'policy-1');assert.equal(observed.selectedClientId,null);
   assert.deepEqual(await call.readCapabilityRole(),{actorRole:role,checkedAtMs:NOW,expiresAtMs:NOW+120000});assert.equal(call.approvedReads,approvedReads);
   return {installation:{installationId:id(80),baseCatalogSha256:hash(catalog),executionCatalogSha256:'e'.repeat(64),operations:installed,checkedAtMs:NOW,expiresAtMs:observed.execution.expiresAtMs},discovery:{binding,policyRevision:'policy-1',operations:discovered,checkedAtMs:NOW,expiresAtMs:observed.execution.expiresAtMs}};},
  capabilityPolicy:{async forRun(call){calls.policy.push(call);return policy;}},
  async readSessionCapabilityRole(call){calls.role.push(call);return {actorRole:role,checkedAtMs:NOW,expiresAtMs:NOW+120000};}});
 return {selected,calls,admit:()=>selected.ports.selectedSkillAdmission.admitSelection({binding,request,scopes,selectedClientId:null,deadlineMs:NOW+5000})};
}
test('General Mail History is admitted from the session role, the composer availability and the policy, each asked once per admission',async()=>{
 const f=fixture();try{const receipt=await f.admit();assert.deepEqual(receipt.skill,mail.pin);assert.equal(receipt.selectedClientId,null);assert.equal(receipt.expiresAtMs,NOW+3000,'the receipt expires with the admission request bound, inside the session authority');
  assert.equal(f.calls.role.length,1);assert.deepEqual(f.calls.role[0].scopes,scopes);assert.equal(f.calls.role[0].selectedClientId,null);assert.equal(f.calls.role[0].deadlineMs,NOW+3000,'the role read is bounded by the admission request bound');
  assert.equal(f.calls.availability.length,1);assert.equal(f.calls.availability[0].deadlineMs,NOW+3000,'availability is bounded by the admission request bound, the session authority and the role expiry');
  assert.equal(f.calls.policy.length,1);const {signal,...policyCall}=f.calls.policy[0];assert.ok(signal instanceof AbortSignal,'the policy read runs under the admission lifetime');
  assert.deepEqual(policyCall,{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,actorRole:'standard_user'});
 }finally{await f.selected.close();}
});
for(const [name,changes,sources] of [
 ['mail reads not installed',{installed:mail.manifest.allowedOperations.filter(op=>!op.id.startsWith('mail.'))},['mail']],
 ['mail reads installed but not discovered for this actor',{discovered:mail.manifest.allowedOperations.filter(op=>!op.id.startsWith('mail.'))},['mail']],
 ['policy without general reads',{policy:{skillPlugin:true}},['entity_candidates','tenant_contacts','mail']],
 ['policy excludes the mail family',{policy:{generalReads:true,readFamilies:['entity-candidates','tenant-contacts'],activeReadOperations:mail.manifest.allowedOperations.filter(op=>!op.id.startsWith('mail.')),skillPlugin:true}},['mail']],
 ['no capability policy for this tenant',{policy:null},['entity_candidates','tenant_contacts','mail']],
])test(`${name}: refused before any run with SKILL_SOURCES_UNAVAILABLE naming the uncovered required sources`,async()=>{
 const f=fixture(changes);try{await assert.rejects(f.admit(),error=>error.code==='SKILL_SOURCES_UNAVAILABLE'&&JSON.stringify(error.sources)===JSON.stringify(sources));}finally{await f.selected.close();}
});
test('without the session producers the composition admits no selection: every operation is unavailable',async()=>{
 const pool={query:denied,connect:denied,options:{connectionTimeoutMillis:25000,query_timeout:25000}};
 const selected=createNativeSelectedComposition({configuration:{agentcore:{approvedReads},reads:{defaultCongress:119},limits:{requestMs:25000}},pool,store:createPostgresConversationStore({pool}),execution:{authenticate:denied},createReadsRuntime:denied,serviceFor:denied,now});
 try{await assert.rejects(selected.ports.selectedSkillAdmission.admitSelection({binding,request,scopes,selectedClientId:null,deadlineMs:NOW+5000}),error=>error.code==='SKILL_SOURCES_UNAVAILABLE'&&JSON.stringify(error.sources)==='["entity_candidates","tenant_contacts","mail"]');}
 finally{await selected.close();}
 assert.throws(()=>createNativeSelectedComposition({configuration:{agentcore:{approvedReads},reads:{defaultCongress:119},limits:{requestMs:25000}},pool,store:createPostgresConversationStore({pool}),execution:{authenticate:denied},createReadsRuntime:denied,serviceFor:denied,now,readAvailability:async()=>({})}),/SELECTED_CURRENT_REFUSED/,'an availability producer without the policy and role producers is a configuration fault');
});
