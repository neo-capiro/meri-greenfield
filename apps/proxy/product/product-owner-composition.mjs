/** Per-send owner composition for the private product proxy boundary.
 *
 * The trusted service bootstrap must supply `hostChannel` for one already
 * authenticated direct TLS send. Its captures must come from the observed
 * socket, original and final native bytes, AWS CountTokens result, retained
 * UNKNOWN receipt, complete response and EOF. Neither Python claim is a
 * source for those captures. This module opens no listener or channel, and
 * does not authenticate a peer, create a pool, or own a second ledger. The
 * port's method names are not proof of authentication: leave this composition
 * unmounted until private transport, peer and task-lease verification exist.
 */
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {refuse} from '../../gateway/budget/postgres-budget-store.mjs';
import {createProductProxyReservationBridge} from '../../gateway/model-proxy/product-reservation-bridge.mjs';
import {createProductProxySettlementBridge} from '../../gateway/model-proxy/product-settlement-bridge.mjs';

const slot=/^[A-Za-z0-9_-]{1,128}$/u;
const deny=()=>refuse('PRODUCT_PROXY_OWNER_COMPOSITION_REFUSED');

export function createProductProxyOwnerComposition(configuration){
 const c=own(configuration,['pool','allocationJson','grantFactsJsons','modelGrantId',
  'selectedClientId','pricing','requestId','now','limits','checkCurrentConversation','hostChannel']);
 const channel=own(c.hostChannel,['requestId','captureAuthenticatedCall','captureAuthenticatedComplete']);
 if(typeof c.pool?.connect!=='function'||typeof c.requestId!=='string'||!slot.test(c.requestId)
    ||channel.requestId!==c.requestId||typeof channel.captureAuthenticatedCall!=='function'
    ||typeof channel.captureAuthenticatedComplete!=='function'
    ||typeof c.checkCurrentConversation!=='function'||typeof c.now!=='function')deny();

 // Both adapters receive the identical borrowed pool and persisted grant facts.
 // The channel is constructor-captured, never selected by an inbound claim.
 const reservation=createProductProxyReservationBridge({pool:c.pool,
  allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,
  modelGrantId:c.modelGrantId,selectedClientId:c.selectedClientId,pricing:c.pricing,
  now:c.now,limits:c.limits,checkCurrentConversation:c.checkCurrentConversation,
  captureAuthenticatedCall:request=>channel.captureAuthenticatedCall(request)});
 const settlement=createProductProxySettlementBridge({pool:c.pool,
  allocationJson:c.allocationJson,grantFactsJsons:c.grantFactsJsons,
  modelGrantId:c.modelGrantId,pricing:c.pricing,requestId:c.requestId,
  captureAuthenticatedComplete:request=>channel.captureAuthenticatedComplete(request)});
 return Object.freeze({
  reserve:(value,claim)=>reservation.reserve(value,claim),
  settleComplete:(requestId,claim)=>settlement.settleComplete(requestId,claim),
  readOutcome:requestId=>settlement.readOutcome(requestId),
 });
}
