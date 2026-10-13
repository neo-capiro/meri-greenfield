/** Explicit synthetic recovery exercise over real HTTP; never a native durability claim. */
import assert from 'node:assert/strict';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {listenActionApplication} from '../../action-application/node-http.mjs';

export async function runLocalHostRecovery(configuration){
 const {mode,openHost,approve,revoke,stats}=own(configuration,['mode','openHost','approve','revoke','stats']);
 if(mode!=='synthetic-local'||[openHost,approve,revoke,stats].some(value=>typeof value!=='function'))throw Error('LOCAL_HOST_CONFIGURATION');
 const cutoff=Date.now()+30000,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 const closed=[],applications=new Set();let selected,pending,observed,refusal,replay,revoked;
 async function withHost(work){
  const remaining=cutoff-Date.now();if(remaining<=0||controller.signal.aborted)throw Error('LOCAL_HOST_DEADLINE');
  const {app,credential}=own(openHost(),['app','credential']);
  if(applications.has(app)||typeof credential!=='string'||!credential)throw Error('LOCAL_HOST_RECONSTRUCTION');
  applications.add(app);
  const server=await listenActionApplication({app,host:'127.0.0.1',port:0,lifetimeMs:Math.min(10000,remaining)});
  try{
   const call=async(route,body)=>{
    const response=await fetch(`${server.origin}/api/action-followthrough/${route}`,{method:'POST',redirect:'error',signal:controller.signal,
     headers:{authorization:`Bearer ${credential}`,'content-type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
   };
   return await work(call);
  }finally{await server.close();const status=server.status();closed.push(status);assert.deepEqual(status,{closed:true,listening:false,activeSockets:0});}
 }
 const ok=value=>{assert.equal(value.status,200,'local host request refused');return value.body;};
 try{
  await withHost(async call=>{
   const read=ok(await call('query',{request:{limit:20}}));
   assert.equal(read.acceptedTasks,false);assert.ok(read.observation.result.actions.length>0);
   selected={resultReference:read.resultReference,resultSha256:read.resultSha256,actionId:read.observation.result.actions[0].id};
   const draft=ok(await call('draft',{selection:selected,edits:{title:'Review the retained synthetic recommendation',dueDate:null}}));
   pending=ok(await call('prepare',{draft}));assert.equal(pending.status,'approval_required');assert.equal(stats().taskEffects,0);
   refusal=await call('execute',{proposal:pending.proposal});assert.notEqual(refusal.status,200);assert.equal(refusal.body.error.outcome,'NOT_DISPATCHED');assert.equal(stats().taskEffects,0);
  });
  await withHost(async call=>{
   // Read through newly constructed store/delivery/host owners using the retained reference.
   const draft=ok(await call('draft',{selection:selected,edits:{title:pending.draft.task.title,dueDate:null}}));
   assert.deepEqual(draft.source,pending.draft.source);assert.equal(stats().taskEffects,0);
   await approve(pending.proposal);
   observed=ok(await call('execute',{proposal:pending.proposal}));assert.equal(observed.status,'observed');assert.equal(stats().taskEffects,1);
  });
  await withHost(async call=>{
   replay=ok(await call('execute',{proposal:pending.proposal}));assert.deepEqual(replay,observed);assert.equal(stats().taskEffects,1);
   await revoke();revoked=await call('draft',{selection:selected});assert.notEqual(revoked.status,200);assert.equal(stats().taskEffects,1);
  });
  assert.equal(applications.size,3);assert.equal(closed.length,3);
  return data({status:'PASS',mode,transport:'loopback-http',nativeDatabase:false,productionActivated:false,reconstructedHosts:applications.size,
   outcomes:{pending:pending.status,unapprovedStatus:refusal.status,observed:observed.status,replayIdentical:true,revokedStatus:revoked.status},stats:stats(),cleanup:{listeners:closed}});
 }finally{clearTimeout(timer);controller.abort();}
}
