/** MO-05 conversation-scoped Research Portfolio workflow reads over Core's trusted current-turn transport. */
import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {researchPortfolioToolEnvelope} from '../../sources/retained-reads/research-portfolio-envelope.mjs';
import {RESEARCH_WORKFLOW_READS} from '../../../../packages/contracts/retrieval-0.2/research-portfolio-workflow-validation.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-portfolio-workflow',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{
 family:id,requirePerCall:()=>true,routes:Object.fromEntries(RESEARCH_WORKFLOW_READS.map(operation=>[operation,`/api/clio/tools/${operation}`])),
 requestBody:researchPortfolioToolEnvelope,
});
