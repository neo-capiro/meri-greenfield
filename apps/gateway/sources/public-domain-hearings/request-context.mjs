/** Finite selector capture only. Canonical shape validation grants no client access. */
import {snapshotOperationData} from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function captureHearingClientReference(raw){
 const request=snapshotOperationData(raw);validateShape('PublicDomainHearingsRequest',request);
 return request.clientId?.trim().slice(0,80).trim()||null;
}
export function captureHearingClientSelection(raw,resolution){
 const reference=captureHearingClientReference(raw);
 if(reference===null)return null;
 if(UUID.test(reference))return Object.freeze({reference,clientId:reference.toLowerCase()});
 if(resolution===undefined)deny('UNAVAILABLE');
 const value=snapshotOperationData(resolution);
 if(!value||Object.keys(value).length!==2||value.reference!==reference||typeof value.clientId!=='string'||!UUID.test(value.clientId)||value.clientId!==value.clientId.toLowerCase())deny('ACCESS_DENIED');
 return Object.freeze({reference,clientId:value.clientId});
}
