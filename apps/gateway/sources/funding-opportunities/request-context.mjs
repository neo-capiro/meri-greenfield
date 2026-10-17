/** Pure funding selector capture. Clock capture and current visibility belong to the private native owner. */
import {snapshotOperationData} from '../../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
import {assertSubject,resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {ownFields} from '../source-admission.mjs';
import {deny} from '../../dispatch/operation-result.mjs';

export function captureFundingClientSelection(operation,request){
 let reference,contract,raw;
 try{reference=ownFields(snapshotOperationData(operation),['id','version']);contract=resolveOperationContract(reference);}catch{deny('INVALID_ARGUMENTS');}
 if(contract.binding.group!=='funding-opportunities'||reference.version!=='0.2.0')deny('UNAVAILABLE');
 try{raw=snapshotOperationData(request);validateShape(contract.binding.input,raw);}catch{deny('INVALID_ARGUMENTS');}
 // All five frozen inputs and actual native gates require the explicit UUID, without trimming or coercion.
 return Object.freeze({clientId:raw.clientId.toLowerCase()});
}

export function assertFundingClientSubject(subject,selection){
 let selected,clientId;
 try{selected=snapshotOperationData(subject);assertSubject(selected);({clientId}=ownFields(snapshotOperationData(selection),['clientId']));validateShape('FundingClientContextInput',{clientId});}catch{deny('ACCESS_DENIED');}
 if(selected.kind!=='client'||selected.entityType!=='client'||selected.entityIds.length!==1||
  selected.entityIds[0].toLowerCase()!==clientId||
  !selected.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()===clientId)||
  selected.scopes.some(scope=>scope.kind==='client'&&scope.resourceId.toLowerCase()!==clientId))deny('ACCESS_DENIED');
}
