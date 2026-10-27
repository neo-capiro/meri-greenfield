import {createSavedRecordHandlers} from '../../sources/saved-records/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='saved-records',sourceDirectory='saved-records';
export const createHandlers=configuration=>createSavedRecordHandlers(configuration,familyOperations(id));
