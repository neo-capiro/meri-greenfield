/** Real canonical admission/conversation/lifecycle/schedule owners; SQL, native stop and policy are synthetic boundaries. */
import {scheduledAdmissionFixture} from '../../../runtime/native-authority/test/scheduled-admission-fixture.mjs';
import {lifecycleFixture} from '../../conversations/test/lifecycle-fixture.mjs';
import {id} from '../../conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createScheduledJobLifecycle} from '../scheduled-job-lifecycle.mjs';
import {createScheduledDispatch} from '../scheduled-dispatch.mjs';
export {id,hash};
const check=()=>{};
export async function scheduledJobFixture({admit=true,allocated=true}={}){
 const h=await scheduledAdmissionFixture();if(admit)await h.adapter.admit(h.request);
 const f=await lifecycleFixture({pool:h.pool,binding:h.identity.binding,scopes:h.scopes}),calls={cancel:[],retire:[]},hooks={};let sequence=2000;
 const selection={occurrence:h.occurrence,effect:h.effect},row=b=>[...h.conversations.state.runs.values()].find(r=>r.run_id===b.runId);
 async function claim(binding=h.identity.binding){const key=hash(binding),expiresAtMs=h.now()+60000;
  await h.store.allocations.claim({binding,allocationKey:key,original:{binding,executionKey:key,executionId:key,planSha256:'a'.repeat(64),expiresAtMs,versions:h.template.versions},
   allocationSha256:'b'.repeat(64),qualification:{attempt:1,policyRevision:'c'.repeat(64)},grantIntents:[{grantId:id(sequence++),capabilitySha256:'d'.repeat(64),expiresAtMs}],taskRequestSha256:'e'.repeat(64),expiresAtMs},check);
 }
 async function retire(binding=h.identity.binding){const key=hash(binding),saved=await h.store.allocations.read({binding,allocationKey:key},check);
  if(saved.record?.state==='FORECLOSED')return;
  await h.store.allocations.record({binding,allocationKey:key,state:'RETIRED',resource:{taskArn:`arn:aws:ecs:us-east-1:967807252336:task/synthetic/${key.slice(0,32)}`,
   createdAtMs:h.now()-1,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/synthetic',taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/synthetic:1',containerName:'native',physicalStopProven:true}},check);
 }
 if(admit&&allocated)await claim();
 async function status(state,binding=h.identity.binding){return h.store.append(binding,{eventId:id(sequence++),createdAt:new Date(h.now()).toISOString(),type:'run.status',data:{state,reasonCode:null}},check);}
 async function running(binding=h.identity.binding){await status('starting',binding);await status('running',binding);}
 async function pause(intent='pause'){
  const controlId=id(sequence++),input=intent==='pause'?{controlId,intent}:{controlId,intent,proposalId:f.proposal.proposalId};
  await f.control(input);await f.claim(controlId);await f.checkpoint(controlId);return controlId;
 }
 async function resume(){
  f.nativeAdmission.retire=async({binding})=>{await retire(binding);return {binding,retirementReceiptId:id(sequence++),expiresAtMs:Date.now()+30000};};
  const proof=f.proofs.get(id(220)),result=await f.control({controlId:id(sequence++),intent:'resume',checkpointId:proof.checkpoint.checkpointId,checkpointSha256:proof.checkpointSha256});
  await claim(result.targetBinding);return result.targetBinding;
 }
 const runControl={async cancel({binding,signal}){calls.cancel.push(binding);await hooks.cancel?.({binding,signal});f.state.context.binding=binding;
  const issued=await f.sessions.issue({identityCredential:'synthetic-job-cancellation',signal});return f.service.cancel({credential:issued.credential,signal});}};
 const retirement={async retire({binding,signal}){calls.retire.push(binding);await hooks.retire?.({binding,signal});await retire(binding);return {physicalStopProven:true};}};
 const options={store:h.store,runControl,retirement,now:h.now,maxRequestMs:1000},owner=createScheduledJobLifecycle(options);
 const scheduled=createScheduledDispatch({scheduleOwner:h.scheduleOwner,store:h.store,dispatcher:h.dispatcher,runs:h.runs,authority:h.firingAuthority,taskInstructions:{async read(){return {instruction:h.input.request.prompt};}},
  versions:h.template.versions,runAdmission:h.adapter,jobOwner:owner,now:h.now,maxRequestMs:1000});
 return {...h,f,selection,calls,hooks,row,claim,retire,status,running,pause,resume,options,owner,scheduled,close:f.close,
  inspect:()=>owner.inspect({...selection,deadlineMs:h.now()+1000}),cancel:()=>owner.cancel({...selection,deadlineMs:h.now()+1000})};
}
