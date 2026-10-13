/** Local qualification case only. Caller owns the admitted pool, schema and eventual teardown. */
import {randomUUID,randomBytes} from 'node:crypto';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields,frozenData} from '../sources/source-admission.mjs';
import {deny} from '../dispatch/operation-result.mjs';
import {createLocalActionIdentity} from './identity.mjs';
import {PostgresBudgetStore,BudgetCommitUncertain} from '../budget/postgres-budget-store.mjs';
import {createLocalLookupAuthorizer} from './control-authorizer.mjs';
import {createLocalActionGateway} from './gateway.mjs';
const operation=Object.freeze({id:'actions.query',version:'0.2.0'}),contract=resolveOperationContract(operation);
export function createLocalActionCaseFactory(configuration){
 const {mode,now=Date.now,newId=randomUUID,assertStoredBinding}=ownFields(configuration,['mode','assertStoredBinding'],['now','newId']);
 if(mode!=='synthetic-local'||typeof now!=='function'||typeof newId!=='function'||typeof assertStoredBinding!=='function')deny('GATEWAY_CONFIGURATION');
 return async function createCase(options){
  const {pool,name,deadlineMs}=ownFields(options,['pool','name','deadlineMs']);const started=now();
  if(!pool||typeof pool.connect!=='function'||typeof name!=='string'||!/^[a-z0-9-]{1,64}$/u.test(name)||!Number.isSafeInteger(started)||!Number.isSafeInteger(deadlineMs)||deadlineMs<=started)deny('GATEWAY_CONFIGURATION');
  const cutoff=Math.min(deadlineMs,started+60000),binding={tenantId:`synthetic-${newId()}`,actorId:`synthetic-${newId()}`,conversationId:newId(),runId:newId(),attemptId:newId(),workerId:newId(),writerFence:1};
  const clientId=newId(),policyRevision=canonicalSha256({mode:'synthetic-local',runId:binding.runId});
  const publicBudgets={maxTurns:5,maxRuntimeSeconds:60,maxCostMicrousd:100,maxOutputBytes:65536};
  const identity=createLocalActionIdentity({mode,binding,clientId,policyRevision,deadlineMs:cutoff,budgets:publicBudgets,grants:contract.descriptor.requiredGrants,sourceEnabled:true,now,newId});
  const issued=identity.issueCredential({ttlMs:cutoff-started}),grantId=newId(),charge=10;
  const budgets={maxTurns:5,maxToolCalls:3,maxRecoveryAttempts:0,maxRuntimeSeconds:60,maxCostMicroUSD:100,maxOutputBytes:65536};
  const manifest={contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',prose:{id:'urn:meri:synthetic:local-action:1',sha256:canonicalSha256({mode,name})},requiredSources:contract.descriptor.sourceRequirements,allowedOperations:[operation],subjectKinds:['client'],windowBases:['unbounded'],completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'synthetic',requirement:'Local synthetic persistence only',evidenceRequired:true}]},approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets,versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
  const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),manifest,manifestSha256:canonicalSha256(manifest),catalogSha256:canonicalSha256(catalog),budgets,schedule:{revision:canonicalSha256({name,charge}),expiresAt:new Date(cutoff).toISOString(),operations:[{operation,chargeMicrousd:charge}]}};
  const q={runId:binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${newId().replaceAll('-','')}`,fence:1,policyRevision};
  const facts={grantId,binding,qualificationBinding:q,capabilitySha256:issued.capabilitySha256,allocationSha256:canonicalSha256(allocation)};
  let calls=0;const token=`synthetic_${randomBytes(24).toString('base64url')}`,secret=`synthetic_${randomBytes(24).toString('base64url')}`;
  const active=()=>{const at=now();if(!Number.isSafeInteger(at)||at>=cutoff||identity.status().closed)deny('DEADLINE');};
  const source={origin:'https://local-action.invalid',getCredentials:async call=>{
    await identity.authorityPorts.verifyCapability(issued.credential,{signal:call.signal});
    if(canonicalSha256(call.binding)!==canonicalSha256(binding)||canonicalSha256(call.subject.scopes)!==canonicalSha256(identity.status().scopes))deny('ACCESS_DENIED');active();
    return {binding,bearerToken:token,serviceSecret:secret,expiresAtMs:cutoff};},
   fetchImpl:async(url,init)=>{
    active();await identity.authorityPorts.verifyCapability(issued.credential,{signal:init.signal});
    if(url!=='https://local-action.invalid/clio/tools/query_action_items'||init.method!=='POST'||init.headers.authorization!==`Bearer ${token}`||init.headers['x-internal-service-secret']!==secret)deny('ACCESS_DENIED');
    const raw=JSON.parse(init.body),n=contract.normalizeInput(raw,{binding,clientResolution:{reference:clientId,clientId}}).input;
    if(n.cursor!==null)deny('UNAVAILABLE');calls++;
    const result={tool:'query_action_items',generatedAt:new Date(now()).toISOString(),clientId,total:0,returned:0,actions:[],scope:{actionItemId:n.selection.actionItemId,status:n.selection.status,sort:n.selection.sort,page:1,limit:n.selection.limit,cursorApplied:false},coverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:true,note:'Synthetic empty source snapshot only'}};
    active();return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}});
   }};
  const limits={maxRequestBytes:65536,maxResponseBytes:65536,maxRequestMs:10000,maxCleanupMs:100};
  const gateway=createLocalActionGateway({mode,identity,pool,allocationJson:JSON.stringify(allocation),source,limits,now,newId});
  const context={lookupId:newId(),resultReference:newId(),requestId:newId(),binding,scopes:identity.status().scopes,selectedClientId:clientId,deliveryJson:JSON.stringify({context:facts,producer:{namespace:'synthetic-local-action',executionId:binding.runId},deliveryId:name}),slots:{started:{eventId:newId(),sequence:1},terminal:{eventId:newId(),sequence:2}},deadlineMs:cutoff};
  const ownedRows=frozenData({name,tenantId:binding.tenantId,runId:binding.runId,grantId,lookupId:context.lookupId,resultReference:context.resultReference,eventIds:[context.slots.started.eventId,context.slots.terminal.eventId]});
  try{
   await new PostgresBudgetStore(pool).transact(async client=>{
    active();await client.query('INSERT INTO meri_qualification.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5)',[q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision]);active();
    await client.query("INSERT INTO meri_qualification.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')",[grantId,q.runId,q.attempt,q.workerArn,q.fence,q.policyRevision,issued.capabilitySha256,issued.claims.expiresAt]);active();
   },active);
  }catch(error){identity.close();throw Object.assign(new Error(error instanceof BudgetCommitUncertain?'LOCAL_CASE_COMMIT_UNCERTAIN':'LOCAL_CASE_UNAVAILABLE'),{ownedRows});}
  try{active();await gateway.bindTrustedGrant(JSON.stringify({...facts,invocationId:'local-binding-admission'}));active();}catch{identity.close();throw Object.assign(new Error('LOCAL_CASE_BIND_UNCERTAIN'),{ownedRows});}
  const authorize=createLocalLookupAuthorizer({identity,credential:issued.credential,assertStoredBinding,now});
  return Object.freeze({gateway,authorize,lookup:frozenData({request:{limit:1},context,credential:issued.credential}),readContext:frozenData({currentBinding:binding,scopes:identity.status().scopes,deadlineMs:cutoff}),sourceCalls:()=>calls,revokeRead:()=>identity.revoke(issued.credential),dispose:()=>identity.close(),expectedChargeMicroUsd:charge,ownedRows,identity});
 };
}
