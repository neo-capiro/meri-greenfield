import {createStoredNativeReadHandlers} from '../../sources/retained-reads/native-handler.mjs';
import {familyOperations} from '../registration.mjs';
export const id='teams-channels',sourceDirectory='retained-reads';
export const createHandlers=configuration=>createStoredNativeReadHandlers(configuration,familyOperations(id),{
 family:id,requirePerCall:()=>true,routes:{
  list_teams_channels:'/api/clio/tools/list_teams_channels',get_teams_channel_messages:'/api/clio/tools/get_teams_channel_messages',
 }});
