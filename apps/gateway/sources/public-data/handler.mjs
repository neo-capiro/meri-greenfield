/** Economic stored rows only; policy-dependent public-data siblings remain outside this finite slice. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({query_economic_data:'/api/clio/tools/query_economic_data'});

export function createPublicDataHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'public-data',routes:ROUTES});
}
