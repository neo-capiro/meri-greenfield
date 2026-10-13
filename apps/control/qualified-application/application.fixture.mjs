/** Source-test-only join: actual child Grants, scripted SQL/worker/native-auth/source boundaries. */
import {randomUUID} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createCommandIntentValidator} from '../../../packages/contracts/commands-0.2/execution-intent.mjs';
import {taskUpdateValidators} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {createState} from '../action-host/local-integration/state.mjs';
import {createPorts} from '../action-host/local-integration/ports.mjs';
import {createSharedPool} from '../action-host/local-integration/test-pool.mjs';
import {createCapiroApplicationAuthorityClient} from '../action-host/application-adapters/authority-http.mjs';
import {observationFixture} from '../../../infra/native-enforcement/worker-observer.fixture.mjs';
import {createScriptedLifecycleInterpreter} from './lifecycle-bridge.fixture.mjs';
import {createScriptedSchemaFixture} from './schema.fixture.mjs';
import {createQualificationApplication} from './application.mjs';

export async function createApplicationFixture(){
 const now=Date.now,s=createState({mode:'synthetic-local',deadlineMs:now()+60000}),worker=observationFixture({runId:s.binding.runId,policyRevision:s.policy});
 s.q=worker.request.qualificationBinding;s.readFacts={...s.readFacts,qualificationBinding:s.q};s.commandFacts={...s.commandFacts,qualificationBinding:s.q};
 const ports=createPorts(s),child=await createScriptedLifecycleInterpreter(),schema=createScriptedSchemaFixture(),sql=createSharedPool(),statements=[];
 const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
 let closed=false;
 async function currentGrantRows(){
  let rows;try{rows=await child.readState();}catch(error){if(error.code!=='ENOENT')throw error;rows={run:null,grants:{}};}
  sql.h.state().run=rows.run;sql.h.state().grants.clear();
  for(const [id,row]of Object.entries(rows.grants))sql.h.state().grants.set(id,{...row,expires_at:new Date(row.expires_at)});
 }
 function pool(){return {options:{host:schema.f.host,port:schema.f.port,database:schema.f.database,user:schema.f.user,connectionTimeoutMillis:5000,query_timeout:6000},async connect(){let client,pending=[];
  return {async query(statement,args){const text=typeof statement==='string'?statement:statement.text;statements.push(text);
   if(!client&&(text==='BEGIN'||text.startsWith('SET LOCAL'))){pending.push([statement,args]);return {rows:[]};}
   if(!client){if(text.startsWith('SELECT current_database()')){schema.state.budget.consumed_micro_usd=sql.h.state().budget.consumed_micro_usd;schema.state.budget.quarantined=sql.h.state().budget.quarantined;client=await schema.pool.connect();}else{await currentGrantRows();client=await sql.pool.connect();}
    for(const query of pending)await client.query(...query);pending=[];}
   return client.query(statement,args);
  },release:error=>client?.release(error)};
 },end(){throw Error('Borrowed qualification fixture pool must not be ended');}};}
 const commandPorts={async verifyCapability(token,{signal}){s.active(signal);if(token!==s.commandCredential)throw Error('SYNTHETIC_CREDENTIAL');return JSON.stringify(s.claims);},
  async authorizeBusiness(call){s.active(call.signal);if(!same(call.operation,s.descriptor.operation)||call.input.action!=='task.create'||call.input.arguments.clientId!==s.clientId)throw Error('SYNTHETIC_SCOPE');const id=randomUUID();return JSON.stringify({decision:{decisionId:id,actor:{tenantId:s.binding.tenantId,actorId:s.binding.actorId},operation:'create_task@0.2.0',scopes:s.scopes,policyRevision:s.policy,evaluatedAt:new Date(now()).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_QUALIFICATION'},subject:{kind:'client',entityType:'client',entityIds:[s.clientId],tenantId:s.binding.tenantId,actorId:s.binding.actorId,authorizationDecisionId:id,policyRevision:s.policy,scopes:s.scopes,rosterVersionId:null},grants:s.descriptor.requiredGrants});},
  async authorizeSources(call){s.active(call.signal);return JSON.stringify({sourceIds:s.descriptor.sourceRequirements.map(v=>v.sourceId),enabled:true,policyRevision:s.policy,checkedAtMs:now()});}};
 const client=createCapiroApplicationAuthorityClient({origin:'https://qualification-identity.invalid',enabled:true,now,limits:{maxRequestMs:1000,maxResponseBytes:65536},async fetchImpl(url,init){s.active(init.signal);if(init.headers.authorization!==`Bearer ${s.credential}`)return new Response('',{status:401});const principal={tenantId:s.binding.tenantId,actorId:s.binding.actorId};let receipt={principal,identityRevision:'scripted-only',checkedAtMs:now(),expiresAtMs:s.deadlineMs};if(url.endsWith('/context'))receipt={...receipt,identitySha256:JSON.parse(init.body).identitySha256,conversationId:s.binding.conversationId,selectedClientId:s.clientId,contextRevision:'scripted-only'};return new Response(JSON.stringify(receipt),{headers:{'content-type':'application/json'}});}});
 const source={read:ports.source,command:{origin:'https://qualification-command.invalid',getCredentials:ports.source.getCredentials,async fetchImpl(url,init){s.active(init.signal);if(url!=='https://qualification-command.invalid/clio/tools/create_task')throw Error('SYNTHETIC_ROUTE');s.state.taskEffects++;const args=JSON.parse(init.body);return new Response(JSON.stringify({tool:'create_task',generatedAt:new Date(now()).toISOString(),created:true,task:{id:randomUUID(),title:args.title,status:'todo',dueDate:args.dueDate??null,clientId:args.clientId,createdAt:new Date(now()).toISOString()}}),{headers:{'content-type':'application/json'}});}}};
 const limits={maxRequestMs:3000,maxFactBytes:131072,maxRequestBytes:65536,maxResponseBytes:131072,maxCleanupMs:100};
 function configuration({fixture=schema.f,pool:borrowed=pool()}={}){return {
  hostConfiguration:{admission:{pool:borrowed,allocationJson:JSON.stringify(s.allocation),grantFactsJsons:[s.readFacts,s.commandFacts].map(JSON.stringify)},readPorts:Object.fromEntries(Object.entries(s.identity.authorityPorts).filter(([k])=>k!=='currentRun')),commandPorts,
   lookup:{pool:borrowed,credential:s.read.credential,scopes:s.scopes},metadata:{pool:borrowed,preparePolicy:ports.preparePolicy},command:{journalPool:borrowed,budgetPool:borrowed,producerContext:{context:s.commandFacts,producer:s.producer},approvalStore:ports.approvalStore,contracts:createCommandIntentValidator({taskUpdate:taskUpdateValidators}),descriptor:{action:'task.create',operation:s.descriptor.operation,requiredGrants:s.descriptor.requiredGrants,sourceRequirements:s.descriptor.sourceRequirements}},
   commandContext:{binding:s.binding,clientResolution:{reference:s.clientId,clientId:s.clientId}},client,hostPorts:Object.fromEntries(['reserveLookup','issueLookupCredential','issueExecution'].map(k=>[k,ports.host[k]])),now,newId:randomUUID,limits,sessionLimits:{maxSessions:5,maxRequestMs:3000,maxTtlMs:60000,maxFactBytes:131072}},
  source,fixture,originalDeadlineMs:s.deadlineMs,now,
  lifecycleConfiguration:{pythonExecutable:child.pythonExecutable,connection:{host:fixture.host,port:fixture.port,dbname:fixture.database,user:fixture.user},workerObserver:worker.make({now}),worker:Object.fromEntries(['probeKind','attemptStartMs','attemptEndMs'].map(k=>[k,worker.request[k]])),expiresAtMs:s.deadlineMs,limits:{maxRequestMs:10000,maxFrameBytes:131072,maxCleanupMs:1000}},
 };}
 return {evidenceKind:'scripted-boundaries-actual-canonical-owners',s,ports,child,schema,sql,worker,statements,configuration,make:options=>createQualificationApplication(configuration(options)),pool,
  async issue(application){const response=await application.app.handle(new Request('https://qualification.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:`Bearer ${s.credential}`,'content-type':'application/json'},body:'{}'}));if(response.status!==200)throw Error('SYNTHETIC_SESSION_REFUSED');return (await response.json()).credential;},
  stats:()=>({taskEffects:s.state.taskEffects,sourceReads:s.state.sourceReads}),
  async close(){if(closed)return;closed=true;s.identity.close();await child.close();},
 };
}
