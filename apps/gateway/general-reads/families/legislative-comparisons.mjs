import {createLegislativeComparisonHandlers} from '../../sources/legislative-comparisons/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='legislative-comparisons',sourceDirectory='legislative-comparisons';
export const createHandlers=configuration=>createLegislativeComparisonHandlers(configuration,familyOperations(id));
