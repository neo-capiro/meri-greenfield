/** Tenant numbers only; ordinary native membership is rechecked at release. No
 * conversation/run selectors or protected transcript content cross this owner. */
import {createProductApplication,PRODUCT_ERROR_STATUSES} from '../../product-access/http.mjs';
import {ProductError,asProductError} from '../../product-access/errors.mjs';
import {USAGE_OVERVIEW_PATH,USAGE_OVERVIEW_SCHEMA,USAGE_OVERVIEW_SCHEMA_V2,usageOverviewErrors,usageOverviewMetadata,usageOverviewMetadataV2} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {assertUsageOverviewRequest,assertUsageOverviewResponse,assertUsageOverviewRequestV2,assertUsageOverviewResponseV2} from '../../../../packages/contracts/conversation-usage/overview-validate.mjs';
/** Exact-discriminator negotiation on the one advertised route: the request's own closed schemaVersion
 * selects the version and nothing else does. An absent, unknown or non-string version is refused before any
 * read, so a consumer that follows either published metadata block reaches the body that block advertises. */
const wireVersion=body=>{const version=body?.schemaVersion;return version===USAGE_OVERVIEW_SCHEMA?'1':version===USAGE_OVERVIEW_SCHEMA_V2?'2':null;};
export function createUsageOverviewApplication({store,gate,now=Date.now,limits}){
 if(typeof store?.usageOverview?.read!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const errors=Object.fromEntries(Object.entries(usageOverviewErrors).filter(([code])=>!Object.hasOwn(PRODUCT_ERROR_STATUSES,code)).map(([code,status])=>[code,status[0]]));
 // The transport accepts the widest published bound. The /1 response keeps its own narrower published bound
 // inside the handler, so serving both versions never widens what the old version is allowed to return.
 const requestBytes=Math.max(usageOverviewMetadata.requestBytes,usageOverviewMetadataV2.requestBytes);
 const responseBytes=Math.max(usageOverviewMetadata.responseBytes,usageOverviewMetadataV2.responseBytes);
 return createProductApplication({gate,now,limits:{...limits,maxRequestBytes:Math.min(limits.maxRequestBytes,requestBytes),maxResponseBytes:Math.min(limits.maxResponseBytes,responseBytes)},
  routes:{[USAGE_OVERVIEW_PATH]:{errors,async handle({principal,body,signal}){
   const version=wireVersion(body);
   if(version===null)throw new ProductError('USAGE_OVERVIEW_REQUEST_INVALID');
   try{if(version==='1')assertUsageOverviewRequest(body);else assertUsageOverviewRequestV2(body);}catch{throw new ProductError('USAGE_OVERVIEW_REQUEST_INVALID');}
   // The one production reader projects the requested version from the same canonical snapshot.
   let value;try{value=await store.usageOverview.read({principal,version},()=>signal?.throwIfAborted());}catch(error){throw asProductError(error,'USAGE_OVERVIEW_UNAVAILABLE');}
   if(version==='1'){
    let response;try{response=assertUsageOverviewResponse(value);}catch{throw new ProductError('USAGE_OVERVIEW_CORRUPT');}
    if(Buffer.byteLength(JSON.stringify(response),'utf8')>usageOverviewMetadata.responseBytes)throw new ProductError('USAGE_OVERVIEW_CORRUPT');
    return response;
   }
   try{return assertUsageOverviewResponseV2(value);}catch{throw new ProductError('USAGE_OVERVIEW_CORRUPT');}
  }}}});
}
