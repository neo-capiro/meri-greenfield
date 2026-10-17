/** The launch descriptor of a continuation run: the SDK (0.3.295) adds exactly the run's continuation arguments to the one configured
 * fresh launch template, and both descriptor matches admit exactly those: the task-side pre-check with the continuation of its session
 * mirror's restoration, control's preparation authority and broker stack with control's own continuation (continuation-runtime.mjs
 * resumeOptions over its durable saved lineage). The layout is checked against descriptors the real SDK emits (spawn hook only; no
 * CLI is read or started). Paths run with POSIX semantics around the descriptor matches (the product runner is Linux). */
import test from 'node:test';
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {query as sdkQuery} from '../../worker/conversation/agent-sdk.mjs';
import {buildConversationOptions} from '../../worker/conversation/options.mjs';
import {buildNextTurnOptions} from '../../worker/conversation/continuation/next-turn-options.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {continuationFixture,id,NOW} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {continuationLaunchArgs,sdkOptionsContinuation,projectKeyOf,SDK_CONTINUATION_FIELDS} from '../native-authority/continuation-pin.mjs';
import {matchPreparedDescriptor,matchPreparedDescriptorShape,preparedLaunchTemplate,compileNativePreparationIntent} from '../native-authority/preparation-intent.mjs';
import {compileNativeBrokerPlan} from '../native-authority/broker-stack.mjs';
import {createNativeContinuationRuntime} from '../native-authority/continuation-runtime.mjs';
import {createCheckpointSessionFactory} from '../checkpoint-session-factory.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

