import {createResearchLegalCandidatesHandlers} from '../../sources/research-legal-candidates/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-legal-candidates',sourceDirectory='research-legal-candidates';
export const createHandlers=configuration=>createResearchLegalCandidatesHandlers(configuration,familyOperations(id));
