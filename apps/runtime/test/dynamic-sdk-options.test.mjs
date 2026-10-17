/** The runner's SDK options pin for dynamic first-chat runs: control issues each new conversation's preparation intent through the
 * real multi-run bindings (prepareInitial -> runIssuance facts), the runner composes that run's options exactly as the remote path
 * does (conversation-runner sdkConfigurationDirectories, worker buildConversationOptions, request-context suffix), and runner-query's
 * gate admits every run with the ONE configured sdkOptionsSha256 while refusing any option control did not sanction. Paths run with
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
import {sdkOptionsPin,sdkOptionsRun,sdkOptionsTemplateSha256,projectSdkOptionsTemplate,authorityDigest,REQUEST_CONTEXT_MARKER} from '../native-authority/sdk-option-template.mjs';
import {buildConversationOptions} from '../../worker/conversation/options.mjs';
import {requestContextSuffix} from '../../worker/conversation/request-context.mjs';
import {createSdkMcpServer} from '../../worker/conversation/agent-sdk.mjs';

async function posix(fn){
 if(nodePath===nodePath.posix)return fn();
 const saved={};for(const [k,v] of Object.entries(nodePath.posix))if(typeof v==='function'){saved[k]=nodePath[k];nodePath[k]=v;}
 syncBuiltinESMExports();try{return await fn();}finally{Object.assign(nodePath,saved);syncBuiltinESMExports();}
}
const sessionStore=()=>({async load(){},async append(){},async listSubkeys(){}});
/** The runner's composition of one run's options (conversation-runner.mjs prepareRuntime + activity.mjs, first chat: no skill or policy). */
function runnerOptions({runtime,preparationIntent,binding,request,scopes}){
 const {sdkSessionKey:_,...r}=runtime,configuration={binding,workspace:preparationIntent.workspace,remoteTask:{preparationIntent}};
 const options=buildConversationOptions({...r,cwd:configuration.workspace,sessionStore:sessionStore(),...sdkConfigurationDirectories(configuration,{})},new AbortController());
 options.systemPrompt+=requestContextSuffix({window:request?.window,scopes,skill:request?.skill});
 return options;
}
const gate=(intent,binding)=>createPreparedRunnerQuery({sdkOptions:sdkOptionsPin(compileNativePreparationIntent(intent),binding),processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
const admitted=(intent,binding,options)=>{const stream=gate(intent,binding)({prompt:'p',options});assert.equal(typeof stream[Symbol.asyncIterator],'function');};
const refused=(intent,binding,options,label)=>assert.throws(()=>gate(intent,binding)({prompt:'p',options}),/SDK_OPTIONS_REFUSED/u,label);

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
  return {binding,facts,options:runnerOptions({runtime:facts.runtime,preparationIntent:facts.preparationIntent,binding,request:run.request,scopes:run.run.scopes})};
 }
 return {f,c,ports,staticOptions,newConversation};
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
});
