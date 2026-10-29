import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({find_path_to:'/api/clio/tools/find_path_to'});
export const createGraphPathsHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{family:'graph-paths',routes});
