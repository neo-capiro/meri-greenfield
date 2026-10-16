/** Retained research detail/changes; construction is not installation. */
import {createResearchPortfolioHandlers} from '../../sources/research-portfolio/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-portfolio',sourceDirectory='research-portfolio';
export const createHandlers=configuration=>createResearchPortfolioHandlers(configuration,familyOperations(id));
