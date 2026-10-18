/** Monday's exact single-use Core read wire; no connection or credential on import. */
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {assertPins,assertResult,frozenData,ownFields,readContext,requestPins} from './request-context.mjs';
import {managedBoardMapping,assertMappedBoards} from './monday-mapping.mjs';

const operationId='read_monday_client_boards';
const path=`/api/clio/tools/${operationId}`;
const same=(left,right)=>canonicalSha256(left)===canonicalSha256(right);
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const invocation=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);

export function createMondaySignedHttpAdapter(options) {
  const {endpoints:configured,getCredentials,fetchImpl=globalThis.fetch,now,maxRequestMs=15000,maxResponseBytes=1048576}=
    ownFields(options,['endpoints','getCredentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes','readMemoryEligibility']);
  if(typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
      !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
  let endpoint;
  try {
    const configuredEndpoints=ownFields(configured,[operationId],['search_memory']);
    endpoint=configuredEndpoints[operationId];
    if(typeof endpoint!=='string')deny('GATEWAY_CONFIGURATION');
    const url=new URL(endpoint);
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!==path||url.href!==endpoint)
      deny('GATEWAY_CONFIGURATION');
  }catch{deny('GATEWAY_CONFIGURATION');}
  async function read(call) {
    let lifetime,acquired;
    try {
      const fields=ownFields(call,['operation','input','request','authority','normalizationContext','invocationId'],['signal']);
      if(!invocation(fields.invocationId))deny('ACCESS_DENIED');
      const context=readContext({operation:fields.operation,input:fields.input,request:fields.request,
        authority:fields.authority,normalizationContext:fields.normalizationContext,
        ...(fields.signal===undefined?{}:{signal:fields.signal})},now);
      if(context.operation.id!==operationId||!same(context.normalizationContext,{}))deny('ACCESS_DENIED');
      const pins=requestPins(context),protocol=frozenData({input:context.input,metadata:context.metadata});
      const body=JSON.stringify(protocol),target=Object.freeze({method:'POST',path,bodySha256:sha(body)});
      const correlationBytes=canonicalize(frozenData({binding:context.authority.binding,subject:context.authority.subject,
        policyRevision:context.authority.policyRevision,normalizationContext:context.normalizationContext}));
      if(typeof correlationBytes!=='string'||Buffer.byteLength(correlationBytes,'utf8')<2||
          Buffer.byteLength(correlationBytes,'utf8')>8192)deny('RESOURCE_LIMIT');
      const correlationSha256=sha(correlationBytes),requestSha256=canonicalSha256(protocol);
      let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
      const active=()=>{lifetime.check();return context.active(cutoff);};
      const credentials=frozenData(await lifetime.run(signal=>{active();return getCredentials(Object.freeze({
        ...pins,input:context.input,requestSha256,invocationId:fields.invocationId,deadlineMs:cutoff,
        target,correlationSha256,signal}));}));
      ownFields(credentials,['operation','argumentsSha256','metadata','normalizationContext','requestSha256','binding','subject',
        'policyRevision','sourceIds','invocationId','authorizationScheme','target','correlationSha256',
        'bearerToken','serviceSecret','expiresAtMs','managedBoardMapping']);
      assertPins(credentials,pins);
      if(credentials.invocationId!==fields.invocationId||credentials.authorizationScheme!=='CapiroMeriRead'||
          !same(credentials.target,target)||credentials.correlationSha256!==correlationSha256||
          credentials.requestSha256!==requestSha256||!Number.isSafeInteger(credentials.expiresAtMs)||
          credentials.expiresAtMs<=active()||credentials.expiresAtMs>context.deadlineMs||
          ![credentials.bearerToken,credentials.serviceSecret].every(token=>typeof token==='string'&&
            token.length>0&&token.length<=8192&&/^[\x21-\x7e]+$/.test(token)))deny('ACCESS_DENIED');
      cutoff=Math.min(cutoff,credentials.expiresAtMs);lifetime.limitDeadline(cutoff);active();
      const mapping=managedBoardMapping(credentials.managedBoardMapping,context);
      const response=await lifetime.run(async signal=>{
        active();const result=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
          headers:{authorization:`CapiroMeriRead ${credentials.bearerToken}`,
            'x-internal-service-secret':credentials.serviceSecret,'content-type':'application/json',accept:'application/json',
            'accept-encoding':'identity','x-meri-deadline-at':String(cutoff),
            'x-meri-read-correlation':Buffer.from(correlationBytes,'utf8').toString('base64url')},body});
        acquired=result;try{active();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}
      });
      const bounded={run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active};
      const result=frozenData(await readJsonResponse(response,{lifetime:bounded,
        maxResponseBytes:Math.min(maxResponseBytes,context.authority.claims.budgets.maxOutputBytes)}));
      active();assertResult(result,context);assertMappedBoards(result,mapping,context);active();return result;
    }catch(error){throw safeFailure(error);}
    finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
  }
  return Object.freeze({read});
}
