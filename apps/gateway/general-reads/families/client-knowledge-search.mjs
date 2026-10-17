import {createClientKnowledgeSearchHandlers} from '../../sources/client-knowledge-search/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-knowledge-search',sourceDirectory='client-knowledge-search';
export const createHandlers=configuration=>createClientKnowledgeSearchHandlers(configuration,familyOperations(id));
