import {createFundingAnalysisHandlers} from '../../sources/funding-analysis/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='funding-analysis',sourceDirectory='funding-analysis';
export const createHandlers=configuration=>createFundingAnalysisHandlers(configuration,familyOperations(id));
