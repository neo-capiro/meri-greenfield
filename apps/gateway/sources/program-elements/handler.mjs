/** Three fixed native program-element producers, receiving under the current private evidence mode. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {ownFields} from '../source-admission.mjs';
import {safeFailure} from '../../dispatch/operation-result.mjs';
import {assertProgramElementRequest} from './request-context.mjs';
const ROUTES=Object.freeze({search_program_elements:'/api/clio/tools/search_program_elements',get_program_element:'/api/clio/tools/get_program_element',get_pe_budget_timeline:'/api/clio/tools/get_pe_budget_timeline'});

export function createProgramElementHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'program-elements',routes:ROUTES,observation:'evidence-mode'}).map(handler=>({
  operation:handler.operation,async execute(call){try{
   const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
   assertProgramElementRequest(handler.operation,fields.request);return await handler.execute(call);
  }catch(error){throw safeFailure(error);}}
 }));
}
