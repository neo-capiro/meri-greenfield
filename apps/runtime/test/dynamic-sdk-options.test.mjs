/** The runner's SDK options pin for dynamic first-chat runs: control issues each new conversation's preparation intent through the
 * real multi-run bindings (prepareInitial -> runIssuance facts), the runner composes that run's options exactly as the remote path
 * does (conversation-runner sdkConfigurationDirectories, worker buildConversationOptions, request-context suffix), and runner-query's
 * gate admits every run with the ONE configured sdkOptionsSha256 while refusing any option control did not sanction. A second turn of a
 * conversation (writer fence 2, control's facts producer, the next-turn lineage of turn 1's checkpoint and its restore receipt) composes
 * its resume fields through the same worker builder, initializes the real checkpoint session mirror over the real continuation SDK
 * session exactly as conversation-runner prepareRuntime does, and passes the same gate with the same configured hash. Paths run with
 * POSIX semantics on every host (the product runner is Linux; node:path is swapped only around each test body). */
import test from 'node:test';
import assert from 'node:assert/strict';
import nodePath from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {initialInputFixture} from '../../control/conversations/test/initial-input-fixture.mjs';
import {id} from '../../control/conversations/test/store-fixture.mjs';
import {createPreparedRunBindings} from '../prepared-run-bindings.mjs';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {sdkConfigurationDirectories} from '../conversation-runner.mjs';
import {compileNativePreparationIntent} from '../native-authority/preparation-intent.mjs';
import {createPreparedRunnerQuery} from '../native-authority/runner-query.mjs';
import {sdkOptionsPin,sdkOptionsRun,sdkOptionsTemplateSha256,projectSdkOptionsTemplate,authorityDigest,REQUEST_CONTEXT_MARKER,sdkOptionsRestoration,sdkOptionsContinuation,SDK_CONTINUATION_FIELDS} from '../native-authority/sdk-option-template.mjs';
import {buildConversationOptions} from '../../worker/conversation/options.mjs';
import {buildContinuationOptions,continuationContextSha256} from '../../worker/conversation/continuation/options.mjs';
import {continuationFixture} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {createCheckpointSessionFactory} from '../checkpoint-session-factory.mjs';
import {createContinuationRuntimeSdkSession} from '../sdk-continuation-session.mjs';
import {requestContextSuffix} from '../../worker/conversation/request-context.mjs';
import {createSdkMcpServer} from '../../worker/conversation/agent-sdk.mjs';

async function posix(fn){
 if(nodePath===nodePath.posix)return fn();
 const saved={};for(const [k,v] of Object.entries(nodePath.posix))if(typeof v==='function'){saved[k]=nodePath[k];nodePath[k]=v;}
 syncBuiltinESMExports();try{return await fn();}finally{Object.assign(nodePath,saved);syncBuiltinESMExports();}
}
const hostPath=Object.fromEntries(Object.entries(nodePath).filter(([,v])=>typeof v==='function'));
/** Host path semantics for module resolution inside a POSIX test body (checkpoint-snapshot.mjs imports its verifier lazily). */
async function hostPaths(fn){
 if(nodePath===nodePath.posix)return fn();
 const current=Object.fromEntries(Object.keys(hostPath).map(k=>[k,nodePath[k]]));Object.assign(nodePath,hostPath);syncBuiltinESMExports();
 try{return await fn();}finally{Object.assign(nodePath,current);syncBuiltinESMExports();}
}
const sessionStore=()=>({async load(){},async append(){},async listSubkeys(){}});
/** The runner's composition of one run's options (conversation-runner.mjs prepareRuntime + activity.mjs, first chat: no skill or policy).
 * A later turn adds the runtime's restore receipt and the activity's continuation context (activity.mjs: lineage, request, sourceRequest,
 * scopes, started, now), so buildConversationOptions composes the resume fields through buildNextTurnOptions. */
