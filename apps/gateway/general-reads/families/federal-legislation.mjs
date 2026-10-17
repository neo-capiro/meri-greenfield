/** Canonical stored federal reads; installation alone grants no availability. */
import {createFederalLegislationHandlers} from '../../sources/federal-legislation/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='federal-legislation',sourceDirectory='federal-legislation';
export const createHandlers=configuration=>createFederalLegislationHandlers(configuration,familyOperations(id));
