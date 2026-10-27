import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {researchPortfolioToolEnvelope} from '../../sources/retained-reads/research-portfolio-envelope.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-portfolio-sharing',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{
 family:id,requirePerCall:()=>true,routes:{get_research_portfolio_share_links:'/api/clio/tools/get_research_portfolio_share_links'},
 requestBody:researchPortfolioToolEnvelope,
});
