/** Trusted control composition. Single preview replica; source connectivity disabled. */
import {Pool} from 'pg';
import {createTurnTelemetry} from './telemetry/turn-context.mjs';
import {countingPool} from './telemetry/counting.mjs';
import {Connection,Client} from '@temporalio/client';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {documentRevisionSourceFor} from './artifacts/intent-binding.mjs';
import {createConversationService} from '../control/conversations/service.mjs';
import {createTemporalConversationDispatcher} from '../control/conversations/temporal-dispatch.mjs';
import {createActionSessionOwner} from '../control/action-host/session/owner.mjs';
import {createActionSessionApplication} from '../control/action-host/session/http.mjs';
import {readSecret,fault,compileControlUserPreferencesConfiguration} from './config.mjs';
import {readRuntimeTemporalTls as temporalTls} from './temporal-tls.mjs';
import {createTemporalRuntimeFence,assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {listenRuntime} from './http-server.mjs';
import {createControlRouteApplications,listenControlApplications} from './control-route-boundary.mjs';
import {createWorkerRunApplication} from './worker-http.mjs';
import {createExecutionSessions} from './execution-sessions.mjs';
import {createNativeSelectedComposition} from './selected/composition.mjs';
import {compileAgentCoreConfiguration} from './agentcore-configuration.mjs';
import {startAgentCoreCandidate} from './agentcore-candidate.mjs';
import {createReadCredentialRelay} from './read-credential-relay.mjs';
import {createConversationLifecycleService} from '../control/conversations/lifecycle/service.mjs';
import {createOriginalReconciler} from './original-stop.mjs';
import {createConversationLifecycleApplication} from '../control/conversations/lifecycle/http.mjs';
import {createConversationInputApplication} from '../control/conversations/input/http.mjs';
import {createConversationInitialInputApplication} from '../control/conversations/initial-input/http.mjs';
import {conversationInitialInputMetadata} from '../../packages/contracts/conversation-initial-input/protocol.mjs';
import {captureRuntimePorts,composeRuntimePorts,createRuntimeProductApplications,readRuntimeArtifactRecovery} from './product-applications.mjs';
import {productReadiness} from './product-readiness.mjs';
import {bindMemoryRetention} from './product-ports/memory.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {createPostgresRetentionJournal} from '../control/retention/postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../control/retention/postgres-watermark.mjs';
import {createRetentionStartup} from '../control/retention/startup.mjs';
import {createCoreRetentionClient} from '../control/retention/core-client.mjs';
import {createConversationPurgeFacts} from '../control/retention/inventory-source.mjs';
import {createConversationRetentionSweep} from '../control/retention/sweep.mjs';
import {createArtifactRecoveryBinding} from './artifacts/recovery-binding.mjs';
import {types} from 'node:util';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createRuntimeUserPreferences} from './user-preferences.mjs';
import {createPostgresScheduleOwner} from '../control/schedules/postgres-schedule-owner.mjs';
import {createConfiguredRunCapabilityPolicy} from './product-ports/capability-policy.mjs';
import {bindDocumentsSessions} from './artifacts/session-binding.mjs';
import {createAgentCoreIntentResolver} from './native-authority/execution-composition.mjs';
import {createRunnerIntentsApplication,RUNNER_INTENT_PATHS} from './native-authority/intents-http.mjs';
import {bindApprovalSessions} from './native-authority/approval-forwarder.mjs';
import {createObjectiveReaderApplication} from './product-ports/objective.mjs';
import {createObjectiveGenerationReadback} from './objective-generation/retained-result.mjs';
import {createApprovalMetadataReadback} from '../control/commands/approval-metadata/readback.mjs';
import {createPostgresApprovalMetadataReader} from '../control/commands/approval-metadata/postgres-store.mjs';
import {createApprovalMetadataReaderApplication} from './agentcore-control-http.mjs';
import {createPostgresObjectiveRunStartStore} from './objective-source/postgres-run-starts.mjs';
import {composeObjectiveRuns} from './native-authority/objective-runs-composition.mjs';
import {composeRoutinesOccurrences,ROUTINES_OCCURRENCE_OWNERS} from './native-authority/routines-occurrence-composition.mjs';
import {createObjectiveGenerationStartApplication} from './objective-generation/start-application.mjs';
import {compileObjectiveGenerationConfiguration} from './objective-generation/configuration.mjs';
import {createObjectiveGenerationDispatcher} from '../control/conversations/objective-generation-dispatch.mjs';
function productBinding(options){
 const c=own(options,[],['productPorts','productPortsFactory']);
 if(c.productPorts!==undefined&&c.productPortsFactory!==undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
 const factory=c.productPortsFactory;
 if(factory!==undefined&&(typeof factory!=='function'||types.isProxy(factory)||types.isAsyncFunction(factory)||types.isGeneratorFunction(factory)))throw fault('PRODUCT_PORTS_CONFIGURATION');
 return factory===undefined?{ports:captureRuntimePorts(c.productPorts)}:{factory};
}
/** Native mTLS connection options shared by trusted Temporal clients. */
export {temporalTls};
/** Retention serving over the control database (migrations conversations 0010 and artifacts 0002, plus the proposed recovered-watermark
 * table), composed only when the configuration declares it: the retention startup owner with its serving fence closed until a
 * reconciliation over the authoritative ledger (the trusted `retentionLedgerSink` port) records a watermark that reads back. Purge
 * is composed only with the explicit purge switch and actual storage/Core owners. */
export function retentionGate(configuration,pool,ports={},binding=null,now=Date.now){
 if(configuration.retention===undefined)return null;const journal=binding?.context.journal??createPostgresRetentionJournal({pool,now}),recovery=binding??createArtifactRecoveryBinding({journal}),captured=captureRuntimePorts(ports),required=captured.configuredOwners.some(name=>['artifactOptionsOwner','artifactStore'].includes(name));
 const recoverPrerequisitesExclusive=recovery.configure(readRuntimeArtifactRecovery(captured),required);
 let purge={enabled:false};
 if(configuration.retention.purge?.enabled){
  if(!captured.retentionStorage||typeof configuration.reads?.serviceSecretFile!=='string')throw fault('RETENTION_CONFIGURATION');
  const core=createCoreRetentionClient({origin:configuration.agentcore.identity.origin,getServiceSecret:async()=>Buffer.from(await readSecret(configuration.reads.serviceSecretFile)).toString('utf8').trim(),now});
  const storage=captured.retentionStorage,keyFor=storage.keyFor;
  purge={enabled:true,storage,rows:journal.rows,keyFor,finalize:core.finalize,
   facts:createConversationPurgeFacts({pool,journal,core,storage,keyFor,now})};
 }
 const startup=createRetentionStartup({journal,watermark:createPostgresWatermarkStore({journal}),ledgerSink:captured.retentionLedgerSink??null,ownership:{ownerOf:input=>journal.ownerOf(input)},purge,now,recoverPrerequisitesExclusive});
 recovery.bindRetention(startup.gate);
 return Object.freeze({serving:startup.serving,journal:startup.journal,gate:startup.gate,startup,
  ...(purge.enabled?{sweep:createConversationRetentionSweep({startup,now})}:{}),artifactRecovery:recovery.state,tables:['meri_conversations.retention_subjects','meri_conversations.retention_purges','meri_conversations.retention_purge_targets','meri_artifacts.retention_subjects','meri_artifacts.retention_purges','meri_conversations.retention_recovery_watermark']});
}
export function assembleControl(options){
 const {configuration,pool:injectedPool,client,native,execution,now=Date.now,telemetry,turnTelemetry:injectedTurnTelemetry,canonicalProductPorts,createReadsRuntime,workerModelPolicy,readCapabilityRole,...binding}=own(options,['configuration','pool','client','native','execution'],['now','telemetry','turnTelemetry','canonicalProductPorts','productPorts','productPortsFactory','createReadsRuntime','workerModelPolicy','readCapabilityRole']);
 if(workerModelPolicy!==undefined&&typeof workerModelPolicy!=='function')throw fault('CONTROL_CONFIGURATION');
 const turnTelemetry=injectedTurnTelemetry??createTurnTelemetry({service:'control',environment:configuration.telemetry?.environment,now}),pool=countingPool(injectedPool,turnTelemetry);
 if(telemetry!==undefined&&typeof telemetry?.observeRunOwner!=='function')throw fault('TELEMETRY_CONFIGURATION');
 const captured=productBinding(binding),canonical=captureRuntimePorts(canonicalProductPorts);
 const artifactRecovery=configuration.retention===undefined?null:createArtifactRecoveryBinding({journal:createPostgresRetentionJournal({pool,now})});
 let supplied,productContext;
 if(captured.factory){
  productContext=Object.freeze({configuration,pool,client,native,now,canonicalProductPorts:canonical,...(artifactRecovery?{artifactRecovery:artifactRecovery.context}:{})});
  supplied=Reflect.apply(captured.factory,undefined,[productContext]);
  if(supplied===undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
  // Ordinary functions can still return a rejected Promise. Consume only native
  // Promise rejection while refusing it; never inspect or execute then getters.
  if(types.isPromise(supplied)){Promise.prototype.then.call(supplied,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
 }
 let ports=composeRuntimePorts(canonical,captured.factory?captureRuntimePorts(supplied):captured.ports);
 const userPreferences=createRuntimeUserPreferences({configuration,pool,ports,now});
 if(ports.transitionAuthority&&typeof ports.identityContext.resolveTransitionContext!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const retention=retentionGate(configuration,pool,ports,artifactRecovery,now);
 // Memory shares the conversation retention fence; a captured route alone is not a bound producer.
 const memoryRetentionBound=Boolean(productContext&&retention&&bindMemoryRetention(productContext,retention.gate));
 const store=createPostgresConversationStore({pool,now,modelCatalog:configuration.models,onPublished:event=>{turnTelemetry.bind(event.binding);turnTelemetry.summary(event);},...(retention?{retentionGate:retention.gate,retentionHead:retention.startup.ledger?.head}:{}),
  ...(ports.transitionAuthority?{transitionAuthority:ports.transitionAuthority}:{}),...(ports.conversationManagement?{assertConversationActive:ports.conversationManagement.assertActiveBinding}:{})});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:ports.identityContext.verifyIdentity,resolveContext:ports.identityContext.resolveContext,...(ports.identityContext.withAuthority?{withAuthority:ports.identityContext.withAuthority}:{}),now,...(ports.conversationMembership?{membership:ports.conversationMembership}:{}),...(ports.transitionAuthority?{
  readTransition:({signal,...input})=>store.lifecycle.readTransition({...input,signal},()=>signal?.throwIfAborted()),
  resolveTransitionContext:ports.identityContext.resolveTransitionContext,
 }:{}),limits:{maxSessions:configuration.sessions.maxSessions,maxRequestMs:configuration.limits.requestMs,maxTtlMs:configuration.sessions.maxTtlMs,maxFactBytes:131072}});
 // A documents options owner (composed only with a trusted Core artifact authority) is late-bound to these exact sessions.
 if(productContext)bindDocumentsSessions(productContext,sessions,retention?.gate,store);
 // Approval forwarder (lane L): the per-context approver session binder reaches these exact sessions.
 if(productContext)bindApprovalSessions(productContext,sessions,retention?.gate,store);
 const nativeIntentsEnabled=Boolean(productContext&&configuration.sourceEnabled&&configuration.intents?.enabled&&ports.transitionAuthority);
 const nativeIntents=createRunnerIntentsApplication({now,enabled:nativeIntentsEnabled,
  resolveRun:productContext&&ports.transitionAuthority?createAgentCoreIntentResolver({context:productContext,execution,transitionAuthority:ports.transitionAuthority,nativeCredentials:sessions}):async()=>{throw fault('UNAVAILABLE');},
  ...(retention?{retention:retention.gate}:{})});
 const dispatcher=createTemporalConversationDispatcher({client,taskQueue:configuration.temporal.taskQueue,lifecycle:true,now,maxRequestMs:configuration.limits.requestMs});
 const capabilityPolicy=configuration.capabilityPlatform===undefined?undefined:createConfiguredRunCapabilityPolicy(configuration,{pool});
 const selected=configuration.sourceEnabled&&configuration.agentcore&&createReadsRuntime?createNativeSelectedComposition({configuration,pool,store,execution,createReadsRuntime:input=>createReadsRuntime({...input,capabilityPolicy,readCapabilityRole}),serviceFor:value=>createWorkerService(value),now}):null;
 if(selected)ports=composeRuntimePorts(ports,selected.ports);
 const basic=createConversationService({sessions,store,dispatcher,versions:configuration.versions,modelCatalog:configuration.models,now,maxRequestMs:configuration.limits.requestMs,...(capabilityPolicy?{capabilityPolicy,readCapabilityRole}:{}),...(ports.selectedSkillAdmission?{selectedSkillAdmission:ports.selectedSkillAdmission}:{}),...(ports.selectedOutputPublication?{selectedOutputPublication:ports.selectedOutputPublication}:{}),...(retention?{retention:retention.gate}:{})});
 const rawService=createConversationLifecycleService({service:basic,store,dispatcher,sessions,now,maxRequestMs:configuration.limits.requestMs,reconcileOriginal:createOriginalReconciler({native,now,timeoutMs:configuration.limits.requestMs}),nativeAdmission:ports.continuationAdmission,approvals:ports.approvals,retention:retention?retention.gate:null});
 const observedInput=Object.fromEntries(['allocateInput','admitInput','submit'].map(name=>[name,async input=>turnTelemetry.provisional(async()=>{const value=await rawService[name](input);try{const binding=value.run?.binding??value.allocation?.binding;if(binding){turnTelemetry.bind(binding);if(name==='submit')turnTelemetry.stage(binding,'send.submit.accepted');}}catch{}return value;})]));
 const service=Object.freeze({...rawService,...observedInput});
 // Private runtime traffic uses the same domain/store owners with a request-bound execution
 // observation. User sessions and Core remain on public admission and business-data paths.
 const createWorkerService=({credential,binding})=>{
  const localSessions=createExecutionSessions({execution,credential,binding,now});
  const localBasic=createConversationService({...(productContext?{documentRevisionSource:value=>documentRevisionSourceFor(productContext,value)}:{}),sessions:localSessions,store:workerModelPolicy?{...store,readModelPolicy:workerModelPolicy}:store,dispatcher,versions:configuration.versions,modelCatalog:configuration.models,now,maxRequestMs:configuration.limits.requestMs,...(capabilityPolicy?{capabilityPolicy,readCapabilityRole}:{}),...(ports.selectedSkillAdmission?{selectedSkillAdmission:ports.selectedSkillAdmission}:{}),...(ports.selectedOutputPublication?{selectedOutputPublication:ports.selectedOutputPublication}:{}),...(retention?{retention:retention.gate}:{})});
  const localService=createConversationLifecycleService({service:localBasic,store,dispatcher,sessions:localSessions,now,maxRequestMs:configuration.limits.requestMs,reconcileOriginal:createOriginalReconciler({native,now,timeoutMs:configuration.limits.requestMs}),nativeAdmission:ports.continuationAdmission,approvals:ports.approvals,retention:retention?retention.gate:null});
  return telemetry?telemetry.observeRunOwner(localService):localService;
 };
 const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),input=createConversationInputApplication({service,now,turnTelemetry,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),initialInput=createConversationInitialInputApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:Math.min(configuration.limits.requestMs,conversationInitialInputMetadata.limits.maxRequestMs)}),issuance=createActionSessionApplication({owner:sessions,now,maxRequestMs:configuration.limits.requestMs}),worker=createWorkerRunApplication({execution,createService:createWorkerService,configuration,now,turnTelemetry,...(retention?{retention:retention.gate}:{})});
 const objectiveReadback=compileObjectiveGenerationConfiguration(configuration,'control').runs?createObjectiveGenerationReadback({runStarts:createPostgresObjectiveRunStartStore({enabled:true,pool,now}),store,objects:ports.artifactStore?.objects,retention:retention?.gate,now,maxRequestMs:configuration.limits.requestMs}):null;
 const approvalMetadataReadback=ports.intentApplication&&configuration.intents?.core?createApprovalMetadataReadback({metadata:createPostgresApprovalMetadataReader({pool}),store,retention:retention?.gate,now,maxRequestMs:configuration.limits.requestMs}):null;
 const products=createRuntimeProductApplications({configuration,sessions,ports,now,conversationStore:store,userPreferences,...(retention?{retention:retention.gate,managementSuppression:retention.startup.suppression,suppression:{journal:retention.journal,serving:retention.serving}}:{})});
 // Composed intents need their journal table; a disabled family adds no table, so first-chat readiness is unchanged.
 const intentTables=Object.freeze([...(ports.intentApplication?['meri_intents.preparations','meri_commands.approval_metadata']:selected?['meri_intents.preparations','meri_commands.approval_metadata']:nativeIntentsEnabled?['meri_intents.preparations',...(configuration.intents.core?['meri_commands.approval_metadata']:[])]:[]),...(ports.actionApplicationFactory?.state()==='composed'?['meri_task_lookup.lookups','meri_task_lookup.events']:[])]);
 const memoryTables=Object.freeze(ports.memoryApplication?['meri_memory.candidates']:[]);
 if(!injectedTurnTelemetry)turnTelemetry.start();
 return Object.freeze({service,store,sessions,retention,objectiveReadback,approvalMetadataReadback,userPreferences,intentTables,memoryTables,productReadiness:()=>productReadiness({ports,retention,memoryRetentionBound,sourceEnabled:configuration.sourceEnabled,userPreferences:userPreferences.state()}),downloads:products.downloads,application:{handle:request=>turnTelemetry.provisional(()=>{const product=products.handle(request);if(product!==null)return product;const path=new URL(request.url).pathname;return Object.values(RUNNER_INTENT_PATHS).includes(path)?nativeIntents.handle(request):path==='/api/action-followthrough/session'?issuance.handle(request):path==='/api/conversations/input/admit'?input.handle(request):path===conversationInitialInputMetadata.routes.allocate.path?initialInput.handle(request):path.startsWith('/internal/')?worker.handle(request):conversation.handle(request);})},async close(){try{await selected?.close();}finally{userPreferences.close();if(!injectedTurnTelemetry)turnTelemetry.close();await sessions.close();}}});
}
export async function startControl(configuration,options={}){
 // Validate compiled bindings before secret reads, connections or owned allocation.
 const {signal:externalSignal,createReadsRuntime,readCredentialRelay:injectedReadCredentialRelay,memoryContextRelay,occurrenceRelay,routinesCandidateBinder,turnTelemetry:injectedTurnTelemetry,testOwners={},...binding}=own(options,[],['signal','productPorts','productPortsFactory','createReadsRuntime','readCredentialRelay','memoryContextRelay','occurrenceRelay','routinesCandidateBinder','turnTelemetry','testOwners']);const readCredentialRelay=injectedReadCredentialRelay??createReadCredentialRelay();if(readCredentialRelay!==undefined&&(typeof readCredentialRelay?.bind!=='function'||typeof readCredentialRelay?.close!=='function')||memoryContextRelay!==undefined&&(typeof memoryContextRelay?.bind!=='function'||typeof memoryContextRelay?.close!=='function')||routinesCandidateBinder!==undefined&&(typeof routinesCandidateBinder!=='function'||types.isProxy(routinesCandidateBinder)||types.isAsyncFunction(routinesCandidateBinder)||types.isGeneratorFunction(routinesCandidateBinder)))throw fault('CONTROL_CONFIGURATION');nativeSignal(externalSignal);const fence=createTemporalRuntimeFence(),signal=externalSignal?AbortSignal.any([externalSignal,fence.signal]):fence.signal;const owners=own(testOwners,[],['readMaterial','tls','createPool','connect','createClient','startCandidate','assemble','listen']);for(const value of Object.values(owners))if(typeof value!=='function')throw fault('CONTROL_CONFIGURATION');const compiled=productBinding(binding);
 compileAgentCoreConfiguration(configuration.agentcore);
 const objectiveDeclared=compileObjectiveGenerationConfiguration(configuration,'control');
 if(objectiveDeclared.runs&&typeof configuration.reads?.serviceSecretFile!=='string')throw fault('OBJECTIVE_CORE_CONFIGURATION');
 // Automatic client context and conversation management use the same Core read
 // credential independently of Objective generation. Keep the secret control-only.
 const getCoreServiceSecret=typeof configuration.reads?.serviceSecretFile==='string'?async()=>{const bytes=await (owners.readMaterial??readSecret)(configuration.reads.serviceSecretFile);return bytes.toString('utf8').trim();}:undefined;
 if(createReadsRuntime!==undefined&&typeof createReadsRuntime!=='function')throw fault('READS_CONFIGURATION');
 compileControlUserPreferencesConfiguration(configuration);
 const turnTelemetry=injectedTurnTelemetry??createTurnTelemetry({service:'control',environment:configuration.telemetry?.environment});turnTelemetry.start();
 const mounted=compiled.factory?{productPortsFactory:compiled.factory}:{productPorts:compiled.ports};
 const onExternalAbort=()=>fence.lose(externalSignal.reason);externalSignal?.addEventListener('abort',onExternalAbort,{once:true});if(externalSignal?.aborted)onExternalAbort();
 let pool,connection,listener,privateListener,assembly,candidate,closing,telemetry;
 const checkAuthorization=()=>{fence.check();signal.throwIfAborted();};
 const close=()=>closing??=(async()=>{fence.lose('RUNTIME_STOPPING');readCredentialRelay?.close();memoryContextRelay?.close();occurrenceRelay?.close();externalSignal?.removeEventListener('abort',onExternalAbort);const results=[];for(const method of [()=>listener?.close(),()=>privateListener?.close(),()=>candidate?.close(),()=>assembly?.close(),()=>connection?.close(),()=>pool?.end(),()=>telemetry?.close(),()=>{if(!injectedTurnTelemetry)turnTelemetry.close();}])try{results.push({status:'fulfilled',value:await method()});}catch(reason){results.push({status:'rejected',reason});}assertTemporalRuntimeCleanup(results);})();
 try{
  signal?.throwIfAborted();
  // Declared telemetry starts first and closes last so every request span is flushed; the SDK is loaded only when enabled.
  if(configuration.telemetry?.enabled===true){const {startControlTelemetry}=await import('./telemetry/index.mjs');telemetry=startControlTelemetry({configuration});}
  signal?.throwIfAborted();
  const [connectionBytes,capabilityBytes,tls]=await Promise.all([(owners.readMaterial??readSecret)(configuration.database.connectionFile),(owners.readMaterial??readSecret)(configuration.native.capabilityFile),(owners.tls??temporalTls)(configuration.temporal.tls)]);checkAuthorization();
  signal?.throwIfAborted();
  const connectionString=connectionBytes.toString('utf8').trim();let u;try{u=new URL(connectionString);}catch{throw fault('DATABASE_CONFIGURATION');}
  // URL.get() selects the first duplicate; pg's adopted parser selects the
  // last. Accept one closed TLS parameter before either client is allocated.
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hash||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='verify-full'||[...u.searchParams.keys()].some(key=>key!=='sslmode'))throw fault('DATABASE_CONFIGURATION');
  pool=countingPool((owners.createPool??(options=>new Pool(options)))({connectionString,max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs}),turnTelemetry);
  connection=await (owners.connect??(options=>Connection.connect(options)))({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs});checkAuthorization();signal?.throwIfAborted();const client=(owners.createClient??(options=>new Client(options)))({connection,namespace:configuration.temporal.namespace});
  candidate=await (owners.startCandidate??startAgentCoreCandidate)({configuration,pool,signal,turnTelemetry,controlCredential:capabilityBytes.toString('utf8').trim(),nativeCredentials:readCredentialRelay.port,...(getCoreServiceSecret?{getCoreServiceSecret}:{}),...(createReadsRuntime===undefined?{}:{createReadsRuntime})});
  let native=candidate.native;routinesCandidateBinder?.(candidate);const unfencedNative=native;native=Object.freeze({...native,async call(operation,input,{signal:requestSignal}={}){if(operation==='execution/kickoff/stop')return unfencedNative.call(operation,input,{signal:requestSignal});fence.check();const joined=requestSignal?AbortSignal.any([requestSignal,fence.signal]):fence.signal;return unfencedNative.call(operation,input,{signal:joined});}});checkAuthorization();assembly=(owners.assemble??assembleControl)({configuration,pool,client,native,execution:candidate.execution,createReadsRuntime,readCapabilityRole:candidate.readCapabilityRole,turnTelemetry,...(candidate.workerModelPolicy?{workerModelPolicy:candidate.workerModelPolicy}:{}),...(telemetry?{telemetry}:{}),...mounted,...(candidate?{canonicalProductPorts:candidate.productPorts}:{})});candidate?.bindApplication({...fence.wrap(assembly.application),sweepRetention:input=>{checkAuthorization();if(typeof assembly.retention?.sweep!=='function')throw fault('EXECUTION_STORE_UNAVAILABLE');return assembly.retention.sweep({...input,signal:input.signal?AbortSignal.any([input.signal,fence.signal]):fence.signal});}});
  // RC1 option A: the reads composer's late-bound live-session relay reaches this control's own action-session owner only.
  readCredentialRelay?.bind(assembly.sessions);
  // Proposal continuation binds to this control's durable conversation store.
  // The factory stays closed without the canonical retention serving gate.
  if(memoryContextRelay!==undefined){
   if(!assembly.retention||!assembly.store?.memoryProposalContexts)throw fault('MEMORY_CONTEXT_UNAVAILABLE');
   memoryContextRelay.bind(assembly.store.memoryProposalContexts);
  }
  // Option B occurrence facts: the schedule owner over this control's pool serves the reads composer's unattended lookups (read only).
  if(occurrenceRelay!==undefined&&configuration.routines?.enabled===true)occurrenceRelay.bind(createPostgresScheduleOwner({pool}));
  // The download-link gate opens only after its owners verify; a closed gate leaves every other route as composed.
  checkAuthorization();const downloads=await assembly.downloads.open({signal});checkAuthorization();
  const mountedApplication=candidate?{async handle(request){return (await candidate.application.handle(request))??assembly.application.handle(request);}}:assembly.application;
  const objectiveRuns=composeObjectiveRuns({configuration,controlCapabilitySha256:capabilityDigest(capabilityBytes.toString('utf8').trim()),pool,store:assembly.store,client,retention:assembly.retention?.gate,
   ...(objectiveDeclared.runs?candidate.objective:{})});
  const objectiveStart=objectiveDeclared.start===null?null:createObjectiveGenerationStartApplication({enabled:true,identity:native,windowMs:objectiveDeclared.start.windowMs,maxRequestMs:configuration.limits.requestMs,
   authorizeJob:({source,signal})=>candidate.objective.core.clientFor(source).current({signal}),
   dispatcher:createObjectiveGenerationDispatcher({client,taskQueue:configuration.temporal.taskQueue,maxRequestMs:configuration.limits.requestMs})});
  const objectiveReader=createObjectiveReaderApplication(assembly.objectiveReadback?{reader:assembly.objectiveReadback,getServiceSecret:getCoreServiceSecret,maxRequestMs:configuration.limits.requestMs}:{});
  const approvalMetadataReader=createApprovalMetadataReaderApplication(assembly.approvalMetadataReadback?{reader:assembly.approvalMetadataReadback,getServiceSecret:async()=>{const bytes=await (owners.readMaterial??readSecret)(configuration.intents.core.serviceSecretFile);return bytes.toString('utf8').trim();},maxRequestMs:configuration.limits.requestMs}:{});
  // Routine occurrences (lane B3): the schedule worker's admission and retirement native operations over the candidate's scheduled-run
  // template and initial-run retirement, consented per occurrence by Core's firing grant. Declared without those owners, every call refuses.
  const routinesOccurrences=composeRoutinesOccurrences({configuration,controlCapabilitySha256:capabilityDigest(capabilityBytes.toString('utf8').trim()),pool,...(candidate?.routinesOccurrenceOwners?{owners:candidate.routinesOccurrenceOwners}:{})});
  if(routinesOccurrences.state==='owners-unavailable')process.stderr.write(JSON.stringify({event:'runtime.routines.occurrences.unavailable',missing:Object.keys(ROUTINES_OCCURRENCE_OWNERS).filter(k=>k!=='consent')})+'\n');
  const separated=configuration.privateHttp===undefined?null:createControlRouteApplications({assembly:assembly.application,candidate:candidate?.application,objectiveReader,approvalMetadataReader,objectiveRuns:objectiveRuns.application,objectiveStart,routinesOccurrences:routinesOccurrences.application});
  const publicApplication=fence.wrap(separated?.public??mountedApplication),application=telemetry?telemetry.instrumentApplication(publicApplication):publicApplication;
  const privateApplication=separated===null?null:telemetry?telemetry.instrumentApplication(fence.wrap(separated.private)):fence.wrap(separated.private);
  async function readiness({signal}){fence.check();signal?.throwIfAborted();await pool.query("SELECT to_regclass('meri_conversations.runs') AS runs, to_regclass('meri_conversations.events') AS events, to_regclass('meri_conversations.controls') AS controls, to_regclass('meri_conversations.selected_outputs') AS selected_outputs, to_regclass('meri_conversations.initial_inputs') AS initial_inputs").then(result=>{if(!result.rows[0]||typeof result.rows[0].initial_inputs!=='string'||Object.values(result.rows[0]).some(v=>v===null))throw fault('DATABASE_SCHEMA_UNAVAILABLE');});
   // Declared retention serving needs its projections present and a recovered watermark: a fenced or stale projection is reconciled from
   // the ledger here before serving, and a missing dependency is exposed, never bypassed.
   if(objectiveRuns.tables.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[objectiveRuns.tables]);if(r.rows.length!==objectiveRuns.tables.length||r.rows.some(row=>row.relation===null))throw fault('OBJECTIVE_SCHEMA_UNAVAILABLE');}
   if(routinesOccurrences.tables.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[routinesOccurrences.tables]);if(r.rows.length!==routinesOccurrences.tables.length||r.rows.some(row=>row.relation===null))throw fault('ROUTINES_SCHEMA_UNAVAILABLE');}
   if(assembly.intentTables?.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.intentTables]);if(r.rows.length!==assembly.intentTables.length||r.rows.some(row=>row.relation===null))throw fault('INTENTS_SCHEMA_UNAVAILABLE');}
   if(assembly.memoryTables?.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.memoryTables]);if(r.rows.length!==assembly.memoryTables.length||r.rows.some(row=>row.relation===null))throw fault('MEMORY_SCHEMA_UNAVAILABLE');}
   if(memoryContextRelay!==undefined){const r=await pool.query("SELECT to_regclass('meri_conversations.memory_proposal_contexts') AS relation");if(typeof r.rows[0]?.relation!=='string')throw fault('MEMORY_CONTEXT_SCHEMA_UNAVAILABLE');}
   if(assembly.retention){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.retention.tables]);if(r.rows.length!==assembly.retention.tables.length||r.rows.some(row=>row.relation===null))throw fault('RETENTION_SCHEMA_UNAVAILABLE');await assembly.retention.startup.ensureServing();}await connection.withDeadline(Date.now()+configuration.limits.requestMs,()=>signal?connection.withAbortSignal(signal,()=>connection.workflowService.describeNamespace({namespace:configuration.temporal.namespace})):connection.workflowService.describeNamespace({namespace:configuration.temporal.namespace}));await native.readiness({signal});await assembly.userPreferences.readiness({signal});signal?.throwIfAborted();return {product:assembly.productReadiness()};}
  await readiness({signal});({publicListener:listener,privateListener}=await listenControlApplications({configuration,publicApplication:application,privateApplication,readiness,signal:candidate?undefined:externalSignal,listen:owners.listen??listenRuntime,checkStartup:checkAuthorization}));
  checkAuthorization();return Object.freeze({address:listener.address,...(privateListener?{privateAddress:privateListener.address}:{}),downloads,close});
 }catch(error){try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'CONTROL_STARTUP_AND_CLEANUP_FAILED'));}if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;throw Object.assign(fault('CONTROL_STARTUP_FAILED'),{cause:error});}
}
