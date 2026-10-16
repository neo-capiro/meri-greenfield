/**
 * Unmounted Core-to-Meri Objective retained-result read gate. The configured
 * source and result owner come from trusted accepted-run custody, never from
 * the bearer or request body. This is a receiver, not a credential issuer.
 * A live ingress still needs a current authority and a durable atomic runOnce
 * store; no such ports or route are composed here.
 */
import {createHash,KeyObject,constants,verify as verifySignature} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod,uuid} from '../../artifacts/storage/boundary.mjs';

export const objectiveRetainedReadRoute='/v1/internal/objective-generation/retained-result/read';
const operation='objective.retained-result.read',phase='retained-result-read';
const subject='capiro-objective-core-result-reader:v1',audience='capiro:objective-meri-retained-result:v1';
const tokenType='capiro-objective-workload+jwt';
const sha=/^[a-f0-9]{64}$/u,encoded=/^[A-Za-z0-9_-]+$/u,kidPattern=/^[A-Za-z0-9._-]{1,64}$/u;
const tokenId=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const ownerIdPattern=/^[A-Za-z0-9:._-]{1,128}$/u;
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
 const text=utf8.decode(segment(value,maxBytes));
 return {text,value:JSON.parse(text)};
}
function headerJson(kid){return JSON.stringify({alg:'RS256',typ:tokenType,kid});}
function claimsJson(c){return JSON.stringify({
 iss:c.iss,sub:c.sub,aud:c.aud,iat:c.iat,nbf:c.nbf,exp:c.exp,jti:c.jti,
 method:c.method,path:c.path,query:c.query,bodySha256:c.bodySha256,operation:c.operation,phase:c.phase,
 tenantId:c.tenantId,generationJobId:c.generationJobId,delegationRef:c.delegationRef,consentId:c.consentId,
 attemptId:c.attemptId,runId:c.runId,acceptedBindingSha256:c.acceptedBindingSha256,sourceSha256:c.sourceSha256,
});}
function validKeys(raw){
 if(!raw||typeof raw!=='object'||types.isProxy(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))deny();
 const source=own(raw,[],Object.keys(raw)),names=Object.keys(source);
 if(names.length<1||names.length>4)deny();
 const keys=new Map();
 for(const name of names){
  const key=source[name];
  if(!kidPattern.test(name)||types.isProxy(key)||!(key instanceof KeyObject)||key.type!=='public'||key.asymmetricKeyType!=='rsa'||
   (key.asymmetricKeyDetails?.modulusLength??0)<3072)deny();
  keys.set(name,key);
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
 const body=own(JSON.parse(utf8.decode(raw)),['schemaVersion','source']);
 if(body.schemaVersion!==1)deny();
 return sourceFacts(body.source);
}
function claimsFrom(token,keys){
 if(typeof token!=='string'||token.length<1||token.length>8192)deny();
 const parts=token.split('.');
 if(parts.length!==3||parts[0].length+1+parts[1].length>4096)deny();
 const h=jsonSegment(parts[0],1024),header=own(h.value,['alg','typ','kid']);
 if(header.alg!=='RS256'||header.typ!==tokenType||typeof header.kid!=='string'||
  !kidPattern.test(header.kid)||h.text!==headerJson(header.kid))deny();
 const key=keys.get(header.kid);if(!key)deny();
 const p=jsonSegment(parts[1],4096),claims=own(p.value,[
  'iss','sub','aud','iat','nbf','exp','jti','method','path','query','bodySha256','operation','phase',
  'tenantId','generationJobId','delegationRef','consentId','attemptId','runId','acceptedBindingSha256','sourceSha256',
 ]);
 if(p.text!==claimsJson(claims))deny();
 const signature=segment(parts[2],4096);
 if(signature.length!==Math.ceil(key.asymmetricKeyDetails.modulusLength/8)||
  !verifySignature('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1],'ascii'),
   {key,padding:constants.RSA_PKCS1_PADDING},signature))deny();
 return claims;
}

/** Configuration stays unavailable without fixed keys, source, custody and replay ports. */
export function createObjectiveRetainedReaderGate(configuration={}){
 let configured=false,c,keys,assertCurrent,runOnce,readRetained,resultAvailable,trustedSource,sourceSha256,bindingSha256,now;
 try{
  c=own(configuration,[],['enabled','issuer','audience','subject','trustedKeys','source','resultOwnerId','current','idempotency','resultOwner','now']);
  if(c.enabled===true){
   if(typeof c.issuer!=='string'||c.issuer.length<1||c.issuer.length>256||
    c.audience!==audience||c.subject!==subject||
    typeof c.resultOwnerId!=='string'||!ownerIdPattern.test(c.resultOwnerId)||
    typeof c.now!=='undefined'&&typeof c.now!=='function')deny();
   keys=validKeys(c.trustedKeys);
   trustedSource=sourceFacts(c.source);sourceSha256=canonicalSha256(trustedSource);
   bindingSha256=canonicalSha256(trustedSource.binding);
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
  let request,token,claims,source,rawBody,signal;
  try{
   request=own(raw,['authorization','method','target','rawBody'],['signal']);signal=nativeSignal(request.signal);
   if(signal?.aborted||request.method!=='POST'||request.target!==objectiveRetainedReadRoute||
    types.isProxy(request.rawBody)||!Buffer.isBuffer(request.rawBody)||request.rawBody.length<1||request.rawBody.length>65536)deny();
   rawBody=Buffer.from(request.rawBody);source=sourceBody(rawBody);
   if(canonicalSha256(source)!==sourceSha256)deny();
   if(typeof request.authorization!=='string'||!request.authorization.startsWith('Bearer '))deny();
   token=request.authorization.slice(7);claims=claimsFrom(token,keys);
   const instant=now();if(!Number.isSafeInteger(instant)||instant<0)deny();const seconds=Math.floor(instant/1000);
   if(claims.iss!==c.issuer||claims.sub!==subject||claims.aud!==audience||
    typeof claims.jti!=='string'||!tokenId.test(claims.jti)||
    ![claims.iat,claims.nbf,claims.exp].every(n=>Number.isSafeInteger(n)&&n>=0)||
    claims.iat>seconds||claims.nbf>seconds||claims.exp<=seconds||claims.nbf<claims.iat||
    claims.exp-claims.iat>60||claims.exp-claims.iat<1||
    claims.exp>Math.floor(Number.MAX_SAFE_INTEGER/1000)||
    claims.operation!==operation||claims.phase!==phase||claims.method!=='POST'||
    claims.path!==objectiveRetainedReadRoute||claims.query!==''||
    claims.bodySha256!==digest(rawBody)||claims.sourceSha256!==sourceSha256||
    claims.generationJobId!==source.generationJobId||claims.tenantId!==source.binding.tenantId||
    claims.runId!==source.binding.runId||claims.attemptId!==source.binding.attemptId||
    claims.acceptedBindingSha256!==bindingSha256||
    typeof claims.delegationRef!=='string'||typeof claims.consentId!=='string')deny();
   uuid(claims.delegationRef);uuid(claims.consentId);
  }catch{deny();}
  const identity=data({issuer:claims.iss,subject:claims.sub,audience:claims.aud,tokenId:claims.jti,
   signedTokenSha256:digest(Buffer.from(token,'ascii')),
   operation,phase,method:'POST',path:objectiveRetainedReadRoute,query:'',bodySha256:digest(rawBody),
   sourceSha256,generationJobId:source.generationJobId,tenantId:source.binding.tenantId,
   delegationRef:claims.delegationRef,consentId:claims.consentId,runId:source.binding.runId,
   attemptId:source.binding.attemptId,acceptedBindingSha256:bindingSha256,resultOwnerId:c.resultOwnerId,
   expiresAtMs:claims.exp*1000});
  try{
   const current=()=>assertCurrent({source,identity,signal});
   if(await current()!==true)deny();
   let invoked=false;
   const outcome=await runOnce({identity,source,signal},async()=>{
    if(invoked)deny();invoked=true;
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