function runnerOptions({runtime,preparationIntent,binding,request,scopes,continuation}){
 const {sdkSessionKey:_,...r}=runtime,configuration={binding,workspace:preparationIntent.workspace,remoteTask:{preparationIntent}};
 const options=buildConversationOptions({...r,cwd:configuration.workspace,sessionStore:sessionStore(),...(continuation?{restoreReceipt:continuation.restoreReceipt}:{}),...sdkConfigurationDirectories(configuration,{})},new AbortController(),
  continuation?{nextTurn:continuation.nextTurn,request,sourceRequest:continuation.nextTurn.sourceRequest,scopes,started:continuation.started,now:continuation.now}:undefined);
 options.systemPrompt+=requestContextSuffix({window:request?.window,scopes,skill:request?.skill});
 return options;
}
/** The remote worker's gate (remote-composition.mjs createRemoteNativeWorker): the pin from the intent and original binding, and the
 * restoration source over the task's checkpoint session mirror when one is passed. */
const gate=(intent,binding,restoration)=>createPreparedRunnerQuery({sdkOptions:sdkOptionsPin(compileNativePreparationIntent(intent),binding),...(restoration===undefined?{}:{restoration}),processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
const admitted=(intent,binding,options,restoration)=>{const stream=gate(intent,binding,restoration)({prompt:'p',options});assert.equal(typeof stream[Symbol.asyncIterator],'function');};
const refused=(intent,binding,options,label,restoration)=>assert.throws(()=>gate(intent,binding,restoration)({prompt:'p',options}),/SDK_OPTIONS_REFUSED/u,label);
const projectKeyOf=workspace=>workspace.replace(/[^a-zA-Z0-9]/gu,'-');
/** The task's checkpoint session mirror (remote-conversation-runner.mjs) initialized as conversation-runner prepareRuntime does: a fresh
 * run with control's null session key; a later turn with control's restored session key and the lineage over the real continuation SDK
 * session, which verifies control's immutable snapshot readback before the mirror records anything. */
async function initializedMirror(binding,{sessionKey=null,nextTurn,snapshot}={}){
 const plain=async()=>({store:{async load(){return null;},async append(){},async listSubkeys(){return [];}},async settle(){},async close(){}});
 const client={async snapshot(){return structuredClone(snapshot);},async register(){assert.fail('not reached');},async load(){assert.fail('not reached');},async append(){assert.fail('not reached');},async listSubkeys(){assert.fail('not reached');}};
 const mirror=createCheckpointSessionFactory({binding,client:{async load(){},async listSubkeys(){}},factory:nextTurn===undefined?plain:value=>createContinuationRuntimeSdkSession({client,binding:value.binding,sessionKey:value.sessionKey,nextTurn:value.nextTurn})});
 await hostPaths(()=>mirror.factory({binding,sessionKey,...(nextTurn===undefined?{}:{nextTurn})}));
 return mirror;
}

/** One configuration whose sdkOptionsSha256 is the template of its static candidate run, and dynamic initial runs issued by control. */
async function fixture(){
 const f=candidateFixture(),c=f.configuration.nativeCandidate,selectedClientId=c.identity.commandContext.clientResolution.clientId,policyRevision=c.qualification.policyRevision;
 c.multiRun={runWindowMs:60000,materialDirectory:'/synthetic-meri-material',dynamicInitialRuns:true};
 // The configured value: the run-invariant template of the static candidate run (as the in-image measurement computes it).
 const staticScopes=[{kind:'client',tenantId:f.binding.tenantId,resourceId:selectedClientId,policyRevision}];
 const staticOptions=runnerOptions({runtime:{...c.runtime,proxyCredential:'synthetic-static-proxy'},preparationIntent:{...c.preparationIntent,sdkOptionsSha256:'0'.repeat(64)},binding:f.binding,request:{window:null,skill:null},scopes:staticScopes});
 c.preparationIntent.sdkOptionsSha256=sdkOptionsTemplateSha256(staticOptions,sdkOptionsRun(c.preparationIntent,f.binding));
 const admissions=new Map(),saved=new Map(),key=b=>hash(b);
 const initialBindings={async read({binding},check){check();return structuredClone(admissions.get(key(binding))??null);},async readConversation(){return null;}};
 const store={async readOptional(binding){return structuredClone(saved.get(key(binding))??null);},async read(binding){return structuredClone(saved.get(key(binding)));},allocations:{async read(){return {record:null};}}};
 const capabilityAuthority={async generate({issuanceKey}){return {grantId:id(900),capability:'synthetic-dynamic-task-'+issuanceKey.slice(0,8),materialRef:'ref-'+issuanceKey.slice(0,8)};},async retrieve({materialRef}){return {state:'PRESENT',capability:'synthetic-dynamic-task-'+materialRef.slice(4)};},async status(){return {state:'ABSENT'};}};
 const modelGrants={async issue({intent}){const proxyCredential='synthetic-dynamic-model-'+intent.issuanceKey.slice(0,16);return {...intent,grantId:id(901),capabilitySha256:capabilityDigest(proxyCredential),proxyCredential};}};
 const ports=createPreparedRunBindings({configuration:f.configuration,pool:{connect(){assert.fail('No database');}},store,credentials:{control:f.secret.control},issuanceStore:createMemoryIssuanceStore(),capabilityAuthority,modelGrants,initialBindings,now:()=>f.now});
 /** A new user conversation: Core's binding, the accepted run/request, the 0017 admission, then control's issued facts. */
 async function newConversation(n,window){
  const binding={...f.binding,conversationId:id(n),runId:id(n+1),attemptId:id(n+2),workerId:id(n+3)},scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision}];
  const proposal=await initialInputFixture().proposal({context:{binding,scopes,versions:c.runtime.versions,selectedClientId}});
  const run={run:proposal.acceptance.run,request:{...proposal.acceptance.request,...(window===undefined?{}:{window})}};saved.set(key(binding),run);
  admissions.set(key(binding),{schemaVersion:1,state:'ADMITTED',binding,selectedClientId,policyRevision,versions:c.runtime.versions,configurationSha256:ports.configurationSha256,expiresAtMs:ports.proposeInitialExpiry(),createdAtMs:f.now});
  const issued=await ports.prepareInitial({binding}),facts=await ports.runIssuance.resolveFacts(issued.issuance);
  const mirror=await initializedMirror(binding);
  return {binding,facts,run,mirror,restoration:sdkOptionsRestoration(binding,mirror.session),options:runnerOptions({runtime:facts.runtime,preparationIntent:facts.preparationIntent,binding,request:run.request,scopes:run.run.scopes})};
 }
 /** The next turn of `first`'s conversation: writer fence +1 with a new run/attempt/worker (next-run.mjs select), the accepted run record,
  * control's facts for it (prepared-run-bindings.mjs facts.compile, the producer runIssuance binds), the next-turn lineage of turn 1's
  * completion checkpoint (next-run-journal.mjs execution), the restore receipt and session key control returns for it
  * (native-restorer.mjs response), the mirror the runner initializes with them, and the options the worker composes. */
 async function nextTurn(first,n,{resumeSessionAt=id(n+9)}={}){
  const binding={...first.binding,runId:id(n+1),attemptId:id(n+2),workerId:id(n+3),writerFence:first.binding.writerFence+1},scopes=first.run.run.scopes;
  const sourceRequest=first.run.request,request={...sourceRequest,requestId:id(n+4),prompt:'A second prompt in the same conversation.'};
  saved.set(key(binding),{run:{...first.run.run,binding,state:'queued'},request});
  const facts=await ports.facts.compile({intent:{issuanceKey:hash(binding),binding,requestSha256:hash(request),expiresAtMs:first.facts.runtime.deadlineMs},issuance:{grantId:id(n+5),capabilitySha256:'e'.repeat(64)}});
  const sessionId=id(n+10),workspace={contractVersion:'0.1.0',manifestId:id(n+6),binding:first.binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date(f.now).toISOString()};
  const checkpoint={contractVersion:'0.1.0',checkpointId:id(n+8),parentCheckpointId:null,binding:first.binding,sessionId,opaqueSession:{objectId:id(n+7),versionId:'synthetic-version',sha256:'d'.repeat(64),bytes:100,scopes},
   workspace,workspaceSha256:hash(workspace),versions:c.runtime.versions,lastEventSequence:3,scopes,createdAt:new Date(f.now).toISOString(),durableReceiptId:id(n+11)};
  const lineage={checkpoint,checkpointSha256:hash(checkpoint),sourceRequestSha256:hash(sourceRequest),contextSha256:continuationContextSha256(sourceRequest,scopes),sourceRequest,targetBinding:binding,resumeSessionAt};
  const restoreReceipt={verificationId:id(n+12),binding,checkpointId:checkpoint.checkpointId,checkpointSha256:lineage.checkpointSha256,workspaceSha256:checkpoint.workspaceSha256,opaqueSessionSha256:checkpoint.opaqueSession.sha256,scopes,contextSha256:lineage.contextSha256,sourceRequestSha256:lineage.sourceRequestSha256,checkedAtMs:f.now,expiresAtMs:f.now+60000};
  const sessionKey={projectKey:projectKeyOf(facts.preparationIntent.workspace),sessionId};
  const snapshot={binding,key:sessionKey,checkpointSha256:lineage.checkpointSha256,opaqueSessionSha256:checkpoint.opaqueSession.sha256,transcripts:[{entries:[{type:'user',uuid:id(n+13),message:{role:'user',content:'first turn'}}]}]};
  const mirror=await initializedMirror(binding,{sessionKey,nextTurn:lineage,snapshot});
  const options=runnerOptions({runtime:facts.runtime,preparationIntent:facts.preparationIntent,binding,request,scopes,continuation:{nextTurn:lineage,restoreReceipt,started:f.now,now:()=>f.now}});
  return {binding,facts,run:{run:{...first.run.run,binding},request},lineage,sessionKey,snapshot,mirror,restoration:sdkOptionsRestoration(binding,mirror.session),options};
 }
 return {f,c,ports,staticOptions,newConversation,nextTurn};
}

