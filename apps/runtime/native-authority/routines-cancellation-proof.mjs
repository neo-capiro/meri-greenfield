/** Meri's verifier for Core's routine cancellation proof (wire B), the counterpart of capiro-backend
 * `verifyRoutineCancellationProof` (apps/api/src/meri/routines/meri-routine-cancellation-proof.ts @32cf3ca7):
 *  - pure Ed25519 (RFC 8032, `crypto.verify(null, …)`) over the compact JWS signing input with ONE pinned public key;
 *  - the exact header bytes `{"alg":"EdDSA","typ":"capiro-meri-routine-cancel+jwt","kid":<pinned kid>}`;
 *  - the exact RFC 8785 payload bytes `{iss,aud,iat,nbf,exp,jti,cancel}`, pinned issuer, audience `meri-schedule-run-control`,
 *    nbf = iat ≤ now < exp, exp − iat ≤ 30 s, jti a UUIDv4;
 *  - closed claims `{tenantId, ownerActorId, scheduleId, intentId, intentSha256, decisionSha256, runs, targets}` whose every
 *    target is a RunBinding of `ownerActorId` in `tenantId`.
 * Verification alone grants nothing: routines-run-control.mjs also consumes the jti once and requires the exact current run. */
import {createHash,createPublicKey,verify as verifySignature,KeyObject} from 'node:crypto';
import {types} from 'node:util';
import canonicalize from 'canonicalize';
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {workflowId} from '../../control/conversations/temporal-dispatch.mjs';
import {ROUTINE_CANCEL_ISSUER,ROUTINE_CANCEL_KID,exactMatch,routineCancellationPublicJwk} from './routines-configuration.mjs';

export const ROUTINE_CANCEL_TOKEN_TYPE='capiro-meri-routine-cancel+jwt';
export const ROUTINE_CANCEL_AUDIENCE='meri-schedule-run-control';
export const ROUTINE_CANCEL_MAX_TTL_SECONDS=30;
const MAX_TOKEN_BYTES=8192,MAX_MESSAGE_BYTES=4096,SEGMENT=/^[A-Za-z0-9_-]+$/u,HEX64=/^[a-f0-9]{64}$/u;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const utf8=new TextDecoder('utf-8',{fatal:true}),sha256=text=>createHash('sha256').update(text,'utf8').digest('hex');
const refuse=()=>{throw Object.assign(Error('ROUTINE_CANCELLATION_PROOF_REFUSED'),{code:'ROUTINE_CANCELLATION_PROOF_REFUSED'});};
const seconds=value=>Number.isSafeInteger(value)&&value>=0;
const text=(value,max)=>typeof value==='string'&&value.length>=1&&value.length<=max;
const headerJson=kid=>JSON.stringify({alg:'EdDSA',typ:ROUTINE_CANCEL_TOKEN_TYPE,kid});
const trusted=new WeakSet();

/** The pinned trust record from configuration `routines.core.cancellationProof` (one issuer, one kid, one public key). */
export function routineCancellationTrust(pin){
 try{
  if(!pin||typeof pin!=='object'||types.isProxy(pin)||!exactMatch(ROUTINE_CANCEL_ISSUER,pin.issuer)||!exactMatch(ROUTINE_CANCEL_KID,pin.kid))refuse();
  const key=createPublicKey({key:routineCancellationPublicJwk(pin.publicKey),format:'jwk'});
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')refuse();
  const trust=Object.freeze({issuer:pin.issuer,kid:pin.kid,key,publicKeySha256:createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex')});
  trusted.add(trust);return trust;
 }catch{throw Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});}
}
function decode(part,max){
 if(!exactMatch(SEGMENT,part))refuse();const bytes=Buffer.from(part,'base64url');
 if(bytes.length<1||bytes.length>max||bytes.toString('base64url')!==part)refuse();return utf8.decode(bytes);
}
/** JSON.parse output only: a plain object with exactly `keys`. */
function record(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)refuse();
 const names=Object.keys(value);if(names.length!==keys.length||names.some(key=>!keys.includes(key)))refuse();return value;
}
function claimsOf(raw){
 const c=record(raw,['tenantId','ownerActorId','scheduleId','intentId','intentSha256','decisionSha256','runs','targets']);
 if(!text(c.tenantId,256)||!text(c.ownerActorId,256)||!exactMatch(UUID,c.scheduleId)||!exactMatch(UUID,c.intentId)||!exactMatch(HEX64,c.intentSha256)||!exactMatch(HEX64,c.decisionSha256))refuse();
 if(!Array.isArray(c.runs)||c.runs.length<1||c.runs.length>10||!Array.isArray(c.targets)||c.targets.length<1||c.targets.length>32)refuse();
 for(const run of c.runs){record(run,['workflowId','runId']);if(!text(run.workflowId,256)||!exactMatch(UUID,run.runId))refuse();}
 for(const target of c.targets){validateShape('RunBinding',target);if(target.tenantId!==c.tenantId||target.actorId!==c.ownerActorId)refuse();}
 if(new Set(c.runs.map(hash)).size!==c.runs.length||new Set(c.targets.map(hash)).size!==c.targets.length)refuse();
 return c;
}
/** Returns deep-frozen `{issuer, kid, jti, iat, exp, claims, proofSha256}` or throws ROUTINE_CANCELLATION_PROOF_REFUSED. */
export function verifyRoutineCancellationProof(token,{trust,nowMs}={}){
 try{
  if(!trusted.has(trust)||!(trust.key instanceof KeyObject)||typeof token!=='string'||Buffer.byteLength(token)>MAX_TOKEN_BYTES||!Number.isSafeInteger(nowMs)||nowMs<0)refuse();
  const parts=token.split('.');if(parts.length!==3)refuse();
  if(decode(parts[0],256)!==headerJson(trust.kid))refuse();
  if(!exactMatch(SEGMENT,parts[2]))refuse();const signature=Buffer.from(parts[2],'base64url');
  if(signature.length!==64||signature.toString('base64url')!==parts[2]||!verifySignature(null,Buffer.from(`${parts[0]}.${parts[1]}`,'ascii'),trust.key,signature))refuse();
  const payload=decode(parts[1],MAX_MESSAGE_BYTES),p=record(JSON.parse(payload),['iss','aud','iat','nbf','exp','jti','cancel']);
  if(canonicalize(p)!==payload)refuse();
  const now=Math.floor(nowMs/1000);
  if(p.iss!==trust.issuer||p.aud!==ROUTINE_CANCEL_AUDIENCE||!seconds(p.iat)||p.nbf!==p.iat||!seconds(p.exp)||p.exp<=p.iat||p.exp-p.iat>ROUTINE_CANCEL_MAX_TTL_SECONDS||
   p.iat>now||p.exp<=now||!exactMatch(UUID_V4,p.jti))refuse();
  const claims=claimsOf(p.cancel);
  return data({issuer:p.iss,kid:trust.kid,jti:p.jti,iat:p.iat,exp:p.exp,claims,proofSha256:sha256(token)});
 }catch{return refuse();}
}
/** A proof covers stopping only one of its exact owner targets, whose Temporal execution is among its approved runs. */
export function cancellationCoversRun(claims,binding){
 return binding.tenantId===claims.tenantId&&binding.actorId===claims.ownerActorId&&claims.targets.some(target=>hash(target)===hash(binding))&&
  claims.runs.some(run=>run.workflowId===workflowId(binding));
}
