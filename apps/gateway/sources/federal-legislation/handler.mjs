/** Stored bill status and floor votes over fixed native Core producers. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const routes=Object.freeze({get_bill_status:'/api/clio/tools/get_bill_status',search_floor_votes:'/api/clio/tools/search_floor_votes'});

export function createFederalLegislationHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'federal-legislation',routes,requestBody(current){
  // Core resolves a raw designation against its own calendar. The frozen
  // contract already selected the bill against trusted captured context.
  // Canonical IDs are parser-idempotent; other fields retain their raw bytes
  // for Core's one trim/clip pass. Proof and receiving bind the original request.
  return current.input.billId===null?current.request:{...current.request,billId:current.input.billId};
 }});
}
