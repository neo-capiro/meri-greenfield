import {validators} from './generated-validator.mjs';
import {errorStatuses,errorOutcomes} from './generated-status.mjs';
import {createTaskCommandMetadata,taskCommandLimits} from './protocol.mjs';
import {parseText,snapshotExpected,fail} from './boundary.mjs';
import {check,proposal,correlatePrepare,correlateExecute} from './semantics.mjs';
export {TaskCommandResponseError} from './boundary.mjs';
export {taskCommandVersion,taskCommandPaths} from './protocol.mjs';
export const taskCommandMetadata=createTaskCommandMetadata(errorStatuses,errorOutcomes);
const routes=Object.freeze({prepare:{request:'TaskCommandPrepareRequest',response:'TaskCommandPrepareResponse'},execute:{request:'TaskCommandExecuteRequest',response:'TaskCommandExecuteResponse'}});
const routeInfo=route=>{if(typeof route!=='string'||!Object.hasOwn(routes,route))fail('TASK_COMMAND_ROUTE');return routes[route];};
/** JSON integrity is not permission. The server resolves all session and command authority freshly. */
export async function receiveTaskCommandRequest(route,jsonText){
 const selected=routeInfo(route),value=parseText(jsonText,taskCommandLimits.requestBytes);check(selected.request,value);
 if(route==='execute')await proposal(value.proposal);return value;
}
/** Read Response.text(), never Response.json(). Independent binding comes from trusted app context. */
export async function receiveTaskCommandResponse(route,httpStatus,jsonText,expected){
 const selected=routeInfo(route);if(!Number.isInteger(httpStatus))fail('TASK_COMMAND_STATUS');
 const expectation=snapshotExpected(expected);check('TaskCommandExpectedBinding',expectation?.binding);
 const keys=Object.keys(expectation);if(keys.length!==2||!keys.includes(route==='prepare'?'request':'proposal'))fail('TASK_COMMAND_EXPECTATION');
 if(route==='prepare')check('TaskCommandPrepareRequest',expectation.request);else await proposal(expectation.proposal);
 const value=parseText(jsonText,taskCommandLimits.responseBytes);
 if(httpStatus!==200){if(!validators.TaskCommandErrorResponse(value)||errorStatuses[value.error.code]!==httpStatus)fail('TASK_COMMAND_STATUS');return value;}
 check(selected.response,value);
 if(route==='prepare')await correlatePrepare(value,expectation);else await correlateExecute(value,expectation);return value;
}
