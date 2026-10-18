/** Fixed stored docket producer; source-clock qualification remains separate. */
import {createRegulatoryDocketsHandlers} from '../../sources/regulatory-dockets/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='regulatory-dockets',sourceDirectory='regulatory-dockets';
export const createHandlers=configuration=>createRegulatoryDocketsHandlers(configuration,familyOperations(id));
