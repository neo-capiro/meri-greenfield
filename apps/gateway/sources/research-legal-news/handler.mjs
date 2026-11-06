/** Stored articles, exact sources and explicit-year personnel retain native feature/member ownership. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {deny,safeFailure} from '../../dispatch/operation-result.mjs';
import {ownFields} from '../source-admission.mjs';
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {assertNewsRawRequest,newsSliceContext} from './request-context.mjs';
import {assertResearchClientSubject} from '../research-legal-legislation/request-context.mjs';

const ROUTES=Object.freeze({search_legiwatch_news:'/api/clio/tools/search_legiwatch_news'}),UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export function createResearchLegalNewsHandlers(configuration,operations){
 const handlers=createStoredNativeReadHandlers(configuration,operations,{family:'research-legal-news',routes:ROUTES,observation:'news-asof',
  // Articles bind their consumed cutoff per call; named selectors reach the owner only as the resolved UUID.
  requirePerCall:current=>current.request.view==='articles'||Boolean(current.normalizationContext.clientResolution&&!UUID.test(current.normalizationContext.clientResolution.reference)),
  requestBody(current){
   const expected=newsSliceContext(current.operation,current.request,current.normalizationContext.clientResolution,current.normalizationContext.windowAsOf);
   if(hash(current.normalizationContext)!==hash(expected))deny('ACCESS_DENIED');
   assertResearchClientSubject(current.authority,expected.clientResolution);
   if(expected.clientResolution&&current.request.clientId!==expected.clientResolution.clientId)return {...current.request,clientId:expected.clientResolution.clientId};
   return current.request;
  },
 });
 return handlers.map(handler=>({operation:handler.operation,async execute(call){try{
  const fields=ownFields(call,['input','request','authority','argumentsSha256','normalizationContext'],['signal']);
  assertNewsRawRequest(handler.operation,fields.request);
  return await handler.execute(call);
 }catch(error){throw safeFailure(error);}}}));
}
