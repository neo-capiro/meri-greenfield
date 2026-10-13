/** Synthetic host-owned identity and immutable allocation; no I/O. */
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createLocalActionIdentity} from '../../../gateway/local-action/identity.mjs';
export const readOperation=Object.freeze({id:'actions.query',version:'0.2.0'}),commandOperation=Object.freeze({id:'create_task',version:'0.2.0'});
export function createState(options){
 const {mode,deadlineMs,now=Date.now,newId=randomUUID}=own(options,['mode','deadlineMs'],['now','newId']);
 if(mode!=='synthetic-local'||typeof now!=='function'||typeof newId!=='function'||!Number.isSafeInteger(deadlineMs)||deadlineMs<=now()||deadlineMs>now()+60000)throw Error('LOCAL_CASE_CONFIGURATION');
 const binding=data({tenantId:`synthetic-${newId()}`,actorId:`synthetic-${newId()}`,conversationId:newId(),runId:newId(),attemptId:newId(),workerId:newId(),writerFence:1}),clientId=newId(),policy=canonicalSha256({binding,mode});
 const publicBudgets={maxTurns:5,maxRuntimeSeconds:60,maxCostMicrousd:100,maxOutputBytes:65536};
 const identity=createLocalActionIdentity({mode,binding,clientId,policyRevision:policy,deadlineMs,budgets:publicBudgets,grants:['tool.read'],sourceEnabled:true,now,newId});
 const read=identity.issueCredential({ttlMs:deadlineMs-now()}),scopes=identity.status().scopes,token=()=>`synthetic_${randomBytes(32).toString('base64url')}`;
 const commandCredential=token(),credential=token(),claims=data({capabilityId:newId(),issuer:'meri-synthetic-local-command',audience:'meri-gateway',binding,actions:['command.execute'],scopes,issuedAt:new Date(now()).toISOString(),expiresAt:new Date(deadlineMs).toISOString(),policyRevision:policy,budgets:publicBudgets});validateShape('CapabilityClaims',claims);
 const descriptor=resolveOperationContract(commandOperation).descriptor,readDescriptor=resolveOperationContract(readOperation).descriptor;
 const budgets={maxTurns:5,maxToolCalls:3,maxRecoveryAttempts:0,maxRuntimeSeconds:60,maxCostMicroUSD:100,maxOutputBytes:65536};
 const manifest={contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',prose:{id:'urn:meri:synthetic:local-application:1',sha256:policy},requiredSources:[...readDescriptor.sourceRequirements,...descriptor.sourceRequirements],allowedOperations:[readOperation,commandOperation],subjectKinds:['client'],windowBases:['unbounded'],completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'synthetic',requirement:'Synthetic local application only',evidenceRequired:true}]},approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets,versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
 const allocation=data({run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),manifest,manifestSha256:canonicalSha256(manifest),catalogSha256:canonicalSha256(catalog),budgets,schedule:{revision:policy,expiresAt:new Date(deadlineMs).toISOString(),operations:[readOperation,commandOperation].map(operation=>({operation,chargeMicrousd:10}))}});
 const q={runId:binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${newId().replaceAll('-','')}`,fence:1,policyRevision:policy};
 const facts=hash=>data({grantId:newId(),binding,qualificationBinding:q,capabilitySha256:hash,allocationSha256:canonicalSha256(allocation)});
 const readFacts=facts(read.capabilitySha256),commandFacts=facts(createHash('sha256').update(commandCredential).digest('hex'));
 const producer=data({namespace:'synthetic-local-application',executionId:binding.runId});
 const state={closed:false,revoked:false,setup:'NEW',sourceReads:0,taskEffects:0,hostsOpened:0,decision:null,sequence:0};
 const active=signal=>{const at=now();if(state.closed||state.revoked||signal?.aborted||!Number.isSafeInteger(at)||at>=deadlineMs)throw Error('LOCAL_CASE_REFUSED');};
 return {mode,deadlineMs,now,newId,binding,clientId,policy,identity,read,scopes,credential,commandCredential,claims,descriptor,allocation,q,readFacts,commandFacts,producer,state,active};
}
