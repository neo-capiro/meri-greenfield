/** Native registry lookup with a separate trusted private-client visibility guard. */
import {createClientRegistryHandlers} from '../../sources/client-registry/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='client-registry',sourceDirectory='client-registry';
export const createHandlers=configuration=>createClientRegistryHandlers(configuration,familyOperations(id));
