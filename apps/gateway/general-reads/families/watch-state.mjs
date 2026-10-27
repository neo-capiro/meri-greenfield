import {createWatchStateHandlers} from '../../sources/watch-state/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='watch-state',sourceDirectory='watch-state';
export const createHandlers=configuration=>createWatchStateHandlers(configuration,familyOperations(id));
