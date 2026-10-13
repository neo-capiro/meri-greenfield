/** Fixed configured passive source protocol; no credentials or connections on import. */
import canonicalize from 'canonicalize';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {assertPins,assertResult,frozenData,operationIds,ownFields,readContext,requestPins} from './request-context.mjs';
import {managedBoardMapping,assertMappedBoards} from './monday-mapping.mjs';
import {assertMemoryEligibility} from './memory-eligibility.mjs';

export function createClientKnowledgeHttpAdapter(options) {
  const {endpoints:configured,getCredentials,readMemoryEligibility,fetchImpl=globalThis.fetch,now,maxRequestMs=15000,maxResponseBytes=1048576}=
    ownFields(options,['endpoints','getCredentials','readMemoryEligibility','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
  if([getCredentials,readMemoryEligibility,fetchImpl,now].some(value=>typeof value!=='function')||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
      !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
  const endpoints={};
  for(const [id,value] of Object.entries(ownFields(configured,operationIds))) {
    try {if(typeof value!=='string')deny('GATEWAY_CONFIGURATION');const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)deny('GATEWAY_CONFIGURATION');endpoints[id]=url.href;
    }catch {deny('GATEWAY_CONFIGURATION');}
  }
  Object.freeze(endpoints);
  async function read(call) {
    let lifetime,acquired;
    try {
      const context=readContext(call,now),pins=requestPins(context);
      let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
      const active=()=>{lifetime.check();return context.active(cutoff);};
      const limit=expiry=>{if(!Number.isSafeInteger(expiry)||expiry<=active())deny('ACCESS_DENIED');
        cutoff=Math.min(cutoff,expiry);lifetime.limitDeadline(cutoff);active();};
      const credentials=frozenData(await lifetime.run(signal=>{active();return getCredentials(Object.freeze({...pins,deadlineMs:cutoff,signal}));}));
      ownFields(credentials,['operation','argumentsSha256','metadata','normalizationContext','requestSha256','binding','subject','policyRevision',
        'sourceIds','bearerToken','serviceSecret','expiresAtMs'],context.operation.id==='read_monday_client_boards'?['managedBoardMapping']:[]);
      assertPins(credentials,pins);
      if(![credentials.bearerToken,credentials.serviceSecret].every(token=>typeof token==='string'&&token.length>0&&token.length<=8192&&/^[\x21-\x7e]+$/.test(token)))deny('ACCESS_DENIED');
      limit(credentials.expiresAtMs);
      const mapping=context.operation.id==='read_monday_client_boards'?managedBoardMapping(credentials.managedBoardMapping,context):null;
      const response=await lifetime.run(async signal=>{
        active();const result=await fetchImpl(endpoints[context.operation.id],{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
          headers:{authorization:`Bearer ${credentials.bearerToken}`,'x-internal-service-secret':credentials.serviceSecret,
            'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},
          body:canonicalize({input:context.input,metadata:context.metadata})});
        acquired=result;try {active();return result;}catch(error){try {cancelBody(responseBody(result));}catch {}throw error;}
      });
      const bounded={run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active};
      const result=frozenData(await readJsonResponse(response,{lifetime:bounded,maxResponseBytes}));
      active();assertResult(result,context);
      if(mapping!==null)assertMappedBoards(result,mapping,context);
      else await assertMemoryEligibility({result,context,pins,readMemoryEligibility,lifetime,active,limit,deadline:()=>cutoff});
      active();return result;
    }catch(error){throw safeFailure(error);}
    finally {try {if(acquired)cancelBody(responseBody(acquired));}catch {}lifetime?.close();}
  }
  return Object.freeze({read});
}
