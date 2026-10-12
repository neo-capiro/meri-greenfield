import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {freezeCorpus,runnerCases} from '../corpus.mjs';
import {scoreObservations} from '../score.mjs';

// Independent synthetic cases. No customer data, approval or runtime proof exists.
const id=n=>`deafbeef-1111-4111-8111-${String(n).padStart(12,'0')}`;
const at='2026-10-12T00:00:00.000Z';
const digest=x=>hash({independentSynthetic:x});
const binding=()=>({tenantId:'synthetic-tenant',actorId:'synthetic-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1});
const scope=()=>({tenantId:'synthetic-tenant',kind:'client',resourceId:id(5),policyRevision:'synthetic-policy'});
const record=(caseId='case-a',groupId='group-a',split='development')=>({
 caseId,groupId,split,kind:'synthetic',originSha256:digest(caseId),mode:'original',prompt:'Synthetic request: show selected client recommendations.',
 request:{clientId:id(5)},context:{binding:binding(),clientResolution:{reference:id(5),clientId:id(5)}},scopes:[scope()],sourceIds:['action_recommendation'],
 expected:{outcome:'denied',resultSha256:null,recordIds:[],absence:false,exhaustive:false}
});
function corpus(cases=[record()]) {
 const value={schema:'meri-task-lookup-input/1',cases,sources:[{sourceId:'action_recommendation',snapshotSha256:digest('snapshot'),asOf:at,receiptSha256:digest('source-receipt')}],
 config:{sourceCommit:'a'.repeat(40),catalogSha256:digest('catalog'),contractsSha256:digest('contracts'),imageDigest:null,sdkVersion:null,modelId:null,proxyConfigSha256:digest('proxy'),skillManifestSha256:digest('skills'),executionKind:'source-test'},
 approval:{receiptId:id(10),ownerRef:'synthetic-owner-no-authority',issuedAt:at,inputSha256:''}};
 value.approval.inputSha256=hash({cases:value.cases,sources:value.sources,config:value.config});
 return value;
}
const freeze=value=>freezeCorpus(value,{approvalSha256:hash(value.approval)});
const reseal=value=>{value.approval.inputSha256=hash({cases:value.cases,sources:value.sources,config:value.config});return value;};

test('independent approved-input shape freezes synthetic corpus without modifying input',()=>{const value=corpus(),before=structuredClone(value);const f=freeze(value);assert.deepEqual(value,before);assert.ok(Object.isFrozen(f));assert.notEqual(f,value);});
test('wrong externally pinned approval hash refuses',()=>assert.throws(()=>freezeCorpus(corpus(),{approvalSha256:digest('wrong')})));
test('case/source/config substitutions after approval refuse',()=>{for(const mutate of [v=>v.cases[0].prompt+=' altered',v=>v.sources[0].snapshotSha256=digest('other'),v=>v.config.catalogSha256=digest('other')]){const v=corpus();mutate(v);assert.throws(()=>freeze(v));}});
test('changing synthetic to real without changing approval refuses',()=>{const v=corpus();v.cases[0].kind='real';assert.throws(()=>freeze(v));});
test('duplicate case IDs refuse instead of reducing denominator',()=>assert.throws(()=>freeze(corpus([record(),record()]))));
test('one related group across two splits refuses',()=>assert.throws(()=>freeze(corpus([record('a','related','development'),record('b','related','held-out')]))));
test('related oracle variants may remain in same split without losing cases',()=>{const a=record('a','related'),b=record('b','related');b.mode='correct-tool';assert.equal(runnerCases(freeze(corpus([a,b])),{split:'development'}).cases.length,2);});
test('runner projection retains prompt/request but withholds expected gold',()=>{const f=freeze(corpus()),rows=runnerCases(f,{split:'development'}).cases;assert.equal(rows.length,1);assert.equal(rows[0].prompt,record().prompt);assert.deepEqual(rows[0].request,record().request);assert.ok(!('expected' in rows[0]));assert.ok(!('approval' in rows[0]));assert.ok(!JSON.stringify(rows).includes('resultSha256'));});
test('held-out projection is split-specific and omits gold',()=>{const f=freeze(corpus([record('a','a'),record('b','b','held-out')]));const rows=runnerCases(f,{split:'held-out'}).cases;assert.equal(rows.length,1);assert.equal(rows[0].caseId,'b');assert.ok(!('expected' in rows[0]));});
test('unknown split cannot silently select or omit cases',()=>assert.throws(()=>runnerCases(freeze(corpus()),{split:'training'})));
test('freeze detaches caller references',()=>{const v=corpus(),f=freeze(v);v.cases[0].request.clientId=id(99);v.cases[0].prompt='changed';const [row]=runnerCases(f,{split:'development'}).cases;assert.equal(row.request.clientId,id(5));assert.equal(row.prompt,record().prompt);});
test('freeze refuses unknown schema/input authority flags',()=>{for(const mutate of [v=>v.schema='forged',v=>v.authorized=true,v=>v.cases[0].authorized=true]){const v=corpus();mutate(v);assert.throws(()=>freeze(reseal(v)));}});
test('hostile accessors never execute during freeze',()=>{let effects=0;const v=corpus();Object.defineProperty(v.cases[0],'prompt',{get(){effects++;return 'surprise';},enumerable:true});assert.throws(()=>freezeCorpus(v,{approvalSha256:digest('untrusted')}));assert.equal(effects,0);});
test('non-JSON scalar and unsafe case counts cannot produce frozen evidence',()=>{for(const bad of [undefined,NaN,Infinity,1n,()=>1]){const v=corpus();v.cases[0].prompt=bad;assert.throws(()=>freezeCorpus(v,{approvalSha256:digest('untrusted')}));}});
test('case referencing absent source cannot be admitted as covered',()=>{const v=corpus();v.cases[0].sourceIds=['not-in-snapshot'];assert.throws(()=>freeze(reseal(v)));});
test('duplicate source snapshot IDs refuse instead of selecting arbitrary version',()=>{const v=corpus();v.sources.push({...v.sources[0],snapshotSha256:digest('second')});assert.throws(()=>freeze(reseal(v)));});

test('empty corpus remains unqualified with no fabricated real request count',()=>{const f=freeze(corpus([]));assert.deepEqual(f.counts,{cases:0,declaredRealCases:0,declaredRealSeeds:0,syntheticCases:0,qualifiedRealRequests:0});assert.equal(f.qualification.state,'UNQUALIFIED');assert.equal(f.qualification.runtimeQualified,false);});
test('even operator-pinned real label cannot manufacture qualified provenance',()=>{const c=record();c.kind='real';const f=freeze(corpus([c]));assert.equal(f.counts.declaredRealCases,1);assert.equal(f.counts.qualifiedRealRequests,0);assert.equal(f.qualification.state,'UNQUALIFIED');});
test('runner envelope pins source/config/case identities without approval body',()=>{const f=freeze(corpus()),r=runnerCases(f,{split:'development'});assert.equal(r.corpusSha256,f.corpusSha256);assert.equal(r.configSha256,f.configSha256);assert.equal(r.cases[0].caseSha256,f.casePins[0].caseSha256);assert.equal(r.cases[0].sourceSetSha256,f.casePins[0].sourceSetSha256);assert.ok(!('approval' in r));assert.ok(!('kind' in r.cases[0]));assert.ok(!('originSha256' in r.cases[0]));});
