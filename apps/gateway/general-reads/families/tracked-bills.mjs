import {createTrackedBillsHandlers} from '../../sources/tracked-bills/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='tracked-bills',sourceDirectory='tracked-bills';
export const createHandlers=configuration=>createTrackedBillsHandlers(configuration,familyOperations(id));
