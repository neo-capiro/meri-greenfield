import {createResearchLegalNewsHandlers} from '../../sources/research-legal-news/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='research-legal-news',sourceDirectory='research-legal-news';
export const createHandlers=configuration=>createResearchLegalNewsHandlers(configuration,familyOperations(id));
