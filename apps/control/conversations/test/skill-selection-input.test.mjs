/** Typed QuickAction selection at the service and HTTP boundaries over scripted SQL: the picker's newest version and a
 * persisted historical pin are both admitted with their exact installed digests, reload returns the same pin, clearing
 * the selection submits an ordinary request, and a stale, removed, aliased, unscoped or re-pinned selection is refused
 * before allocation, admission or dispatch. No provider, native execution or database is involved. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createConversationService} from '../service.mjs';
import {createConversationInitialInputApplication} from '../initial-input/http.mjs';
import {createConversationInputApplication} from '../input/http.mjs';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {binding,scopes,versions,id} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {MODEL_CATALOG} from '../../../../packages/contracts/test/model-selection-fixture.mjs';
import {CONVERSATION_SKILLS} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {listSkills,selectSkill} from '../../../../packages/skills/index.mjs';
import {describeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const windowRequest={basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'};
const intent=skill=>({requestId:id(60),prompt:'Run the selected workflow',...(skill===null?{}:{skill,windowRequest})});
function fixture(){
 const f=initialInputFixture(),state=Object.assign(f.state,{context:structuredClone({binding,scopes,selectedClientId:id(5)}),ttl:30000,revoked:false,starts:[]});let serial=200;
 const sessions={async authenticateSession(){if(state.revoked)throw Object.assign(Error('SESSION_REFUSED'),{code:'SESSION_REFUSED'});return {principal:{tenantId:state.context.binding.tenantId,actorId:state.context.binding.actorId,conversationId:state.context.binding.conversationId,runId:state.context.binding.runId},checkedAtMs:f.now(),expiresAtMs:f.now()+state.ttl};},async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),...structuredClone(state.context),checkedAtMs:f.now(),expiresAtMs:f.now()+state.ttl};}};
 const service=createConversationService({sessions,store:f.store(),versions,modelCatalog:MODEL_CATALOG,now:f.now,newId:()=>id(serial++),dispatcher:{async start({binding}){state.starts.push(binding);},async cancel(){}}}),args=input=>({credential:'synthetic',input});
 const request=(body,path)=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify(body)});
 return {...f,state,service,allocate:i=>service.allocateInput(args(i)),admit:i=>service.admitInput(args(i)),submit:i=>service.submit(args(i)),history:()=>service.history({credential:'synthetic'}),
  allocateHttp:i=>createConversationInitialInputApplication({service,now:f.now}).handle(request(i,'/api/conversations/input/allocate')),
  admitHttp:i=>createConversationInputApplication({service,now:f.now}).handle(request(i,'/api/conversations/input/admit'))};
}
const code=error=>productFailure(error)?.code??error?.code??error?.message;
const offered=CONVERSATION_SKILLS.filter(s=>s.subjectKinds.includes('client'));

test('the public picker offers exactly the newest installed version of every selectable original',()=>{
 assert.equal(CONVERSATION_SKILLS.length,15);
 assert.deepEqual(CONVERSATION_SKILLS.map(s=>[s.skillId,s.version]),describeSkillPlugin().skills.map(s=>[s.skillId,s.skillVersion]));
 for(const descriptor of CONVERSATION_SKILLS){
  const newest=listSkills().filter(row=>row.skillId===descriptor.skillId).map(row=>row.skillVersion).sort().at(-1);
  if(descriptor.skillId!=='quick_skill.bill_watch')assert.equal(descriptor.version,newest,`${descriptor.skillId} offers its newest version`);
  else assert.equal(descriptor.version,'1.1.1','the Bill Watch picker entry is the native workflow successor, not the explicit sourced report');
  assert.equal(selectSkill(descriptor.skillId,descriptor.version).manifest.budgets.maxRuntimeSeconds,600,'every offered version carries the ten-minute whole-run budget');
 }
});

for(const descriptor of ['quick_skill.mail_history','quick_skill.commitments_audit','quick_skill.relationship_brief','quick_skill.client_changes','quick_skill.meeting_prep','quick_skill.bill_watch','quick_skill.cited_report'].map(skillId=>offered.find(s=>s.skillId===skillId)))
test(`${descriptor.skillId}@${descriptor.version}: Apply to draft, submit, admitted pin with exact digests, reload and exact replay`,async()=>{
 const f=fixture(),selection={skillId:descriptor.skillId,skillVersion:descriptor.version},pin=selectSkill(selection.skillId,selection.skillVersion).pin,input=intent(selection);
 const allocated=await f.allocate(input);assert.equal(allocated.allocation.inputSha256,hash(input),'the allocation pins the exact wire body, skill selection included');
 const admitted=await f.admit(input);assert.deepEqual(admitted.request.skill,pin,'the admitted request carries manifest, prose and catalog digests');assert.deepEqual(admitted.request.skill,pin);assert.deepEqual(admitted.request.windowRequest,windowRequest);assert.equal(admitted.request.window.basis,'explicit');
 assert.equal(f.state.starts.length,0);
 const reloaded=await f.history();assert.deepEqual(reloaded.request,admitted.request,'reload returns the same admitted pin');
 assert.equal(admitted.request.skill.manifestSha256,descriptor.manifestSha256);assert.equal(admitted.request.skill.proseSha256,descriptor.proseSha256,'the picker descriptor and the admitted pin carry the same digests');
 const submitted=await f.submit(input);assert.equal(submitted.replayed,true);assert.equal(f.state.starts.length,1);
 // Edit after apply: changing the applied skill or its window is a different request, never a silent re-pin.
 for(const changed of [intent({...selection,skillVersion:'1.0.0'}),{...input,windowRequest:{basis:'unbounded'}},intent(null)])await assert.rejects(f.admit(changed),error=>['INITIAL_INPUT_CONFLICT','SKILL_UNAVAILABLE','REQUEST_REPLAY_REFUSED'].includes(code(error)));
 assert.equal(f.state.runs.size,1);
});

test('a persisted historical pin still resolves to its own exact version while new selections get the successor',async()=>{
 const f=fixture(),historical={skillId:'quick_skill.mail_history',skillVersion:'1.0.0'},pin=selectSkill('quick_skill.mail_history','1.0.0').pin;
 const admitted=await (async()=>{await f.allocate(intent(historical));return f.admit(intent(historical));})();
 assert.deepEqual(admitted.request.skill,pin);assert.equal(admitted.request.skill.skillVersion,'1.0.0');
 assert.equal(selectSkill('quick_skill.mail_history','1.0.0').manifest.budgets.maxRuntimeSeconds,60,'the historical pin keeps its historical budget');
 assert.equal(CONVERSATION_SKILLS.find(s=>s.skillId==='quick_skill.mail_history').version,'1.0.1');
});

test('a portfolio-only workflow is unavailable in a client conversation without the portfolio admission owner',async()=>{
 const f=fixture();
 for(const skillId of ['quick_skill.portfolio_changes','quick_skill.portfolio_overlap']){
  const descriptor=CONVERSATION_SKILLS.find(s=>s.skillId===skillId);assert.deepEqual(descriptor.subjectKinds,['portfolio']);
  const input={requestId:id(60),prompt:'Portfolio',skill:{skillId:descriptor.skillId,skillVersion:descriptor.version},windowRequest:{basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-24T00:00:00Z',timezone:'UTC'}};
  await assert.rejects(f.allocate(input),error=>code(error)==='SKILL_SCOPE_REFUSED');
  const allocate=await f.allocateHttp(input);assert.equal(allocate.status,400);assert.equal((await allocate.json()).error.code,'INVALID_REQUEST');
 }
 assert.equal(f.allocations.size,0);assert.equal(f.state.runs.size,0);
});

test('clearing the selection submits an ordinary request with a null skill and no window',async()=>{
 const f=fixture();await f.allocate(intent(null));const admitted=await f.admit(intent(null));
 assert.equal(admitted.request.skill,null);assert.equal(admitted.request.window,null);assert.equal(admitted.request.windowRequest,null);
 assert.deepEqual((await f.history()).request,admitted.request);
});

for(const [name,skill,expected] of [
 ['an unknown skill identity',{skillId:'quick_skill.invented',skillVersion:'1.0.0'},'SKILL_UNAVAILABLE'],
 ['a version that was never installed',{skillId:'quick_skill.mail_history',skillVersion:'9.9.9'},'SKILL_UNAVAILABLE'],
 ['a retired version that is no longer in the index',{skillId:'quick_skill.client_changes',skillVersion:'1.0.0'},'SKILL_UNAVAILABLE'],
 ['a latest alias',{skillId:'quick_skill.mail_history',skillVersion:'latest'},'SKILL_UNAVAILABLE'],
 ['a successor that exists only on disk',{skillId:'quick_skill.mail_history',skillVersion:'1.0.2'},'SKILL_UNAVAILABLE'],
])test(`${name} is refused before allocation, admission and dispatch`,async()=>{
 const f=fixture(),input=intent(skill);
 await assert.rejects(f.allocate(input),error=>code(error)===expected);
 await assert.rejects(f.admit(input),error=>['INITIAL_INPUT_REQUIRED',expected].includes(code(error)));
 assert.equal(f.allocations.size,0);assert.equal(f.state.runs.size,0);assert.equal(f.state.starts.length,0);
 const allocate=await f.allocateHttp(input);assert.equal(allocate.status,400);assert.deepEqual(await allocate.json(),{error:{code:'INVALID_REQUEST',outcome:'NOT_DISPATCHED'}});
});

test('a selection without a window and a window basis the recipe does not allow are refused as the request, not the service',async()=>{
 const f=fixture(),mail=offered.find(s=>s.skillId==='quick_skill.mail_history');
 const noWindow={requestId:id(60),prompt:'No window',skill:{skillId:mail.skillId,skillVersion:mail.version}};
 await assert.rejects(f.allocate(noWindow),error=>code(error)==='SKILL_WINDOW_REQUIRED');
 const changes=offered.find(s=>s.skillId==='quick_skill.client_changes');assert.ok(!changes.windowBases.includes('unbounded'));
 const wrongBasis={requestId:id(60),prompt:'Wrong basis',skill:{skillId:changes.skillId,skillVersion:changes.version},windowRequest:{basis:'unbounded'}};
 await assert.rejects(f.allocate(wrongBasis),error=>code(error)==='SKILL_SCOPE_REFUSED');
 for(const input of [noWindow,wrongBasis]){const allocate=await f.allocateHttp(input);assert.equal(allocate.status,400);assert.equal((await allocate.json()).error.code,'INVALID_REQUEST');}
 assert.equal(f.allocations.size,0);assert.equal(f.state.runs.size,0);
});

test('the admit route refuses a stale re-pin of an admitted request with 400, never 502 CONVERSATION_UNAVAILABLE',async()=>{
 const f=fixture(),mail=offered.find(s=>s.skillId==='quick_skill.mail_history'),input=intent({skillId:mail.skillId,skillVersion:mail.version});
 await f.allocate(input);await f.admit(input);
 // The original allocation already pins the exact wire body, so a changed skill is a refused replay (400); the
 // SKILL_UNAVAILABLE mapping of the admit route applies to later-turn inputs that carry no original allocation.
 const response=await f.admitHttp({...input,skill:{skillId:'quick_skill.client_changes',skillVersion:'1.0.0'}});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:{code:'REQUEST_REPLAY_REFUSED'}});
 const replay=await f.admitHttp(input);assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true,'the exact admitted selection still replays');
 assert.equal(f.state.runs.size,1);assert.equal(f.state.starts.length,0);
});
