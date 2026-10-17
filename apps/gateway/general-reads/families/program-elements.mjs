/** Existing native PE producers; their exact evidence mode travels only in the private carrier. */
import {createProgramElementHandlers} from '../../sources/program-elements/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='program-elements',sourceDirectory='program-elements';
export const createHandlers=configuration=>createProgramElementHandlers(configuration,familyOperations(id));
