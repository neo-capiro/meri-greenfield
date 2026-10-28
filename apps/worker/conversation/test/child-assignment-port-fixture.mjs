/** A scripted run-owner child port for the capability tests: the hook's durable crossing without a store, in the exact
 * closed answer shape the real run owner port validates (worker-owner.mjs). No store, no SDK, no provider. */
export const CHILD_ASSIGNMENT_ID='3f1c2d4e-5a6b-8c7d-9e0f-1a2b3c4d5e6f',CHILD_REVISION=Object.freeze({requestSha256:'a'.repeat(64),steer:null});
export function childAssignmentPort({effect='none',replayed=false,refuseDispatch,refuseSettle}={}){
 const calls={dispatch:[],settle:[]};
 const assignment=input=>({assignmentId:CHILD_ASSIGNMENT_ID,toolUseId:input.toolUseId,role:input.role,revision:CHILD_REVISION,dispatchedAtMs:1760000000000});
 const receipt=input=>({assignmentId:CHILD_ASSIGNMENT_ID,toolUseId:input.toolUseId,outcome:input.outcome,resultSha256:input.resultSha256,resultBytes:input.resultBytes,
  custody:{sessionId:input.sessionId??null,agentId:input.agentId??null},revision:CHILD_REVISION,settledAtMs:1760000000000});
 return Object.freeze({calls,
  async dispatch(input){calls.dispatch.push(input);if(refuseDispatch)throw Object.assign(Error(refuseDispatch),{code:refuseDispatch});return {replayed,effect,assignment:assignment(input)};},
  async settle(input){calls.settle.push(input);if(refuseSettle)throw Object.assign(Error(refuseSettle),{code:refuseSettle});return {replayed,receipt:receipt(input)};}});
}
