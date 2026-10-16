/** research-portfolio-evidence: retain the existing typed projection and subject checks. */
import {createResearchPortfolioEvidenceHttpAdapter} from '../../sources/research-portfolio-evidence/http-adapter.mjs';
import {createResearchPortfolioEvidenceHandler} from '../../sources/research-portfolio-evidence/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-portfolio-evidence',sourceDirectory='research-portfolio-evidence';
export function createHandlers(configuration){
 const adapter=createResearchPortfolioEvidenceHttpAdapter(configuration);
 return familyOperations(id).map(operation=>({operation,execute:createResearchPortfolioEvidenceHandler({adapter,now:configuration.now})}));
}
