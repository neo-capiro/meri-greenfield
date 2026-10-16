/** Trusted control composition. Single preview replica; source connectivity disabled. */
import {Pool} from 'pg';
import {Connection,Client} from '@temporalio/client';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {createConversationService} from '../control/conversations/service.mjs';
import {createConversationApplication} from '../control/conversations/http.mjs';
import {createTemporalConversationDispatcher} from '../control/conversations/temporal-dispatch.mjs';
import {createActionSessionOwner} from '../control/action-host/session/owner.mjs';
import {createActionSessionApplication} from '../control/action-host/session/http.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {readSecret,fault} from './config.mjs';
import {createTemporalAuthorization,createTemporalTokenFileReader} from './temporal-authorization.mjs';
import {listenRuntime} from './http-server.mjs';
import {createWorkerRunApplication} from './worker-http.mjs';
import {createConversationLifecycleService} from '../control/conversations/lifecycle/service.mjs';
import {createConversationLifecycleApplication} from '../control/conversations/lifecycle/http.mjs';
import {createConversationInputApplication} from '../control/conversations/input/http.mjs';
import {createConversationInitialInputApplication} from '../control/conversations/initial-input/http.mjs';
import {conversationInitialInputMetadata} from '../../packages/contracts/conversation-initial-input/protocol.mjs';
import {captureRuntimePorts,composeRuntimePorts,createRuntimeProductApplications,readRuntimeArtifactRecovery} from './product-applications.mjs';
import {productReadiness} from './product-readiness.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {createPostgresIssuanceStore} from './prepared-run-issuance-postgres.mjs';
import {createFileCapabilityAuthority} from './capability-material-authority.mjs';
import {createPostgresModelGrants} from './model-grant-issuer.mjs';
import {createPostgresRetentionJournal} from '../control/retention/postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../control/retention/postgres-watermark.mjs';
import {createRetentionStartup} from '../control/retention/startup.mjs';
import {createArtifactRecoveryBinding} from './artifacts/recovery-binding.mjs';
import {types} from 'node:util';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {captureReadRuntimeOptions} from './native-authority/prepared-reads.mjs';
function productBinding(options){
 const c=own(options,[],['productPorts','productPortsFactory']);
 if(c.productPorts!==undefined&&c.productPortsFactory!==undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
 const factory=c.productPortsFactory;
 if(factory!==undefined&&(typeof factory!=='function'||types.isProxy(factory)||types.isAsyncFunction(factory)||types.isGeneratorFunction(factory)))throw fault('PRODUCT_PORTS_CONFIGURATION');
 return factory===undefined?{ports:captureRuntimePorts(c.productPorts)}:{factory};
}
/** Optional trusted-client authorization (S4): one token provider for the client (apiKey callback) and the worker (setApiKey). */
export async function temporalAuthorization(configuration,{signal}={}){if(configuration.temporal.authorization===undefined)return null;const c=configuration.temporal.authorization,authorization=createTemporalAuthorization({configuration:c,reader:createTemporalTokenFileReader({tokenFile:c.tokenFile})});await authorization.refresh({signal});return authorization;}
export async function temporalTls(config){const [serverRootCACertificate,crt,key]=await Promise.all([readSecret(config.caFile),readSecret(config.certFile),readSecret(config.keyFile)]);return {serverRootCACertificate,clientCertPair:{crt,key}};}
/** Retention serving over the control database (migrations conversations 0010 and artifacts 0002, plus the proposed recovered-watermark
 * table), composed only when the configuration declares it: the retention startup owner with its serving fence closed until a
 * reconciliation over the authoritative ledger (the trusted `retentionLedgerSink` port) records a watermark that reads back. Purge
 * is composed explicitly disabled; no deletion owner exists in control. */
export function retentionGate(configuration,pool,ports={},binding=null,now=Date.now){
 if(configuration.retention===undefined)return null;const journal=binding?.context.journal??createPostgresRetentionJournal({pool,now}),recovery=binding??createArtifactRecoveryBinding({journal}),captured=captureRuntimePorts(ports),required=captured.configuredOwners.some(name=>['artifactOptionsOwner','artifactStore'].includes(name));
 const recoverPrerequisitesExclusive=recovery.configure(readRuntimeArtifactRecovery(captured),required);
 const startup=createRetentionStartup({journal,watermark:createPostgresWatermarkStore({journal}),ledgerSink:captured.retentionLedgerSink??null,purge:{enabled:false},now,recoverPrerequisitesExclusive});
 recovery.bindRetention(startup.gate);
 return Object.freeze({serving:startup.serving,journal:startup.journal,gate:startup.gate,startup,artifactRecovery:recovery.state,tables:['meri_conversations.retention_subjects','meri_conversations.retention_purges','meri_conversations.retention_purge_targets','meri_artifacts.retention_subjects','meri_artifacts.retention_purges','meri_conversations.retention_recovery_watermark']});
}
export function assembleControl(options){
 const {configuration,pool,client,native,now=Date.now,telemetry,canonicalProductPorts,...binding}=own(options,['configuration','pool','client','native'],['now','telemetry','canonicalProductPorts','productPorts','productPortsFactory']);
 if(telemetry!==undefined&&typeof telemetry?.observeRunOwner!=='function')throw fault('TELEMETRY_CONFIGURATION');
 const captured=productBinding(binding),canonical=captureRuntimePorts(canonicalProductPorts);
 const artifactRecovery=configuration.retention===undefined?null:createArtifactRecoveryBinding({journal:createPostgresRetentionJournal({pool,now})});
 let supplied;
 if(captured.factory){
  supplied=Reflect.apply(captured.factory,undefined,[Object.freeze({configuration,pool,native,now,canonicalProductPorts:canonical,...(artifactRecovery?{artifactRecovery:artifactRecovery.context}:{})})]);
  if(supplied===undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
  // Ordinary functions can still return a rejected Promise. Consume only native
  // Promise rejection while refusing it; never inspect or execute then getters.
  if(types.isPromise(supplied)){Promise.prototype.then.call(supplied,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
 }
 const ports=composeRuntimePorts(canonical,captured.factory?captureRuntimePorts(supplied):captured.ports);
 if(ports.transitionAuthority&&typeof ports.identityContext.resolveTransitionContext!=='function')throw fault('PRODUCT_PORTS_CONFIGURATION');
 const retention=retentionGate(configuration,pool,ports,artifactRecovery,now);
 const store=createPostgresConversationStore({pool,now,...(ports.transitionAuthority?{transitionAuthority:ports.transitionAuthority}:{})});
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:ports.identityContext.verifyIdentity,resolveContext:ports.identityContext.resolveContext,now,...(ports.transitionAuthority?{
  readTransition:({signal,...input})=>store.lifecycle.readTransition({...input,signal},()=>signal?.throwIfAborted()),
  resolveTransitionContext:ports.identityContext.resolveTransitionContext,
 }:{}),limits:{maxSessions:configuration.sessions.maxSessions,maxRequestMs:configuration.limits.requestMs,maxTtlMs:configuration.sessions.maxTtlMs,maxFactBytes:131072}});
 const dispatcher=createTemporalConversationDispatcher({client,taskQueue:configuration.temporal.taskQueue,lifecycle:true,now,maxRequestMs:configuration.limits.requestMs});
 const basic=createConversationService({sessions,store,dispatcher,versions:configuration.versions,now,maxRequestMs:configuration.limits.requestMs,...(ports.selectedSkillAdmission?{selectedSkillAdmission:ports.selectedSkillAdmission}:{}),...(ports.selectedOutputPublication?{selectedOutputPublication:ports.selectedOutputPublication}:{}),...(retention?{retention:retention.gate}:{})});
 const port=operation=>({signal,...input})=>native.call(operation,input,{signal});
 const service=createConversationLifecycleService({service:basic,store,dispatcher,sessions,now,maxRequestMs:configuration.limits.requestMs,checkpoints:{read:port('checkpoint/read')},nativeAdmission:ports.continuationAdmission,approvals:ports.approvals});
 const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),input=createConversationInputApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),initialInput=createConversationInitialInputApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:Math.min(configuration.limits.requestMs,conversationInitialInputMetadata.limits.maxRequestMs)}),issuance=createActionSessionApplication({owner:sessions,now,maxRequestMs:configuration.limits.requestMs}),worker=createWorkerRunApplication({service:telemetry?telemetry.observeRunOwner(service):service,sessions,native,configuration,now});
 const products=createRuntimeProductApplications({configuration,sessions,ports,now,conversationStore:store,...(retention?{retention:retention.gate,suppression:{journal:retention.journal,serving:retention.serving}}:{})});
 return Object.freeze({service,store,sessions,retention,productReadiness:()=>productReadiness({ports,retention,sourceEnabled:configuration.sourceEnabled}),downloads:products.downloads,application:{handle:request=>{const product=products.handle(request);if(product!==null)return product;const path=new URL(request.url).pathname;return path==='/api/action-followthrough/session'?issuance.handle(request):path==='/api/conversations/input/admit'?input.handle(request):path===conversationInitialInputMetadata.routes.allocate.path?initialInput.handle(request):path.startsWith('/internal/')?worker.handle(request):conversation.handle(request);}},close:()=>sessions.close()});
}
/** Multi-run owners composed only by trusted startup (never named in configuration): the durable issuance store over the control
 * database (migration 0011) and the file-backed capability-material authority under the configured owner-only directory. A declared
 * multi-run mode without the material directory composes no authority, so the bindings refuse readiness (PREPARED_RUN_BINDINGS_UNAVAILABLE). */
