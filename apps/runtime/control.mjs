import {createBrowserViewerApplication} from '../control/browser-viewer/application.mjs';
import {createBrowserViewerHttp} from '../control/browser-viewer/http.mjs';
import {intentsComposition} from './product-ports/intents.mjs';
import {createBrowserApprovalOwner} from './browser-approval.mjs';
import {createBrowserApprovalPreparationOwner} from '../control/commands/approval-metadata/browser-preparation-journal.mjs';
import {createBrowserApprovalConsumptionOwner} from '../control/commands/approval-metadata/browser-approval-consumption.mjs';
/** Trusted control composition. Single preview replica; source connectivity disabled. */
import {Pool} from 'pg';
import {createTurnTelemetry} from './telemetry/turn-context.mjs';
import {countingPool} from './telemetry/counting.mjs';
import {Connection,Client} from '@temporalio/client';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {documentRevisionSourceFor,selectedDocumentRevisionSourceFor} from './artifacts/intent-binding.mjs';
import {createConversationService} from '../control/conversations/service.mjs';
import {createTemporalConversationDispatcher} from '../control/conversations/temporal-dispatch.mjs';
import {createActionSessionOwner,browserSessionAccess} from '../control/action-host/session/owner.mjs';
import {createOutreachCore} from './outreach-generation/core.mjs';
import {createOutreachStartApplication} from './outreach-generation/start.mjs';
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
import {MEMORY_TABLES,assertMemoryRetentionSchema} from '../control/memory/retention-readiness.mjs';
import {UPLOAD_NATIVE_MOUNT_MS,UPLOAD_NATIVE_UNAVAILABLE_EVENT,beginUploadNativeProvisioning,mountUploadNativeControl} from './uploads/control-lifecycle.mjs';
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
import {createConfiguredRunBrowserPolicy} from './product-ports/browser-policy.mjs';
import {createBrowserOperations} from './browser-operations.mjs';
import {bindDocumentsSessions} from './artifacts/session-binding.mjs';
import {compileOfficeConfiguration} from './artifacts/office-configuration.mjs';
import {composeOffice,prepareOfficeMaterial} from './artifacts/office-composition.mjs';
import {createAgentCoreIntentResolver} from './native-authority/execution-composition.mjs';
import {createRunnerIntentsApplication,RUNNER_INTENT_PATHS} from './native-authority/intents-http.mjs';
import {bindApprovalSessions} from './native-authority/approval-forwarder.mjs';
import {createObjectiveReaderApplication} from './product-ports/objective.mjs';
import {createObjectiveGenerationReadback} from './objective-generation/retained-result.mjs';
import {createApprovalMetadataReadback} from '../control/commands/approval-metadata/readback.mjs';
import {createApprovalMetadataReaderApplication} from './agentcore-control-http.mjs';
import {createWorkspaceGenerationApplication} from '../control/conversations/workspace-generation/application.mjs';
import {workspaceGenerationLimits} from '../control/conversations/workspace-generation/protocol.mjs';
import {createRetentionWitnessApplication} from '../control/retention/serving-witness.mjs';
import {createPostgresObjectiveRunStartStore} from './objective-source/postgres-run-starts.mjs';
import {composeObjectiveRuns} from './native-authority/objective-runs-composition.mjs';
import {composeRoutinesOccurrences,ROUTINES_OCCURRENCE_OWNERS} from './native-authority/routines-occurrence-composition.mjs';
import {composeSourceEventMount} from './source-event-application.mjs';
import {createObjectiveGenerationStartApplication} from './objective-generation/start-application.mjs';
import {compileObjectiveGenerationConfiguration} from './objective-generation/configuration.mjs';
import {createObjectiveGenerationDispatcher} from '../control/conversations/objective-generation-dispatch.mjs';
import {createBrowserHostComposition,readBrowserHostMaterial} from './browser-host-composition.mjs';
import {compileBrowserHostConfiguration} from './browser-host-configuration.mjs';
import {createBrowserOperationOwner} from '../control/intents/browser-operation-owner.mjs';
import {createPostgresApprovalMetadataReader} from '../control/commands/approval-metadata/postgres-store.mjs';
import {createIntentJournal} from '../control/intents/journal.mjs';
import {createPostgresIntentJournalStore} from '../control/intents/postgres-journal.mjs';
import {createBrowserReceiptProducer} from '../control/browser-hosts/browser-receipts.mjs';
import {createBrowserActionRecorder} from '../control/browser-hosts/action-settlement.mjs';
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
  purge={enabled:true,storage,rows:journal.rows,keyFor,finalize:core.finalize,verify:core.verify,office:core.office,
   facts:createConversationPurgeFacts({pool,journal,core,storage,keyFor,now})};
 }
 const startup=createRetentionStartup({journal,watermark:createPostgresWatermarkStore({journal}),ledgerSink:captured.retentionLedgerSink??null,ownership:{ownerOf:input=>journal.ownerOf(input)},purge,now,recoverPrerequisitesExclusive});
 recovery.bindRetention(startup.gate);
 return Object.freeze({serving:startup.serving,journal:startup.journal,gate:startup.gate,startup,
  ...(purge.enabled?{sweep:createConversationRetentionSweep({startup,now})}:{}),artifactRecovery:recovery.state,tables:['meri_conversations.retention_subjects','meri_conversations.retention_purges','meri_conversations.retention_purge_targets','meri_artifacts.retention_subjects','meri_artifacts.retention_purges','meri_conversations.retention_recovery_watermark']});
}
export function assembleControl(options){
 const {configuration,pool:injectedPool,client,native,execution,now=Date.now,telemetry,turnTelemetry:injectedTurnTelemetry,canonicalProductPorts,uploadsNative,createReadsRuntime,workerModelPolicy,readCapabilityRole,officeMaterial,...binding}=own(options,['configuration','pool','client','native','execution'],['now','telemetry','turnTelemetry','canonicalProductPorts','uploadsNative','productPorts','productPortsFactory','createReadsRuntime','workerModelPolicy','readCapabilityRole','browserHostMaterial','browserHostDeclaration','officeMaterial']);
 if(workerModelPolicy!==undefined&&typeof workerModelPolicy!=='function')throw fault('CONTROL_CONFIGURATION');
 const turnTelemetry=injectedTurnTelemetry??createTurnTelemetry({service:'control',environment:configuration.telemetry?.environment,now}),pool=countingPool(injectedPool,turnTelemetry);
 if(telemetry!==undefined&&typeof telemetry?.observeRunOwner!=='function')throw fault('TELEMETRY_CONFIGURATION');
 // Protected browser-host material is loaded by startControl (owner of the trusted reader) and only
 // consumed here; it is not a product port and must not reach productBinding's closed shape.
 const {browserHostMaterial,browserHostDeclaration,...productOptions}=binding;
 const captured=productBinding(productOptions),canonical=captureRuntimePorts(canonicalProductPorts);
 const artifactRecovery=configuration.retention===undefined?null:createArtifactRecoveryBinding({journal:createPostgresRetentionJournal({pool,now})});
 let supplied,productContext;
 if(captured.factory){
  productContext=Object.freeze({configuration,pool,client,native,now,canonicalProductPorts:canonical,...(artifactRecovery?{artifactRecovery:artifactRecovery.context}:{})});
  // A mounted native upload inspection reaches the uploads family and nothing else, as a per-family context extension:
  // the shared context stays byte-identical because it is identity-keyed by the retention/session binders and is closed
  // by the memory and intents families, so widening it would refuse an unrelated product.
  supplied=Reflect.apply(captured.factory,undefined,[productContext,uploadsNative?.inspection?{uploads:{uploadsInspection:uploadsNative.inspection}}:undefined]);
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
 // Browser-call custody lives in the EXISTING intent journal over the borrowed pool; durable browser
 // receipts live in the real conversation event owner. Both are constructed here, where those owners
 // actually exist, and are passed to their call sites below.
 // ONE intent journal for this Control: browser execution custody and browser approval preparation share it
 // (execution currentness still comes from store.executions, a different owner).
 const intentJournal=createIntentJournal(createPostgresIntentJournalStore({pool}));
 const browserCustody=createBrowserOperationOwner({journal:intentJournal,now});
 const browserReceipts=createBrowserReceiptProducer({store,now});
 const management=ports.routinesApplicationFactory?.managementSessionConfiguration?.();
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:ports.identityContext.verifyIdentity,resolveContext:ports.identityContext.resolveContext,...(ports.identityContext.resolveBrowserContext?{resolveBrowserContext:ports.identityContext.resolveBrowserContext}:{}),...(ports.identityContext.withAuthority?{withAuthority:ports.identityContext.withAuthority}:{}),...(management?{management}:{}),now,...(ports.conversationMembership?{membership:ports.conversationMembership}:{}),...(ports.transitionAuthority?{
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
 const readBrowserPolicy=createConfiguredRunBrowserPolicy(configuration,{pool,now});
 // Shared browser hosts: the real router plus the host-currentness listener Control serves to an
 // allocated host, composed over the store/sessions created above. A declared family that cannot
 // compose refuses HERE instead of mounting nothing: the session owner created above is closed before
 // the error escapes, so a failed assembly owns no live state.
 let browserHosts=null;
 // One reusable cleanup for everything this assembly created after the store/session owners exist. It is
 // handed to the async caller on ANY later failure, so no owner is orphaned and no rejection is lost.
 const ownedCleanup=()=>{const failures=[];
  return (async()=>{try{if(browserHosts!==null)await browserHosts.close();}catch(reason){failures.push(reason);}
   try{await sessions.close();}catch(reason){failures.push(reason);}
   if(failures.length)throw Object.assign(new Error('CONTROL_ASSEMBLY_CLEANUP_FAILED'),{code:'CONTROL_ASSEMBLY_CLEANUP_FAILED',failures:Object.freeze(failures)});})();};
 if(configuration.browserHosts!==undefined){
  // The declaration is compiled once at the actual caller (startControl) and passed in; a direct
  // assembleControl caller still gets the same normalization here. enabled:false is absent.
  const declaration=browserHostDeclaration!==undefined?browserHostDeclaration:compileBrowserHostConfiguration(configuration);
  try{
   if(declaration!==null){
    if(!browserHostMaterial)throw fault('BROWSER_HOST_CONFIGURATION');
    // The retained browser approval PREPARATION owner, over the owners this Control already has. Its
    // approval ports are the SAME shared Core forwarder the product composition exposes, and a missing
    // dependency refuses here instead of mounting a browser family that cannot prepare.
    // The product composition is the SAME object Control builds for the runner; when this Control has no
    // product context (or it is not intents-enabled) there are simply no browser approval ports.
    let productIntents=null;
    if(productContext!==null&&productContext!==undefined){
     try{productIntents=intentsComposition(productContext,{});}
     catch(error){
      // An enabled approval family that cannot compose is a real fault; only an absent or disabled one is
      // optional and may leave the browser approval ports unmounted.
      if(productContext.configuration?.intents?.enabled===true)throw error;
      productIntents=null;
     }
    }
    // Composed only from real owners; when the Core approval ports or the exporting role are absent the
    // browser family still mounts its read routes, and the preparation owner stays absent (reported as
    // browserApproval:false) rather than pretending to be ready.
    const browserApproval=readCapabilityRole===undefined||typeof store?.executions?.withCurrentRun!=='function'||
     typeof productIntents?.browser?.record!=='function'||typeof productIntents?.browser?.status!=='function'
      ?null:createBrowserApprovalOwner({journal:store.executions,pool,readCapabilityRole,readBrowserPolicy,
       preparations:createBrowserApprovalPreparationOwner({journal:intentJournal}),
       consumption:createBrowserApprovalConsumptionOwner({journal:intentJournal}),
       ports:{record:productIntents.browser.record,status:productIntents.browser.status,
        consume:productIntents.browser.consume,result:productIntents.browser.result},now,
       limits:{requestMs:configuration.limits.requestMs}});
    browserHosts=createBrowserHostComposition({declaration,pool,store,sessions,core:ports.browserHostCore,capabilityPolicy,readBrowserPolicy,
     siteWorkflowAdmission:ports.siteWorkflowAdmission??null,browserApproval,
     browserReceipts:createBrowserActionRecorder({metadata:createPostgresApprovalMetadataReader({pool}),
      record:value=>browserReceipts.appendAction(value),result:typeof productIntents?.browser?.result==='function'?value=>productIntents.browser.result(value):null,
      status:value=>productIntents.browser.status(value),now}),
     material:browserHostMaterial,now,limits:{requestMs:configuration.limits.requestMs}});
    if(browserHosts===null)throw fault('BROWSER_HOST_CONFIGURATION');
    ports=composeRuntimePorts(ports,{browserHosts:browserHosts.browserHosts});
   }
  }catch(error){throw Object.assign(error,{controlCleanup:ownedCleanup()});}
 }
 // Every constructor after the browser/session owners is inside this guard: a late failure retires them
 // through the same owned cleanup instead of leaking the session owner or orphaning a rejection.
 try{
 const browserOperations=ports.browserHosts?.executeBrowserOperation&&readCapabilityRole?createBrowserOperations({hosts:ports.browserHosts,readCapabilityRole,readBrowserPolicy,custody:browserCustody,now}):undefined;
 const selected=configuration.sourceEnabled&&configuration.agentcore&&createReadsRuntime?createNativeSelectedComposition({configuration,pool,store,execution,createReadsRuntime:input=>createReadsRuntime({...input,capabilityPolicy,readCapabilityRole}),serviceFor:value=>createWorkerService(value),...(productContext?{revisionSource:value=>selectedDocumentRevisionSourceFor(productContext,value)}:{}),now}):null;
 if(selected)ports=composeRuntimePorts(ports,selected.ports);
 const uploadInputSource=ports.uploadApplicationFactory?.createSource?.({sessions,retention:retention?.gate,conversationStore:store});
 const basic=createConversationService({uploadInputSource,sessions,store,dispatcher,versions:configuration.versions,modelCatalog:configuration.models,now,maxRequestMs:configuration.limits.requestMs,...(capabilityPolicy?{capabilityPolicy,readCapabilityRole}:{}),...(ports.selectedSkillAdmission?{selectedSkillAdmission:ports.selectedSkillAdmission}:{}),...(ports.selectedOutputPublication?{selectedOutputPublication:ports.selectedOutputPublication}:{}),...(ports.procedureAdmission?{procedureAdmission:ports.procedureAdmission}:{}),...(ports.siteWorkflowAdmission?{siteWorkflowAdmission:ports.siteWorkflowAdmission}:{}),...(retention?{retention:retention.gate}:{})});
 const rawService=createConversationLifecycleService({service:basic,...(ports.browserHosts?{browserHosts:ports.browserHosts}:{}),store,dispatcher,sessions,now,maxRequestMs:configuration.limits.requestMs,reconcileOriginal:createOriginalReconciler({native,now,timeoutMs:configuration.limits.requestMs}),nativeAdmission:ports.continuationAdmission,approvals:ports.approvals,retention:retention?retention.gate:null});
 const observedInput=Object.fromEntries(['allocateInput','admitInput','submit'].map(name=>[name,async input=>turnTelemetry.provisional(async()=>{const value=await rawService[name](input);try{const binding=value.run?.binding??value.allocation?.binding;if(binding){turnTelemetry.bind(binding);if(name==='submit')turnTelemetry.stage(binding,'send.submit.accepted');}}catch{}return value;})]));
 const service=Object.freeze({...rawService,...observedInput});

 const browserViewer=createBrowserViewerHttp({application:createBrowserViewerApplication({lifecycle:service,transport:ports.browserHosts??{execute:async()=>{throw fault('UNAVAILABLE');}},now}),now,maxRequestMs:Math.min(configuration.limits.requestMs,30000)});
 const browserIssuance=createActionSessionApplication({owner:{issue:async q=>(await browserSessionAccess(sessions).issue(q)).receipt},sessionPath:'/api/action-followthrough/browser-session',now,maxRequestMs:Math.min(configuration.limits.requestMs,30000)});
 // Private runtime traffic uses the same domain/store owners with a request-bound execution
 // observation. User sessions and Core remain on public admission and business-data paths.
 const createWorkerService=({credential,binding})=>{
  const localSessions=createExecutionSessions({execution,credential,binding,now});
  const localBasic=createConversationService({uploadInputSource,...(productContext?{documentRevisionSource:value=>documentRevisionSourceFor(productContext,value)}:{}),sessions:localSessions,store:workerModelPolicy?{...store,readModelPolicy:workerModelPolicy}:store,dispatcher,versions:configuration.versions,modelCatalog:configuration.models,now,maxRequestMs:configuration.limits.requestMs,...(capabilityPolicy?{capabilityPolicy,readCapabilityRole}:{}),...(ports.selectedSkillAdmission?{selectedSkillAdmission:ports.selectedSkillAdmission}:{}),...(ports.selectedOutputPublication?{selectedOutputPublication:ports.selectedOutputPublication}:{}),...(ports.procedureAdmission?{procedureAdmission:ports.procedureAdmission}:{}),...(ports.siteWorkflowAdmission?{siteWorkflowAdmission:ports.siteWorkflowAdmission}:{}),...(retention?{retention:retention.gate}:{})});
  const localService=createConversationLifecycleService({service:localBasic,store,dispatcher,sessions:localSessions,now,maxRequestMs:configuration.limits.requestMs,reconcileOriginal:createOriginalReconciler({native,now,timeoutMs:configuration.limits.requestMs}),nativeAdmission:ports.continuationAdmission,approvals:ports.approvals,retention:retention?retention.gate:null});
  return telemetry?telemetry.observeRunOwner(localService):localService;
 };
 const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),input=createConversationInputApplication({service,now,turnTelemetry,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),initialInput=createConversationInitialInputApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:Math.min(configuration.limits.requestMs,conversationInitialInputMetadata.limits.maxRequestMs)}),issuance=createActionSessionApplication({owner:sessions,now,maxRequestMs:configuration.limits.requestMs}),worker=createWorkerRunApplication({execution,createService:createWorkerService,configuration,now,turnTelemetry,...(browserOperations?{browserOperations}:{}),...(retention?{retention:retention.gate}:{})});
 const outreachStart=configuration.sourceEnabled&&configuration.agentcore?createOutreachStartApplication({core:createOutreachCore({origin:configuration.agentcore.identity.origin,now,maxRequestMs:configuration.limits.requestMs}),sessions,service,now,maxRequestMs:configuration.limits.requestMs}):null;
 const objectiveReadback=compileObjectiveGenerationConfiguration(configuration,'control').runs?createObjectiveGenerationReadback({runStarts:createPostgresObjectiveRunStartStore({enabled:true,pool,now}),store,objects:ports.artifactStore?.objects,retention:retention?.gate,now,maxRequestMs:configuration.limits.requestMs}):null;
 const approvalMetadataReadback=ports.intentApplication&&configuration.intents?.core?createApprovalMetadataReadback({metadata:createPostgresApprovalMetadataReader({pool}),store,retention:retention?.gate,now,maxRequestMs:configuration.limits.requestMs}):null;
 const products=createRuntimeProductApplications({configuration,sessions,ports,now,conversationStore:store,userPreferences,...(retention?{retention:retention.gate,managementSuppression:retention.startup.suppression,deletionStatus:retention.startup.deletionStatus,suppression:{journal:retention.journal,serving:retention.serving}}:{})});
 // Composed intents need their journal table; a disabled family adds no table, so first-chat readiness is unchanged.
 const intentTables=Object.freeze([...(ports.intentApplication?['meri_intents.preparations','meri_commands.approval_metadata']:selected?['meri_intents.preparations','meri_commands.approval_metadata']:nativeIntentsEnabled?['meri_intents.preparations',...(configuration.intents.core?['meri_commands.approval_metadata']:[])]:[]),...(ports.actionApplicationFactory?.state()==='composed'?['meri_task_lookup.lookups','meri_task_lookup.events']:[])]);
 const uploadTables=Object.freeze(ports.uploadApplicationFactory?.state()==='composed'?['meri_uploads.originals']:[]);
 const memoryTables=ports.memoryApplication?MEMORY_TABLES:Object.freeze([]);
 if(!injectedTurnTelemetry)turnTelemetry.start();
 const office=composeOffice({configuration,office:compileOfficeConfiguration(configuration),ports,sessions,retention,now,material:officeMaterial});
 return Object.freeze({service,store,sessions,retention,office,objectiveReadback,approvalMetadataReadback,userPreferences,intentTables,memoryTables,uploadTables,browserCustody,browserReceipts,...(browserHosts?{browserHosts}:{}),productReadiness:()=>productReadiness({ports,retention,memoryRetentionBound,sourceEnabled:configuration.sourceEnabled,userPreferences:userPreferences.state()}),downloads:products.downloads,application:{handle:request=>turnTelemetry.provisional(()=>{if(new URL(request.url).pathname==='/api/outreach-generation/start')return outreachStart?.handle(request)??new Response(null,{status:404});const product=products.handle(request);if(product!==null)return product;const path=new URL(request.url).pathname;return path.startsWith('/api/meri/browser/')?browserViewer.handle(request):path==='/api/action-followthrough/browser-session'?browserIssuance.handle(request):Object.values(RUNNER_INTENT_PATHS).includes(path)?nativeIntents.handle(request):path==='/api/action-followthrough/session'?issuance.handle(request):path==='/api/conversations/input/admit'?input.handle(request):path===conversationInitialInputMetadata.routes.allocate.path?initialInput.handle(request):path.startsWith('/internal/')?worker.handle(request):conversation.handle(request);})},async close(){try{await office?.close();await browserHosts?.close();await selected?.close();}finally{userPreferences.close();if(!injectedTurnTelemetry)turnTelemetry.close();await sessions.close();}}});
 }catch(error){throw Object.assign(error,{controlCleanup:ownedCleanup()});}
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
 let pool,connection,listener,privateListener,assembly,candidate,closing,telemetry,uploadsNative;
 const checkAuthorization=()=>{fence.check();signal.throwIfAborted();};
 const close=()=>closing??=(async()=>{fence.lose('RUNTIME_STOPPING');readCredentialRelay?.close();memoryContextRelay?.close();occurrenceRelay?.close();externalSignal?.removeEventListener('abort',onExternalAbort);const results=[];for(const method of [()=>listener?.close(),()=>privateListener?.close(),()=>candidate?.close(),()=>assembly?.browserHosts?.close(),()=>assembly?.close(),()=>uploadsNative?.inspection?.close?.(),()=>connection?.close(),()=>pool?.end(),()=>telemetry?.close(),()=>{if(!injectedTurnTelemetry)turnTelemetry.close();}])try{results.push({status:'fulfilled',value:await method()});}catch(reason){results.push({status:'rejected',reason});}assertTemporalRuntimeCleanup(results);})();
 try{
  signal?.throwIfAborted();
  // Declared telemetry starts first and closes last so every request span is flushed; the SDK is loaded only when enabled.
  if(configuration.telemetry?.enabled===true){const {startControlTelemetry}=await import('./telemetry/index.mjs');telemetry=startControlTelemetry({configuration});}
  signal?.throwIfAborted();
  const [connectionBytes,capabilityBytes,tls]=await Promise.all([(owners.readMaterial??readSecret)(configuration.database.connectionFile),(owners.readMaterial??readSecret)(configuration.native.capabilityFile),(owners.tls??temporalTls)(configuration.temporal.tls)]);checkAuthorization();
  signal?.throwIfAborted();
  // Declared browser hosts need their own protected client/server material before assembly; a declared
  // reference that cannot be read refuses startup here instead of composing a half-wired family.
  // Compiled once, at the actual caller: enabled:false is absent (no tls access at all), and a declared
  // but unreadable reference refuses startup before any listener opens.
  const browserHostDeclaration=compileBrowserHostConfiguration(configuration);
  const browserHostMaterial=browserHostDeclaration===null?undefined:await readBrowserHostMaterial(browserHostDeclaration,owners.readMaterial??readSecret);
  checkAuthorization();
  const connectionString=connectionBytes.toString('utf8').trim();let u;try{u=new URL(connectionString);}catch{throw fault('DATABASE_CONFIGURATION');}
  // URL.get() selects the first duplicate; pg's adopted parser selects the
  // last. Accept one closed TLS parameter before either client is allocated.
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hash||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='verify-full'||[...u.searchParams.keys()].some(key=>key!=='sslmode'))throw fault('DATABASE_CONFIGURATION');
  pool=countingPool((owners.createPool??(options=>new Pool(options)))({connectionString,max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs}),turnTelemetry);
  connection=await (owners.connect??(options=>Connection.connect(options)))({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs});checkAuthorization();signal?.throwIfAborted();const client=(owners.createClient??(options=>new Client(options)))({connection,namespace:configuration.temporal.namespace});
  candidate=await (owners.startCandidate??startAgentCoreCandidate)({configuration,pool,signal,turnTelemetry,controlCredential:capabilityBytes.toString('utf8').trim(),nativeCredentials:readCredentialRelay.port,...(getCoreServiceSecret?{getCoreServiceSecret}:{}),...(createReadsRuntime===undefined?{}:{createReadsRuntime})});
  let native=candidate.native;routinesCandidateBinder?.(candidate);const unfencedNative=native;native=Object.freeze({...native,async call(operation,input,{signal:requestSignal}={}){if(operation==='execution/kickoff/stop')return unfencedNative.call(operation,input,{signal:requestSignal});fence.check();const joined=requestSignal?AbortSignal.any([requestSignal,fence.signal]):fence.signal;return unfencedNative.call(operation,input,{signal:joined});}});
  // Native upload inspection is an opt-in, server-owned declaration mounted under the bounded startup budget. An
  // unattested or failed host leaves the uploads family honestly unavailable and disables no other product. The
  // handle is declared with the other closables above, because a remote mount owns an SDK client that shutdown must
  // destroy -- and it stays undefined until the mount resolves, so a startup failure closes nothing it never created.
  uploadsNative=configuration.uploads?.native?.enabled===true?await mountUploadNativeControl({configuration,now:Date.now,signal,deadlineMs:Date.now()+Math.min(configuration.limits.startupMs,UPLOAD_NATIVE_MOUNT_MS)}):null;
  checkAuthorization();if(configuration.uploads?.native?.enabled===true&&uploadsNative.missing.length)process.stderr.write(JSON.stringify({event:UPLOAD_NATIVE_UNAVAILABLE_EVENT,missing:uploadsNative.missing})+'\n');
  const officeDeclared=compileOfficeConfiguration(configuration);
  const officeMaterial=officeDeclared?.enabled===true?await prepareOfficeMaterial({configuration,office:officeDeclared,signal,readMaterial:owners.readMaterial??readSecret}):null;
  assembly=(owners.assemble??assembleControl)({configuration,pool,client,native,execution:candidate.execution,createReadsRuntime,readCapabilityRole:candidate.readCapabilityRole,turnTelemetry,...(candidate.workerModelPolicy?{workerModelPolicy:candidate.workerModelPolicy}:{}),...(telemetry?{telemetry}:{}),...mounted,...(uploadsNative?{uploadsNative}:{}),...(browserHostMaterial?{browserHostMaterial}:{}),...(browserHostDeclaration?{browserHostDeclaration}:{}),...(candidate?{canonicalProductPorts:candidate.productPorts}:{}),...(officeMaterial?{officeMaterial}:{})});candidate?.bindApplication({...fence.wrap(assembly.application),sweepRetention:input=>{checkAuthorization();if(typeof assembly.retention?.sweep!=='function')throw fault('EXECUTION_STORE_UNAVAILABLE');return assembly.retention.sweep({...input,signal:input.signal?AbortSignal.any([input.signal,fence.signal]):fence.signal});}});
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
  // MB-05 producer events: the private listener mounts the real receiver over the same existing owners (schedule
  // owner, conversation store, canonical scheduled-dispatch, Core wire C). A mount that cannot be composed leaves
  // the two fixed routes 404 — fail closed — never a half-wired receiver, and never a new dispatcher or bearer.
  const sourceEvents=composeSourceEventMount({configuration,pool,client,candidate});
  if(sourceEvents===null&&configuration.privateHttp!==undefined)process.stderr.write(JSON.stringify({event:'runtime.source.events.unavailable'})+'\n');
  // The Workspace generation leaf drives the existing conversation owner for one Workspace phase. It is
  // composed only with the Core service secret (transport) — the turn itself always requires the current
  // identity credential — so an undeclared secret leaves the private route absent rather than open.
  // Its clock is this startup's own (startControl binds no `now`; the same `now:Date.now` is used by the
  // uploads mount below), and its observation window never exceeds the configured request budget: the leaf's
  // own runtime already clamps to the operation deadline, so a smaller (still valid) requestMs must not
  // refuse composition of an optional route.
  const workspaceGeneration=getCoreServiceSecret?createWorkspaceGenerationApplication({sessions:assembly.sessions,service:assembly.service,getServiceSecret:getCoreServiceSecret,now:Date.now,maxRequestMs:configuration.limits.requestMs,observeMs:Math.min(workspaceGenerationLimits.observeMs,configuration.limits.requestMs)}):null;
  const retentionWitness=getCoreServiceSecret&&assembly.retention?createRetentionWitnessApplication({startup:assembly.retention.startup,getServiceSecret:getCoreServiceSecret,maxRequestMs:Math.min(configuration.limits.requestMs,10000)}):null;
  const separated=configuration.privateHttp===undefined?null:createControlRouteApplications({assembly:assembly.application,candidate:candidate?.application,objectiveReader,approvalMetadataReader,objectiveRuns:objectiveRuns.application,objectiveStart,routinesOccurrences:routinesOccurrences.application,sourceEvents,workspaceGeneration,retentionWitness,office:assembly.office?.application??null});
  const publicApplication=fence.wrap(separated?.public??mountedApplication),application=telemetry?telemetry.instrumentApplication(publicApplication):publicApplication;
  const privateApplication=separated===null?null:telemetry?telemetry.instrumentApplication(fence.wrap(separated.private)):fence.wrap(separated.private);
  async function readiness({signal}){fence.check();signal?.throwIfAborted();await pool.query("SELECT to_regclass('meri_conversations.runs') AS runs, to_regclass('meri_conversations.events') AS events, to_regclass('meri_conversations.controls') AS controls, to_regclass('meri_conversations.selected_outputs') AS selected_outputs, to_regclass('meri_conversations.initial_inputs') AS initial_inputs").then(result=>{if(!result.rows[0]||typeof result.rows[0].initial_inputs!=='string'||Object.values(result.rows[0]).some(v=>v===null))throw fault('DATABASE_SCHEMA_UNAVAILABLE');});
   // Declared retention serving needs its projections present and a recovered watermark: a fenced or stale projection is reconciled from
   // the ledger here before serving, and a missing dependency is exposed, never bypassed.
   if(objectiveRuns.tables.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[objectiveRuns.tables]);if(r.rows.length!==objectiveRuns.tables.length||r.rows.some(row=>row.relation===null))throw fault('OBJECTIVE_SCHEMA_UNAVAILABLE');}
   if(routinesOccurrences.tables.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[routinesOccurrences.tables]);if(r.rows.length!==routinesOccurrences.tables.length||r.rows.some(row=>row.relation===null))throw fault('ROUTINES_SCHEMA_UNAVAILABLE');}
   if(assembly.intentTables?.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.intentTables]);if(r.rows.length!==assembly.intentTables.length||r.rows.some(row=>row.relation===null))throw fault('INTENTS_SCHEMA_UNAVAILABLE');}
   if(assembly.memoryTables?.length)await assertMemoryRetentionSchema(pool);
   if(assembly.uploadTables?.length){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.uploadTables]);if(r.rows.length!==assembly.uploadTables.length||r.rows.some(row=>row.relation===null))throw fault('UPLOAD_SCHEMA_UNAVAILABLE');}
   if(memoryContextRelay!==undefined){const r=await pool.query("SELECT to_regclass('meri_conversations.memory_proposal_contexts') AS relation");if(typeof r.rows[0]?.relation!=='string')throw fault('MEMORY_CONTEXT_SCHEMA_UNAVAILABLE');}
   if(assembly.retention){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.retention.tables]);if(r.rows.length!==assembly.retention.tables.length||r.rows.some(row=>row.relation===null))throw fault('RETENTION_SCHEMA_UNAVAILABLE');await assembly.retention.startup.ensureServing();}await connection.withDeadline(Date.now()+configuration.limits.requestMs,()=>signal?connection.withAbortSignal(signal,()=>connection.workflowService.describeNamespace({namespace:configuration.temporal.namespace})):connection.workflowService.describeNamespace({namespace:configuration.temporal.namespace}));await native.readiness({signal});await assembly.userPreferences.readiness({signal});signal?.throwIfAborted();return {product:assembly.productReadiness()};}
  // The shared host-currentness listener is up before any public route accepts a request, and it is
  // registered as an owned closable above so a later startup failure, cancellation or shutdown retires it.
  if(assembly.browserHosts)await assembly.browserHosts.start({signal});checkAuthorization();
  await readiness({signal});({publicListener:listener,privateListener}=await listenControlApplications({configuration,publicApplication:application,privateApplication,readiness,signal:candidate?undefined:externalSignal,listen:owners.listen??listenRuntime,checkStartup:checkAuthorization}));
  // The one bounded provisioning attempt runs after listen under its own declared absolute deadline: started, never
  // awaited, not a timer, daemon or job, and aborted by closing CONTROL through the runtime fence. No retry, no loop;
  // an integrity or teardown condition is never re-provisioned as though it were merely stale.
  const uploadProvisioning=beginUploadNativeProvisioning({handle:uploadsNative,configuration,now:Date.now,signal});
  checkAuthorization();return Object.freeze({address:listener.address,...(privateListener?{privateAddress:privateListener.address}:{}),downloads,...(uploadsNative?{uploadNative:Object.freeze({missing:uploadsNative.missing,provisioning:uploadProvisioning.state})}:{}),close});
 }catch(error){
  // Every owned cleanup runs even when an earlier one fails: the failures are accumulated, never allowed
  // to skip the remaining pool/Temporal/candidate teardown.
  const cleanupFailures=[];
  if(typeof error?.controlCleanup?.then==='function')try{await error.controlCleanup;}catch(cleanup){cleanupFailures.push(cleanup);}
  try{await close();}catch(cleanup){cleanupFailures.push(cleanup);}
  if(cleanupFailures.length)throw temporalCleanupUnknown(new AggregateError([error,...cleanupFailures],'CONTROL_STARTUP_AND_CLEANUP_FAILED'));
  if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;
  throw Object.assign(fault('CONTROL_STARTUP_FAILED'),{cause:error});}
}
