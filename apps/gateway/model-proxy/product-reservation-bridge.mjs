/** Private, one-shot shape adapter for ProductReservationAdapter.reserve(value,
 * observation). The second argument is an untrusted cross-process claim. The
 * constructor-captured host callback must independently authenticate the
 * direct proxy call and capture its original/native bytes and AWS count.
 * This file opens no listener, decodes no public request, and sends no AWS call.
 */
import {isDeepStrictEqual,types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {refuse} from '../budget/postgres-budget-store.mjs';
import {createProductProxyRequestOwner} from './product-request-owner.mjs';

const deny=()=>refuse('PRODUCT_PROXY_BRIDGE_REFUSED');
function boundedBytes(value){
 if(!Buffer.isBuffer(value)||types.isProxy(value)||value.length<1||value.length>4*1024*1024)deny();
 return Buffer.from(value);
}
function snapshot(value){
 const o=own(value,['requestId','peer','proxyCredential','rawRequestBody','nativeRequest','count']);
 const peer=own(o.peer,['binding','taskArn','grantId','observedAtMs']);
 const native=own(o.nativeRequest,['method','url','host','contentType','body','headers']);
 const count=own(o.count,['inputTokens','nativeBodySha256','modelId','origin']);
 if(typeof o.proxyCredential!=='string'||o.proxyCredential.length>256||!Array.isArray(native.headers)||types.isProxy(native.headers)||native.headers.length>64)deny();
 const headers=native.headers.map(pair=>{
  if(!Array.isArray(pair)||types.isProxy(pair)||pair.length!==2||pair.some(item=>typeof item!=='string'||item.length>8192))deny();
  return [...pair];
 });
 return {requestId:o.requestId,peer:{...peer,binding:data(peer.binding)},proxyCredential:o.proxyCredential,
  rawRequestBody:boundedBytes(o.rawRequestBody),nativeRequest:{...native,body:boundedBytes(native.body),headers},count};
}

/** The host installs this adapter only for one authenticated send lifetime.
 * `captureAuthenticatedCall` receives the requested slot but never the Python
 * observation. It must observe the transport peer, bearer, original inbound
 * bytes, final HTTPX native bytes and one CountTokens result independently.
 * A caller-supplied callback or an observation decoded from the caller's JSON
 * would not satisfy this contract.
 */
export function createProductProxyReservationBridge(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','modelGrantId','selectedClientId','pricing','captureAuthenticatedCall','checkCurrentConversation','now','limits']);
 if(typeof c.captureAuthenticatedCall!=='function'||typeof c.checkCurrentConversation!=='function')deny();
 let entered=false;
 return Object.freeze({async reserve(value,claimedObservation){
  if(entered)deny();entered=true;
  // Read the claimed value once, then pass only the independently observed
  // source to the canonical reservation owner. Both ports reject extra keys.
  const submitted=own(value,['requestId','binding','deadlineMs'],['signal']);
  nativeSignal(submitted.signal);
  const request=Object.freeze({requestId:submitted.requestId,binding:data(submitted.binding),deadlineMs:submitted.deadlineMs,signal:submitted.signal});
  const claim=snapshot(claimedObservation);
  const authenticated=snapshot(await c.captureAuthenticatedCall(request));
  if(!isDeepStrictEqual(claim,authenticated))deny();
  const owner=createProductProxyRequestOwner({pool:c.pool,allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,
   modelGrantId:c.modelGrantId,selectedClientId:c.selectedClientId,pricing:c.pricing,now:c.now,limits:c.limits,checkCurrentConversation:c.checkCurrentConversation,
   observeProxy:async observedRequest=>{
    if(!isDeepStrictEqual(observedRequest,request))deny();
    return authenticated;
   }});
  return owner.reserve(request);
 }});
}
