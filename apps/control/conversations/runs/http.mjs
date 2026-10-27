import {createProductApplication} from '../../product-access/http.mjs';
import {ProductError,asProductError} from '../../product-access/errors.mjs';
import {RUN_INDEX_PATHS,RUN_INDEX_SCHEMA,RUN_DETAIL_SCHEMA,runIndexMetadata,runIndexErrors} from '../../../../packages/contracts/conversation-history/run-protocol.mjs';
import {assertRunIndexRequest,assertRunIndexResponse} from '../../../../packages/contracts/conversation-history/run-validate.mjs';
/** The history owner keeps the final Core + membership + retention fence; this facade only chooses a durable read projection. */
export function createRunIndexApplication({store,history,gate,currentness,management,retention,now=Date.now,limits}){
 if(['list','detail'].some(k=>typeof store?.runs?.[k]!=='function')||typeof history?.recheckRelease!=='function'||typeof currentness?.assertCurrent!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const parse=(route,body)=>{try{return assertRunIndexRequest(route,body);}catch{throw new ProductError('RUN_INDEX_REQUEST_INVALID');}};
 const routes=Object.fromEntries(Object.entries(RUN_INDEX_PATHS).map(([route,path])=>[path,{errors:runIndexErrors,
  async handle({principal,body,signal}){
   try{
    const request=parse(route,body),result=await store.runs[route]({principal,request},()=>signal?.throwIfAborted());
    const entries=route==='list'?result.entries:[result],conversations=[...new Map(entries.map(e=>[e.conversation.conversationId,e.conversation])).values()];
    if(route==='detail'&&retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:request.conversationId});
    return {entries,conversations,conversation:entries[0]?.conversation,nextCursor:result.nextCursor??null,observedAt:new Date(now()).toISOString()};
   }catch(error){throw asProductError(error,'RUN_INDEX_UNAVAILABLE');}
  },release({body,result,publish,...call}){
   const request=parse(route,body);
   return history.recheckRelease({...call,request,result,operation:route==='list'?'list':'runDetail',publish:released=>{
    const visible=new Set((route==='list'?released.conversations:[released.conversation]).map(c=>c.conversationId)),runs=result.entries.filter(e=>visible.has(e.conversation.conversationId)).map(e=>e.summary);
    const value=route==='list'?{schemaVersion:RUN_INDEX_SCHEMA,observedAt:result.observedAt,scope:request.scope,status:request.status,runs,nextCursor:result.nextCursor,coverage:{kind:'current-authorized-durable-runs',complete:result.nextCursor===null,snapshot:false}}:
     {schemaVersion:RUN_DETAIL_SCHEMA,observedAt:result.observedAt,run:runs[0],continuation:{kind:'conversation-owner',physicalStopVerified:false}};
    try{return publish(assertRunIndexResponse(route,value,request));}catch(error){if(error instanceof ProductError)throw error;throw new ProductError('RUN_INDEX_CORRUPT');}
   }});
  }
 }]));
 return createProductApplication({gate,now,conversationCurrentness:currentness,conversationManagement:management,limits:{...limits,maxRequestBytes:Math.min(limits.maxRequestBytes,runIndexMetadata.requestBytes),maxResponseBytes:Math.min(limits.maxResponseBytes,runIndexMetadata.responseBytes)},routes});
}
