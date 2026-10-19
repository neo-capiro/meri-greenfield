/** Actual canonical artifact inspection over explicit storage/current-authority
 * stand-ins. No native database, provider, registration or source call. */
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {artifactValidators as v,commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {fixture,id,NOW} from '../../test/commands-fixture.mjs';
import {policySelection} from '../../commands/approval-metadata/binding.mjs';
import {createAttachmentFilingPreparationPolicy} from '../attachment-filing-preparation.mjs';
export {id,NOW,canonicalSha256};

export function attachmentCustodyFixture({policy:policyRevision='p1'}={}){
 const f=fixture('artifact.file',{policy:policyRevision});
 f.scopes.splice(0,f.scopes.length,{tenantId:f.binding.tenantId,kind:'client',resourceId:f.context.destination.clientId,policyRevision:policyRevision});
 const bytes=Buffer.from('ab'),object=f.command.attachments[0];object.sha256=createHash('sha256').update(bytes).digest('hex');
 const spec={operation:'create_word',format:'txt',title:'Memo',content:{text:'ab'}},version=v.version({
  contractVersion:'0.1.0',artifactId:id(90),versionId:id(91),parentVersionId:null,binding:f.binding,scopes:f.scopes,
  evidence:[],filename:'Memo.txt',mimeType:'text/plain; charset=utf-8',generationStatus:'draft',previewStatus:'pending',
  createdAt:new Date(NOW-2000).toISOString(),object});
 const inspection={sha256:object.sha256,bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,recalculated:false,
  members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}};
 const record={version,spec,specSha256:v.hash(spec),requestSha256:'b'.repeat(64),inspection};
 const state={lookups:0,artifactReads:0,byteReads:0,policyCalls:[],deny:false,suppressed:false,changeRecord:null,changeContext:null,
  policyHook:null,beforeInspect:null,lookupHook:null};
 const versions={async read(versionId){state.artifactReads++;if(versionId!==version.versionId)throw Error('ENOENT');
  const value=structuredClone(record);state.changeRecord?.(value);return value;},
  async commit(){throw Error('NO_GENERATION_IN_PREPARATION');},
  async findByObject(query){state.lookups++;state.lookupHook?.();
   if(query.objectId!==object.objectId||query.tenantId!==f.binding.tenantId||query.conversationId!==f.binding.conversationId)
    throw Object.assign(Error('ENOENT'),{code:'ENOENT'});
   return version.versionId;},
 };
 const objects={async get(selected){state.byteReads++;if(v.hash(selected)!==v.hash(object))throw Error('wrong object');
  return Buffer.from(bytes);},async put(){throw Error('NO_OBJECT_WRITES_IN_PREPARATION');}};
 const service=createArtifactService({validators:v,versions,objects,now:()=>f.state.now,ids:()=>{throw Error('NO_GENERATION');},
  budget:{async reserve(){throw Error('NO_GENERATION');},async settle(){throw Error('NO_GENERATION');}},
  executor:{async execute(){throw Error('NO_GENERATION');}},
  authorize:async call=>{state.beforeInspect?.(call);return {receiptId:'synthetic-artifact-authority',decision:state.deny?'deny':'allow',
   action:call.action,binding:call.binding,scopesSha256:v.hash(call.scopes),resourceSha256:v.hash(call.resource),
   requestSha256:call.requestSha256,expiresAtMs:call.deadlineMs};},
  retention:{async assertServable(){if(state.suppressed)throw Object.assign(Error('RETENTION_SUPPRESSED'),{code:'RETENTION_SUPPRESSED'});}},
 });
 const readContext=async({deadlineMs})=>{
  const context={binding:f.binding,scopes:f.scopes,evidence:[],assets:[],deadlineMs:Math.min(deadlineMs,NOW+5000),maxBytes:65536};
  state.changeContext?.(context);return context;
 };
 const preparePolicy=async call=>{
  state.policyCalls.push(call);
  const receipt={authorized:true,selectionSha256:call.selectionSha256,binding:f.binding,scopes:f.scopes,
   requiredApprover:f.proposal.requiredApprover,proposalExpiresAt:f.proposal.expiresAt,checkedAtMs:f.state.now,expiresAtMs:f.state.now+1000};
  state.policyHook?.(receipt,call);return receipt;
 };
 const configuration={commandContext:f.context,preparePolicy,readContext,artifacts:service,versions,now:()=>f.state.now,maxRequestMs:2000};
 const policy=createAttachmentFilingPreparationPolicy(configuration),request={...f.context.destination,objects:[object]},
  input=commandToolValidators.normalizeCommandToolInput('artifact.file',request,{commandContext:f.context}).input,
  selected=policySelection('prepare',{operation:{id:'save_chat_attachments',version:'0.2.0'},action:'artifact.file',binding:f.binding,
   request,inputSha256:v.hash(input)});
 const call=(overrides={})=>({phase:'prepare',selection:selected,selectionSha256:v.hash(selected),signal:undefined,limitDeadline(){},...overrides});
 return {f,state,object,version,bytes,record,service,versions,configuration,policy,request,input,selected,call,readContext};
}
