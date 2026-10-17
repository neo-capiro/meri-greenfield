/** Pure, control-local Objective fact preparation. These checks confer no authority.
 * `accepted` and `issuance` must come from their canonical trusted owners; neither
 * HTTP input nor resolveFacts' secret-bearing configuration is admitted here.
 * The caller retains the existing issuer's immutable bindFacts CAS and must not
 * replace an earlier facts hash. No capability, task, receipt or expiry is minted.
 */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertRequest} from '../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {strategyTypes} from '../../../packages/contracts/strategy-operations-candidate/shapes.mjs';
import {assertNativeReadConfiguration,nativeReadOperations} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {assertPreparedObjectiveSelection,sourceAdmissionDigest} from '../../../packages/runtime/objective-generation-custody.mjs';
import {compileNativeTaskAccess} from '../native-authority/task-verifier.mjs';
import {parseTransport} from '../prepared-run-issuance.mjs';

const refuse=()=>{throw Error('OBJECTIVE_PROTECTED_FACTS_REFUSED');};
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(value);
const same=(a,b)=>hash(a)===hash(b);
const integer=(value,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const baseFields=Object.freeze(['original','allocationSha256','taskRequestSha256','qualification','grantIntents','grantId','operations','controlCapabilitySha256','transport']);


function originalContext(raw,historical=false){
 const c=own(raw,historical?['accepted','issuance']:['accepted','issuance','nowMs']),accepted=data(own(c.accepted,['run','request'])),run=accepted.run;
 validateShape('Run',run);
 const request=own(accepted.request,['requestId','prompt','skill','window','windowRequest']);
 if(!uuid(request.requestId)||typeof request.prompt!=='string'||!request.prompt.trim()||request.prompt.length>100000||
    !historical&&(!['queued','starting','running'].includes(run.state)||!integer(c.nowMs,0))||
    run.scopes.some(scope=>scope.tenantId!==run.binding.tenantId||scope.policyRevision!==run.policyRevision))refuse();
 const issuance=data(own(c.issuance,['issuanceKey','binding','requestSha256','expiresAtMs','grantId','capabilitySha256'],['factsSha256']));
 validateShape('RunBinding',issuance.binding);
 if(!same(issuance.binding,run.binding)||issuance.issuanceKey!==hash(run.binding)||issuance.requestSha256!==hash(accepted.request)||
    !integer(issuance.expiresAtMs,1)||!historical&&issuance.expiresAtMs<=c.nowMs||!uuid(issuance.grantId)||!digest(issuance.capabilitySha256)||
    issuance.factsSha256!==undefined&&!digest(issuance.factsSha256))refuse();
 return {accepted,issuance,nowMs:c.nowMs,binding:run.binding};
}

function checkedPair(raw,context){
 const pair=data(own(raw,['objectiveGeneration','objectiveStrategy'])),selection=pair.objectiveStrategy.executionSelection;
 assertRequest(pair.objectiveStrategy.request);
 if(!strategyTypes.includes(pair.objectiveStrategy.queuedType))refuse();
 if(!selection||Object.values(own(selection,['provider','model'])).some(value=>typeof value!=='string'||!value.trim()||value.length>128))refuse();
 const admitted=assertPreparedObjectiveSelection(pair,{binding:context.binding,acceptedRequest:context.accepted.request,expiresAtMs:context.issuance.expiresAtMs,nowMs:context.nowMs});
 const clientId=pair.objectiveGeneration.sourceAdmission.canonical.clientId;
 if(!context.accepted.run.scopes.some(scope=>scope.kind==='client'&&scope.resourceId===clientId))refuse();
 if(admitted.sourceRequestSha256!==context.issuance.requestSha256)refuse();
 return pair;
}

/** Construct the existing protected pair over one canonical accepted run and its
 * already-ISSUED original receipt. The full binding comes only from accepted.run.
 * This is pre-bind data validation, never a replacement for those owners' reads.
 */
export function compileObjectiveProtectedFacts(value,options){
 try{
  const c=originalContext(options),v=data(own(value,['sourceAdmission','request','executionContext','queuedType','executionSelection']));
  const request=assertRequest(v.request);
  return checkedPair({objectiveGeneration:{sourceAdmission:v.sourceAdmission,sourceAdmissionSha256:sourceAdmissionDigest(v.sourceAdmission)},
   objectiveStrategy:{schemaVersion:1,operation:'strategy.draft',request,requestSha256:hash(request),executionContext:v.executionContext,queuedType:v.queuedType,executionSelection:v.executionSelection}},c);
 }catch{refuse();}
}

/** Validate only the nonsecret output of the canonical prepared-run compiler.
 * The closed shape intentionally rejects its raw input (runtime/proxyCredential,
 * allocationJson, taskRequest, etc.). Preserve optional approvedReads verbatim.
 */
function baseFacts(raw,context){
 const v=data(own(raw,[...baseFields,'factsSha256'],['approvedReads']));
 const {factsSha256,...facts}=v,original=own(v.original,['binding','executionKey','executionId','planSha256','expiresAtMs','versions']),q=own(v.qualification,['attempt','policyRevision']);
 validateShape('RunBinding',original.binding);validateShape('RuntimeVersions',original.versions);
 if(!digest(factsSha256)||hash(facts)!==factsSha256||!same(original.binding,context.binding)||
    original.executionKey!==context.issuance.issuanceKey||original.executionId!==original.executionKey||!digest(original.planSha256)||
    original.expiresAtMs!==context.issuance.expiresAtMs||!same(original.versions,context.accepted.run.versions)||
    !digest(v.allocationSha256)||!digest(v.taskRequestSha256)||!integer(q.attempt,1,2147483647)||!digest(q.policyRevision)||
    q.policyRevision!==context.accepted.run.policyRevision||v.grantId!==context.issuance.grantId||!digest(v.controlCapabilitySha256)||
    !Array.isArray(v.grantIntents)||v.grantIntents.length<1||v.grantIntents.length>16)refuse();
 const ids=new Set(),digests=new Set();
 for(const grant of v.grantIntents){
  own(grant,['grantId','capabilitySha256','expiresAtMs']);
  if(!uuid(grant.grantId)||!digest(grant.capabilitySha256)||ids.has(grant.grantId)||digests.has(grant.capabilitySha256)||
     grant.expiresAtMs!==context.issuance.expiresAtMs||grant.capabilitySha256===v.controlCapabilitySha256)refuse();
  ids.add(grant.grantId);digests.add(grant.capabilitySha256);
 }
 const task=v.grantIntents.find(grant=>grant.grantId===context.issuance.grantId);
 if(!task||task.capabilitySha256!==context.issuance.capabilitySha256)refuse();
 compileNativeTaskAccess({identityCredential:'inert-objective-facts-validation',taskCapabilitySha256:task.capabilitySha256,operations:v.operations});
 parseTransport(v.transport);
 if(v.approvedReads!==undefined){assertNativeReadConfiguration(v.approvedReads);if(nativeReadOperations.some(op=>!v.operations.includes(op)))refuse();}
 return facts;
}

/** Decorate the *input* to the existing immutable issuer bindFacts operation.
 * `facts` is returned for the protected journal, not as a public response. A retry
 * carrying an existing bound receipt is accepted only for the exact final hash.
 * The production prepared-run splice and all whole-facts reconstructors must use
 * this same optional pair before activation; this module mounts nothing itself.
 */
export function decorateObjectiveBindFactsInput(value,options){
 try{
  const c=originalContext(options),v=own(value,['preparedFacts','pair']),pair=checkedPair(v.pair,c),base=baseFacts(v.preparedFacts,c);
  const facts=data({...base,...pair}),factsSha256=hash(facts);
  if(c.issuance.factsSha256!==undefined&&c.issuance.factsSha256!==factsSha256)refuse();
  return data({facts:{...facts,factsSha256},bindFactsInput:{issuanceKey:c.issuance.issuanceKey,binding:c.binding,requestSha256:c.issuance.requestSha256,
   expiresAtMs:c.issuance.expiresAtMs,capabilitySha256:c.issuance.capabilitySha256,grantId:c.issuance.grantId,factsSha256}});
 }catch{refuse();}
}

/** Historical integrity validation over already-ISSUED protected facts. Original
 * execution expiry remains evidence; passing this check grants no fresh read or
 * execution authority. The custody owner separately requires fresh native read
 * authority and its own bounded read expiry before releasing any projection.
 */
export function assertIssuedObjectiveProtectedFacts(value,options){
 try{
  const v=data(own(value,['issuance',...baseFields,'objectiveGeneration','objectiveStrategy','factsSha256'],['approvedReads']));
  const {issuance,factsSha256,...facts}=v,c=originalContext({accepted:own(options,['accepted']).accepted,issuance},true);
  if(!digest(factsSha256)||factsSha256!==issuance.factsSha256||hash(facts)!==factsSha256)refuse();
  checkedPair({objectiveGeneration:v.objectiveGeneration,objectiveStrategy:v.objectiveStrategy},c);
  const {objectiveGeneration:ignoredGeneration,objectiveStrategy:ignoredStrategy,...base}=facts;
  baseFacts({...base,factsSha256:hash(base)},c);
  return v;
 }catch{refuse();}
}
