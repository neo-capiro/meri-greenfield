import test from 'node:test';import assert from 'node:assert/strict';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {nativeDocumentFixture,sha} from './native-document-fixture.mjs';
import {id,NOW} from '../storage/test/sql-fixture.mjs';

test('a selected invocation override requires the existing private evidence admission and cannot change a claimed request',async()=>{
 const f=nativeDocumentFixture(),selectedInvocationId='sdk:'+'a'.repeat(64);
 assert.throws(()=>f.owner({selectedInvocationId}),/ARTIFACT_INVOCATION/);assert.equal(f.state.rows.size,0);
 let admissions=0;const admitRetainedEvidence=context=>{admissions++;assert.deepEqual(context,f.context);};
 const owner=f.owner({selectedInvocationId,admitRetainedEvidence}),out=await owner.execute(f.call);
 assert.equal(out.execution.invocationId,selectedInvocationId);assert.equal(admissions,1);
 assert.deepEqual((await owner.execute({...f.call,deliveryId:'another-transport-delivery'})).version,out.version);
 await assert.rejects(owner.execute({...f.call,request:{...f.call.request,title:'Different request'}}));assert.equal(f.state.executions.length,1);
});

test('native document uses the canonical claim/publication; renewed deadline replays exact bytes without generation',async()=>{
 const f=nativeDocumentFixture(),first=await f.run();v.assertArtifactOutput('create_word',first,f.call.request,f.context);
 assert.equal(first.version.contractVersion,'0.2.0');assert.equal(first.execution.kind,'native-document');assert.equal(Object.hasOwn(first.execution,'budgetTicketId'),false);
 assert.equal([...f.state.rows.values()][0].state,'PREPARED');assert.equal(f.sql.durable.state.index.decisions[0].invocation.invocationId,first.execution.invocationId);
 f.state.clock+=100;const later={...f.context,deadlineMs:f.context.deadlineMs+1000};const second=await f.owner({context:later}).execute(f.call);
 assert.deepEqual(second.version,first.version);assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);
 assert.equal(second.execution.requestSha256,v.nativeRequestSha256(f.call.request,later));
});

test('native revision consumes exact parent bytes, preserves original and replays only its own delivery',async()=>{
 const f=nativeDocumentFixture(),first=await f.run(),call={...f.call,deliveryId:'revision',baseVersionId:first.version.versionId,request:{...f.call.request,content:{text:'Revised\n'}}};
 const second=await f.run(call);assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);
 assert.equal(f.state.executions[1].base.bytes.toString(),'First version\n');assert.equal(f.state.objects.get(v.hash(first.version.object)).toString(),'First version\n');
 assert.deepEqual((await f.run(call)).version,second.version);assert.equal(f.state.executions.length,2);
});

for(const field of ['request','base','maxBytes','scopes','assets','evidence'])test(`native replay refuses changed ${field} before a second executor`,async()=>{
 const f=nativeDocumentFixture(),first=await f.run();let call=structuredClone(f.call),context=structuredClone(f.context);
 if(field==='request')call.request.content.text='different';if(field==='base')call.baseVersionId=first.version.versionId;
 if(field==='maxBytes')context.maxBytes=1024;if(field==='scopes')context.scopes[0].policyRevision='new-policy';
 if(field==='assets')context.assets=[{id:'logo',object:first.version.object}];
 if(field==='evidence')context.evidence=[{sourceId:'synthetic',recordId:'record',sourceVersionId:'version',observedAt:'2026-10-13T18:00:00.000Z',sourceUpdatedAt:null,citationId:id(400),scopes:context.scopes,contentSha256:'a'.repeat(64),binding:structuredClone(context.binding)}];
 await assert.rejects(f.owner({context}).execute(call));assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,1);
});

