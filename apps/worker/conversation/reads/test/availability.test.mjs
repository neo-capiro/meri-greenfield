/** Pure gate, snapshot, schema and P8 policy checks for general reads. Synthetic inputs over the real catalog/contracts. */
import test from 'node:test';import assert from 'node:assert/strict';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {resolveAvailableReads,familyReads,DEFERRED_ORIGINALS} from '../availability.mjs';
import {assertAvailabilitySnapshot} from '../snapshot.mjs';
import {canonicalInputSchema,isNarrowerOrEqual,advertisedArguments} from '../schema.mjs';
import {effectiveReadBudgets,createReadLedger,GENERAL_READ_CEILINGS} from '../budget.mjs';
import {failureCode,failureResult,READ_FAILURE_CODES} from '../results.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {resolveCapabilityPolicy,intersectCapabilityPolicies} from '../../capabilities/policy-resolution.mjs';
const MAIL=['mail.list_messages','mail.search_messages','mail.read_thread'].map(id=>({id,version:'0.2.0'}));
const ids=r=>r.available.map(row=>row.operation.id).sort();
const MAIL_FAMILIES={mail:{clientScope:'optional'}};
const open={families:MAIL_FAMILIES,policy:assertCapabilityPolicy({generalReads:true}),installation:{operations:MAIL},discovery:{operations:MAIL},scopes:[{kind:'mailbox'}]};

test('all six gates open: exactly the wired mail family, in catalog order, read-only descriptors only',()=>{
 const r=resolveAvailableReads(open);assert.deepEqual(ids(r),MAIL.map(o=>o.id).sort());assert.deepEqual(r.unavailable,[]);
 for(const row of r.available){assert.equal(row.descriptor.sideEffect,'none');assert.equal(row.descriptor.approvalBoundary,'none');assert.equal(resolveOperationContract(row.operation).binding.group,'mail');}
 assert.deepEqual(familyReads(MAIL_FAMILIES).map(row=>row.operation),catalog.operations.filter(d=>resolveOperationContract(d.operation).binding?.group==='mail').map(d=>d.operation));
});

test('each gate alone excludes: installation, policy, family list, discovery grant, client scope',()=>{
 assert.deepEqual(ids(resolveAvailableReads({...open,installation:{operations:[]}})),[],'no installation receipt rows: nothing');
 assert.deepEqual(ids(resolveAvailableReads({...open,policy:assertCapabilityPolicy({})})),[],'policy off');
 assert.deepEqual(ids(resolveAvailableReads({...open,policy:assertCapabilityPolicy({readFamilies:[]})})),[]);
 assert.deepEqual(ids(resolveAvailableReads({...open,policy:{generalReads:true,readFamilies:[]}})),[],'an unvalidated empty family list still admits nothing');
 const lacking=resolveAvailableReads({...open,discovery:{operations:[MAIL[0]]}});assert.deepEqual(ids(lacking),['mail.list_messages']);assert.equal(lacking.unavailable.length,2,'unavailable reads are named by display name only');
 const required={mail:{clientScope:'required'}};
 assert.deepEqual(ids(resolveAvailableReads({...open,families:required})),[],'synthetic client-required family without an authorized client scope');
 assert.deepEqual(ids(resolveAvailableReads({...open,families:required,scopes:[{kind:'mailbox'},{kind:'client'}]})).length,3);
 assert.deepEqual(ids(resolveAvailableReads({...open,narrowTo:[MAIL[1]]})),['mail.search_messages'],'a selected skill narrows');
 const excluded=resolveAvailableReads({...open,exclude:[MAIL[1],MAIL[2]]});assert.deepEqual(ids(excluded),['mail.list_messages']);assert.equal(excluded.unavailable.length,0,'reads another server exposes are not reported unavailable');
});

test('the deferred list is the owner\'s 43 catalog originals and none can be constructed',()=>{
 assert.equal(DEFERRED_ORIGINALS.length,43);
 const universe=familyReads({mail:{clientScope:'optional'},...Object.fromEntries(catalog.operations.map(d=>[resolveOperationContract(d.operation).binding?.group,{clientScope:'optional'}]))});
 for(const row of universe){assert.equal(DEFERRED_ORIGINALS.includes(row.operation.id),false);assert.equal(DEFERRED_ORIGINALS.includes(row.operation.id.replaceAll('.','_')),false);}
});

