import {createBusinessDevelopmentHandlers} from '../../sources/business-development/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='business-development',sourceDirectory='business-development';
export const createHandlers=configuration=>createBusinessDevelopmentHandlers(configuration,familyOperations(id));
