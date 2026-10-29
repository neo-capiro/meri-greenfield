import {createFederalDraftSourceHandlers} from '../../sources/federal-draft-source/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='federal-draft-source',sourceDirectory='federal-draft-source';
export const createHandlers=configuration=>createFederalDraftSourceHandlers(configuration,familyOperations(id));
