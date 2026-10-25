/** Actual native standalone HTTP and public receiver with scripted SQL/current authority/Core boundaries. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {receiveTaskCommandRequest as request,receiveTaskCommandResponse as receive,TaskCommandResponseError,taskCommandMetadata,taskCommandPaths} from '../dist/task-command-application.mjs';
import {standaloneFixture,id} from '../../../apps/runtime/native-authority/test/standalone-tasks-fixture.mjs';
import {canonicalSha256} from '../validate.mjs';
const json=JSON.stringify,clone=structuredClone;
const stable=b=>Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(key=>[key,b[key]]));
function setup(){const f=standaloneFixture();return {...f,binding:stable(f.binding)};}
async function prepared(c=setup()){
 const admitted=await request('prepare',json(c.raw)),response=await c.call('prepare',admitted),text=await response.text();assert.equal(response.status,200,text);
 const value=await receive('prepare',200,text,{binding:c.binding,request:admitted});return {...c,admitted,prepared:value,proposal:value.proposal,prepareText:text};
}
async function observed(c){
 c??=await prepared();const body=await request('execute',json({proposal:c.proposal})),response=await c.call('execute',body),text=await response.text();assert.equal(response.status,200,text);
 const value=await receive('execute',200,text,{binding:c.binding,proposal:c.proposal});assert.equal(value.status,'observed');return {...c,executeText:text,observed:value};
}
test('native standalone prepare and explicit approval execute correlate the immutable proposal and result',async()=>{
 const c=await prepared();assert.equal(c.state.effects,0);assert.equal(c.state.decisions,0);assert.deepEqual(c.proposal.command.arguments,{taskId:id(21),mode:'unconditional_patch',patch:{title:'Updated',status:'todo'}});
 const d=await observed(c);assert.equal(d.observed.outcome.result.id,id(21));assert.equal(d.state.effects,1);assert.equal(d.observed.outcome.execution.kind,'native-task');
 assert(Object.isFrozen(d.observed.outcome.result));assert(Object.isFrozen(c.proposal.command.arguments.patch));assert.throws(()=>{d.observed.outcome.result.title='changed';},TypeError);
});
test('due-day and nullable raw input retain canonical normalization',async()=>{
 const c=setup();c.raw.arguments={taskId:id(21),title:null,status:' ',dueDate:'2026-10-20'};
 const p=await prepared(c);assert.deepEqual(p.proposal.command.arguments.patch,{dueDate:'2026-10-20T00:00:00.000Z'});
 const d=await observed(p);assert.equal(d.observed.outcome.result.dueDate,'2026-10-20T00:00:00.000Z');
});
test('HTTP vocabulary/status and unavailable response are precise',async()=>{
 const c=await prepared(),expectation={binding:c.binding,request:c.admitted};assert.equal(taskCommandMetadata.schemaId,'urn:meri:task-command-application:0.1.0');assert.equal(taskCommandPaths.execute,'/api/task-commands/execute');
 for(const [code,status]of Object.entries(taskCommandMetadata.errorStatuses))assert.equal((await receive('prepare',status,json({error:{code,outcome:'NOT_DISPATCHED'}}),expectation)).error.code,code);
 for(const outcome of taskCommandMetadata.errorOutcomes)assert.equal((await receive('prepare',502,json({error:{code:'REQUEST_FAILED',outcome}}),expectation)).error.outcome,outcome);
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
 'wrong command id':v=>{v.outcome.execution.proposalId=id(99);},'wrong command hash':v=>{v.outcome.execution.commandSha256='0'.repeat(64);},'wrong idempotency key':v=>{v.outcome.execution.idempotencyKey='other';},
 'wrong tenant':v=>{v.outcome.execution.binding.tenantId='foreign';},'wrong run':v=>{v.outcome.execution.binding.runId=id(99);},'bad decision hash':v=>{v.outcome.execution.approvalDecisionSha256='foreign';},
 'changed kind':v=>{v.outcome.execution.kind='legacy';},'extra execution field':v=>{v.outcome.execution.outcome='failed';},'wrong task':v=>{v.outcome.result.id=id(99);},
 'wrong patch title':v=>{v.outcome.result.title='Other';},'wrong patch status':v=>{v.outcome.result.status='done';},'bad completed time':v=>{v.outcome.execution.completedAt='2026-10-12T20:00:00Z';},
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
