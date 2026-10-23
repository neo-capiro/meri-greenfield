/** Canonical conversation transaction and retention lease over scripted SQL; real PG regression is root-owned. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {binding,id} from './store-fixture.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {createConversationManagementPort} from '../management.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
import {createPostgresRetentionJournal} from '../../retention/postgres-journal.mjs';
const principal={tenantId:binding.tenantId,actorId:binding.actorId},check=()=>{};
const command=operation=>({version:'meri.conversation-management.v1',principal,conversationId:binding.conversationId,requestId:id(980),operation,expectedRevision:'0'});
function fixture({storeCommit=false,storeRelease=false,unlock='ok',retentionRelease=false,queryError}={}){
 const f=initialInputFixture(),calls=[];
 const pool={async connect(){const c=await f.pool.connect();return {async query(sql,args){
  if(queryError&&sql.includes('FOR NO KEY UPDATE'))throw queryError;
  const r=await c.query(sql,args);if(sql==='COMMIT'){calls.push('store-commit');if(storeCommit)throw Error('synthetic lost COMMIT');}return r;
 },release(reason){c.release(reason);calls.push('store-release');if(storeRelease)throw Error('synthetic release failure');}};}};
 const journal=createPostgresRetentionJournal({maxRequestMs:100,pool:{async connect(){return {async query(sql){
  if(sql.startsWith('SELECT pg_advisory_unlock')){calls.push('retention-unlock');if(unlock==='throw')throw Error('synthetic unlock failure');return {rows:[{unlocked:unlock==='ok'}]};}return {rows:[]};
 },release(){calls.push('retention-release');if(retentionRelease)throw Error('synthetic release failure');}};}}});
 const suppression={withTransition(_selection,work){return journal.withTransition(`${binding.tenantId}:conversation:${binding.conversationId}`,work);},
  suppress:async()=>assert.fail('refusal must not suppress'),release:async()=>assert.fail('refusal must not release'),isSuppressed:async()=>false};
 const store=createPostgresConversationStore({pool,now:f.now,conversationManagement:{readMetadata:async()=>({conversationId:binding.conversationId,status:'active',scopeKind:'client',clientId:id(5),revision:'0'})}});
 return {...f,calls,store,port:createConversationManagementPort({store,suppression}),suppression};
}
test('the two canonical pre-callback refusals become observable only after both owners release cleanly',async()=>{
 for(const active of [false,true]){const f=fixture();if(active)await f.store.accept((await f.proposal()).acceptance,check);f.calls.length=0;let entered=false;
  const code=active?'CONVERSATION_RUN_ACTIVE':'CONVERSATION_MANAGEMENT_UNAVAILABLE';
  await assert.rejects(f.port.withTerminalConversation(command(active?'archive':'trash'),async()=>{entered=true;}),e=>{
   assert.deepEqual(f.calls,['store-commit','store-release','retention-unlock','retention-release']);return productFailure(e)?.code===code;
  });assert.equal(entered,false);
 }
});
test('commit, connection release and retention unlock uncertainty override an expected pre-callback refusal',async()=>{
 for(const options of [{storeCommit:true},{storeRelease:true},{unlock:'false'},{unlock:'throw'},{retentionRelease:true}]){
  const f=fixture(options);await assert.rejects(f.port.withTerminalConversation(command('trash'),async()=>assert.fail('no callback')),
   e=>productFailure(e)===null&&/^RETENTION_/.test(e.code));
  assert.ok(f.calls.includes('store-release'));assert.ok(f.calls.includes('retention-release'));
 }
});
test('forged store codes, owned errors from a work callback and unrelated owned refusals stay unavailable',async()=>{
 const code='CONVERSATION_RUN_ACTIVE';
 const forged=fixture({queryError:Object.assign(Error(code),{code})});
 await assert.rejects(forged.port.withTerminalConversation(command('trash'),async()=>null),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&productFailure(e)===null);
 const late=fixture();await assert.rejects(late.port.withTerminalConversation(command('archive'),async()=>{throw new ProductError(code);}),
  e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&productFailure(e)===null);
 for(const error of [Object.assign(Error(code),{code}),new ProductError('UNRELATED_REFUSAL'),new ProductError(code,'UNKNOWN')]){
  const f=fixture(),port=createConversationManagementPort({store:{management:{available:true,async withTerminalConversation(){throw error;}}},suppression:f.suppression});
  await assert.rejects(port.withTerminalConversation(command('trash'),async()=>null),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&productFailure(e)===null);
 }
});
test('a foreign transition return cannot stand in for the private refusal marker',async()=>{
 const f=fixture(),port=createConversationManagementPort({store:f.store,suppression:{...f.suppression,async withTransition(input,work){await f.suppression.withTransition(input,work);return {code:'CONVERSATION_RUN_ACTIVE'};}}});
 await assert.rejects(port.withTerminalConversation(command('trash'),async()=>null),e=>productFailure(e)===null&&e.code==='CONVERSATION_MANAGEMENT_UNAVAILABLE');
});
