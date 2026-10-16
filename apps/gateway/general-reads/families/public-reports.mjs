/** Stored public-report searches; construction does not install or activate them. */
import {createPublicReportsHandlers} from '../../sources/public-reports/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='public-reports',sourceDirectory='public-reports';
export const createHandlers=configuration=>createPublicReportsHandlers(configuration,familyOperations(id));
