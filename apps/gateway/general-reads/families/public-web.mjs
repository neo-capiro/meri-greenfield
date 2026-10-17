/** Discovery and untrusted page consultation retain their distinct native projections. */
import {createPublicWebHandlers} from '../../sources/public-web/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-web',sourceDirectory='public-web';
export const createHandlers=configuration=>createPublicWebHandlers(configuration,familyOperations(id));
