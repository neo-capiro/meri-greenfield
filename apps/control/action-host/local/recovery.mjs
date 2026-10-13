/** Explicit synthetic recovery exercise over real HTTP; never a native durability claim. */
import assert from 'node:assert/strict';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {listenActionApplication} from '../../action-application/node-http.mjs';

const failurePhases=new WeakMap();
// Safe fixed phase labels only; preserve the original rejection for callers.
export const localHostRecoveryFailurePhase=error=>failurePhases.get(error)??'INITIALIZATION';

export async function runLocalHostRecovery(configuration){
 const {mode,openHost,approve,revoke,stats,receiveResponse=(_route,_status,text)=>JSON.parse(text)}=own(configuration,['mode','openHost','approve','revoke','stats'],['receiveResponse']);
 if(mode!=='synthetic-local'||[openHost,approve,revoke,stats,receiveResponse].some(value=>typeof value!=='function'))throw Error('LOCAL_HOST_CONFIGURATION');
 const cutoff=Date.now()+30000,lifetime=createOperationLifetime({deadlineMs:cutoff,now:Date.now,errorFactory:code=>new Error(code)});
 const closed=[],applications=new Set();let selected,pending,observed,refusal,replay,revoked,phase='INITIALIZATION';
 async function withHost(work){
  lifetime.check();const remaining=cutoff-Date.now();if(remaining<=0)throw Error('LOCAL_HOST_DEADLINE');
  let graph,server,graphClosed=false;
  const closeGraph=async value=>{if(graphClosed)return;graphClosed=true;if(value?.closeGraph){const cleanup=createOperationLifetime({deadlineMs:Date.now()+1000,now:Date.now,errorFactory:code=>new Error(code)});try{await cleanup.run(()=>value.closeGraph());}finally{cleanup.close();}}};
  try{
   graph=await lifetime.run(async signal=>{const opened=own(await openHost({signal,deadlineMs:cutoff}),['app','credential'],['closeGraph']);if(opened.closeGraph!==undefined&&typeof opened.closeGraph!=='function')throw Error('LOCAL_HOST_CONFIGURATION');try{lifetime.check();return opened;}catch(error){await closeGraph(opened);throw error;}});
   const {app,credential}=graph;
   if(applications.has(app)||typeof credential!=='string'||!credential)throw Error('LOCAL_HOST_RECONSTRUCTION');
   applications.add(app);lifetime.check();
   server=await lifetime.run(async()=>{const opened=await listenActionApplication({app,host:'127.0.0.1',port:0,lifetimeMs:Math.min(10000,cutoff-Date.now())});try{lifetime.check();return opened;}catch(error){await opened.close();throw error;}});
   const call=async(route,body)=>{
    const response=await fetch(`${server.origin}/api/action-followthrough/${route}`,{method:'POST',redirect:'error',signal:lifetime.signal,
     headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)});
    const text=await response.text();const value=await lifetime.run(()=>receiveResponse(route,response.status,text));
    return {status:response.status,body:value};
   };
   return await work(call);
  }finally{try{if(server){await server.close();const status=server.status();closed.push(status);assert.deepEqual(status,{closed:true,listening:false,activeSockets:0});}}finally{if(graph)await closeGraph(graph);}}

 }
 const ok=value=>{assert.equal(value.status,200,'local host request refused');return value.body;};
 try{
  await withHost(async call=>{
   phase='HOST1_QUERY';const read=ok(await call('query',{request:{limit:20}}));
   assert.equal(read.acceptedTasks,false);assert.ok(read.observation.result.actions.length>0);
   selected={resultReference:read.resultReference,resultSha256:read.resultSha256,actionId:read.observation.result.actions[0].id};
   phase='HOST1_DRAFT';const draft=ok(await call('draft',{selection:selected,edits:{title:'Review the retained synthetic recommendation',dueDate:null}}));
   phase='HOST1_PREPARE';pending=ok(await call('prepare',{draft}));assert.equal(pending.status,'approval_required');assert.equal(stats().taskEffects,0);
   phase='HOST1_UNAPPROVED';refusal=await call('execute',{proposal:pending.proposal});assert.notEqual(refusal.status,200);assert.equal(refusal.body.error.outcome,'NOT_DISPATCHED');assert.equal(stats().taskEffects,0);
  });
  await withHost(async call=>{
   // Read through newly constructed store/delivery/host owners using the retained reference.
   phase='HOST2_READ';const draft=ok(await call('draft',{selection:selected,edits:{title:pending.draft.task.title,dueDate:null}}));
   assert.deepEqual(draft.source,pending.draft.source);assert.equal(stats().taskEffects,0);
   phase='HOST2_APPROVE';await lifetime.run(()=>approve(pending.proposal));
   phase='HOST2_EXECUTE';observed=ok(await call('execute',{proposal:pending.proposal}));assert.equal(observed.status,'observed');assert.equal(stats().taskEffects,1);
  });
  await withHost(async call=>{
   phase='HOST3_REPLAY';replay=ok(await call('execute',{proposal:pending.proposal}));assert.deepEqual(replay,observed);assert.equal(stats().taskEffects,1);
   phase='HOST3_REVOKE';await lifetime.run(()=>revoke());phase='HOST3_REFUSAL';revoked=await call('draft',{selection:selected});assert.notEqual(revoked.status,200);assert.equal(stats().taskEffects,1);
  });
  phase='FINAL_CHECKS';assert.equal(applications.size,3);assert.equal(closed.length,3);
  return data({status:'PASS',mode,transport:'loopback-http',nativeDatabase:false,productionActivated:false,reconstructedHosts:applications.size,
   outcomes:{pending:pending.status,unapprovedStatus:refusal.status,observed:observed.status,replayIdentical:true,revokedStatus:revoked.status},stats:stats(),cleanup:{listeners:closed}});
 }catch(error){if(error&&(typeof error==='object'||typeof error==='function'))failurePhases.set(error,phase);throw error;}finally{lifetime.close();}
}
