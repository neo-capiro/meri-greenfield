/** Canonical storage selection only. The ordinary document application subsequently authorizes and verifies every byte.
 * Native public file IDs are existing object IDs; typed ArtifactVersion IDs are resolved by the existing version index. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});};
export function createFilingVersionResolver(configuration){
 const c=own(configuration,['versions','store','selectedClientId','now']),find=storageMethod(c.versions,'findByObject'),read=storageMethod(c.store.lifecycle,'readArtifactFile');
 if(typeof c.now!=='function'||typeof c.selectedClientId!=='string')fail('ARTIFACT_CONFIGURATION');
 return async value=>{
  const {signal,...raw}=own(value,['object','binding','scopes','deadlineMs'],['signal']);nativeSignal(signal);
  const call=data(raw),object=v.object(call.object);assertNativeConversationScope({...call,selectedClientId:c.selectedClientId});
  if(!Number.isSafeInteger(call.deadlineMs)||v.hash(object.scopes)!==v.hash(call.scopes))fail('ARTIFACT_FILING_CONTEXT');
  const life=createOperationLifetime({deadlineMs:call.deadlineMs,now:c.now,signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{
   const native=await life.run(()=>read({binding:call.binding,scopes:call.scopes,selectedClientId:c.selectedClientId,versionId:object.objectId},life.check));
   if(native!==null){
    if(native?.kind!=='native-file'||v.hash(native.entry?.object)!==v.hash(object))fail('ARTIFACT_FILING_OBJECT_MISMATCH');
    life.check();return object.objectId;
   }
   const versionId=await life.run(signal=>find({tenantId:call.binding.tenantId,conversationId:call.binding.conversationId,objectId:object.objectId},signal));
   life.check();return versionId;
  }finally{life.close();}
 };
}
