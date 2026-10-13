import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {receiveActionResponse,ActionResponseError} from '../dist/action-application.mjs';
const wire=JSON.parse(await readFile(new URL('../../../docs/qualification/candidates/action-wiring-20261013/integration/wire-fixtures.json',import.meta.url)));
const clone=value=>JSON.parse(JSON.stringify(value));
for(const [i,s]of wire.steps.entries())test(`actual PR42 wire ${i} ${s.route} ${s.httpStatus}`,async()=>{const value=await receiveActionResponse(s.route,s.httpStatus,JSON.stringify(s.response));assert.deepEqual(value,s.response);assert(Object.isFrozen(value));});
for(const item of wire.separateUncertaintyExamples)test(`preserve uncertainty ${item.scenario}`,async()=>{const value=await receiveActionResponse('prepare',item.httpStatus,JSON.stringify(item.body));assert.equal(value.error.outcome,item.scenario);});
for(const route of ['query','draft','prepare','execute'])test(`reject success/error status interchange ${route}`,async()=>{await assert.rejects(receiveActionResponse(route,200,'{"error":{"code":"REQUEST_FAILED","outcome":"UNKNOWN"}}'),ActionResponseError);await assert.rejects(receiveActionResponse(route,201,JSON.stringify(wire.steps[0].response)),ActionResponseError);});
const query=wire.steps[0].response,draft=wire.steps[1].response,prepare=wire.steps[2].response;
const negatives=[
 ['query',query,v=>v.acceptedTasks=true],['query',query,v=>v.approval=true],['query',query,v=>v.events[1].data.resultReference='00000000-0000-4000-8000-000000000099'],
 ['query',query,v=>v.events[0].binding.actorId='other'],['query',query,v=>v.observation.result.actions[0].title='altered'],
 ['draft',draft,v=>v.task.title='altered'],['draft',draft,v=>v.source.actionSha256='0'.repeat(64)],['prepare',prepare,v=>v.status='approved'],['prepare',prepare,v=>v.proposal.command.arguments.clientId=null],
 ['execute',wire.steps[4].response,v=>v.outcome.receipt.outcome='indeterminate'],['execute',wire.steps[4].response,v=>v.outcome.receipt.scopes[0].tenantId='other']
];
for(const[i,[route,value,mutate]]of negatives.entries())test(`closed/correlated negative ${i}`,async()=>{const v=clone(value);mutate(v);await assert.rejects(receiveActionResponse(route,200,JSON.stringify(v)),ActionResponseError);});
test('Proxy, accessor, revoked proxy rejected without traps',async()=>{let touched=0;const hostile=new Proxy({},{get(){touched++;throw Error('trap')},getOwnPropertyDescriptor(){touched++;throw Error('trap')}});const revoked=Proxy.revocable({},{});revoked.revoke();for(const v of [hostile,revoked.proxy,{get data(){touched++;throw Error('getter')}}])await assert.rejects(receiveActionResponse('query',200,v),ActionResponseError);await assert.rejects(receiveActionResponse(hostile,200,'{}'),ActionResponseError);assert.equal(touched,0);});
test('bounded primitive JSON',async()=>{for(const v of ['{','null','1e999','{"__proto__":{}}','['.repeat(66)+'0'+']'.repeat(66),' '.repeat(16777217)])await assert.rejects(receiveActionResponse('query',200,v),ActionResponseError);});
test('route coercion never occurs',async()=>{let touched=0;await assert.rejects(receiveActionResponse({[Symbol.toPrimitive](){touched++;return 'query'}},200,'{}'),ActionResponseError);assert.equal(touched,0);});
test('deep immutable parsed output',async()=>{const q=await receiveActionResponse('query',200,JSON.stringify(query));assert.throws(()=>{q.observation.result.actions[0].title='edited'},TypeError);assert.equal(query.observation.result.actions[0].title,'Issue');});
test('execute pending outcome retained without claimed result',async()=>{assert.deepEqual(await receiveActionResponse('execute',200,'{"status":"indeterminate","outcome":null}'),{status:'indeterminate',outcome:null});});

test("interleaved events retain increasing sequence",async()=>{const v=clone(query);v.events[1].sequence=7;assert.equal((await receiveActionResponse("query",200,JSON.stringify(v))).events[1].sequence,7);});
