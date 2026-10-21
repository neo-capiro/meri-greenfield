/** Shared fixture for the runner's SDK options of dynamic first-chat runs and their next turns (dynamic-sdk-options.test.mjs,
 * next-turn-prepare.test.mjs): one configuration whose sdkOptionsSha256 is the template of its static candidate run, control's issued
 * facts per run (prepared-run-bindings.mjs), the runner's composed options (conversation-runner.mjs prepareRuntime + activity.mjs) and
 * the task's checkpoint session mirror, initialized for a next turn over the real continuation SDK session. Paths run with POSIX
 * semantics on every host (posix); module resolution inside a POSIX body uses the host's (hostPaths). */
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
import {sdkOptionsRun,sdkOptionsTemplateSha256,sdkOptionsRestoration} from '../native-authority/sdk-option-template.mjs';
import {buildConversationOptions} from '../../worker/conversation/options.mjs';
import {continuationContextSha256} from '../../worker/conversation/continuation/options.mjs';
import {createCheckpointSessionFactory} from '../checkpoint-session-factory.mjs';
import {createContinuationRuntimeSdkSession} from '../sdk-continuation-session.mjs';
import {requestContextSuffix} from '../../worker/conversation/request-context.mjs';

export async function posix(fn){
 if(nodePath===nodePath.posix)return fn();
 const saved={};for(const [k,v] of Object.entries(nodePath.posix))if(typeof v==='function'){saved[k]=nodePath[k];nodePath[k]=v;}
 syncBuiltinESMExports();try{return await fn();}finally{Object.assign(nodePath,saved);syncBuiltinESMExports();}
}
const hostPath=Object.fromEntries(Object.entries(nodePath).filter(([,v])=>typeof v==='function'));
/** Host path semantics for module resolution inside a POSIX test body (checkpoint-snapshot.mjs imports its verifier lazily). */
export async function hostPaths(fn){
 if(nodePath===nodePath.posix)return fn();
 const current=Object.fromEntries(Object.keys(hostPath).map(k=>[k,nodePath[k]]));Object.assign(nodePath,hostPath);syncBuiltinESMExports();
 try{return await fn();}finally{Object.assign(nodePath,current);syncBuiltinESMExports();}
}
const sessionStore=()=>({async load(){},async append(){},async listSubkeys(){}});
/** The runner's composition of one run's options (conversation-runner.mjs prepareRuntime + activity.mjs, first chat: no skill or policy).
 * A later turn adds the runtime's restore receipt and the activity's continuation context (activity.mjs: lineage, request, sourceRequest,
 * scopes, started, now), so buildConversationOptions composes the resume fields through buildNextTurnOptions. */
export function runnerOptions({runtime,preparationIntent,binding,request,scopes,continuation}){
 const {sdkSessionKey:_,...r}=runtime,configuration={binding,workspace:preparationIntent.workspace,remoteTask:{preparationIntent}};
 const options=buildConversationOptions({...r,cwd:configuration.workspace,sessionStore:sessionStore(),...(continuation?{restoreReceipt:continuation.restoreReceipt}:{}),...sdkConfigurationDirectories(configuration,{})},new AbortController(),
  continuation?{nextTurn:continuation.nextTurn,request,sourceRequest:continuation.nextTurn.sourceRequest,scopes,started:continuation.started,now:continuation.now}:undefined);
 options.systemPrompt+=requestContextSuffix({window:request?.window,scopes,skill:request?.skill});
 return options;
}
export const projectKeyOf=workspace=>workspace.replace(/[^a-zA-Z0-9]/gu,'-');
/** The task's checkpoint session mirror (remote-conversation-runner.mjs) initialized as conversation-runner prepareRuntime does: a fresh
 * run with control's null session key; a later turn with control's restored session key and the lineage over the real continuation SDK
 * session, which verifies control's immutable snapshot readback before the mirror records anything. */
/** control's session owner as the SDK sees it through the task's session client, in memory: the continuation session registers the
 * target, seeds turn 1's history by append and the SDK loads it back to resume (sdk-continuation-session.mjs, session-client.mjs). */
