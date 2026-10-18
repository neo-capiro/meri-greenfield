/** The run's CURRENT authority, Meri side, established per check from Core's existing routes with the user's own live-session
 * bearer (RC1 option A relay; lane T, PR #121 6247577743 item 5). Construction is inert: no secret read, SQL, fetch or timer.
 *
 * One supplier, two consumers:
 *  - reads: `reads-composer.mjs` `gateway.authority` = `createCurrentToolAuthority({capabilityAction:'tool.read'})` over the
 *    four ports here (`verifyCapability`, `currentRun`, `authorizeBusiness`, `authorizeSources`) and `gateway.limits`;
 *  - write intents: `execution-composition.mjs` `createControlIntentExecution({owners})` = `core.getCredentials`,
 *    `preparePolicy`, `authorizeBusiness`, `authorizeSources`, `currentRights`, in lane E's exact port shapes.
 *
 * Core routes (capiro-backend #84 @ 0304b0ef; all existing and mounted; native user bearer + `standard_user`; no service secret):
 *  - POST /api/clio/application-authority/identity    -> {principal,identityRevision,checkedAtMs,expiresAtMs}
 *  - POST /api/clio/application-authority/membership  -> {tenantId,actorId,status:'active',role,permissions,clientIds,membershipRevision,checkedAtMs,expiresAtMs}
 *  - POST /api/clio/application-authority/context     -> {identitySha256,principal,identityRevision,conversationId,selectedClientId,contextRevision,checkedAtMs,expiresAtMs}
 * The membership read is the canonical product gate (`product-access/core-membership.mjs`, the same owner the decide route and
 * the action sessions use). Core answers `permissions:['memory.propose.firm']` for a standard user (its spec, lines 243/365),
 * which `native-read-credentials/core-client.mjs` refuses; that client is therefore not used here.
 *
 * Meri-local facts (trusted owners, read fresh per call): the task grant row (`meri_product_budget.grants` by capability digest),
 * the run's ADMITTED allocation record and admitted-run owner (`createAdmittedRunSource` -> `createPostgresAdmittedRunOwner`),
 * the run row's scopes (exactly one client scope, `exactInitialScopes`) and the stored approval metadata.
 *
 * One observation = bearer lookup -> identity -> membership (gate: identity + membership) -> [context for the run's conversation
 * and selected client] -> identity -> bearer re-lookup (the same live session). Every receipt is a fresh correlated Core answer
 * bounded by its own clocks; `checkedAtMs` is Meri's clock after the last answer and `expiresAtMs` = min(every Core expiry, the
 * session expiry, the caller deadline, started + maxLeaseMs). Nothing is cached between calls.
 *
 * Credential invariant (Core #83): the relayed bearer is refused when it equals, by digest, any candidate credential file or any
 * configured service secret file (re-read per call). The marked control credential never reaches these routes through here.
 * Failures are closed `GatewayDenied` codes: UNAVAILABLE (no live session, Core unreachable, unbound pool, no route or owner),
 * ACCESS_DENIED (any mismatch, stale, future or expired fact), DEADLINE / CANCELLED from the lifetime. The reads authority
 * collapses every port failure to ACCESS_DENIED itself; the typed codes serve the execution owners and tests. */
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertSubject} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeReadFailureCode} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {GatewayDenied,deny,safeFailure} from '../../gateway/dispatch/operation-result.mjs';
import {createCurrentToolAuthority} from '../../gateway/authorization/current-tool-authority.mjs';
import {PostgresBudgetStore} from '../../gateway/budget/postgres-budget-store.mjs';
import {allocation as parseAllocation,parseToolGrantFacts} from '../../gateway/budget/tool-budget-binding.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createPostgresApprovalMetadataStore} from '../../control/commands/approval-metadata/index.mjs';
import {createAdmittedRunSource} from './execution-composition.mjs';
import {compileGatewayLimits,compileCurrentAuthorityLimits} from './current-authority-limits.mjs';

/** `CapabilityClaims.issuer` of the reads claims projected from the admitted task grant (Meri-local; never a Core token). */
export const CURRENT_AUTHORITY_CLAIMS_ISSUER='meri-control:admitted-task-grant';
/** Core role -> Meri grants. Core's membership route admits only roles >= standard_user and carries no finer command/read right
 * (D25: its `permissions` concern memory proposals), so every active member holds the run's read and approved-command grants.
 * The table is closed so that a narrowing is one edit here, not a scattered rule. */
