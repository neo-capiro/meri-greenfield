// Import-only local fixture. Any model or tool execution is forbidden here.
const forbidden=()=>{throw Error('MODEL_CALL_FORBIDDEN');};
export const query=forbidden;
export const createSdkMcpServer=forbidden;
export const tool=forbidden;
export class InMemorySessionStore {constructor(){forbidden();}}
