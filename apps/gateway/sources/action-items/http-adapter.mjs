/** Restricted governed source route; no ambient credentials, retries or initialization I/O. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createDispatchLifetime} from '../../dispatch/dispatch-lifetime.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {cancelBody,responseBody,readJsonResponse} from '../json-response.mjs';
import {frozenData,ownFields,readContext,contract} from './request-context.mjs';

export function createActionItemsHttpAdapter(options) {
  const {origin,getCredentials,fetchImpl=globalThis.fetch,now,maxRequestMs=15000,maxResponseBytes=1048576}=
    ownFields(options,['origin','getCredentials','now'],['fetchImpl','maxRequestMs','maxResponseBytes']);
  if(typeof origin!=='string'||typeof getCredentials!=='function'||typeof fetchImpl!=='function'||typeof now!=='function'||
      !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3600000||
      !Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>16777216)deny('GATEWAY_CONFIGURATION');
  let endpoint;
  try {const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)deny('GATEWAY_CONFIGURATION');
    endpoint=new URL('/api/clio/tools/query_action_items',url).href;}catch{deny('GATEWAY_CONFIGURATION');}
  async function read(call) {
    let lifetime,acquired;
    try {
      const context=readContext(call,now);
      let cutoff=Math.min(context.deadlineMs,context.active()+maxRequestMs);
      lifetime=createDispatchLifetime({deadlineMs:cutoff,now,signal:context.signal});
      const active=()=>{lifetime.check();return context.active(cutoff);};
      const credentials=frozenData(await lifetime.run(signal=>{active();return getCredentials(Object.freeze({
        binding:context.authority.binding,subject:context.authority.subject,deadlineMs:cutoff,signal}));}));
      ownFields(credentials,['binding','bearerToken','serviceSecret','expiresAtMs']);
      if(canonicalSha256(credentials.binding)!==canonicalSha256(context.authority.binding)||
          !Number.isSafeInteger(credentials.expiresAtMs)||credentials.expiresAtMs<=active()||
          ![credentials.bearerToken,credentials.serviceSecret].every(x=>typeof x==='string'&&x.length>0&&x.length<=8192&&/^[\x21-\x7e]+$/.test(x)))deny('ACCESS_DENIED');
      cutoff=Math.min(cutoff,credentials.expiresAtMs);lifetime.limitDeadline(cutoff);active();
      const {selection,cursor}=context.input;
      const body={limit:selection.limit,sort:selection.sort};
      if(selection.status!==null)body.status=selection.status;
      if(context.input.mode==='client_scoped') {
        body.clientId=selection.clientId;
        if(selection.actionItemId!==null)body.actionItemId=selection.actionItemId;
        if(cursor!==null)body.cursor=cursor;
      }
      const response=await lifetime.run(async signal=>{
        active();
        const result=await fetchImpl(endpoint,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,
          headers:{authorization:`Bearer ${credentials.bearerToken}`,'x-internal-service-secret':credentials.serviceSecret,
            'content-type':'application/json',accept:'application/json','accept-encoding':'identity'},body:JSON.stringify(body)});
        acquired=result;
        try{active();return result;}catch(error){try{cancelBody(responseBody(result));}catch{}throw error;}
      });
      // Shared byte decoder uses our active check before/after every read as well.
      const bounded={run:fn=>lifetime.run(signal=>{active();return fn(signal);}),check:active};
      const result=frozenData(await readJsonResponse(response,{lifetime:bounded,maxResponseBytes}));
      if(context.input.mode==='unscoped_list')contract.assertOutput(result,{request:context.request,...context.options});
      else {
        ownFields(result,['tool','generatedAt','clientId','total','returned','actions','scope','coverage']);
        if(result.tool!=='query_action_items'||result.clientId!==selection.clientId)deny('INVALID_RESULT');
      }
      active();return result;
    }catch(error){throw safeFailure(error);}
    finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}lifetime?.close();}
  }
  return Object.freeze({read});
}
