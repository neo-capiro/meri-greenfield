/** Stored economic reads retain their wire; policy-dependent siblings require a current private mode observation. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {ownFields,frozenData} from '../source-admission.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {PUBLIC_DATA_MODE_OPERATION_IDS,assertPublicDataModeRequest} from './request-context.mjs';

const ROUTES=Object.freeze({query_economic_data:'/api/clio/tools/query_economic_data'});
const MODE_ROUTES=Object.freeze({search_federal_grants:'/api/clio/tools/search_federal_grants',search_federal_awards:'/api/clio/tools/search_federal_awards'});

export function createPublicDataHandlers(configuration,operations){
 let selected;try{selected=frozenData(operations);if(!Array.isArray(selected)||!selected.length||selected.some(op=>!['query_economic_data',...PUBLIC_DATA_MODE_OPERATION_IDS].includes(ownFields(op,['id','version']).id)))deny('GATEWAY_CONFIGURATION');}catch{deny('GATEWAY_CONFIGURATION');}
 const economic=selected.filter(op=>op.id==='query_economic_data'),mode=selected.filter(op=>PUBLIC_DATA_MODE_OPERATION_IDS.includes(op.id)),handlers=[];
 if(economic.length)handlers.push(...createStoredNativeReadHandlers(configuration,economic,{family:'public-data',routes:ROUTES}));
 if(mode.length)handlers.push(...createStoredNativeReadHandlers(configuration,mode,{family:'public-data',routes:MODE_ROUTES,observation:'evidence-mode'}).map(handler=>({
  operation:handler.operation,async execute(call){try{
   const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
   assertPublicDataModeRequest(handler.operation,fields.request);return await handler.execute(call);
  }catch(error){throw safeFailure(error);}}
 })));
 return selected.map(reference=>handlers.find(handler=>handler.operation.id===reference.id));
}
