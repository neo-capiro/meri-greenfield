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
import {listenRuntime} from './http-server.mjs';
import {createWorkerRunApplication} from './worker-http.mjs';
import {createConversationLifecycleService} from '../control/conversations/lifecycle/service.mjs';
import {createConversationLifecycleApplication} from '../control/conversations/lifecycle/http.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from './product-applications.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {compilePreparedCandidateConfiguration} from './prepared-candidate-config.mjs';
import {types} from 'node:util';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
function productBinding(options){
 const c=own(options,[],['productPorts','productPortsFactory']);
 if(c.productPorts!==undefined&&c.productPortsFactory!==undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
 const factory=c.productPortsFactory;
 if(factory!==undefined&&(typeof factory!=='function'||types.isProxy(factory)||types.isAsyncFunction(factory)||types.isGeneratorFunction(factory)))throw fault('PRODUCT_PORTS_CONFIGURATION');
 return factory===undefined?{ports:captureRuntimePorts(c.productPorts)}:{factory};
}
function resolveProductPorts(captured,context,identityContext){
 let supplied;
 if(captured.factory){
  supplied=Reflect.apply(captured.factory,undefined,[Object.freeze(context)]);
  if(supplied===undefined)throw fault('PRODUCT_PORTS_CONFIGURATION');
  // Refuse native Promises without inspecting hostile then getters.
  if(types.isPromise(supplied)){Promise.prototype.then.call(supplied,undefined,()=>{});throw fault('PRODUCT_PORTS_CONFIGURATION');}
 }
 const ports=captured.factory?captureRuntimePorts(supplied):captured.ports;
 return identityContext===undefined?ports:captureRuntimePorts({...ports,identityContext});
}
export async function temporalTls(config){const [serverRootCACertificate,crt,key]=await Promise.all([readSecret(config.caFile),readSecret(config.certFile),readSecret(config.keyFile)]);return {serverRootCACertificate,clientCertPair:{crt,key}};}
export function assembleControl(options){
 const {configuration,pool,client,native,now=Date.now,...binding}=own(options,['configuration','pool','client','native'],['now','productPorts','productPortsFactory']);
 const captured=productBinding(binding);
 const ports=resolveProductPorts(captured,{configuration,pool,native,now});
 const sessions=createActionSessionOwner({mode:'process-local',...ports.identityContext,now,limits:{maxSessions:configuration.sessions.maxSessions,maxRequestMs:configuration.limits.requestMs,maxTtlMs:configuration.sessions.maxTtlMs,maxFactBytes:131072}});
 const store=createPostgresConversationStore({pool}),dispatcher=createTemporalConversationDispatcher({client,taskQueue:configuration.temporal.taskQueue,lifecycle:true});
 const basic=createConversationService({sessions,store,dispatcher,versions:configuration.versions,now,maxRequestMs:configuration.limits.requestMs,...(ports.selectedSkillAdmission?{selectedSkillAdmission:ports.selectedSkillAdmission}:{}),...(ports.selectedOutputPublication?{selectedOutputPublication:ports.selectedOutputPublication}:{})});
 const port=operation=>({signal,...input})=>native.call(operation,input,{signal});
 const service=createConversationLifecycleService({service:basic,store,dispatcher,sessions,now,maxRequestMs:configuration.limits.requestMs,checkpoints:{read:port('checkpoint/read')},nativeAdmission:ports.nativeAdmission??{admit:port('continuation/admit'),retire:port('continuation/retire')},approvals:ports.approvals??{read:port('approval/read'),readDecision:port('approval/decision')}});
 const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),issuance=createActionSessionApplication({owner:sessions,now,maxRequestMs:configuration.limits.requestMs}),worker=createWorkerRunApplication({service,sessions,native,configuration,now});
 const products=createRuntimeProductApplications({configuration,sessions,ports,now});
 return Object.freeze({service,store,sessions,application:{handle:request=>{const product=products.handle(request);if(product!==null)return product;const path=new URL(request.url).pathname;return path==='/api/action-followthrough/session'?issuance.handle(request):path.startsWith('/internal/')?worker.handle(request):conversation.handle(request);}},close:()=>sessions.close()});
}
export async function startControl(configuration,options={}){
 // Validate compiled bindings before secret reads, connections or owned allocation.
 const {signal,...binding}=own(options,[],['signal','productPorts','productPortsFactory']);nativeSignal(signal);const compiled=productBinding(binding);
 if(configuration.nativeCandidate!==undefined){compilePreparedCandidateConfiguration(configuration.nativeCandidate,configuration.versions);if(configuration.native.capabilityFile!==configuration.nativeCandidate.controlCapabilityFile)throw fault('PREPARED_CANDIDATE_CONFIGURATION');}
 let pool,connection,listener,assembly,candidate,closing;const close=()=>closing??=(async()=>{const errors=[];for(const method of [()=>candidate?.close(),()=>listener?.close(),()=>assembly?.close(),()=>connection?.close(),()=>pool?.end()])try{await method();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'CONTROL_CLEANUP_UNKNOWN');})();
 try{
  signal?.throwIfAborted();
  const [connectionBytes,capabilityBytes,tls]=await Promise.all([readSecret(configuration.database.connectionFile),readSecret(configuration.native.capabilityFile),temporalTls(configuration.temporal.tls)]);
  signal?.throwIfAborted();
  const connectionString=connectionBytes.toString('utf8').trim();let u;try{u=new URL(connectionString);}catch{throw fault('DATABASE_CONFIGURATION');}
  // URL.get() selects the first duplicate; pg's adopted parser selects the
  // last. Accept one closed TLS parameter before either client is allocated.
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hash||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='verify-full'||[...u.searchParams.keys()].some(key=>key!=='sslmode'))throw fault('DATABASE_CONFIGURATION');
  pool=new Pool({connectionString,max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs});
  connection=await Connection.connect({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs});signal?.throwIfAborted();const client=new Client({connection,namespace:configuration.temporal.namespace});
  let native=createNativeCapabilityClient({configuration:configuration.native,credential:capabilityBytes.toString('utf8').trim()});signal?.throwIfAborted();if(configuration.nativeCandidate!==undefined){const {startPreparedCandidate}=await import('./prepared-candidate.mjs');candidate=await startPreparedCandidate({configuration,pool,signal});if(candidate.controlCapabilitySha256!==capabilityDigest(capabilityBytes.toString('utf8').trim()))throw fault('PREPARED_CANDIDATE_CONFIGURATION');native=candidate.native;}assembly=assembleControl({configuration,pool,client,native,productPorts:resolveProductPorts(compiled,{configuration,pool,native,now:Date.now},candidate?.identityContext)});candidate?.bindApplication(assembly.application);const application=candidate?{async handle(request){return (await candidate.application.handle(request))??assembly.application.handle(request);}}:assembly.application;
  async function readiness({signal}){signal?.throwIfAborted();await pool.query("SELECT to_regclass('meri_conversations.runs') AS runs, to_regclass('meri_conversations.events') AS events, to_regclass('meri_conversations.controls') AS controls, to_regclass('meri_conversations.selected_outputs') AS selected_outputs").then(result=>{if(!result.rows[0]||Object.values(result.rows[0]).some(v=>v===null))throw fault('DATABASE_SCHEMA_UNAVAILABLE');});await connection.withDeadline(Date.now()+configuration.limits.requestMs,()=>signal?connection.withAbortSignal(signal,()=>connection.workflowService.getSystemInfo({})):connection.workflowService.getSystemInfo({}));await native.readiness({signal});signal?.throwIfAborted();}
  await readiness({signal});listener=await listenRuntime({configuration,application,readiness,...(candidate?{}:{signal})});return Object.freeze({address:listener.address,close});
 }catch{await close();throw fault('CONTROL_STARTUP_FAILED');}
}
