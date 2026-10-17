import {createOutreachQueryHandlers} from '../../sources/outreach-query/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='outreach-query',sourceDirectory='outreach-query';
export const createHandlers=configuration=>createOutreachQueryHandlers(configuration,familyOperations(id));
