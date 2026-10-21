/** Expected task placement from the original trusted control startup, joined to current product custody.
 * No configuration, task override, credential, observed ENI or IP is released.
 * The caller must pass the exact original trusted startup configuration.
 * Its router VPC is independent startup authority: configurationSha256 does not cover it.
 * Retain that original service/config across rollover; missing/mismatched custody stays unavailable.
 */
import {fixedHotPathBudget} from '../../../packages/runtime/hot-path-budgets.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {validateConfiguration,compileControlTaskRouterConfiguration} from '../../runtime/config.mjs';
import {compileNativeTaskRequest} from '../../runtime/native-authority/task-request.mjs';
import {compilePreparedRunConfigurationSha256} from '../../runtime/prepared-run-configuration.mjs';
import {compileEcsTaskBinding} from '../../runtime/native-authority/ecs-task-binding.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';

const deny=()=>{throw Error('PRODUCT_PROXY_PLACEMENT_UNAVAILABLE');};
const same=(a,b)=>hash(a)===hash(b),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const active=run=>['queued','starting','running'].includes(run.state);
const sorted=rows=>[...rows].sort((a,b)=>a.grantId.localeCompare(b.grantId));

export function createProductOwnerPlacement(configuration){
 const c=own(configuration,['configuration','pool','persistedFacts','initialBindings','now','limits'],['enabled','report']);
 const enabled=c.enabled??false,limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 if(typeof enabled!=='boolean'||typeof c.now!=='function'||typeof c.pool?.connect!=='function'||c.report!==undefined&&typeof c.report!=='function'||
    !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||
    !Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072)deny();
 // Snapshot data before reading any owner. Validated control configuration contains file references, never resolved material.
 const startup=validateConfiguration(data(c.configuration),'control'),candidate=startup.nativeCandidate,
  router=compileControlTaskRouterConfiguration(startup),configured=candidate?.runtime.binding;
 const configurationSha256=compilePreparedRunConfigurationSha256(startup);
 if(!router||candidate?.multiRun?.dynamicInitialRuns!==true||!digest(configurationSha256))deny();
 for(const [kind,value] of [['vpc',router.network.vpcId],['subnet',router.network.subnetId],...router.network.securityGroupIds.map(value=>['sg',value])])
  if(typeof value!=='string'||!new RegExp(`^${kind}-[a-f0-9]{8,17}$`,'u').test(value))deny();
 const selectedClientId=candidate.identity.commandContext.clientResolution.clientId;
 const readFacts=storageMethod(c.persistedFacts,'resolve'),readInitial=storageMethod(c.initialBindings,'readConversation');
 const conversations=createPostgresConversationStore({pool:c.pool,now:c.now});let quarantined=false;
 const available=()=>{try{return enabled&&!quarantined&&c.persistedFacts.available===true;}catch{return false;}};
 return Object.freeze({get available(){return available();},async resolve(value){
  // The step reached is reported on refusal (owner-diagnostics.mjs): a fixed word, never a value.
  let life,step='input';
  try{
   const v=own(value,['capabilitySha256','deadlineMs'],['signal']);nativeSignal(v.signal);
   const at=c.now();if(!available()||!digest(v.capabilitySha256)||!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)deny();
   const deadlineMs=Math.min(v.deadlineMs,at+limits.maxRequestMs);
   // An expired request is reported as DEADLINE (owner-diagnostics.mjs); the caller's refusal is unchanged (deny below).
   life=createOperationLifetime({now:c.now,signal:v.signal,deadlineMs,errorFactory:code=>Object.assign(Error('PRODUCT_PROXY_PLACEMENT_UNAVAILABLE'),code==='DEADLINE'?{code}:{})});
   const resolveFacts=async(label='facts')=>{step=label;const facts=data(await life.run(signal=>readFacts({capabilitySha256:v.capabilitySha256,deadlineMs,signal})));life.check();
    own(facts,['binding','allocationJson','grantFactsJsons','modelGrantId','selectedClientId','original','resource','requestSha256','expiresAtMs']);
    own(facts.resource,['taskArn','createdAtMs','clusterArn','taskDefinitionArn','containerName']);
    if(facts.selectedClientId!==selectedClientId||!Number.isSafeInteger(facts.expiresAtMs)||facts.expiresAtMs<=c.now())deny();life.limitDeadline(facts.expiresAtMs);return facts;};
   const facts=await resolveFacts(),binding=facts.binding;step='binding';validateShape('RunBinding',binding);
   if(binding.tenantId!==configured.tenantId||binding.actorId!==configured.actorId)deny();
   step='model-grant';const parsed=parseAdmittedGrantSet(facts),model=parsed.facts.find(f=>f.grantId===facts.modelGrantId);
   if(!model||model.capabilitySha256!==v.capabilitySha256||!same(model.binding,binding))deny();
   let originalAdmission;
   async function current(){step='allocation';
    const saved=await life.run(()=>conversations.allocations.read({binding,allocationKey:hash(binding)},life.check));life.check();const record=saved?.record;
    if(!record||record.state!=='ADMITTED'||!active(saved.run)||!same(saved.run.binding,binding)||!same(record.original,facts.original)||
       !same(saved.run.versions,record.original.versions)||!same(record.original.versions,startup.versions)||record.allocationSha256!==model.allocationSha256||
       record.qualification.policyRevision!==candidate.qualification.policyRevision||saved.run.policyRevision!==record.qualification.policyRevision||
       !same(saved.run.scopes,[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:record.qualification.policyRevision}])||
       !same(sorted(record.resource.grantFactsJsons.map(raw=>JSON.parse(raw))),sorted(parsed.facts)))deny();
    step='grant-intent';const selected=record.grantIntents.find(g=>g.grantId===model.grantId);
    if(!selected||selected.capabilitySha256!==v.capabilitySha256||selected.expiresAtMs!==record.original.expiresAtMs||record.expiresAtMs!==record.original.expiresAtMs)deny();
    step='task-request';const expected=compileNativeTaskRequest({original:record.original,taskRequest:candidate.taskRequest,containerName:candidate.containerName});
    if(expected.taskRequestSha256!==record.taskRequestSha256||record.resource.clusterArn!==expected.request.cluster||
       record.resource.taskDefinitionArn!==expected.request.taskDefinition||record.resource.containerName!==candidate.containerName||
       !same(Object.fromEntries(Object.keys(facts.resource).map(k=>[k,record.resource[k]])),facts.resource)||record.resource.taskArn!==model.qualificationBinding.workerArn)deny();
    compileEcsTaskBinding({original:record.original,...facts.resource,now:c.now,maxRequestMs:fixedHotPathBudget('native.prepared.request')});
    step='run-request';const accepted=await life.run(()=>conversations.readOptional(binding,{limit:1},life.check));life.check();
    if(!accepted||!same(accepted.run,saved.run)||hash(accepted.request)!==facts.requestSha256)deny();
    if(binding.conversationId===configured.conversationId){if(binding.writerFence===1&&!same(binding,configured))deny();}
    else{
     step='initial-binding';const admission=data(await life.run(()=>readInitial({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,selectedClientId},life.check)));life.check();
     own(admission,['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','expiresAtMs','createdAtMs']);validateShape('RunBinding',admission.binding);
     if(admission.schemaVersion!==1||admission.state!=='ADMITTED'||admission.binding.writerFence!==1||admission.binding.tenantId!==binding.tenantId||
        admission.binding.actorId!==binding.actorId||admission.binding.conversationId!==binding.conversationId||admission.selectedClientId!==selectedClientId||
        admission.policyRevision!==record.qualification.policyRevision||
        binding.writerFence===1&&(admission.configurationSha256!==configurationSha256||!same(admission.versions,startup.versions))||
        !Number.isSafeInteger(admission.createdAtMs)||admission.createdAtMs<1||admission.createdAtMs>at||!Number.isSafeInteger(admission.expiresAtMs)||admission.expiresAtMs<=admission.createdAtMs||
        binding.writerFence===1&&(!same(admission.binding,binding)||admission.expiresAtMs!==record.original.expiresAtMs)||originalAdmission&&!same(originalAdmission,admission))deny();
     originalAdmission??=admission;
    }
    if(binding.writerFence>1){
     // An immutable journal alone is not the accepted original. Join its full binding to the canonical first-run row.
     // The first run may be terminal and expired; this never extends the active successor's own issuance window.
     step='first-run';const firstBinding=originalAdmission?.binding??configured;
     const firstRun=await life.run(()=>conversations.readOptional(firstBinding,{limit:1},life.check));life.check();
     if(!firstRun||!same(firstRun.run.binding,firstBinding)||!same(firstRun.run.versions,originalAdmission?originalAdmission.versions:startup.versions)||
        firstRun.run.policyRevision!==record.qualification.policyRevision||!same(firstRun.run.scopes,saved.run.scopes))deny();
    }
    life.limitDeadline(record.original.expiresAtMs);return {record,expected};
   }
   const first=await current(),again=await resolveFacts('facts-replay');
   // Fresh admitted-owner reads have independently bounded read leases. Those clocks cannot replace original issuance expiry.
   if(!same({...again,expiresAtMs:0},{...facts,expiresAtMs:0}))deny();const last=await current();step='stable';if(!same(first,last))deny();life.check();
   const {record,expected}=first,q=model.qualificationBinding;
   return data({issuedTaskNetwork:{binding:{run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision},
    grant_id:model.grantId,cluster_arn:record.resource.clusterArn,task_definition_arn:record.resource.taskDefinitionArn,container_name:record.resource.containerName,
    image_digest:record.original.versions.imageDigest,execution_binding:binding,started_by:expected.spec.startedBy,group:expected.spec.group,
    created_at_ms:record.resource.createdAtMs,expires_at_ms:record.original.expiresAtMs,vpc_id:router.network.vpcId,subnet_id:router.network.subnetId,
    security_group_ids:router.network.securityGroupIds,tags:expected.spec.tags.map(t=>[t.key,t.value])},checkedAtMs:c.now(),effectiveExpiresAtMs:Math.min(facts.expiresAtMs,again.expiresAtMs,record.original.expiresAtMs,deadlineMs)});
  }catch(error){try{c.report?.('placement',step,error);}catch{}deny();}finally{if(life?.close().unsettledOperations>0)quarantined=true;}
 }});
}