async function posix(fn){
 if(nodePath===nodePath.posix)return fn();
 const saved={};for(const [k,v] of Object.entries(nodePath.posix))if(typeof v==='function'){saved[k]=nodePath[k];nodePath[k]=v;}
 syncBuiltinESMExports();try{return await fn();}finally{Object.assign(nodePath,saved);syncBuiltinESMExports();}
}
const CREDENTIAL='synthetic-run-proxy-credential-0123456789';
/** The product first-chat options (worker buildConversationOptions); the SDK descriptor is captured at its spawn hook. */
function productOptions(binding,extra={}){
 const o=buildConversationOptions({binding,versions:{sdk:'0.3.295',cli:'2.1.295'},cwd:'/workspace/'+binding.conversationId,proxyUrl:'https://proxy.synthetic.invalid/',proxyCredential:CREDENTIAL,model:'synthetic-model',
  sessionStore:{async load(){return null;},async append(){},async listSubkeys(){return [];}},deadlineMs:NOW+60000,maxTurns:8,maxCostMicroUSD:500000,maxOutputBytes:65536},new AbortController());
 return {...o,...extra};
}
async function sdkArgs(options){
 let args=null;try{const q=sdkQuery({prompt:'p',options:{...options,cwd:process.cwd(),spawnClaudeCodeProcess(r){args=[...r.args];throw Error('DESCRIPTOR_CAPTURED_NO_SPAWN');}}});await q.next().catch(()=>{});}catch{}
 assert.ok(args,'the SDK produced a launch descriptor');return args;
}
const pick=options=>Object.fromEntries(SDK_CONTINUATION_FIELDS.filter(k=>Object.hasOwn(options,k)).map(k=>[k,options[k]]));
/** Next-turn and lifecycle-fork lineages with their worker-built continuation options (the one derivation, lineageResumeOptions). */
function lineages(){
 const r=continuationFixture('resume'),fork=continuationFixture('fork');
 const nextTurn={checkpoint:r.continuation.checkpoint,checkpointSha256:r.continuation.checkpointSha256,sourceRequestSha256:r.continuation.sourceRequestSha256,contextSha256:r.continuation.contextSha256,sourceRequest:r.target.sourceRequest,targetBinding:r.target.binding,resumeSessionAt:r.continuation.resumeSessionAt};
 return {next:{f:r,target:r.target,nextTurn,options:buildNextTurnOptions(nextTurn,r.target)},fork:{f:fork,target:fork.target,continuation:fork.continuation,options:buildContinuationOptions(fork.continuation,fork.target)}};
}
const workspaceOf=binding=>'/workspace/'+binding.conversationId;
/** One configured intent for the workload: its launch template is the FRESH product descriptor (as the measurement takes it). */
function intentFor(binding,freshArgs){
 const secure='/run/meri/sdk-secure';
 return {workspace:workspaceOf(binding),configParentDirectory:'/run/meri/sdk-config',secureStorageDirectory:secure,
  launchTemplate:{command:'/opt/meri/claude',args:freshArgs,env:{ANTHROPIC_BASE_URL:'https://proxy.synthetic.invalid/',CLAUDE_SECURESTORAGE_CONFIG_DIR:secure,CLAUDE_CODE_MAX_OUTPUT_TOKENS:'32000',MAX_THINKING_TOKENS:'0'}},
  executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'e'.repeat(64)};
}
const descriptorFor=(intent,binding,args)=>({command:intent.launchTemplate.command,args,cwd:intent.workspace,env:{...intent.launchTemplate.env,CLAUDE_CONFIG_DIR:intent.configParentDirectory+'/sdk-'+binding.runId,ANTHROPIC_AUTH_TOKEN:CREDENTIAL}});
/** Control's own continuation of a run: the native continuation runtime over a durable store holding the saved lineage. */
function controlRuntime({target,nextTurn,continuation}){
 const authority={scopes:target.scopes,selectedClientId:target.scopes[0].resourceId,policyRevision:target.scopes[0].policyRevision},run={binding:target.binding,versions:target.versions,scopes:target.scopes,state:'running'};
 const store={async read(){return {run,request:target.request};},lifecycle:{async execution(){return continuation?{continuation,sourceRequest:target.sourceRequest}:null;}},nextRuns:{async execution(){return nextTurn?{nextTurn}:null;}}};
 const verifier={async verify({binding,operation,inputSha256}){return {binding,operation,inputSha256,identityCredential:'synthetic',...authority,authorizationDecisionId:'synthetic',checkedAtMs:Date.now(),expiresAtMs:Date.now()+10000};}};
 return createNativeContinuationRuntime({store,verifier,taskCapability:'synthetic-task'});
}
/** The task's mirror restoration as the runner initialized it, and the continuation the task side derives from it. */
async function taskContinuation(binding,{nextTurn,continuation,sessionId}){
 const mirror=createCheckpointSessionFactory({binding,client:{async load(){},async listSubkeys(){}},factory:async()=>({store:{async load(){return null;},async append(){},async listSubkeys(){return [];}},async settle(){},async close(){}})});
 await mirror.factory({binding,sessionKey:{projectKey:projectKeyOf(workspaceOf(binding)),sessionId},...(nextTurn?{nextTurn}:{continuation})});
 return sdkOptionsContinuation(mirror.session.restoration(),{binding,workspace:workspaceOf(binding)});
}
function brokerPlan(intent,binding,descriptor,continuation){
 const expiresAtMs=Date.now()+60000,versions={...continuationFixture().target.versions,imageDigest:'sha256:'+intent.imageSha256};
 const runtime={binding,versions,proxyUrl:'https://proxy.synthetic.invalid/',proxyCredential:CREDENTIAL,model:'synthetic-model',deadlineMs:expiresAtMs,maxTurns:8,maxCostMicroUSD:500000,maxOutputBytes:65536};
 const launchConfiguration={binding,workspace:descriptor.cwd,configDirectory:descriptor.env.CLAUDE_CONFIG_DIR,secureStorageDirectory:intent.secureStorageDirectory,versions:{sdk:'0.3.295',cli:'2.1.295'},expiresAtMs,executableSha256:intent.executableSha256,launch:{command:descriptor.command,args:descriptor.args,env:descriptor.env}};
 return compileNativeBrokerPlan({runtime,plan:{purpose:'continuation-launch-test'},preparationIntent:intent,launchConfiguration,...(continuation?{continuation}:{})});
}

