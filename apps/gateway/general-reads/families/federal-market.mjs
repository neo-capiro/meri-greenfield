/** Five distinct canonical federal market reads; no availability from registration. */
import {createFederalMarketHandlers} from '../../sources/federal-market/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='federal-market',sourceDirectory='federal-market';
export const createHandlers=configuration=>createFederalMarketHandlers(configuration,familyOperations(id));
