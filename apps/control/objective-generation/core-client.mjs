/**
 * Decoded initial Objective-generation Core client over the fixed transport in
 * core-http.mjs (one generation job and accepted binding per instance).
 *
 * admit/publish/accept return closed decoded Core replies or throw. Missing or
 * undecodable replies after an effect POST are OUTCOME_UNKNOWN: retry only via the
 * read phases, never by inventing absence. `readCurrent` is the trusted
 * `coreCurrent` normalizer consumed by prepared-facts-reader.mjs: it brackets the
 * current publication with two admission reads and returns
 * {binding,sourceRequestSha256,objectiveGeneration,objectiveStrategy,checkedAtMs,expiresAtMs}.
 * `executionSelection` is the separately issued Meri provider/model selection
 * (never Core data); it must come from the genuine issued facts at composition.
 * Optional `issuance` is that run's genuine original ISSUED receipt; when given,
 * Core's recorded acceptance must equal it exactly.
 * No credential, issuer, route mount or authority is created here.
 */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
import {decodeAdmissionReply,decodeAdmissionReadReply,decodePublicationReply,decodeAcceptanceReply,decodeCompletionReply,objectiveSourceSelection} from './core-replies.mjs';

const unavailable=()=>new ProductError('OBJECTIVE_GENERATION_CORE_UNAVAILABLE');
const unknownOutcome=()=>new ProductError('OBJECTIVE_GENERATION_CORE_OUTCOME_UNKNOWN','UNKNOWN');
const same=(a,b)=>hash(a)===hash(b);

export function createCoreObjectiveGenerationClient(configuration){
 let transport,source,executionSelection,issued,now,maxRequestMs,maxFreshMs;
 try{
  const c=own(configuration,['transport','source'],['executionSelection','issuance','now','maxRequestMs','maxFreshMs']);
  transport=c.transport;source=data(own(c.source,['generationJobId','binding']));validateShape('RunBinding',source.binding);
  executionSelection=c.executionSelection===undefined?null:data(own(c.executionSelection,['provider','model']));
  issued=c.issuance===undefined?undefined:data(c.issuance);
  now=c.now??Date.now;maxRequestMs=c.maxRequestMs??3000;maxFreshMs=c.maxFreshMs??3000;
  for(const m of ['available','admit','publish','accept','readAdmission','readRequest','complete','readCompletion'])if(typeof transport?.[m]!=='function')throw unavailable();
  if(typeof now!=='function'||types.isProxy(now)||![maxRequestMs,maxFreshMs].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=30000))throw unavailable();
 }catch{throw unavailable();}

 const clock=()=>{const t=now();if(!Number.isSafeInteger(t)||t<0)throw unavailable();return t;};
 function options(value){const v=own(value??{},[],['signal','deadlineMs']);nativeSignal(v.signal);
  const deadlineMs=v.deadlineMs??clock()+maxRequestMs;if(!Number.isSafeInteger(deadlineMs))throw unavailable();
  return {deadlineMs,...(v.signal===undefined?{}:{signal:v.signal})};}
 async function call(method,value,effect){
  let reply;try{reply=await transport[method](value);}catch{reply={kind:'unavailable'};}
  if(reply?.kind!=='unqualified-response')throw effect?unknownOutcome():unavailable();
  return reply.value;
 }
 async function decoded(method,value,effect,decode){
  const raw=await call(method,value,effect);
  try{return decode(raw);}catch{throw effect?unknownOutcome():unavailable();}
 }

 /** POST admit: the Core-captured source admission for this job. */
 const admit=value=>decoded('admit',options(value),true,raw=>decodeAdmissionReply(raw,source));
 /** POST publish: the immutable initial typed request bound to that admission. */
 const publish=value=>{const {admission,...rest}=own(value,['admission'],['signal','deadlineMs']);
  return decoded('publish',options(rest),true,raw=>decodePublicationReply(raw,source,{admission}));};
 /** POST accept: Core pairs the job with the genuine original ISSUED receipt. */
 const accept=value=>{const {admission,issuance,...rest}=own(value,['admission','issuance'],['signal','deadlineMs']);
  return decoded('accept',options(rest),true,raw=>decodeAcceptanceReply(raw,source,{admission,issuance}));};
 /** POST complete after the accepted run's typed result is retained. Core reads it
  * through its own signed retained reader; a lost reply is UNKNOWN (read back). */
 const completion=method=>value=>{const {admission,publication,acceptance,...rest}=own(value,['admission','publication','acceptance'],['signal','deadlineMs']);
  return decoded(method,options(rest),method==='complete',raw=>decodeCompletionReply(raw,source,{admission,publication,acceptance}));};
 const readAdmission=(value,issuance)=>decoded('readAdmission',options(value),false,raw=>decodeAdmissionReadReply(raw,source,{issuance}));
 const readRequest=(value,admission)=>decoded('readRequest',options(value),false,raw=>decodePublicationReply(raw,source,{admission}));

 /** Fresh Core currentness for one already-issued run. Data comparison only. */
 async function readCurrent(value){
  try{
   const v=own(value,['binding','generationJobId','sourceRequestSha256'],['signal']);nativeSignal(v.signal);
   if(executionSelection===null||!transport.available()||v.generationJobId!==source.generationJobId||!same(v.binding,source.binding))throw unavailable();
   const startedAtMs=clock(),deadlineMs=startedAtMs+maxRequestMs,o={deadlineMs,...(v.signal===undefined?{}:{signal:v.signal})};
   const first=await readAdmission(o,issued),accepted=first.acceptance;
   if(!accepted||accepted.sourceRequestSha256!==v.sourceRequestSha256||!same(accepted.sourceBinding,source.binding))throw unavailable();
   const publication=await readRequest(o,first.sourceAdmission);
   const last=await readAdmission(o,accepted.issuance);
   if(!same(last,first))throw unavailable();
   const selected=objectiveSourceSelection({admission:first.sourceAdmission,publication,executionSelection});
   const checkedAtMs=clock();
   const expiresAtMs=Math.min(startedAtMs+maxFreshMs,deadlineMs,first.sourceAdmission.effectExpiresAtMs,publication.request.originalExpiresAtMs,accepted.issuance.expiresAtMs);
   if(checkedAtMs<startedAtMs||expiresAtMs<=checkedAtMs)throw unavailable();
   return data({binding:accepted.sourceBinding,sourceRequestSha256:accepted.sourceRequestSha256,
    objectiveGeneration:{sourceAdmission:first.sourceAdmission,sourceAdmissionSha256:first.sourceAdmissionSha256},
    objectiveStrategy:{schemaVersion:1,operation:'strategy.draft',request:selected.request,requestSha256:publication.requestSha256,
     executionContext:selected.executionContext,queuedType:selected.queuedType,executionSelection:selected.executionSelection},
    checkedAtMs,expiresAtMs});
  }catch(error){throw productFailure(error)?.code==='OBJECTIVE_GENERATION_CORE_UNAVAILABLE'?error:unavailable();}
 }
 return Object.freeze({available:()=>{try{return transport.available()===true;}catch{return false;}},
  admit,publish,accept,complete:completion('complete'),readCompletion:completion('readCompletion'),
  readAdmission:value=>{const {issuance,...rest}=own(value??{},[],['issuance','signal','deadlineMs']);return readAdmission(rest,issuance);},
  readRequest:value=>{const {admission,...rest}=own(value,['admission'],['signal','deadlineMs']);return readRequest(rest,admission);},
  readCurrent});
}
