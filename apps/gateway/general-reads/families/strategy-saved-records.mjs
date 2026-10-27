import {createStrategySavedHandlers} from '../../sources/strategy-saved-records/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='strategy-saved-records',sourceDirectory='strategy-saved-records';
export const createHandlers=configuration=>createStrategySavedHandlers(configuration,familyOperations(id));
