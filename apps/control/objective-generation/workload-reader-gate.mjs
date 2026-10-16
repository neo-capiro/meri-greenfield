/**
 * Unmounted Objective retained-result ingress contract. This verifies a JWT
 * minted by a separate workload issuer; it cannot mint or refresh a credential.
 * A production owner must supply a fixed public-key set, an accepted-run/current
 * authority, and an atomic durable runOnce implementation before enabling it.
 * assertCurrent must check the original accepted run, membership, source and
 * retained custody on each call; JWT identity alone grants no result. runOnce
 * must atomically bind issuer/subject/jti and signed token bytes to the full identity, retain the exact
 * result, return it on identical replay, reject conflicts and unresolved writes,
 * and never invoke its callback twice for that identity. No such ports are
 * composed here. An ingress must resolve an accepted run from trusted custody
 * and build this gate with its fixed source and matching retained-result owner;
 * it cannot select a generic owner using the caller's source. This read gate
 * cannot authorize a later state transition.
 */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod,uuid} from '../../artifacts/storage/boundary.mjs';

export const objectiveRetainedReadRoute='/v1/internal/objective-generation/retained-result/read';
const operation='objective.retained-result.read',phase='retained-result-read';
const sha=/^[a-f0-9]{64}$/u,encoded=/^[A-Za-z0-9_-]+$/u,kidPattern=/^[A-Za-z0-9_-]{1,128}$/u;
const tokenId=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const deny=()=>{throw Object.assign(new Error('OBJECTIVE_WORKLOAD_UNAVAILABLE'),{code:'OBJECTIVE_WORKLOAD_UNAVAILABLE'});};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const utf8=new TextDecoder('utf-8',{fatal:true});

function segment(value,maxBytes){
 if(typeof value!=='string'||value.length<1||value.length>maxBytes*2||!encoded.test(value))deny();
 const bytes=Buffer.from(value,'base64url');
 if(bytes.length>maxBytes||bytes.toString('base64url')!==value)deny();
 return bytes;
}
function jsonSegment(value,maxBytes){
 const bytes=segment(value,maxBytes);let parsed;
 try{parsed=JSON.parse(utf8.decode(bytes));}catch{deny();}
 return parsed;
}
function validKeys(raw){
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))deny();
 const source=own(raw,[],Object.keys(raw));const names=Object.keys(source);
 if(names.length<1||names.length>4)deny();
 const keys=new Map();
 for(const name of names){
  if(typeof name!=='string'||!kidPattern.test(name))deny();
  const jwk=own(source[name],['kty','crv','x']);
  if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||typeof jwk.x!=='string'||!encoded.test(jwk.x))deny();
  const x=segment(jwk.x,32);if(x.length!==32)deny();
  keys.set(name,createPublicKey({key:jwk,format:'jwk'}));
 }
 return keys;
}
function sourceFacts(raw){
 const source=data(own(raw,['generationJobId','binding','sourceAdmissionSha256']));
 uuid(source.generationJobId);if(typeof source.sourceAdmissionSha256!=='string'||!sha.test(source.sourceAdmissionSha256))deny();
 validateShape('RunBinding',source.binding);
 return source;
}
function sourceBody(raw){
 let parsed;try{parsed=JSON.parse(utf8.decode(raw));}catch{deny();}
 const body=own(parsed,['schemaVersion','source']);if(body.schemaVersion!==1)deny();
 return sourceFacts(body.source);
}

