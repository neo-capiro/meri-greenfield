// Independent synthetic probes authored before the registry candidate freeze.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveOperationContract,assertCatalog} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS} from '../../../../../packages/contracts/retrieval-0.2/catalog-validation.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createSourceDisabledGateway} from '../../../../../apps/gateway/index.mjs';
import {fixture,NOW,uuid,limits} from '../../../../../apps/gateway/test/fixtures.mjs';
const reference={id:'memory.list_own_proposals',version:'0.2.0'};
const resolve=()=>resolveOperationContract(reference);
const tenant=uuid('1'),actor=uuid('2'),client=uuid('3'),other=uuid('4'),id=uuid('9'),older=uuid('8');
const subject=(selected=null)=>({tenantId:tenant,actorId:actor,kind:selected?'client':'personal',entityType:selected?'client':'user',entityIds:[selected??actor],rosterVersionId:null,policyRevision:'review-policy',authorizationDecisionId:other,scopes:[{tenantId:tenant,kind:selected?'client':'private-user',resourceId:selected??actor,policyRevision:'review-policy'}]});
const row=(changes={})=>({id,status:'pending',approvedFact:false,scope:'personal',clientId:null,sourceKind:'explicit_user',createdAt:'2026-01-02T00:00:00.000Z',restricted:false,title:'Synthetic proposal',proposedText:'Not an approved fact',contentTruncated:false,...changes});
const page=(changes={})=>({tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,scope:{tenantId:tenant,userId:actor,clientId:null},candidates:[row()],nextCursor:null,coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'},...changes});
const partial=(changes={})=>page({coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'},...changes});
const catalog=()=>JSON.parse(readFileSync(new URL('../../../../../packages/contracts/retrieval-0.2/catalog.json',import.meta.url)));
const baseline=JSON.parse(readFileSync(new URL('./baseline-descriptors.json',import.meta.url)));

test('one canonical fourteen-operation registry preserves old descriptors and139/96/43 scope',()=>{
 const c=catalog();assertCatalog(c);assert.equal(CATALOG_OPERATION_BINDINGS.length,14);assert.equal(c.operations.length,14);
 assert.equal(new Set(CATALOG_OPERATION_BINDINGS.map(x=>x.id)).size,14);
 for(const old of baseline.operations)assert.deepEqual(c.operations.find(x=>x.operation.id===old.operation.id),old);
 assert.deepEqual(c.originals.map(({id,disposition,boundary})=>({id,disposition,boundary})),baseline.originals.map(({id,disposition,boundary})=>({id,disposition,boundary})));
 assert.equal(c.originals.length,139);assert.equal(c.originals.filter(x=>x.disposition==='selected').length,96);
 assert.equal(c.originals.filter(x=>x.disposition==='deferred').length,43);assert.equal(c.originals.filter(x=>x.disposition==='selected'&&x.replacement===null).length,82);
 const mapped=c.originals.find(x=>x.id==='list_memory_proposals');assert.equal(mapped.state,'mapped');assert.deepEqual(mapped.replacement,reference);
 for(const name of ['search_memory','save_memory'])assert.equal(c.originals.find(x=>x.id===name).replacement,null);
});
test('new descriptor pins the existing raw private schema, no executable or approval authority',()=>{
 const c=resolve();const raw=readFileSync(new URL('../../../../../packages/contracts/retrieval-0.2/memory-proposals.schema.json',import.meta.url));
 const schema=JSON.parse(raw),sha256=createHash('sha256').update(raw).digest('hex');
 assert.deepEqual(c.descriptor.inputSchema,{id:schema.$id+'#/$defs/MemoryProposalInput',sha256});
 assert.deepEqual(c.descriptor.outputSchema,{id:schema.$id+'#/$defs/MemoryProposalReadResult',sha256});
 assert.equal(c.descriptor.sideEffect,'none');assert.equal(c.descriptor.approvalBoundary,'none');
 for(const op of catalog().operations){assert.equal(op.handler,null);assert.equal(op.availability,'unimplemented');assert.equal(op.qualification,'pending');assert.equal(op.retry.maxRetries,0);assert.deepEqual(op.retry.retryableCodes,[]);}
});
test('old13 context grammar refuses memory subject/previous keys on input and output',()=>{
 for(const old of baseline.operations){const c=resolveOperationContract(old.operation);
  for(const extra of [{subject:subject()},{previous:{request:{},page:page()}}]){
   assert.throws(()=>c.normalizeInput({},extra),/context/i);
   assert.throws(()=>c.assertOutput({},{request:{},...extra}),/context/i);
  }
 }
 const old=resolveOperationContract({id:'search_federal_contract_awards',version:'0.2.0'});
 assert.equal(old.normalizeInput({}, {nowMs:1,actorId:'synthetic',previousPage:null}).input.limit,10);
});
test('memory uses only subject/previous context and refuses missing/model-supplied authority',()=>{
 const c=resolve();assert.throws(()=>c.normalizeInput({}));
 for(const extra of [{actorId:actor},{nowMs:1},{previousPage:null},{tenantId:tenant},{request:{}}])assert.throws(()=>c.normalizeInput({}, {subject:subject(),...extra}),/context/i);
 for(const key of ['subject','tenantId','actorId','userId','policyRevision','previous','evidenceReady'])assert.throws(()=>c.normalizeInput({[key]:key==='subject'?subject():'spoof'},{subject:subject()}));
 assert.throws(()=>c.normalizeInput({clientId:client},{subject:subject()}));assert.throws(()=>c.normalizeInput({clientId:other},{subject:subject(client)}));
 assert.throws(()=>c.assertOutput(page(),{subject:subject()}),/request/i);
});
test('normalization snapshots caller data, binds server selection, and hashes materialized defaults',()=>{
 const request={clientId:null,limit:null},ctx={subject:subject(client)},c=resolve();const prepared=c.normalizeInput(request,ctx);
 assert.deepEqual(prepared.input,{clientId:client,cursor:null,limit:5});assert.deepEqual(prepared.request,{clientId:null,limit:null});
 assert.equal(prepared.argumentsSha256,canonicalSha256(prepared.input));assert.notEqual(prepared.argumentsSha256,canonicalSha256(prepared.request));
 request.clientId=other;ctx.subject.entityIds[0]=other;
 assert.equal(prepared.input.clientId,client);assert.equal(prepared.request.clientId,null);
 assert.ok(Object.isFrozen(prepared));assert.ok(Object.isFrozen(prepared.request));assert.ok(Object.isFrozen(prepared.input));
 assert.throws(()=>{prepared.input.limit=10;});
});
test('classification can never imply approved facts, evidence readiness or global absence',()=>{
 const c=resolve();const check=p=>c.assertOutput(p,{request:{},subject:subject()});
 assert.deepEqual(check(page()),{kind:'complete',claimsAreApprovedFacts:false,evidenceReady:false,negativeAssertion:'none'});
 assert.equal(check(page({candidates:[]})).kind,'empty');
 assert.equal(check(page({enabled:false,candidates:[],coverage:{firstPage:true,complete:false,reason:'review_disabled'}})).kind,'unavailable');
 for(const candidate of [row({restricted:true,title:null,proposedText:null}),row({proposedText:null}),row({contentTruncated:true})])assert.equal(check(partial({candidates:[candidate]})).kind,'partial');
 for(const changes of [{claimsAreApprovedFacts:true},{evidenceReady:true},{negativeAssertion:'none'},{candidates:[row({approvedFact:true})]},{candidates:[row({restricted:true})]}])assert.throws(()=>check(page(changes)));
});
test('result actor/tenant/selected-client substitution refuses through canonical registry',()=>{
 const c=resolve();for(const scope of [{tenantId:other,userId:actor,clientId:null},{tenantId:tenant,userId:other,clientId:null},{tenantId:tenant,userId:actor,clientId:client}])assert.throws(()=>c.assertOutput(page({scope}),{request:{},subject:subject()}));
 const request=c.normalizeInput({}, {subject:subject(client)}).request;
 const scoped=page({scope:{tenantId:tenant,userId:actor,clientId:client},candidates:[row({scope:'client',clientId:other})]});
 assert.throws(()=>c.assertOutput(scoped,{request,subject:subject(client)}));
});
test('retained continuation binds original request, scope, cursor, limit and monotonic order',()=>{
 const c=resolve(),previous={request:{limit:2},page:partial({nextCursor:'next'})};const ctx={subject:subject(),previous};
 const prepared=c.normalizeInput({cursor:'next',limit:2},ctx);assert.equal(prepared.input.cursor,'next');
 const next=partial({candidates:[row({id:older,createdAt:'2026-01-01T00:00:00.000Z'})],coverage:{firstPage:false,complete:false,reason:'unread_pages_restricted_or_truncated_content'}});
 assert.equal(c.assertOutput(next,{...ctx,request:prepared.request}).kind,'partial');
 for(const request of [{cursor:'other',limit:2},{cursor:'next',limit:3}])assert.throws(()=>c.normalizeInput(request,ctx));
 assert.throws(()=>c.assertOutput({...next,candidates:[row()]},{...ctx,request:prepared.request}));
 const swapped=structuredClone(ctx);swapped.previous.page.scope.userId=other;assert.throws(()=>c.normalizeInput(prepared.request,swapped));
 const invalid=structuredClone(ctx);invalid.previous.page.candidates[0].createdAt='2026-06-30T23:59:60Z';assert.throws(()=>c.normalizeInput(prepared.request,invalid));
 assert.throws(()=>c.assertOutput(page({candidates:[row({createdAt:'2026-06-30T23:59:60Z'})]}),{request:{},subject:subject()}));
});
test('hostile request/context/output/retained data invokes no getters or proxies',()=>{
 const c=resolve();let calls=0;const accessor={};Object.defineProperty(accessor,'subject',{enumerable:true,get(){calls++;return subject();}});
 assert.throws(()=>c.normalizeInput({},accessor));
 const request={};Object.defineProperty(request,'limit',{enumerable:true,get(){calls++;return 5;}});assert.throws(()=>c.normalizeInput(request,{subject:subject()}));
 const trap=new Proxy(page(),{ownKeys(){calls++;return [];},get(){calls++;return null;}});assert.throws(()=>c.assertOutput(trap,{request:{},subject:subject()}));
 const prior={request:{},page:new Proxy(partial({nextCursor:'next'}),{get(){calls++;return null;}})};
 assert.throws(()=>c.normalizeInput({cursor:'next'},{subject:subject(),previous:prior}));assert.equal(calls,0);
});
test('forged catalog enablement, schema, registry mapping and duplicate operation refuse',()=>{
 for(const mutate of [c=>{const m=c.operations.find(x=>x.operation.id===reference.id);m.availability='enabled';m.qualification='qualified';m.handler={module:'synthetic.mjs',export:'read',sourceSha256:'a'.repeat(64)};},c=>{c.operations.find(x=>x.operation.id===reference.id).inputSchema.sha256='a'.repeat(64);},c=>{c.originals.find(x=>x.id==='list_memory_proposals').replacement=null;},c=>{c.operations.push(c.operations.at(-1));}]){const c=catalog();mutate(c);assert.throws(()=>assertCatalog(c));}
});
test('source-disabled gateway composes actual new14 catalog with zero discovery and zero effects',async()=>{
 const f=fixture(),options={authorityPorts:f.ports,budget:f.budget,limits,now:()=>NOW,newId:()=>uuid('7')};const gateway=createSourceDisabledGateway(options);
 assert.equal(gateway.sourceEnabled,false);assert.deepEqual(await gateway.discover(),[]);assert.equal(catalog().operations.length,14);
 for(const row of catalog().operations)await assert.rejects(gateway.execute(JSON.stringify({operation:row.operation,arguments:{}}),'synthetic-opaque'),/UNAVAILABLE/);
 assert.deepEqual(f.calls,[]);assert.throws(()=>createSourceDisabledGateway({...options,sourceEnabled:true}));
});
test('private registry registration does not export memory through public0.1',()=>{
 const p=JSON.parse(readFileSync(new URL('../../../../../packages/contracts/package.json',import.meta.url)));
 assert.equal(p.version,'0.1.0');assert.ok(!JSON.stringify(p.exports).includes('memory'));assert.ok(!JSON.stringify(p.files).includes('retrieval'));
 const m=resolve();assert.ok(Object.isFrozen(m.descriptor));assert.ok(Object.isFrozen(m.descriptor.inputSchema));
});
