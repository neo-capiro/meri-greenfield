import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateDatasetMetadataShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPublicDomainDatasetRegistry} from '../../../packages/contracts/retrieval-0.2/public-domain-registry.mjs';
import {createDatasetMetadataHandler} from '../sources/dataset-metadata/handler.mjs';
import {createSourceDisabledGateway} from '../index.mjs';
import {fixture,NOW,uuid,limits} from './fixtures.mjs';
const op={id:'list_global_datasets',version:'0.2.0'},request=JSON.stringify({operation:op,arguments:{}});
const registry=createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata:validateDatasetMetadataShape});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function connected(){
 const f=fixture(),contract=resolveOperationContract(op),descriptor=contract.descriptor;
 f.state.grants=[...descriptor.requiredGrants];f.state.deadline=NOW+10000;
 f.ports.currentRun=async()=>{f.calls.push('fence');return JSON.stringify({binding:{...f.binding,writerFence:f.state.fence},policyRevision:f.claims.policyRevision,deadlineMs:f.state.deadline,checkedAtMs:f.state.now});};
 const business=f.ports.authorizeBusiness;
 f.ports.authorizeBusiness=async call=>{const out=JSON.parse(await business(call));out.decision.operation=`${op.id}@${op.version}`;f.state.policyInput=call.input;return JSON.stringify(out);};
 f.ports.authorizeSources=async()=>{f.calls.push('source-policy');return JSON.stringify({sourceIds:[...new Set(descriptor.sourceRequirements.map(s=>s.sourceId))],enabled:f.state.sourceEnabled,policyRevision:f.claims.policyRevision,checkedAtMs:f.state.now});};
 const handler=createDatasetMetadataHandler({registry,now:()=>f.state.now});
 const entry={descriptor,contract,async execute(call){f.calls.push('handler');f.state.handlerCall=call;return handler(call);}};
 const budget=f.budget,reserve=budget.reserve;budget.reserve=async call=>{f.state.reservation=call;return reserve(call);};
 const retention={loadPrevious(){throw Error('unexpected retention');},retain(){throw Error('unexpected retention');}};
 const create=changes=>f.create({catalog:{entry:requested=>canonicalSha256(requested)===canonicalSha256(op)?entry:null,discoverable:()=>[]},memoryContextPorts:retention,mailContextPorts:retention,...changes});
 return {...f,contract,descriptor,entry,handler,create};
}
async function directCall(f){await f.create().execute(request,'synthetic');return f.state.handlerCall;}