/** The result remains unavailable if any required product composition is absent. */
export function createObjectiveRetainedReaderGate(configuration={}){
 let configured=false,c,keys,assertCurrent,runOnce,readRetained,resultAvailable,trustedSource,sourceSha256,now;
 try{
  c=own(configuration,[],['enabled','issuer','audience','subject','trustedKeys','source','current','idempotency','resultOwner','now']);
  if(c.enabled===true){
   if([c.issuer,c.audience,c.subject].some(v=>typeof v!=='string'||v.length<1||v.length>256)||
    typeof c.now!=='undefined'&&typeof c.now!=='function')deny();
   keys=validKeys(c.trustedKeys);
   trustedSource=sourceFacts(c.source);sourceSha256=canonicalSha256(trustedSource);
   assertCurrent=storageMethod(c.current,'assertCurrent');
   runOnce=storageMethod(c.idempotency,'runOnce');
   readRetained=storageMethod(c.resultOwner,'read');
   resultAvailable=storageMethod(c.resultOwner,'available');
   now=c.now??Date.now;configured=true;
  }
 }catch{configured=false;}
 const available=()=>{try{return configured&&resultAvailable()===true;}catch{return false;}};

 async function read(raw){
  if(!available())deny();
  let request,token,header,claims,source,rawBody,signal;
  try{
   request=own(raw,['authorization','method','target','rawBody'],['signal']);signal=nativeSignal(request.signal);
   if(signal?.aborted||request.method!=='POST'||request.target!==objectiveRetainedReadRoute||
    !Buffer.isBuffer(request.rawBody)||request.rawBody.length<1||request.rawBody.length>65536)deny();
   rawBody=Buffer.from(request.rawBody);source=sourceBody(rawBody);
   if(canonicalSha256(source)!==sourceSha256)deny();
   if(typeof request.authorization!=='string'||!request.authorization.startsWith('Bearer '))deny();
   token=request.authorization.slice(7);
   if(token.length>8192)deny();
   const parts=token.split('.');if(parts.length!==3||parts[0].length+1+parts[1].length>4096)deny();
   header=own(jsonSegment(parts[0],1024),['alg','kid','typ']);
   if(header.alg!=='EdDSA'||header.typ!=='JWT'||typeof header.kid!=='string'||!kidPattern.test(header.kid))deny();
   const key=keys.get(header.kid);if(!key)deny();
   const signature=segment(parts[2],64);if(signature.length!==64||
    !verifySignature(null,Buffer.from(parts[0]+'.'+parts[1],'ascii'),key,signature))deny();
   claims=own(jsonSegment(parts[1],4096),['iss','sub','aud','iat','nbf','exp','jti','objective']);
   const scope=own(claims.objective,['operation','phase','method','path','query','bodySha256','sourceSha256','generationJobId']);
   const instant=now();if(!Number.isSafeInteger(instant)||instant<0)deny();const seconds=Math.floor(instant/1000);
   if(claims.iss!==c.issuer||claims.sub!==c.subject||claims.aud!==c.audience||
    typeof claims.jti!=='string'||!tokenId.test(claims.jti)||![claims.iat,claims.nbf,claims.exp].every(Number.isSafeInteger)||
    claims.iat>seconds||claims.nbf>seconds||claims.exp<=seconds||claims.nbf<claims.iat||
    claims.exp-claims.iat>60||claims.exp-claims.iat<1||
    scope.operation!==operation||scope.phase!==phase||scope.method!=='POST'||
    scope.path!==objectiveRetainedReadRoute||scope.query!==''||
    scope.bodySha256!==digest(rawBody)||scope.sourceSha256!==sourceSha256||
    scope.generationJobId!==source.generationJobId)deny();
  }catch{deny();}
  const identity=data({issuer:claims.iss,subject:claims.sub,audience:claims.aud,tokenId:claims.jti,
   signedTokenSha256:digest(Buffer.from(token,'ascii')),
   operation,phase,method:'POST',path:objectiveRetainedReadRoute,query:'',bodySha256:digest(rawBody),
   sourceSha256,generationJobId:source.generationJobId,expiresAtMs:claims.exp*1000});
  try{
   const current=()=>assertCurrent({source,identity,signal});
   if(await current()!==true)deny();
   const outcome=await runOnce({identity,source,signal},async()=>{
    if(!available()||await current()!==true||now()>=identity.expiresAtMs||signal?.aborted)deny();
    return readRetained(source,{signal});
   });
   const result=own(outcome,['status','value']);
   if(!['executed','replayed'].includes(result.status)||!available()||await current()!==true||
    now()>=identity.expiresAtMs||signal?.aborted)deny();
   return result.value;
  }catch{deny();}
 }
 return Object.freeze({available,read});
}
