/** Fixed typed global query. Core owns its registry/compiler, analytics role and best-effort tenant/user audit writes. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {projectNativeQueryResult} from './native-result.mjs';
const ROUTES=Object.freeze({query_global_data:'/api/clio/tools/query_global_data'});
// Canonical admission has already established dataset support and captured the trusted default.
// Preserve original selectors for one native parsing pass and retain original request/hash receiving.
const requestBody=current=>!Object.hasOwn(current.request,'asOfDate')&&current.input.asOfDate!==null
 ?{...current.request,asOfDate:current.input.asOfDate}:current.request;
export const createPublicDomainQueryHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'public-domain-query',routes:ROUTES,requestBody,resultBody:projectNativeQueryResult});
