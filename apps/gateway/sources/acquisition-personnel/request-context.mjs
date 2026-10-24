/** Correlation only. A genuine current Core role/principal owner is still required. */
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {frozenData,ownFields} from '../source-admission.mjs';
import {retainedCall} from '../retained-reads/call-context.mjs';
export function acquisitionOperation(reference){
 const operation=frozenData(ownFields(reference,['id','version']));
 try{if(operation.version!=='0.2.0'||resolveOperationContract(operation).binding?.group!=='acquisition-personnel')deny('GATEWAY_CONFIGURATION');}
 catch{deny('GATEWAY_CONFIGURATION');}
 return operation;
}
export function acquisitionCall(operation,call,now){
 const {signal,...fields}=ownFields(call,['input','request','authority','argumentsSha256'],['normalizationContext','signal']);
 if(fields.normalizationContext===undefined||fields.normalizationContext===null)deny('UNAVAILABLE');
 const data=frozenData(fields);
 if(!Object.hasOwn(data.normalizationContext,'actorRole'))deny('UNAVAILABLE');
 try{resolveOperationContract(operation).normalizeInput(data.request,data.normalizationContext);}catch{deny('INVALID_ARGUMENTS');}
 return retainedCall(operation,{...data,...(signal===undefined?{}:{signal})},now);
}
