/** PARTIAL_INPUT: stored exact-source and explicit-year personnel branches retain native feature/member ownership. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {assertUnscopedNewsRequest,newsSliceContext} from './request-context.mjs';

const ROUTES=Object.freeze({search_legiwatch_news:'/api/clio/tools/search_legiwatch_news'});
export function createResearchLegalNewsHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'research-legal-news',routes:ROUTES,
  requestBody(current){
   const expected=newsSliceContext(current.operation,current.request);
   if(hash(current.normalizationContext)!==hash(expected))deny('ACCESS_DENIED');
   return current.request;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  assertUnscopedNewsRequest(handler.operation,fields.request);
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
