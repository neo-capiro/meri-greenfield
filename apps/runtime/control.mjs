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
export async function temporalTls(config){const [serverRootCACertificate,crt,key]=await Promise.all([readSecret(config.caFile),readSecret(config.certFile),readSecret(config.keyFile)]);return {serverRootCACertificate,clientCertPair:{crt,key}};}
export function assembleControl({configuration,pool,client,native,now=Date.now}){
 const sessions=createActionSessionOwner({mode:'process-local',verifyIdentity:native.verifyIdentity,resolveContext:native.resolveContext,now,limits:{maxSessions:configuration.sessions.maxSessions,maxRequestMs:configuration.limits.requestMs,maxTtlMs:configuration.sessions.maxTtlMs,maxFactBytes:131072}});
 const store=createPostgresConversationStore({pool}),dispatcher=createTemporalConversationDispatcher({client,taskQueue:configuration.temporal.taskQueue,lifecycle:true});
 const basic=createConversationService({sessions,store,dispatcher,versions:configuration.versions,now,maxRequestMs:configuration.limits.requestMs});
 const port=operation=>({signal,...input})=>native.call(operation,input,{signal});
 const service=createConversationLifecycleService({service:basic,store,dispatcher,sessions,now,maxRequestMs:configuration.limits.requestMs,checkpoints:{read:port('checkpoint/read')},nativeAdmission:{admit:port('continuation/admit'),retire:port('continuation/retire')},approvals:{read:port('approval/read'),readDecision:port('approval/decision')}});
 const conversation=createConversationLifecycleApplication({service,now,maxRequestBytes:configuration.limits.requestBytes,maxRequestMs:configuration.limits.requestMs}),issuance=createActionSessionApplication({owner:sessions,now,maxRequestMs:configuration.limits.requestMs}),worker=createWorkerRunApplication({service,sessions,native,configuration,now});
 return Object.freeze({service,store,sessions,application:{handle:request=>{const path=new URL(request.url).pathname;return path==='/api/action-followthrough/session'?issuance.handle(request):path.startsWith('/internal/')?worker.handle(request):conversation.handle(request);}},close:()=>sessions.close()});
}
export async function startControl(configuration,{signal}={}){
 let pool,connection,listener,assembly,closing;const close=()=>closing??=(async()=>{await listener?.close();assembly?.close();await connection?.close();await pool?.end();})();
 try{
  const [connectionBytes,capabilityBytes,tls]=await Promise.all([readSecret(configuration.database.connectionFile),readSecret(configuration.native.capabilityFile),temporalTls(configuration.temporal.tls)]);
  const connectionString=connectionBytes.toString('utf8').trim();let u;try{u=new URL(connectionString);}catch{throw fault('DATABASE_CONFIGURATION');}
  // URL.get() selects the first duplicate; pg's adopted parser selects the
  // last. Accept one closed TLS parameter before either client is allocated.
  if(!['postgres:','postgresql:'].includes(u.protocol)||u.hash||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='verify-full'||[...u.searchParams.keys()].some(key=>key!=='sslmode'))throw fault('DATABASE_CONFIGURATION');
  pool=new Pool({connectionString,max:10,connectionTimeoutMillis:configuration.limits.requestMs,idleTimeoutMillis:10000,query_timeout:configuration.limits.requestMs});
  connection=await Connection.connect({address:configuration.temporal.address,tls,connectTimeout:configuration.limits.startupMs});const client=new Client({connection,namespace:configuration.temporal.namespace});
  const native=createNativeCapabilityClient({configuration:configuration.native,credential:capabilityBytes.toString('utf8').trim()});assembly=assembleControl({configuration,pool,client,native});
  async function readiness({signal}){signal?.throwIfAborted();await pool.query("SELECT to_regclass('meri_conversations.runs') AS runs, to_regclass('meri_conversations.events') AS events, to_regclass('meri_conversations.controls') AS controls, to_regclass('meri_conversations.selected_outputs') AS selected_outputs").then(result=>{if(!result.rows[0]||Object.values(result.rows[0]).some(v=>v===null))throw fault('DATABASE_SCHEMA_UNAVAILABLE');});await connection.withDeadline(Date.now()+configuration.limits.requestMs,()=>signal?connection.withAbortSignal(signal,()=>connection.workflowService.getSystemInfo({})):connection.workflowService.getSystemInfo({}));await native.readiness({signal});signal?.throwIfAborted();}
  await readiness({signal});listener=await listenRuntime({configuration,application:assembly.application,readiness,signal});return Object.freeze({address:listener.address,close});
 }catch{await close();throw fault('CONTROL_STARTUP_FAILED');}
}