test('canonical provider and real resolver/authority/dispatch emit exact12 datasets88 fields',async()=>{
 const f=connected(),out=JSON.parse(await f.create().execute(request,'synthetic'));
 assert.deepEqual(Object.keys(out).sort(),['argumentsSha256','binding','operation','result','subject']);
 assert.equal(out.result.datasets.length,12);assert.equal(out.result.datasets.reduce((n,d)=>n+d.fields.length,0),88);
 assert.deepEqual(out.result.datasets,registry.listDatasetMetadata());assert.equal(out.result.generatedAt,new Date(NOW).toISOString());
 assert.deepEqual(f.state.handlerCall.input,{});assert.deepEqual(f.state.handlerCall.request,{});assert.deepEqual(f.state.policyInput,{});
 assert.equal(out.argumentsSha256,canonicalSha256({}));assert.equal(f.state.reservation.argumentsSha256,out.argumentsSha256);
 assert.equal(f.calls.filter(x=>x==='policy').length,4);assert.ok(f.calls.lastIndexOf('policy')>f.calls.indexOf('settle'));assert.equal(f.calls.includes('uncertain'),false);
});
test('production gateway stays unavailable with zero authority/source effects',async()=>{
 const f=connected(),g=createSourceDisabledGateway({authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('7')});
 assert.equal(g.sourceEnabled,false);await assert.rejects(g.execute(request,'synthetic'),/UNAVAILABLE/);assert.deepEqual(await g.discover(),[]);assert.deepEqual(f.calls,[]);
 const d=catalog.operations.find(x=>x.operation.id===op.id);assert.equal(d.handler,null);assert.equal(d.availability,'unimplemented');
});
test('only branded immutable provider accepted without calling fake registry methods',()=>{
 let effects=0;for(const fake of [{listDatasetMetadata(){effects++;return registry.listDatasetMetadata();}},{...registry},new Proxy(registry,{get(){effects++;throw Error('read');}})])assert.throws(()=>createDatasetMetadataHandler({registry:fake,now:()=>NOW}),/GATEWAY_CONFIGURATION/);
 assert.equal(effects,0);assert.equal(Object.isFrozen(registry.listDatasetMetadata()[0].fields),true);
});
test('unknown or authority-bearing arguments refuse before identity',async()=>{
 for(const args of [{q:''},{limit:12},{tenantId:'other'},{nested:{actorId:'x'}},{},null,[]]){if(args&&Object.keys(args).length===0&&!Array.isArray(args))continue;const f=connected();await assert.rejects(f.create().execute(JSON.stringify({operation:op,arguments:args}),'synthetic'),/INVALID_ARGUMENTS/);assert.deepEqual(f.calls,[]);}
});
test('handler admits only own inert fields and never invokes hostile accessors/proxies',async()=>{
 const f=connected(),call=await directCall(f);let effects=0;
 for(const bad of [new Proxy(call,{ownKeys(){effects++;throw Error('trap');}}),Object.defineProperty({...call},'input',{enumerable:true,get(){effects++;return {};}}),{...call,extra:true},Object.assign(Object.create({x:true}),call),{...call,[Symbol('x')]:1}])await assert.rejects(f.handler(bad),/INVALID_ARGUMENTS/);
 for(const field of ['input','request','authority']){const bad={...call,[field]:new Proxy(call[field],{ownKeys(){effects++;throw Error('trap');}})};await assert.rejects(f.handler(bad));}
 assert.equal(effects,0);
});
test('direct handler checks binding, policy, digest and fresh deadlines',async()=>{
 const f=connected(),call=await directCall(f);
 for(const change of [x=>x.argumentsSha256='f'.repeat(64),x=>x.input={q:'x'},x=>x.request={q:'x'},x=>x.authority.binding.writerFence=2,x=>x.authority.subject.actorId='other',x=>x.authority.policyRevision='changed',x=>x.authority.claims.expiresAt=new Date(NOW).toISOString(),x=>x.authority.claims.issuedAt=new Date(NOW+1).toISOString(),x=>x.authority.deadlineMs=NOW]){const bad=structuredClone({...call,signal:undefined});delete bad.signal;change(bad);await assert.rejects(f.handler(bad));}
});
test('handler checks abort after registry projection and returns detached raw JSON',async()=>{
 const f=connected(),call=await directCall(f),controller=new AbortController();let n=0;
 const handler=createDatasetMetadataHandler({registry,now:()=>{if(++n===2)controller.abort();return NOW;}});
 await assert.rejects(handler({...call,signal:controller.signal}),/CANCELLED/);
 const out=JSON.parse(await f.handler(call));out.result.datasets[0].fields[0].name='mutated';assert.notEqual(registry.listDatasetMetadata()[0].fields[0].name,'mutated');
});
test('expired grant stale fence missing grants and source denial block before reserve',async()=>{
 for(const mode of ['expired','fence','grants','source']){const f=connected();if(mode==='expired')f.claims.expiresAt=new Date(NOW).toISOString();if(mode==='fence')f.state.fence++;if(mode==='grants')f.state.grants=[];if(mode==='source')f.state.sourceEnabled=false;await assert.rejects(f.create().execute(request,'synthetic'),/ACCESS_DENIED/);assert.equal(f.calls.includes('reserve'),false);assert.equal(f.calls.includes('handler'),false);}
});
test('malformed reservation and settlement acknowledgments retain uncertainty',async()=>{
 for(const stage of ['reserve','settle']){const f=connected();f.budget[stage]=async()=>{f.calls.push(stage);return '{}';};await assert.rejects(f.create().execute(request,'synthetic'),/BUDGET_UNCERTAIN/);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);assert.equal(f.calls.includes('handler'),stage==='settle');}
});
test('revoke during reservation prevents handler and retains uncertain hold',async()=>{
 const f=connected(),reserve=f.budget.reserve;f.budget.reserve=async c=>{const out=await reserve(c);f.state.revoked=true;return out;};await assert.rejects(f.create().execute(request,'synthetic'),/ACCESS_DENIED/);assert.equal(f.calls.includes('handler'),false);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
});
test('envelope substitutions reject before settlement through canonical dispatch',async()=>{
 for(const change of [x=>x.binding.runId=uuid('9'),x=>x.binding.workerId=uuid('9'),x=>x.binding.writerFence=2,x=>x.subject.authorizationDecisionId=uuid('9'),x=>x.subject.entityIds=['foreign'],x=>x.operation={id:'query_tasks',version:'0.2.0'},x=>x.argumentsSha256='f'.repeat(64),x=>x.extra=true,x=>delete x.subject]){const f=connected(),run=f.entry.execute;f.entry.execute=async c=>{const out=JSON.parse(await run(c));change(out);return JSON.stringify(out);};await assert.rejects(f.create().execute(request,'synthetic'),/INVALID_RESULT/);assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);}
});
test('canonical raw family validator rejects duplicate metadata aggregate lies and freshness flags',async()=>{
 for(const change of [x=>x.result.datasets.push(x.result.datasets[0]),x=>x.result.datasets[0].fields.push(x.result.datasets[0].fields[0]),x=>x.result.datasets[0].fields[0].aggregatable=!x.result.datasets[0].fields[0].aggregatable,x=>x.result.sourceFresh=true,x=>x.result.tool='query_global_data',x=>x.result.generatedAt='2026-10-12']){const f=connected(),run=f.entry.execute;f.entry.execute=async c=>{const out=JSON.parse(await run(c));change(out);return JSON.stringify(out);};await assert.rejects(f.create().execute(request,'synthetic'),/INVALID_RESULT/);assert.equal(f.calls.includes('settle'),false);}
});
test('revocation during handler or settled accounting cannot release result',async()=>{
 for(const stage of ['handler','settle']){const f=connected();if(stage==='handler'){const run=f.entry.execute;f.entry.execute=async c=>{const r=await run(c);f.state.revoked=true;return r;};}else{const settle=f.budget.settle;f.budget.settle=async c=>{const r=await settle(c);f.state.revoked=true;return r;};}await assert.rejects(f.create().execute(request,'synthetic'),/ACCESS_DENIED/);assert.equal(f.calls.includes('uncertain'),stage==='handler');}
});
test('subject drift at release prevents settlement even though registry is public metadata',async()=>{
 const f=connected(),run=f.entry.execute;f.entry.execute=async c=>{const r=await run(c);f.subject.entityIds=['other'];return r;};await assert.rejects(f.create().execute(request,'synthetic'),/ACCESS_DENIED/);assert.equal(f.calls.includes('settle'),false);
});
test('cancelled parked handler and settlement never continue to later authority ports',async()=>{
 for(const stage of ['handler','settle']){const f=connected(),controller=new AbortController();let enter,release;const entered=new Promise(r=>enter=r);
 if(stage==='handler'){const run=f.entry.execute;f.entry.execute=async c=>{const r=await run(c);return new Promise(resolve=>{release=()=>resolve(r);enter();});};}else f.budget.settle=call=>new Promise(resolve=>{f.calls.push('settle');release=()=>resolve(JSON.stringify({reservationId:call.reservationId,decision:'settled'}));enter();});
 const result=f.create().execute(request,'synthetic',controller.signal);await entered;controller.abort();await assert.rejects(result,/CANCELLED/);const calls=[...f.calls];release();await tick();assert.deepEqual(f.calls,calls);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);}
});
test('freshly shortened release deadline bounds parked settlement no late release',async()=>{
 const f=connected(),run=f.entry.execute;let release;f.entry.execute=async c=>{const r=await run(c);f.state.deadline=NOW+20;return r;};f.budget.settle=call=>new Promise(resolve=>{f.calls.push('settle');release=()=>resolve(JSON.stringify({reservationId:call.reservationId,decision:'settled'}));});
 await assert.rejects(f.create().execute(request,'synthetic'),/DEADLINE/);const calls=[...f.calls];release();await tick();assert.deepEqual(f.calls,calls);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
});
test('handler construction is own-data only and no clock effects until call',()=>{
 let effects=0;assert.throws(()=>createDatasetMetadataHandler(Object.defineProperty({now:()=>NOW},'registry',{enumerable:true,get(){effects++;return registry;}})),/GATEWAY_CONFIGURATION/);
 createDatasetMetadataHandler({registry,now:()=>{effects++;return NOW;}});assert.equal(effects,0);
});