test('two dynamic first-chat runs (new conversations) and the static candidate pass the runner gate with one configured sdkOptionsSha256',()=>posix(async()=>{
 const x=await fixture(),configured=x.c.preparationIntent.sdkOptionsSha256;
 const a=await x.newConversation(400),b=await x.newConversation(500,{basis:'unbounded'});
 for(const run of [a,b]){
  // Control carries the static configured value unchanged; workspace and authority are this run's.
  assert.equal(run.facts.preparationIntent.sdkOptionsSha256,configured);assert.ok(run.facts.preparationIntent.workspace.endsWith('/'+run.binding.conversationId));
  assert.equal(run.facts.preparationIntent.authoritySha256,authorityDigest({scopes:[{kind:'client',tenantId:run.binding.tenantId,resourceId:x.c.identity.commandContext.clientResolution.clientId,policyRevision:x.c.qualification.policyRevision}],selectedClientId:x.c.identity.commandContext.clientResolution.clientId,policyRevision:x.c.qualification.policyRevision}));
  admitted(run.facts.preparationIntent,run.binding,run.options);
 }
 // The per-run values really differ between the runs; only the template is shared.
 assert.notEqual(a.options.cwd,b.options.cwd);assert.notEqual(a.options.env.CLAUDE_CONFIG_DIR,b.options.env.CLAUDE_CONFIG_DIR);assert.notEqual(a.options.systemPrompt,b.options.systemPrompt);
 assert.deepEqual(projectSdkOptionsTemplate(a.options,sdkOptionsRun(compileNativePreparationIntent(a.facts.preparationIntent),a.binding)),projectSdkOptionsTemplate(b.options,sdkOptionsRun(compileNativePreparationIntent(b.facts.preparationIntent),b.binding)));
 // The static candidate run keeps working with the same configuration.
 admitted(x.c.preparationIntent,x.f.binding,x.staticOptions);
 // A run's options are not admitted under another run's intent/binding (workspace, config dir and scopes are per-run facts).
 refused(b.facts.preparationIntent,b.binding,a.options,'run A options under run B');
 refused(a.facts.preparationIntent,{...a.binding,runId:id(499)},a.options,'another runId: CLAUDE_CONFIG_DIR differs');
}));

