/** Fixed current-user owner read. Saved-job credentials cannot satisfy this boundary. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
export const createSavedRecordHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{
 family:'saved-records',routes:{read_saved_record:'/api/clio/tools/read_saved_record'},requirePerCall:()=>true});
