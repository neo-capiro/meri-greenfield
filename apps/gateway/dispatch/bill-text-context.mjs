/** Captured CONTROL Congress context for the two stored bill reads, never a model/default-clock hint. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {deny} from './operation-result.mjs';
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function prepareBillTextReadContext({entry,authority,identity,defaultCongress}){
 if(entry.contract.binding?.group!=='bill-text')deny('GATEWAY_CONFIGURATION');
 if(defaultCongress===undefined)deny('UNAVAILABLE');
 if(!Number.isSafeInteger(defaultCongress)||defaultCongress<1||defaultCongress>2147483647)deny('GATEWAY_CONFIGURATION');
 function observeAuthority(current){if(!same(current.binding,identity.claims.binding)||!same(current.binding,authority.binding)||current.policyRevision!==identity.claims.policyRevision||current.policyRevision!==authority.policyRevision)deny('ACCESS_DENIED');}
 observeAuthority(authority);
 const options=Object.freeze({defaultCongress});
 return Object.freeze({authority,handlerNormalization:true,options(current=authority){observeAuthority(current);return options;},observeAuthority,async retain(){}});
}
