/** Production trusted fact producer; native compiler/config parser/model authority replaced with explicit synthetic ports. */
import {mock,test} from 'node:test';import assert from 'node:assert/strict';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
const root=new URL('../../../',import.meta.url),url=p=>new URL(p,root).href;
let parsed=0,modelCalls=0;
const readOps=['runner/reads/availability','runner/reads/execute'];
mock.module(url('apps/runtime/prepared-candidate-config.mjs'),{namedExports:{compilePreparedCandidateConfiguration:v=>structuredClone(v)}});
mock.module(url('apps/runtime/prepared-run-issuance.mjs'),{namedExports:{createPreparedRunIssuance:()=>({prepare:async()=>{throw Error('SYNTHETIC_COMPILER_UNRUN');}})}});
mock.module(url('apps/gateway/budget/native-allocation-admission.mjs'),{namedExports:{createNativeAllocationAdmission:()=>{throw Error('SYNTHETIC_ADMISSION_UNRUN');}}});
mock.module(url('apps/gateway/budget/tool-budget-binding.mjs'),{namedExports:{allocation:JSON.parse}});
mock.module(url('packages/contracts/runtime-0.2/reads.mjs'),{namedExports:{nativeReadOperations:readOps,assertNativeReadConfiguration:v=>{parsed++;return structuredClone(v);}}});
mock.module(url('apps/runtime/run-model-grant.mjs'),{namedExports:{issueRunModelGrant:async()=>{modelCalls++;return {proxyCredential:'fixed-synthetic-model',grantIntent:{grantId:'model-grant'}};}}});
const {createPreparedRunBindings}=await import('../prepared-run-bindings.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at=1900000000000;
function fixture(){
 const binding={tenantId:'synthetic',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[{group:'synthetic-read',operation:'get',version:'1'}],maxExecuteMs:1000,maxRequestBytes:2048,maxResponseBytes:4096};
 const config={multiRun:{runWindowMs:60000},runtime:{binding,deadlineMs:at+30000,versions:{synthetic:'1'}},qualification:{policyRevision:'p'},allocationJson:JSON.stringify({run:binding,schedule:{expiresAt:new Date(at+600000).toISOString()}}),operations:['runner/control/status',...readOps],approvedReads,plan:{fixed:true},preparationIntent:{fixed:true},taskRequest:{fixed:true},containerName:'synthetic',taskOrigin:'https://synthetic.invalid',taskHttp:{hostname:'127.0.0.1',port:9000,frontendOrigin:'https://synthetic.invalid'}};
 const state={saved:{run:{binding,versions:config.runtime.versions,policyRevision:'p'},request:{prompt:'actual accepted synthetic request'}}};
 const options={configuration:{nativeCandidate:config,versions:config.runtime.versions},pool:{connect:()=>{throw Error('NO_DB');}},store:{readOptional:async()=>structuredClone(state.saved),allocations:{read:async()=>null}},credentials:{control:'fixed-synthetic-control'},issuanceStore:createMemoryIssuanceStore(),capabilityAuthority:{generate:()=>{throw Error('NO_MATERIAL');},retrieve:()=>{throw Error('NO_MATERIAL');},status:()=>{throw Error('NO_MATERIAL');}},modelGrants:{issue:()=>{throw Error('SYNTHETIC_MODEL_STUB');}},now:()=>at};
 const intent={binding,requestSha256:hash(state.saved.request),expiresAtMs:config.runtime.deadlineMs},issuance={grantId:id(8),capabilitySha256:'a'.repeat(64)};
 return {state,config,options,intent,issuance};
}
test('complete approved READS configuration and both operations reach trusted facts once without an original expiry window',async()=>{const f=fixture(),before=parsed,ports=createPreparedRunBindings(f.options),facts=await ports.facts.compile({intent:f.intent,issuance:f.issuance});assert.deepEqual(facts.approvedReads,f.config.approvedReads);assert.equal(parsed,before+1);assert.deepEqual(facts.operations,['runner/control/status',...readOps]);assert.equal(facts.runtime.deadlineMs,f.config.runtime.deadlineMs);assert.equal(typeof ports.prepareOriginal,'function');});
test('disabled approved READS is preserved completely rather than stripped from immutable facts',async()=>{const f=fixture();f.config.approvedReads.enabled=false;const facts=await createPreparedRunBindings(f.options).facts.compile({intent:f.intent,issuance:f.issuance});assert.deepEqual(facts.approvedReads,f.config.approvedReads);assert.ok(readOps.every(op=>facts.operations.includes(op)));});
test('READS request hash and current run binding/version/policy are checked before model issuance',async()=>{for(const edit of [f=>f.intent.requestSha256='b'.repeat(64),f=>f.state.saved=null,f=>f.state.saved.run.binding={...f.intent.binding,runId:id(99)},f=>f.state.saved.run.versions={synthetic:'2'},f=>f.state.saved.run.policyRevision='other']){const f=fixture();edit(f);const before=modelCalls;await assert.rejects(createPreparedRunBindings(f.options).facts.compile({intent:f.intent,issuance:f.issuance}));assert.equal(modelCalls,before);}});
test('legacy configuration without approved READS retains existing operations and output shape',async()=>{const f=fixture();delete f.config.approvedReads;f.config.operations=['runner/control/status'];const before=parsed,facts=await createPreparedRunBindings(f.options).facts.compile({intent:f.intent,issuance:f.issuance});assert.equal(parsed,before);assert.deepEqual(facts.operations,f.config.operations);assert.equal(Object.hasOwn(facts,'approvedReads'),false);});