test('claim COMMIT loss never starts generation, and its durable pending claim remains non-dispatchable',async()=>{
 const f=nativeDocumentFixture();f.state.loseCommit='claim';await assert.rejects(f.run(),e=>e.code==='UNAVAILABLE');
 await assert.rejects(f.run(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');assert.equal(f.state.executions.length,0);assert.equal(f.state.puts,0);assert.equal([...f.state.rows.values()][0].state,'PENDING');
});

test('executor uncertainty never retries model/render work and cannot infer publication from an object',async()=>{
 const f=nativeDocumentFixture();f.state.executorHook=()=>{throw Error('EXECUTOR_UNKNOWN');};
 await assert.rejects(f.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.cause.message==='EXECUTOR_UNKNOWN');f.state.executorHook=null;
 await assert.rejects(f.run(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,0);assert.equal([...f.state.rows.values()][0].state,'UNKNOWN');
});

test('lost immutable publication ACK recovers missing SQL and returns the same object without executor replay',async()=>{
 const f=nativeDocumentFixture();f.sql.durable.state.lostAck=true;await assert.rejects(f.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');
 assert.equal(f.sql.state.versions.size,0);assert.equal(f.sql.durable.state.writes,1);const result=await f.run();
 assert.equal(f.sql.state.versions.size,1);assert.equal(result.version.object.sha256,sha(Buffer.from('First version\n')));assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,1);assert.equal(f.sql.durable.state.writes,1);
 assert.equal([...f.state.rows.values()][0].state,'UNKNOWN','recovery does not overwrite original uncertain consumption');
});

test('lost PREPARED settlement ACK recovers actual retained publication without a second settlement',async()=>{
 const f=nativeDocumentFixture();f.state.loseCommit='settle';await assert.rejects(f.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.versionCommitted);
 assert.equal([...f.state.rows.values()][0].state,'PREPARED');const result=await f.run();assert.equal(result.execution.versionCommitted,true);
 assert.equal(f.state.executions.length,1);assert.equal(f.state.commands.filter(x=>x.sql.startsWith('UPDATE')).length,1);
});

for(const change of ['revoked','suppressed','object','owner','retained-result'])test(`recovery withholds retained output after ${change}`,async()=>{
 const f=nativeDocumentFixture(),made=await f.run(),row=[...f.state.rows.values()][0];
 if(change==='revoked')f.state.denied=true;if(change==='suppressed')f.sql.suppressed.add(`${f.context.binding.tenantId}:conversation:${f.context.binding.conversationId}`);
 if(change==='object')f.state.objects.set(v.hash(made.version.object),Buffer.from('tampered'));
 if(change==='owner'){const r=f.sql.state.versions.get(made.version.versionId);r.record.version.binding.actorId='foreign';r.actor_id='foreign';r.record_sha256=v.hash(r.record);}
 if(change==='retained-result')row.outcome.result.version.filename='forged.txt';
 await assert.rejects(f.run());assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,1);
});

test('cancelled or expired delivery claims nothing; cancellation during execution stays consumed and unpublished',async()=>{
 for(const kind of ['cancelled','expired']){const f=nativeDocumentFixture(),ac=new AbortController();if(kind==='cancelled')ac.abort();else f.state.clock=f.context.deadlineMs;await assert.rejects(f.run(f.call,ac.signal));assert.equal(f.state.rows.size,0);assert.equal(f.state.executions.length,0);}
 const f=nativeDocumentFixture(),ac=new AbortController();f.state.executorHook=()=>ac.abort();await assert.rejects(f.run(f.call,ac.signal));
 await assert.rejects(f.run());assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,0);assert.equal([...f.state.rows.values()][0].state,'PENDING');
});

test('concurrent delivery has one executor; pending observer cannot convert a claim into permission',async()=>{
 const f=nativeDocumentFixture();let release,entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);f.state.executorHook=async()=>{entered();await hold;};
 const first=f.run();await started;await assert.rejects(f.run(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');release();const output=await first;
 assert.deepEqual((await f.run()).version,output.version);assert.equal(f.state.executions.length,1);assert.equal(f.state.puts,1);
});

test('fresh authority refusal precedes every object/SQL recovery effect and release rechecks exact material',async()=>{
 const f=nativeDocumentFixture();f.state.denied=true;await assert.rejects(f.run(),/CURRENT_ACCESS_DENIED/);assert.equal(f.state.executions.length,0);assert.equal(f.state.puts,0);assert.equal(f.sql.events.length,0);
 const g=nativeDocumentFixture();g.state.authorizeHook=x=>{if(g.state.puts&&x.resource.object)throw Error('REVOKED_AT_RELEASE');};
 await assert.rejects(g.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.versionCommitted);assert.equal(g.sql.state.versions.size,1);g.state.authorizeHook=null;g.state.denied=true;
 await assert.rejects(g.run(),e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');assert.equal(g.state.executions.length,1);
});

const evidenceFor=context=>({sourceId:'synthetic',recordId:'record',sourceVersionId:'v1',observedAt:'2026-10-13T18:00:00.000Z',sourceUpdatedAt:null,citationId:id(700),scopes:structuredClone(context.scopes),contentSha256:'a'.repeat(64),binding:structuredClone(context.binding)});
test('native evidence is retained with the actual run and version without a synthetic decision',async()=>{
 const f=nativeDocumentFixture(),context={...f.context,evidence:[evidenceFor(f.context)]};
 const out=await f.owner({context}).execute(f.call);assert.equal(out.version.contractVersion,'0.2.0');assert.deepEqual(out.version.evidence,context.evidence);assert.equal(Object.hasOwn(out.version.evidence[0],'authorizationDecisionId'),false);
 assert.deepEqual((await f.owner({context}).execute(f.call)).version,out.version);assert.equal(f.state.executions.length,1);
});
for(const change of ['historical','mixed','foreign binding','scope','extra field'])test(`new native writes refuse ${change} evidence before claim or generation`,async()=>{
 const f=nativeDocumentFixture(),native=evidenceFor(f.context),legacy={...native,authorizationDecisionId:id(701)};delete legacy.binding;
 const context={...f.context,evidence:[native]};
 if(change==='historical')context.evidence=[legacy];if(change==='mixed')context.evidence.push(legacy);
 if(change==='foreign binding')native.binding.runId=id(702);if(change==='scope')native.scopes[0].resourceId=id(703);if(change==='extra field')native.authorizationDecisionId=id(704);
 await assert.rejects(async()=>f.owner({context}).execute(f.call));assert.equal(f.state.rows.size,0);assert.equal(f.state.executions.length,0);assert.equal(f.state.puts,0);assert.equal(f.sql.durable.state.writes,0);
});
