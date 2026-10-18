/** Meri side of Core's approved-execution capability `capiro.meri-execution-capability.v1` (Core DRAFT rev 3, capiro-backend #84
 * `docs/integration/MERI-EXECUTION-CAPABILITY-DRAFT.md` and codec `apps/api/src/meri/execution-capability/meri-execution-capability.ts`
 * at 0304b0ef; dot's binding review PR #121 6246551969 and 6247443108). Rev 3 adds three `execution` members to the rev 1 ten:
 * `sourceBodySha256` (Meri's exact `create_task` body projection), `allocationSha256` (the authenticated allocation the budgets were
 * copied from) and `qualification` (the admitted `{runId, attempt, workerArn, fence, policyRevision}`); the key set stays closed.
 *
 * Pure and inert: no I/O, timer, key fetch or clock read. Keys are pinned OKP JWKs `(iss, kid) -> x`; nothing is fetched at
 * run time. Every refusal is the closed code `EXECUTION_CAPABILITY_REFUSED` (or `..._MISMATCH` for a valid token that does not
 * match the trusted request/proposal/decision), so a caller never learns which check failed.
 *
 *  - `compileExecutionTrust({issuer, keys})`            pinned issuer and Ed25519 public keys.
 *  - `verifyExecutionCapability(credential, trust, {nowMs, skewMs})`   draft §4 for Meri's own `verifyCapability` port: exact
 *     header bytes, pinned kid, pure Ed25519, payload byte-identical to its JCS form, `nbf = iat`, `iat <= now(+skew) < exp`,
 *     `exp - iat <= 120`, capability claims equal to the token members, one action, scope tenant/revision, re-derived client ids
 *     and the recomputed request hash. Returns the exact `CapabilityClaims` JSON (`claimsJson`) and the `CommandExecutionRequest`.
 *  - `assertExecutionCorrelation({verified, proposal, executorBinding?, requestId?, decision?})`  the trusted comparison of the
 *     verified claims to the ACTUAL request/proposal/current decision (dot's receiver requirement 1, applied by Meri too).
 *  - `executionBodyBinding(command)`  dot item 3: `argumentsSha256` of the immutable arguments AND, separately, the hash of the
 *     deterministic Core tool body (`source-projection.mjs`, which omits a null `clientId`/`dueDate`).
 *  - `capabilityBudgets(currentAllocationJson)`  dot item 1: `CapabilityClaims.budgets` from the admitted-run owner's
 *     authenticated `currentAllocation` (`maxCostMicroUSD` -> `maxCostMicrousd`), keeping the allocation hash and tariff digest. */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256 as hash,validateShape,assertProposalIntegrity} from '../../../packages/contracts/validate.mjs';
