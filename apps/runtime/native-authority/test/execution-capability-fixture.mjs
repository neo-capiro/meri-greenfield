/** SYNTHETIC signer and production-shaped cases for Core's DRAFT execution capability (`capiro.meri-execution-capability.v1`).
 * The signer follows Core's draft §2 member-for-member (it reproduces Core's own golden vector from Core's synthetic seed, see
 * execution-capability.test.mjs). Keys here are SYNTHETIC: derived from public strings, never deployable. */
import {createHash,createPrivateKey,createPublicKey,sign} from 'node:crypto';
import canonicalize from 'canonicalize';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {executionHeader,executionRequestId,scopeClientIds} from '../execution-capability.mjs';
const PKCS8_ED25519=Buffer.from('302e020100300506032b657004220420','hex');
export const PRODUCTION_SEED_HEX=createHash('sha256').update('meri-execution-capability-production-vector-v1').digest('hex');
export const PRODUCTION_ISSUER='capiro-core:meri-execution:v1',PRODUCTION_KID='meri-execution-synthetic-production-1';
export function keyFromSeed(seedHex,kid){
 const privateKey=createPrivateKey({key:Buffer.concat([PKCS8_ED25519,Buffer.from(seedHex,'hex')]),format:'der',type:'pkcs8'});
 const {kty,crv,x}=createPublicKey(privateKey).export({format:'jwk'});
 return {privateKey,publicJwk:{kty,crv,x,kid,alg:'EdDSA',use:'sig'}};
}
const b64=value=>Buffer.from(value,'utf8').toString('base64url');
/** Mint exactly what Core's draft §2 specifies for these inputs. */
export function signExecution({seedHex=PRODUCTION_SEED_HEX,issuer=PRODUCTION_ISSUER,kid=PRODUCTION_KID,proposal,decision,executorBinding,requestId,capabilityId,budgets,iat,exp,mutate}){
 const {privateKey}=keyFromSeed(seedHex,kid),iso=s=>new Date(s*1000).toISOString();
 const execution={contractVersion:'0.1.0',requestId,capabilityId,executorBinding,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey};
 let payload={iss:issuer,aud:'meri-gateway',iat,nbf:iat,exp,jti:capabilityId,
  capability:{capabilityId,issuer,audience:'meri-gateway',binding:executorBinding,actions:['command.execute'],scopes:proposal.command.scopes,issuedAt:iso(iat),expiresAt:iso(exp),policyRevision:decision.policyRevision,budgets},
  execution:{requestId,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey,action:proposal.command.action,
   argumentsSha256:hash(proposal.command.arguments),clientIds:scopeClientIds(proposal.command.scopes),decisionSha256:hash(decision),approver:decision.approver,requestSha256:hash(execution)}};
 if(mutate)payload=mutate(structuredClone(payload));
 const input=b64(executionHeader(kid))+'.'+b64(canonicalize(payload));
 return {credential:input+'.'+sign(null,Buffer.from(input,'utf8'),privateKey).toString('base64url'),execution,payload};
}
export const productionTrust=()=>({issuer:PRODUCTION_ISSUER,keys:[keyFromSeed(PRODUCTION_SEED_HEX,PRODUCTION_KID).publicJwk]});
/** Production-shaped: Clerk-style tenant/actor ids, a 64-hex policy revision, the run's single client scope, realistic task
 * arguments (one with a client and due date, one with both null) and the preview run allocation's budgets. */
export const POLICY_REVISION=createHash('sha256').update('meri-preview-policy:2026-10-18').digest('hex');
export const TENANT='org_2nT4kQ7vXbR9mWc3LpY8sHd1Fz6',ACTOR='user_2nT5aJ8wYcS0nXd4MqZ9tIe2Ga7',CLIENT='6b3e9f1a-2c7d-4e85-9a4f-1d8c3b7e0f52';
export const RUN_BINDING=Object.freeze({tenantId:TENANT,actorId:ACTOR,conversationId:'c2f6a1d4-7b3e-4c9a-8f15-2d6e9b0a4c71',runId:'a7d3e9f2-1c4b-4e8a-9d26-5f0b3c7e1a94',
 attemptId:'e1b8c4f7-3a2d-4f6e-b9c0-7d5a2e8f1b36',workerId:'4f9a2c6e-8d1b-4a3f-a7e5-0c2b9d6f3e18',writerFence:1});
