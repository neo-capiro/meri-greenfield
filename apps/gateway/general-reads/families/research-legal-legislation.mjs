import {createResearchLegalLegislationHandlers} from '../../sources/research-legal-legislation/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-legal-legislation',sourceDirectory='research-legal-legislation';
export const createHandlers=configuration=>createResearchLegalLegislationHandlers(configuration,familyOperations(id));
