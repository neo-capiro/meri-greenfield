/** The private sustained-job preparation: the four canonical kinds, the schedule owner's own origin/consent fact, the
 * delegate intersection with the resolved policy, the canonical clock resolution and the refusal of any injected
 * capability/budget/schedule. No SDK, model, provider, store or network is started. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {prepareCoworkWork,readWorkSelector,workCapabilities,delegateAdmitted,scheduledOriginFact,workClock,WORK_MARKER,WORK_JOB_KINDS} from '../preparation.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {MAX_WORK_ITEMS,WORK_SELECTION_SCHEMA} from '../../../../../packages/contracts/work-selection.mjs';
const request=work=>({requestId:'11111111-1111-4111-8111-111111111111',prompt:'Research the FY26 budget stage',skill:null,window:null,windowRequest:null,...(work===undefined?{}:{work})});
const selector=jobKind=>({entry:'start-work',jobKind,deliverables:['memo'],dependencies:[]});
const guidance=work=>JSON.parse(work.guidance.slice(WORK_MARKER.length));
// A full RunBinding: the canonical authority fence compares hash(runBinding)===hash(binding), so the worker's own fence
// must be given the run's whole binding, not only its conversation identity.
const binding={tenantId:'11111111-1111-4111-8111-111111111111',actorId:'22222222-2222-4222-8222-222222222222',conversationId:'33333333-3333-4333-8333-333333333333',runId:'77777777-7777-4777-8777-777777777777',attemptId:'99999999-9999-4999-8999-999999999999',writerFence:1};
// The schedule owner's own read result (`readConsentForOccurrence` -> `occurrenceReadConsentFacts`): it owns this field
// set and every type in it. `policyRevision` is deliberately not a digest here and `runBinding` is the effect binding,
// exactly as the owner returns them, to show the worker re-tests neither.
const origin={scheduleId:'44444444-4444-4444-8444-444444444444',occurrenceKey:'a'.repeat(64),startedAtMs:1_760_000_000_000,
 consentId:'55555555-5555-4555-8555-555555555555',consentState:'active',consentCreatedAtMs:1_759_000_000_000,
 consentExpiresAtMs:2_000_000_000_000,clientId:'66666666-6666-4666-8666-666666666666',operationsDigest:'b'.repeat(64),
 policyRevision:'routine-revision-42',runBinding:{...binding,runId:'77777777-7777-4777-8777-777777777777',writerFence:1}};
const toolPolicy=assertCapabilityPolicy({workspaceTools:true,workspaceToolNames:['Read','Grep'],subagents:true,subagentTypes:['research','verification'],maxParallelSubagents:3});

test('an ordinary chat turn has no selector and prepares nothing',()=>{
 assert.equal(readWorkSelector(request(undefined)),null);
 assert.equal(prepareCoworkWork({request:request(undefined),policy:toolPolicy}),null);
 assert.equal(prepareCoworkWork({request:{...request(undefined),work:null},policy:toolPolicy}),null);
});

test('all four canonical job kinds are admitted and carry the durable objective digest',()=>{
 assert.deepEqual([...WORK_JOB_KINDS],['research','deliverable','audit','scheduled']);
 for(const jobKind of WORK_JOB_KINDS){
  const value=request(selector(jobKind));
  const work=prepareCoworkWork({request:value,policy:toolPolicy,runBudgets:{maxToolCalls:20,maxOutputBytes:1048576},origin,binding,now:1_700_000_000_000});
  assert.equal(work.jobKind,jobKind);
  assert.equal(work.objectiveSha256,canonicalSha256(value),'the objective revision is the durable request hash');
  const g=guidance(work);assert.equal(g.jobKind,jobKind);assert.equal(g.entry,'start-work');assert.deepEqual(g.deliverables,['memo']);
  assert.equal(g.brief,'the request prompt is the job brief');
  if(jobKind==='scheduled')assert.equal(g.scheduleOrigin.consentId,origin.consentId);else assert.equal(Object.hasOwn(g,'scheduleOrigin'),false);
 }
});

test('a changed job definition changes the objective revision an old publication would be refused against',()=>{
 const before=prepareCoworkWork({request:request(selector('research')),policy:toolPolicy}),after=prepareCoworkWork({request:request({...selector('research'),deliverables:['memo','annex']}),policy:toolPolicy});
 assert.notEqual(before.objectiveSha256,after.objectiveSha256);
});

test('a malformed selector is refused, never repaired',()=>{
 const bad=[{entry:'chat',jobKind:'research',deliverables:['x'],dependencies:[]},{entry:'start-work',jobKind:'sprint',deliverables:['x'],dependencies:[]},
  {entry:'start-work',jobKind:'research',deliverables:['x'.repeat(201)],dependencies:[]},{entry:'start-work',jobKind:'research',deliverables:['x','x'],dependencies:[]},
  {entry:'start-work',jobKind:'research',deliverables:['  '],dependencies:[]},{entry:'start-work',jobKind:'research',deliverables:['x'],dependencies:[7]}];
 for(const work of bad)assert.throws(()=>readWorkSelector(request(work)),/WORK_REFUSED|INVALID_COMMAND/,JSON.stringify(work));
 assert.throws(()=>readWorkSelector(request({entry:'start-work',jobKind:'research',deliverables:['x']})),/INVALID_COMMAND|WORK_REFUSED/,'a missing key is refused');
});

test('the Work shape and its limits are the canonical owner\'s: empty and 20 items are admitted, 21 and 32 are not',()=>{
 // The public Work owner admits an empty deliverables list and at most 20 items. The worker consumes that same
 // owner, so a Work the public entry admits is never refused here as WORK_REFUSED, and nothing wider is admitted.
 assert.equal(WORK_SELECTION_SCHEMA.properties.deliverables.maxItems,MAX_WORK_ITEMS,'one limit owner, by reference');
 const empty={entry:'start-work',jobKind:'research',deliverables:[],dependencies:[]};
 assert.deepEqual(readWorkSelector(request(empty)),empty,'the empty list the public owner admits is admitted here');
 const twenty=Array.from({length:MAX_WORK_ITEMS},(_,i)=>`deliverable ${i}`);
 assert.deepEqual(readWorkSelector(request({...empty,deliverables:twenty})).deliverables,twenty);
 for(const length of [MAX_WORK_ITEMS+1,32])
  assert.throws(()=>readWorkSelector(request({...empty,deliverables:Array.from({length},(_,i)=>`d${i}`)})),/WORK_REFUSED/,`${length} deliverables`);
 // And the admitted Work is the one the real preparation carries into the job context.
 const work=prepareCoworkWork({request:request(empty),policy:toolPolicy});
 assert.equal(work.jobKind,'research');assert.deepEqual(guidance(work).deliverables,[]);
});

test('a request cannot inject capability, budget or schedule origin: unknown keys are refused by the canonical boundary',()=>{
 for(const extra of [{capabilities:{tools:['Bash']}},{budget:{maxTurns:99}},{scheduleId:origin.scheduleId},{isolation:'none'}])
  assert.throws(()=>prepareCoworkWork({request:request({...selector('research'),...extra}),policy:toolPolicy,origin,binding}),/INVALID_COMMAND/);
});

test('scheduled needs the schedule owner\'s actual current origin and consent, not a label',()=>{
 const value=request(selector('scheduled')),now=1_700_000_000_000,at={request:value,policy:toolPolicy,binding,now};
 assert.throws(()=>prepareCoworkWork(at),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'no origin at all');
 assert.throws(()=>prepareCoworkWork({...at,origin:null}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'a null origin');
 assert.throws(()=>prepareCoworkWork({...at,origin:'scheduled'}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'a label instead of a fact');
 for(const consentState of ['paused','revoked'])assert.throws(()=>prepareCoworkWork({...at,origin:{...origin,consentState}}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,`${consentState} consent`);
 assert.throws(()=>prepareCoworkWork({...at,origin:{...origin,consentExpiresAtMs:now}}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'a consent expiring exactly now');
 assert.throws(()=>prepareCoworkWork({...at,origin:{...origin,consentExpiresAtMs:now-1}}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'an expired consent');
 assert.throws(()=>prepareCoworkWork({...at,origin:{...origin,consentExpiresAtMs:'soon'}}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'a non-instant expiry');
 assert.throws(()=>prepareCoworkWork({...at,origin:{...origin,runBinding:undefined}}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'an origin with no binding');
 assert.throws(()=>prepareCoworkWork({...at,origin:{...origin,runBinding:{...origin.runBinding,conversationId:'88888888-8888-4888-8888-888888888888'}}}),/WORK_SCHEDULE_ORIGIN_REQUIRED/,'an origin belonging to another conversation');
 const admitted=prepareCoworkWork({...at,origin});
 assert.equal(admitted.scheduleOrigin.scheduleId,origin.scheduleId);
 // The owner owns the field set and the type of every field; the worker carries the fact through untouched.
 assert.equal(scheduledOriginFact(origin,binding),origin);
 assert.equal(guidance(admitted).scheduleOrigin.policyRevision,'routine-revision-42','a non-digest policy revision is the owner\'s value, not a shape for the worker to test');
 assert.equal(guidance(admitted).scheduleOrigin.consentExpiresAtMs,origin.consentExpiresAtMs);
});

test('the production clock callback is resolved to one finite instant before any expiry comparison',()=>{
 assert.ok(Number.isSafeInteger(workClock(Date.now)),'the activity\'s own clock callback is usable');
 assert.equal(workClock(()=>1_700_000_000_000),1_700_000_000_000);
 assert.equal(workClock(1_700_000_000_000),1_700_000_000_000);
 for(const bad of [()=>'soon',()=>NaN,()=>undefined,()=>1.5,undefined,null,'1700000000000',1.5,Infinity,NaN])
  assert.throws(()=>workClock(bad),/WORK_CLOCK_INVALID/,`${String(bad)} is not a finite instant`);
 const value=request(selector('scheduled'));
 assert.throws(()=>prepareCoworkWork({request:value,policy:toolPolicy,binding,origin,now:()=>NaN}),/WORK_CLOCK_INVALID/,'an unusable clock refuses rather than admitting');
 // A callback clock past the consent expiry is refused; a bare `expiry<=fn` comparison coerces to NaN and would admit it.
 assert.throws(()=>prepareCoworkWork({request:value,policy:toolPolicy,binding,origin,now:()=>2_100_000_000_000}),/WORK_SCHEDULE_ORIGIN_REQUIRED/);
 assert.equal(prepareCoworkWork({request:value,policy:toolPolicy,binding,origin,now:()=>1_700_000_000_000}).scheduleOrigin.consentId,origin.consentId);
});

test('an explicit Delegate uses the existing Agent capability only when the resolved policy already admits it',()=>{
 const value=request({entry:'delegate',jobKind:'research',deliverables:['memo'],dependencies:[]});
 const without=prepareCoworkWork({request:value,policy:assertCapabilityPolicy({workspaceTools:true,workspaceToolNames:['Read']})});
 assert.equal(without.delegationAdmitted,false);assert.equal(without.capabilities.tools.includes('Agent'),false);
 assert.deepEqual(guidance(without).delegation,{admitted:false});
 const with_=prepareCoworkWork({request:value,policy:toolPolicy});
 assert.equal(with_.delegationAdmitted,true);assert.equal(with_.capabilities.tools.includes('Agent'),true);
 assert.deepEqual(guidance(with_).delegation,{admitted:true,roles:['research','verification']});
 assert.equal(delegateAdmitted(toolPolicy),true);assert.equal(delegateAdmitted(undefined),false);
});

test('the job intersection never widens the policy: no Bash, no budget raise, tools are the admitted ones',()=>{
 const policy=assertCapabilityPolicy({workspaceTools:true,workspaceToolNames:['Read'],subagents:true,bash:true,sandboxNetworkDomains:['pypi.org']});
 const work=prepareCoworkWork({request:request(selector('deliverable')),policy,runBudgets:{maxToolCalls:7,maxOutputBytes:4096}});
 assert.deepEqual([...work.capabilities.tools],['Read','Agent'],'Bash is never added by a job');
 assert.deepEqual(work.capabilities,{tools:['Read','Agent'],parallel:2});
 assert.deepEqual(work.budget,{maxToolCalls:7,maxOutputBytes:4096});
 assert.deepEqual([...workCapabilities(undefined).tools],[]);
 const none=prepareCoworkWork({request:request(selector('research')),policy:undefined});
 assert.deepEqual(none.budget,{maxToolCalls:null,maxOutputBytes:null},'an absent admitted budget is reported as absent, never guessed');
});
