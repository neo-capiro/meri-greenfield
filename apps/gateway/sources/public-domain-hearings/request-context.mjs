/** Finite selector capture only. Canonical shape validation grants no client access. */
import {snapshotOperationData} from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function captureHearingClientSelection(raw){
 const request=snapshotOperationData(raw);validateShape('PublicDomainHearingsRequest',request);
 const reference=request.clientId?.trim().slice(0,80).trim()||null;
 if(reference===null)return null;
 if(!UUID.test(reference))deny('UNAVAILABLE');
 return Object.freeze({reference,clientId:reference.toLowerCase()});
}
