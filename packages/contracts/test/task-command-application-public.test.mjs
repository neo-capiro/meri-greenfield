/** Actual task API/command composition over SYNTHETIC SQL, authority, approval and Core boundaries. No live-service evidence. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {receiveTaskCommandRequest as request,receiveTaskCommandResponse as receive,TaskCommandResponseError,taskCommandMetadata,taskCommandPaths} from '../dist/task-command-application.mjs';
import {createTaskCommandApplication} from '../../../apps/control/task-command-application/index.mjs';
import {commandComposition,id,canonicalSha256} from '../../../apps/control/intents/test/fixture.mjs';
const json=JSON.stringify,clone=structuredClone;
const stable=b=>Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(key=>[key,b[key]]));
function setup(){
 const c=commandComposition({action:'task.update'}),state={};
 const fact=()=>({binding:c.binding,commandOptions:c.commandOptions,checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+1000,async authorizeExecution({proposal}){return {credential:'synthetic',execution:{...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}});
 const app=createTaskCommandApplication({now:()=>c.f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},async resolveSession(){return state.fact??fact();}});
 const call=(route,body)=>app.handle(new Request('https://meri.invalid'+taskCommandPaths[route],{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-session'},body:json(body)}));
 const raw={arguments:{taskId:'  '+id(21).toUpperCase()+' ',title:' Updated ',status:' OPEN '}};
 return {...c,state,fact,call,raw,binding:stable(c.binding)};
}
async function prepared(c=setup()){
 const admitted=await request('prepare',json(c.raw)),response=await c.call('prepare',admitted),text=await response.text();assert.equal(response.status,200,text);
 const value=await receive('prepare',200,text,{binding:c.binding,request:admitted});return {...c,admitted,prepared:value,proposal:value.proposal,prepareText:text};
}
async function observed(c){
 c??=await prepared();
 c.approve(c.proposal);const body=await request('execute',json({proposal:c.proposal})),response=await c.call('execute',body),text=await response.text();assert.equal(response.status,200,text);
 const value=await receive('execute',200,text,{binding:c.binding,proposal:c.proposal});assert.equal(value.status,'observed');return {...c,executeText:text,observed:value};
}
test('actual prepare/approve/execute API wire admits canonical normalization and immutable correlated result',async()=>{
 const c=await prepared();assert.equal(c.f.state.fetches,0);assert.deepEqual(c.proposal.command.arguments,{taskId:id(21),mode:'unconditional_patch',patch:{title:'Updated',status:'todo'}});
 const refused=await c.call('execute',{proposal:c.proposal}),refusal=await receive('execute',refused.status,await refused.text(),{binding:c.binding,proposal:c.proposal});assert('error'in refusal);assert.equal(c.f.state.fetches,0);
 const d=await observed(c);assert.equal(d.observed.outcome.result.id,id(21));assert.equal(d.f.state.fetches,1);assert.equal(d.f.state.http.url,'https://source.invalid/clio/tools/update_task');
 assert(Object.isFrozen(d.observed.outcome.result));assert(Object.isFrozen(c.proposal.command.arguments.patch));assert.throws(()=>{d.observed.outcome.result.title='changed';},TypeError);
});
test('current resumed attempt is allowed while selected original proposal stays fixed',async()=>{
 const c=await prepared(),current={...c.f.binding,attemptId:id(90),workerId:id(91),writerFence:2};c.f.state.fence=2;c.f.claims.binding=current;c.f.execution.executorBinding=current;c.state.fact={...c.fact(),binding:current};
 c.f.ports.currentRun=async()=>json({binding:current,policyRevision:c.f.claims.policyRevision,deadlineMs:Date.parse(c.f.claims.expiresAt),checkedAtMs:c.f.state.now});
 const d=await observed(c);assert.equal(d.observed.outcome.receipt.binding.writerFence,2);assert.equal(d.proposal.command.binding.writerFence,1);
});
test('due-day and nullable/blank raw input use the canonical normalizer',async()=>{
 const c=setup();c.raw.arguments={taskId:id(21),title:null,status:' ',dueDate:'2026-10-20'};
 const p=await prepared(c);assert.deepEqual(p.proposal.command.arguments.patch,{dueDate:'2026-10-20T00:00:00.000Z'});
 p.f.state.fetchHook=(_url,_options,native)=>Response.json({...native,task:{...native.task,dueDate:'2026-10-20T00:00:00.000Z'}});
 const d=await observed(p);assert.equal(d.observed.outcome.result.dueDate,'2026-10-20T00:00:00.000Z');
});
test('unknown native effect preserves error outcome and repeated execution reports indeterminate without a second dispatch',async()=>{
 const c=await prepared();c.approve(c.proposal);c.f.state.fetchHook=()=>{throw Error('synthetic upstream transport failure');};const response=await c.call('execute',{proposal:c.proposal});
 const value=await receive('execute',response.status,await response.text(),{binding:c.binding,proposal:c.proposal});assert.deepEqual(value,{error:{code:'COMMAND_OUTCOME_UNKNOWN',outcome:'UNKNOWN'}});
 const repeated=await c.call('execute',{proposal:c.proposal}),pending=await receive('execute',repeated.status,await repeated.text(),{binding:c.binding,proposal:c.proposal});assert.deepEqual(pending,{status:'indeterminate',outcome:null});assert.equal(c.f.state.fetches,1);
});
test('HTTP vocabulary/status and default-off availability are precise',async()=>{
 const c=await prepared(),expectation={binding:c.binding,request:c.admitted};assert.equal(taskCommandMetadata.schemaId,'urn:meri:task-command-application:0.1.0');assert.equal(taskCommandMetadata.routes.execute.path,'/api/task-commands/execute');
 for(const [code,status]of Object.entries(taskCommandMetadata.errorStatuses))assert.equal((await receive('prepare',status,json({error:{code,outcome:'NOT_DISPATCHED'}}),expectation)).error.code,code);
 for(const outcome of taskCommandMetadata.errorOutcomes)assert.equal((await receive('prepare',502,json({error:{code:'REQUEST_FAILED',outcome}}),expectation)).error.outcome,outcome);
 assert.equal(taskCommandMetadata.errorStatuses.TASK_COMMAND_UNAVAILABLE,503);
 for(const [status,value]of [[200,{error:{code:'REQUEST_FAILED',outcome:'UNKNOWN'}}],[503,{error:{code:'REQUEST_FAILED',outcome:'UNKNOWN'}}],[502,{error:{code:'UNKNOWN_CODE',outcome:'UNKNOWN'}}],[502,{error:{code:'REQUEST_FAILED',outcome:'SUCCESS'}}],[201,c.prepared]])await assert.rejects(receive('prepare',status,json(value),expectation),TaskCommandResponseError);
});
const prepareMutations={
 'hash mismatch':v=>{v.proposal.commandSha256='0'.repeat(64);},'unknown key':v=>{v.approved=true;},'required approver tenant':v=>{v.proposal.requiredApprover.tenantId='foreign';},
 'scope tenant':v=>{v.proposal.command.scopes[0].tenantId='foreign';},'task mismatch':v=>{v.proposal.command.arguments.taskId=id(22);},'patch mismatch':v=>{v.proposal.command.arguments.patch.title='Other';},
 'wrong stable binding':v=>{v.proposal.command.binding.runId=id(99);},'reversed expiry':v=>{v.proposal.expiresAt=v.proposal.createdAt;},'noncanonical instant':v=>{v.proposal.createdAt=v.proposal.createdAt.replace('.000Z','Z');},
 'nonday due date':v=>{v.proposal.command.arguments.patch.dueDate='2026-10-20T01:00:00.000Z';},'noncanonical title':v=>{v.proposal.command.arguments.patch.title=' Updated ';},
};
for(const [name,mutate]of Object.entries(prepareMutations))test('prepare rejects '+name,async()=>{const c=await prepared(),value=clone(c.prepared);mutate(value);if(name!=='hash mismatch')value.proposal.commandSha256=canonicalSha256(value.proposal.command);await assert.rejects(receive('prepare',200,json(value),{binding:c.binding,request:c.admitted}),TaskCommandResponseError);});
const executeMutations={
 'wrong command id':v=>{v.outcome.receipt.commandId=id(99);},'wrong command hash':v=>{v.outcome.receipt.commandSha256='0'.repeat(64);},'wrong idempotency key':v=>{v.outcome.receipt.idempotencyKey='other';},
 'wrong tenant':v=>{v.outcome.receipt.binding.tenantId='foreign';},'wrong run':v=>{v.outcome.receipt.binding.runId=id(99);},'foreign scope':v=>{v.outcome.receipt.scopes[0].tenantId='foreign';},
 'changed scope':v=>{v.outcome.receipt.scopes[0].policyRevision='other';},'failed receipt':v=>{v.outcome.receipt.outcome='failed';},'wrong task':v=>{v.outcome.result.id=id(99);},
 'wrong patch title':v=>{v.outcome.result.title='Other';},'wrong patch status':v=>{v.outcome.result.status='done';},'bad completed time':v=>{v.outcome.receipt.completedAt='2026-10-12T20:00:00Z';},
 'bad result time':v=>{v.outcome.result.updatedAt='2026-10-12T20:00:00Z';},'non-day result due date':v=>{v.outcome.result.dueDate='2026-10-12T20:00:00.000Z';},'unknown output key':v=>{v.success=true;},
};
for(const [name,mutate]of Object.entries(executeMutations))test('execute rejects '+name,async()=>{const c=await observed(),value=clone(c.observed);mutate(value);await assert.rejects(receive('execute',200,json(value),{binding:c.binding,proposal:c.proposal}),TaskCommandResponseError);});
test('the selected original proposal is required even for indeterminate output',async()=>{const c=await prepared(),p=clone(c.proposal);p.command.binding.actorId='foreign';p.commandSha256=canonicalSha256(p.command);await assert.rejects(receive('execute',200,json({status:'indeterminate',outcome:null}),{binding:c.binding,proposal:p}),TaskCommandResponseError);});
test('request receiver admits only closed raw prepare or canonical execute proposals',async()=>{
 const c=await prepared();for(const value of [{arguments:c.raw.arguments,approved:true},{arguments:{...c.raw.arguments,binding:c.binding}},{arguments:{taskId:id(21),status:42}},{proposal:c.proposal}])await assert.rejects(request('prepare',json(value)),TaskCommandResponseError);
 const p=clone(c.proposal);p.command.arguments.patch.title='tampered';await assert.rejects(request('execute',json({proposal:p})),TaskCommandResponseError);assert.deepEqual(await request('execute',json({proposal:c.proposal})),{proposal:c.proposal});
});
test('bounded primitive JSON rejects hostile bytes, keys, depth, unicode and nonfinite numbers',async()=>{
 for(const value of ['{','null','1e999','{"__proto__":{}}','{"constructor":0}','['.repeat(66)+'0'+']'.repeat(66),' '.repeat(16777217),'"\\ud800"','"\ud800"'])await assert.rejects(request('prepare',value),TaskCommandResponseError);
 let touched=0;const hostile=new Proxy({},{get(){touched++;throw Error('trap');}});for(const value of [hostile,{get data(){touched++;throw Error('getter');}}])await assert.rejects(request('prepare',value),TaskCommandResponseError);
 await assert.rejects(request({[Symbol.toPrimitive](){touched++;return 'prepare';}},'{}'),TaskCommandResponseError);assert.equal(touched,0);
});
test('independent stable context is mandatory and cannot be substituted with full worker authority',async()=>{
 const c=await prepared();for(const expected of [undefined,{binding:{...c.binding,actorId:'other'},request:c.admitted},{binding:{...c.binding,workerId:id(7)},request:c.admitted},{binding:c.binding,request:c.admitted,approved:true}])await assert.rejects(receive('prepare',200,c.prepareText,expected),TaskCommandResponseError);
 let touched=0;await assert.rejects(receive('prepare',200,c.prepareText,{get binding(){touched++;return c.binding;},request:c.admitted}),TaskCommandResponseError);assert.equal(touched,0);
});
test('public browser artifact has no external imports and metadata binds canonical owners',async()=>{
 const source=await readFile(new URL('../dist/task-command-application.mjs',import.meta.url),'utf8'),metadata=JSON.parse(await readFile(new URL('../dist/task-command-application.metadata.json',import.meta.url),'utf8'));
 assert.deepEqual(metadata.browserImports,[]);assert(!/from ['"](?:node:|ajv|canonicalize)/u.test(source));assert(metadata.sources.some(source=>source.path==='commands-0.2/task-update.schema.json'));assert(metadata.sources.some(source=>source.path==='commands-0.2/task-update-validation.mjs'));
});
