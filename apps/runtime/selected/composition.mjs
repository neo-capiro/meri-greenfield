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
import {resolveAvailableReads} from '../../worker/conversation/reads/availability.mjs';
import {assertAvailabilitySnapshot} from '../../worker/conversation/reads/snapshot.mjs';
import {assertCapabilityPolicy} from '../../worker/conversation/capabilities/policy.mjs';
import {createSelectedControl} from './control.mjs';
import {supportsSelectedDocumentRevision} from '../../../packages/contracts/document-revision.mjs';
import installationCatalog from '../../../packages/contracts/retrieval-0.3/catalog.json' with {type:'json'};

const same=(a,b)=>hash(a)===hash(b),fail=()=>{throw Object.assign(Error('SELECTED_CURRENT_REFUSED'),{code:'SELECTED_CURRENT_REFUSED'});};
export function createNativeSelectedComposition({configuration,pool,store,execution,createReadsRuntime,readAvailability,capabilityPolicy,readSessionCapabilityRole,serviceFor,revisionSource,now}){
 if(typeof execution?.authenticate!=='function'||typeof createReadsRuntime!=='function'||typeof serviceFor!=='function'||typeof now!=='function')fail();
 if(readAvailability!==undefined&&(typeof readAvailability!=='function'||typeof capabilityPolicy?.forRun!=='function'||typeof readSessionCapabilityRole!=='function'))fail();
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
 // Which of a selected skill's allowed operations the worker would find unavailable, decided before the run exists from the
 // same three inputs the worker's mount uses: the gateway's availability snapshot (installation and discovery) under the
 // session's authority, the run capability policy for the session's Core role, and the worker's own gate (reads/availability.mjs).
 // Without the session producers every operation is unavailable: no selection is admitted on a hope.
 async function readSkillAvailability({binding,scopes,selectedClientId,operations,expiresAtMs,signal}){
  if(readAvailability===undefined)return {unavailable:operations};
  const policyRevision=scopes[0].policyRevision,role=await readSessionCapabilityRole({binding,scopes,selectedClientId,signal,deadlineMs:expiresAtMs});
  const authorityExpiresAtMs=Math.min(expiresAtMs,role.expiresAtMs),observation={binding,scopes,policyRevision,selectedClientId,expiresAtMs:authorityExpiresAtMs};
  const current=async()=>({execution:{expiresAtMs:authorityExpiresAtMs},executionSha256:hash(observation),scopes,policyRevision,selectedClientId});
  const [raw,resolved]=await Promise.all([
   readAvailability({binding,current,approvedReads,signal,deadlineMs:authorityExpiresAtMs,readCapabilityRole:async()=>role}),
   capabilityPolicy.forRun({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,actorRole:role.actorRole,signal})]);
  const snapshot=assertAvailabilitySnapshot(raw,{binding,policyRevision,catalogSha256:hash(installationCatalog),now}),policy=resolved===null?undefined:assertCapabilityPolicy(resolved);
  const {available}=resolveAvailableReads({policy:policy??{generalReads:false},installation:snapshot.installation,discovery:snapshot.discovery,scopes,narrowTo:operations});
  return {unavailable:operations.filter(op=>!available.some(row=>same(row.operation,op)))};
 }
 const admission=(binding,{credential}={})=>createOriginalSkillAdmissionOwner({binding,now,
  loadConversation:({signal})=>store.read(binding,{after:0,limit:1},check(signal)),readSelection:selection,
  readCurrentContext:({signal})=>current({binding,credential,signal}),readSkillAvailability});
 const metadataStore=createTransactionalApprovalMetadataStore({pool}),journal=createIntentJournal(createPostgresIntentJournalStore({pool}));
 const proposals=createSelectedDocumentProposals({journal:{begin:journal.begin,settle:journal.settle},metadataStore,now,maxRequestMs:configuration.limits.requestMs,
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
