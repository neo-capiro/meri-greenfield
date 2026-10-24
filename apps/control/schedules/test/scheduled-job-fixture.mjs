/** Real canonical admission/conversation/lifecycle/schedule owners; SQL, native stop and policy are synthetic boundaries. */
import {scheduledAdmissionFixture} from '../../../runtime/native-authority/test/scheduled-admission-fixture.mjs';
import {lifecycleFixture,allocateOriginal} from '../../conversations/test/lifecycle-fixture.mjs';
import {id} from '../../conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createScheduledJobLifecycle} from '../scheduled-job-lifecycle.mjs';
import {createScheduledDispatch} from '../scheduled-dispatch.mjs';
export {id,hash};
const check=()=>{};
export async function scheduledJobFixture({admit=true,allocated=true,agentcore=false,general=false}={}){
 const h=await scheduledAdmissionFixture({agentcore,general});if(admit)await h.adapter.admit(h.request);
 const f=await lifecycleFixture({pool:h.pool,binding:h.identity.binding,scopes:h.scopes,selectedClientId:h.template.selectedClientId}),calls={cancel:[],retire:[]},hooks={};let sequence=2000;
 const selection={occurrence:h.occurrence,effect:h.effect},row=b=>[...h.conversations.state.runs.values()].find(r=>r.run_id===b.runId);
 async function claim(binding=h.identity.binding){await allocateOriginal(f.store,binding);}
 async function retire(binding=h.identity.binding){
  const native=await f.store.executions.requestStop(binding,check);
  if(native.dispatch)await f.store.executions.settleStopped({binding,executionId:native.record.executionId,runtimeSessionId:native.record.runtimeSessionId,state:native.run.state},check);
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
  const proof=f.proofs.get(h.identity.binding.runId),result=await f.control({controlId:id(sequence++),intent:'resume',checkpointId:proof.checkpointId,checkpointSha256:proof.checkpointSha256});
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
