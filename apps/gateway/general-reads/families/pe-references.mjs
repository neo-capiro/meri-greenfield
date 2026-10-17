/** Stored PE evidence retains its linkage, attribution and loaded-source limitations. */
import {createPeReferenceHandlers} from '../../sources/pe-references/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='pe-references',sourceDirectory='pe-references';
export const createHandlers=configuration=>createPeReferenceHandlers(configuration,familyOperations(id));
