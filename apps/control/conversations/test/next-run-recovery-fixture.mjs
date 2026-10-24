/** Scripted SQL owner composition. It proves no real database, SDK shutdown or Runtime effect. */
import {lifecycleFixture,binding,scopes,id,versions} from './lifecycle-fixture.mjs';
import {createExecutionBinding} from '../execution-boundary.mjs';
import {createNextRunOwner} from '../next-run.mjs';import {createRunReconciler} from '../run-reconciler.mjs';import {hash} from '../boundary.mjs';
export const check=()=>{},at='2026-10-15T12:00:00.000Z';
export async function fixture(){const f=await lifecycleFixture();let serial=900;
 const status=(state,reasonCode=null)=>({eventId:id(serial++),createdAt:at,type:'run.status',data:{state,reasonCode}});
 // The deployment's runtime versions; deploy() models a new image release before a later turn (the owner reserves under it).
 let deployed=versions,owner;
 const deploy=v=>{deployed=v;owner=createNextRunOwner({store:f.store,versions:v,newId:()=>id(serial++),now:()=>Date.parse(at)});};deploy(versions);
 async function allocate(b){const {versions:ignored,...identity}=createExecutionBinding({binding:b,versions:deployed,plan:{runtime:'synthetic'},expiresAtMs:Date.parse(at)+900000,runtimeSessionId:'conversation-'+hash({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId,scopes})});return f.store.executions.claim(identity,check);}
 // Test-only completion signal, standing in for actual query termination plus SessionStore flush/close.
 async function settle(b){const saved=await f.store.executions.read(b,check);return f.store.executions.record({binding:b,executionId:hash(b),phase:'settled',native:{state:saved.run.state}},check);}
 const reconciler=createRunReconciler({store:f.store,stopExecution:async({binding,executionId,runtimeSessionId})=>({binding,executionId,runtimeSessionId,stopped:true})});
 async function running(b){for(const state of ['starting','running'])await f.store.append(b,status(state),check);}
 async function complete(b){await running(b);const k={binding:b,scopes,selectedClientId:id(5)},p=await f.store.completions.begin({...k,completionId:id(serial++),checkpointId:id(serial++)},check),proof=structuredClone(await f.capture(p.checkpointId));proof.checkpoint.binding=b;proof.checkpoint.workspace.binding=b;proof.checkpoint.workspaceSha256=hash(proof.checkpoint.workspace);proof.checkpoint.lastEventSequence=p.captureSequence;proof.checkpointSha256=hash(proof.checkpoint);proof.sourceRequestSha256=p.sourceRequestSha256;proof.contextSha256=p.contextSha256;
  await f.store.completions.publish({...k,completionId:p.completionId,proof,events:[{contractVersion:'0.1.0',eventId:p.verifiedEventId,createdAt:at,type:'checkpoint.verified',data:{checkpointId:p.checkpointId}},{contractVersion:'0.1.0',eventId:p.completedEventId,createdAt:at,type:'run.status',data:{state:'completed',reasonCode:null}}]},check);return p;}
 const select=()=>owner.selectRun({principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId});
 function accept(b,prompt='next prompt',requestId=id(serial++)){const conversation={conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,createdAt:at,policyRevision:'policy1'},run={binding:b,state:'queued',scopes,createdAt:at,policyRevision:'policy1',versions:deployed},request={requestId,prompt,skill:null,window:null,windowRequest:null},event={contractVersion:'0.1.0',...status('queued'),binding:b,scopes,sequence:1};return f.store.nextRuns.accept({conversation,run,request,event},check);}
 const lineage=b=>f.store.nextRuns.execution({binding:b,scopes,selectedClientId:id(5)},check);
 const reserveWith=async(source,checkpoint)=>f.store.nextRuns.reserve({source,target:{...source,runId:id(serial++),attemptId:id(serial++),workerId:id(serial++),writerFence:source.writerFence+1},facts:{checkpoint,execution:await f.store.nextRuns.settlement(source,check)},scopes,versions,policyRevision:'policy1',reservedAt:at},check);
 const first=async()=>{await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});await allocate(binding);};
 return {f,status,get owner(){return owner;},deploy,reconciler,allocate,settle,running,complete,select,accept,lineage,reserveWith,first,state:()=>f.store.read(binding,{after:0,limit:1},check).then(r=>r.run.state)};}
