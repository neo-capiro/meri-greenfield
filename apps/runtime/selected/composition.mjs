/** Native selected recipes reuse the ordinary run, typed reads, metadata and publication owners. */
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import {createOriginalSkillAdmissionOwner} from '../../control/conversations/skills/admission.mjs';
import {createSelectedOutputRetention} from '../../control/conversations/skills/retention.mjs';
import {createSelectedDocumentProposals} from '../../control/conversations/skills/document-proposal.mjs';
import {createTransactionalApprovalMetadataStore} from '../../control/commands/approval-metadata/postgres-store.mjs';
import {createIntentJournal} from '../../control/intents/journal.mjs';
import {createPostgresIntentJournalStore} from '../../control/intents/postgres-journal.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
import {createSelectedControl} from './control.mjs';
import {supportsSelectedDocumentRevision} from '../../../packages/contracts/document-revision.mjs';

const same=(a,b)=>hash(a)===hash(b),fail=()=>{throw Object.assign(Error('SELECTED_CURRENT_REFUSED'),{code:'SELECTED_CURRENT_REFUSED'});};
export function createNativeSelectedComposition({configuration,pool,store,execution,createReadsRuntime,serviceFor,revisionSource,now}){
 if(typeof execution?.authenticate!=='function'||typeof createReadsRuntime!=='function'||typeof serviceFor!=='function'||typeof now!=='function')fail();
 const approvedReads=configuration.agentcore.approvedReads,defaultCongress=configuration.reads?.defaultCongress;
 if(!approvedReads?.enabled||!Number.isSafeInteger(defaultCongress))return null;
 const check=signal=>()=>signal?.throwIfAborted();
 async function current({binding,credential,signal}){
  const value=await execution.authenticate({binding,credential,signal});check(signal)();
  if(!same(value.execution.binding,binding)||typeof value.selectedClientId!=='string'||value.execution.expiresAtMs<=now())fail();
  return {binding,scopes:value.scopes,selectedClientId:value.selectedClientId,checkedAtMs:now(),expiresAtMs:value.execution.expiresAtMs};
 }
 function selection({binding,request,scopes,selectedClientId}){
  const clientId=selectedClientId??scopes.find(s=>s.kind==='client')?.resourceId;
  if(typeof clientId!=='string'||!scopes.length||scopes.some(s=>s.tenantId!==binding.tenantId)||!scopes.some(s=>s.kind==='client'&&s.resourceId===clientId)||!request.window)fail();
  return {subject:{kind:'client',entityType:'client',entityIds:[clientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision:scopes[0].policyRevision,scopes,rosterVersionId:null},window:request.window,mondayBoardIds:[]};
 }
 const admission=(binding,{credential}={})=>createOriginalSkillAdmissionOwner({binding,now,
  loadConversation:({signal})=>store.read(binding,{after:0,limit:1},check(signal)),readSelection:selection,
  readCurrentContext:({signal})=>current({binding,credential,signal})});
 const metadataStore=createTransactionalApprovalMetadataStore({pool}),journal=createIntentJournal(createPostgresIntentJournalStore({pool}));
 const proposals=createSelectedDocumentProposals({journal,metadataStore,now,maxRequestMs:configuration.limits.requestMs,
  async readCurrent(call){const {selectedClientId,...r}=await current(call);return r;}});
 // Only retention's existing writer is used during a running query. Approval reads
 // construct their own current session/Core access callback in the document owner.
 const retained=createSelectedOutputRetention({journal:store.selectedOutputs,now,currentOutputAccess:async()=>{throw Error('SELECTED_OUTPUT_APPROVAL_REQUIRED');}});
 function gatewayForBinding(binding,{credential}){
  const app=createReadsRuntime({execution,binding,approvedReads,conversationStore:store});
  const client=createNativeReadsClient({origin:'https://meri-control.internal',binding,credential,approvedReads,now,
   fetchImpl:(url,init)=>app.handle(new Request(url,init))});
  return {execute:input=>client.execute(input),async readForSkill(input){
   const availability=await client.readAvailability({signal:input.signal}),r=await current({binding,credential,signal:input.signal});
   const selected=selectSkill(input.skill.skillId,input.skill.skillVersion),installed=availability.installation;
   return {binding,skill:selected.pin,requestSha256:input.requestSha256,selectionSha256:input.selectionSha256,
    baseCatalogSha256:installed.baseCatalogSha256,installationId:installed.installationId,executionCatalogSha256:installed.executionCatalogSha256,
    operations:installed.operations.filter(op=>selected.manifest.allowedOperations.some(allowed=>same(op,allowed))),checkedAtMs:now(),expiresAtMs:r.expiresAtMs};
  }};
 }
 async function revisionFor({binding,request,scopes,credential,signal}){
  if(request.documentRevision===undefined)return null;
  if(!supportsSelectedDocumentRevision(request.skill)||typeof revisionSource!=='function')fail();
  const fresh=await current({binding,credential,signal}),saved=await store.read(binding,{after:0,limit:1},check(signal));
  if(!same(saved.request,request)||!same(saved.run.binding,binding)||!same(saved.run.scopes,scopes)||!same(fresh.scopes,scopes))fail();
  const source=await revisionSource({binding,selection:request.documentRevision,deadlineMs:fresh.expiresAtMs,signal});
  const after=await current({binding,credential,signal});if(!same(after.scopes,scopes))fail();
  return source;
 }
 const controller=createSelectedControl({sourceEnabled:configuration.sourceEnabled,now,
  async loadCurrentTask({binding,capability,signal}){const r=await current({binding,credential:capability,signal}),saved=await store.read(binding,{after:0,limit:1},check(signal));
   if(!same(saved.run.binding,binding)||!same(saved.run.scopes,r.scopes)||!['starting','running'].includes(saved.run.state))fail();
   return {...r,versions:saved.run.versions,request:saved.request};},
  executionOptions:{admissionForBinding:admission,gatewayForBinding,readSelection:selection,
   async readRevisionBase(call){const source=await revisionFor(call);return source===null?null:{versionId:source.version.versionId,specSha256:source.specSha256};},
   async readBase(call){const source=await revisionFor(call);if(source===null||source.version.versionId!==call.versionId||!same(call.context.binding,call.binding)||!same(call.context.scopes,call.scopes))fail();
    const {currentBytesVerified,...inspection}=source.inspection;if(currentBytesVerified!==true)fail();
    // The private read's own optional retained asset map rides this return only, and only when the durable
    // parent record actually carries one: an older record without a map returns the same four fields as
    // before, so absence is preserved and the compiler decides (its own canonical rule) whether the
    // declared references were retained. No map is inferred, re-derived or minted here.
    return {version:source.version,spec:source.request,specSha256:source.specSha256,inspection,...(source.assets===undefined?{}:{assets:source.assets})};},
   async readContext({binding,scopes,credential,signal}){const r=await current({binding,credential,signal});if(!same(r.scopes,scopes))fail();return {context:{binding,scopes,evidence:[],assets:[],deadlineMs:r.expiresAtMs,maxBytes:configuration.agentcore.maxOutputBytes},checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs};},
   retention:{retain:value=>retained.retain(value)},proposals,defaultCongress,
   publishForBinding:({binding,credential,...call})=>serviceFor({binding,credential}).publishSelectedOutput({binding,credential,...call})}});
 const selectedSkillAdmission=Object.freeze({admitSelection:value=>admission(value.binding).admitSelection(value)});
 return Object.freeze({ports:{selectedSkillAdmission,selectedOutputPublication:controller.publication,selectedController:controller},close:()=>controller.close()});
}
