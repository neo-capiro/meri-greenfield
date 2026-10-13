import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {receiveActionResponse,ActionResponseError} from '@capiro/meri-contracts/action-application';
import {createLocalActionDemo} from '../../../apps/control/action-application/local/demo.mjs';
import {runLocalActionFlow} from '../../../apps/control/action-application/local/flow.mjs';
import {canonicalSha256} from '../validate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
let fixture;
async function wire(){
 if(!fixture)fixture=(async()=>{const old=process.env.MERI_REVIEW_SOURCE_ROOT;process.env.MERI_REVIEW_SOURCE_ROOT=root;let demo;try{demo=await createLocalActionDemo({mode:'synthetic-local',ttlMs:10000});return await runLocalActionFlow(demo);}finally{demo?.close();if(old===undefined)delete process.env.MERI_REVIEW_SOURCE_ROOT;else process.env.MERI_REVIEW_SOURCE_ROOT=old;}})();return fixture;
}
const encode=JSON.stringify;
const bad=async(route,status,value)=>assert.rejects(()=>receiveActionResponse(route,status,typeof value==='string'?value:encode(value)),ActionResponseError);
for(const [route,key]of [['query','read'],['draft','draft'],['prepare','pending'],['execute','executed'],['execute','replay']])test(`independent public receiver actual PR42 ${route}/${key}`,async()=>{const raw=(await wire())[key],out=await receiveActionResponse(route,200,encode(raw));assert.deepEqual(out,raw);assert.ok(Object.isFrozen(out));assert.notEqual(out,raw);if(route==='query'){assert.equal(out.acceptedTasks,false);assert.ok(Object.isFrozen(out.observation.result.actions));}if(route==='prepare')assert.equal(out.status,'approval_required');});
test('independent actual pending approval error and indeterminate accounting remain non-success',async()=>{const f=await wire();assert.notEqual(f.unapproved.status,200);assert.deepEqual(await receiveActionResponse('execute',f.unapproved.status,encode(f.unapproved.body)),f.unapproved.body);assert.deepEqual(await receiveActionResponse('execute',200,'{"status":"indeterminate","outcome":null}'),{status:'indeterminate',outcome:null});assert.equal(f.stats.taskEffects,1);});
for(const [code,status]of [['UNAUTHENTICATED',401],['ACCESS_DENIED',403],['DEADLINE',408],['CANCELLED',499],['COMMAND_APPROVAL_REFUSED',409],['COMMAND_OUTCOME_UNKNOWN',502]])test(`independent public error ${code}/${status}`,async()=>{const value={error:{code,outcome:code==='COMMAND_OUTCOME_UNKNOWN'?'UNKNOWN':'NOT_DISPATCHED'}};assert.deepEqual(await receiveActionResponse('execute',status,encode(value)),value);});
for(const outcome of ['UNKNOWN','RESULT_NOT_RELEASED','STORED_NOT_RELEASED','NOT_STORED','READ_UNAVAILABLE'])test(`independent receiver preserves ${outcome} without retry/approval fields`,async()=>{const value={error:{code:'REQUEST_FAILED',outcome}};assert.deepEqual(await receiveActionResponse('prepare',502,encode(value)),value);await bad('prepare',502,{error:{...value.error,retryable:true}});});
for(const [label,route,status,key,mutate]of [
 ['accepted recommendation','query',200,'read',x=>x.acceptedTasks=true],
 ['unknown query field','query',200,'read',x=>x.authorized=true],
 ['query digest','query',200,'read',x=>x.resultSha256='f'.repeat(64)],
 ['event binding','query',200,'read',x=>x.events[0].binding.actorId='other'],
 ['event result ref','query',200,'read',x=>x.events[1].data.resultReference='00000000-0000-4000-8000-000000000999'],
 ['draft digest','draft',200,'draft',x=>x.draftSha256='f'.repeat(64)],
 ['recommendation hash','draft',200,'draft',x=>{x.recommendation.title='forged';const {draftSha256,...body}=x;x.draftSha256=canonicalSha256(body);}],
 ['prepare approval confusion','prepare',200,'pending',x=>x.status='approved'],
 ['proposal digest','prepare',200,'pending',x=>x.proposal.commandSha256='f'.repeat(64)],
 ['proposal task substitution','prepare',200,'pending',x=>{x.proposal.command.arguments.title='forged';x.proposal.commandSha256=canonicalSha256(x.proposal.command);}],
 ['prepare client substitution','prepare',200,'pending',x=>{x.proposal.command.arguments.clientId='00000000-0000-4000-8000-000000000999';x.proposal.commandSha256=canonicalSha256(x.proposal.command);}],
 ['execute approval confusion','execute',200,'pending',()=>{}],
 ['execute unknown key','execute',200,'executed',x=>x.retry=true],
 ['execute tenant-scope mismatch','execute',200,'executed',x=>x.outcome.receipt.scopes[0].tenantId='other'],
])test(`independent receiving refusal ${label}`,async()=>{const value=structuredClone((await wire())[key]);mutate(value);await bad(route,status,value);});
test('independent route and status cannot reclassify an actual payload',async()=>{const f=await wire();await bad('query',200,f.draft);await bad('execute',200,f.unapproved.body);await bad('query',403,f.read);await bad('execute',200,{error:{code:'ACCESS_DENIED',outcome:'NOT_DISPATCHED'}});await bad('execute',403,{error:{code:'COMMAND_APPROVAL_REFUSED',outcome:'NOT_DISPATCHED'}});});
for(const raw of ['', 'null','[]','{}','{"error":','{"error":{}} trailing'])test(`independent malformed primitive JSON ${raw}`,async()=>{await bad('query',200,raw);});
test('independent receiving refuses effectful objects without reading any traps',async()=>{let effects=0;const hostile=new Proxy({}, {get(){effects++;throw Error('secret');},getPrototypeOf(){effects++;throw Error('secret');},ownKeys(){effects++;throw Error('secret');}});const object={get toJSON(){effects++;return()=>({});}};for(const v of [undefined,null,{},object,hostile,new String('{}')])await assert.rejects(()=>receiveActionResponse('query',200,v),ActionResponseError);await assert.rejects(()=>receiveActionResponse(hostile,200,'{}'),ActionResponseError);await assert.rejects(()=>receiveActionResponse('query',hostile,'{}'),ActionResponseError);assert.equal(effects,0);});
test('independent explicit byte and nesting bounds refuse safely',async()=>{await bad('query',200,' '.repeat(16*1024*1024+1));await bad('query',200,'['.repeat(70)+'0'+']'.repeat(70));});
test('independent package has no public approval, credential or execution method',async()=>{const ns=await import('@capiro/meri-contracts/action-application');assert.deepEqual(Object.keys(ns).sort(),['ActionResponseError','receiveActionResponse']);});
test('independent generated browser receiver has no external/private/Node imports',async()=>{
 const url=import.meta.resolve('@capiro/meri-contracts/action-application');const text=readFileSync(fileURLToPath(url),'utf8');assert.equal(/from\s*["']node:|import\(["']node:/.test(text),false);
 const sample=(await wire()).pending;
 const script=`import{readFileSync}from'node:fs';import{SourceTextModule,createContext}from'node:vm';import{webcrypto}from'node:crypto';const m=new SourceTextModule(readFileSync(${JSON.stringify(fileURLToPath(url))},'utf8'),{context:createContext({crypto:webcrypto,TextEncoder})});await m.link(()=>{throw Error('external import')});await m.evaluate({timeout:2000});const r=await m.namespace.receiveActionResponse('prepare',200,${JSON.stringify(encode(sample))});if(r.status!=='approval_required')throw Error('invalid browser receiver');`;
 const result=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',script],{timeout:10000,maxBuffer:65536});assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr.toString());
});
