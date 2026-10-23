/** Explicit root-run disposable PG16 gate. Not imported by production or the automatic unit-test glob. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {managementPgFixture,check,gate} from './management-pg-fixture.mjs';
import {hash} from '../../control/conversations/boundary.mjs';
import {createConversationManagementComposition} from '../conversation-management-composition.mjs';
if(process.argv.includes('--help')){console.log('Usage: node apps/runtime/test/conversation-management-cross-owner-pg.mjs --config <json>. Explicit fresh loopback PG16 only; root owns provisioning and removal. Exit 0 pass, nonzero failure.');process.exit(0);}
if(process.argv.length!==4||process.argv[2]!=='--config')throw Error('Explicit --config required; ambient DATABASE_URL is never read');
const f=await managementPgFixture(JSON.parse(await readFile(process.argv[3],'utf8'))),results=[];
const run=async(name,work)=>{await work();results.push(name);console.log('PASS '+name);};
try{
 await run('real Core owner, metadata, CAS and immutable idempotency; Core-only Trash has zero ledger effects',async()=>{
  const c=await f.conversation();assert.equal(await f.owner.ownerOf({tenantId:c.principal.tenantId,conversationId:c.conversationId}),c.principal.actorId);
  const rename=c.request('rename'),receipt=await c.manage(rename);assert.equal(receipt.conversation.revision,'1');assert.equal(receipt.conversation.title,rename.title);assert.deepEqual(await c.manage(rename),receipt);
  await assert.rejects(c.manage({...rename,title:'Changed replay'}),/REQUEST_ID_CONFLICT/);await assert.rejects(c.manage(c.request('archive')),/STALE_REVISION/);
  const before=await f.ledger.replay();await assert.rejects(c.manage(c.request('trash','1')),/CONVERSATION_MANAGEMENT_UNAVAILABLE/);assert.deepEqual(await f.ledger.replay(),before);
  assert.equal((await f.pool.query('SELECT count(*) FROM meri_conversations.conversations WHERE conversation_id=$1',[c.conversationId])).rows[0].count,'0');
  const legacy=await f.conversation({legacy:true});await assert.rejects(legacy.metadata());await assert.rejects(legacy.manage(legacy.request('rename')));
  await assert.rejects(f.owner.readMetadata({principal:{...c.principal,actorId:randomUUID()},conversationId:c.conversationId}));
 });
 await run('Trash FK insertion completes under Meri lock; lost Core response replays; old Restore cannot release re-Trash',async()=>{
  const c=await f.conversation({meri:true}),trash=c.request('trash'),owner={...f.owner,async manage(input,port){await f.owner.manage(input,port);throw Error('SYNTHETIC_RESPONSE_LOST');}};
  const lost=createConversationManagementComposition({owner,store:f.store,retention:{startup:{suppression:f.suppression}}});
  await assert.rejects(lost.manage({principal:c.principal,request:trash}),/SYNTHETIC_RESPONSE_LOST/);assert.equal((await c.metadata()).status,'trashed');await assert.rejects(f.suppression.assertServable(c.subject),/RETENTION_SUPPRESSED/);
  const replay=await c.manage(trash);assert.equal(replay.conversation.revision,'1');assert.equal(Date.parse(replay.conversation.restoreUntil)-Date.parse(replay.conversation.trashedAt),30*86400000);
  const restore=c.request('restore','1');await c.manage(restore);await f.suppression.assertServable(c.subject);
  await c.manage(c.request('trash','2'));await c.manage(restore);await assert.rejects(f.suppression.assertServable(c.subject),/RETENTION_SUPPRESSED/);
 });
 await run('archive excludes pre-issued and racing admission; restored eligibility and committed history survive',async()=>{
  const c=await f.conversation(),p=await c.proposal();await f.store.initialInputs.claim(p.facts,check);
  const entered=gate(),release=gate(),command=c.request('archive');
  const archive=f.core.manageConversation(f.prisma,{tenantId:c.principal.tenantId,userId:c.principal.actorId},command,{withTerminalConversation:(raw,work)=>f.composition.port.withTerminalConversation(raw,async fence=>{entered.release();await release.promise;return work(fence);})});
  await entered.promise;const admission=f.store.initialInputs.accept(p.acceptance,check);const refused=assert.rejects(admission,/CONVERSATION_NOT_ACTIVE/);release.release();await archive;await refused;
  assert.equal((await f.pool.query('SELECT count(*) FROM meri_conversations.runs WHERE conversation_id=$1',[c.conversationId])).rows[0].count,'0');
  await c.manage(c.request('restore','1'));await f.store.initialInputs.accept(p.acceptance,check);
  await assert.rejects(c.manage(c.request('archive','2')),/CONVERSATION_RUN_ACTIVE/);assert.equal((await c.manage(c.request('rename','2'))).conversation.revision,'3');
  for(const state of ['starting','running','completed'])await f.store.append(c.binding,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check,c.scopes);
  await c.manage(c.request('archive','3'));assert.equal((await f.store.initialInputs.accept(p.acceptance,check)).replayed,true);assert.equal((await f.store.read(c.binding,{},check)).run.state,'completed');
 });
 await run('terminal history cannot hide an open successor; sequence-empty draft fails closed',async()=>{
  const c=await f.conversation(),p=await c.proposal();await f.store.initialInputs.claim(p.facts,check);await f.store.initialInputs.accept(p.acceptance,check);
  for(const state of ['starting','running','completed'])await f.store.append(c.binding,{eventId:randomUUID(),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},check,c.scopes);
  const db=await f.pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${c.principal.tenantId}:${c.conversationId}`]);
   await db.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE tenant_id=$1 AND conversation_id=$2',[c.principal.tenantId,c.conversationId]);
   const b={...c.binding,runId:randomUUID(),attemptId:randomUUID(),writerFence:2},run={...p.acceptance.run,binding:b},request={...p.acceptance.request,requestId:randomUUID()},event={...p.acceptance.event,binding:b,eventId:randomUUID()};
   await db.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,4)',[b.tenantId,b.conversationId,b.runId,run,hash(run),request.requestId,request,hash(request)]);
   await db.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,1,$4,$5,$6)',[b.tenantId,b.conversationId,b.runId,event.eventId,event,hash(event)]);await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  await assert.rejects(c.manage(c.request('archive')),/CONVERSATION_RUN_ACTIVE/);
  const empty=await f.conversation({meri:true}),e=await empty.proposal(),r=e.acceptance.run,q=e.acceptance.request;
  await f.pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[r.binding.tenantId,r.binding.conversationId,r.binding.runId,r,hash(r),q.requestId,q,hash(q)]);
  await assert.rejects(empty.manage(empty.request('archive')),/STORE_CORRUPT/);
 });
 await run('history release and management use transition then conversation ordering',async()=>{
  const c=await f.conversation({meri:true}),entered=gate(),release=gate();
  const reader=f.suppression.withRelease([c.subject],async(_signal,assertServable)=>{await assertServable(c.subject);entered.release();await release.promise;await assertServable(c.subject);return 'history released';});await entered.promise;
  const trash=c.manage(c.request('trash'));release.release();assert.equal(await reader,'history released');assert.equal((await trash).conversation.status,'trashed');
  await assert.rejects(f.suppression.withRelease([c.subject],async(_signal,assertServable)=>{await assertServable(c.subject);assert.fail('suppressed history must not release');}),/RETENTION_SUPPRESSED/);
 });
 console.log(JSON.stringify({tier:'synthetic-disposable-pg16-real-core-prisma-and-meri-locks',result:'PASS',checks:results,permanentDeletion:'HELD',emptyCoreOnlyTrash:'HELD'}));
}finally{await f.close();}
