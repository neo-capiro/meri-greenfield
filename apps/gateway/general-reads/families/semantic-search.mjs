import {createSemanticSearchHandlers} from '../../sources/semantic-search/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='semantic-search',sourceDirectory='semantic-search';
export const createHandlers=configuration=>createSemanticSearchHandlers(configuration,familyOperations(id));
