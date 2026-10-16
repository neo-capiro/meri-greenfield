/** The two canonical bill reads over fixed existing native producers; no registration grants availability. */
import {createBillTextHandlers} from '../../sources/bill-text/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='bill-text',sourceDirectory='bill-text';
export const createHandlers=configuration=>createBillTextHandlers(configuration,familyOperations(id));
