/** Fixed runtime mounts over borrowed compiled owners; selectors never install authority. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createRuntimeArtifactApplication} from './artifacts/application.mjs';
import {createDownloadLinkGate} from './artifacts/download-gate.mjs';
import {createSelectedTaskApplication} from './selected/http.mjs';
import {createNativeSdkSessionApplication} from './sdk-session-http.mjs';
import {createNativeFileOwner} from './artifacts/native-files-owner.mjs';
import {createNativeFileApplication,NATIVE_FILE_PATHS} from './artifacts/native-files-http.mjs';
import {fault} from './config.mjs';
import {types} from 'node:util';
import {createConversationHistoryService} from '../control/conversations/history/service.mjs';
import {createConversationHistoryApplication} from '../control/conversations/history/http.mjs';
import {createConversationSourceApplication} from '../control/conversations/sources/http.mjs';
import {BILL_TEXT_SOURCE_PATH} from '../../packages/contracts/conversation-sources/protocol.mjs';
import {createConversationUsageApplication} from '../control/conversations/usage-read/http.mjs';
import {createUsageOverviewApplication} from '../control/conversations/usage-overview/http.mjs';
import {USAGE_OVERVIEW_PATH} from '../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {createRunIndexApplication} from '../control/conversations/runs/http.mjs';
import {RUN_INDEX_PATHS} from '../../packages/contracts/conversation-history/run-protocol.mjs';
import {CONVERSATION_USAGE_PATH} from '../../packages/contracts/conversation-usage/protocol.mjs';
import {HISTORY_PATHS} from '../control/conversations/history/protocol.mjs';
import {runtimeArtifactRecovery} from './artifacts/composition.mjs';
import {USER_PREFERENCES_PATHS,userPreferencesUnavailable} from '../control/settings/user-application/protocol.mjs';
import {ROUTINE_PATHS,routinesUnavailable} from '../control/schedules/application-http.mjs';
import {ROUTINE_MANAGEMENT_SESSION_PATH} from '../../packages/contracts/schedules-0.2/application-protocol.mjs';
import {INTENT_PATHS} from '../control/intents/http.mjs';
import {TENANT_SETTINGS_PATHS} from '../control/settings/tenant-application/protocol.mjs';
import {MEMORY_PATHS,memoryUnavailable} from '../control/memory/protocol.mjs';
// Provenance is process-private. Caller-authored configuredOwners fields remain unknown keys and never establish readiness.
const capturedPorts=new WeakSet();
const capturedArtifactRecovery=new WeakMap();
export function readRuntimeArtifactRecovery(ports){if(!capturedPorts.has(ports))throw fault('PRODUCT_PORTS_CONFIGURATION');return capturedArtifactRecovery.get(ports.artifactStore)??null;}
export function captureRuntimePorts(value={}){
 if(capturedPorts.has(value))return value;
 const c=own(value,[],['executionOwner','objectiveSelection','identityContext','transitionAuthority','continuationAdmission','approvals','actionApplication','actionApplicationFactory','taskCommandApplication','taskCommandApplicationFactory','routinesApplicationFactory','uploadApplicationFactory','conversationMembership','conversationCurrentness','conversationManagement','conversationSourceReader','conversationTurns','artifactOptionsOwner','selectedController','sdkSessionOwner','sdkSessionSnapshot','selectedSkillAdmission','selectedOutputPublication','artifactStore','retentionLedgerSink','retentionStorage','intentApplication','settingsApplication','memoryApplication']);
 if(c.taskCommandApplication!==undefined&&c.taskCommandApplicationFactory!==undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
 if(c.actionApplication!==undefined&&c.actionApplicationFactory!==undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
 const methods=(port,names)=>Object.freeze(Object.fromEntries(names.map(name=>[name,storageMethod(port,name)])));
 const optionalMethod=(port,name)=>{let cursor=port;for(let depth=0;cursor!==null&&depth<32;depth++){if(types.isProxy(cursor))throw fault('PRODUCT_PORTS_CONFIGURATION');if(Object.getOwnPropertyDescriptor(cursor,name))return storageMethod(port,name);cursor=Object.getPrototypeOf(cursor);}if(cursor!==null)throw fault('PRODUCT_PORTS_CONFIGURATION');};
 const identity=c.identityContext===undefined?Object.freeze({verifyIdentity:async()=>{throw fault('NATIVE_AUTHORITY_UNAVAILABLE');},resolveContext:async()=>{throw fault('NATIVE_AUTHORITY_UNAVAILABLE');}}):methods(c.identityContext,['verifyIdentity','resolveContext']);
 const transitionResolver=c.identityContext===undefined?undefined:optionalMethod(c.identityContext,'resolveTransitionContext'),transitionContext=transitionResolver===undefined?{}:{resolveTransitionContext:transitionResolver};
 const authorityScope=c.identityContext===undefined?undefined:optionalMethod(c.identityContext,'withAuthority');
 const artifactStore=c.artifactStore===undefined?undefined:Object.freeze({...methods(c.artifactStore,['verifyPrivate']),...(c.artifactStore.objects===undefined?{}:{objects:methods(c.artifactStore.objects,['put','get'])})});
 const routineFactory=c.routinesApplicationFactory===undefined?undefined:methods(c.routinesApplicationFactory,['create','state']);
 const routineHistory=c.routinesApplicationFactory===undefined?undefined:optionalMethod(c.routinesApplicationFactory,'historyCurrentness'),routineInboxState=c.routinesApplicationFactory===undefined?undefined:optionalMethod(c.routinesApplicationFactory,'inboxState');
 const routineManagement=c.routinesApplicationFactory===undefined?undefined:optionalMethod(c.routinesApplicationFactory,'managementSessionConfiguration');
 if(artifactStore){const recovery=runtimeArtifactRecovery(c.artifactStore)??capturedArtifactRecovery.get(c.artifactStore);if(recovery)capturedArtifactRecovery.set(artifactStore,recovery);}
 const captured=Object.freeze({
  configuredOwners:Object.freeze(Object.keys(c).filter(k=>c[k]!==undefined)),
  ...(c.executionOwner===undefined?{}:{executionOwner:methods(c.executionOwner,['authenticate'])}),
  identityContext:Object.freeze({...identity,...transitionContext,...(authorityScope?{withAuthority:authorityScope}:{})}),
  ...(c.transitionAuthority===undefined?{}:{transitionAuthority:methods(c.transitionAuthority,['readCurrent'])}),
  ...(c.continuationAdmission===undefined?{}:{continuationAdmission:methods(c.continuationAdmission,['admit','retire'])}),
  ...(c.approvals===undefined?{}:{approvals:methods(c.approvals,['read','readDecision'])}),
  ...(c.actionApplication===undefined?{}:{actionApplication:methods(c.actionApplication,['handle'])}),
  ...(c.actionApplicationFactory===undefined?{}:{actionApplicationFactory:methods(c.actionApplicationFactory,['create','state'])}),
  ...(c.taskCommandApplication===undefined?{}:{taskCommandApplication:methods(c.taskCommandApplication,['handle'])}),
  ...(c.taskCommandApplicationFactory===undefined?{}:{taskCommandApplicationFactory:methods(c.taskCommandApplicationFactory,['create','state'])}),
  ...(c.uploadApplicationFactory===undefined?{}:{uploadApplicationFactory:methods(c.uploadApplicationFactory,['create','state'])}),
  ...(routineFactory===undefined?{}:{routinesApplicationFactory:Object.freeze({...routineFactory,...(routineHistory===undefined?{}:{historyCurrentness:routineHistory}),...(routineInboxState===undefined?{}:{inboxState:routineInboxState}),...(routineManagement===undefined?{}:{managementSessionConfiguration:routineManagement})})}),
  ...(c.conversationMembership===undefined?{}:{conversationMembership:methods(c.conversationMembership,['admit','recheck'])}),
  ...(c.conversationCurrentness===undefined?{}:{conversationCurrentness:methods(c.conversationCurrentness,['assertCurrent'])}),
  ...(c.conversationManagement===undefined?{}:{conversationManagement:methods(c.conversationManagement,['forRequest','assertActiveBinding'])}),
  ...(c.conversationSourceReader===undefined?{}:{conversationSourceReader:methods(c.conversationSourceReader,['forRequest'])}),
  ...(c.conversationTurns===undefined?{}:{conversationTurns:methods(c.conversationTurns,['admitTurn'])}),
  ...(c.artifactOptionsOwner===undefined?{}:{artifactOptionsOwner:methods(c.artifactOptionsOwner,['resolve'])}),
  ...(c.selectedController===undefined?{}:{selectedController:methods(c.selectedController,['handle'])}),
  ...(c.sdkSessionOwner===undefined?{}:{sdkSessionOwner:methods(c.sdkSessionOwner,['register','load','append','listSubkeys'])}),
  ...(c.objectiveSelection===undefined?{}:{objectiveSelection:methods(c.objectiveSelection,['read'])}),
  ...(c.sdkSessionSnapshot===undefined?{}:{sdkSessionSnapshot:Object.freeze({...methods(c.sdkSessionSnapshot,['readSnapshot']),...(optionalMethod(c.sdkSessionSnapshot,'readFiles')?{readFiles:storageMethod(c.sdkSessionSnapshot,'readFiles')}:{})})}),
  ...(c.selectedSkillAdmission===undefined?{}:{selectedSkillAdmission:methods(c.selectedSkillAdmission,['admitSelection'])}),
  ...(c.selectedOutputPublication===undefined?{}:{selectedOutputPublication:methods(c.selectedOutputPublication,['prepareEvent'])}),
  // The private artifact store's read-only privacy proof (createRuntimeArtifactStorage().verifyPrivate); required to open download links.
  ...(artifactStore===undefined?{}:{artifactStore}),
  // The authoritative retention ledger sink (the shipping owner's write-once store); without it declared retention serving stays fenced.
  ...(c.retentionLedgerSink===undefined?{}:{retentionLedgerSink:Object.freeze({...methods(c.retentionLedgerSink,['append','read']),...(optionalMethod(c.retentionLedgerSink,'head')?{head:storageMethod(c.retentionLedgerSink,'head')}:{})})}),
  ...(c.retentionStorage===undefined?{}:{retentionStorage:Object.freeze(methods(c.retentionStorage,['headVersion','deleteVersion','holdsFor','keyFor']))}),
  // Conversation write-intent approvals (lane 3) and tenant settings (lane 5): one public application each, composed by the family.
  ...(c.intentApplication===undefined?{}:{intentApplication:methods(c.intentApplication,['handle'])}),
  ...(c.settingsApplication===undefined?{}:{settingsApplication:methods(c.settingsApplication,['handle'])}),
  ...(c.memoryApplication===undefined?{}:{memoryApplication:methods(c.memoryApplication,['handle'])}),
 });
 capturedPorts.add(captured);return captured;
}
/** Join canonical prepared owners and trusted supplemental owners; neither can silently replace the other. */
export function composeRuntimePorts(canonical,supplemental){
 const a=captureRuntimePorts(canonical),b=captureRuntimePorts(supplemental),joined={};
 for(const ports of [a,b])for(const name of ports.configuredOwners){if(Object.hasOwn(joined,name))throw fault('PRODUCT_PORTS_CONFIGURATION');joined[name]=ports[name];}
 return captureRuntimePorts(joined);
}
/** `suppression` is the retention serving `{journal,serving}` pair when declared; the download-link gate needs it to revoke links. */
export function createRuntimeProductApplications({configuration,sessions,ports,now,retention,suppression,managementSuppression,conversationStore,userPreferences}){
 const uploads=configuration.sourceEnabled===true?ports.uploadApplicationFactory?.create({sessions,retention}):null;
 if(types.isPromise(uploads)){Promise.prototype.then.call(uploads,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const handleUploads=uploads==null?null:storageMethod(uploads,'handle');
 const taskApplication=configuration.sourceEnabled===true?(ports.taskCommandApplication??ports.taskCommandApplicationFactory?.create({sessions,conversationStore,retention})):null;
 if(types.isPromise(taskApplication)){Promise.prototype.then.call(taskApplication,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const handleTask=taskApplication==null?null:storageMethod(taskApplication,'handle');
 const actionApplication=configuration.sourceEnabled===true?(ports.actionApplication??ports.actionApplicationFactory?.create({sessions,conversationStore,retention})):null;
 if(types.isPromise(actionApplication)){Promise.prototype.then.call(actionApplication,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
 const handleAction=actionApplication==null?null:storageMethod(actionApplication,'handle');
 const routines=ports.routinesApplicationFactory?ports.routinesApplicationFactory.create({sessions,retention}):null;
 const historyCurrentness=ports.routinesApplicationFactory?.historyCurrentness&&ports.conversationMembership&&ports.conversationCurrentness?ports.routinesApplicationFactory.historyCurrentness({gate:ports.conversationMembership,core:ports.conversationCurrentness}):ports.conversationCurrentness;
 const historyService=ports.conversationMembership&&ports.conversationCurrentness&&conversationStore?createConversationHistoryService({store:conversationStore,gate:ports.conversationMembership,nextRunOwner:ports.conversationTurns,retention,suppression:managementSuppression}):null;
 const history=ports.conversationMembership&&ports.conversationCurrentness&&conversationStore?createConversationHistoryApplication({
  service:historyService,gate:ports.conversationMembership,currentness:historyCurrentness,turnCurrentness:ports.conversationCurrentness,management:ports.conversationManagement,now,
  limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}}):null;
 const sources=historyService&&ports.conversationSourceReader?createConversationSourceApplication({store:conversationStore,history:historyService,gate:ports.conversationMembership,currentness:historyCurrentness,management:ports.conversationManagement,reader:ports.conversationSourceReader,retention,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}}):null;
 const usage=historyService&&typeof conversationStore.history?.usageContext==='function'&&typeof conversationStore.readUsage==='function'?createConversationUsageApplication({store:conversationStore,history:historyService,gate:ports.conversationMembership,currentness:historyCurrentness,management:ports.conversationManagement,retention,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}}):null;
 const usageOverview=ports.conversationMembership&&typeof conversationStore?.usageOverview?.read==='function'?createUsageOverviewApplication({store:conversationStore,gate:ports.conversationMembership,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}}):null;
 const runIndex=historyService&&conversationStore.runs?createRunIndexApplication({store:conversationStore,history:historyService,gate:ports.conversationMembership,currentness:historyCurrentness,management:ports.conversationManagement,retention,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes}}):null;
 const canonicalDocuments=createRuntimeArtifactApplication({sessions,now,limits:{maxRequestMs:configuration.limits.requestMs,maxRequestBytes:configuration.limits.requestBytes,maxResponseBytes:configuration.native.maxResponseBytes},...(ports.artifactOptionsOwner?{optionsOwner:ports.artifactOptionsOwner}:{}),...(retention===undefined?{}:{retention})});
 // Signed download links mount over the canonical document routes behind a readiness gate that trusted startup opens (or leaves closed).
 const downloads=createDownloadLinkGate({documents:canonicalDocuments,sessions,now,maxRequestMs:configuration.limits.requestMs,links:configuration.downloadLinks,suppression,authorization:ports.artifactOptionsOwner,store:ports.artifactStore});
 const selected=createSelectedTaskApplication({controller:ports.selectedController??{async handle(){throw fault('UNAVAILABLE');}},now,limits:{requestMs:configuration.limits.requestMs,requestBytes:configuration.limits.requestBytes},sourceEnabled:configuration.sourceEnabled});
 const unavailableSession=Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,async()=>{throw fault('SDK_SESSION_UNAVAILABLE');}]));
 const sdkSessions=createNativeSdkSessionApplication({owner:ports.sdkSessionOwner??unavailableSession,...(ports.sdkSessionSnapshot===undefined?{}:{snapshot:ports.sdkSessionSnapshot}),now,maxRequestMs:configuration.limits.requestMs});
 const nativeFiles=ports.executionOwner&&ports.artifactStore?.objects&&ports.sdkSessionSnapshot?.readFiles&&conversationStore?createNativeFileApplication({owner:createNativeFileOwner({store:conversationStore,execution:ports.executionOwner,objects:ports.artifactStore.objects,snapshot:ports.sdkSessionSnapshot,...(ports.objectiveSelection?{objectiveSelection:ports.objectiveSelection}:{}),now,maxRequestMs:configuration.limits.requestMs,...(retention?{retention}:{})}),now,maxRequestMs:configuration.limits.requestMs}):null;
 return Object.freeze({downloads:Object.freeze({open:input=>downloads.open(input),state:()=>downloads.state()}),handle(request){const path=new URL(request.url).pathname;
  if(path.startsWith('/api/uploads/'))return handleUploads?handleUploads(request):Response.json({error:{code:'UPLOAD_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(Object.values(USER_PREFERENCES_PATHS).includes(path))return userPreferences?userPreferences.handle(request):userPreferencesUnavailable();
  if(path===ROUTINE_MANAGEMENT_SESSION_PATH||Object.values(ROUTINE_PATHS).includes(path))return routines?routines.handle(request):routinesUnavailable();
  if(Object.values(INTENT_PATHS).includes(path))return ports.intentApplication?ports.intentApplication.handle(request):Response.json({error:{code:'INTENTS_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(Object.values(TENANT_SETTINGS_PATHS).includes(path))return ports.settingsApplication?ports.settingsApplication.handle(request):Response.json({error:{code:'SETTINGS_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(Object.values(MEMORY_PATHS).includes(path))return ports.memoryApplication?ports.memoryApplication.handle(request):memoryUnavailable();
  if(Object.values(RUN_INDEX_PATHS).includes(path))return runIndex?runIndex.handle(request):Response.json({error:{code:'RUN_INDEX_UNAVAILABLE'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(path===CONVERSATION_USAGE_PATH)return usage?usage.handle(request):Response.json({error:{code:'USAGE_UNAVAILABLE'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(path===USAGE_OVERVIEW_PATH)return usageOverview?usageOverview.handle(request):Response.json({error:{code:'USAGE_OVERVIEW_UNAVAILABLE'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(path===BILL_TEXT_SOURCE_PATH)return sources?sources.handle(request):Response.json({error:{code:'SOURCE_REFERENCE_UNAVAILABLE'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(Object.values(HISTORY_PATHS).includes(path))return history?history.handle(request):Response.json({error:{code:'CONVERSATION_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(/^\/api\/action-followthrough\/(query|draft|prepare|execute)$/u.test(path))return handleAction?handleAction(request):Response.json({error:{code:'UNAVAILABLE'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(/^\/api\/task-commands\/(prepare|execute)$/u.test(path))return handleTask?handleTask(request):Response.json({error:{code:'TASK_COMMAND_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(path.startsWith('/api/documents/'))return downloads.handle(request);
  if(path.startsWith('/internal/conversations/selected/'))return selected.handle(request);
  if(path.startsWith('/v1/runner/session/'))return sdkSessions.handle(request);
  if(Object.hasOwn(NATIVE_FILE_PATHS,path))return nativeFiles?nativeFiles.handle(request):Response.json({error:{code:'NATIVE_FILES_UNAVAILABLE'}},{status:503,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
  return null;
 }});
}
