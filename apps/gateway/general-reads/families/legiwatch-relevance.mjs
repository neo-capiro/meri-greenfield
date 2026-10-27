import {createLegiwatchRelevanceHandlers} from '../../sources/legiwatch-relevance/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='legiwatch-relevance',sourceDirectory='legiwatch-relevance';
export const createHandlers=configuration=>createLegiwatchRelevanceHandlers(configuration,familyOperations(id));
