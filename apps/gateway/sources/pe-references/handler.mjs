/** Fixed stored PE projections; canonical admission and bounded native transport stay shared. */
import {createStoredNativeReadHandlers} from '../retained-reads/native-handler.mjs';

const ROUTES=Object.freeze({
 get_pe_bills:'/api/clio/tools/get_pe_bills',
 get_pe_contractors:'/api/clio/tools/get_pe_contractors',
 get_pe_report_language:'/api/clio/tools/get_pe_report_language',
});

export function createPeReferenceHandlers(configuration,operations){
 return createStoredNativeReadHandlers(configuration,operations,{family:'pe-references',routes:ROUTES});
}
