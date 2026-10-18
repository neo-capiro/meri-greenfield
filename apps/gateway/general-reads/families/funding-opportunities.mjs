import {createFundingOpportunitiesHandlers} from '../../sources/funding-opportunities/handler.mjs';
import {familyOperations} from '../registration.mjs';
// Passive source slice only; matching Core observation admission and installation qualification remain pending.
export const id='funding-opportunities',sourceDirectory='funding-opportunities';
export const createHandlers=configuration=>createFundingOpportunitiesHandlers(configuration,familyOperations(id));
