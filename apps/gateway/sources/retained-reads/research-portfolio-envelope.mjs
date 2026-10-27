/** Core admits a Research Portfolio tool read only inside its trusted current-turn envelope (`meri-rp-tool-transport.ts`):
 * the run's own binding and the current selected client, taken from the admitted read context, never from arguments.
 * A flat body is reserved for CapiroMeriRead delegations, which attended native reads never carry. */
import {deny} from '../../dispatch/operation-result.mjs';
export function researchPortfolioToolEnvelope(c){
 const binding=c.authority.binding,selectedClientId=c.normalizationContext?.selectedClientId;
 if(c.request.conversationId!==binding.conversationId||selectedClientId!==null&&typeof selectedClientId!=='string')deny('ACCESS_DENIED');
 return {version:1,input:c.request,currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}};
}