test('the availability snapshot refuses foreign, stale, expired, duplicated or substituted facts',()=>{
 const binding={tenantId:'t',actorId:'a',conversationId:'71000000-0000-4000-8000-000000000001',runId:'71000000-0000-4000-8000-000000000002',attemptId:'71000000-0000-4000-8000-000000000003',workerId:'71000000-0000-4000-8000-000000000004',writerFence:1};
 const at=1000,expected={binding,policyRevision:'p'.repeat(64),catalogSha256:canonicalSha256(catalog),now:()=>at};
 const good=()=>({installation:{installationId:'71000000-0000-4000-8000-000000000080',baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations:[...MAIL],checkedAtMs:at,expiresAtMs:at+1},
  discovery:{binding,policyRevision:'p'.repeat(64),operations:[...MAIL],checkedAtMs:at,expiresAtMs:at+5}});
 assert.equal(assertAvailabilitySnapshot(good(),expected).expiresAtMs,at+1);
 for(const change of [s=>{s.discovery.binding={...binding,writerFence:2};},s=>{s.discovery.policyRevision='q'.repeat(64);},s=>{s.installation.baseCatalogSha256='0'.repeat(64);},s=>{s.installation.expiresAtMs=at;},s=>{s.discovery.checkedAtMs=at+1;},
  s=>{s.installation.operations=[MAIL[0],MAIL[0]];},s=>{s.discovery.operations=[{id:'mail.read_thread'}];},s=>{s.installation.installationId='x';},s=>{s.extra=1;},s=>{s.discovery.role='admin';}]){
  const s=good();change(s);assert.throws(()=>assertAvailabilitySnapshot(s,expected),/READ_AVAILABILITY_REFUSED/,String(change));}
});

test('advertised schemas: canonical only when provably no wider; a hash mismatch is a configuration failure',()=>{
 for(const op of MAIL){const d=resolveOperationContract(op).descriptor,a=advertisedArguments(d.inputSchema);assert.equal(a.mode,'canonical',op.id);}
 assert.throws(()=>canonicalInputSchema({id:'urn:meri:retrieval:mail:0.2.0#/$defs/MailListInput',sha256:'0'.repeat(64)}),/READ_SCHEMA_CONFIGURATION/);
 assert.throws(()=>canonicalInputSchema({id:'urn:meri:artifacts:0.2.0#/$defs/WordRequest',sha256:'0'.repeat(64)}),/READ_SCHEMA_CONFIGURATION/);
 const c=canonicalInputSchema(resolveOperationContract(MAIL[1]).descriptor.inputSchema);assert.equal(JSON.stringify(c).includes('$ref'),false);assert.equal(JSON.stringify(c).includes('"default"'),false);
 assert.equal(isNarrowerOrEqual(structuredClone(c),c),true);
 const wider=[x=>{delete x.properties.query.maxLength;},x=>{x.additionalProperties=true;},x=>{x.required=[];},x=>{x.properties.limit.maximum=51;},x=>{x.properties.extra={type:'string'};},x=>{x.properties.subject.oneOf.pop();x.properties.subject.oneOf.push({type:'object'});},x=>{x.properties.folder.enum.push('drafts');},x=>{delete x.properties.asOf.format;}];
 for(const change of wider){const a=structuredClone(c);change(a);assert.equal(isNarrowerOrEqual(a,c),false,String(change));}
 const narrower=structuredClone(c);narrower.properties.limit.maximum=10;narrower.properties.query.pattern='^[a-z ]*$';assert.equal(isNarrowerOrEqual(narrower,c),true);
 assert.equal(isNarrowerOrEqual({type:'object'},{type:'object',unevaluatedProperties:false}),false,'an unrecognised canonical keyword is never assumed satisfied');
});

