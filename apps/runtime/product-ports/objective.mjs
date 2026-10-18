/** Production product family for Objective / Planner (lane 7). It contributes NO public product port: the only control ingress
 * Objective needs is Core's signed reader v2 calls to `/v2/internal/objective-generation/{accepted-source,historical-source,
 * retained-result}/read`, which belong on the PRIVATE control listener only (control-route-boundary.mjs private application).
 *
 * `createObjectiveReaderApplication()` is that private HTTP adapter over `createObjectiveSourceReaderGate`. Composed with no
 * gate it uses the gate's own disabled default (`createObjectiveSourceReaderGate({})`), which denies everything, and it then
 * refuses before reading a body. Enabling needs, all as trusted in-process owners (never request or JSON configuration data):
 * the three pinned Core Ed25519 public keys and issuers (D7-2: Core signs with AWS KMS keys; Meri pins only public JWKs, see
 * `../objective-source/trust-pins.mjs`), the Objective custody owner over `meri_objective_source.custody` (migration unapplied)
 * with fresh native authority (Core), a durable issuer/subject/JTI `runOnce` store (no table exists), and for retained results a
 * retained-reader factory. Core's client (capiro-backend objective-reader-v2-client.ts) accepts only 200 application/json
 * without content-encoding and treats every other answer as unavailable, so refusals carry one closed code and no detail. */
import {types} from 'node:util';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {readerLimits,readerPurposes} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createObjectiveSourceReaderGate} from '../objective-source/reader-gate.mjs';

export const OBJECTIVE_READER_PREFIX='/v2/internal/objective-generation/';
const purposeByPath=new Map(Object.entries(readerPurposes).map(([purpose,descriptor])=>[descriptor.path,purpose]));
const getters=Object.fromEntries(['url','method','headers','body','signal'].map(key=>[key,Object.getOwnPropertyDescriptor(Request.prototype,key).get]));
const headers=Object.freeze({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
const unavailable=()=>Object.assign(Error('OBJECTIVE_READER_V2_UNAVAILABLE'),{code:'OBJECTIVE_READER_V2_UNAVAILABLE'});
const refused=()=>new Response(JSON.stringify({error:{code:'OBJECTIVE_READER_V2_UNAVAILABLE'}}),{status:503,headers});
const configurationFault=()=>Object.assign(Error('PRODUCT_PORTS_CONFIGURATION'),{code:'PRODUCT_PORTS_CONFIGURATION'});

/** Family registration: Objective has no public product port to contribute. */
export function createObjectiveFamily(_context){return {ports:{}};}

/** Exact raw entity bytes (the gate hashes and signs over them), bounded before allocation. */
async function rawBody(body,declared,life){
 if(body===null)throw unavailable();const reader=body.getReader(),chunks=[];let size=0,complete=false;
 try{for(;;){const part=await life.run(()=>reader.read());life.check();if(part.done){complete=true;break;}
   if(!(part.value instanceof Uint8Array))throw unavailable();size+=part.value.byteLength;if(size>readerLimits.requestBytes)throw unavailable();chunks.push(part.value);}
  if(size<1||declared!==null&&size!==declared)throw unavailable();return Buffer.concat(chunks.map(chunk=>Buffer.from(chunk.buffer,chunk.byteOffset,chunk.byteLength)),size);
 }finally{if(!complete){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}
}

/** Private listener application. `handle(request)` answers null outside the three exact reader paths (the route boundary then
 * answers 404), otherwise a Response: 200 with the gate's validated value, or 503 OBJECTIVE_READER_V2_UNAVAILABLE. */
export function createObjectiveReaderApplication(options={}){
 let c;try{c=own(options,[],['gate','now','maxRequestMs','maxConcurrent']);}catch{throw configurationFault();}
 const gate=c.gate??createObjectiveSourceReaderGate({}),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??2*readerLimits.maxRequestMs,maxConcurrent=c.maxConcurrent??16;
 if(typeof now!=='function'||types.isProxy(now)||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>64)throw configurationFault();
 let read,available;try{read=storageMethod(gate,'read');available=storageMethod(gate,'available');}catch{throw configurationFault();}
 const open=purpose=>{try{return available(purpose)===true;}catch{return false;}};
 let active=0;
 async function handle(request){
  if(types.isProxy(request)||!(request instanceof Request))return refused();
  let r;try{r=Object.fromEntries(Object.entries(getters).map(([key,get])=>[key,get.call(request)]));}catch{return refused();}
  const url=new URL(r.url),purpose=purposeByPath.get(url.pathname);if(purpose===undefined)return null;
  let life,reserved=false;
  try{
   nativeSignal(r.signal);
   // A disabled or unavailable purpose refuses before any body byte is read or any concurrency slot is held.
   if(!open(purpose)||r.method!=='POST'||url.search||url.hash)throw unavailable();
   const header=name=>Headers.prototype.get.call(r.headers,name),authorization=header('authorization'),declared=header('content-length');
   if(typeof authorization!=='string'||!authorization.startsWith('Bearer ')||authorization.length>7+readerLimits.tokenBytes||header('content-encoding')!==null||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||declared!==null&&(!/^[1-9][0-9]{0,8}$/u.test(declared)||Number(declared)>readerLimits.requestBytes))throw unavailable();
   if(active>=maxConcurrent)throw unavailable();active++;reserved=true;
   life=createOperationLifetime({now,signal:r.signal,deadlineMs:now()+maxRequestMs,errorFactory:unavailable});
   const rawBodyBytes=await rawBody(r.body,declared===null?null:Number(declared),life);
   const value=await life.run(signal=>read({method:'POST',target:url.pathname,authorization,rawBody:rawBodyBytes,signal}));life.check();
   const serialized=JSON.stringify(value);if(typeof serialized!=='string'||Buffer.byteLength(serialized)>readerLimits.maxResponseBytes)throw unavailable();
   return new Response(serialized,{status:200,headers});
  }catch{return refused();}finally{if(reserved)active--;life?.close();}
 }
 return Object.freeze({handle,state:()=>Object.keys(readerPurposes).some(open)?'composed':'disabled'});
}
