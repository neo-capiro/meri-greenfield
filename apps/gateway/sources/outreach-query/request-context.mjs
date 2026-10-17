/** Pure capture for the explicit-client campaign list slice; selectors never establish current permission. */
import {snapshotOperationData} from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function captureOutreachListClientSelection(raw){
 let request;try{request=snapshotOperationData(raw);validateShape('OutreachQueryRequest',request);}catch{deny('INVALID_ARGUMENTS');}
 // Even an empty/malformed detail selector is outside this partial-input boundary.
 if(Object.hasOwn(request,'outreachId'))deny('UNAVAILABLE');
 const reference=request.clientId?.trim().slice(0,80).trim()||null;
 if(reference===null||!UUID.test(reference))deny('UNAVAILABLE');
 return Object.freeze({reference,clientId:reference.toLowerCase()});
}