function memorySessionClient(snapshot){
 const streams=new Map(),name=key=>key.subpath??'';
 return {async snapshot(){return structuredClone(snapshot);},async register(){return {registered:true};},
  async append(batch){const entries=streams.get(name(batch.key))??[];if(batch.expectedOffset!==entries.length)throw Error('SESSION_OFFSET_CONFLICT');entries.push(...structuredClone(batch.entries));streams.set(name(batch.key),entries);return {offset:entries.length};},
  async load({key}){const entries=streams.get(name(key))??[];return {entries:structuredClone(entries),offset:entries.length};},
  async listSubkeys(){return {subkeys:[...streams.keys()].filter(Boolean).sort()};}};
}
export async function initializedMirror(binding,{sessionKey=null,nextTurn,snapshot,memory=false}={}){
 const plain=async()=>({store:{async load(){return null;},async append(){},async listSubkeys(){return [];}},async settle(){},async close(){}});
 const client=memory?memorySessionClient(snapshot):{async snapshot(){return structuredClone(snapshot);},async register(){assert.fail('not reached');},async load(){assert.fail('not reached');},async append(){assert.fail('not reached');},async listSubkeys(){assert.fail('not reached');}};
 const mirror=createCheckpointSessionFactory({binding,client:{async load(){},async listSubkeys(){}},factory:nextTurn===undefined?plain:value=>createContinuationRuntimeSdkSession({...{timeoutMs:15000,},client,binding:value.binding,sessionKey:value.sessionKey,nextTurn:value.nextTurn})});
 const prepared=await hostPaths(()=>mirror.factory({binding,sessionKey,...(nextTurn===undefined?{}:{nextTurn})}));
 return Object.freeze({...mirror,prepared});
}

/** One configuration whose sdkOptionsSha256 is the template of its static candidate run, and dynamic initial runs issued by control. */
/** `measureLaunch(staticOptions)`, when given, returns the launch values ({launchTemplate, executableSha256}) the configuration carries,
 * measured from the static candidate run's options as the in-image measurement does (apps/runtime/build/first-chat-launch-measurement.mjs). */
export async function fixture({measureLaunch}={}){
 const f=candidateFixture(),c=f.configuration.nativeCandidate,selectedClientId=c.identity.commandContext.clientResolution.clientId,policyRevision=c.qualification.policyRevision;
 c.multiRun={runWindowMs:60000,materialDirectory:'/synthetic-meri-material',dynamicInitialRuns:true};
 // The configured value: the run-invariant template of the static candidate run (as the in-image measurement computes it).
 const staticScopes=[{kind:'client',tenantId:f.binding.tenantId,resourceId:selectedClientId,policyRevision}];
 const staticOptions=runnerOptions({runtime:{...c.runtime,proxyCredential:'synthetic-static-proxy'},preparationIntent:{...c.preparationIntent,sdkOptionsSha256:'0'.repeat(64)},binding:f.binding,request:{window:null,skill:null},scopes:staticScopes});
 c.preparationIntent.sdkOptionsSha256=sdkOptionsTemplateSha256(staticOptions,sdkOptionsRun(c.preparationIntent,f.binding));
 if(measureLaunch)Object.assign(c.preparationIntent,await measureLaunch(staticOptions));
 const admissions=new Map(),saved=new Map(),key=b=>hash(b);
 const initialBindings={async read({binding},check){check();return structuredClone(admissions.get(key(binding))??null);},async readConversation(){return null;}};
 const store={async readOptional(binding){return structuredClone(saved.get(key(binding))??null);},async read(binding){return structuredClone(saved.get(key(binding)));},allocations:{async read(){return {record:null};}}};
 const capabilityAuthority={async generate({issuanceKey}){return {grantId:id(900),capability:'synthetic-dynamic-task-'+issuanceKey.slice(0,8),materialRef:'ref-'+issuanceKey.slice(0,8)};},async retrieve({materialRef}){return {state:'PRESENT',capability:'synthetic-dynamic-task-'+materialRef.slice(4)};},async status(){return {state:'ABSENT'};}};
 const modelGrants={async issue({intent}){const proxyCredential='synthetic-dynamic-model-'+intent.issuanceKey.slice(0,16);return {...intent,grantId:id(901),capabilitySha256:capabilityDigest(proxyCredential),proxyCredential};}};
 const ports=createPreparedRunBindings({limits:{maxRequestMs:3000,maxFactBytes:131072},configuration:f.configuration,pool:{connect(){assert.fail('No database');}},store,credentials:{control:f.secret.control},issuanceStore:createMemoryIssuanceStore(),capabilityAuthority,modelGrants,initialBindings,now:()=>f.now});
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
 async function nextTurn(first,n,{resumeSessionAt=id(n+9),memory=false}={}){
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
  const mirror=await initializedMirror(binding,{sessionKey,nextTurn:lineage,snapshot,memory});
  const options=runnerOptions({runtime:facts.runtime,preparationIntent:facts.preparationIntent,binding,request,scopes,continuation:{nextTurn:lineage,restoreReceipt,started:f.now,now:()=>f.now}});
  return {binding,facts,run:{run:{...first.run.run,binding},request},lineage,sessionKey,snapshot,mirror,restoration:sdkOptionsRestoration(binding,mirror.session),options};
 }
 return {f,c,ports,staticOptions,newConversation,nextTurn};
}
