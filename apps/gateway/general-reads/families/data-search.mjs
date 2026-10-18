/** Governed Core data search; construction grants no source installation or availability. */
import {createDataSearchHandlers} from '../../sources/data-search/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='data-search',sourceDirectory='data-search';
export const createHandlers=configuration=>createDataSearchHandlers(configuration,familyOperations(id));
