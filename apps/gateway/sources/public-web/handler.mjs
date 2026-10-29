/** Fixed public-web producers; Core owns provider access and hardened URL/PDF handling.
 * Approved AWS managed web search (SCRUM-237) replaces provider selection for discovery only:
 * `search_public_web` reads the primary port when one is supplied, and page consultation keeps
 * the native Core owner. Everything else (authority, contract checks, private result carrier,
 * bounded transport) stays the shared retained-native mechanics. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {createPrimarySearchReadSource} from './primary-search.mjs';

const ROUTES=Object.freeze({
 search_public_web:'/api/clio/tools/search_public_web',
 scrape_web_page:'/api/clio/tools/scrape_web_page',
});
const SPECIFICATION=Object.freeze({family:'public-web',routes:ROUTES});

/** @param {object} configuration @param {{id:string,version:string}[]} operations
 *  @param {{provider:string,search:Function,admission?:object}} [primarySearch] approved primary discovery port */
export function createPublicWebHandlers(configuration,operations,primarySearch){
 if(primarySearch===undefined)return createStoredNativeReadHandlers(configuration,operations,SPECIFICATION);
 // A mounted paid provider must carry its own admission facts: a producer that cannot state its unit price and
 // attempt ceiling is a wiring defect and must not run under a retained free allocation.
 const admission=primarySearch.admission;
 if(admission===null||typeof admission!=='object'||admission.provider!==primarySearch.provider||
    !Number.isSafeInteger(admission.unitMicroUsd)||admission.unitMicroUsd<1||![1,2].includes(admission.maxAttempts))deny('GATEWAY_CONFIGURATION');
 const rows=Array.isArray(operations)?operations:[],search=rows.filter(row=>row?.id==='search_public_web'),pages=rows.filter(row=>row?.id!=='search_public_web');
 const handlers=[];
 // The retained transport refuses a delegated read source together with a per-call credential port:
 // discovery carries the gateway IAM identity, never a Core service secret.
 if(search.length){
  const delegated=Object.fromEntries(Object.entries(configuration??{}).filter(([key])=>key!=='getCredentials'&&key!=='credentialsForCall'));
  handlers.push(...createStoredNativeReadHandlers({...delegated,readSource:createPrimarySearchReadSource(primarySearch)},search,SPECIFICATION));
 }
 // Page consultation keeps the configured native route, including any control-supplied read source.
 if(pages.length)handlers.push(...createStoredNativeReadHandlers(configuration,pages,SPECIFICATION));
 return handlers;
}
