import {createGraphPathsHandlers} from '../../sources/graph-paths/handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='graph-paths',sourceDirectory='graph-paths';
export const createHandlers=configuration=>createGraphPathsHandlers(configuration,familyOperations(id));