import {data,own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateCommandShape} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandSourceBody,commandSourceTool} from '../../control/commands/source-projection.mjs';
export const EXECUTION_TOKEN_TYPE='capiro-meri-execution+jwt';
export const EXECUTION_AUDIENCE='meri-gateway';
export const EXECUTION_ACTIONS=Object.freeze(['command.execute']);
/** Draft §2/§4 bounds. */
export const EXECUTION_LIMITS=Object.freeze({maxTokenBytes:8192,maxSigningInputBytes:4096,maxLifetimeSeconds:120,maxSkewMs:2000});
/** Commands the capability may execute (Meri `APPROVABLE_ACTIONS`, draft §2 `execution.action`). */
export const EXECUTION_COMMAND_ACTIONS=Object.freeze(['task.create']);
const KID=/^[A-Za-z0-9._-]{1,64}$/u,B64=/^[A-Za-z0-9_-]+$/u,DIGEST=/^[a-f0-9]{64}$/u;
const PAYLOAD_KEYS=['aud','capability','execution','exp','iat','iss','jti','nbf'];
/** Rev 3 `execution` members (closed; Core `MeriExecutionBinding`). */
export const EXECUTION_KEYS=Object.freeze(['action','allocationSha256','approver','argumentsSha256','clientIds','commandSha256','decisionSha256','idempotencyKey','proposalId','qualification','requestId','requestSha256','sourceBodySha256']);
/** Rev 3 `execution.qualification` members: Meri's grant-fact `qualificationBinding`. */
export const QUALIFICATION_KEYS=Object.freeze(['runId','attempt','workerArn','fence','policyRevision']);
const WORKER_ARN=/^arn:aws:ecs:[a-z0-9-]{1,32}:[0-9]{12}:task\/[A-Za-z0-9_-]{1,255}\/[0-9a-f]{32}$/u;
export const executionFault=(code='EXECUTION_CAPABILITY_REFUSED')=>Object.assign(new Error(code),{code});
const refuse=()=>{throw executionFault();};
const mismatch=()=>{throw executionFault('EXECUTION_CAPABILITY_MISMATCH');};
const same=(a,b)=>hash(a)===hash(b);
const STABLE=['tenantId','actorId','conversationId','runId'];
function b64(segment,max){
 if(typeof segment!=='string'||!segment||segment.length>max||!B64.test(segment))refuse();
 const bytes=Buffer.from(segment,'base64url');if(bytes.toString('base64url')!==segment)refuse();return bytes;
}
const text=bytes=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return refuse();}};
const isoSecond=seconds=>new Date(seconds*1000).toISOString();
/** The exact header bytes for a kid (draft §2: `alg`, `typ`, `kid`, in that order). */
export const executionHeader=kid=>JSON.stringify({alg:'EdDSA',typ:EXECUTION_TOKEN_TYPE,kid});
/** Pinned trust: `{issuer, keys:[{kty:'OKP',crv:'Ed25519',x,kid,alg?,use?}]}` -> frozen `{issuer, keys: Map<kid, KeyObject>}`. */
export function compileExecutionTrust(value){
 let v;try{v=data(own(value,['issuer','keys']));}catch{return refuse();}
 if(typeof v.issuer!=='string'||!v.issuer||v.issuer.length>256||!Array.isArray(v.keys)||!v.keys.length||v.keys.length>8)refuse();
 const keys=new Map();
 for(const jwk of v.keys){
  let k;try{k=own(jwk,['kty','crv','x','kid'],['alg','use']);}catch{return refuse();}
  if(k.kty!=='OKP'||k.crv!=='Ed25519'||typeof k.kid!=='string'||!KID.test(k.kid)||keys.has(k.kid)||k.alg!==undefined&&k.alg!=='EdDSA'||k.use!==undefined&&k.use!=='sig'||b64(k.x,64).length!==32)refuse();
  try{keys.set(k.kid,createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:k.x},format:'jwk'}));}catch{refuse();}
 }
 return Object.freeze({issuer:v.issuer,keys});
}
/** Client ids a scope list authorizes, lower-case, sorted and unique (draft §2 `execution.clientIds`). */
export const scopeClientIds=scopes=>[...new Set(scopes.filter(s=>s.kind==='client').map(s=>String(s.resourceId).toLowerCase()))].sort();
/** Meri `CapabilityClaims` JSON in the contract's member order (the gateway parses it; the order matches Core's `claimsJson`). */
function claimsJsonOf(c){
 const b=c.binding,budgets=c.budgets;
 return JSON.stringify({capabilityId:c.capabilityId,issuer:c.issuer,audience:c.audience,
  binding:{tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,runId:b.runId,attemptId:b.attemptId,workerId:b.workerId,writerFence:b.writerFence},
  actions:[...c.actions],scopes:c.scopes.map(s=>({tenantId:s.tenantId,kind:s.kind,resourceId:s.resourceId,policyRevision:s.policyRevision})),
  issuedAt:c.issuedAt,expiresAt:c.expiresAt,policyRevision:c.policyRevision,
  budgets:{maxTurns:budgets.maxTurns,maxRuntimeSeconds:budgets.maxRuntimeSeconds,maxCostMicrousd:budgets.maxCostMicrousd,maxOutputBytes:budgets.maxOutputBytes}});
}
/** Draft §4. `nowMs` is the verifier's own clock; `skewMs` (<= 2000) tolerates only an issuer clock that is AHEAD for `iat`. */
export function verifyExecutionCapability(credential,trust,{nowMs,skewMs=0}={}){
 if(!trust||!(trust.keys instanceof Map)||typeof trust.issuer!=='string'||!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(skewMs)||skewMs<0||skewMs>EXECUTION_LIMITS.maxSkewMs)refuse();
 if(typeof credential!=='string'||Buffer.byteLength(credential)>EXECUTION_LIMITS.maxTokenBytes)refuse();
 const parts=credential.split('.');if(parts.length!==3)refuse();
 const signingInput=parts[0]+'.'+parts[1];if(Buffer.byteLength(signingInput)>EXECUTION_LIMITS.maxSigningInputBytes)refuse();
 let header;try{header=JSON.parse(text(b64(parts[0],512)));}catch{return refuse();}
 const kid=header?.kid;if(typeof kid!=='string'||!KID.test(kid)||text(b64(parts[0],512))!==executionHeader(kid))refuse();
 const key=trust.keys.get(kid);if(!key)refuse();
 const signature=b64(parts[2],128);if(signature.length!==64)refuse();
 let valid=false;try{valid=verifySignature(null,Buffer.from(signingInput,'utf8'),key,signature);}catch{valid=false;}
 if(!valid)refuse();
 const payloadText=text(b64(parts[1],EXECUTION_LIMITS.maxSigningInputBytes*2));
 let payload;try{payload=JSON.parse(payloadText);}catch{return refuse();}
 if(canonicalize(payload)!==payloadText)refuse();
 let p;try{p=data(own(payload,PAYLOAD_KEYS));}catch{return refuse();}
 if(p.iss!==trust.issuer||p.aud!==EXECUTION_AUDIENCE||![p.iat,p.nbf,p.exp].every(Number.isSafeInteger)||p.nbf!==p.iat||p.iat<1||p.exp<=p.iat||p.exp-p.iat>EXECUTION_LIMITS.maxLifetimeSeconds||
  p.iat*1000>nowMs+skewMs||nowMs>=p.exp*1000)refuse();
 const c=p.capability;
 try{validateShape('CapabilityClaims',c);}catch{return refuse();}
 if(c.capabilityId!==p.jti||c.issuer!==p.iss||c.audience!==p.aud||c.issuedAt!==isoSecond(p.iat)||c.expiresAt!==isoSecond(p.exp)||!same(c.actions,EXECUTION_ACTIONS)||
  c.scopes.some(s=>s.tenantId!==c.binding.tenantId||s.policyRevision!==c.policyRevision)||new Set(c.scopes.map(hash)).size!==c.scopes.length)refuse();
 let e;try{e=own(p.execution,EXECUTION_KEYS);}catch{return refuse();}
 if(!EXECUTION_COMMAND_ACTIONS.includes(e.action)||['argumentsSha256','sourceBodySha256','commandSha256','decisionSha256','requestSha256','allocationSha256'].some(k=>typeof e[k]!=='string'||!DIGEST.test(e[k]))||
  !Array.isArray(e.clientIds)||!same(e.clientIds,scopeClientIds(c.scopes)))refuse();
 // Rev 3: the qualification is self-consistent with the executor binding and revision; the admitted facts are compared later.
 let q;try{q=own(e.qualification,QUALIFICATION_KEYS);}catch{return refuse();}
 if(q.runId!==c.binding.runId||!Number.isSafeInteger(q.attempt)||q.attempt<1||q.attempt>2147483647||typeof q.workerArn!=='string'||!WORKER_ARN.test(q.workerArn)||q.fence!==c.binding.writerFence||q.policyRevision!==c.policyRevision)refuse();
 try{validateShape('Identity',e.approver);}catch{return refuse();}
 if(!same(e.approver,{tenantId:c.binding.tenantId,actorId:c.binding.actorId}))refuse();
 const request={contractVersion:'0.1.0',requestId:e.requestId,capabilityId:p.jti,executorBinding:c.binding,proposalId:e.proposalId,commandSha256:e.commandSha256,idempotencyKey:e.idempotencyKey};
 try{validateShape('CommandExecutionRequest',request);}catch{return refuse();}
 if(hash(request)!==e.requestSha256)refuse();
 return data({kid,claims:c,claimsJson:claimsJsonOf(c),execution:e,request,issuedAtMs:p.iat*1000,expiresAtMs:p.exp*1000,
  credentialSha256:createHash('sha256').update(credential,'utf8').digest('hex')});
}
/** Dot item 3. The immutable argument hash Core signs, and SEPARATELY the hash of the exact Core tool body Meri's source sends. */
export function executionBodyBinding(command){
 if(!EXECUTION_COMMAND_ACTIONS.includes(command?.action))mismatch();
 // Production task arguments are exactly {title, clientId|null, dueDate|null}; a title-only codec example has no projection.
 try{validateCommandShape('TaskCreateArguments',command.arguments);}catch{return mismatch();}
 return data({argumentsSha256:hash(command.arguments),sourceTool:commandSourceTool(command.action),sourceBodySha256:hash(commandSourceBody(command,[]))});
}
/** The trusted comparison of a verified capability to the actual execution request, proposal and (optional) current decision,
 * allocation digest and admitted qualification (Core rev 3 `assertExecutionMatches`). The source body is always compared: it is
 * Meri's own projection of the approved command. */
