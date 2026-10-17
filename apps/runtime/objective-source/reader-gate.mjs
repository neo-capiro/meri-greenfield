/** Objective v2 read-only transport boundary. No listener, key discovery, source
 * publication or execution grant is installed. Trusted custody/native authority
 * and durable runOnce remain mandatory composition owners. */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {objectiveReaderSchema,readerLimits,readerPurposes,readerTokenType} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {assertObjectiveReaderShape,objectiveReaderRequestBody,assertObjectiveSourceObservation} from '../../../packages/contracts/objective-reader-2/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createCoreObjectiveGenerationResultOwner} from '../objective-generation/core-result-owner.mjs';

const unavailable=()=>Object.assign(Error('OBJECTIVE_READER_V2_UNAVAILABLE'),{code:'OBJECTIVE_READER_V2_UNAVAILABLE'});
const deny=()=>{throw unavailable();};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const encoded=/^[A-Za-z0-9_-]+$/u,kidPattern=/^[A-Za-z0-9._-]{1,64}$/u;
const purposeNames=Object.keys(readerPurposes),utf8=new TextDecoder('utf-8',{fatal:true});
const nativeBytes=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const byteOffset=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteOffset').get;
const byteBuffer=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'buffer').get;
function requestBytes(raw){
 if(types.isProxy(raw)||!Buffer.isBuffer(raw)||Object.getPrototypeOf(raw)!==Buffer.prototype)deny();
 const size=nativeBytes.call(raw),keys=Reflect.ownKeys(raw);
 if(size<1||size>readerLimits.requestBytes||keys.length!==size||keys.some((key,i)=>key!==String(i)))deny();
 return Buffer.from(new Uint8Array(byteBuffer.call(raw),byteOffset.call(raw),size));
}
function segment(text,max){
 if(typeof text!=='string'||!encoded.test(text)||text.length>max*2)deny();const bytes=Buffer.from(text,'base64url');
 if(bytes.length>max||bytes.toString('base64url')!==text)deny();return bytes;
}
// Serialization order comes from the canonical descriptor, including nested
// Scope. Comparing bytes rejects duplicate keys, whitespace, BOM and aliases.
function ordered(definition,value){
 const shape=definition.$ref?objectiveReaderSchema.$defs[definition.$ref.slice('#/$defs/'.length)]:definition;
 if(shape?.type!=='object')return value;
 return Object.fromEntries(Object.entries(shape.properties).map(([name,field])=>[name,ordered(field,value[name])]));
}
function jwtSegment(name,text,max){
 const bytes=segment(text,max),value=assertObjectiveReaderShape(name,JSON.parse(utf8.decode(bytes)));
 if(!Buffer.from(JSON.stringify(ordered(objectiveReaderSchema.$defs[name],value)),'utf8').equals(bytes))deny();return value;
}
function trustRegistry(raw){
 const registry=own(raw,purposeNames),issuers=new Set(),materials=new Map(),result=Object.create(null);
 for(const purpose of purposeNames){
  const entry=own(registry[purpose],['issuer','publicKeys']);
  if(typeof entry.issuer!=='string'||!entry.issuer.trim()||entry.issuer.length>256||issuers.has(entry.issuer))deny();issuers.add(entry.issuer);
  if(!entry.publicKeys||typeof entry.publicKeys!=='object'||types.isProxy(entry.publicKeys))deny();
  const publicKeys=own(entry.publicKeys,[],Reflect.ownKeys(entry.publicKeys)),names=Object.keys(publicKeys),keys=new Map();
  if(names.length<1||names.length>4)deny();
  for(const kid of names){
   if(!kidPattern.test(kid))deny();const jwk=own(publicKeys[kid],['kty','crv','x']);
   if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||segment(jwk.x,32).length!==32)deny();
   const key=createPublicKey({key:jwk,format:'jwk'}),fingerprint=digest(key.export({format:'der',type:'spki'}));
   if(materials.has(fingerprint)&&materials.get(fingerprint)!==purpose)deny();materials.set(fingerprint,purpose);keys.set(kid,key);
  }
  result[purpose]=Object.freeze({issuer:entry.issuer,keys});
 }
 return Object.freeze(result);
}
function immutableObservation(value){
 return Object.fromEntries(Object.entries(value).filter(([key])=>!['purpose','runState','checkedAtMs','expiresAtMs'].includes(key)));
}
function sourceOf(value){return data({generationJobId:value.generationJobId,binding:value.binding,sourceAdmissionSha256:value.sourceAdmissionSha256});}

