/** `issueExecution` for conversation write intents (`apps/control/intents/approval.mjs`) over Core's proposed issuance route
 * (Core DRAFT §3, `POST /api/clio/approvals/native/execution`, NOT mounted at Core 5a6ec070). Construction is inert.
 *
 * One call, for an approved proposal and the attended approver (`principal`):
 *  1. Executor run: `executorFor({proposal, signal})` -> `{binding, currentAllocationJson}` from the existing admitted-run owner
 *     (`createPostgresAdmittedRunOwner(...).currentAllocation`). The binding keeps the proposal's tenant/actor/conversation/run.
 *  2. Budgets: `capabilityBudgets(currentAllocationJson)` (dot item 1); the request carries them with the allocation hash.
 *  3. Request id: deterministic per (proposal, commandSha256, executor binding), so Core's idempotent answer for the same
 *     (tenant, proposal, run, attempt) correlates exactly; anything else refuses.
 *  4. Core call with the approver's native bearer and the verified service secret (`getCredentials`, purpose
 *     `approval.execution`), fixed https origin, no redirects, bounded body, no retries.
 *  5. Local verification of the returned token (pinned keys, draft §4) and the trusted comparison to the proposal, executor
 *     binding, request id and budgets (exact equality, never "below a ceiling").
 *  6. Fresh current-authority observation (dot item 2): Core's answer — even an idempotent replay of the same immutable token — is
 *     accepted only after Meri re-reads the CURRENT decision (`readDecision`, the shared `approval/decision` adapter) and its
 *     hash equals the token's `decisionSha256`. Core's own `checkedAtMs` is never trusted: this adapter stamps its own clock
 *     after the correlated fresh response. Signed `iat`/`exp` are enforced separately: `exp` must be in the future and `iat`
 *     must not be ahead of this clock (a bounded wait of at most `maxSkewMs` absorbs a second-granular issuer clock).
 * Receipt: `{execution, credential, checkedAtMs, expiresAtMs}` with `expiresAtMs = min(exp, decision, proposal, run deadline)`.
 * Failures: ProductError `EXECUTION_OWNER_UNAVAILABLE` (NOT_DISPATCHED) when Core is unreachable or refuses, otherwise a plain
 * `EXECUTION_CAPABILITY_REFUSED`/`_MISMATCH` (approval.mjs maps it to `EXECUTION_AUTHORITY_REFUSED`, NOT_DISPATCHED). */
