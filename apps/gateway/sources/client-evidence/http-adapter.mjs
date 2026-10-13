/** Trusted configured client evidence protocol, bounded transport; import never performs I/O. */
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {frozenData,ownFields,operationIds,readContext,assertClientEvidenceResult} from './request-context.mjs';

const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
export function createClientEvidenceHttpAdapter(options) {
  const {endpoints:configured,getCredentials,fetchImpl=globalThis.fetch,now,maxRequestMs=15000,maxResponseBytes=1048576}=
    ownFields(options,['endpoints','getCredentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
  if(typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
      !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
  let endpoints;
  try {
    endpoints=frozenData(ownFields(configured,operationIds));
    for(const endpoint of Object.values(endpoints)) {
      if(typeof endpoint!=='string')deny('GATEWAY_CONFIGURATION');
      const url=new URL(endpoint);
      if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.href!==endpoint)deny('GATEWAY_CONFIGURATION');
    }
  }catch {deny('GATEWAY_CONFIGURATION');}
  async function read(call) {
    let lifetime,acquired;
    try {
      const context=readContext(call,now);
      const protocol=frozenData({input:context.input,metadata:context.metadata});
      const requestSha256=canonicalSha256(protocol),body=canonicalize(protocol);
      let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
      const active=()=>{lifetime.check();return context.active(cutoff);};
      const correlation=frozenData({operation:context.operation,argumentsSha256:context.argumentsSha256,
        metadata:context.metadata,requestSha256,normalizationContext:context.options,binding:context.authority.binding,subject:context.authority.subject,
        policyRevision:context.authority.policyRevision,sourceIds:context.authority.sourceIds});
      const credentials=frozenData(await lifetime.run(signal=>{
        active();return getCredentials(Object.freeze({...correlation,input:context.input,deadlineMs:cutoff,signal}));
      }));
      ownFields(credentials,[...Object.keys(correlation),'bearerToken','serviceSecret','expiresAtMs']);
      if(Object.keys(correlation).some(key=>!same(credentials[key],correlation[key]))||
          !Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=active()||
          ![credentials.bearerToken,credentials.serviceSecret].every(token=>typeof token==='string'&&
            token.length>0&&token.length<=8192&&/^[\x21-\x7e]+$/.test(token)))deny('ACCESS_DENIED');
      cutoff=Math.min(cutoff,credentials.expiresAtMs);lifetime.limitDeadline(cutoff);active();
      const response=await lifetime.run(async signal=>{
        active();
        const result=await fetchImpl(endpoints[context.operation.id],{method:'POST',redirect:'error',credentials:'omit',
          cache:'no-store',signal,headers:{authorization:`Bearer ${credentials.bearerToken}`,
            'x-internal-service-secret':credentials.serviceSecret,'content-type':'application/json',
            accept:'application/json','accept-encoding':'identity'},body});
        acquired=result;
        try {active();return result;}catch(error){try {cancelBody(responseBody(result));}catch{}throw error;}
      });
      const bounded={run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active};
      const result=frozenData(await readJsonResponse(response,{lifetime:bounded,
        maxResponseBytes:Math.min(maxResponseBytes,context.authority.claims.budgets.maxOutputBytes)}));
      assertClientEvidenceResult(result,context);active();return result;
    }catch(error){throw safeFailure(error);}
    finally {try {if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
  }
  return Object.freeze({read});
}
