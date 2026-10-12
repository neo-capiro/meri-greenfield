/** Final canonical integration controls; source only, no live SDK/SQL/native execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../validate.mjs';
import * as canonical from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../retrieval-0.2/catalog-validation.mjs';
import {createSourceDisabledGateway} from '../../../apps/gateway/index.mjs';
import {createScheduleToolInterface} from '../../../apps/control/schedules/tool-interface.mjs';
import {createScheduleLifecycle} from '../../../apps/control/schedules/schedule-lifecycle.mjs';
const catalog=JSON.parse(readFileSync(new URL('../retrieval-0.2/catalog.json',import.meta.url)));
const id=n=>`90000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const NOW=Date.parse('2026-10-12T20:00:00.000Z'),at=new Date(NOW).toISOString();
const binding={tenantId:'vertical-tenant',actorId:'vertical-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const scope={tenantId:binding.tenantId,kind:'client',resourceId:id(5),policyRevision:'policy:review'};
const object={objectId:id(6),versionId:'version:exact',sha256:'a'.repeat(64),bytes:17,scopes:[scope]};
const resolve=id=>canonical.resolveOperationContract({id,version:'0.2.0'});
const commands={
 create_task:{raw:{title:'  Follow up  ',clientId:' ',dueDate:' '},ctx:{commandContext:{binding,clientResolution:null}},action:'task.create',expected:{arguments:{title:'Follow up',clientId:null,dueDate:null},attachments:[]}},
 update_task:{raw:{taskId:id(7).toUpperCase(),status:' OPEN '},ctx:{commandContext:{binding}},action:'task.update',expected:{arguments:{taskId:id(7),mode:'unconditional_patch',patch:{status:'todo'}},attachments:[]}},
 save_memory:{raw:{content:'  Retain source attribution  ',scope:'client',ttlDays:0.5},ctx:{commandContext:{binding,conversationClientId:id(5)}},action:'memory.propose',expected:{arguments:{content:'Retain source attribution',key:null,scope:'client',clientId:id(5),ttlDays:0.5},attachments:[]}},
 save_chat_attachments:{raw:{clientId:id(5),conversationId:id(1),objects:[object]},ctx:{commandContext:{binding,destination:{clientId:id(5),conversationId:id(1)}}},action:'artifact.file',expected:{arguments:{clientId:id(5),conversationId:id(1)},attachments:[object]}},
};
const artifacts={
 create_word:{operation:'create_word',format:'txt',title:'Vertical sample',content:{text:'Exact\r\ntext\n'}},
 create_excel:{operation:'create_excel',format:'xlsx',title:'Vertical sample',content:{sheets:[{name:'Data',rows:[[{value:2},{formula:'=SUM(A1:A1)'}]]}]}},
 create_powerpoint:{operation:'create_powerpoint',format:'pptx',title:'Vertical sample',content:{slides:[{title:'One',bullets:['Editable']}]}},
 run_analysis:{operation:'run_analysis',format:'zip',title:'Vertical sample',content:{tables:[{name:'data',columns:['value'],rows:[[2],[3]]}],source:'data',steps:[]}},
};
const artifactContext=()=>({binding:structuredClone(binding),scopes:[structuredClone(scope)],evidence:[],assets:[],deadlineMs:NOW+1000,maxBytes:10000});
const owner={tenantId:binding.tenantId,actorId:'schedule-owner'},caller={tenantId:binding.tenantId,actorId:binding.actorId};
const projection=()=>({scheduleId:id(20),owner:structuredClone(owner),temporalScheduleId:'schedule:vertical',timezone:'UTC',scopes:[structuredClone(scope)],state:'active',maxCostMicrousd:20,maxRuntimeSeconds:10,retryLimit:0,destinationId:'destination:resolved',createdAt:at});
function schedule(operation){
 const policy={spec:{calendars:[],intervals:[{every:60000,offset:0}],cronExpressions:[],skip:[],startAt:null,endAt:null,jitterMs:0,timezone:'UTC'},overlap:'SKIP',catchupWindowMs:60000,pauseOnFailure:true,remainingActions:2,paused:false,note:'Explicit choices',runNow:false,runNowOverlap:'ALLOW_ALL'};
 let raw={taskInstruction:'Read permitted source and draft a summary.',policy,destinationReference:'Private destination',requestedLimits:{maxCostMicrousd:25,maxRuntimeSeconds:15,retryLimit:1}};
 const c={callerIdentity:structuredClone(caller),requestSha256:'',nowMs:NOW,deadlineMs:NOW+1000,intentId:id(21),current:null,projection:projection(),taskResolution:{instructionSha256:hash(raw.taskInstruction),task:{taskId:id(22),manifestSha256:'b'.repeat(64),version:1},workflow:{workflowType:'approvedTemplate',workflowId:'workflow:vertical',taskQueue:'approved-queue'}},destinationResolution:{reference:raw.destinationReference,destinationId:'destination:resolved'},limitResolution:{requestedSha256:hash(raw.requestedLimits),effective:{maxCostMicrousd:20,maxRuntimeSeconds:10,retryLimit:0}},approval:null};
 if(operation!=='schedule_task')c.current={projection:projection(),generation:3,projectionSha256:hash(projection())};
 if(operation==='update_scheduled_task')raw={scheduleId:id(20),...raw};
 if(operation==='cancel_scheduled_task'){raw={scheduleId:id(20),mode:'pause',note:'Explicit cancellation',running:'leave',runs:[]};c.projection.state='paused';c.taskResolution=c.destinationResolution=c.limitResolution=null;}
 if(operation==='list_scheduled_tasks')return {raw:{},ctx:{scheduleContext:{callerIdentity:structuredClone(caller),owner:structuredClone(owner),requestSha256:hash({afterScheduleId:null,limit:20,historyLimit:10}),nowMs:NOW,deadlineMs:NOW+1000}}};
 c.requestSha256=hash(raw);raw={...raw,...(operation==='cancel_scheduled_task'?{}:{taskInstruction:' '+raw.taskInstruction+' ',destinationReference:' '+raw.destinationReference+' '})};
 return {raw,ctx:{scheduleContext:c}};
}
const scheduleIds=['schedule_task','update_scheduled_task','cancel_scheduled_task','list_scheduled_tasks'];
const subject={kind:'entity',entityType:'research-portfolio',entityIds:[id(30).toUpperCase()],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id(31),policyRevision:scope.policyRevision,scopes:[scope],rosterVersionId:null};
const portfolio={raw:{origin:'review',recordId:id(32).toUpperCase()},ctx:{binding,subject}};
const cases=[...Object.entries(commands).map(([id,x])=>[id,x.raw,x.ctx]),...Object.entries(artifacts).map(([id,raw])=>[id,raw,artifactContext()]),...scheduleIds.map(id=>{const x=schedule(id);return [id,x.raw,x.ctx];}),['get_research_evidence',portfolio.raw,portfolio.ctx]];
for(const [operation,raw,ctx] of cases){
 test(`final canonical ${operation} advertises actual raw and invokes normalizer`,()=>{
  const c=resolve(operation),b=c.binding,n=c.normalizeInput(raw,ctx),name=c.descriptor.inputSchema.id.split('/').at(-1);
  canonical.validateShape(name,raw);assert.deepEqual(n.request,raw);assert.equal(n.argumentsSha256,hash(n.input));assert.ok(Object.isFrozen(n.input));
  if(commands[operation])assert.deepEqual(n.input,commands[operation].expected);
  if(artifacts[operation]){assert.deepEqual(n.input,raw);assert.equal(n.metadata.nativeQualified,false);}
  if(scheduleIds.includes(operation)){assert.deepEqual(b.contextKeys,['scheduleContext']);assert.equal(b.group,'schedule-tools');assert.deepEqual(n.input,canonical.scheduleToolValidators.normalizeInput(operation,raw,ctx).input);}
  if(operation==='get_research_evidence'){assert.equal(n.input.portfolioId,id(30));assert.equal(n.input.recordId,id(32));}
 });
 test(`final canonical ${operation} refuses caller authority context and hostile substitutions`,()=>{
  const c=resolve(operation);assert.throws(()=>c.normalizeInput({...raw,__authority:ctx},ctx));assert.throws(()=>c.normalizeInput(raw,{...ctx,__authority:true}));
  let touched=0;const proxy=new Proxy(raw,{ownKeys(){touched++;return [];},get(){touched++;return null;}});assert.throws(()=>c.normalizeInput(proxy,ctx));assert.equal(touched,0);
  assert.throws(()=>c.assertOutput({status:'accepted',authorized:true},{request:raw,...ctx}));
 });
}
for(const [operation,x]of Object.entries(commands))test(`final canonical ${operation} correlates exact command even for indeterminate observation`,()=>{
 const command={contractVersion:operation==='update_task'?'0.2.0':'0.1.0',commandId:id(40),binding:structuredClone(binding),action:x.action,...structuredClone(x.expected),scopes:[structuredClone(scope)],idempotencyKey:'vertical:immutable'};
 const ctx={...structuredClone(x.ctx),command};const result={status:'indeterminate',outcome:null};
 assert.deepEqual(resolve(operation).assertOutput(result,{...ctx,request:x.raw}),result);
 const changed=structuredClone(ctx);changed.command.idempotencyKey='other'; // still a valid distinct command; request cannot infer original idempotency.
 assert.deepEqual(resolve(operation).normalizeInput(x.raw,changed).input,x.expected);
 const forged=structuredClone(ctx);forged.command.binding.writerFence++;
 assert.throws(()=>resolve(operation).assertOutput(result,{...forged,request:x.raw}));
 assert.throws(()=>resolve(operation).assertOutput({status:'absent',outcome:null},{...ctx,request:x.raw}));
});
const authorize=q=>({authorized:true,bindingSha256:q.binding.bindingSha256,callerIdentity:q.binding.callerIdentity,expiresAtMs:NOW+1000});
function actualSchedule(){
 const calls=[],receipt=(b,state)=>({intentId:b.intent.intentId,bindingSha256:b.bindingSha256,state});
 const scheduleOwner={claim:async b=>{calls.push(['claim',b]);return receipt(b,'CLAIMED');},markDispatching:async b=>receipt(b,'DISPATCHING'),commitKnown:async b=>receipt(b,'ACKNOWLEDGED'),markUnknown:async b=>receipt(b,'UNKNOWN'),list:async s=>{calls.push(['list',s]);return {rows:[],hasMore:false};}};
 const connection={withDeadline:(_d,f)=>f(),withAbortSignal:(_s,f)=>f()};
 const description={scheduleId:'schedule:vertical',state:{paused:false},info:{createdAt:new Date(NOW),numActionsTaken:0,numActionsMissedCatchupWindow:0,numActionsSkippedOverlap:0,nextActionTimes:[],recentActions:[],runningActions:[]}};
 const handle={scheduleId:'schedule:vertical',describe:async()=>description,update:async fn=>{calls.push(['update',fn(description)]);},pause:async note=>calls.push(['pause',note]),delete:async()=>calls.push(['delete'])};
 const scheduleClient={connection,getHandle:s=>{assert.equal(s,'schedule:vertical');return handle;},create:async input=>{calls.push(['create',input]);return handle;}};
 const workflowClient={connection,getHandle(){throw Error('No original execution references in this fixture');}};
 const lifecycle=createScheduleLifecycle({scheduleClient,workflowClient,scheduleOwner,authorize,clock:()=>NOW});
 return {calls,tool:createScheduleToolInterface({lifecycle,validators:canonical.scheduleToolValidators,authorize,clock:()=>NOW})};
}
for(const operation of scheduleIds)test(`final canonical ${operation} validators feed actual accepted schedule application`,async()=>{
 const f=schedule(operation),r=resolve(operation),c=actualSchedule();
 if(operation!=='list_scheduled_tasks'){
  const pending=await c.tool.execute({operation,request:f.raw,context:f.ctx});assert.equal(pending.status,'approval_required');assert.deepEqual(c.calls,[]);assert.deepEqual(r.assertOutput(pending,{request:f.raw,...f.ctx}),pending);
  const plan=canonical.scheduleToolValidators.prepare(operation,f.raw,f.ctx);
  f.ctx.scheduleContext.approval={proposalId:plan.intent.intentId,commandSha256:plan.intentSha256,decision:'approved',decidedAt:new Date(NOW-1).toISOString(),expiresAt:new Date(NOW+1000).toISOString(),approver:structuredClone(owner),policyRevision:'current-policy'};
 }
 const out=await c.tool.execute({operation,request:f.raw,context:f.ctx});assert.deepEqual(r.assertOutput(out,{request:f.raw,...f.ctx}),out);
 if(operation==='list_scheduled_tasks'){assert.equal(out.status,'listed');assert.equal(c.calls[0][0],'list');assert.equal(out.page.coverage.complete,false);}
 else {assert.equal(out.status,'acknowledged');const intent=c.calls.find(x=>x[0]==='claim')[1].intent;if(operation!=='cancel_scheduled_task')assert.equal(intent.taskInstructionSha256,hash(f.raw.taskInstruction.trim()));assert.ok(c.calls.some(x=>x[0]===({schedule_task:'create',update_scheduled_task:'update',cancel_scheduled_task:'pause'})[operation]));}
});
test('final loader keeps generic private schema names out of global namespace',()=>{for(const name of ['Intent','Configuration','Spec','Execute','List','Context','ArtifactContext','TaskCreateRaw'])assert.throws(()=>canonical.validateShape(name,{}),/Unknown R2 contract/);assert.equal(typeof canonical.scheduleToolValidators.prepare,'function');assert.equal(typeof canonical.commandToolValidators.normalizeCommandToolInput,'function');assert.equal(typeof canonical.artifactValidators.normalizeArtifactInput,'function');});
test('final one canonical catalog covers139 original96selected43deferred and97typed96mapped0pending',()=>{canonical.assertCatalog(catalog);assert.equal(catalog.originals.length,139);assert.equal(catalog.originals.filter(x=>x.disposition==='selected').length,96);assert.equal(catalog.originals.filter(x=>x.state==='deferred').length,43);assert.equal(catalog.originals.filter(x=>x.state==='mapped').length,96);assert.equal(catalog.originals.filter(x=>x.state==='pending').length,0);assert.equal(catalog.operations.length,97);assert.equal(CATALOG_OPERATION_BINDINGS.length,97);assert.equal(new Set(cases.map(x=>x[0])).size,13);for(const [id]of cases)assert.deepEqual(catalog.originals.find(x=>x.id===id).replacement,{id,version:'0.2.0'});});
test('final all97 production routes remain unavailable before authority budget or source effects',async()=>{let effects=0;const refuse=async()=>{effects++;throw Error('Unexpected effect');};const gateway=createSourceDisabledGateway({authorityPorts:{verifyCapability:refuse,currentRun:refuse,authorizeBusiness:refuse,authorizeSources:refuse},budget:{reserve:refuse,settle:refuse,markUncertain:refuse},limits:{maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:100,maxCleanupMs:20},now:()=>NOW,newId:()=>id(99)});for(const d of catalog.operations){assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.retry.maxRetries,0);assert.deepEqual(d.retry.retryableCodes,[]);await assert.rejects(gateway.execute(JSON.stringify({operation:d.operation,arguments:{}}),'synthetic'),/UNAVAILABLE/);}assert.equal(effects,0);assert.deepEqual(await gateway.discover(),[]);assert.equal(gateway.sourceEnabled,false);});
test('final thirteen descriptors bind exact schema bytes and refuse tampering',()=>{for(const [id]of cases){const c=resolve(id),p=c.binding.group==='schedule-tools'?'../schedules-0.2/tool-interface.schema.json':c.binding.group==='command-tools'?'../commands-0.2/tool-interface.schema.json':c.binding.group==='artifacts'?'../artifacts-0.2/artifact.schema.json':'../retrieval-0.2/research-portfolio-evidence.schema.json';const sha=createHash('sha256').update(readFileSync(new URL(p,import.meta.url))).digest('hex');assert.equal(c.descriptor.inputSchema.sha256,sha,id);assert.equal(c.descriptor.outputSchema.sha256,sha,id);const bad=structuredClone(catalog);bad.operations.find(x=>x.operation.id===id).inputSchema.sha256='f'.repeat(64);assert.throws(()=>canonical.assertCatalog(bad));}});
const prior=JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/vertical-source-20261012/vertical-final-review/pr37-identities.json',import.meta.url)));
test('final all84 prior descriptors and full callback bodies survive with only two precise Portfolio footnotes',()=>{
 const replacement='Projected Portfolio evidence has its own get_research_evidence binding; this detail/changes operation does not return it.';
 for(const old of prior.operations){const d=structuredClone(resolve(old.id).descriptor);if(['get_research_portfolio','get_research_portfolio_changes'].includes(old.id)){assert.equal(d.limitations.at(-1),replacement);d.limitations[d.limitations.length-1]=prior.oldPortfolioLimitation;}assert.equal(hash(d),old.sha256,old.id);}
 for(const old of prior.bindings){const b=resolve(old.id).binding,serial=JSON.parse(JSON.stringify(b,(_k,v)=>typeof v==='function'?{source:v.toString()}:v));assert.equal(hash(serial),old.sha256,old.id);}
 for(const old of prior.originals){const expected=structuredClone(old);if(cases.some(x=>x[0]===old.id)){expected.state='mapped';expected.replacement={id:old.id,version:'0.2.0'};}if(old.id==='get_research_evidence'){assert.equal(old.boundary,'Proposed authorized Research Portfolio record/evidence/history read only; owner/client/grant policies and source inclusion require explicit acceptance; management workflow parity deferred.');expected.boundary='D011/R2 selected projected evidence: exact authorized review and retained snapshot plus current annual continuity. Raw member and unrestricted older-history exposure unavailable; no Portfolio management workflow parity.';}assert.deepEqual(catalog.originals.find(x=>x.id===old.id),expected,old.id);}
});
test('final source accounting cannot promote whole requirements or native gates',()=>{
 const ledger=JSON.parse(readFileSync(new URL('../../../docs/qualification/candidates/vertical-source-20261012/integration/requirements-continuation.json',import.meta.url)));
 assert.deepEqual(ledger.counts,{requirements:53,completedSourceDiscovery:2,wholePending:51,wholeRuntimeQualified:0});assert.deepEqual(ledger.gateState,{G0:'ACCEPTED',G1:'OPEN','G2-G7':'UNENTERED'});assert.equal(ledger.sourceEnabled,false);assert.equal(ledger.nativeSummaryJoined,false);assert.equal(ledger.records.length,53);assert.equal(ledger.records.filter(x=>x.status==='completed-source').length,2);
 for(const row of ledger.records){assert.equal(row.qualifiedRuntime,false);assert.equal(row.wholeCriterionPromotion,false);assert.equal(row.status,row.governingRequirement.status);}
});