import {types} from 'node:util';
import {assertProposalIntegrity,canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {cancelBody,readJsonResponse,responseBody} from '../../gateway/sources/json-response.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
import {assertExecutionCorrelation,capabilityBudgets,executionFault,executionRequestId,verifyExecutionCapability,EXECUTION_LIMITS,EXECUTION_COMMAND_ACTIONS} from './execution-capability.mjs';
export const CORE_EXECUTION_ROUTE='/api/clio/approvals/native/execution';
const STABLE=['tenantId','actorId','conversationId','runId'];
const same=(a,b)=>hash(a)===hash(b);
const unavailable=()=>new ProductError('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');
const token=v=>typeof v==='string'&&v.length>0&&v.length<=8192&&/^[\x21-\x7e]+$/u.test(v);
const instant=v=>{const t=typeof v==='string'?Date.parse(v):NaN;return Number.isSafeInteger(t)?t:NaN;};
export function createCoreExecutionIssuance(configuration){
 const c=own(configuration,['origin','trust','getCredentials','executorFor','readDecision','fetchImpl','now'],['limits','sleep']);
 const limits=c.limits===undefined?{maxRequestMs:10000,maxResponseBytes:65536,maxSkewMs:1000}:data(own(c.limits,['maxRequestMs','maxResponseBytes','maxSkewMs']));
 let base;try{base=new URL(c.origin);}catch{throw executionFault('EXECUTION_CONFIGURATION');}
 const sleep=c.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 if(base.protocol!=='https:'||base.origin!==c.origin||base.username||base.password||!(c.trust?.keys instanceof Map)||
  ['getCredentials','executorFor','readDecision','fetchImpl','now'].some(k=>typeof c[k]!=='function'||types.isProxy(c[k]))||typeof sleep!=='function'||
  !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.maxResponseBytes)||limits.maxResponseBytes<1||limits.maxResponseBytes>1048576||
  !Number.isSafeInteger(limits.maxSkewMs)||limits.maxSkewMs<0||limits.maxSkewMs>EXECUTION_LIMITS.maxSkewMs)throw executionFault('EXECUTION_CONFIGURATION');
 const now=c.now,url=new URL(CORE_EXECUTION_ROUTE,base).href;
 async function post(life,credentials,body){
  let response;
  try{
   response=await life.run(async signal=>{
    const r=await c.fetchImpl(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`Bearer ${credentials.bearerToken}`,'x-internal-service-secret':credentials.serviceSecret,'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},
     body:JSON.stringify(body)});
    try{life.check();}catch(error){try{cancelBody(responseBody(r));}catch{}throw error;}return r;
   });
   return data(await readJsonResponse(response,{lifetime:life,maxResponseBytes:limits.maxResponseBytes}));
  }catch{throw unavailable();}
  finally{try{if(response)cancelBody(responseBody(response));}catch{}}
 }
 async function issueExecution(value){
  const v=own(value,['proposal','principal'],['signal','deadlineMs']);nativeSignal(v.signal);
  const proposal=data(v.proposal),principal=data(v.principal);
  try{assertProposalIntegrity(proposal);}catch{throw executionFault('EXECUTION_CAPABILITY_MISMATCH');}
  if(!EXECUTION_COMMAND_ACTIONS.includes(proposal.command.action)||principal?.tenantId!==proposal.requiredApprover.tenantId||principal?.actorId!==proposal.requiredApprover.actorId)throw executionFault('EXECUTION_CAPABILITY_MISMATCH');
  const started=now(),cutoff=Math.min(Number.isSafeInteger(v.deadlineMs)?v.deadlineMs:Infinity,started+limits.maxRequestMs,instant(proposal.expiresAt));
  if(!Number.isSafeInteger(cutoff)||cutoff<=started)throw unavailable();
  const life=createOperationLifetime({deadlineMs:cutoff,now,signal:v.signal,errorFactory:code=>new ProductError(code==='CANCELLED'?'CANCELLED':'DEADLINE','NOT_DISPATCHED')});
  try{
   // 1-2. The executor run and its authenticated allocation (the existing admitted-run owner).
   let executor;try{executor=data(own(await life.run(signal=>c.executorFor({proposal,signal})),['binding','currentAllocationJson']));validateShape('RunBinding',executor.binding);}
   catch{throw unavailable();}
   if(STABLE.some(k=>executor.binding[k]!==proposal.command.binding[k]))throw unavailable();
   let allocation;try{allocation=capabilityBudgets(executor.currentAllocationJson);}catch{throw unavailable();}
   const at=now();if(!same(allocation.binding,executor.binding)||allocation.checkedAtMs<started||allocation.checkedAtMs>at||allocation.deadlineMs<=at)throw unavailable();
   life.limitDeadline(allocation.deadlineMs);
   // 3-4. The Core issuance call with the attended approver's native credentials.
   const requestId=executionRequestId({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,executorBinding:executor.binding});
   let credentials;
   try{credentials=data(own(await life.run(signal=>c.getCredentials({tenantId:principal.tenantId,actorId:principal.actorId,purpose:'approval.execution',binding:proposal.command.binding,signal,deadlineMs:cutoff})),['tenantId','actorId','bearerToken','serviceSecret','expiresAtMs']));}
   catch{throw unavailable();}
   if(credentials.tenantId!==principal.tenantId||credentials.actorId!==principal.actorId||!token(credentials.bearerToken)||!token(credentials.serviceSecret)||!Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=now())throw unavailable();
   life.limitDeadline(credentials.expiresAtMs);
   const raw=await post(life,credentials,{proposal,executorBinding:executor.binding,requestId,budgets:allocation.budgets,allocationSha256:allocation.allocationSha256});
   let receipt;try{receipt=own(raw,['execution','credential','checkedAtMs','expiresAtMs']);}catch{throw executionFault();}
   // 5. Local verification and the trusted comparison (exact budgets; the Core receipt's execution must be the token's).
   const verified=verifyExecutionCapability(receipt.credential,c.trust,{nowMs:now(),skewMs:limits.maxSkewMs});
   if(!same(receipt.execution,verified.request)||receipt.expiresAtMs!==verified.expiresAtMs||!same(verified.claims.budgets,allocation.budgets))throw executionFault('EXECUTION_CAPABILITY_MISMATCH');
   assertExecutionCorrelation({verified,proposal,executorBinding:executor.binding,requestId});
   // 6. Fresh current-authority observation: the CURRENT decision is the one the token signs.
   let decision;try{decision=data(await life.run(signal=>c.readDecision({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:proposal.command.binding,signal})));}
   catch{throw unavailable();}
   if(decision===null)throw executionFault('EXECUTION_CAPABILITY_MISMATCH');
   assertExecutionCorrelation({verified,proposal,decision});
   const signedAt=verified.issuedAtMs;
   if(signedAt>now()){if(signedAt-now()>limits.maxSkewMs)throw executionFault();await life.run(()=>sleep(signedAt-now()));}
   const checkedAtMs=now(),expiresAtMs=Math.min(verified.expiresAtMs,instant(decision.expiresAt),instant(proposal.expiresAt),allocation.deadlineMs);
   if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<started||checkedAtMs<signedAt||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=checkedAtMs)throw executionFault();
   life.check();
   return data({execution:verified.request,credential:receipt.credential,checkedAtMs,expiresAtMs});
  }finally{life.close();}
 }
 return Object.freeze({issueExecution});
}
