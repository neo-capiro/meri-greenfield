/** Fixed public SQL discovery/query routes. Core owns parsing, projections and database authority. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({describe_capiro_data:'/api/clio/tools/describe_capiro_data',query_capiro_data:'/api/clio/tools/query_capiro_data'});
export const createCapiroDataHandlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data',routes});
