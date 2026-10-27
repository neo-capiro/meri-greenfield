/** Fixed current-user owner read. Saved-job credentials cannot satisfy this boundary. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
export const createStrategySavedHandlers=(configuration,operations)=>createStoredNativeReadHandlers(configuration,operations,{
 family:'strategy-saved-records',routes:{read_saved_strategy_records:'/api/clio/tools/read_saved_strategy_records'},requirePerCall:()=>true});
