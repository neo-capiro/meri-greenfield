// Import-only local fixture. No AWS client or command may be constructed.
const forbidden=()=>{throw Error('AWS_CALL_FORBIDDEN');};
export class ECSClient {constructor(){forbidden();}}
export class RunTaskCommand {constructor(){forbidden();}}
export class DescribeTasksCommand {constructor(){forbidden();}}
export class DescribeTaskDefinitionCommand {constructor(){forbidden();}}
export class ListTasksCommand {constructor(){forbidden();}}
export class StopTaskCommand {constructor(){forbidden();}}
