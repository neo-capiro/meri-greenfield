export class RunIndexResponseError extends Error{constructor(code){super(code);this.name='RunIndexResponseError';this.code=code;}}
export const runIndexFail=code=>{throw new RunIndexResponseError(code);};
export function assertRunIndexSemantics(route,request,response){
 const runs=route==='list'?response.runs:[response.run],seen=new Set();
 if(route==='list'){
  if(response.scope.kind!==request.scope.kind||response.scope.clientId!==request.scope.clientId||response.status!==request.status||runs.length>request.limit||response.coverage.complete!==(response.nextCursor===null))runIndexFail('INVALID_RESPONSE');
 }
 for(const run of runs){
  const key=run.conversationId+':'+run.runId;if(seen.has(key))runIndexFail('INVALID_RESPONSE');seen.add(key);
  if(run.references.conversationId!==run.conversationId||run.references.runId!==run.runId||Date.parse(run.statusAt)<Date.parse(run.createdAt))runIndexFail('INVALID_RESPONSE');
  if(run.usage.recording!=='recorded'&&run.usage.sdkEstimateUsd!==null)runIndexFail('INVALID_RESPONSE');
  if(route==='detail'&&(run.conversationId!==request.conversationId||run.runId!==request.runId))runIndexFail('INVALID_RESPONSE');
  if(route==='list'){
   const terminal=['completed','failed','cancelled'].includes(run.state);
   if(request.status==='active'&&terminal||request.status==='terminal'&&!terminal||request.scope.kind==='general'&&run.clientIds.length||request.scope.kind==='client'&&!run.clientIds.includes(request.scope.clientId))runIndexFail('INVALID_RESPONSE');
  }
 }
 for(let i=1;i<runs.length;i++){const a=runs[i-1],b=runs[i];if(a.createdAt<b.createdAt||a.createdAt===b.createdAt&&(a.runId<b.runId||a.runId===b.runId&&a.conversationId<=b.conversationId))runIndexFail('INVALID_RESPONSE');}
 return response;
}