test('the SDK adds exactly continuationLaunchArgs to the fresh product descriptor: next turn with and without resumeSessionAt, fork, with tools and plugins',async()=>{
 const {next,fork}=lineages();
 for(const extra of [{},{allowedTools:['mcp__meri_original_reads__read_client'],plugins:[{type:'local',path:'/opt/meri/skill-plugin'}]}]){
  const base=productOptions(next.target.binding,extra),fresh=await sdkArgs(base);
  assert.equal(fresh.some(a=>/^--(resume|fork-session|resume-session-at|session-id)\b/u.test(a)),false,'the fresh template carries no continuation argument');
  for(const expected of [next.options,{resume:next.options.resume},fork.options]){
   const got=await sdkArgs({...base,...expected});
   assert.deepEqual(got,continuationLaunchArgs(fresh,expected),JSON.stringify(expected));
  }
  assert.deepEqual(continuationLaunchArgs(fresh,null),fresh);
 }
 assert.deepEqual(Object.keys(fork.options).sort(),['forkSession','resume','resumeSessionAt','sessionId']);
});

test('a second turn and a fork pass the task-side and control-side descriptor checks under one configured fresh template',async()=>{
 const {next,fork}=lineages(),fresh=await sdkArgs(productOptions(next.target.binding));
 const turns=[
  {name:'next turn',target:next.target,args:await sdkArgs({...productOptions(next.target.binding),...next.options}),control:controlRuntime({target:next.target,nextTurn:next.nextTurn}),task:()=>taskContinuation(next.target.binding,{nextTurn:next.nextTurn,sessionId:next.options.resume}),expected:next.options},
  {name:'fork',target:fork.target,args:await sdkArgs({...productOptions(fork.target.binding),...fork.options}),control:controlRuntime({target:fork.target,continuation:fork.continuation}),task:()=>taskContinuation(fork.target.binding,{continuation:fork.continuation,sessionId:fork.options.sessionId}),expected:fork.options},
 ];
 for(const turn of turns){
  const binding=turn.target.binding,controlExpected=await turn.control.resumeOptions({binding}),taskExpected=await turn.task();
  assert.deepEqual({...controlExpected},{...turn.expected},turn.name+': control derives the worker options from its own saved lineage');
  assert.deepEqual({...taskExpected},{...turn.expected},turn.name+': the task derives them from its mirror restoration');
  await posix(async()=>{
   const intent=intentFor(binding,fresh),descriptor=descriptorFor(intent,binding,turn.args);
   assert.deepEqual(matchPreparedDescriptorShape(descriptor,intent,taskExpected).args,turn.args,turn.name+': task-side pre-check');
   assert.deepEqual(matchPreparedDescriptor(descriptor,intent,CREDENTIAL,controlExpected).args,turn.args,turn.name+': control preparation authority');
   assert.deepEqual(brokerPlan(intent,binding,descriptor,controlExpected).launchConfiguration.launch.args,turn.args,turn.name+': control broker stack');
   // Reconcile rebuilds exactly this launch from the template and control's continuation.
   assert.deepEqual(preparedLaunchTemplate(intent,controlExpected).args,turn.args);
   assert.equal(hash(compileNativePreparationIntent(intent).launchTemplate),hash(intentFor(next.target.binding,fresh).launchTemplate),'one configured template');
   // The same descriptor without the run's continuation (a fresh expectation) refuses on every side.
   assert.throws(()=>matchPreparedDescriptorShape(descriptor,intent),/PREPARATION_REFUSED/u);assert.throws(()=>matchPreparedDescriptor(descriptor,intent,CREDENTIAL),/PREPARATION_REFUSED/u);
   assert.throws(()=>brokerPlan(intent,binding,descriptor),/PREPARATION_REFUSED/u);
  });
 }
 // A fresh run still passes with no continuation, and a fresh descriptor refuses under a continuation expectation.
 await posix(async()=>{const intent=intentFor(next.target.binding,fresh),descriptor=descriptorFor(intent,next.target.binding,fresh);
  matchPreparedDescriptorShape(descriptor,intent);matchPreparedDescriptor(descriptor,intent,CREDENTIAL);brokerPlan(intent,next.target.binding,descriptor);
  assert.throws(()=>matchPreparedDescriptor(descriptor,intent,CREDENTIAL,next.options),/PREPARATION_REFUSED/u,'continuation arguments missing');
  assert.throws(()=>matchPreparedDescriptorShape(descriptor,intent,next.options),/PREPARATION_REFUSED/u);
 });
 // Control with no saved lineage derives a fresh run.
 assert.equal(await controlRuntime({target:next.target}).resumeOptions({binding:next.target.binding}),null);
});

