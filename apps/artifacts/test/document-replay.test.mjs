/** Real local files/native document generator; canonical journal over scripted SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createPostgresArtifactService} from '../postgres-service.mjs';
import {createLocalDocumentFixture} from '../../control/document-application/local/fixture.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
const python=process.env.MERI_DOCUMENT_PYTHON??'/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const word=text=>({operation:'create_word',format:'docx',title:'Replay brief',content:{blocks:[{kind:'paragraph',runs:[{text}]}]}});
const excel={operation:'create_excel',format:'xlsx',title:'Replay workbook',content:{sheets:[{name:'Data',rows:[[{value:42}]]}]}};
const unresolved=p=>assert.rejects(p,e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');
async function setup(t,operation='create_word'){
  const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation});t.after(()=>f.close());
  const options={...f.artifactOptions},call={deliveryId:'replay-original',baseVersionId:null,request:operation==='create_word'?word('Original editable text.'):excel};
  const owner=()=>createPostgresArtifactService(options),run=(value=call,signal)=>owner().execute(value,f.credential,signal);
  const rows=()=>[...f.ledger.state().produced.values()];
  const versionPath=id=>join(f.directory,'store','versions',id+'.json');
  const invariant=(generations=1,charges=1,settled=1)=>{assert.equal(f.stats().generations,generations);assert.equal(f.stats().versionCharges,charges);assert.equal(f.stats().settled,settled);assert.equal(f.stats().consumedMicroUsd,String(settled*10));};
  return {f,options,call,owner,run,rows,versionPath,invariant};
}
function sameResult(recovered,original){
  assert.deepEqual(recovered.version,original.version);assert.deepEqual(recovered.inspection,original.inspection);
  assert.equal(recovered.execution.requestSha256,original.execution.requestSha256);
  assert.equal(recovered.execution.budgetTicketId,original.execution.budgetTicketId);
  assert.equal(recovered.execution.nativeQualified,false);
}
for(const operation of ['create_word','create_excel'])test(`${operation} completed create replay reconstructs owner and returns identical immutable result`,async t=>{
  const a=await setup(t,operation),first=await a.run();
  assert.equal(first.version.versionId,a.rows()[0].invocation_id.slice(6));
  a.options.ids=()=>{throw Error('NO_REPLAY_IDS');};a.options.newReservationId=()=>{throw Error('NO_REPLAY_RESERVE');};
  a.options.executor={execute:()=>{throw Error('NO_REPLAY_GENERATION');}};
  const before=await a.f.artifactOptions.objects.get(first.version.object);
  for(let i=0;i<3;i++)sameResult(await a.run(),first);
  assert.deepEqual(await a.f.artifactOptions.objects.get(first.version.object),before);a.invariant();
});
test('completed exact revision replays after a newer head and preserves original bytes',async t=>{
  const a=await setup(t),first=await a.run(),original=await a.f.artifactOptions.objects.get(first.version.object);
  const revision={deliveryId:'replay-revision',baseVersionId:first.version.versionId,request:word('Revision retained text.')};
  const second=await a.run(revision);await a.run({deliveryId:'newer-revision',baseVersionId:second.version.versionId,request:word('Third immutable text.')});
  sameResult(await a.run(revision),second);sameResult(await a.run(),first);
  assert.deepEqual(await a.f.artifactOptions.objects.get(first.version.object),original);a.invariant(3,3,3);
});
for(const phase of ['prepare','reserve','marker','settle'])test(`lost ${phase} acknowledgement uses retained evidence without duplicate effects`,async t=>{
  const a=await setup(t);a.f.ledger.loseStage(phase);await assert.rejects(a.run());
  if(phase==='reserve'){await unresolved(a.run());a.invariant(0,1,0);return;}
  const result=await a.run();assert.equal(result.version.versionId,a.rows()[0].invocation_id.slice(6));
  sameResult(await a.run(),result);a.invariant();
});
for(const phase of ['generator','object','version-before-write','unpublished-version'])test(`${phase} interruption remains UNKNOWN with no repeat effects`,async t=>{
  const a=await setup(t);
  if(phase==='generator')a.options.executor={execute(){throw Error('INTERRUPTED_GENERATOR');}};
  if(phase==='object'){const original=a.options.objects;a.options.objects={...original,async put(...args){await original.put(...args);throw Error('INTERRUPTED_OBJECT_ACK');}};}
  if(phase==='version-before-write')a.options.versions={...a.options.versions,async commit(){throw Error('INTERRUPTED_BEFORE_VERSION');}};
  if(phase==='unpublished-version')a.options.versions={...a.options.versions,async commit(record){const {expectedParentVersionId,...retained}=record;await writeFile(a.versionPath(record.version.versionId),JSON.stringify(retained));throw Error('INTERRUPTED_BEFORE_HEAD');}};
  await assert.rejects(a.run());const generations=a.f.stats().generations;
  const settled=await a.owner().reconcileInvocation(a.call);assert.equal(settled.stage,'UNKNOWN');
  for(let i=0;i<2;i++)await unresolved(a.run());a.invariant(generations,1,0);assert.equal(a.rows()[0].completion,null);
});
for(const failure of ['lost-commit-ack','malformed-commit-ack'])test(`${failure} after publication recovers exact server-correlated version before completion marker`,async t=>{
  const a=await setup(t),original=a.options.versions;
  a.options.versions={...original,async commit(...args){const ack=await original.commit(...args);if(failure==='lost-commit-ack')throw Error('INTERRUPTED_AFTER_PUBLICATION');return {...ack,status:'wrong'};}};
  await assert.rejects(a.run());assert.equal(a.rows()[0].completion,null);assert.equal((await a.owner().reconcileInvocation(a.call)).stage,'UNKNOWN');
  const record=await original.read(a.rows()[0].invocation_id.slice(6)),bytes=await a.f.artifactOptions.objects.get(record.version.object);
  const replay=await a.run();assert.deepEqual(replay.version,record.version);assert.deepEqual(await a.f.artifactOptions.objects.get(replay.version.object),bytes);
  assert.equal(a.rows()[0].completion.resultSha256,v.hash({...record,expectedParentVersionId:null}));a.invariant();
});
test('cancel after published version before ACK can be recovered with same original lease',async t=>{
  const a=await setup(t),versions=a.options.versions,controller=new AbortController();
  let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  a.options.versions={...versions,async commit(...args){const result=await versions.commit(...args);enter();await gate;return result;}};
  const pending=a.run(a.call,controller.signal);await ready;controller.abort();await assert.rejects(pending);
  release();await new Promise(r=>setImmediate(r));assert.equal(a.rows()[0].completion,null);
  const recovered=await a.run();sameResult(await a.run(),recovered);a.invariant();
});
test('concurrent completed repeats return one immutable version and one charge',async t=>{
  const a=await setup(t),first=await a.run(),results=await Promise.all(Array.from({length:8},()=>a.run()));
  for(const result of results)sameResult(result,first);a.invariant();
});
test('concurrent first repeats yield one physical generation; unresolved waiter later recovers',async t=>{
  const a=await setup(t),executor=a.options.executor;let enter,release;
  const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  a.options.executor={async execute(value){enter();await gate;return executor.execute(value);}};
  const first=a.run();await ready;await unresolved(a.run());release();const result=await first;
  sameResult(await a.run(),result);a.invariant();
});
test('concurrent repeat after publication settles the same original marker while original ACK is parked',async t=>{
  const a=await setup(t),versions=a.options.versions;let enter,release;
  const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  a.options.versions={...versions,async commit(...args){const ack=await versions.commit(...args);enter();await gate;return ack;}};
  const pending=a.run();await ready;
  try{const replay=await a.run();release();sameResult(await pending,replay);a.invariant();}
  finally{release();}
});
test('distinct deliveries with identical input are distinct artifacts and never borrow completion',async t=>{
  const a=await setup(t),first=await a.run(),second=await a.run({...a.call,deliveryId:'different-delivery'});
  assert.notEqual(first.version.versionId,second.version.versionId);assert.notEqual(first.version.artifactId,second.version.artifactId);
  assert.equal(first.execution.requestSha256,second.execution.requestSha256);sameResult(await a.run(),first);a.invariant(2,2,2);
});
test('request/base/context/credential substitution cannot recover a completed result',async t=>{
  const a=await setup(t);await a.run();
  await assert.rejects(a.run({...a.call,request:word('Changed input')}));await assert.rejects(a.run({...a.call,baseVersionId:randomUUID()}));
  await assert.rejects(a.owner().execute(a.call,'wrong-credential'));
  await assert.rejects(createPostgresArtifactService({...a.options,context:{...a.options.context,maxBytes:1000}}).execute(a.call,a.f.credential));
  a.invariant();
});
test('new revision against stale immutable base remains UNKNOWN; completed original replay succeeds',async t=>{
  const a=await setup(t),first=await a.run(),revision={deliveryId:'next',baseVersionId:first.version.versionId,request:word('Second.')};
  await a.run(revision);const stale={...revision,deliveryId:'stale',request:word('Stale third.')};await assert.rejects(a.run(stale));await unresolved(a.run(stale));
  sameResult(await a.run(),first);a.invariant(3,3,2);assert.equal(a.f.stats().unknown,1);
});
test('current revocation denies replay and retained reads while historical accounting remains available',async t=>{
  const a=await setup(t);await a.run();a.f.revoke();await unresolved(a.run());
  assert.equal((await a.owner().reconcileInvocation(a.call)).stage,'SETTLED');a.invariant();
});
for(const target of ['object','record','publication','marker'])test(`missing or conflicting ${target} evidence cannot release or re-execute`,async t=>{
  const a=await setup(t),first=await a.run();
  if(target==='object')await rm(join(a.f.directory,'store','objects',first.version.object.objectId+'.'+first.version.object.versionId));
  if(target==='record'){const path=a.versionPath(first.version.versionId),record=JSON.parse(await readFile(path));record.spec.title='Corrupt';await writeFile(path,JSON.stringify(record));}
  if(target==='publication')await rm(join(a.f.directory,'store','heads',first.version.artifactId));
  if(target==='marker')a.rows()[0].completion.resultSha256='f'.repeat(64);
  await unresolved(a.run());a.invariant();
});
test('legacy random version uses full retained completion digest; markerless legacy stays UNKNOWN',async t=>{
  const a=await setup(t),first=await a.run(),old=first.version.versionId,legacy=randomUUID(),path=a.versionPath(old);
  const record=JSON.parse(await readFile(path));record.version.versionId=legacy;
  await rename(path,a.versionPath(legacy));await writeFile(a.versionPath(legacy),JSON.stringify(record));
  await writeFile(join(a.f.directory,'store','heads',first.version.artifactId),legacy);
  const row=a.rows()[0];row.completion.resultSha256=v.hash({...record,expectedParentVersionId:null});
  const recovered=await a.run();assert.equal(recovered.version.versionId,legacy);assert.equal(recovered.execution.budgetTicketId,first.execution.budgetTicketId);a.invariant();
  // Model the older interrupted write with no completion, retaining an UNKNOWN hold.
  a.rows()[0].completion=null;const reservation=[...a.f.ledger.state().reservations.values()][0];reservation.state='UNKNOWN';reservation.output_bytes=null;reservation.charged_micro_usd=null;reservation.settled_at=null;
  a.f.ledger.state().budget.consumed_micro_usd='0';await unresolved(a.run());a.invariant(1,1,0);
});
test('replay retains exact byte hash and fresh release receipt',async t=>{
  const a=await setup(t),first=await a.run(),again=await a.run();sameResult(again,first);
  assert.notEqual(again.execution.authorizationReceiptId,first.execution.authorizationReceiptId);
  const bytes=await a.f.artifactOptions.objects.get(again.version.object);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),again.inspection.sha256);a.invariant();
});
test('original persisted deadline cannot be extended by a later replay',async t=>{
  const a=await setup(t);await a.run();a.rows()[0].deadline_ms=String(Date.now()-1);
  await assert.rejects(a.run());a.invariant();
});
