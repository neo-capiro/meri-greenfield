/** Passive finite disclosure composition; not installed or registered by construction. */
import {createDisclosuresHandlers} from '../../sources/disclosures/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='disclosures',sourceDirectory='disclosures';
export const createHandlers=configuration=>createDisclosuresHandlers(configuration,familyOperations(id));
