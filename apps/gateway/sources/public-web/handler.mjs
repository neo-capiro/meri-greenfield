/** Fixed public-web producers; Core owns provider access and hardened URL/PDF handling.
 * Approved AWS managed web search (SCRUM-237) replaces provider selection for discovery only:
 * `search_public_web` reads the primary port when one is supplied, and page consultation keeps
 * the native Core owner. Everything else (authority, contract checks, private result carrier,
 * bounded transport) stays the shared retained-native mechanics. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
import {createPrimarySearchReadSource} from './primary-search.mjs';

const ROUTES=Object.freeze({
 search_public_web:'/api/clio/tools/search_public_web',
 scrape_web_page:'/api/clio/tools/scrape_web_page',
});
const SPECIFICATION=Object.freeze({family:'public-web',routes:ROUTES});
/** Discovery hands the index the input the retained call context already proved equal to the receiving contract's
 * normalization (trimmed query, limit 1-12 with the contract default), so no second normalization exists and the rows
 * delivered can never exceed the limit the same contract later enforces on the result. */
const PRIMARY_SPECIFICATION=Object.freeze({...SPECIFICATION,requestBody:current=>current.input});

/** @param {object} configuration @param {{id:string,version:string}[]} operations
 *  @param {{provider:string,search:Function}} [primarySearch] approved primary discovery port */
export function createPublicWebHandlers(configuration,operations,primarySearch){
 if(primarySearch===undefined)return createStoredNativeReadHandlers(configuration,operations,SPECIFICATION);
 const rows=Array.isArray(operations)?operations:[],search=rows.filter(row=>row?.id==='search_public_web'),pages=rows.filter(row=>row?.id!=='search_public_web');
 if(!search.length&&!pages.length)deny('GATEWAY_CONFIGURATION');
 const handlers=[];
 // The retained transport refuses a delegated read source together with a per-call credential port:
 // discovery carries the gateway IAM identity, never a Core service secret.
 if(search.length){
  const delegated=Object.fromEntries(Object.entries(configuration??{}).filter(([key])=>key!=='getCredentials'&&key!=='credentialsForCall'));
  handlers.push(...createStoredNativeReadHandlers({...delegated,readSource:createPrimarySearchReadSource(primarySearch)},search,PRIMARY_SPECIFICATION));
 }
 // Page consultation keeps the configured native route, including any control-supplied read source.
 if(pages.length)handlers.push(...createStoredNativeReadHandlers(configuration,pages,SPECIFICATION));
 return handlers;
}
