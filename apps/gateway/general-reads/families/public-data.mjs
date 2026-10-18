import {createPublicDataHandlers} from '../../sources/public-data/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-data',sourceDirectory='public-data';
export const createHandlers=configuration=>createPublicDataHandlers(configuration,familyOperations(id));
