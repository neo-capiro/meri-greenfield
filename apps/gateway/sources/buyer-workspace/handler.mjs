/** One canonical Core read; the existing native transport owns current authority. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';
const routes=Object.freeze({get_pe_buyer_workspace:'/api/clio/tools/get_pe_buyer_workspace'});
export const createBuyerWorkspaceHandlers=(configuration,operations)=>
 createStoredNativeReadHandlers(configuration,operations,{family:'buyer-workspace',routes});
