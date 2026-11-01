/** A selected skill is admitted only when every required source has an available read for this actor and scope, decided by the
 * real admission owner before allocation from the same availability answer the worker mounts from. The refusal names the missing
 * sources (SKILL_SOURCES_UNAVAILABLE) or the scope the skill needs (SKILL_SCOPE_REFUSED) and reaches the allocate, admit and
 * submit routes as its own 400 body. Scripted SQL and availability; no provider, gateway or database. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationService} from '../service.mjs';
import {createConversationApplication} from '../http.mjs';
import {createConversationInitialInputApplication} from '../initial-input/http.mjs';
import {createConversationInputApplication} from '../input/http.mjs';
import {createOriginalSkillAdmissionOwner} from '../skills/admission.mjs';
import {SKILL_TYPED_REFUSALS} from '../skills/refusals.mjs';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {binding,versions,id} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {conversationErrorStatuses} from '../../../../packages/contracts/conversation-application/protocol.mjs';
import {initialInputErrorStatuses} from '../../../../packages/contracts/conversation-initial-input/protocol.mjs';
import {receiveConversationResponse,receiveConversationRequest} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const mail=selectSkill('quick_skill.mail_history','1.0.1'),audit=selectSkill('quick_skill.commitments_audit','1.0.1');
const windowRequest={basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'};
const intent=selected=>({requestId:id(60),prompt:'Summarize the last three email threads with the client',skill:{skillId:selected.pin.skillId,skillVersion:selected.pin.skillVersion},windowRequest});
const code=error=>productFailure(error)?.code??error?.code??error?.message;
/** General scope: the actor's private conversation, no selected client. `unavailable` scripts which allowed operations the gateway answer leaves out. */
function fixture({selectedClientId=null,unavailable=()=>[]}={}){
 const scopes=selectedClientId===null?[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'policy-1'}]:[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision:'policy-1'}];
 const f=initialInputFixture(),state=Object.assign(f.state,{context:structuredClone({binding,scopes,selectedClientId}),ttl:30000,starts:[],availabilityCalls:[]});let serial=200;
 const sessions={async authenticateSession(){return {principal:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},checkedAtMs:f.now(),expiresAtMs:f.now()+state.ttl};},async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),...structuredClone(state.context),checkedAtMs:f.now(),expiresAtMs:f.now()+state.ttl};}};
 const admission=createOriginalSkillAdmissionOwner({binding,now:f.now,loadConversation:async()=>{throw Error('no run exists at admission');},readSelection:async()=>{throw Error('General admission pins no client selection');},readCurrentContext:async()=>{throw Error('unused');},
  async readSkillAvailability(call){state.availabilityCalls.push(structuredClone(call));return {considered:call.operations,unavailable:unavailable(call.operations)};}});
 const service=createConversationService({sessions,store:f.store(),versions,modelCatalog:MODEL_CATALOG,now:f.now,newId:()=>id(serial++),selectedSkillAdmission:{admitSelection:value=>admission.admitSelection(value)},dispatcher:{async start({binding}){state.starts.push(binding);},async cancel(){}}});
 const args=input=>({credential:'synthetic',input}),request=(body,path)=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify(body)});
 return {...f,state,service,scopes,allocate:i=>service.allocateInput(args(i)),admit:i=>service.admitInput(args(i)),submit:i=>service.submit(args(i)),
  allocateHttp:i=>createConversationInitialInputApplication({service,now:f.now}).handle(request(i,'/api/conversations/input/allocate')),
  admitHttp:i=>createConversationInputApplication({service,now:f.now}).handle(request(i,'/api/conversations/input/admit')),
  submitHttp:i=>createConversationApplication({service,now:f.now}).handle(request(i,'/api/conversations/submit'))};
}
test('Mail History in General scope is admitted when every required source has an available read, and the admission asked for exactly the manifest operations',async()=>{
 const f=fixture(),input=intent(mail);
 const allocated=await f.allocate(input);assert.equal(allocated.allocation.selectedClientId,null);
 const admitted=await f.admit(input);assert.deepEqual(admitted.request.skill,mail.pin);
 assert.equal((await f.submit(input)).replayed,true);assert.equal(f.state.starts.length,1);
 for(const call of f.state.availabilityCalls){assert.deepEqual(call.binding,binding);assert.deepEqual(call.scopes,f.scopes);assert.equal(call.selectedClientId,null);assert.deepEqual(call.operations,mail.manifest.allowedOperations);assert.ok(Number.isSafeInteger(call.expiresAtMs)&&call.expiresAtMs>f.now());}
 assert.ok(f.state.availabilityCalls.length>=3,'allocate, admit and submit each re-admit the selection');
});
test('Mail History whose mail reads are unavailable is refused before allocation with SKILL_SOURCES_UNAVAILABLE naming the mail source, on every route',async()=>{
 const f=fixture({unavailable:operations=>operations.filter(op=>op.id.startsWith('mail.'))}),input=intent(mail);
 await assert.rejects(f.allocate(input),error=>code(error)==='SKILL_SOURCES_UNAVAILABLE'&&JSON.stringify(error.sources)==='["mail"]');
 assert.equal(f.allocations.size,0);assert.equal(f.state.runs.size,0);assert.equal(f.state.starts.length,0);
 const allocate=await f.allocateHttp(input);assert.equal(allocate.status,400);assert.deepEqual(await allocate.json(),{error:{code:'SKILL_SOURCES_UNAVAILABLE',outcome:'NOT_DISPATCHED',sources:['mail']}});
});
test('mail reads that become unavailable after allocation refuse admit and submit with the same body, and no run or dispatch happens',async()=>{
 let lost=false;const f=fixture({unavailable:operations=>lost?operations.filter(op=>op.id.startsWith('mail.')):[]}),input=intent(mail);
 await f.allocate(input);lost=true;
 const admit=await f.admitHttp(input);assert.equal(admit.status,400);assert.deepEqual(await admit.json(),{error:{code:'SKILL_SOURCES_UNAVAILABLE',sources:['mail']}});
 const submit=await f.submitHttp(input);assert.equal(submit.status,400);const body=await submit.bytes();assert.deepEqual(JSON.parse(new TextDecoder().decode(body)),{error:{code:'SKILL_SOURCES_UNAVAILABLE',sources:['mail']}});
 const received=await receiveConversationResponse('submit',400,body,receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(input))));assert.deepEqual(received,{error:{code:'SKILL_SOURCES_UNAVAILABLE',sources:['mail']}},'the public receiver admits the detail');
 assert.equal(f.state.runs.size,0);
});
test('a partially unavailable source stays admissible while one allowed read still covers it; losing every read of two sources names both',async()=>{
 const partial=fixture({unavailable:operations=>operations.filter(op=>op.id==='mail.list_messages')});await partial.allocate(intent(mail));
 const two=fixture({unavailable:operations=>operations.filter(op=>op.id!=='resolve_entity')});
 await assert.rejects(two.allocate(intent(mail)),error=>code(error)==='SKILL_SOURCES_UNAVAILABLE'&&JSON.stringify(error.sources)==='["tenant_contacts","mail"]');
});
test('a client-only skill in General scope is refused with SKILL_SCOPE_REFUSED and the required scope before availability is consulted',async()=>{
 const f=fixture(),input=intent(audit);assert.ok(!audit.manifest.subjectKinds.includes('personal'));
 await assert.rejects(f.allocate(input),error=>code(error)==='SKILL_SCOPE_REFUSED'&&error.requiredScope==='client');
 assert.equal(f.state.availabilityCalls.length,0);assert.equal(f.allocations.size,0);
 const allocate=await f.allocateHttp(input);assert.equal(allocate.status,400);assert.deepEqual(await allocate.json(),{error:{code:'SKILL_SCOPE_REFUSED',outcome:'NOT_DISPATCHED',requiredScope:'client'}});
 assert.equal(f.state.runs.size,0);
});
test('the same client-only skill is admitted in a client conversation when its sources are available',async()=>{
 const clientId=id(5),f=fixture({selectedClientId:clientId});
 const admission=createOriginalSkillAdmissionOwner({binding,now:f.now,loadConversation:async()=>{throw Error('unused');},readCurrentContext:async()=>{throw Error('unused');},
  readSelection:async({request})=>({subject:{kind:'client',entityType:'client',entityIds:[clientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision:'policy-1',scopes:f.scopes,rosterVersionId:null},window:request.window,mondayBoardIds:[]}),
  readSkillAvailability:async({operations})=>({considered:operations,unavailable:[]})});
 const receipt=await admission.admitSelection({binding,request:{requestId:id(60),prompt:'Audit',skill:audit.pin,window:{basis:'unbounded'},windowRequest:null},scopes:f.scopes,selectedClientId:clientId,deadlineMs:f.now()+2000});
 assert.deepEqual(receipt.skill,audit.pin);assert.equal(receipt.selectedClientId,clientId);
});
test('an availability answer outside the manifest refuses as SKILL_ADMISSION_REFUSED without naming anything',async()=>{
 for(const unavailable of [()=>[{id:'search_public_web',version:'0.2.0'}],()=>null,operations=>[{...operations[0],version:'9.9.9'}]]){
  const f=fixture({unavailable});await assert.rejects(f.allocate(intent(mail)),error=>code(error)==='SKILL_ADMISSION_REFUSED');
  const allocate=await f.allocateHttp(intent(mail));assert.equal(allocate.status,400);assert.deepEqual(await allocate.json(),{error:{code:'INVALID_REQUEST',outcome:'NOT_DISPATCHED'}});}
});
test('a transient Core or gateway failure while reading availability is the service unavailability on every route, never a 400 refusal of the choice',async()=>{
 let down=false;const f=fixture({unavailable:()=>{if(down)throw Object.assign(Error('PRIVATE Core outage'),{code:'UNAVAILABLE'});return [];}}),input=intent(mail);
 await f.allocate(input);down=true;
 await assert.rejects(f.allocate(input),error=>code(error)==='SKILL_AVAILABILITY_UNAVAILABLE'&&!JSON.stringify(error).includes('PRIVATE'));
 const allocate=await f.allocateHttp(input);assert.equal(allocate.status,503);assert.deepEqual(await allocate.json(),{error:{code:'INITIAL_INPUT_UNAVAILABLE',outcome:'UNKNOWN'}});
 const admit=await f.admitHttp(input);assert.equal(admit.status,502);assert.deepEqual(await admit.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});
 const submit=await f.submitHttp(input);assert.equal(submit.status,502);assert.deepEqual(await submit.json(),{error:{code:'CONVERSATION_UNAVAILABLE'}});
 assert.equal(f.state.runs.size,0);assert.equal(f.state.starts.length,0);
});
test('a compiler-path recipe (Cited Report) is admitted without consulting the general-read availability at all',async()=>{
 const clientId=id(5),f=fixture({selectedClientId:clientId}),cited=selectSkill('quick_skill.cited_report','1.0.1');
 const admission=createOriginalSkillAdmissionOwner({binding,now:f.now,loadConversation:async()=>{throw Error('unused');},readCurrentContext:async()=>{throw Error('unused');},
  readSelection:async({request})=>({subject:{kind:'client',entityType:'client',entityIds:[clientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision:'policy-1',scopes:f.scopes,rosterVersionId:null},window:request.window,mondayBoardIds:[]}),
  readSkillAvailability:async()=>{throw Error('never asked');}});
 const receipt=await admission.admitSelection({binding,request:{requestId:id(60),prompt:'Cited report',skill:cited.pin,window:{basis:'unbounded'},windowRequest:null},scopes:f.scopes,selectedClientId:clientId,deadlineMs:f.now()+2000});
 assert.deepEqual(receipt.skill,cited.pin);
});
test('the two typed refusals are public 400 codes on every input route and the rest of the skill refusals stay INVALID_REQUEST',()=>{
 for(const refusal of SKILL_TYPED_REFUSALS){assert.deepEqual(conversationErrorStatuses[refusal],[400]);assert.deepEqual(initialInputErrorStatuses[refusal],[400]);}
 for(const other of ['SKILL_UNAVAILABLE','SKILL_WINDOW_REQUIRED','SKILL_WINDOW_REFUSED','SKILL_ADMISSION_REFUSED','SKILL_AVAILABILITY_UNAVAILABLE']){assert.equal(Object.hasOwn(conversationErrorStatuses,other),false);assert.equal(Object.hasOwn(initialInputErrorStatuses,other),false);}
});