test('any option control did not sanction is refused: tools, permissions, model, maxTurns, budget, env, MCP servers, settings, prompt template, scopes, skill',()=>posix(async()=>{
 const x=await fixture(),run=await x.newConversation(600),{preparationIntent}=run.facts,{binding}=run,base=run.options;
 admitted(preparationIntent,binding,base);
 const changed=edit=>{const o={...base,env:{...base.env},settings:{...base.settings}};edit(o);return o;};
 const prompt=base.systemPrompt,at=prompt.lastIndexOf(REQUEST_CONTEXT_MARKER),context=JSON.parse(prompt.slice(at+REQUEST_CONTEXT_MARKER.length));
 const cases={
  tools:o=>{o.tools=['Bash'];},allowedTools:o=>{o.allowedTools=['Read'];},permissionMode:o=>{o.permissionMode='bypassPermissions';},
  model:o=>{o.model='another-model';},maxTurns:o=>{o.maxTurns=base.maxTurns+1;},maxBudgetUsd:o=>{o.maxBudgetUsd=base.maxBudgetUsd*2;},
  envAdded:o=>{o.env.ANTHROPIC_CUSTOM_HEADERS='x: y';},envProxy:o=>{o.env.ANTHROPIC_BASE_URL='https://elsewhere.invalid/';},envSecureStorage:o=>{o.env.CLAUDE_SECURESTORAGE_CONFIG_DIR='/tmp/other-secure';},
  envMaxOutput:o=>{o.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS='65536';},mcpServers:o=>{o.mcpServers={meri_original_reads:createSdkMcpServer({name:'meri_original_reads',version:'1.0.0',tools:[]})};},
  settings:o=>{o.settings.autoMemoryEnabled=true;},settingSources:o=>{o.settingSources=['user'];},skills:o=>{o.skills=['anything'];},resume:o=>{o.resume=id(777);},
  promptTemplate:o=>{o.systemPrompt='You are someone else.'+prompt.slice(at);},promptMissingContext:o=>{o.systemPrompt=prompt.slice(0,at);},
  promptExtraContext:o=>{o.systemPrompt=prompt.slice(0,at)+REQUEST_CONTEXT_MARKER+JSON.stringify({...context,extra:true});},
  promptNonCanonicalContext:o=>{o.systemPrompt=prompt.slice(0,at)+REQUEST_CONTEXT_MARKER+JSON.stringify(context,null,1);},
  foreignScopes:o=>{o.systemPrompt=prompt.slice(0,at)+requestContextSuffix({...context,scopes:[{...context.scopes[0],resourceId:id(888)}]});},
  widenedScopes:o=>{o.systemPrompt=prompt.slice(0,at)+requestContextSuffix({...context,scopes:[...context.scopes,{kind:'client',tenantId:binding.tenantId,resourceId:id(889),policyRevision:context.scopes[0].policyRevision}]});},
  skill:o=>{o.systemPrompt=prompt.slice(0,at)+requestContextSuffix({...context,skill:{skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0'}});},
  cwd:o=>{o.cwd='/workspace/'+id(601);},configDir:o=>{o.env.CLAUDE_CONFIG_DIR='/tmp/sdk-config/sdk-'+id(602);},
 };
 for(const [name,edit] of Object.entries(cases))refused(preparationIntent,binding,changed(edit),name);
 // The request window is request data (like the prompt): another window is admitted; the pin never covers it.
 admitted(preparationIntent,binding,changed(o=>{o.systemPrompt=prompt.slice(0,at)+requestContextSuffix({...context,window:{basis:'unbounded'}});}));
}));

test('the pin is configuration: a missing, malformed or legacy pin refuses before any query',()=>{
 assert.throws(()=>createPreparedRunnerQuery({sdkOptionsSha256:'a'.repeat(64),processClientFactory:()=>({})}),/SDK_PREPARATION_CONFIGURATION/u,'legacy full-options hash key is not silently ignored');
 assert.throws(()=>createPreparedRunnerQuery({sdkOptions:{sdkOptionsSha256:'a'.repeat(64)},processClientFactory:()=>({})}),/SDK_PREPARATION_CONFIGURATION/u);
 assert.throws(()=>createPreparedRunnerQuery({sdkOptions:{sdkOptionsSha256:'x',run:{workspace:'/w',configDirectory:'/c',authoritySha256:'a'.repeat(64)}},processClientFactory:()=>({})}),/SDK_PREPARATION_CONFIGURATION/u);
 // A restoration source is part of the pin: never without one, never malformed, never a session without a restoration reader.
 const pin={sdkOptionsSha256:'a'.repeat(64),run:{workspace:'/w',configDirectory:'/c',authoritySha256:'a'.repeat(64)}},f=continuationFixture(),session={restoration:()=>({sessionKey:null})};
 assert.throws(()=>createPreparedRunnerQuery({restoration:sdkOptionsRestoration(f.target.binding,session),processClientFactory:()=>({})}),/SDK_PREPARATION_CONFIGURATION/u,'restoration without a pin');
 assert.throws(()=>createPreparedRunnerQuery({sdkOptions:pin,restoration:{binding:f.target.binding},processClientFactory:()=>({})}),/SDK_PREPARATION_CONFIGURATION/u,'restoration without a reader');
 assert.throws(()=>sdkOptionsRestoration(f.target.binding,{}),/SDK_PREPARATION_CONFIGURATION/u,'session without restoration');
 assert.throws(()=>sdkOptionsRestoration({...f.target.binding,writerFence:'1'},session),/SDK_PREPARATION_CONFIGURATION/u,'malformed binding');
 assert.equal(typeof createPreparedRunnerQuery({sdkOptions:pin,restoration:sdkOptionsRestoration(f.target.binding,session),processClientFactory:()=>({})}),'function');
});

test('first and second turns of one conversation, and of two conversations, pass the runner gate with one configured sdkOptionsSha256',()=>posix(async()=>{
 const x=await fixture(),configured=x.c.preparationIntent.sdkOptionsSha256;
 const a1=await x.newConversation(1000),a2=await x.nextTurn(a1,1100),b1=await x.newConversation(1200),b2=await x.nextTurn(b1,1300,{resumeSessionAt:null});
 for(const turn of [a1,a2,b1,b2]){
  assert.equal(turn.facts.preparationIntent.sdkOptionsSha256,configured,'control carries the one configured hash to every turn');
  admitted(turn.facts.preparationIntent,turn.binding,turn.options,turn.restoration);
 }
 // A first turn needs no restoration source (fresh); the remote worker without a mirror keeps admitting it.
 for(const turn of [a1,b1])admitted(turn.facts.preparationIntent,turn.binding,turn.options);
 // The second turns really resume turn 1's SDK session (composed by the worker's next-turn builder), at the checkpoint's message when set.
 assert.equal(a2.binding.writerFence,2);assert.equal(a2.binding.conversationId,a1.binding.conversationId);assert.equal(a2.facts.preparationIntent.workspace,a1.facts.preparationIntent.workspace);
 assert.equal(a2.options.resume,a2.lineage.checkpoint.sessionId);assert.equal(a2.options.resumeSessionAt,a2.lineage.resumeSessionAt);assert.equal('forkSession' in a2.options,false);assert.equal('sessionId' in a2.options,false);
 assert.equal(b2.options.resume,b2.lineage.checkpoint.sessionId);assert.equal('resumeSessionAt' in b2.options,false);
 // All four turns reduce to one template; the continuation fields are exactly the restoration's.
 const template=t=>{const i=compileNativePreparationIntent(t.facts.preparationIntent),run=sdkOptionsRun(i,t.binding);return projectSdkOptionsTemplate(t.options,run,sdkOptionsContinuation(t.mirror.session.restoration(),{binding:t.binding,workspace:run.workspace}));};
 for(const t of [a2,b1,b2])assert.deepEqual(template(t),template(a1));
 assert.deepEqual(sdkOptionsContinuation(a2.mirror.session.restoration(),{binding:a2.binding,workspace:a2.facts.preparationIntent.workspace}),{resume:a2.lineage.checkpoint.sessionId,resumeSessionAt:a2.lineage.resumeSessionAt});
 assert.equal(sdkOptionsContinuation(a1.mirror.session.restoration(),{binding:a1.binding,workspace:a1.facts.preparationIntent.workspace}),null);
}));

test('a second turn is refused unless its continuation fields are exactly the restoration: foreign session, mismatched resumeSessionAt, fresh run with resume fields, continuation without them',()=>posix(async()=>{
 const x=await fixture(),a1=await x.newConversation(2000),a2=await x.nextTurn(a1,2100),b1=await x.newConversation(2200),b2=await x.nextTurn(b1,2300);
 const intent=a2.facts.preparationIntent,{binding,restoration}=a2;admitted(intent,binding,a2.options,restoration);
 const edited=edit=>{const o={...a2.options,env:{...a2.options.env}};edit(o);return o;};
 const second={
  resumeOtherConversation:o=>{o.resume=b2.lineage.checkpoint.sessionId;},resumeOtherSession:o=>{o.resume=id(2399);},
  resumeSessionAtMismatch:o=>{o.resumeSessionAt=id(2398);},resumeSessionAtOtherConversation:o=>{o.resumeSessionAt=b2.lineage.resumeSessionAt;},resumeSessionAtDropped:o=>{delete o.resumeSessionAt;},
  missingAll:o=>{for(const k of SDK_CONTINUATION_FIELDS)delete o[k];},missingResume:o=>{delete o.resume;},
  forkAdded:o=>{o.forkSession=true;o.sessionId=id(2397);},sessionIdAdded:o=>{o.sessionId=a2.lineage.checkpoint.sessionId;},forkOnly:o=>{o.forkSession=true;},
  otherOption:o=>{o.model='another-model';},
 };
 for(const [name,edit] of Object.entries(second))refused(intent,binding,edited(edit),name,restoration);
 // The same second-turn options are refused without the run's restoration (a fresh run carries none), under another conversation's
 // restoration, and under turn 1's (fresh) restoration.
 refused(intent,binding,a2.options,'no restoration source');
 refused(intent,binding,a2.options,'another conversation restoration',sdkOptionsRestoration(binding,b2.mirror.session));
 refused(intent,binding,a2.options,'fresh restoration',sdkOptionsRestoration(binding,a1.mirror.session));
 // Turn 2's options and restoration are bound to turn 2's run: not admitted for another conversation's turn 2.
 refused(b2.facts.preparationIntent,b2.binding,a2.options,'turn A2 options under turn B2',b2.restoration);
 refused(b2.facts.preparationIntent,b2.binding,b2.options,'turn B2 options with turn A2 mirror',sdkOptionsRestoration(b2.binding,a2.mirror.session));
 // A fresh run carrying any continuation field is refused, with or without its (fresh) restoration.
 const fresh={resume:o=>{o.resume=a2.lineage.checkpoint.sessionId;},resumeSessionAt:o=>{o.resumeSessionAt=id(2396);},forkSession:o=>{o.forkSession=true;},sessionId:o=>{o.sessionId=id(2395);},all:o=>{Object.assign(o,{resume:a2.lineage.checkpoint.sessionId,resumeSessionAt:a2.lineage.resumeSessionAt});}};
 for(const [name,edit] of Object.entries(fresh)){const o={...a1.options};edit(o);refused(a1.facts.preparationIntent,a1.binding,o,'fresh '+name,a1.restoration);refused(a1.facts.preparationIntent,a1.binding,o,'fresh without source '+name);}
 // A mirror that never initialized, or failed initializing, is no restoration: the gate refuses.
 const idle=createCheckpointSessionFactory({binding,client:{async load(){},async listSubkeys(){}},factory:async()=>assert.fail('not reached')});
 refused(intent,binding,a2.options,'uninitialized mirror',sdkOptionsRestoration(binding,idle.session));
 const broken=createCheckpointSessionFactory({binding,client:{async load(){},async listSubkeys(){}},factory:async()=>{throw Error('synthetic-restore-failure');}});
 await assert.rejects(broken.factory({binding,sessionKey:a2.sessionKey,nextTurn:a2.lineage}));
 refused(intent,binding,a2.options,'failed mirror',sdkOptionsRestoration(binding,broken.session));
}));

test('the restoration is re-verified against this run: lineage target, writer fence, checkpoint digest, session key and workspace',()=>posix(async()=>{
 const x=await fixture(),a1=await x.newConversation(3000),a2=await x.nextTurn(a1,3100),b1=await x.newConversation(3200),b2=await x.nextTurn(b1,3300);
 const workspace=a2.facts.preparationIntent.workspace,raw={sessionKey:a2.sessionKey,nextTurn:a2.lineage},check=(value,binding=a2.binding,w=workspace)=>sdkOptionsContinuation(value,{binding,workspace:w});
 assert.deepEqual(check(raw),{resume:a2.lineage.checkpoint.sessionId,resumeSessionAt:a2.lineage.resumeSessionAt});
 const bad={
  otherTarget:[raw,b2.binding],staleFence:[raw,{...a2.binding,writerFence:3}],sameRunAsSource:[raw,{...a2.binding,runId:a1.binding.runId}],otherWorkspace:[raw,a2.binding,b2.facts.preparationIntent.workspace],
  keyOtherSession:[{...raw,sessionKey:{...a2.sessionKey,sessionId:b2.sessionKey.sessionId}}],keyOtherProject:[{...raw,sessionKey:b2.sessionKey}],keyMissing:[{nextTurn:a2.lineage}],keySubpath:[{...raw,sessionKey:{...a2.sessionKey,subpath:'subagents/x'}}],
  checkpointTampered:[{...raw,nextTurn:{...a2.lineage,checkpoint:{...a2.lineage.checkpoint,sessionId:id(3399)}}}],otherLineage:[{...raw,nextTurn:b2.lineage}],
  bothLineages:[{...raw,continuation:continuationFixture().continuation}],extraKey:[{...raw,restoreReceipt:{}}],nullLineage:[{sessionKey:a2.sessionKey,nextTurn:null}],
 };
 for(const [name,[value,binding,w]] of Object.entries(bad))assert.throws(()=>check(value,binding,w),/SDK_OPTIONS_REFUSED/u,name);
 // A fresh restoration (no lineage) admits no continuation field, whatever its session key.
 assert.equal(check({sessionKey:null}),null);assert.equal(check({sessionKey:a2.sessionKey}),null);
}));

for(const mode of ['resume','fork'])test(`lifecycle ${mode}: the gate expects exactly the worker's continuation options for the envelope and its target`,()=>posix(async()=>{
 const f=continuationFixture(mode),workspace='/workspace/'+f.target.binding.conversationId,targetSessionId=mode==='fork'?f.continuation.targetSessionId:f.continuation.checkpoint.sessionId;
 const raw={sessionKey:{projectKey:projectKeyOf(workspace),sessionId:targetSessionId},continuation:f.continuation},expected=buildContinuationOptions(f.continuation,f.target);
 assert.deepEqual(sdkOptionsContinuation(raw,{binding:f.target.binding,workspace}),{...expected});
 if(mode==='fork')assert.deepEqual(Object.keys(expected).sort(),['forkSession','resume','resumeSessionAt','sessionId']);
 // The template removes exactly that set from options carrying it, and the result equals the same options without it.
 const run={workspace,configDirectory:'/sdk-config/sdk-'+f.target.binding.runId,authoritySha256:authorityDigest({scopes:f.target.scopes,selectedClientId:f.target.scopes[0].resourceId,policyRevision:f.target.scopes[0].policyRevision})};
 const base={cwd:workspace,model:'m',systemPrompt:'t'+requestContextSuffix({window:null,scopes:f.target.scopes,skill:null}),env:{CLAUDE_CONFIG_DIR:run.configDirectory}};
 assert.deepEqual(projectSdkOptionsTemplate({...base,...expected},run,sdkOptionsContinuation(raw,{binding:f.target.binding,workspace})),projectSdkOptionsTemplate(base,run));
 assert.throws(()=>projectSdkOptionsTemplate(base,run,sdkOptionsContinuation(raw,{binding:f.target.binding,workspace})),/SDK_OPTIONS_REFUSED/u,'continuation options missing');
 assert.throws(()=>projectSdkOptionsTemplate({...base,...expected},run),/SDK_OPTIONS_REFUSED/u,'fresh template refuses them');
 // The envelope's other target constraints hold: a resume into another conversation, a fork into the same one, a sessionKey of the wrong session.
 const other={...f.target.binding,conversationId:mode==='resume'?id(901):f.continuation.checkpoint.binding.conversationId};
 assert.throws(()=>sdkOptionsContinuation(raw,{binding:other,workspace}),/SDK_OPTIONS_REFUSED/u);
 assert.throws(()=>sdkOptionsContinuation({...raw,sessionKey:{...raw.sessionKey,sessionId:mode==='fork'?f.continuation.checkpoint.sessionId:id(902)}},{binding:f.target.binding,workspace}),/SDK_OPTIONS_REFUSED/u);
}));
