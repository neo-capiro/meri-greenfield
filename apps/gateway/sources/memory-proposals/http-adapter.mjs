/** One signed, reservation-bound selected-client proposal page. No ambient
 * Bearer, retry, or alias to the ordinary Core list_memory_proposals route. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {frozenData,ownFields,readContext,operation} from './request-context.mjs';

const route='/api/clio/tools/memory.list_own_proposals';
const sha=bytes=>createHash('sha256').update(bytes,'utf8').digest('hex');
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
const token=value=>typeof value==='string'&&/^[\x21-\x7e]{1,8192}$/u.test(value);

export function createMemoryProposalHttpAdapter(options){
 const {origin,getCredentials,fetchImpl=globalThis.fetch,now,maxResponseBytes,maxRequestMs}=ownFields(options,
  ['origin','getCredentials','now','maxResponseBytes','maxRequestMs'],['fetchImpl']);
 if(typeof origin!=='string'||typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
    !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16*1024*1024||
    !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000)deny('GATEWAY_CONFIGURATION');
 let endpoint;
 try{const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)deny('GATEWAY_CONFIGURATION');
  endpoint=new URL(route,url).href;}catch{deny('GATEWAY_CONFIGURATION');}
 async function read(call){
  let lifetime,acquired;
  try{
   const context=readContext(call,now);
   const protocol=frozenData({input:context.input,metadata:context.metadata});
   const body=JSON.stringify(protocol),target=Object.freeze({method:'POST',path:route,bodySha256:sha(body)});
   const correlationBytes=canonicalize(frozenData({binding:context.authority.binding,
    subject:context.authority.subject,policyRevision:context.authority.policyRevision,normalizationContext:null}));
   if(typeof correlationBytes!=='string'||Buffer.byteLength(correlationBytes,'utf8')>8192)deny('RESOURCE_LIMIT');
   const correlationSha256=sha(correlationBytes);
   let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
   lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
   const active=()=>{lifetime.check();return context.active(cutoff);};
   const pins=Object.freeze({operation,input:context.input,metadata:context.metadata,
    argumentsSha256:context.argumentsSha256,requestSha256:context.requestSha256,
    binding:context.authority.binding,subject:context.authority.subject,
    policyRevision:context.authority.policyRevision,sourceIds:context.authority.sourceIds,
    invocationId:context.invocationId});
   const {input:ignoredInput,...echo}=pins;
   const credentials=frozenData(await lifetime.run(signal=>{
    active();return getCredentials(Object.freeze({...pins,deadlineMs:cutoff,target,correlationSha256,signal}));
   }));
   ownFields(credentials,[...Object.keys(echo),'authorizationScheme','target','correlationSha256',
    'bearerToken','serviceSecret','expiresAtMs']);
   if(credentials.authorizationScheme!=='CapiroMeriRead'||!same(credentials.target,target)||
      credentials.correlationSha256!==correlationSha256||
      Object.keys(echo).some(key=>!same(credentials[key],echo[key]))||
      !Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=active()||
      credentials.expiresAtMs>context.deadlineMs||!token(credentials.bearerToken)||
      !token(credentials.serviceSecret)||credentials.bearerToken===credentials.serviceSecret)deny('ACCESS_DENIED');
   cutoff=Math.min(cutoff,credentials.expiresAtMs);lifetime.limitDeadline(cutoff);active();
   const response=await lifetime.run(async signal=>{
    active();
    const result=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
     headers:{authorization:`CapiroMeriRead ${credentials.bearerToken}`,
      'x-internal-service-secret':credentials.serviceSecret,'content-type':'application/json',
      accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(cutoff),
      'x-meri-read-correlation':Buffer.from(correlationBytes,'utf8').toString('base64url')},body});
    acquired=result;
    try{active();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}
   });
   const bounded={run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active};
   const page=frozenData(await readJsonResponse(response,{lifetime:bounded,
    maxResponseBytes:Math.min(maxResponseBytes,context.authority.claims.budgets.maxOutputBytes)}));
   validateShape('MemoryProposalReadResult',page);
   active();return page;
  }catch(error){throw safeFailure(error);}
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
 }
 return Object.freeze({read});
}
