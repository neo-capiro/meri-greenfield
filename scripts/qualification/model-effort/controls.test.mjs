/** Offline control counterexamples only. These never qualify a provider/model. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {SOURCE,IMAGE,COORDINATOR,PAIRS,LIMITS,validatePlan,journal,sha,requestFor} from './plan.mjs';
import {observeQuery,assertLoaded} from './observe.mjs';import {runBatch} from './driver.mjs';import {review} from './review.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,now=()=>1800000000000;
const plan=()=>({schema:'meri.model-qualification/1',scope:'isolated-candidate',coordinator:COORDINATOR,sourceCommit:SOURCE,imageDigest:IMAGE,notBeforeMs:now()-1000,expiresAtMs:now()+899000,controlOrigin:'https://candidate.invalid',productionControlOrigin:'https://production.invalid',releaseBindingSha256:'a'.repeat(64),candidatePolicySha256:'b'.repeat(64),productionPolicySha256:'c'.repeat(64),methodSha256:'d'.repeat(64),cases:PAIRS.map((p,i)=>({id:p.id,binding:{tenantId:'synthetic',actorId:'actor',conversationId:id(10+i),runId:id(20+i),attemptId:id(30+i),workerId:id(40+i),writerFence:1},requestId:id(50+i),sessionCredentialFile:join(tmpdir(),`synthetic-session-${i}`),nativeCredentialFile:join(tmpdir(),`synthetic-native-${i}`)}))});
test('finite allocation admits exactly five disjoint original requests on an isolated candidate',()=>{
 const p=validatePlan(plan(),now());assert.equal(p.cases.length,5);assert.equal(LIMITS.aggregateEstimateMicroUsd,5*LIMITS.estimateMicroUsdPerCase);assert.equal(LIMITS.aggregateSdkTurns,10);
 for(const mutate of [p=>p.scope='production',p=>p.controlOrigin=p.productionControlOrigin,p=>p.expiresAtMs=Infinity,p=>p.notBeforeMs=now()+1,p=>p.expiresAtMs=now(),p=>p.expiresAtMs=now()+900001,p=>p.sourceCommit='0'.repeat(40),p=>p.imageDigest='sha256:'+'0'.repeat(64),p=>p.cases.pop(),p=>p.cases[1].requestId=p.cases[0].requestId,p=>p.cases[1].binding.conversationId=p.cases[0].binding.conversationId,p=>p.cases[1].binding.writerFence=2,p=>p.extra=true]){const bad=plan();mutate(bad);assert.throws(()=>validatePlan(bad,now()));}
});
test('exclusive intent survives close and cannot be reopened for replay',()=>{const dir=mkdtempSync(join(tmpdir(),'meri-model-control-'));try{const file=join(dir,'attempted'),log=journal(file);log.append({intent:true});log.close();assert.throws(()=>journal(file));assert.equal(JSON.parse(readFileSync(file)).intent,true);}finally{rmSync(dir,{recursive:true});}});
const options=pair=>({model:pair.selection.modelId,...(pair.selection.effort===null?{}:{effort:pair.selection.effort}),env:{CLAUDE_CODE_USE_BEDROCK:'1',AWS_REGION:'us-east-1',CLAUDE_CODE_MAX_OUTPUT_TOKENS:'32000'},maxTurns:2,maxBudgetUsd:.25,systemPrompt:{preset:'claude_code'},tools:{preset:'claude_code'},hooks:{}});
for(const pair of PAIRS)test(`${pair.id}: observes actual query options/Stop effort/result and preserves close/return`,async()=>{
 const events=[];let actual,closed=0,returned=0;
 const observer=observeQuery({caseId:pair.id,emit:e=>events.push(e),abort:()=>assert.fail('unexpected abort'),query:input=>{actual=input;const messages=[{type:'system',subtype:'init',session_id:id(100),model:pair.selection.modelId},{type:'result',subtype:'success',is_error:false,num_turns:1,total_cost_usd:.001,session_id:id(100),result:'model qualification complete.',modelUsage:{[pair.selection.modelId]:{provider:'bedrock',costUSD:.001}}}];return {async next(){return messages.length?{done:false,value:messages.shift()}:{done:true};},close(){closed++;},async return(){returned++;return {done:true};}};}});
 const stream=observer.query({prompt:'synthetic',options:options(pair)});assert.equal(stream[Symbol.asyncIterator](),stream);await stream.next();await actual.options.hooks.Stop[0].hooks[0]({session_id:id(100),effort:{level:pair.selection.effort??'high'}});await stream.next();stream.close();await stream.return();
 assert.equal(closed,1);assert.equal(returned,1);assert.equal(observer.summary().sdkEffortObservations[0].level,pair.selection.effort??'high');assert.equal(observer.summary().providerEffortAcknowledgement,'UNKNOWN');assert.ok(events.some(e=>e.event==='sdk-options'));assert.throws(()=>observer.query({options:options(pair)}),/SECOND_QUERY/);
});
test('wrong option/cap is refused before the SDK; tools and silent downgrade abort',async()=>{
 for(const mutate of [o=>o.model='other',o=>o.effort='low',o=>o.maxTurns=40,o=>o.maxBudgetUsd=5,o=>o.env.CLAUDE_CODE_USE_BEDROCK=undefined]){let calls=0;const o=options(PAIRS[0]);mutate(o);const observer=observeQuery({query:()=>calls++,caseId:'model-1',emit(){},abort(){}});assert.throws(()=>observer.query({options:o}));assert.equal(calls,0);}
 let actual,aborts=0;const observer=observeQuery({query:input=>{actual=input;return {next(){return {done:true};}};},caseId:'model-2',emit(){},abort:()=>aborts++});observer.query({options:options(PAIRS[1])});
 assert.equal((await actual.options.hooks.PreToolUse[0].hooks[0]({tool_name:'Agent'})).hookSpecificOutput.permissionDecision,'deny');await actual.options.hooks.Stop[0].hooks[0]({session_id:id(100),effort:{level:'high'}});assert.equal(aborts,2);assert.equal(observer.summary().toolAttempts,1);
});
test('real loaded request must match binding, selected pair and small qualification caps',()=>{
 const c=plan().cases[0],value={run:{binding:c.binding},request:{...requestFor(c),skill:null,window:null},model:{provider:'bedrock',model:PAIRS[0].selection.modelId,effort:'high',region:'us-east-1',maxOutputTokens:32000,usageBasis:{provider:'bedrock'},maxTurns:2,maxCostMicroUSD:250000}};assertLoaded(value,c);
 for(const change of [v=>v.request.modelSelection.effort='max',v=>v.model.maxCostMicroUSD=5000000,v=>v.model.maxTurns=40,v=>v.request.work={},v=>v.run.binding.runId=id(999)]){const v=structuredClone(value);change(v);assert.throws(()=>assertLoaded(v,c));}
});
function fakePorts(p,{unknownPath,usageAmount=.001}={}){
 const calls=[],events=[],catalog={defaultSelection:{...PAIRS[0].selection,effort:null},models:[]};
 const contracts={assertModelCatalog:v=>v,availableModelSelection(){},receiveConversationInitialInputRequest:b=>JSON.parse(new TextDecoder().decode(b)),receiveConversationInitialInputResponse:(_,b)=>JSON.parse(new TextDecoder().decode(b)),receiveAllocatedConversationInputResponse:(_,b)=>JSON.parse(new TextDecoder().decode(b)),receiveConversationRequest:(_,b)=>JSON.parse(new TextDecoder().decode(b)),receiveConversationResponse:(_,__,b)=>JSON.parse(new TextDecoder().decode(b)),receiveConversationUsageRequest:b=>JSON.parse(new TextDecoder().decode(b)),receiveConversationUsageResponse:(_,b)=>JSON.parse(new TextDecoder().decode(b))};
 let current=0;
 const send=async(_,path,token,body)=>{calls.push({path,body});if(path===unknownPath)throw TypeError('synthetic lost acknowledgement');const c=p.cases[current];let value;
  if(path.endsWith('/user/read'))value={owner:{tenantId:c.binding.tenantId,actorId:c.binding.actorId},modelCatalog:catalog};
  else if(path.endsWith('/tenant/read'))value={model:{maxTurns:2,maxBudgetMicroUsd:250000,monthlyCapMicroUsd:10000000}};
  else if(path.endsWith('/allocate'))value={created:true,state:'RESERVED',allocation:{binding:c.binding}};
  else if(path.endsWith('/admit'))value={replayed:false,request:requestFor(c)};
  else if(path.endsWith('/submit'))value={run:{binding:c.binding}};
  else if(path.endsWith('/history'))value={run:{binding:c.binding,state:'completed'},request:requestFor(c)};
  else if(path.endsWith('/usage')){value={recording:'recorded',usage:{status:'recorded',providerBilledUsd:null,runDelta:{sdkEstimateUsd:usageAmount}},toolAudit:{tools:[],omitted:0}};current++;}
  else assert.fail(path);return {status:200,value,bytes:new TextEncoder().encode(JSON.stringify(value))};};
 return {calls,events,args:{plan:p,contracts,send,readCredential:()=> 'synthetic',append:e=>events.push(e),now,pause:async()=>{}}};
}
test('driver uses five distinct product admissions, one submit each, and never claims qualification from answers',async()=>{const f=fakePorts(plan()),out=await runBatch(f.args);assert.equal(out.cases,5);assert.equal(out.qualification,'PENDING_RUNTIME_RECEIPT_REVIEW');assert.equal(f.calls.filter(c=>c.path.endsWith('/submit')).length,5);assert.equal(f.calls.length,35);assert.equal(new Set(f.calls.filter(c=>c.path.endsWith('/submit')).map(c=>c.body.requestId)).size,5);});
for(const path of ['/api/conversations/input/allocate','/api/conversations/input/admit','/api/conversations/submit'])test(`unknown ${path} stops without retry or next case`,async()=>{const f=fakePorts(plan(),{unknownPath:path});await assert.rejects(runBatch(f.args));assert.equal(f.calls.filter(c=>c.path===path).length,1);assert.equal(f.events.filter(e=>e.event==='case-product-complete').length,0);});
test('post-result estimate overrun stops before another case; empty runtime evidence cannot pass',async()=>{const p=plan(),f=fakePorts(p,{usageAmount:.251});await assert.rejects(runBatch(f.args),/USAGE_OR_TOOLS/);assert.equal(f.calls.filter(c=>c.path.endsWith('/submit')).length,1);assert.ok(review(p,[],[]).cases.every(c=>c.status==='UNKNOWN'));});
test('disabled policy correction keeps default and pending efforts closed without aliasing history',async()=>{
 const policy=JSON.parse(readFileSync(new URL('../../../infra/product-preview/first-chat/policy.json',import.meta.url))),{assertModelCatalog,availableModelSelection,storedModelSelection}=await import('../../../packages/contracts/model-selection.mjs');assertModelCatalog(policy.models);
 assert.equal(policy.models.models[1].modelId,'us.anthropic.claude-opus-4-6-v1');assert.equal(policy.models.models[1].available,false);for(const pair of PAIRS)assert.throws(()=>availableModelSelection(policy.models,pair.selection));
 const old={provider:'bedrock',modelId:'us.anthropic.claude-opus-4-6',effort:null};assert.deepEqual(storedModelSelection({modelSelection:old}),old);assert.equal(policy.models.defaultSelection.effort,null);
});
test('real service allocations and public receivers reach one submit without an invented settings owner',async()=>{
 const [{initialInputFixture},{createConversationService},{versions},{hash},{MODEL_CATALOG}]=await Promise.all([
  import('../../../apps/control/conversations/test/initial-input-fixture.mjs'),import('../../../apps/control/conversations/service.mjs'),import('../../../apps/control/conversations/test/store-fixture.mjs'),import('../../../apps/control/conversations/boundary.mjs'),import('../../../packages/contracts/test/model-selection-fixture.mjs')]);
 const p=plan(),at=Date.now();p.notBeforeMs=at-1000;p.expiresAtMs=at+899000;const c=p.cases[0],f=initialInputFixture();f.advance(at-f.now());
 const context={binding:c.binding,scopes:[{tenantId:c.binding.tenantId,kind:'private-user',resourceId:c.binding.actorId,policyRevision:'p1'}],selectedClientId:null};
 const sessions={async authenticateSession(){return {principal:{tenantId:c.binding.tenantId,actorId:c.binding.actorId,conversationId:c.binding.conversationId,runId:c.binding.runId},checkedAtMs:f.now(),expiresAtMs:f.now()+30000};},async readCurrentState({authentication}){return {authenticationSha256:hash(authentication),...context,checkedAtMs:f.now(),expiresAtMs:f.now()+30000};}};
 let serial=200,submits=0;const service=createConversationService({sessions,store:f.store(),versions,modelCatalog:MODEL_CATALOG,now:f.now,newId:()=>id(serial++),dispatcher:{async start(){submits++;},async cancel(){}}});
 const paths=[],send=async(_,path,token,body)=>{paths.push(path);let value;
  if(path.endsWith('/user/read'))value={revision:0,preferences:{},modelCatalog:MODEL_CATALOG};
  else if(path.endsWith('/tenant/read'))value={model:{maxTurns:2,maxBudgetMicroUsd:250000,monthlyCapMicroUsd:10000000}};
  else if(path.endsWith('/allocate'))value=await service.allocateInput({credential:'synthetic',input:body});
  else if(path.endsWith('/admit'))value=await service.admitInput({credential:'synthetic',input:body});
  else if(path.endsWith('/submit'))value=await service.submit({credential:'synthetic',input:body});
  else throw Error('SYNTHETIC_HISTORY_STOP');return {status:200,value,bytes:new TextEncoder().encode(JSON.stringify(value))};};
 await assert.rejects(runBatch({plan:p,append(){},readCredential:()=> 'synthetic',send,now:()=>at}),/SYNTHETIC_HISTORY_STOP/);assert.equal(submits,1);assert.equal(paths.filter(p=>p.endsWith('/submit')).length,1);
});
test('receipt reconciliation never reports empty or over-budget evidence as aggregate success',()=>{
 const p=plan();assert.equal(review(p,[],[]).aggregateWithinBounds,null);
 const runtime=PAIRS.map(pair=>({eventNamespace:'meri-model-qualification/1',allocationSha256:sha(JSON.stringify(p)),caseId:pair.id,event:'sdk-result',numTurns:3,estimateUsd:.3}));
 const out=review(p,[],runtime);assert.equal(out.aggregateComplete,true);assert.equal(out.observedSdkTurns,15);assert.equal(out.observedEstimateUsd,1.5);assert.equal(out.aggregateWithinBounds,false);assert.equal(out.activationAuthorized,false);
});
function receipts(p){const runtime=[],product=[],allocationSha256=sha(JSON.stringify(p));for(const [i,pair]of PAIRS.entries()){
 const c=p.cases[i],model=pair.selection.modelId,sessionId=id(100+i),counters={inputTokens:10,outputTokens:5,cacheReadInputTokens:0,cacheCreationInputTokens:0,webSearchRequests:0},m={...counters,costUSD:.001,provider:'bedrock',costBasis:'list'},terminal={subtype:'success',isError:false,numTurns:1,estimateUsd:.001,sessionId,modelUsage:{[model]:m},answerMatches:true};
 const emit=e=>runtime.push({eventNamespace:'meri-model-qualification/1',allocationSha256,caseId:c.id,...e});
 emit({event:'attempt-started',requestId:c.requestId,binding:c.binding,declaredSource:p.sourceCommit,declaredImage:p.imageDigest,methodSha256:p.methodSha256,releaseBindingSha256:p.releaseBindingSha256});
 emit({event:'loaded-request',requestId:c.requestId,binding:c.binding,modelSelection:pair.selection});emit({event:'sdk-options',...options(pair),model,effortPresent:pair.selection.effort!==null,effort:pair.selection.effort,maxOutputTokens:32000,provider:'bedrock',region:'us-east-1',toolGuard:'PreToolUse deny all'});emit({event:'sdk-result',...terminal});
 emit({event:'usage-write',httpStatus:200,usage:{sessionId,sdkEstimateUsd:.001,basis:{provider:'bedrock'}},toolsUsed:{tools:[],omitted:0}});
 emit({event:'settled',receipt:{execution:{binding:c.binding},settled:true,state:'completed'},observation:{queryCalls:1,toolAttempts:0,init:{sessionId,model},terminal,sdkEffortObservations:[{level:pair.selection.effort??'high',sessionId}]}});
 product.push({event:'case-product-complete',caseId:c.id},{event:'http-receipt',caseId:c.id,path:'/api/conversations/usage',response:{conversationId:c.binding.conversationId,runId:c.binding.runId,recording:'recorded',usage:{status:'recorded',providerBilledUsd:null,runDelta:{sdkEstimateUsd:.001,modelCounters:[{model,...counters}]},cumulative:{sdkEstimateUsd:.001,basis:{provider:'bedrock'},models:[{model,...counters,provider:'bedrock',sdkEstimateUsd:.001}]}},toolAudit:{tools:[],omitted:0}}});
 }return {runtime,product};}
test('review joins successful receipts and refuses effort, custody and accounting contradictions',()=>{
 const p=plan(),f=receipts(p),good=review(p,f.product,f.runtime);assert.ok(good.cases.every(c=>c.status==='RUNTIME_CASE_PASS'));assert.equal(good.aggregateWithinBounds,true);assert.equal(good.activationAuthorized,false);
 for(const mutate of [f=>f.runtime.find(e=>e.event==='settled').observation.sdkEffortObservations[0].level='low',f=>f.runtime.find(e=>e.event==='attempt-started').methodSha256='0'.repeat(64),f=>f.product.find(e=>e.event==='http-receipt').response.usage.cumulative.models[0].inputTokens++]){const bad=receipts(p);mutate(bad);assert.equal(review(p,bad.product,bad.runtime).cases[0].status,'FAIL');}
 const absent=receipts(p);absent.runtime.find(e=>e.event==='settled').observation.sdkEffortObservations=[];assert.equal(review(p,absent.product,absent.runtime).cases[0].status,'UNKNOWN');
});
