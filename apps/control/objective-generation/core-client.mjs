/** Closed saved-job Core client. Effects with lost replies are UNKNOWN; explicit readback reconciles them. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {ProductError} from '../product-access/errors.mjs';
import {decodeAdmissionReply,decodeAdmissionReadReply,decodePublicationReply,decodeAcceptanceReply,decodeCompletionReply} from './core-replies.mjs';

const unavailable=()=>new ProductError('OBJECTIVE_GENERATION_CORE_UNAVAILABLE');
const unknownOutcome=()=>new ProductError('OBJECTIVE_GENERATION_CORE_OUTCOME_UNKNOWN','UNKNOWN');


export function createCoreObjectiveGenerationClient(configuration){
 let transport,source,now,maxRequestMs;
 try{
  const c=own(configuration,['transport','source'],['now','maxRequestMs']);
  transport=c.transport;source=data(own(c.source,['generationJobId','binding']));validateShape('RunBinding',source.binding);
  now=c.now??Date.now;maxRequestMs=c.maxRequestMs??3000;
  for(const m of ['available','admit','publish','accept','readAdmission','readRequest','complete','readCompletion'])if(typeof transport?.[m]!=='function')throw unavailable();
  if(typeof now!=='function'||types.isProxy(now)||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw unavailable();
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

 /** Current access belongs to Core's saved job, including original consent and client wall. */
 async function current(value){
  const startedAtMs=clock();return decoded('current',options(value),false,raw=>{
   const v=data(own(raw,['schemaVersion','generationJobId','tenantId','actorId','clerkUserId','clientId','role','consentId','controlVersion','checkedAtMs','effectExpiresAtMs']));
   const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v);
   if(v.schemaVersion!==1||v.generationJobId!==source.generationJobId||v.tenantId!==source.binding.tenantId||v.actorId!==source.binding.actorId||
    !uuid(v.actorId)||!uuid(v.clientId)||!uuid(v.consentId)||typeof v.clerkUserId!=='string'||!v.clerkUserId||v.clerkUserId.length>128||
    typeof v.role!=='string'||!v.role||v.role.length>64||!Number.isSafeInteger(v.controlVersion)||v.controlVersion<1||
    !Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<startedAtMs||v.checkedAtMs>clock()||!Number.isSafeInteger(v.effectExpiresAtMs)||v.effectExpiresAtMs<=clock())throw unavailable();
   return v;
  });
 }

 /** POST admit: the Core-captured source admission for this job. */
 const admit=value=>decoded('admit',options(value),true,raw=>decodeAdmissionReply(raw,source));
 /** POST publish: the immutable initial typed request bound to that admission. */
 const publish=value=>{const {admission,...rest}=own(value,['admission'],['signal','deadlineMs']);
  return decoded('publish',options(rest),true,raw=>decodePublicationReply(raw,source,{admission}));};
 /** POST accept: Core pairs the job with its actual immutable accepted run. */
 const accept=value=>{const {admission,record,...rest}=own(value,['admission','record'],['signal','deadlineMs']);
  return decoded('accept',options(rest),true,raw=>decodeAcceptanceReply(raw,source,{admission,record}));};
 /** POST complete after the accepted run's typed result is retained. Core reads it
  * through its private native result reader; a lost reply is UNKNOWN (read back). */
 const completion=method=>value=>{const {admission,publication,acceptance,...rest}=own(value,['admission','publication','acceptance'],['signal','deadlineMs']);
  return decoded(method,options(rest),method==='complete',raw=>decodeCompletionReply(raw,source,{admission,publication,acceptance}));};
 const readAdmission=value=>decoded('readAdmission',options(value),false,raw=>decodeAdmissionReadReply(raw,source));
 const readRequest=(value,admission)=>decoded('readRequest',options(value),false,raw=>decodePublicationReply(raw,source,{admission}));

 return Object.freeze({available:()=>{try{return transport.available()===true;}catch{return false;}},
  current,admit,publish,accept,complete:completion('complete'),readCompletion:completion('readCompletion'),
  readAdmission:value=>readAdmission(value),
  readRequest:value=>{const {admission,...rest}=own(value,['admission'],['signal','deadlineMs']);return readRequest(rest,admission);}});
}