export function multiRunOwners(configuration,pool){
 const multi=configuration.nativeCandidate?.multiRun;if(multi===undefined)return {};
 return {issuanceStore:createPostgresIssuanceStore({pool}),...(multi.materialDirectory!==undefined?{capabilityAuthority:createFileCapabilityAuthority({directory:multi.materialDirectory}),modelGrants:createPostgresModelGrants({pool,taskMaterialDirectory:multi.materialDirectory,maxRequestMs:configuration.limits.requestMs})}:{})};
}
export async function startControl(configuration,options={}){
 // Validate compiled bindings before secret reads, connections or owned allocation.
 const {signal,createReadsRuntime,generalReads,...binding}=own(options,[],['signal','productPorts','productPortsFactory','createReadsRuntime','generalReads']);nativeSignal(signal);const compiled=productBinding(binding),reads=captureReadRuntimeOptions({...(createReadsRuntime===undefined?{}:{createReadsRuntime}),...(generalReads===undefined?{}:{generalReads})});
 if(configuration.nativeCandidate===undefined&&Object.keys(reads).length)throw fault('PREPARED_CANDIDATE_CONFIGURATION');
 if(configuration.nativeCandidate!==undefined){compilePreparedCandidateConfiguration(configuration.nativeCandidate,configuration.versions);if(configuration.native.capabilityFile!==configuration.nativeCandidate.controlCapabilityFile)throw fault('PREPARED_CANDIDATE_CONFIGURATION');}
 const mounted=compiled.factory?{productPortsFactory:compiled.factory}:{productPorts:compiled.ports};
 let pool,connection,listener,assembly,candidate,closing,authorization,telemetry;const close=()=>closing??=(async()=>{const errors=[];for(const method of [()=>candidate?.close(),()=>listener?.close(),()=>assembly?.close(),()=>connection?.close(),()=>authorization?.close(),()=>pool?.end(),()=>telemetry?.close()])try{await method();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'CONTROL_CLEANUP_UNKNOWN');})();
 try{
  signal?.throwIfAborted();
  // Declared telemetry starts first and closes last so every request span is flushed; the SDK is loaded only when enabled.
  if(configuration.telemetry?.enabled===true){const {startControlTelemetry}=await import('./telemetry/index.mjs');telemetry=startControlTelemetry({configuration});}
  signal?.throwIfAborted();
  const [connectionBytes,capabilityBytes,tls]=await Promise.all([readSecret(configuration.database.connectionFile),readSecret(configuration.native.capabilityFile),temporalTls(configuration.temporal.tls)]);authorization=await temporalAuthorization(configuration,{signal});
  signal?.throwIfAborted();
  const connectionString=connectionBytes.toString('utf8').trim();let u;try{u=new URL(connectionString);}catch{throw fault('DATABASE_CONFIGURATION');}
  // URL.get() selects the first duplicate; pg's adopted parser selects the
  // last. Accept one closed TLS parameter before either client is allocated.
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hash||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='verify-full'||[...u.searchParams.keys()].some(key=>key!=='sslmode'))throw fault('DATABASE_CONFIGURATION');
  pool=new Pool({connectionString,max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs});
  connection=await Connection.connect({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs,...(authorization?{apiKey:()=>authorization.apiKey()}:{})});signal?.throwIfAborted();const client=new Client({connection,namespace:configuration.temporal.namespace});
  let native=createNativeCapabilityClient({configuration:configuration.native,credential:capabilityBytes.toString('utf8').trim()});signal?.throwIfAborted();if(configuration.nativeCandidate!==undefined){const {startPreparedCandidate}=await import('./prepared-candidate.mjs');candidate=await startPreparedCandidate({configuration,pool,signal,...multiRunOwners(configuration,pool),...reads});if(candidate.controlCapabilitySha256!==capabilityDigest(capabilityBytes.toString('utf8').trim()))throw fault('PREPARED_CANDIDATE_CONFIGURATION');native=candidate.native;}assembly=assembleControl({configuration,pool,client,native,...(telemetry?{telemetry}:{}),...mounted,...(candidate?{canonicalProductPorts:candidate.productPorts}:{})});candidate?.bindApplication(assembly.application);
  // The download-link gate opens only after its owners verify; a closed gate leaves every other route as composed.
  const downloads=await assembly.downloads.open({signal});signal?.throwIfAborted();const mountedApplication=candidate?{async handle(request){return (await candidate.application.handle(request))??assembly.application.handle(request);}}:assembly.application,application=telemetry?telemetry.instrumentApplication(mountedApplication):mountedApplication;
  async function readiness({signal}){signal?.throwIfAborted();if(authorization&&!authorization.healthy())throw fault('TEMPORAL_AUTHORIZATION_UNAVAILABLE');await pool.query("SELECT to_regclass('meri_conversations.runs') AS runs, to_regclass('meri_conversations.events') AS events, to_regclass('meri_conversations.controls') AS controls, to_regclass('meri_conversations.selected_outputs') AS selected_outputs, to_regclass('meri_conversations.initial_inputs') AS initial_inputs").then(result=>{if(!result.rows[0]||typeof result.rows[0].initial_inputs!=='string'||Object.values(result.rows[0]).some(v=>v===null))throw fault('DATABASE_SCHEMA_UNAVAILABLE');});
   // Declared retention serving needs its projections present and a recovered watermark: a fenced or stale projection is reconciled from
   // the ledger here before serving, and a missing dependency is exposed, never bypassed.
   if(assembly.retention){const r=await pool.query('SELECT name,to_regclass(name) AS relation FROM unnest($1::text[]) AS names(name)',[assembly.retention.tables]);if(r.rows.length!==assembly.retention.tables.length||r.rows.some(row=>row.relation===null))throw fault('RETENTION_SCHEMA_UNAVAILABLE');await assembly.retention.startup.ensureServing();}await connection.withDeadline(Date.now()+configuration.limits.requestMs,()=>signal?connection.withAbortSignal(signal,()=>connection.workflowService.getSystemInfo({})):connection.workflowService.getSystemInfo({}));await native.readiness({signal});signal?.throwIfAborted();return {product:assembly.productReadiness()};}
  await readiness({signal});listener=await listenRuntime({configuration,application,readiness,...(candidate?{}:{signal})});return Object.freeze({address:listener.address,downloads,close});
 }catch(error){await close().catch(()=>{});throw Object.assign(fault('CONTROL_STARTUP_FAILED'),{cause:error});}
}
