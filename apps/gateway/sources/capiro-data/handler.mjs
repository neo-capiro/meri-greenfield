/** Fixed SQL routes. Core owns parsing and public/private database and conversation authority. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({describe_capiro_data:'/api/clio/tools/describe_capiro_data',query_capiro_data:'/api/clio/tools/query_capiro_data'});
export const createCapiroDataHandlers=(configuration,operations)=>
  createStoredNativeReadHandlers(configuration,operations,{family:'capiro-data',routes,
    requirePerCall:current=>current.request.source==='client_records'});
