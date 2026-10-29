import {createBuyerWorkspaceHandlers} from '../../sources/buyer-workspace/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='buyer-workspace',sourceDirectory='buyer-workspace';
export const createHandlers=configuration=>createBuyerWorkspaceHandlers(configuration,familyOperations(id));
