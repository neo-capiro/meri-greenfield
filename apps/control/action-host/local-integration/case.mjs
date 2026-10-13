/** Admitted-pool composition. No connection/migration/source calls at construction. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {taskUpdateValidators} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createCommandIntentValidator} from '../../../../packages/contracts/commands-0.2/execution-intent.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {PostgresBudgetStore} from '../../../gateway/budget/postgres-budget-store.mjs';
import {createLocalActionGateway} from '../../../gateway/local-action/gateway.mjs';
import {createLocalLookupAuthorizer} from '../../../gateway/local-action/control-authorizer.mjs';
import {assertTaskLookupStoredBinding} from '../../task-lookup/index.mjs';
import {createDurableActionServices} from '../durable/index.mjs';
import {createActionHostApplication} from '../index.mjs';
import {createState} from './state.mjs';
import {createPorts} from './ports.mjs';
import {createActionSessionApplication,actionSessionPath} from '../session/http.mjs';
export function createLocalApplicationCase(options){
 const {sessionFactory,...base}=own(options,['mode','deadlineMs'],['now','newId','sessionFactory']);if(sessionFactory!==undefined&&typeof sessionFactory!=='function')throw Error('LOCAL_CASE_CONFIGURATION');
 const s=createState(base),p=createPorts(s),{now,newId,binding,state,active}=s;
 const sessions=sessionFactory?sessionFactory({...p.session,now,deadlineMs:s.deadlineMs}):null;
 const issuance=sessions?createActionSessionApplication({owner:sessions,now}):null;
 const limits={maxRequestMs:3000,maxFactBytes:131072,maxResponseBytes:131072,maxCleanupMs:100};
 const ownedRows=data({runId:binding.runId,tenantId:binding.tenantId,readGrantId:s.readFacts.grantId,commandGrantId:s.commandFacts.grantId,allocationSha256:canonicalSha256(s.allocation)});
 const context=data({binding,clientResolution:{reference:s.clientId,clientId:s.clientId}});
 function graph(pool){
  const gateway=createLocalActionGateway({mode:s.mode,identity:s.identity,pool,allocationJson:JSON.stringify(s.allocation),source:p.source,limits:{maxRequestBytes:65536,maxResponseBytes:131072,maxRequestMs:3000,maxCleanupMs:100},now,newId});
  const services=createDurableActionServices({lookup:{pool,gateway,authorize:createLocalLookupAuthorizer({identity:s.identity,credential:s.read.credential,assertStoredBinding:assertTaskLookupStoredBinding,now})},metadata:{pool,preparePolicy:p.preparePolicy},command:{journalPool:pool,budgetPool:pool,allocationJson:JSON.stringify(s.allocation),producerContext:{context:s.commandFacts,producer:s.producer},authority:p.authority,approvalStore:p.approvalStore,source:p.commandSource,contracts:createCommandIntentValidator({taskUpdate:taskUpdateValidators}),descriptor:{action:'task.create',operation:s.descriptor.operation,requiredGrants:s.descriptor.requiredGrants,sourceRequirements:s.descriptor.sourceRequirements}},commandContext:context,now,newId,limits,sourceEnabled:true});
  return {gateway,services};
 }
 async function setup(value){
  const {pool,signal}=own(value,['pool'],['signal']);active(signal);if(state.setup!=='NEW')throw Error('LOCAL_CASE_SETUP_ALREADY_ATTEMPTED');state.setup='ATTEMPTED';
  const life=createOperationLifetime({deadlineMs:s.deadlineMs,now,signal,errorFactory:c=>new Error(c)}),check=()=>{life.check();active(life.signal);};
  try{const store=new PostgresBudgetStore(pool);await life.run(()=>store.transact(async client=>{
    await store.lock(client);check();const q=s.q;
    await client.query('INSERT INTO meri_qualification.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5)',[q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision]);check();
    for(const facts of [s.readFacts,s.commandFacts]){await client.query("INSERT INTO meri_qualification.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')",[facts.grantId,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,facts.capabilitySha256,new Date(s.deadlineMs).toISOString()]);check();}
   },check));
   const g=graph(pool);await life.run(()=>g.gateway.bindTrustedGrant(JSON.stringify({...s.readFacts,invocationId:'local-read-admission'})));check();await life.run(()=>g.services.commandExecutor.bindTrustedGrant(JSON.stringify({...s.commandFacts,invocationId:'local-command-admission'})));check();state.setup='READY';
  }catch{state.setup='UNKNOWN';throw Object.assign(new Error('LOCAL_CASE_SETUP_UNKNOWN'),{ownedRows});}finally{life.close();}
 }
 return Object.freeze({mode:s.mode,ownedRows,
  setup,
  openHost(value){const {pool,closeGraph}=own(value,['pool'],['closeGraph']);active();if(state.setup!=='READY'||closeGraph!==undefined&&typeof closeGraph!=='function')throw Error('LOCAL_CASE_NOT_READY');const {services}=graph(pool);const app=createActionHostApplication({services,...p.host,...(sessions?{authenticateSession:sessions.authenticateSession,readCurrentState:sessions.readCurrentState}:{}),now,limits:{maxRequestMs:3000,maxRequestBytes:65536,maxResponseBytes:131072}});state.hostsOpened++;const mounted=issuance?Object.freeze({handle(request){let path;try{if(types.isProxy(request)||!(request instanceof Request))return issuance.handle(request);path=new URL(Object.getOwnPropertyDescriptor(Request.prototype,'url').get.call(request)).pathname;}catch{return issuance.handle(request);}return path===actionSessionPath?issuance.handle(request):app.handle(request);}}):app;return {app:mounted,...(sessions?{identityCredential:s.credential}:{credential:s.credential}),...(closeGraph?{closeGraph}:{})};},
  approve:p.approve,revoke(){state.revoked=true;s.identity.revoke(s.read.credential);},
  stats:()=>data({sourceReads:state.sourceReads,taskEffects:state.taskEffects,hostsOpened:state.hostsOpened,closed:state.closed,revoked:state.revoked,setup:state.setup}),
  close(){state.closed=true;s.identity.close();sessions?.close();},
 });
}
