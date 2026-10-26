import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='connected-apps',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{
 family:id,requirePerCall:()=>true,routes:{
  list_connected_app_reads:'/api/clio/tools/list_connected_app_reads',read_connected_app:'/api/clio/tools/read_connected_app',
 }});
