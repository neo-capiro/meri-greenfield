// Import-only local fixture. No Temporal client may be constructed.
const forbidden=()=>{throw Error('TEMPORAL_CALL_FORBIDDEN');};
export class Connection {constructor(){forbidden();}}
export class Client {constructor(){forbidden();}}
export class ScheduleNotFoundError extends Error {}
export class WorkflowNotFoundError extends Error {}
export const WorkflowIdReusePolicy=Object.freeze({});
export const WorkflowIdConflictPolicy=Object.freeze({});
