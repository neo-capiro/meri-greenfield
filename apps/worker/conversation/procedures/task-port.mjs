// @ts-check
/** Task-scoped procedure port: the runner's existing authenticated native transport, no new credential or service identity. */
import {storageMethod} from '../../../artifacts/storage/boundary.mjs';
import {createProcedureRuntime} from './runtime.mjs';
const fault=code=>Object.assign(Error('PROCEDURE_'+code),{code:'PROCEDURE_'+code});
/** The Core admission for the persisted selection, resolved by control for this exact run. */
export const PROCEDURE_RESOLVE_OPERATION='procedure/resolve';
export function createTaskProcedurePort(configuration){
 const {native,now=Date.now}=configuration??{};
 const call=storageMethod(native,'call');
 if(typeof now!=='function')throw fault('PORT_CONFIGURATION');
 const runtime=createProcedureRuntime({now,resolve:({binding,versions,selection,scopes,signal})=>call(PROCEDURE_RESOLVE_OPERATION,{binding,versions,selection,scopes},{signal})});
 return Object.freeze({prepare:runtime.prepare,async close(){await runtime.close();}});
}