test('P3 local budgets are upper bounds that a skill can only narrow; the ledger refuses past them',()=>{
 assert.deepEqual(effectiveReadBudgets(undefined),GENERAL_READ_CEILINGS);
 assert.deepEqual(effectiveReadBudgets({maxToolCalls:99,maxOutputBytes:9e9}),{maxToolCalls:20,maxOutputBytes:1048576,maxReadBytes:2097152,maxRecoveryAttempts:0});
 // D016-A 3: a run configured above the default keeps its own cap; a skill still narrows it.
 assert.equal(effectiveReadBudgets(undefined,{maxToolCalls:40}).maxToolCalls,40);assert.equal(effectiveReadBudgets({maxToolCalls:99,maxOutputBytes:4},{maxToolCalls:40}).maxToolCalls,40);
 assert.equal(effectiveReadBudgets({maxToolCalls:3,maxOutputBytes:4},{maxToolCalls:40}).maxToolCalls,3);assert.throws(()=>effectiveReadBudgets(undefined,{maxToolCalls:0}),/READ_CONFIGURATION/);
 const l=createReadLedger(effectiveReadBudgets({maxToolCalls:1,maxOutputBytes:4}));l.admit();assert.throws(()=>l.admit(),/RESOURCE_LIMIT/);
 l.account('1234');assert.throws(()=>l.account('12345'),/RESOURCE_LIMIT/);l.account('1234');assert.throws(()=>l.account('1'),/RESOURCE_LIMIT/,'aggregate read bytes');
});

test('every gateway code renders its own closed text; unknown failures are INTERNAL_ERROR',()=>{
 const texts=READ_FAILURE_CODES.map(code=>failureResult(code,'mcp__meri_reads__x').content[0].text);assert.equal(new Set(texts).size,READ_FAILURE_CODES.length);
 for(const [i,code] of READ_FAILURE_CODES.entries()){assert.ok(texts[i].startsWith(`${code}: mcp__meri_reads__x `));assert.equal(failureResult(code,'t').isError,true);}
 assert.deepEqual(READ_FAILURE_CODES.slice().sort(),['ACCESS_DENIED','BUDGET_UNCERTAIN','CANCELLED','DEADLINE','GATEWAY_CONFIGURATION','INTERNAL_ERROR','INVALID_ARGUMENTS','INVALID_RESULT','RESOURCE_LIMIT','UNAVAILABLE']);
 assert.equal(failureCode(Object.assign(Error('x'),{code:'DEADLINE'})),'DEADLINE');assert.equal(failureCode(Error('ACCESS_DENIED')),'ACCESS_DENIED');assert.equal(failureCode(Error('PRIVATE detail')),'INTERNAL_ERROR');assert.equal(failureCode(null),'INTERNAL_ERROR');
});

test('P8 fields resolve platform Ã¢Ë†Â§ tenant Ã¢Ë†Â§ role: flags AND, families intersect, widening refused',()=>{
 const platform={maximum:{generalReads:true,readFamilies:['mail']},defaults:{readFamilies:['mail']},roleCeilings:{admin:{generalReads:true,readFamilies:['mail']},viewer:{generalReads:true,readFamilies:['mail']}}};
 assert.equal(resolveCapabilityPolicy({platform,role:'admin'}).generalReads,false,'default off');
 assert.equal(resolveCapabilityPolicy({platform,tenant:{capabilities:{generalReads:true}},role:'admin'}).generalReads,true);
 const viewer=resolveCapabilityPolicy({platform,tenant:{capabilities:{generalReads:true},roles:{viewer:{readFamilies:[]}}},role:'viewer'});assert.deepEqual([viewer.generalReads,viewer.readFamilies],[false,[]],'a tenant narrowing the role to no family switches general reads off');
 assert.throws(()=>resolveCapabilityPolicy({platform:{...platform,maximum:{}},tenant:{capabilities:{generalReads:true}},role:'admin'}),e=>e.code==='CAPABILITY_PLATFORM_LIMITS_REFUSED'||e.code==='CAPABILITY_TENANT_WIDENING_REFUSED');
 assert.throws(()=>resolveCapabilityPolicy({platform:{...platform,maximum:{generalReads:false},roleCeilings:{admin:{}}},tenant:{capabilities:{generalReads:true}},role:'admin'}),e=>e.code==='CAPABILITY_TENANT_WIDENING_REFUSED'&&e.field==='generalReads');
 assert.deepEqual(intersectCapabilityPolicies(assertCapabilityPolicy({generalReads:true}),assertCapabilityPolicy({readFamilies:[]})),assertCapabilityPolicy({readFamilies:[]}));
});
