/** Actual Fetch API calls; no listener and no fake completion event. */
export async function runLocalActionFlow(demo){
 const call=async(route,body)=>{const response=await demo.app.handle(new Request(`http://local.invalid/api/action-followthrough/${route}`,{method:'POST',headers:{authorization:`Bearer ${demo.credential}`,'content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};};
 const requireOk=value=>{if(value.status!==200)throw new Error('LOCAL_FLOW_REFUSED');return value.body;};
 const read=requireOk(await call('query',{request:{limit:20}}));
 const actions=read.observation?.result?.actions;if(!Array.isArray(actions)||!actions.length||read.acceptedTasks!==false)throw new Error('LOCAL_RECOMMENDATIONS_REQUIRED');
 const selection={resultReference:read.resultReference,resultSha256:read.resultSha256,actionId:actions[0].id};
 const draft=requireOk(await call('draft',{selection,edits:{title:'Review the synthetic recommendation',dueDate:null}}));
 const pending=requireOk(await call('prepare',{draft}));if(pending.status!=='approval_required'||demo.stats().taskEffects!==0)throw new Error('LOCAL_APPROVAL_REQUIRED');
 const refused=await call('execute',{proposal:pending.proposal});if(refused.status===200||demo.stats().taskEffects!==0)throw new Error('LOCAL_APPROVAL_BYPASS');
 await demo.approve(pending.proposal);
 const executed=requireOk(await call('execute',{proposal:pending.proposal}));
 const replay=requireOk(await call('execute',{proposal:pending.proposal}));
 if(executed.status!=='observed'||JSON.stringify(executed)!==JSON.stringify(replay)||demo.stats().taskEffects!==1)throw new Error('LOCAL_REPLAY_FAILED');
 return {status:'PASS',mode:'synthetic-local',sourceTransport:'synthetic-in-process',nativeDatabase:false,productionActivated:false,read,draft,pending,unapproved:refused,executed,replay,stats:demo.stats()};
}
