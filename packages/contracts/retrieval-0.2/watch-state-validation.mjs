/** Read one exact canonical watch target; no proposal, inferred version or lifecycle mutation. */
import {snapshotOperationData} from './operation-contracts.mjs';
const fail=()=>{throw Error('Invalid watch inspection contract');};
export function createWatchStateValidators({validateShape,watchValidators}){
 function normalizeInput(raw,context={}){
  const input=snapshotOperationData(raw);validateShape('WatchStateRequest',input);watchValidators.target(input);
  const scope=context.watchStateScope;
  if(!scope||Object.keys(scope).sort().join(',')!=='identityRevision,membershipRevision,selectedClientId'||
   scope.selectedClientId!==null&&(typeof scope.selectedClientId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(scope.selectedClientId)||scope.selectedClientId!==input.clientId)||
   ![scope.identityRevision,scope.membershipRevision].every(value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value)))fail();
  return {input};
 }
 function assertOutput(raw,request,context={}){
  const {input}=normalizeInput(request,context),page=snapshotOperationData(raw);
  validateShape('WatchStateOutput',page);
  if(Buffer.byteLength(JSON.stringify(page),'utf8')>32768)fail();
  return watchValidators.inspectResult(page,input);
 }
 return Object.freeze({normalizeInput,assertOutput});
}