export const BUDGETS=Object.freeze({maxTurns:3,maxRuntimeSeconds:900,maxCostMicrousd:2000000,maxOutputBytes:262144});
export const ISSUED_AT=Math.floor(Date.parse('2026-10-18T14:02:11.000Z')/1000);
export const CASES=Object.freeze({
 clientAndDueDate:{title:'Draft HASC markup talking points on the FY27 NDAA counter-UAS provision',clientId:CLIENT,dueDate:'2026-10-30T00:00:00.000Z'},
 nullClientAndDueDate:{title:'Call the SAC-D clerk about the base site visit schedule',clientId:null,dueDate:null}});
export function productionProposal(argumentsValue,{n=1,binding=RUN_BINDING}={}){
 const command={contractVersion:'0.1.0',commandId:`3d8f1b6e-${String(n).padStart(4,'0')}-4c2a-9e7b-5a1f8d3c6e20`,binding,action:'task.create',arguments:argumentsValue,attachments:[],
  scopes:[{tenantId:binding.tenantId,kind:'client',resourceId:CLIENT,policyRevision:POLICY_REVISION}],idempotencyKey:`8a2c5e7f-${String(n).padStart(4,'0')}-4b1d-8f3a-6c9e2d0b7a14`};
 return {proposalId:`f4b7e2a9-${String(n).padStart(4,'0')}-4d3c-a8e1-2b6f9c0d5e37`,command,commandSha256:hash(command),createdAt:'2026-10-18T14:01:05.000Z',expiresAt:'2026-10-18T14:16:05.000Z',
  requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}};
}
export const productionDecision=proposal=>({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',decidedAt:'2026-10-18T14:01:41.000Z',
 expiresAt:proposal.expiresAt,approver:proposal.requiredApprover,policyRevision:POLICY_REVISION});
export const CAPABILITY_ID='9c1e7a3b-5d2f-4b8e-a6c4-3f0d8e2b7a15';
export function productionToken(name,{iat=ISSUED_AT,exp=ISSUED_AT+120,capabilityId=CAPABILITY_ID,mutate,proposal=productionProposal(CASES[name]),decision=productionDecision(proposal),executorBinding=RUN_BINDING,budgets=BUDGETS}={}){
 const requestId=executionRequestId({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,executorBinding});
 return {proposal,decision,requestId,executorBinding,...signExecution({proposal,decision,executorBinding,requestId,capabilityId,budgets,iat,exp,mutate})};
}
/** A production-shaped admitted grant set (model + task grants) and allocation for the run, as native admission installs it. */
export const WORKER_ARN='arn:aws:ecs:us-east-1:967807252336:task/meri-preview/0123456789abcdef0123456789abcdef';
const OPERATION={id:'create_task',version:'0.2.0'};
export function admittedSet({binding=RUN_BINDING,grants=[['1b2c3d4e-0000-4000-8000-00000000000a','model'],['1b2c3d4e-0000-4000-8000-00000000000b','task']],policyRevision=POLICY_REVISION}={}){
 const budgets={maxTurns:3,maxToolCalls:1,maxRecoveryAttempts:0,maxRuntimeSeconds:900,maxCostMicroUSD:2000000,maxOutputBytes:262144};
 const manifest={contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',prose:{id:'urn:meri:synthetic:execution-grant:1',sha256:'a'.repeat(64)},
  requiredSources:[{sourceId:'capiro_commands',authority:'authoritative',purpose:'enumeration'}],allowedOperations:[OPERATION],subjectKinds:['personal'],windowBases:['unbounded'],
  completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'evidence',requirement:'Synthetic accounting only',evidenceRequired:true}]},
  approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets,versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}};
 const allocation={run:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId},manifest,manifestSha256:hash(manifest),catalogSha256:hash(catalog),budgets,
  schedule:{revision:'b'.repeat(64),expiresAt:'2026-10-18T15:00:00.000Z',operations:[{operation:OPERATION,chargeMicrousd:1000}]}};
 const facts=grants.map(([grantId,label])=>({grantId,binding,qualificationBinding:{runId:binding.runId,attempt:1,workerArn:WORKER_ARN,fence:binding.writerFence,policyRevision},
  capabilitySha256:createHash('sha256').update(`synthetic-${label}-capability`).digest('hex'),allocationSha256:hash(allocation)}));
 return {allocation,allocationJson:JSON.stringify(allocation),grantFactsJsons:facts.map(f=>JSON.stringify(f)),facts};
}
