/** Synthetic (scripted SQL protocol fixture): the next-run recovery composition shared by the Stop/failure/crash and no-authority
 * successor tests, over the canonical next-run owner and journal, lifecycle store and run reconciler. Retirement/revocation ports read
 * the canonical allocation journal and a synthetic receipt. */
import {lifecycleFixture,binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {allocateOriginal,recordRetired} from './terminal-settlement-harness.mjs';
import {createNextRunOwner} from '../next-run.mjs';import {createRunReconciler} from '../run-reconciler.mjs';import {hash} from '../boundary.mjs';
export const check=()=>{},at='2026-10-15T12:00:00.000Z';
export async function fixture(){const f=await lifecycleFixture();let serial=900;const revoked=new Map(),allocations=new Map();
 const status=(state,reasonCode=null)=>({eventId:id(serial++),createdAt:at,type:'run.status',data:{state,reasonCode}});
 const retirement={async verifyRetired({binding:b}){const r=await f.store.allocations.read({binding:b,allocationKey:hash(b)},check);return {physicalStopProven:r.record?.state==='RETIRED'&&r.record.resource?.physicalStopProven===true};}};
 const revocation={async verifyRevoked({binding:b}){const r=revoked.get(b.runId);if(!r)throw Error('NEXT_RUN_REVOCATION_REQUIRED');return r;}};
 const owner=createNextRunOwner({store:f.store,versions,newId:()=>id(serial++),retirement,revocation});
 async function allocate(b){const a=await allocateOriginal(f.store,b);allocations.set(b.runId,a);return a;}
 // The native stop owner's effect: physical stop and grant revocation recorded in the canonical journal.
 async function retire(b){const a=allocations.get(b.runId);await recordRetired(f.store,a);revoked.set(b.runId,{grantIds:[id(240)],receiptSha256:hash({retired:a.key})});}
 const reconciler=createRunReconciler({store:f.store,retirement:{retire:({binding:b})=>retire(b)}});
 async function running(b){for(const state of ['starting','running'])await f.store.append(b,status(state),check);}
 async function complete(b){await running(b);const k={binding:b,scopes,selectedClientId:id(5)},p=await f.store.completions.begin({...k,completionId:id(serial++),checkpointId:id(serial++)},check),proof=structuredClone(await f.capture(p.checkpointId));proof.checkpoint.binding=b;proof.checkpoint.workspace.binding=b;proof.checkpoint.workspaceSha256=hash(proof.checkpoint.workspace);proof.checkpoint.lastEventSequence=p.captureSequence;proof.checkpointSha256=hash(proof.checkpoint);proof.sourceRequestSha256=p.sourceRequestSha256;proof.contextSha256=p.contextSha256;
  await f.store.completions.publish({...k,completionId:p.completionId,proof,events:[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:at,type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:at,type:'run.status',data:{state:'completed',reasonCode:null}}]},check);return p;}
 const select=()=>owner.selectRun({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId});
 function accept(b,prompt='next prompt',requestId=id(serial++)){const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,createdAt:at,policyRevision:'policy1'},run={binding:b,state:'queued',scopes,createdAt:at,policyRevision:'policy1',versions},request={requestId,prompt,skill:null,window:null,windowRequest:null},event={contractVersion:'0.1.0',...status('queued'),binding:b,scopes,sequence:1};return f.store.nextRuns.accept({conversation,run,request,event},check);}
 const lineage=b=>f.store.nextRuns.execution({binding:b,scopes,selectedClientId:id(5)},check);
 const reserveWith=(source,checkpoint)=>f.store.nextRuns.reserve({source,target:{...source,runId:id(serial++),attemptId:id(serial++),workerId:id(serial++),writerFence:source.writerFence+1},facts:{checkpoint,retirement:{physicalStopProven:true},revocation:{receiptSha256:'f'.repeat(64),grantIds:[id(240)]}},scopes,versions,policyRevision:'policy1',reservedAt:at},check);
 const first=async()=>{await f.service.submit({credential:f.credential,input:f.input});await allocate(binding);};
 return {f,status,owner,reconciler,allocate,retire,running,complete,select,accept,lineage,reserveWith,first,state:()=>f.store.read(binding,{after:0,limit:1},check).then(r=>r.run.state)};}