test('foreign, missing, extra or misplaced continuation arguments refuse; a template carrying them is refused as configuration',async()=>{
 const {next,fork}=lineages(),binding=next.target.binding,fresh=await sdkArgs(productOptions(binding)),good=continuationLaunchArgs(fresh,next.options);
 const foreign=id(777),at=good.findIndex(a=>a.startsWith('--resume=')),sat=good.findIndex(a=>a.startsWith('--resume-session-at='));
 const variants={
  foreignResume:good.map(a=>a.startsWith('--resume=')?'--resume='+foreign:a),foreignResumeSessionAt:good.map(a=>a.startsWith('--resume-session-at=')?'--resume-session-at='+foreign:a),
  missingResume:good.filter((_,i)=>i!==at),missingResumeSessionAt:good.filter((_,i)=>i!==sat),missingAll:fresh,
  extraForkSession:[...good.slice(0,sat),'--fork-session',...good.slice(sat)],extraSessionId:[...good,'--session-id='+foreign],duplicateResume:[...good.slice(0,at),good[at],...good.slice(at)],
  resumeMoved:[...good.filter((_,i)=>i!==at),good[at]],resumeSessionAtMoved:[...good.slice(0,at),good[sat],...good.slice(at).filter(a=>a!==good[sat])],
  otherConversationArgs:continuationLaunchArgs(fresh,fork.options),
 };
 await posix(async()=>{
  const intent=intentFor(binding,fresh);
  matchPreparedDescriptor(descriptorFor(intent,binding,good),intent,CREDENTIAL,next.options);
  for(const [name,args] of Object.entries(variants)){const descriptor=descriptorFor(intent,binding,args);
   assert.throws(()=>matchPreparedDescriptor(descriptor,intent,CREDENTIAL,next.options),/PREPARATION_REFUSED/u,'control '+name);
   assert.throws(()=>matchPreparedDescriptorShape(descriptor,intent,next.options),/PREPARATION_REFUSED/u,'task '+name);}
  // The expectation itself must be a well-formed continuation, and the configured template must be fresh.
  for(const bad of [{resume:'x'},{resume:next.options.resume,forkSession:true},{resume:next.options.resume,sessionId:next.options.resume,forkSession:true},{resume:next.options.resume,extra:1}])
   assert.throws(()=>matchPreparedDescriptor(descriptorFor(intent,binding,good),intent,CREDENTIAL,bad),/PREPARATION_REFUSED/u,JSON.stringify(bad));
  const carrying=intentFor(binding,good);assert.throws(()=>preparedLaunchTemplate(carrying,null),/PREPARATION_REFUSED/u,'a template with --resume is not a fresh template');
  assert.throws(()=>continuationLaunchArgs(fresh.filter(a=>a!=='--verbose'),next.options),/PREPARATION_REFUSED/u,'no SDK header');
 });
});
