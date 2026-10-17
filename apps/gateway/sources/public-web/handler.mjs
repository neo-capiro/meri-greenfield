/** Fixed public-web producers; Core owns provider access and hardened URL/PDF handling. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({
 search_public_web:'/api/clio/tools/search_public_web',
 scrape_web_page:'/api/clio/tools/scrape_web_page',
});

export function createPublicWebHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'public-web',routes:ROUTES});
}
