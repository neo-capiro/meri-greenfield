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
import {id} from '../../control/conversations/test/store-fixture.mjs';
import {compileNativePreparationIntent} from '../native-authority/preparation-intent.mjs';
import {createPreparedRunnerQuery} from '../native-authority/runner-query.mjs';
import {sdkOptionsPin,sdkOptionsRun,projectSdkOptionsTemplate,authorityDigest,REQUEST_CONTEXT_MARKER,sdkOptionsRestoration,sdkOptionsContinuation,SDK_CONTINUATION_FIELDS} from '../native-authority/sdk-option-template.mjs';
import {buildContinuationOptions} from '../../worker/conversation/continuation/options.mjs';
import {continuationFixture} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {createCheckpointSessionFactory} from '../checkpoint-session-factory.mjs';
import {requestContextSuffix} from '../../worker/conversation/request-context.mjs';
import {createSdkMcpServer} from '../../worker/conversation/agent-sdk.mjs';
import {posix,fixture,projectKeyOf} from './next-turn-fixture.mjs';

/** The remote worker's gate (remote-composition.mjs createRemoteNativeWorker): the pin from the intent and original binding, and the
 * restoration source over the task's checkpoint session mirror when one is passed. */
const gate=(intent,binding,restoration)=>createPreparedRunnerQuery({sdkOptions:sdkOptionsPin(compileNativePreparationIntent(intent),binding),...(restoration===undefined?{}:{restoration}),processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
const admitted=(intent,binding,options,restoration)=>{const stream=gate(intent,binding,restoration)({prompt:'p',options});assert.equal(typeof stream[Symbol.asyncIterator],'function');};
const refused=(intent,binding,options,label,restoration)=>assert.throws(()=>gate(intent,binding,restoration)({prompt:'p',options}),/SDK_OPTIONS_REFUSED/u,label);

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
  envPromptCaching:o=>{o.env.DISABLE_PROMPT_CACHING='0';},envEffort:o=>{o.env.CLAUDE_CODE_EFFORT_LEVEL='high';},
  modelOverride:o=>{o.settings.modelOverrides={'claude-sonnet-4-6':'another-model'};},modelOverrideDropped:o=>{delete o.settings.modelOverrides;},
  thinking:o=>{o.thinking={type:'adaptive'};},thinkingDropped:o=>{delete o.thinking;},
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
