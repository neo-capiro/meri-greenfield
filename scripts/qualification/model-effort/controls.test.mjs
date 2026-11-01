/** Offline control counterexamples only. These never qualify a provider/model. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {SOURCE,SOURCE_TREE,IMAGE,COORDINATOR,PAIRS,LIMITS,validatePlan,journal,sha,requestFor,buildBinding,commitment,canonical,manifestFor,parseRuntimeManifest,takeRuntimeManifest,assertCandidateEnvironment,MANIFEST_ENV} from './plan.mjs';
import {observeQuery,assertLoaded} from './observe.mjs';import {runBatch} from './driver.mjs';import {review as reviewNative} from './review.mjs';
const syntheticCollection=events=>({events,receiptSha256:'7'.repeat(64),collectionComplete:true});
const review=(p,product,runtime)=>reviewNative(p,product,runtime,{readReceipt:(_,ctx)=>syntheticCollection(runtime.filter(e=>e.caseId===ctx.c.id))});
import {readNativeReceipt} from './native-receipt.mjs';
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,now=()=>1800000000000;
const plan=()=>{const p=({schema:'meri.model-qualification-driver/1',scope:'isolated-candidate',coordinator:COORDINATOR,baseSourceCommit:SOURCE,baseSourceTree:SOURCE_TREE,baseImageDigest:IMAGE,operatorCommit:'1'.repeat(40),operatorTree:'2'.repeat(40),candidateRecipeSha256:'e'.repeat(64),candidateArchiveSha256:'f'.repeat(64),candidateImageDigest:'sha256:'+'9'.repeat(64),candidateQualificationSha256:'8'.repeat(64),notBeforeMs:now()-1000,expiresAtMs:now()+899000,controlOrigin:'https://candidate.invalid',productionControlOrigin:'https://production.invalid',releaseBindingSha256:'a'.repeat(64),candidatePolicySha256:'b'.repeat(64),productionPolicySha256:'c'.repeat(64),methodSha256:'d'.repeat(64),candidateLogGroup:'/aws/bedrock-agentcore/runtimes/synthetic-candidate',collectorSha256:'6'.repeat(64),cases:PAIRS.map((p,i)=>({id:p.id,binding:{tenantId:'synthetic',actorId:'actor',conversationId:id(10+i),runId:id(20+i),attemptId:id(30+i),workerId:id(40+i),writerFence:1},requestId:id(50+i),sessionCredentialFile:join(tmpdir(),`synthetic-session-${i}`),nativeCredentialFile:join(tmpdir(),`synthetic-native-${i}`),nativeReceiptFile:join(tmpdir(),`synthetic-receipt-${i}.json`)}))});return bindPlan(p);};
const bindPlan=p=>{p.runtimeManifest=canonical(manifestFor(p));p.allocationSha256=sha(p.runtimeManifest);return p;};
test('finite allocation admits exactly five disjoint original requests on an isolated candidate',()=>{
 const p=validatePlan(plan(),now());assert.equal(p.cases.length,5);assert.equal(LIMITS.aggregateEstimateMicroUsd,5*LIMITS.estimateMicroUsdPerCase);assert.equal(LIMITS.aggregateSdkTurns,10);
 for(const mutate of [p=>p.scope='production',p=>p.controlOrigin=p.productionControlOrigin,p=>p.expiresAtMs=Infinity,p=>p.notBeforeMs=now()+1,p=>p.expiresAtMs=now(),p=>p.expiresAtMs=now()+900001,p=>p.baseSourceCommit='0'.repeat(40),p=>p.baseImageDigest='sha256:'+'0'.repeat(64),p=>p.candidateImageDigest=IMAGE,p=>p.candidateQualificationSha256='pending',p=>p.operatorTree=null,p=>p.cases.pop(),p=>p.cases[1].requestId=p.cases[0].requestId,p=>p.cases[1].binding.conversationId=p.cases[0].binding.conversationId,p=>p.cases[1].binding.writerFence=2,p=>p.extra=true]){const bad=plan();mutate(bad);assert.throws(()=>validatePlan(bad,now()));}
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
 for(const mutate of [o=>o.model='other',o=>o.effort='low',o=>o.maxTurns=40,o=>o.maxBudgetUsd=5,o=>o.env.CLAUDE_CODE_USE_BEDROCK=undefined,o=>o.env[MANIFEST_ENV]='must not reach SDK child']){let calls=0;const o=options(PAIRS[0]);mutate(o);const observer=observeQuery({query:()=>calls++,caseId:'model-1',emit(){},abort(){}});assert.throws(()=>observer.query({options:o}));assert.equal(calls,0);}
 let actual,aborts=0;const observer=observeQuery({query:input=>{actual=input;return {next(){return {done:true};}};},caseId:'model-2',emit(){},abort:()=>aborts++});observer.query({options:options(PAIRS[1])});
 assert.equal((await actual.options.hooks.PreToolUse[0].hooks[0]({tool_name:'Agent'})).hookSpecificOutput.permissionDecision,'deny');await actual.options.hooks.Stop[0].hooks[0]({session_id:id(100),effort:{level:'high'}});assert.equal(aborts,2);assert.equal(observer.summary().toolAttempts,1);
});
test('real loaded request must match binding, selected pair and small qualification caps',()=>{
 const c=plan().cases[0],value={run:{binding:c.binding},request:{...requestFor(c),skill:null,window:null},model:{provider:'bedrock',model:PAIRS[0].selection.modelId,effort:'high',region:'us-east-1',maxOutputTokens:32000,usageBasis:{provider:'bedrock'},maxTurns:2,maxCostMicroUSD:250000}};assertLoaded(value,c);
 for(const change of [v=>v.request.modelSelection.effort='max',v=>v.model.maxCostMicroUSD=5000000,v=>v.model.maxTurns=40,v=>v.request.work={},v=>v.run.binding.runId=id(999)]){const v=structuredClone(value);change(v);assert.throws(()=>assertLoaded(v,c));}
});
function fakePorts(p,{unknownPath,usageAmount=.001,runtimeChange}={}){
 const retained=receipts(p);runtimeChange?.(retained.runtime);const calls=[],events=[],catalog={defaultSelection:{...PAIRS[0].selection,effort:null},models:[]};
 const contracts={assertModelCatalog:v=>v,availableModelSelection(){},receiveConversationInitialInputRequest:b=>JSON.parse(new TextDecoder().decode(b)),receiveConversationInitialInputResponse:(_,b)=>JSON.parse(new TextDecoder().decode(b)),receiveAllocatedConversationInputResponse:(_,b)=>JSON.parse(new TextDecoder().decode(b)),receiveConversationRequest:(_,b)=>JSON.parse(new TextDecoder().decode(b)),receiveConversationResponse:(_,__,b)=>JSON.parse(new TextDecoder().decode(b)),receiveConversationUsageRequest:b=>JSON.parse(new TextDecoder().decode(b)),receiveConversationUsageResponse:(_,b)=>JSON.parse(new TextDecoder().decode(b))};
 let current=0;
 const send=async(_,path,token,body)=>{calls.push({path,body});if(path===unknownPath)throw TypeError('synthetic lost acknowledgement');const c=p.cases[current];let value;
  if(path.endsWith('/user/read'))value={owner:{tenantId:c.binding.tenantId,actorId:c.binding.actorId},modelCatalog:catalog};
  else if(path.endsWith('/tenant/read'))value={model:{maxTurns:2,maxBudgetMicroUsd:250000,monthlyCapMicroUsd:10000000}};
  else if(path.endsWith('/allocate'))value={created:true,state:'RESERVED',allocation:{binding:c.binding,requestId:c.requestId}};
  else if(path.endsWith('/admit'))value={replayed:false,request:requestFor(c),run:{binding:c.binding}};
  else if(path.endsWith('/submit'))value={requestId:c.requestId,run:{binding:c.binding}};
  else if(path.endsWith('/history'))value={run:{binding:c.binding,state:'completed'},request:requestFor(c)};
  else if(path.endsWith('/usage')){value=structuredClone(retained.product.find(e=>e.event==='http-receipt'&&e.caseId===c.id&&e.path.endsWith('/usage')).response);value.usage.runDelta.sdkEstimateUsd=usageAmount;current++;}
  else assert.fail(path);return {status:200,value,bytes:new TextEncoder().encode(JSON.stringify(value))};};
 return {calls,events,runtime:retained.runtime,args:{plan:p,contracts,send,readRuntime:()=>syntheticCollection(retained.runtime.filter(e=>Number(e.caseId.slice(-1))===current)),readCredential:()=> 'synthetic',append:e=>events.push(e),now,pause:async()=>{}}};
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
 const p=plan(),at=Date.now();p.notBeforeMs=at-1000;p.expiresAtMs=at+899000;bindPlan(p);const c=p.cases[0],f=initialInputFixture();f.advance(at-f.now());
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
 const runtime=PAIRS.map(pair=>({eventNamespace:'meri-model-qualification/1',allocationSha256:p.allocationSha256,caseId:pair.id,event:'sdk-result',numTurns:3,estimateUsd:.3}));
 const out=review(p,[],runtime);assert.equal(out.aggregateComplete,true);assert.equal(out.observedSdkTurns,15);assert.equal(out.observedEstimateUsd,1.5);assert.equal(out.aggregateWithinBounds,false);assert.equal(out.activationAuthorized,false);
});
function receipts(p){const runtime=[],allocationSha256=p.allocationSha256,product=[{event:'allocation-started',allocationSha256,privateEnvelopeSha256:commitment(p),limits:LIMITS}];for(const [i,pair]of PAIRS.entries()){
 const c=p.cases[i],model=pair.selection.modelId,sessionId=id(100+i),counters={inputTokens:10,outputTokens:5,cacheReadInputTokens:0,cacheCreationInputTokens:0,webSearchRequests:0},m={...counters,costUSD:.001,provider:'bedrock',costBasis:'list'},terminal={subtype:'success',isError:false,numTurns:1,estimateUsd:.001,sessionId,modelUsage:{[model]:m},answerMatches:true};
 const emit=e=>runtime.push({eventNamespace:'meri-model-qualification/1',allocationSha256,caseId:c.id,...e});
 emit({event:'attempt-started',requestId:c.requestId,binding:c.binding,buildBindingSha256:commitment(buildBinding(p)),methodSha256:p.methodSha256,invocationImageDigest:p.candidateImageDigest,releaseBindingSha256:p.releaseBindingSha256});
 emit({event:'loaded-request',requestId:c.requestId,binding:c.binding,modelSelection:pair.selection,imageDigest:p.candidateImageDigest});emit({event:'sdk-options',...options(pair),model,effortPresent:pair.selection.effort!==null,effort:pair.selection.effort,maxOutputTokens:32000,provider:'bedrock',region:'us-east-1',toolGuard:'PreToolUse deny all'});emit({event:'sdk-result',...terminal});
 emit({event:'usage-write',httpStatus:200,usage:{sessionId,sdkEstimateUsd:.001,basis:{provider:'bedrock'}},toolsUsed:{tools:[],omitted:0}});
 emit({event:'settled',receipt:{execution:{binding:c.binding,runtimeSessionId:'synthetic-runtime-session-'+String(i).padStart(10,'0')},settled:true,state:'completed'},observation:{queryCalls:1,toolAttempts:0,init:{sessionId,model},terminal,sdkEffortObservations:[{level:pair.selection.effort??'high',sessionId}]}});
 const response={conversationId:c.binding.conversationId,runId:c.binding.runId,recording:'recorded',usage:{status:'recorded',providerBilledUsd:null,runDelta:{sdkEstimateUsd:.001,modelCounters:[{model,...counters}]},cumulative:{sdkEstimateUsd:.001,basis:{provider:'bedrock'},models:[{model,...counters,provider:'bedrock',sdkEstimateUsd:.001}]}},toolAudit:{tools:[],omitted:0}};
 const exchange=(path,body,response)=>product.push({event:'http-intent',caseId:c.id,path,atMs:now(),requestSha256:sha(JSON.stringify(body))},{event:'http-receipt',caseId:c.id,path,atMs:now(),status:200,response});
 exchange('/api/settings/user/read',{},{});exchange('/api/settings/tenant/read',{},{});
 exchange('/api/conversations/input/allocate',requestFor(c),{created:true,state:'RESERVED',allocation:{binding:c.binding,requestId:c.requestId}});exchange('/api/conversations/input/admit',requestFor(c),{replayed:false,request:requestFor(c),run:{binding:c.binding}});exchange('/api/conversations/submit',requestFor(c),{requestId:c.requestId,run:{binding:c.binding}});
 exchange('/api/conversations/history',{after:0,limit:100},{run:{state:'completed',binding:c.binding},request:requestFor(c)});
 exchange('/api/conversations/usage',{schemaVersion:'meri.conversation-usage/1',conversationId:c.binding.conversationId,runId:c.binding.runId},response);
 product.push({event:'native-case-verified',caseId:c.id,allocationSha256,collectionReceiptSha256:'7'.repeat(64),runtimeReceiptSha256:sha(JSON.stringify(runtime.filter(e=>e.caseId===c.id))),sdkTurns:1,estimateUsd:.001},{event:'case-product-complete',caseId:c.id,selection:pair.selection,estimateUsd:.001,aggregateEstimateUsd:(i+1)*.001,qualification:'PENDING_RUNTIME_RECEIPT_REVIEW'});
 }product.push({event:'product-batch-complete',cases:5,historyReads:5,sdkTurns:5,estimateUsd:.005,qualification:'PENDING_RUNTIME_RECEIPT_REVIEW'});return {runtime,product};}
test('review joins successful receipts and refuses effort, custody and accounting contradictions',()=>{
 const p=plan(),f=receipts(p),good=review(p,f.product,f.runtime);assert.ok(good.cases.every(c=>c.status==='RUNTIME_CASE_PASS'));assert.equal(good.aggregateWithinBounds,true);assert.equal(good.activationAuthorized,false);
 for(const mutate of [f=>f.runtime.find(e=>e.event==='settled').observation.sdkEffortObservations[0].level='low',f=>f.runtime.find(e=>e.event==='attempt-started').methodSha256='0'.repeat(64),f=>f.product.find(e=>e.event==='http-receipt'&&e.path.endsWith('/usage')).response.usage.cumulative.models[0].inputTokens++]){const bad=receipts(p);mutate(bad);assert.equal(review(p,bad.product,bad.runtime).cases[0].status!=='RUNTIME_CASE_PASS',true);}
 const absent=receipts(p);absent.runtime.find(e=>e.event==='settled').observation.sdkEffortObservations=[];assert.equal(review(p,absent.product,absent.runtime).cases[0].status,'UNKNOWN');
});
for(const [name,change]of [
 ['no retained native evidence',rows=>rows.splice(0)],
 ['completed public history followed by native cleanup failure',rows=>{const end=rows.find(e=>e.event==='settled');end.event='unknown-or-failed';end.code='SDK_CLEANUP_UNKNOWN';delete end.receipt;}],
 ['missing explicit Stop effort',rows=>{rows.find(e=>e.event==='settled').observation.sdkEffortObservations=[];}],
 ['pending native cleanup',rows=>{for(let i=rows.length-1;i>=0;i--)if(rows[i].event==='settled')rows.splice(i,1);}],
 ['wrong candidate image in native loaded receipt',rows=>{rows.find(e=>e.event==='loaded-request').imageDigest=IMAGE;}],
])test(`${name} stops before a second original request despite completed history and recorded usage`,async()=>{
 const f=fakePorts(plan(),{runtimeChange:change});let reads=0;const read=f.args.readRuntime;f.args.readRuntime=(...args)=>{reads++;return read(...args);};
 await assert.rejects(runBatch(f.args),/QUALIFICATION_NATIVE_/);assert.equal(f.calls.filter(c=>c.path.endsWith('/submit')).length,1);assert.equal(f.calls.filter(c=>c.path.endsWith('/usage')).length,1);assert.equal(f.events.filter(e=>e.event==='native-case-verified').length,0);assert.ok(reads>=1&&reads<=LIMITS.runtimeReceiptReads);
});
test('driver records native barrier before next case and its complete journal reconciles',async()=>{
 const p=plan(),f=fakePorts(p);f.events.push({event:'allocation-started',allocationSha256:p.allocationSha256,privateEnvelopeSha256:commitment(p),limits:LIMITS});const out=await runBatch(f.args);f.events.push({event:'product-batch-complete',...out});
 const result=review(p,f.events,f.runtime);assert.equal(result.driverJournal.valid,true);assert.ok(result.cases.every(c=>c.status==='RUNTIME_CASE_PASS'));
 const verified=f.events.findIndex(e=>e.event==='native-case-verified'),next=f.events.findIndex(e=>e.caseId==='model-2');assert.ok(verified<next);
});
test('review refuses missing/wrong start, stops, duplicate or partial original exchange, and lost terminal journal',()=>{
 const p=plan();for(const mutate of [
  rows=>rows.shift(),rows=>rows[0].allocationSha256='0'.repeat(64),rows=>rows.push({event:'STOP_NO_RESEND',code:'QUALIFICATION_UNKNOWN'}),
  rows=>rows.splice(5,0,structuredClone(rows[5])),rows=>rows.splice(6,1),rows=>rows.find(e=>e.event==='http-intent'&&e.path.endsWith('/submit')).requestSha256='0'.repeat(64),rows=>rows.pop(),
  rows=>rows.splice(rows.findIndex(e=>e.event==='native-case-verified'),1),rows=>rows.push(structuredClone(rows.at(-1))),
 ]){const f=receipts(p);mutate(f.product);const out=review(p,f.product,f.runtime);assert.equal(out.driverJournal.valid,false);assert.ok(out.cases.every(c=>c.status==='UNKNOWN'));}
});
test('compact common manifest has canonical shared identity and contains no expanded bindings or credential paths',()=>{
 const p=plan(),m=parseRuntimeManifest(p.runtimeManifest,now());assert.ok(Buffer.byteLength(p.runtimeManifest)<=1800);assert.equal(p.allocationSha256,sha(canonical(m)));assert.ok(!p.runtimeManifest.includes('CredentialFile'));assert.ok(!p.runtimeManifest.includes('synthetic-runtime'));assert.ok(!p.runtimeManifest.includes('tenantId'));
 const reordered=structuredClone(p);reordered.cases[0].binding=Object.fromEntries(Object.entries(reordered.cases[0].binding).reverse());assert.equal(validatePlan(reordered,now()).allocationSha256,p.allocationSha256);
 for(const bytes of [JSON.stringify(m,null,2),p.runtimeManifest+' ',p.runtimeManifest.replace('{','{"schema":"duplicate",'),canonical({...m,credential:'forbidden'}),canonical({...m,cases:m.cases.map((c,i)=>i?c:{...c,binding:p.cases[0].binding})})])assert.throws(()=>parseRuntimeManifest(bytes,now()));
 const bad=structuredClone(p);bad.cases[0].binding.actorId='different';assert.throws(()=>validatePlan(bad,now()),/MANIFEST_COMMITMENT|SUBJECT/);
});
test('runtime deletes common environment slot on success and refusal; actual configured map must satisfy both byte limits',()=>{
 const p=plan(),env={[MANIFEST_ENV]:p.runtimeManifest,MERI_CONTROL_CA_BASE64:'synthetic'};const measured=assertCandidateEnvironment(env,now());assert.ok(measured.keyValueBytes<=4000&&measured.jsonBytes<=4000);
 const result=takeRuntimeManifest(env,now());assert.equal(result.allocationSha256,p.allocationSha256);assert.equal(Object.hasOwn(env,MANIFEST_ENV),false);assert.equal(Object.isFrozen(result.manifest),true);assert.equal(Object.isFrozen(result.manifest.cases[0]),true);
 const invalid={[MANIFEST_ENV]:'invalid'};assert.throws(()=>takeRuntimeManifest(invalid,now()));assert.equal(Object.hasOwn(invalid,MANIFEST_ENV),false);
 assert.throws(()=>assertCandidateEnvironment({[MANIFEST_ENV]:p.runtimeManifest,FILL:'x'.repeat(4001)},now()),/SIZE/);
 const escaped={[MANIFEST_ENV]:p.runtimeManifest,FILL:'"'.repeat(1300)};assert.ok(Object.entries(escaped).reduce((n,[k,v])=>n+Buffer.byteLength(k)+Buffer.byteLength(v),0)<4000);assert.throws(()=>assertCandidateEnvironment(escaped,now()),/SIZE/);
});
function retainedCollection(p,index=0,change=()=>{}){
 const dir=mkdtempSync(join(tmpdir(),'meri-native-receipt-')),c=p.cases[index],events=receipts(p).runtime.filter(e=>e.caseId===c.id),start=now()+10,end=start+1;
 const request={atUtc:new Date(start).toISOString(),argv:['aws','logs','filter-log-events','--log-group-name',p.candidateLogGroup,'--start-time',String(now()),'--end-time',String(start),'--filter-pattern',`"meri-model-qualification/1" "${p.allocationSha256}" "${c.id}"`,'--limit','200','--profile','default','--region','us-east-1','--output','json','--no-paginate','--no-cli-pager','--no-cli-auto-prompt','--cli-connect-timeout','5','--cli-read-timeout','5'],attempt:1};
 const body={events:events.map((row,i)=>({eventId:'event-'+i,logStreamName:'synthetic-session',timestamp:now()+1,ingestionTime:now()+2,message:JSON.stringify(row)}))};
 const native={endUtc:new Date(end).toISOString(),nativeExitCode:0,stdoutSha256:null,stdoutBytes:null,stderrSha256:sha(''),stderrBytes:0,outcomeUnknown:false,invocationConsumed:true,retries:0};
 const envelope={schema:'meri.model-qualification-native-receipt/1',allocationSha256:p.allocationSha256,caseId:c.id,binding:c.binding,requestId:c.requestId,buildBindingSha256:commitment(buildBinding(p)),releaseBindingSha256:p.releaseBindingSha256,collectorSha256:p.collectorSha256,logGroupName:p.candidateLogGroup,runtimeSessionId:events.find(e=>e.event==='settled').receipt.execution.runtimeSessionId,startedAtMs:start,finishedAtMs:end,passes:[{startTime:now(),endTime:start,pages:[{requestFile:'01-request.json',requestSha256:null,receiptFile:'01-receipt.json',receiptSha256:null,stdoutFile:'01-stdout.bin',stderrFile:'01-stderr.bin'}]}],extractionFile:'extracted.jsonl',extractionSha256:null};
 const data={request,body,native,envelope,extraction:events.map(e=>JSON.stringify(e)+'\n').join('')};change(data);
 const save=(name,bytes)=>{writeFileSync(join(dir,name),bytes);return sha(bytes);};
 const stdout=JSON.stringify(body);native.stdoutSha256=save('01-stdout.bin',stdout);native.stdoutBytes=Buffer.byteLength(stdout);save('01-stderr.bin','');
 envelope.passes[0].pages[0].requestSha256=save('01-request.json',JSON.stringify(request));envelope.passes[0].pages[0].receiptSha256=save('01-receipt.json',JSON.stringify(native));envelope.extractionSha256=save('extracted.jsonl',data.extraction);
 const path=join(dir,'native.json'),receiptSha256=save('native.json',JSON.stringify(envelope));return {dir,path,events,receiptSha256,context:{plan:p,c,deadline:now()+180000,submitAtMs:now()},close(){rmSync(dir,{recursive:true});}};
}
test('existing native request/receipt/raw stdout files establish a complete bounded extraction, never a bare PASS',()=>{
 const p=plan(),f=retainedCollection(p);try{const out=readNativeReceipt(f.path,f.context);assert.equal(out.collectionComplete,true);assert.equal(out.receiptSha256,f.receiptSha256);assert.deepEqual(out.events,f.events);assert.equal(readNativeReceipt(join(f.dir,'missing.json'),f.context),null);}finally{f.close();}
});
test('published incomplete pagination, failed/retried reads, extraction drift and file escape are refused',()=>{
 const p=plan();for(const change of [d=>d.body.nextToken='more-pages-required',d=>d.native.nativeExitCode=1,d=>d.native.retries=1,d=>d.extraction='{"PASS":true}\n',d=>d.envelope.passes[0].pages[0].requestFile='../escaped.json',d=>d.envelope.buildBindingSha256='0'.repeat(64),d=>d.request.argv[d.request.argv.indexOf('--cli-read-timeout')+1]='60']){const f=retainedCollection(p,0,change);try{assert.throws(()=>readNativeReceipt(f.path,f.context),/QUALIFICATION_LOG_/);}finally{f.close();}}
 const f=retainedCollection(p);try{writeFileSync(join(f.dir,'01-stdout.bin'),'{}');assert.throws(()=>readNativeReceipt(f.path,f.context),/LOG_HASH/);}finally{f.close();}
});
test('positive native settlement in an incomplete raw collection still permits only one original submit',async()=>{
 const p=plan(),f=retainedCollection(p,0,d=>d.body.nextToken='incomplete');try{p.cases[0].nativeReceiptFile=f.path;const ports=fakePorts(p);ports.args.readRuntime=readNativeReceipt;await assert.rejects(runBatch(ports.args),/LOG_INCOMPLETE/);assert.equal(ports.calls.filter(c=>c.path.endsWith('/submit')).length,1);assert.equal(ports.events.filter(e=>e.event==='native-case-verified').length,0);}finally{f.close();}
});
test('final review rechecks retained collection custody and raw-file hashes for every native barrier',()=>{
 const p=plan(),f=receipts(p),collections=PAIRS.map((_,i)=>retainedCollection(p,i));try{for(const [i,item]of collections.entries()){p.cases[i].nativeReceiptFile=item.path;f.product.find(e=>e.caseId===p.cases[i].id&&e.event==='native-case-verified').collectionReceiptSha256=item.receiptSha256;}
  f.product[0].privateEnvelopeSha256=commitment(p);assert.ok(reviewNative(p,f.product,f.runtime).cases.every(c=>c.status==='RUNTIME_CASE_PASS'));writeFileSync(join(collections[0].dir,'01-stdout.bin'),'{}');const out=reviewNative(p,f.product,f.runtime);assert.equal(out.driverJournal.valid,false);assert.ok(out.cases.every(c=>c.status==='UNKNOWN'));
 }finally{for(const item of collections)item.close();}
});
test('manual pagination chains exact tokens and deduplicates only identical CloudWatch transport copies',()=>{
 const f=retainedCollection(plan());try{
  const load=name=>JSON.parse(readFileSync(join(f.dir,name))),save=(name,v)=>{const bytes=JSON.stringify(v);writeFileSync(join(f.dir,name),bytes);return sha(bytes);};
  const envelope=load('native.json'),firstBody=load('01-stdout.bin'),allEvents=firstBody.events,firstNative=load('01-receipt.json');firstBody.events=allEvents.slice(0,-1);firstBody.nextToken='token1';firstNative.stdoutSha256=save('01-stdout.bin',firstBody);firstNative.stdoutBytes=Buffer.byteLength(JSON.stringify(firstBody));envelope.passes[0].pages[0].receiptSha256=save('01-receipt.json',firstNative);
  const secondRequest=load('01-request.json');secondRequest.argv.push('--next-token','token1');secondRequest.atUtc=firstNative.endUtc;
  const secondBody={events:[allEvents[0],allEvents.at(-1)]},secondNative={...firstNative,endUtc:new Date(Date.parse(firstNative.endUtc)+1).toISOString(),stdoutSha256:save('02-stdout.bin',secondBody),stdoutBytes:Buffer.byteLength(JSON.stringify(secondBody))};writeFileSync(join(f.dir,'02-stderr.bin'),'');
  const secondPage={requestFile:'02-request.json',requestSha256:save('02-request.json',secondRequest),receiptFile:'02-receipt.json',receiptSha256:save('02-receipt.json',secondNative),stdoutFile:'02-stdout.bin',stderrFile:'02-stderr.bin'};envelope.passes[0].pages.push(secondPage);envelope.finishedAtMs=Date.parse(secondNative.endUtc);save('native.json',envelope);
  assert.deepEqual(readNativeReceipt(f.path,f.context).events,f.events);
  secondRequest.argv[secondRequest.argv.indexOf('--next-token')+1]='different';secondPage.requestSha256=save('02-request.json',secondRequest);save('native.json',envelope);assert.throws(()=>readNativeReceipt(f.path,f.context),/LOG_REQUEST/);
  secondRequest.argv[secondRequest.argv.indexOf('--next-token')+1]='token1';secondPage.requestSha256=save('02-request.json',secondRequest);secondBody.nextToken='token1';secondNative.stdoutSha256=save('02-stdout.bin',secondBody);secondNative.stdoutBytes=Buffer.byteLength(JSON.stringify(secondBody));secondPage.receiptSha256=save('02-receipt.json',secondNative);save('native.json',envelope);assert.throws(()=>readNativeReceipt(f.path,f.context),/LOG_PAGINATION/);
 }finally{f.close();}
});
