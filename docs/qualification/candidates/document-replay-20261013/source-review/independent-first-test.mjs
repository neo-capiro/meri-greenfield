/** Independent exact replay controls; scripted canonical accounting + real local files, no DB/provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {createPostgresArtifactService} from '../postgres-service.mjs';
import {createLocalDocumentFixture} from '../../control/document-application/local/fixture.mjs';
import {readLocalReplay} from '../local-replay.mjs';
import {artifactValidators as v} from '../../../packages/contracts/retrieval-0.2/validate.mjs';

const python='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const uid=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const word=text=>({operation:'create_word',format:'docx',title:'Independent immutable replay',content:{blocks:[{kind:'paragraph',runs:[{text}]}]}});
const excel=()=>({operation:'create_excel',format:'xlsx',title:'Independent workbook replay',content:{sheets:[{name:'Evidence',rows:[[{value:'Independent'},{value:87}],[{value:'Retained'},{value:42}]]}]}});
const unresolved=p=>assert.rejects(p,e=>e.code==='ARTIFACT_REPLAY_UNRESOLVED');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function setup(t,operation='create_word'){
 const f=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable:python,operation});
 t.after(async()=>{await f.close();assert.equal(f.stats().cleanup.executorDirectoriesAbsent,true);assert.equal(f.stats().cleanup.storeRemoved,true);await assert.rejects(access(f.directory));});
 const options={...f.artifactOptions},call={deliveryId:'independent-original',baseVersionId:null,request:operation==='create_word'?word('Original independent text Δ 🛰.'):excel()};
 const owner=()=>createPostgresArtifactService(options),run=(value=call,signal)=>owner().execute(value,f.credential,signal);
 const row=()=>[...f.ledger.state().produced.values()].find(r=>r.delivery.deliveryId===call.deliveryId);
 const reservation=()=>[...f.ledger.state().reservations.values()].find(r=>r.invocation_id===row().invocation_id);
 const snapshot=()=>({generations:f.stats().generations,charges:f.stats().versionCharges,settled:f.stats().settled,unknown:f.stats().unknown,consumed:f.stats().consumedMicroUsd});
 const noNewEffects=before=>assert.deepEqual(snapshot(),before);
 const versionPath=id=>join(f.directory,'store','versions',id+'.json');
 return {f,options,call,owner,run,row,reservation,snapshot,noNewEffects,versionPath};
}
function same(replay,original){assert.deepEqual(replay.version,original.version);assert.deepEqual(replay.inspection,original.inspection);
 assert.equal(replay.execution.requestSha256,original.execution.requestSha256);assert.equal(replay.execution.budgetTicketId,original.execution.budgetTicketId);assert.equal(replay.execution.nativeQualified,false);}
function forbidNewEffects(a){a.options.ids=()=>{throw Error('No replay allocation');};a.options.newReservationId=()=>{throw Error('No replay reservation');};
 a.options.executor={execute(){throw Error('No replay generation');}};const objects=a.options.objects,versions=a.options.versions;
 a.options.objects={...objects,put(){throw Error('No replay object write');}};a.options.versions={...versions,commit(){throw Error('No replay version commit');}};}

for(const op of ['create_word','create_excel'])test(`${op}: retained bytes/version/ticket survive reconstructed and concurrent completed repeats`,async t=>{
 const a=await setup(t,op),original=await a.run(),bytes=await a.f.artifactOptions.objects.get(original.version.object),before=a.snapshot();
 assert.equal(original.version.versionId,a.row().invocation_id.slice(6));forbidNewEffects(a);
 const results=await Promise.all(Array.from({length:4},()=>a.run()));for(const replay of results)same(replay,original);
 assert.deepEqual(await a.f.artifactOptions.objects.get(original.version.object),bytes);assert.equal(digest(bytes),original.version.object.sha256);a.noNewEffects(before);
});
test('new invocation UUID overrides only validated version allocation, retaining original artifact/object allocation',async t=>{
 const a=await setup(t),allocation={artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()};a.options.ids=()=>allocation;
 const result=await a.run();assert.equal(result.version.artifactId,allocation.artifactId);assert.equal(result.version.object.objectId,allocation.objectId);
 assert.equal(result.version.versionId,a.row().invocation_id.slice(6));assert.notEqual(result.version.versionId,allocation.versionId);
 const b=await setup(t);b.options.ids=()=>({...allocation,versionId:'invalid-before-override'});await assert.rejects(b.run(),e=>e.code==='ARTIFACT_ID');assert.equal(b.f.stats().generations,0);assert.equal(b.f.stats().versionCharges,0);
});
test('completed revision remains published in descendant ancestry and never rewrites original or later head',async t=>{
 const a=await setup(t),original=await a.run(),bytes=await a.f.artifactOptions.objects.get(original.version.object);
 const revisedCall={...a.call,deliveryId:'independent-revision',baseVersionId:original.version.versionId,request:word('Independent second version.')};
 const revised=await a.run(revisedCall),latest=await a.run({...revisedCall,deliveryId:'independent-third',baseVersionId:revised.version.versionId,request:word('Independent third version.')});
 const head=join(a.f.directory,'store','heads',original.version.artifactId),beforeHead=await readFile(head),before=a.snapshot();forbidNewEffects(a);
 same(await a.run(),original);same(await a.run(revisedCall),revised);assert.equal(beforeHead.toString(),latest.version.versionId);assert.deepEqual(await readFile(head),beforeHead);
 assert.deepEqual(await a.f.artifactOptions.objects.get(original.version.object),bytes);a.noNewEffects(before);
});
for(const stage of ['marker','settle'])test(`lost ${stage} ACK recovers only original immutable commit and charge`,async t=>{
 const a=await setup(t);a.f.ledger.loseStage(stage);await assert.rejects(a.run());const record=await a.f.artifactOptions.versions.read(a.row().invocation_id.slice(6));
 const generated=a.f.stats().generations,charged=a.f.stats().versionCharges;forbidNewEffects(a);const replay=await a.run();assert.deepEqual(replay.version,record.version);
 assert.equal(a.f.stats().generations,generated);assert.equal(a.f.stats().versionCharges,charged);assert.equal(a.f.stats().consumedMicroUsd,'10');assert.equal(a.f.stats().settled,1);
 same(await a.run(),replay);assert.equal((await a.owner().reconcileInvocation(a.call)).resultDelivered,false);
});
test('published premarker interruption recovers while an orphan record remains UNKNOWN',async t=>{
 const a=await setup(t),versions=a.options.versions;a.options.versions={...versions,async commit(...args){await versions.commit(...args);throw Error('Synthetic lost commit acknowledgement');}};
 await assert.rejects(a.run());assert.equal(a.row().completion,null);const record=await versions.read(a.row().invocation_id.slice(6));forbidNewEffects(a);
 const replay=await a.run();assert.deepEqual(replay.version,record.version);assert.equal(a.row().completion.resultSha256,v.hash({...record,expectedParentVersionId:null}));assert.equal(a.f.stats().generations,1);
 const b=await setup(t);b.options.versions={...b.options.versions,async commit(value){const {expectedParentVersionId,...record}=value;await writeFile(b.versionPath(value.version.versionId),JSON.stringify(record));throw Error('Synthetic unpublished record');}};
 await assert.rejects(b.run());const before=b.snapshot();forbidNewEffects(b);await unresolved(b.run());b.noNewEffects(before);assert.equal(b.row().completion,null);
});
for(const completed of [true,false])test(`consistent accounting argument corruption is rejected (${completed?'completed':'premarker'})`,async t=>{
 const a=await setup(t);if(!completed){const versions=a.options.versions;a.options.versions={...versions,async commit(...args){await versions.commit(...args);throw Error('Lost acknowledgement');}};}
 if(completed)await a.run();else await assert.rejects(a.run());const before=a.snapshot(),wrong='b'.repeat(64);
 a.row().arguments_sha256=wrong;a.reservation().arguments_sha256=wrong;if(a.row().completion)a.row().completion.argumentsSha256=wrong;
 forbidNewEffects(a);await unresolved(a.run());a.noNewEffects(before);
});
test('legacy complete digest supports exact random version while alias filename and markerless legacy fail closed',async t=>{
 const a=await setup(t),first=await a.run(),legacy=randomUUID(),record=await a.f.artifactOptions.versions.read(first.version.versionId);
 record.version.versionId=legacy;await rm(a.versionPath(first.version.versionId));await writeFile(a.versionPath(legacy),JSON.stringify(record));
 await writeFile(join(a.f.directory,'store','heads',first.version.artifactId),legacy);a.row().completion.resultSha256=v.hash({...record,expectedParentVersionId:null});
 const before=a.snapshot();forbidNewEffects(a);const recovered=await a.run();assert.equal(recovered.version.versionId,legacy);assert.equal(recovered.execution.budgetTicketId,first.execution.budgetTicketId);a.noNewEffects(before);
 await writeFile(a.versionPath(first.version.versionId),JSON.stringify(record));await unresolved(a.run());a.noNewEffects(before);
 const b=await setup(t),original=b.options.versions,old=randomUUID();b.options.versions={...original,commit(value,signal){return original.commit({...value,version:{...value.version,versionId:old}},signal);}};
 await assert.rejects(b.run());assert.equal(b.row().completion,null);assert.equal(b.reservation().state,'UNKNOWN');const legacyBefore=b.snapshot();forbidNewEffects(b);await unresolved(b.run());b.noNewEffects(legacyBefore);
});
test('identical requests on separate deliveries cannot borrow or erase each others completion',async t=>{
 const a=await setup(t),first=await a.run(),secondCall={...a.call,deliveryId:'independent-separate-delivery'},second=await a.run(secondCall);
 assert.equal(first.execution.requestSha256,second.execution.requestSha256);assert.notEqual(first.version.versionId,second.version.versionId);assert.notEqual(first.version.artifactId,second.version.artifactId);
 await rm(a.versionPath(second.version.versionId));const before=a.snapshot();forbidNewEffects(a);await unresolved(a.run(secondCall));same(await a.run(),first);a.noNewEffects(before);
});
for(const alteration of ['parent','scope','record','object','head','completion'])test(`retained ${alteration} corruption cannot release or re-execute`,async t=>{
 const a=await setup(t),first=await a.run(),before=a.snapshot();
 if(['parent','scope','record'].includes(alteration)){const record=await a.f.artifactOptions.versions.read(first.version.versionId);
  if(alteration==='parent')record.version.parentVersionId=randomUUID();if(alteration==='scope')record.version.scopes[0].resourceId=randomUUID();if(alteration==='record')record.spec.content.blocks[0].runs[0].text='Altered immutable body';
  await writeFile(a.versionPath(first.version.versionId),JSON.stringify(record));}
 if(alteration==='object')await writeFile(join(a.f.directory,'store','objects',first.version.object.objectId+'.'+first.version.object.versionId),Buffer.from('Corrupt document bytes'));
 if(alteration==='head')await writeFile(join(a.f.directory,'store','heads',first.version.artifactId),randomUUID());
 if(alteration==='completion')a.row().completion.resultSha256='e'.repeat(64);
 forbidNewEffects(a);await unresolved(a.run());a.noNewEffects(before);
});
test('revoked current authority and a narrower current byte ceiling withhold a charged result',async t=>{
 const a=await setup(t),first=await a.run(),before=a.snapshot(),authority=a.options.authority;
 a.options.authority={async check(call){const result=await authority.check(call);return {...result,claims:{...result.claims,budgets:{...result.claims.budgets,maxOutputBytes:first.version.object.bytes-1}}};}};
 forbidNewEffects(a);await unresolved(a.run());a.noNewEffects(before);a.f.revoke();await unresolved(a.run());a.noNewEffects(before);assert.equal((await a.owner().reconcileInvocation(a.call)).resultDelivered,false);
});
test('revocation after exact object read still withholds release without new effects',async t=>{
 const a=await setup(t);await a.run();const objects=a.options.objects,before=a.snapshot();
 a.options.objects={...objects,async get(...args){const bytes=await objects.get(...args);a.f.revoke();return bytes;}};forbidNewEffects(a);
 await unresolved(a.run());a.noNewEffects(before);
});
test('original invocation deadline is not renewed by a fresh owner or completed replay',async t=>{
 const a=await setup(t);await a.run();const before=a.snapshot(),expired=Number(a.row().deadline_ms)+1;a.f.ledger.setClock(expired);a.options.now=()=>expired;
 forbidNewEffects(a);await assert.rejects(a.run());a.noNewEffects(before);
});
test('cancellation during replay lookup releases no result and performs no new effect',async t=>{
 const a=await setup(t);await a.run();const before=a.snapshot(),versions=a.options.versions,entered=deferred(),released=deferred(),controller=new AbortController();
 a.options.versions={...versions,async read(...args){if(args[0]?.kind==='artifact-replay'){entered.resolve();await released.promise;}return versions.read(...args);}};forbidNewEffects(a);
 const pending=a.run(a.call,controller.signal);await entered.promise;controller.abort();await assert.rejects(pending);released.resolve();await new Promise(setImmediate);a.noNewEffects(before);
});
test('one generator wins while concurrent uncompleted replay stays UNKNOWN and later returns its result',async t=>{
 const a=await setup(t),executor=a.options.executor,entered=deferred(),released=deferred();a.options.executor={async execute(call){entered.resolve();await released.promise;return executor.execute(call);}};
 const original=a.run();await entered.promise;try{await unresolved(a.run());}finally{released.resolve();}const first=await original,before=a.snapshot();forbidNewEffects(a);same(await a.run(),first);a.noNewEffects(before);
});
test('published concurrent recovery uses identical original completion before first commit ACK resumes',async t=>{
 const a=await setup(t),versions=a.options.versions,entered=deferred(),released=deferred();a.options.versions={...versions,async commit(...args){const result=await versions.commit(...args);entered.resolve();await released.promise;return result;}};
 const pending=a.run();await entered.promise;let recovered;try{recovered=await a.run();}finally{released.resolve();}same(await pending,recovered);
 assert.equal(a.f.stats().generations,1);assert.equal(a.f.stats().versionCharges,1);assert.equal(a.f.stats().settled,1);assert.equal(a.f.stats().consumedMicroUsd,'10');
});

function lookupFixture(count,{bytes=256,cycle=false}={}){
 const records=new Map(),artifactId=uid(9000),requestSha256='a'.repeat(64),target=uid(1),head=uid(count),calls=[];
 for(let i=1;i<=count;i++)records.set(uid(i),{version:{versionId:uid(i),artifactId,parentVersionId:i===1?null:uid(i-1)},requestSha256});
 if(cycle)records.get(head).version.parentVersionId=head;
 const ports={readVersion:async id=>{calls.push(id);if(!records.has(id))throw Object.assign(Error('missing'),{code:'ENOENT'});return {record:records.get(id),bytes};},readHead:async()=>head,listVersions:async()=>[...records.keys()].map(id=>id+'.json'),hash:v.hash,check(){}};
 return {records,ports,calls,query:{kind:'artifact-replay',versionId:target,requestSha256,resultSha256:null}};
}
test('publication ancestry accepts exactly1024 nodes with cached target read; longer and cyclic chains fail',async()=>{
 const good=lookupFixture(1024);assert.equal((await readLocalReplay(good.query,good.ports)).version.versionId,uid(1));assert.equal(good.calls.length,1024);
 const long=lookupFixture(1025);await unresolved(readLocalReplay(long.query,long.ports));const cycle=lookupFixture(3,{cycle:true});await unresolved(readLocalReplay(cycle.query,cycle.ports));
});
test('legacy scan bounds entries and actual accumulated raw bytes, accepting exact16MiB only',async()=>{
 for(const count of [4,5]){const f=lookupFixture(count,{bytes:4194304}),target=uid(count);f.query.versionId=uid(8888);f.query.resultSha256=v.hash({...f.records.get(target),expectedParentVersionId:f.records.get(target).version.parentVersionId});
  if(count===4)assert.equal((await readLocalReplay(f.query,f.ports)).version.versionId,target);else await unresolved(readLocalReplay(f.query,f.ports));}
 const over=lookupFixture(1);over.query.versionId=uid(8888);over.query.resultSha256='f'.repeat(64);over.ports.listVersions=async()=>Array.from({length:1025},(_,i)=>uid(i+1)+'.json');await unresolved(readLocalReplay(over.query,over.ports));
});
test('local lookup rejects file/version alias even when its claimed record and digest appear complete',async()=>{
 const f=lookupFixture(1);f.records.get(uid(1)).version.versionId=uid(2);f.query.resultSha256=v.hash({...f.records.get(uid(1)),expectedParentVersionId:null});await unresolved(readLocalReplay(f.query,f.ports));
});