export function assertExecutionCorrelation({verified,proposal,executorBinding,requestId,decision,allocationSha256,qualification}){
 try{assertProposalIntegrity(proposal);}catch{return mismatch();}
 const c=verified.claims,e=verified.execution,command=proposal.command,body=executionBodyBinding(command);
 if(e.action!==command.action||e.proposalId!==proposal.proposalId||e.commandSha256!==proposal.commandSha256||e.idempotencyKey!==command.idempotencyKey||
  e.argumentsSha256!==body.argumentsSha256||e.sourceBodySha256!==body.sourceBodySha256||!same(c.scopes,command.scopes)||!same(e.clientIds,scopeClientIds(command.scopes))||
  !same(e.approver,proposal.requiredApprover)||STABLE.some(k=>c.binding[k]!==command.binding[k]))mismatch();
 if(executorBinding!==undefined&&!same(c.binding,executorBinding))mismatch();
 if(requestId!==undefined&&e.requestId!==requestId)mismatch();
 if(allocationSha256!==undefined&&e.allocationSha256!==allocationSha256)mismatch();
 if(qualification!==undefined&&!same(e.qualification,qualification))mismatch();
 if(decision!==undefined){
  try{validateShape('ApprovalDecision',decision);}catch{return mismatch();}
  if(hash(decision)!==e.decisionSha256||decision.decision!=='approved'||decision.proposalId!==proposal.proposalId||decision.commandSha256!==proposal.commandSha256||
   !same(decision.approver,proposal.requiredApprover)||decision.policyRevision!==c.policyRevision)mismatch();
 }
 return body;
}
/** Dot item 1. `currentAllocationJson` is `createPostgresAdmittedRunOwner(...).currentAllocation(binding)` output. Numbers are
 * copied exactly; a caller-supplied value under a ceiling is never accepted as allocation proof. */