export const ROLE_GRANTS=Object.freeze({standard_user:Object.freeze(['tool.read','command.execute']),user_admin:Object.freeze(['tool.read','command.execute']),capiro_admin:Object.freeze(['tool.read','command.execute'])});
export const POLICY_PHASES=Object.freeze(['prepare','before_release','before_read','read_release']);
/** The approval-metadata actions this policy answers and their canonical operation (approval.mjs `APPROVABLE_ACTIONS`). */
export const POLICY_OPERATIONS=Object.freeze({'task.create':Object.freeze({id:'create_task',version:'0.2.0'})});
export const CREDENTIAL_PURPOSES=Object.freeze(['approval.execution']);
const RUN_STATES=Object.freeze(['queued','starting','running']);
const TOKEN=/^[\x21-\x7e]{1,8192}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,HEX64=/^[a-f0-9]{64}$/u;
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>hash(a)===hash(b);
const ordinary=fn=>typeof fn==='function'&&!types.isProxy(fn);
const iso=ms=>new Date(ms).toISOString();
const filePath=value=>{if(typeof value!=='string'||!isAbsolute(value)||value.includes('/../')||value.length>4096)deny('GATEWAY_CONFIGURATION');return value;};
const ownedValue=(value,name)=>{if(value===null||typeof value!=='object'||types.isProxy(value))return undefined;const d=Object.getOwnPropertyDescriptor(value,name);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const tokenOf=bytes=>{const v=Buffer.isBuffer(bytes)?bytes.toString('utf8').trim():null;return v!==null&&TOKEN.test(v)?v:null;};
/** The run's selected client: run scopes are exactly one client scope (`exactInitialScopes`), lower-case UUID. */
export function selectedClientOf(scopes){
 if(!Array.isArray(scopes)||scopes.length!==1)return null;
 const scope=scopes[0],id=typeof scope?.resourceId==='string'?scope.resourceId.toLowerCase():null;
 return scope?.kind==='client'&&id!==null&&UUID.test(id)?id:null;
}
/** Every foreign failure becomes one closed gateway code; owned gateway failures pass through unchanged. */
function closed(error,fallback){
 const owned=safeFailure(error);if(owned.message!=='INTERNAL_ERROR')return owned;
 const code=nativeReadFailureCode(error)??productFailure(error)?.code??ownedValue(error,'code');
 if(code==='DEADLINE'||code==='CANCELLED')return new GatewayDenied(code);
 if(['ACCESS_DENIED','MEMBERSHIP_REVOKED','MEMBERSHIP_CHANGED','UNAUTHENTICATED'].includes(code))return new GatewayDenied('ACCESS_DENIED');
 return new GatewayDenied(fallback);
}

/** The live-session bearer for exactly one run and selected client. Never a candidate credential or a service secret. */
function createBearerSource({nativeCredentials,readSecret,reservedFiles,secretFiles,now}){
 const method=nativeCredentials!==null&&typeof nativeCredentials==='object'&&!types.isProxy(nativeCredentials)?Object.getOwnPropertyDescriptor(nativeCredentials,'nativeCredentialFor'):undefined;
 if(!method||!Object.hasOwn(method,'value')||!ordinary(method.value))deny('GATEWAY_CONFIGURATION');
 const relay=method.value;let forbidden=null;
 async function digestOf(path){let token;try{token=tokenOf(await readSecret(path));}catch{deny('UNAVAILABLE');}if(token===null)deny('UNAVAILABLE');return token;}
 // Candidate credential digests are read once (they never rotate without a restart); only digests are kept.
 async function reserved(){if(forbidden===null){const digests=new Set();for(const path of reservedFiles)digests.add(sha(await digestOf(path)));forbidden=digests;}return forbidden;}
 function lookup({binding,selectedClientId,signal}){
  let issued;try{issued=data(own(Reflect.apply(relay,nativeCredentials,[{binding,selectedClientId,...(signal===undefined?{}:{signal})}]),['credential','expiresAtMs']));}catch{deny('UNAVAILABLE');}
  if(typeof issued.credential!=='string'||!TOKEN.test(issued.credential)||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=now())deny('UNAVAILABLE');
  return issued;
 }
 async function bearerFor({binding,selectedClientId,signal}){
  const first=lookup({binding,selectedClientId,signal}),digest=sha(first.credential);
  if((await reserved()).has(digest))deny('UNAVAILABLE');
  // Service secret files are re-read on every call (rotation without restart); a bearer equal to one fails closed.
  for(const path of secretFiles)if(sha(await digestOf(path))===digest)deny('UNAVAILABLE');
  // The file reads awaited: the same live session must still hold the same bearer (not expired, revoked or replaced).
  const second=lookup({binding,selectedClientId,signal});if(second.credential!==first.credential)deny('UNAVAILABLE');
  return Object.freeze({credential:first.credential,expiresAtMs:Math.min(first.expiresAtMs,second.expiresAtMs),digest});
 }
 /** The verified service identity for one Core route, re-read per call and never a candidate credential. */
 async function serviceSecret(path){const token=await digestOf(path);if((await reserved()).has(sha(token)))deny('UNAVAILABLE');return token;}
 return Object.freeze({bearerFor,serviceSecret});
}

export function createCurrentAuthorityAdapters(configuration){
 const c=own(configuration,['origin','nativeCredentials','readSecret','reservedFiles','now'],['fetchImpl','newId','secretFiles','serviceSecretFile','coreOrigin','sourceEnabled','limits','capabilityAction']);
 const now=c.now,newId=c.newId??randomUUID,fetchImpl=c.fetchImpl??globalThis.fetch,capabilityAction=c.capabilityAction??'tool.read';
 const limits=compileCurrentAuthorityLimits(c.limits),sourceEnabled=c.sourceEnabled??false;
 let origin,coreOrigin;
 try{for(const value of [c.origin,c.coreOrigin??c.origin]){const url=new URL(value);if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error();}origin=c.origin;coreOrigin=c.coreOrigin??c.origin;}
 catch{deny('GATEWAY_CONFIGURATION');}
 if(!ordinary(now)||!ordinary(newId)||!ordinary(fetchImpl)||!ordinary(c.readSecret)||typeof sourceEnabled!=='boolean'||!['tool.read','command.execute'].includes(capabilityAction)||
  !Array.isArray(c.reservedFiles)||!c.reservedFiles.length||c.secretFiles!==undefined&&!Array.isArray(c.secretFiles))deny('GATEWAY_CONFIGURATION');
 const reservedFiles=Object.freeze(c.reservedFiles.map(filePath)),secretFiles=Object.freeze((c.secretFiles??[]).map(filePath)),serviceSecretFile=c.serviceSecretFile===undefined?undefined:filePath(c.serviceSecretFile);
 if(new Set(reservedFiles).size!==reservedFiles.length||secretFiles.some(path=>reservedFiles.includes(path))||serviceSecretFile!==undefined&&reservedFiles.includes(serviceSecretFile))deny('GATEWAY_CONFIGURATION');
 const bearer=createBearerSource({nativeCredentials:c.nativeCredentials,readSecret:c.readSecret,reservedFiles,secretFiles:[...new Set([...secretFiles,...(serviceSecretFile===undefined?[]:[serviceSecretFile])])],now});
 const bound=Math.min(limits.maxRequestMs,30000);
 const identity=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled:true,limits:{maxRequestMs:bound,maxResponseBytes:16384}});
 const membership=createCoreMembershipGate({origin,identityContext:{verifyIdentity:call=>identity.readIdentity(call)},fetchImpl,now,limits:{maxRequestMs:bound,maxFactBytes:limits.maxFactBytes}});
 let stores=null;

 /** One bounded lifetime per port call: caller deadline ∧ maxRequestMs ∧ every receipt expiry folded in through `limit`. */
 function lifetime(deadlineMs,signal){
  nativeSignal(signal);const started=now();if(!Number.isSafeInteger(started)||started<0)deny('UNAVAILABLE');
  if(deadlineMs!==undefined&&!Number.isSafeInteger(deadlineMs))deny('ACCESS_DENIED');
  let cutoff=Math.min(started+limits.maxRequestMs,deadlineMs??started+limits.maxRequestMs);
  const life=createOperationLifetime({deadlineMs:cutoff,now,signal,errorFactory:code=>new GatewayDenied(code)});
  return {life,started,deadline:()=>cutoff,limit(next){if(!Number.isSafeInteger(next))deny('ACCESS_DENIED');cutoff=Math.min(cutoff,next);life.limitDeadline(cutoff);},close:()=>life.close()};
 }
 /** A Core receipt correlated to Meri's clock: checked within this call, unexpired now; its expiry bounds the lifetime. */
 function fresh(v,started,l){
  const at=now();l.life.check();
  if(!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)deny('ACCESS_DENIED');
  l.limit(v.expiresAtMs);return v;
 }
 const bound_=()=>{if(stores===null)deny('UNAVAILABLE');return stores;};

 /** One current-authority observation for a run and its selected client (see the module header). */
 async function observe({binding,selectedClientId,signal,deadlineMs,context}){
  const l=lifetime(deadlineMs,signal);
  try{
   const issued=await l.life.run(()=>bearer.bearerFor({binding,selectedClientId,signal:l.life.signal}));l.limit(issued.expiresAtMs);
   const credential=issued.credential;
   const identify=async()=>{const began=now();let r;try{r=await l.life.run(signal=>identity.readIdentity({credential,deadlineMs:l.deadline(),signal}));}catch(error){throw closed(error,'UNAVAILABLE');}return fresh(r,began,l);};
   const before=await identify();
   if(before.principal.tenantId!==binding.tenantId||before.principal.actorId!==binding.actorId)deny('ACCESS_DENIED');
   let admitted;try{admitted=await l.life.run(signal=>membership.admit({credential,signal,deadlineMs:l.deadline()}));}catch(error){throw closed(error,'UNAVAILABLE');}
   let member;try{member=data(own(admitted,['principal','expiresAtMs']));own(member.principal,['tenantId','actorId','role','permissions','clientIds','membershipRevision']);}catch{deny('ACCESS_DENIED');}
   if(!Number.isSafeInteger(member.expiresAtMs)||member.expiresAtMs<=now())deny('ACCESS_DENIED');l.limit(member.expiresAtMs);
   const p=member.principal;
   if(p.tenantId!==binding.tenantId||p.actorId!==binding.actorId||!Object.hasOwn(ROLE_GRANTS,p.role)||!Array.isArray(p.clientIds)||!p.clientIds.includes(selectedClientId))deny('ACCESS_DENIED');
   let ctx=null;
   if(context){
    const began=now();let r;
    try{r=await l.life.run(signal=>identity.readContext({credential,deadlineMs:l.deadline(),identitySha256:hash(before),conversationId:binding.conversationId,clientId:selectedClientId,signal}));}catch(error){throw closed(error,'UNAVAILABLE');}
    ctx=fresh(r,began,l);
    if(ctx.identitySha256!==hash(before)||!same(ctx.principal,before.principal)||ctx.identityRevision!==before.identityRevision||ctx.conversationId!==binding.conversationId||ctx.selectedClientId!==selectedClientId)deny('ACCESS_DENIED');
   }
   const after=await identify();
   if(!same(after.principal,before.principal)||after.identityRevision!==before.identityRevision)deny('ACCESS_DENIED');
   // The Core calls awaited: the same live session must still hold the same bearer.
   const again=await l.life.run(()=>bearer.bearerFor({binding,selectedClientId,signal:l.life.signal}));if(again.credential!==credential)deny('UNAVAILABLE');
   const checkedAtMs=now(),expiresAtMs=Math.min(l.deadline(),l.started+limits.maxLeaseMs,issued.expiresAtMs,again.expiresAtMs);
   l.life.check();if(!Number.isSafeInteger(checkedAtMs)||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=checkedAtMs)deny('ACCESS_DENIED');
   return Object.freeze({principal:Object.freeze({tenantId:p.tenantId,actorId:p.actorId}),identityRevision:before.identityRevision,actorRole:p.role,clientIds:p.clientIds,membershipRevision:p.membershipRevision,
    contextRevision:ctx?.contextRevision??null,bearerSha256:issued.digest,checkedAtMs,expiresAtMs});
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** The run row's current scopes and selected client (the trusted Meri selection the run was prepared with). */
 async function runRow(binding,l){
  const {conversations}=bound_();let saved;
  try{saved=await l.life.run(()=>conversations.readOptional(binding,{},l.life.check));}catch(error){throw closed(error,'UNAVAILABLE');}
  if(saved===null)deny('UNAVAILABLE');
  let run;try{run=data(saved.run);}catch{deny('ACCESS_DENIED');}
  if(!run||typeof run!=='object'||!same(run.binding,binding)||!RUN_STATES.includes(run.state)||typeof run.policyRevision!=='string'||!run.policyRevision||!Array.isArray(run.scopes))deny('ACCESS_DENIED');
  for(const scope of run.scopes){try{validateShape('Scope',scope);}catch{deny('ACCESS_DENIED');}if(scope.tenantId!==binding.tenantId||scope.policyRevision!==run.policyRevision)deny('ACCESS_DENIED');}
  const selectedClientId=selectedClientOf(run.scopes);if(selectedClientId===null)deny('ACCESS_DENIED');
  return Object.freeze({scopes:run.scopes,policyRevision:run.policyRevision,selectedClientId});
 }
 /** The admitted run and its fresh current-run observation (`createPostgresAdmittedRunOwner.currentTaskRun`). */
 async function currentRunFact(binding,l){
  const {admitted}=bound_();let run;
  try{run=await l.life.run(signal=>admitted.admittedFor({binding,signal}));}catch(error){throw closed(error,'UNAVAILABLE');}
  // Observation only: the owner's read-only committed snapshot (same admission predicate, no budget-row lock).
  const began=now();let raw;try{raw=await l.life.run(signal=>run.owner.currentTaskRun(binding,{signal}));}catch(error){throw closed(error,'UNAVAILABLE');}
  let fact;try{if(typeof raw!=='string'||Buffer.byteLength(raw)>limits.maxFactBytes)throw 0;fact=data(own(JSON.parse(raw),['binding','policyRevision','deadlineMs','checkedAtMs']));}catch{deny('UNAVAILABLE');}
  if(!same(fact.binding,binding)||typeof fact.policyRevision!=='string'||!HEX64.test(fact.policyRevision)||!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<began||fact.checkedAtMs>now()||!Number.isSafeInteger(fact.deadlineMs)||fact.deadlineMs<=now())deny('ACCESS_DENIED');
  l.limit(fact.deadlineMs);return {run,fact,raw};
 }
 const dbTime=value=>{if(!(value instanceof Date)||!Number.isSafeInteger(value.getTime()))deny('UNAVAILABLE');return value.getTime();};

 /** reads: the presented task capability -> `CapabilityClaims` projected from its ACTIVE admitted grant and the run's scopes. */
 async function verifyCapability(credential,options={}){
  const {signal}=own(options,[],['signal']);nativeSignal(signal);
  if(typeof credential!=='string'||!TOKEN.test(credential))deny('ACCESS_DENIED');
  const {budget}=bound_(),digest=sha(credential),l=lifetime(undefined,signal),t=budget.tables;
  try{
   let rows;
   try{rows=await l.life.run(()=>budget.transact(async client=>(await client.query(`SELECT g.grant_id,g.run_id,g.state,g.expires_at,g.policy_revision,b.facts,a.allocation,a.allocation_sha256,a.started_at FROM ${t.grants} g JOIN ${t.tool_grant_bindings} b ON b.grant_id=g.grant_id JOIN ${t.tool_run_allocations} a ON a.run_id=b.run_id WHERE g.capability_sha256=$1`,[digest])).rows,l.life.check,undefined,true));}
   catch(error){throw closed(error,'UNAVAILABLE');}
   if(!Array.isArray(rows)||rows.length!==1)deny('ACCESS_DENIED');
   const row=rows[0];if(!row||typeof row!=='object'||row.state!=='ACTIVE')deny('ACCESS_DENIED');
   const expiresAt=dbTime(row.expires_at),startedAt=dbTime(row.started_at),at=now();
   let allocation,facts;try{allocation=parseAllocation(JSON.stringify(row.allocation));facts=parseToolGrantFacts(JSON.stringify(row.facts),allocation);}catch{deny('ACCESS_DENIED');}
   if(facts.grantId!==row.grant_id||!timingSafeEqual(Buffer.from(facts.capabilitySha256,'hex'),Buffer.from(digest,'hex'))||facts.binding.runId!==row.run_id||hash(allocation)!==row.allocation_sha256||
    facts.allocationSha256!==row.allocation_sha256||facts.qualificationBinding.policyRevision!==row.policy_revision||expiresAt<=at||startedAt>at)deny('ACCESS_DENIED');
   l.limit(expiresAt);
   const binding=facts.binding,{run,fact}=await currentRunFact(binding,l);
   // The grant must be one of the run's ADMITTED grant set, and the admitted facts must be exactly this allocation.
   if(!run.grantFactsJsons.some(text=>{try{return same(JSON.parse(text),facts);}catch{return false;}})||fact.policyRevision!==facts.qualificationBinding.policyRevision||hash(JSON.parse(run.allocationJson))!==facts.allocationSha256)deny('ACCESS_DENIED');
   const selected=await runRow(binding,l);if(selected.policyRevision!==fact.policyRevision)deny('ACCESS_DENIED');
   const b=allocation.budgets,claims={capabilityId:facts.grantId,issuer:CURRENT_AUTHORITY_CLAIMS_ISSUER,audience:'meri-gateway',binding,actions:[capabilityAction],scopes:selected.scopes,
    issuedAt:iso(startedAt),expiresAt:iso(Math.min(expiresAt,fact.deadlineMs)),policyRevision:fact.policyRevision,budgets:{maxTurns:b.maxTurns,maxRuntimeSeconds:b.maxRuntimeSeconds,maxCostMicrousd:b.maxCostMicroUSD,maxOutputBytes:b.maxOutputBytes}};
   try{validateShape('CapabilityClaims',claims);}catch{deny('ACCESS_DENIED');}
   l.life.check();return JSON.stringify(claims);
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** The admitted-run owner's own JSON observation `{binding,policyRevision,deadlineMs,checkedAtMs}`, fresh per call (read-only). */
 async function currentRun(binding,options={}){
  let b;try{b=data(binding);validateShape('RunBinding',b);}catch{deny('ACCESS_DENIED');}
  const {signal}=own(options,[],['signal']),l=lifetime(undefined,signal);
  try{return (await currentRunFact(b,l)).raw;}catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 function claimsOf(value){let claims;try{claims=data(value);validateShape('CapabilityClaims',claims);}catch{deny('ACCESS_DENIED');}return claims;}
 /** Core's current membership, client visibility and conversation context for the claims' run -> one allowed decision. */
 async function authorizeBusiness(value){
  const v=own(value,['claims','operation','requiredGrants'],['input','signal']);nativeSignal(v.signal);
  const claims=claimsOf(v.claims);let operation,requiredGrants,input;
  try{operation=data(own(v.operation,['id','version']));requiredGrants=data(v.requiredGrants);input=v.input===undefined?undefined:data(v.input);}catch{deny('ACCESS_DENIED');}
  if(typeof operation.id!=='string'||typeof operation.version!=='string'||!Array.isArray(requiredGrants)||!requiredGrants.length||requiredGrants.some(g=>typeof g!=='string'))deny('ACCESS_DENIED');
  const selectedClientId=selectedClientOf(claims.scopes);if(selectedClientId===null)deny('ACCESS_DENIED');
  // A UUID client selector in the input must be the run's client; a name is resolved later by the native owner (check-ref).
  const named=input!==null&&typeof input==='object'&&typeof input.clientId==='string'?input.clientId.trim().toLowerCase():null;
  if(named!==null&&UUID.test(named)&&named!==selectedClientId)deny('ACCESS_DENIED');
  const l=lifetime(Date.parse(claims.expiresAt),v.signal);
  try{
   const o=await observe({binding:claims.binding,selectedClientId,signal:l.life.signal,deadlineMs:l.deadline(),context:true});
   const grants=requiredGrants.filter(grant=>ROLE_GRANTS[o.actorRole].includes(grant)&&claims.actions.includes(grant));
   const decisionId=newId();if(typeof decisionId!=='string'||!UUID.test(decisionId))deny('UNAVAILABLE');
   const actor={tenantId:claims.binding.tenantId,actorId:claims.binding.actorId};
   const subject={kind:'client',entityType:'client',entityIds:[selectedClientId],tenantId:actor.tenantId,actorId:actor.actorId,authorizationDecisionId:decisionId,policyRevision:claims.policyRevision,scopes:claims.scopes,rosterVersionId:null};
   const decision={decisionId,actor,operation:`${operation.id}@${operation.version}`,scopes:claims.scopes,policyRevision:claims.policyRevision,evaluatedAt:iso(o.checkedAtMs),decision:'allowed',reasonCode:'CORE_MEMBERSHIP_CONTEXT_CURRENT'};
   try{validateShape('AuthorizationDecision',decision);assertSubject(subject,claims.binding);}catch{deny('ACCESS_DENIED');}
   l.life.check();return JSON.stringify({decision,subject,grants});
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** Core's current membership and client visibility for the subject -> the descriptor's sources, enabled only with G1. */
 async function authorizeSources(value){
  const v=own(value,['claims','subject','sourceRequirements'],['signal']);nativeSignal(v.signal);
  const claims=claimsOf(v.claims);let subject,requirements;
  try{subject=data(v.subject);assertSubject(subject,claims.binding);requirements=data(v.sourceRequirements);}catch{deny('ACCESS_DENIED');}
  const selectedClientId=selectedClientOf(claims.scopes);
  if(selectedClientId===null||subject.policyRevision!==claims.policyRevision||subject.scopes.some(scope=>!claims.scopes.some(candidate=>same(candidate,scope)))||
   (subject.kind==='client'||subject.entityType==='client')&&(subject.kind!=='client'||subject.entityType!=='client'||subject.entityIds.length!==1||subject.entityIds[0].toLowerCase()!==selectedClientId)||
   !Array.isArray(requirements)||requirements.some(r=>typeof r?.sourceId!=='string'||!r.sourceId))deny('ACCESS_DENIED');
  const sourceIds=[...new Set(requirements.map(r=>r.sourceId))],l=lifetime(Date.parse(claims.expiresAt),v.signal);
  try{
   const o=await observe({binding:claims.binding,selectedClientId,signal:l.life.signal,deadlineMs:l.deadline(),context:false});
   l.life.check();return JSON.stringify({sourceIds,enabled:sourceEnabled===true,policyRevision:claims.policyRevision,checkedAtMs:o.checkedAtMs});
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** Core's current rights for the run's principal at the run's policy revision (`result-release-authority.mjs`). */
 async function currentRights(value){
  const v=own(value,['binding','policyRevision'],['signal','deadlineMs']);nativeSignal(v.signal);
  let binding;try{binding=data(v.binding);validateShape('RunBinding',binding);}catch{deny('ACCESS_DENIED');}
  if(typeof v.policyRevision!=='string'||!v.policyRevision)deny('ACCESS_DENIED');
  const l=lifetime(v.deadlineMs,v.signal);
  try{
   const row=await runRow(binding,l);if(row.policyRevision!==v.policyRevision)deny('ACCESS_DENIED');
   const o=await observe({binding,selectedClientId:row.selectedClientId,signal:l.life.signal,deadlineMs:l.deadline(),context:true});
   l.life.check();return data({tenantId:o.principal.tenantId,actorId:o.principal.actorId,scopes:row.scopes,checkedAtMs:o.checkedAtMs,expiresAtMs:o.expiresAtMs});
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** The approval-metadata policy (`approval-metadata/owner.mjs` `preparePolicy`): scopes and approver under the CURRENT run,
  * client and membership; `prepare` sets the proposal lifetime, every later phase re-affirms the stored proposal unchanged. */
 async function preparePolicy(value){
  const v=own(value,['phase','selection','selectionSha256'],['signal','limitDeadline']);nativeSignal(v.signal);
  if(!POLICY_PHASES.includes(v.phase)||typeof v.selectionSha256!=='string'||!HEX64.test(v.selectionSha256)||v.limitDeadline!==undefined&&!ordinary(v.limitDeadline))deny('ACCESS_DENIED');
  let s;try{s=data(own(v.selection,['phase','operation','action','binding','request','inputSha256','proposalId','commandSha256','recordSha256']));validateShape('RunBinding',s.binding);}catch{deny('ACCESS_DENIED');}
  if(s.phase!==v.phase||hash(s)!==v.selectionSha256||!Object.hasOwn(POLICY_OPERATIONS,s.action)||!same(s.operation,POLICY_OPERATIONS[s.action]))deny('ACCESS_DENIED');
  const binding=s.binding,requiredApprover={tenantId:binding.tenantId,actorId:binding.actorId},l=lifetime(undefined,v.signal);
  try{
   const {fact}=await currentRunFact(binding,l);v.limitDeadline?.(fact.deadlineMs);
   const row=await runRow(binding,l);if(row.policyRevision!==fact.policyRevision)deny('ACCESS_DENIED');
   const o=await observe({binding,selectedClientId:row.selectedClientId,signal:l.life.signal,deadlineMs:l.deadline(),context:true});
   let proposalExpiresAt;
   if(v.phase==='prepare'){
    if(s.proposalId!==null||s.commandSha256!==null||s.recordSha256!==null||typeof s.inputSha256!=='string'||!HEX64.test(s.inputSha256))deny('ACCESS_DENIED');
    proposalExpiresAt=iso(Math.min(now()+limits.proposalTtlMs,fact.deadlineMs));
   }else{
    if(typeof s.proposalId!=='string'||!UUID.test(s.proposalId.toLowerCase())||typeof s.commandSha256!=='string'||!HEX64.test(s.commandSha256))deny('ACCESS_DENIED');
    const {approvalMetadata}=bound_();let stored;
    try{stored=await l.life.run(()=>approvalMetadata.read({tenantId:binding.tenantId,actorId:binding.actorId,proposalId:s.proposalId},l.life.check));}catch(error){throw closed(error,'UNAVAILABLE');}
    if(stored===null)deny('ACCESS_DENIED');
    let p;try{p=data(own(stored,['record','commandContext','commandSha256']));}catch{deny('ACCESS_DENIED');}
    const r=p.record;
    if(!same(r.binding,binding)||typeof r.proposalId!=='string'||r.proposalId.toLowerCase()!==s.proposalId.toLowerCase()||p.commandSha256!==s.commandSha256||r.action!==s.action||!same(r.operation,s.operation)||
     s.recordSha256!==null&&s.recordSha256!==hash(p)||s.request!==null&&!same(r.request,s.request)||s.inputSha256!==null&&r.inputSha256!==s.inputSha256||
     !same(r.scopes,row.scopes)||!same(r.requiredApprover,requiredApprover))deny('ACCESS_DENIED');
    const expiry=Date.parse(r.expiresAt);if(!Number.isSafeInteger(expiry)||iso(expiry)!==r.expiresAt||expiry<=now())deny('ACCESS_DENIED');
    proposalExpiresAt=r.expiresAt;
   }
   const expiresAtMs=Math.min(o.expiresAtMs,fact.deadlineMs,Date.parse(proposalExpiresAt));
   if(!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=now())deny('ACCESS_DENIED');v.limitDeadline?.(expiresAtMs);
   l.life.check();return data({authorized:true,selectionSha256:v.selectionSha256,binding,scopes:row.scopes,requiredApprover,proposalExpiresAt,checkedAtMs:o.checkedAtMs,expiresAtMs});
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** The attended approver's live-session bearer and the verified service identity for Core's issuance call
  * (`execution-issuance.mjs` `getCredentials`); the bearer is correlated at Core before it is handed out. */
 async function getCredentials(value){
  const v=own(value,['tenantId','actorId','purpose','binding'],['signal','deadlineMs']);nativeSignal(v.signal);
  let binding;try{binding=data(v.binding);validateShape('RunBinding',binding);}catch{deny('ACCESS_DENIED');}
  if(!CREDENTIAL_PURPOSES.includes(v.purpose)||v.tenantId!==binding.tenantId||v.actorId!==binding.actorId)deny('ACCESS_DENIED');
  if(serviceSecretFile===undefined)deny('UNAVAILABLE');
  const l=lifetime(v.deadlineMs,v.signal);
  try{
   const row=await runRow(binding,l),selectedClientId=row.selectedClientId;
   const issued=await l.life.run(()=>bearer.bearerFor({binding,selectedClientId,signal:l.life.signal}));l.limit(issued.expiresAtMs);
   const began=now();let receipt;
   try{receipt=await l.life.run(signal=>identity.readIdentity({credential:issued.credential,deadlineMs:l.deadline(),signal}));}catch(error){throw closed(error,'UNAVAILABLE');}
   fresh(receipt,began,l);
   if(receipt.principal.tenantId!==v.tenantId||receipt.principal.actorId!==v.actorId)deny('ACCESS_DENIED');
   const secret=await l.life.run(()=>bearer.serviceSecret(serviceSecretFile));if(sha(secret)===issued.digest)deny('UNAVAILABLE');
   const again=await l.life.run(()=>bearer.bearerFor({binding,selectedClientId,signal:l.life.signal}));if(again.credential!==issued.credential)deny('UNAVAILABLE');
   const expiresAtMs=Math.min(issued.expiresAtMs,again.expiresAtMs,l.deadline());l.life.check();if(expiresAtMs<=now())deny('UNAVAILABLE');
   return data({tenantId:v.tenantId,actorId:v.actorId,bearerToken:issued.credential,serviceSecret:secret,expiresAtMs});
  }catch(error){throw closed(error,'UNAVAILABLE');}finally{l.close();}
 }
 /** Late binding of the trusted control pool (the first trusted product context); once, before any port is used. */
 function bind(context){
  if(stores!==null)deny('GATEWAY_CONFIGURATION');
  const pool=ownedValue(context,'pool'),conversations=ownedValue(context,'conversations'),approvalMetadata=ownedValue(context,'approvalMetadata');
  if(pool===null||typeof pool!=='object'||types.isProxy(pool)||typeof pool.connect!=='function')deny('GATEWAY_CONFIGURATION');
  const store=conversations===undefined?createPostgresConversationStore({pool}):conversations;
  if(typeof store?.readOptional!=='function'||typeof store?.allocations?.read!=='function'||approvalMetadata!==undefined&&typeof approvalMetadata?.read!=='function')deny('GATEWAY_CONFIGURATION');
  let metadata=approvalMetadata;
  stores=Object.freeze({pool,budget:new PostgresBudgetStore(pool,{namespace:'product'}),conversations:store,
   admitted:createAdmittedRunSource({pool,allocations:store.allocations,now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes}}),
   // The approval-metadata store validates the pool's timeouts; it is built on first policy use so a reads-only pool never refuses here.
   get approvalMetadata(){if(metadata===undefined)try{metadata=createPostgresApprovalMetadataStore({pool});}catch{deny('UNAVAILABLE');}return metadata;}});
 }
 const ports=Object.freeze({verifyCapability,currentRun,authorizeBusiness,authorizeSources});
 const inner=createCurrentToolAuthority({ports,now,maxFactBytes:limits.maxFactBytes,capabilityAction});
 const authority=Object.freeze({async identify(value){bound_();return inner.identify(value);},async check(value){bound_();return inner.check(value);}});
 const owners=Object.freeze({core:Object.freeze({origin:coreOrigin,getCredentials}),preparePolicy,authorizeBusiness,authorizeSources,currentRights});
 const missing=()=>Object.freeze([...(stores===null?['pool']:[]),...(serviceSecretFile===undefined?['core.getCredentials:serviceSecretFile']:[])]);
 return Object.freeze({ports,authority,owners,bind,state:()=>stores===null?'unbound':'composed',missing});
}

/** Control-startup composition over the loaded runtime configuration (cli.mjs). Inert. Returns the reads composer's
 * `gateway:{authority,limits}`, lane E's `owners`, and `bind(context)` for the first trusted product context (the intents family
 * wrapper in cli.mjs). The Core origin is the native candidate's identity origin; the intents issuance origin is
 * `intents.execution.coreOrigin`; every candidate credential file is reserved; the read and execution service secret files are
 * the bearer exclusions; `reads.gateway` (optional closed block) sets the gateway limits. */
export function createControlCurrentAuthority(options){
 const c=own(options,['configuration','readSecret','nativeCredentials'],['fetchImpl','now','newId']);
 const configuration=c.configuration;if(configuration===null||typeof configuration!=='object'||types.isProxy(configuration))deny('GATEWAY_CONFIGURATION');
 const candidate=ownedValue(configuration,'nativeCandidate'),identity=ownedValue(candidate,'identity');
 if(!candidate||typeof candidate!=='object'||!identity||typeof identity!=='object')deny('GATEWAY_CONFIGURATION');
 const reads=ownedValue(configuration,'reads')??{},execution=ownedValue(ownedValue(configuration,'intents'),'execution'),limits=ownedValue(configuration,'limits');
 const reservedFiles=[ownedValue(identity,'credentialFile'),ownedValue(candidate,'taskCapabilityFile'),ownedValue(candidate,'controlCapabilityFile'),ownedValue(candidate,'proxyCredentialFile')].map(filePath);
 const secretFiles=[ownedValue(reads,'serviceSecretFile'),ownedValue(reads,'readModeServiceSecretFile')].filter(value=>value!==undefined);
 const requestMs=ownedValue(limits,'requestMs');
 const adapters=createCurrentAuthorityAdapters({origin:ownedValue(identity,'origin'),nativeCredentials:c.nativeCredentials,readSecret:c.readSecret,reservedFiles,secretFiles,
  ...(execution===undefined?{}:{coreOrigin:ownedValue(execution,'coreOrigin'),serviceSecretFile:ownedValue(execution,'serviceSecretFile')}),
  sourceEnabled:ownedValue(configuration,'sourceEnabled')===true,now:c.now??Date.now,...(c.fetchImpl===undefined?{}:{fetchImpl:c.fetchImpl}),...(c.newId===undefined?{}:{newId:c.newId}),
  limits:{maxRequestMs:Math.min(Number.isSafeInteger(requestMs)?requestMs:10000,10000)}});
 return Object.freeze({gateway:Object.freeze({authority:adapters.authority,limits:compileGatewayLimits(ownedValue(reads,'gateway'))}),owners:adapters.owners,bind:adapters.bind,state:adapters.state,missing:adapters.missing});
}
