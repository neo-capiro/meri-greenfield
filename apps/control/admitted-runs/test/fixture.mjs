/** Synthetic fixture only: real canonical budget binding and one scripted SQL ledger. */
import {randomUUID} from 'node:crypto';
import {harness,NOW} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {createPostgresToolBudget} from '../../../gateway/budget/postgres-tool-budget.mjs';
import {createPostgresAdmittedRunOwner} from '../../../gateway/index.mjs';
import {createState} from '../../action-host/local-integration/state.mjs';
import {createPorts} from '../../action-host/local-integration/ports.mjs';
import {createTaskLookupPoolFixture} from '../../task-lookup/postgres-fixture.mjs';
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {scriptedPool} from '../../test/commands-fixture.mjs';
import {createCommandIntentValidator} from '../../../../packages/contracts/commands-0.2/execution-intent.mjs';
import {taskUpdateValidators} from '../../../../packages/contracts/commands-0.2/validate.mjs';
import {createCapiroApplicationAuthorityClient} from '../../action-host/application-adapters/authority-http.mjs';
import {createAdmittedActionHost} from '../mount.mjs';
export {NOW};
export async function admittedFixture(){
 let at=NOW;const now=()=>at,h=harness(),s=createState({mode:'synthetic-local',deadlineMs:NOW+10000,now,newId:randomUUID}),p=createPorts(s);
 const q=s.q;h.state().run={run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision};h.state().grant=null;h.state().grants.clear();
 for(const f of [s.readFacts,s.commandFacts])h.state().grants.set(f.grantId,{grant_id:f.grantId,run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,capability_sha256:f.capabilitySha256,expires_at:new Date(s.deadlineMs),state:'ACTIVE'});
 const allocationJson=JSON.stringify(s.allocation),budget=createPostgresToolBudget({pool:h.pool,allocationJson,now});
 for(const [i,f]of [s.readFacts,s.commandFacts].entries())await budget.bindTrustedGrant(JSON.stringify({...f,invocationId:`fixture-admit-${i}`}));
 const admission={pool:h.pool,allocationJson,grantFactsJsons:[s.readFacts,s.commandFacts].map(JSON.stringify)};
 const limits={maxRequestMs:1000,maxFactBytes:131072,maxRequestBytes:65536,maxResponseBytes:131072,maxCleanupMs:100};
 const owner=()=>createPostgresAdmittedRunOwner({...admission,now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes}});
 const readPorts=Object.fromEntries(Object.entries(s.identity.authorityPorts).filter(([k])=>k!=='currentRun'));
 const commandPorts={async verifyCapability(credential,{signal}){s.active(signal);if(credential!==s.commandCredential)throw Error('SYNTHETIC_CREDENTIAL');return JSON.stringify(s.claims);},
 async authorizeBusiness(call){const a=await p.authority.check({credential:s.commandCredential,descriptor:s.descriptor,input:call.input,signal:call.signal,limitDeadline:()=>{}});return JSON.stringify({decision:a.decision,subject:a.subject,grants:s.descriptor.requiredGrants});},
 async authorizeSources(call){s.active(call.signal);return JSON.stringify({sourceIds:s.descriptor.sourceRequirements.map(x=>x.sourceId),enabled:true,policyRevision:s.policy,checkedAtMs:now()});}};
 const bridgeCalls=[];const client=createCapiroApplicationAuthorityClient({origin:'https://authority.invalid',enabled:true,now,limits:{maxRequestMs:1000,maxResponseBytes:65536},fetchImpl:async(url,init)=>{bridgeCalls.push(url);if(init.headers.authorization!==`Bearer ${s.credential}`)return new Response('',{status:401});const principal={tenantId:s.binding.tenantId,actorId:s.binding.actorId};let value={principal,identityRevision:'synthetic-native',checkedAtMs:now(),expiresAtMs:s.deadlineMs};if(url.endsWith('/context')){const body=JSON.parse(init.body);value={...value,identitySha256:body.identitySha256,conversationId:s.binding.conversationId,selectedClientId:s.clientId,contextRevision:'synthetic-context'};}return new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});}});
 const lookup=createTaskLookupPoolFixture(),metadata=createMetadataPoolFixture(),journal=scriptedPool({});
 const config={admission,readPorts,commandPorts,lookup:{pool:lookup.pool,credential:s.read.credential,scopes:s.scopes},metadata:{pool:metadata.pool,preparePolicy:p.preparePolicy},command:{journalPool:journal.pool,budgetPool:h.pool,producerContext:{context:s.commandFacts,producer:s.producer},approvalStore:p.approvalStore,source:p.commandSource,contracts:createCommandIntentValidator({taskUpdate:taskUpdateValidators}),descriptor:{action:'task.create',operation:s.descriptor.operation,requiredGrants:s.descriptor.requiredGrants,sourceRequirements:s.descriptor.sourceRequirements}},commandContext:{binding:s.binding,clientResolution:{reference:s.clientId,clientId:s.clientId}},client,hostPorts:Object.fromEntries(['reserveLookup','issueLookupCredential','issueExecution'].map(k=>[k,p.host[k]])),now,newId:randomUUID,limits,sessionLimits:{maxSessions:5,maxRequestMs:1000,maxTtlMs:9000,maxFactBytes:131072},enabled:true};
 return {h,s,p,config,owner,now,bridgeCalls,lookup,metadata,journal,make:changes=>createAdmittedActionHost({...config,...changes}),setTime(value){at=value;h.setClock(value);},close(){s.identity.close();}};
}
