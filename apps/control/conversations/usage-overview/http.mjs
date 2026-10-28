/** Tenant numbers only; ordinary native membership is rechecked at release. No
 * conversation/run selectors or protected transcript content cross this owner. */
import {createProductApplication,PRODUCT_ERROR_STATUSES} from '../../product-access/http.mjs';
import {ProductError,asProductError} from '../../product-access/errors.mjs';
import {USAGE_OVERVIEW_PATH,usageOverviewErrors,usageOverviewMetadata} from '../../../../packages/contracts/conversation-usage/overview-protocol.mjs';
import {assertUsageOverviewRequest,assertUsageOverviewResponse} from '../../../../packages/contracts/conversation-usage/overview-validate.mjs';
export function createUsageOverviewApplication({store,gate,now=Date.now,limits}){
 if(typeof store?.usageOverview?.read!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const errors=Object.fromEntries(Object.entries(usageOverviewErrors).filter(([code])=>!Object.hasOwn(PRODUCT_ERROR_STATUSES,code)).map(([code,status])=>[code,status[0]]));
 return createProductApplication({gate,now,limits:{...limits,maxRequestBytes:Math.min(limits.maxRequestBytes,usageOverviewMetadata.requestBytes),maxResponseBytes:Math.min(limits.maxResponseBytes,usageOverviewMetadata.responseBytes)},
  routes:{[USAGE_OVERVIEW_PATH]:{errors,async handle({principal,body,signal}){
   try{assertUsageOverviewRequest(body);}catch{throw new ProductError('USAGE_OVERVIEW_REQUEST_INVALID');}
   let value;try{value=await store.usageOverview.read({principal},()=>signal?.throwIfAborted());}catch(error){throw asProductError(error,'USAGE_OVERVIEW_UNAVAILABLE');}
   try{return assertUsageOverviewResponse(value);}catch{throw new ProductError('USAGE_OVERVIEW_CORRUPT');}
  }}}});
}
