/** Fixed stored article producer; registration grants no source availability. */
import {createStoredIntelligenceHandlers} from '../../sources/stored-intelligence/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='stored-intelligence',sourceDirectory='stored-intelligence';
export const createHandlers=configuration=>createStoredIntelligenceHandlers(configuration,familyOperations(id));
