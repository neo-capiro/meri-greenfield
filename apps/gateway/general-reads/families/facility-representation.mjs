/** Fixed stored facility representation, available only through current approved installation. */
import {createFacilityRepresentationHandlers} from '../../sources/facility-representation/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='facility-representation',sourceDirectory='facility-representation';
export const createHandlers=configuration=>createFacilityRepresentationHandlers(configuration,familyOperations(id));
