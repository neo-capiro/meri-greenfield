/** Task-bound selected-client memory page and its distinct one-use eligibility helper. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {assertPins,assertResult,frozenData,ownFields,readContext,requestPins,same} from './request-context.mjs';
import {assertMemoryEligibility} from './memory-eligibility.mjs';

const operationId='search_memory';
const pagePath=`/api/clio/tools/${operationId}`;
const eligibilityPath='/api/clio/tools/search_memory_eligibility';
const sha=bytes=>createHash('sha256').update(bytes,'utf8').digest('hex');
const token=value=>typeof value==='string'&&value.length>0&&value.length<=8192&&/^[\x21-\x7e]+$/.test(value);

export function createSignedMemoryHttpAdapter(options) {
  const {endpoints:configured,getCredentials,getEligibilityCredentials,fetchImpl=globalThis.fetch,
    now,maxRequestMs=15000,maxResponseBytes=1048576}=ownFields(options,
    ['endpoints','getCredentials','getEligibilityCredentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
  if([getCredentials,getEligibilityCredentials,fetchImpl,now].some(value=>typeof value!=='function')||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
      !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
  let endpoint,eligibilityEndpoint;
  try {
    const selected=ownFields(configured,[operationId],['read_monday_client_boards']);
    endpoint=selected[operationId];
    if(typeof endpoint!=='string')deny('GATEWAY_CONFIGURATION');
    const url=new URL(endpoint);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
        url.pathname!==pagePath||url.href!==endpoint)deny('GATEWAY_CONFIGURATION');
    eligibilityEndpoint=new URL(eligibilityPath,url.origin).href;
  }catch {deny('GATEWAY_CONFIGURATION');}

  async function read(call) {
    let lifetime,acquired;
    try {
      const context=readContext(call,now);
      if(context.operation.id!==operationId)deny('ACCESS_DENIED');
      if(typeof context.invocationId!=='string'||typeof context.limitReleaseDeadline!=='function')deny('ACCESS_DENIED');
      const pins=requestPins(context),protocol=frozenData({input:context.input,metadata:context.metadata});
      const pageBody=JSON.stringify(protocol),pageBodySha256=sha(pageBody),pageRequestSha256=canonicalSha256(protocol);
      if(Buffer.byteLength(pageBody,'utf8')>16384)deny('RESOURCE_LIMIT');
      const pageTarget=Object.freeze({method:'POST',path:pagePath,bodySha256:pageBodySha256});
      const correlationBytes=canonicalize(frozenData({binding:context.authority.binding,subject:context.authority.subject,
        policyRevision:context.authority.policyRevision,normalizationContext:context.normalizationContext}));
      if(typeof correlationBytes!=='string'||Buffer.byteLength(correlationBytes,'utf8')<2||
          Buffer.byteLength(correlationBytes,'utf8')>8192)deny('RESOURCE_LIMIT');
      const correlationSha256=sha(correlationBytes),correlationHeader=Buffer.from(correlationBytes,'utf8').toString('base64url');
      let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
      const active=()=>{lifetime.check();return context.active(cutoff);};
      const limit=expiry=>{if(!Number.isSafeInteger(expiry)||expiry<=active())deny('ACCESS_DENIED');
        cutoff=Math.min(cutoff,expiry);lifetime.limitDeadline(cutoff);active();};
      const credentials=frozenData(await lifetime.run(signal=>{
        active();return getCredentials(Object.freeze({...pins,input:context.input,requestSha256:pageRequestSha256,
          invocationId:context.invocationId,deadlineMs:cutoff,target:pageTarget,correlationSha256,signal}));
      }));
      ownFields(credentials,['operation','argumentsSha256','metadata','normalizationContext','requestSha256',
        'binding','subject','policyRevision','sourceIds','invocationId','authorizationScheme','target',
        'correlationSha256','bearerToken','serviceSecret','expiresAtMs']);
      assertPins(credentials,pins);
      if(credentials.invocationId!==context.invocationId||credentials.authorizationScheme!=='CapiroMeriRead'||
          !same(credentials.target,pageTarget)||credentials.correlationSha256!==correlationSha256||
          credentials.requestSha256!==pageRequestSha256||!token(credentials.bearerToken)||
          !token(credentials.serviceSecret)||credentials.bearerToken===credentials.serviceSecret||
          !Number.isSafeInteger(credentials.expiresAtMs)||
          credentials.expiresAtMs<=active()||credentials.expiresAtMs>context.deadlineMs)deny('ACCESS_DENIED');
      limit(credentials.expiresAtMs);
      const pageResponse=await lifetime.run(async signal=>{
        active();const response=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
          headers:{authorization:`CapiroMeriRead ${credentials.bearerToken}`,
            'x-internal-service-secret':credentials.serviceSecret,'content-type':'application/json',
            accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(cutoff),
            'x-meri-read-correlation':correlationHeader},body:pageBody});
        acquired=response;try{active();return response;}catch(error){try{cancelBody(responseBody(response));}catch{}throw error;}
      });
      const bounded={run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active};
      const result=frozenData(await readJsonResponse(pageResponse,{lifetime:bounded,
        maxResponseBytes:Math.min(maxResponseBytes,context.authority.claims.budgets.maxOutputBytes)}));
      active();assertResult(result,context);
      const pageProof=pageResponse.headers?.get('x-meri-memory-page-proof');
      if(!token(pageProof))deny('ACCESS_DENIED');
      const expiry=await assertMemoryEligibility({result,context,pins,lifetime,active,limit,deadline:()=>cutoff,clockSkewMs:5000,
        readMemoryEligibility:async proof=>{
          const bodyFields=frozenData({operation:proof.operation,input:proof.input,metadata:proof.metadata,
            normalizationContext:proof.normalizationContext,argumentsSha256:proof.argumentsSha256,
            requestSha256:proof.requestSha256,binding:proof.binding,subject:proof.subject,
            policyRevision:proof.policyRevision,sourceIds:proof.sourceIds,
            resultSha256:proof.resultSha256,records:proof.records,deadlineMs:proof.deadlineMs});
          const helperBody=JSON.stringify(bodyFields);
          if(Buffer.byteLength(helperBody,'utf8')>16384)deny('RESOURCE_LIMIT');
          const helperTarget=Object.freeze({method:'POST',path:eligibilityPath,bodySha256:sha(helperBody)});
          const recordsSha256=canonicalSha256(proof.records);
          const helperPins=Object.freeze({...pins,invocationId:context.invocationId,pageProof,bodyJson:helperBody,
            pageBodySha256,pageRequestSha256,resultSha256:proof.resultSha256,recordsSha256,
            deadlineMs:proof.deadlineMs,target:helperTarget,correlationSha256,signal:proof.signal});
          const helper=frozenData(await lifetime.run(signal=>{
            active();return getEligibilityCredentials(Object.freeze({...helperPins,signal}));
          }));
          ownFields(helper,['operation','argumentsSha256','metadata','normalizationContext','requestSha256',
            'binding','subject','policyRevision','sourceIds','invocationId','pageProof','pageBodySha256',
            'pageRequestSha256','resultSha256','recordsSha256','authorizationScheme','target',
            'correlationSha256','bearerToken','serviceSecret','expiresAtMs']);
          assertPins(helper,pins);
          if(helper.invocationId!==context.invocationId||helper.pageProof!==pageProof||
              helper.pageBodySha256!==pageBodySha256||helper.pageRequestSha256!==pageRequestSha256||
              helper.resultSha256!==proof.resultSha256||helper.recordsSha256!==recordsSha256||
              helper.authorizationScheme!=='CapiroMeriRead'||!same(helper.target,helperTarget)||
              helper.correlationSha256!==correlationSha256||!token(helper.bearerToken)||
              !token(helper.serviceSecret)||helper.bearerToken===helper.serviceSecret||
              helper.bearerToken===credentials.bearerToken||!Number.isSafeInteger(helper.expiresAtMs)||
              helper.expiresAtMs<=active()||helper.expiresAtMs>context.deadlineMs)deny('ACCESS_DENIED');
          limit(helper.expiresAtMs);
          const helperResponse=await lifetime.run(async signal=>{
            active();const response=await fetchImpl(eligibilityEndpoint,{method:'POST',redirect:'error',
              credentials:'omit',cache:'no-store',signal,headers:{authorization:`CapiroMeriRead ${helper.bearerToken}`,
                'x-internal-service-secret':helper.serviceSecret,'content-type':'application/json',
                accept:'application/json','accept-encoding':'identity','x-meri-deadline-at':String(cutoff),
                'x-meri-read-correlation':correlationHeader},body:helperBody});
            acquired=response;try{active();return response;}catch(error){try{cancelBody(responseBody(response));}catch{}throw error;}
          });
          return frozenData(await readJsonResponse(helperResponse,{lifetime:bounded,maxResponseBytes:Math.min(maxResponseBytes,32768)}));
        }});
      // Only the dispatcher owns final release after retention and settlement.
      context.limitReleaseDeadline(expiry);
      active();return result;
    }catch(error){throw safeFailure(error);}
    finally {try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
  }
  return Object.freeze({read});
}
