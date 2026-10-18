/** Separate federal/state stored directory projections; construction grants no availability. */
import {createLegislativeDirectoryHandlers} from '../../sources/legislative-directory/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='legislative-directory',sourceDirectory='legislative-directory';
export const createHandlers=configuration=>createLegislativeDirectoryHandlers(configuration,familyOperations(id));
