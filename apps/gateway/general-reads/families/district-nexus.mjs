/** Canonical District Nexus read composition; registration grants no source access. */
import {createDistrictNexusHandlers} from '../../sources/district-nexus/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='district-nexus',sourceDirectory='district-nexus';
export const createHandlers=configuration=>createDistrictNexusHandlers(configuration,familyOperations(id));
