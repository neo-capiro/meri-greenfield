// Exact-version filing observations. Aggregate command outcomes remain external.
import {snapshotOperationData} from '../retrieval-0.2/operation-contracts.mjs';
const fail=message=>{throw new Error(message);};
const persistedKeys=['documentId','location','indexingStatus','reused'];
export function createArtifactFileValidators({validateShape,validatePublicShape,canonicalSha256}) {
  const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
  function contextData(options) {
    const context=snapshotOperationData(options);validateShape('ArtifactFileContext',context);
    if(context.destination.conversationId.toLowerCase()!==context.binding.conversationId.toLowerCase())fail('Filing destination conversation mismatch');
    return context;
  }
  function objectsData(objects,binding) {
    if(objects.length<1||objects.length>10)fail('Filing requires1–10 immutable references');
    const seen=new Set();
    for(const object of objects){
      validatePublicShape('ObjectReference',object);
      const key=object.objectId.toLowerCase();
      // One selected version per object; distinct version/hash cannot evade duplication.
      if(seen.has(key))fail('Duplicate selected filing object');seen.add(key);
      if(object.scopes.some(scope=>scope.tenantId!==binding.tenantId))fail('Cross-tenant filing object');
    }
  }
  function normalizeArtifactFileInput(request,options) {
    const raw=snapshotOperationData(request),context=contextData(options);validateShape('ArtifactFileRaw',raw);
    if(raw.clientId.toLowerCase()!==context.destination.clientId.toLowerCase()||raw.conversationId.toLowerCase()!==context.destination.conversationId.toLowerCase())fail('Filing selector differs from trusted destination');
    objectsData(raw.objects,context.binding);
    return {arguments:{clientId:context.destination.clientId.toLowerCase(),conversationId:context.destination.conversationId.toLowerCase()},attachments:raw.objects};
  }
  function assertArtifactFileCommand(value,options) {
    const command=snapshotOperationData(value),context=contextData(options);validatePublicShape('Command',command);validateShape('ArtifactFileArguments',command.arguments);
    if(command.action!=='artifact.file'||!same(command.binding,context.binding)||command.arguments.clientId!==context.destination.clientId.toLowerCase()||command.arguments.conversationId!==context.destination.conversationId.toLowerCase())fail('Filing command provenance mismatch');
    if(command.scopes.some(scope=>scope.tenantId!==command.binding.tenantId))fail('Cross-tenant filing scope');
    objectsData(command.attachments,command.binding);return command;
  }
  function assertArtifactFileResult(value,commandValue,options) {
    const command=assertArtifactFileCommand(commandValue,options),result=snapshotOperationData(value);validateShape('ArtifactFileResult',result);
    if(result.commandSha256!==canonicalSha256(command)||result.files.length!==command.attachments.length)fail('Filing result command/count mismatch');
    const seen=new Set();
    for(const file of result.files){
      const key=canonicalSha256(file.object);
      if(seen.has(key)||!command.attachments.some(object=>same(object,file.object)))fail('Filing observation object substitution');seen.add(key);
      const count=persistedKeys.filter(key=>Object.hasOwn(file,key)).length;
      if(count!==0&&count!==persistedKeys.length)fail('Partial persisted filing observation');
      if(file.status!=='failed'&&count!==persistedKeys.length)fail('Stored filing observation required');
      if(file.status==='saved'){
        if(file.indexingStatus==='not_indexed'||Object.hasOwn(file,'reason'))fail('Saved filing observation contradicts source projection');
      } else {
        if(!Object.hasOwn(file,'reason')||(count&&file.indexingStatus!=='not_indexed'))fail('Pending/failed filing observation requires disclosed limitation');
      }
    }
    // No success, retry, refund, access or indexing completeness from this set.
    return result;
  }
  function assertArtifactFileReceipt(value,commandValue,options) {
    const command=assertArtifactFileCommand(commandValue,options),receipt=snapshotOperationData(value);validatePublicShape('CommandReceipt',receipt);
    if(receipt.commandId!==command.commandId||receipt.commandSha256!==canonicalSha256(command)||receipt.idempotencyKey!==command.idempotencyKey)fail('Filing receipt command mismatch');
    for(const key of ['tenantId','actorId','conversationId','runId'])if(receipt.binding[key]!==command.binding[key])fail('Filing receipt stable provenance mismatch');
    const scopes=value=>value.map(scope=>canonicalSha256(scope)).sort();
    if(!same(scopes(receipt.scopes),scopes(command.scopes)))fail('Filing receipt scope mismatch');
    // Outcome is supplied by its canonical owner; per-file observations cannot decide it.
    return receipt;
  }
  function assertArtifactFileVersion(value,commandValue,options) {
    const command=assertArtifactFileCommand(commandValue,options),version=snapshotOperationData(value);validatePublicShape('ArtifactVersion',version);
    if(version.binding.tenantId!==command.binding.tenantId||!command.attachments.some(object=>same(object,version.object)))fail('Artifact version object correlation mismatch');
    // ArtifactVersion.versionId and ObjectReference.versionId have distinct meanings.
    return version;
  }
  return Object.freeze({normalizeArtifactFileInput,assertArtifactFileCommand,assertArtifactFileResult,assertArtifactFileReceipt,assertArtifactFileVersion});
}