export function capabilityBudgets(currentAllocationJson){
 let v;try{if(typeof currentAllocationJson!=='string'||Buffer.byteLength(currentAllocationJson)>131072)throw 0;
  v=data(own(JSON.parse(currentAllocationJson),['binding','policyRevision','deadlineMs','checkedAtMs','allocation','allocationSha256']));validateShape('RunBinding',v.binding);}
 catch{throw executionFault('EXECUTION_ALLOCATION_REFUSED');}
 const a=v.allocation,b=a?.budgets;
 if(typeof v.allocationSha256!=='string'||!DIGEST.test(v.allocationSha256)||hash(a)!==v.allocationSha256||typeof v.policyRevision!=='string'||!DIGEST.test(v.policyRevision)||
  !Number.isSafeInteger(v.deadlineMs)||!Number.isSafeInteger(v.checkedAtMs)||!b||['maxTurns','maxRuntimeSeconds','maxCostMicroUSD','maxOutputBytes'].some(k=>!Number.isSafeInteger(b[k])||b[k]<1)||
  STABLE.some(k=>a.run?.[k]!==v.binding[k])||typeof a.schedule?.revision!=='string'||!Array.isArray(a.schedule?.operations))throw executionFault('EXECUTION_ALLOCATION_REFUSED');
 const budgets={maxTurns:b.maxTurns,maxRuntimeSeconds:b.maxRuntimeSeconds,maxCostMicrousd:b.maxCostMicroUSD,maxOutputBytes:b.maxOutputBytes};
 try{validateShape('Budgets',budgets);}catch{throw executionFault('EXECUTION_ALLOCATION_REFUSED');}
 return data({budgets,binding:v.binding,policyRevision:v.policyRevision,deadlineMs:v.deadlineMs,checkedAtMs:v.checkedAtMs,allocationSha256:v.allocationSha256,
  scheduleRevision:a.schedule.revision,tariffsSha256:hash(a.schedule.operations)});
}
/** A UUIDv4-shaped request id derived from the proposal and the exact executor binding. Core keys its issuance ledger on
 * (tenant, proposal, run, attempt) and answers a live capability again; a deterministic id makes that replay correlate. */
export function executionRequestId({proposalId,commandSha256,executorBinding}){
 const h=createHash('sha256').update(canonicalize({purpose:'meri-execution-request/v1',proposalId,commandSha256,executorBinding}),'utf8').digest('hex').split('');
 h[12]='4';h[16]='89ab'[parseInt(h[16],16)&3];
 const s=h.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20,32)}`;
}
