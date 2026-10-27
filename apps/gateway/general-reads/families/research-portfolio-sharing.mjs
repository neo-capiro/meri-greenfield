import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {familyOperations} from '../registration.mjs';
import {deny} from '../../dispatch/operation-result.mjs';
export const id='research-portfolio-sharing',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{
 family:id,requirePerCall:()=>true,routes:{get_research_portfolio_share_links:'/api/clio/tools/get_research_portfolio_share_links'},
 requestBody(c){if(c.request.conversationId!==c.authority.binding.conversationId)deny('ACCESS_DENIED');return c.request;},
});