/** trust has three purpose-specific {issuer,publicKeys:{kid:publicEd25519Jwk}}
 * records. custody is the actual Objective custody owner. idempotency.runOnce
 * must durably bind issuer/subject/JTI and ALL identity/source fields, retain the
 * exact result, reject conflicts/uncertainty, and never rerun a claimed effect.
 * No in-memory durability substitute exists here. retainedReaderFactory is an
 * optional trusted server factory (source,{signal,maxExpiresAtMs}) -> strict
 * retained reader, whose original projection must respect that read deadline;
 * the actual existing Core result owner always wraps that source-bound reader. */
export function createObjectiveSourceReaderGate(configuration={}){
 let configured=false,trust,readCustody,custodyAvailable,runOnce,retainedReaderFactory,now=Date.now;
 try{
  const enabled=configuration&&typeof configuration==='object'&&!types.isProxy(configuration)?Object.getOwnPropertyDescriptor(configuration,'enabled'):undefined;
  if(enabled&&'value'in enabled&&enabled.value===true){
   const c=own(configuration,['enabled','trust','custody','idempotency'],['retainedReaderFactory','now']);
   trust=trustRegistry(c.trust);now=c.now??Date.now;if(typeof now!=='function'||types.isProxy(now))deny();
   readCustody=storageMethod(c.custody,'read');custodyAvailable=storageMethod(c.custody,'available');runOnce=storageMethod(c.idempotency,'runOnce');
   retainedReaderFactory=c.retainedReaderFactory;
   if(retainedReaderFactory!==undefined&&(typeof retainedReaderFactory!=='function'||types.isProxy(retainedReaderFactory)))deny();configured=true;
  }
 }catch{configured=false;}
 const custodyPurpose=purpose=>purpose==='retained-result'?'historical-source':purpose;
 const available=(purpose='active-source')=>{
  try{return configured&&Object.hasOwn(readerPurposes,purpose)&&(purpose!=='retained-result'||retainedReaderFactory!==undefined)&&custodyAvailable(custodyPurpose(purpose))===true;}
  catch{return false;}
 };
 async function read(raw){
  if(!configured)deny();let life;
  try{
   const request=own(raw,['method','target','authorization','rawBody'],['signal']),signal=nativeSignal(request.signal);
   if(signal?.aborted||request.method!=='POST'||typeof request.authorization!=='string'||!request.authorization.startsWith('Bearer '))deny();
   const bytes=requestBytes(request.rawBody),body=assertObjectiveReaderShape('Request',JSON.parse(utf8.decode(bytes))),purpose=body.purpose,descriptor=readerPurposes[purpose];
   if(!objectiveReaderRequestBody(body).equals(bytes)||request.target!==descriptor.path||!available(purpose))deny();
   const token=request.authorization.slice(7);if(token.length>readerLimits.tokenBytes)deny();
   const parts=token.split('.');if(parts.length!==3)deny();
   const header=jwtSegment('Header',parts[0],1024),claims=jwtSegment('Claims',parts[1],4096),signature=segment(parts[2],64);
   const pin=trust[purpose],key=pin.keys.get(header.kid),scope=claims.objective;
   if(header.alg!=='EdDSA'||header.typ!==readerTokenType||signature.length!==64||!key||
    !verifySignature(null,Buffer.from(parts[0]+'.'+parts[1],'ascii'),key,signature))deny();
   let previous=now();if(!Number.isSafeInteger(previous)||previous<0)deny();const readStartedAtMs=previous;
   const clock=()=>{const value=now();if(!Number.isSafeInteger(value)||value<previous)deny();previous=value;return value;};
   const seconds=Math.floor(clock()/1000),expiresAtMs=claims.exp*1000;
   if(claims.iss!==pin.issuer||claims.sub!==descriptor.subject||claims.aud!==descriptor.audience||
    !(claims.iat<=claims.nbf&&claims.nbf<=seconds&&seconds<claims.exp)||claims.exp-claims.iat<1||claims.exp-claims.iat>readerLimits.maxTokenSeconds||
    !Number.isSafeInteger(expiresAtMs)||scope.purpose!==purpose||scope.operation!==descriptor.operation||scope.phase!==descriptor.phase||
    scope.method!=='POST'||scope.path!==descriptor.path||scope.query!==''||scope.bodySha256!==digest(bytes)||
    scope.generationJobId!==body.generationJobId||scope.sourceAdmissionSha256!==body.sourceAdmissionSha256)deny();
   const selector=data({generationJobId:body.generationJobId,sourceAdmissionSha256:body.sourceAdmissionSha256}),
    deadlineMs=Math.min(readStartedAtMs+readerLimits.maxRequestMs,expiresAtMs);
   life=createOperationLifetime({now:clock,signal,deadlineMs,errorFactory:unavailable});
   const observedPurpose=custodyPurpose(purpose);
   async function fresh(){
    if(!available(purpose))deny();const began=clock();
    const value=await life.run(signal=>readCustody({...selector,purpose:observedPurpose,signal}));life.check();
    const result=assertObjectiveSourceObservation(value,{purpose:observedPurpose,selector,readStartedAtMs:began,nowMs:clock(),maxExpiresAtMs:deadlineMs});
    if(purpose==='retained-result'&&result.runState!=='completed')deny();life.limitDeadline(result.expiresAtMs);return result;
   }
   const first=await fresh(),source=sourceOf(first),custodyIdentitySha256=hash(immutableObservation(first));
   const matches=value=>{if(hash(immutableObservation(value))!==custodyIdentitySha256||hash(sourceOf(value))!==hash(source))deny();};
   const identity=data({issuer:claims.iss,subject:claims.sub,audience:claims.aud,tokenId:claims.jti,signedTokenSha256:digest(Buffer.from(token,'ascii')),
    purpose,operation:descriptor.operation,phase:descriptor.phase,method:'POST',path:descriptor.path,query:'',bodySha256:digest(bytes),
    generationJobId:body.generationJobId,sourceAdmissionSha256:body.sourceAdmissionSha256,sourceSha256:hash(source),custodyIdentitySha256,expiresAtMs});
   let effectStarted=false;
   const outcome=await life.run(signal=>runOnce({identity,source,signal},async()=>{
    if(effectStarted)deny();effectStarted=true;
    const before=await fresh();matches(before);
    // Keep the original genuine projection and earliest proof deadline. Later
    // current reads may extend READ authority, never these returned timestamps.
    if(purpose!=='retained-result')return first;
    const reader=await life.run(signal=>retainedReaderFactory(source,{signal,maxExpiresAtMs:Math.min(deadlineMs,first.expiresAtMs,before.expiresAtMs)}));life.check();
    const owner=createCoreObjectiveGenerationResultOwner({source,reader,enabled:true,now:clock,maxRequestMs:readerLimits.maxRequestMs});
    if(owner.available()!==true)deny();return life.run(signal=>owner.read(source,{signal}));
   }));life.check();
   const result=own(outcome,['status','value']);if(!['executed','replayed'].includes(result.status))deny();
   const after=await fresh();matches(after);life.check();
   const maxExpiresAtMs=Math.min(deadlineMs,first.expiresAtMs,after.expiresAtMs);
   if(purpose!=='retained-result'){
    const value=assertObjectiveSourceObservation(result.value,{purpose,selector,readStartedAtMs,nowMs:clock(),maxExpiresAtMs});matches(value);return value;
   }
   const value=assertObjectiveReaderShape('Retained',result.value);
   if(value.generationJobId!==source.generationJobId||value.sourceAdmissionSha256!==source.sourceAdmissionSha256||hash(value.binding)!==hash(source.binding)||
    value.sourceRequestSha256!==after.sourceRequestSha256||value.typedRequestSha256!==after.typedRequestSha256||
    value.checkedAtMs<readStartedAtMs||value.checkedAtMs>clock()||value.expiresAtMs<=clock()||value.expiresAtMs>maxExpiresAtMs||
    value.result.jobId!==source.generationJobId||value.result.requestId!==after.acceptedRequestId||hash(value.result.binding)!==hash(source.binding)||
    value.result.requestSha256!==after.typedRequestSha256||hash(value.result.execution)!==hash(value.execution))deny();
   return value;
  }catch{deny();}finally{life?.close();}
 }
 return Object.freeze({available,read});
}
