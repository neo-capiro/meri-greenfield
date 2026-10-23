/** Trusted Core callback outcomes across the actual retention PostgreSQL adapter, with a scripted SQL lease (no database). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreConversationManagementOwner} from '../conversation-management-composition.mjs';
import {createPostgresRetentionJournal} from '../../control/retention/postgres-journal.mjs';
const key='tenant:conversation:00000000-0000-4000-8000-000000000001';
const conflict=()=>Object.assign(Error('REQUEST_ID_CONFLICT'),{status:409});
function fixture({unlock='ok',release='ok',afterWork=null,work=async()=>{throw conflict();}}={}){
 const released=[],queries=[],sqlError=Object.assign(Error('SYNTHETIC_CONNECTION_FAILURE'),{code:'08006'});
 const pool={async connect(){return {async query(sql){queries.push(sql);
  if(sql.startsWith('SELECT pg_advisory_unlock')){if(unlock==='throw')throw sqlError;return {rows:[{unlocked:unlock==='ok'}]};}
  return {rows:[]};},release(error){released.push(error);if(release==='throw')throw sqlError;}};}};
 const journal=createPostgresRetentionJournal({pool,maxRequestMs:100}),prisma={async withTenant(){}};
 const core={async readManagedConversationMetadata(){},async readManagedConversationOwner(){},
  async manageConversation(p,_ctx,request,port){assert.equal(p,prisma);return port.withTerminalConversation(request,work);}};
 const owner=createCoreConversationManagementOwner({prisma,core});
 const port={withTerminalConversation(command,callback){return journal.withTransition(key,async()=>{const value=await callback(Object.freeze({}));if(afterWork)throw afterWork;return value;});}};
 return {owner,port,journal,released,queries,run:()=>owner.manage({principal:{tenantId:'tenant',actorId:'actor'},request:{}},port)};
}
test('only the captured Core callback preserves its exact refusal after successful transition unlock',async()=>{
 const refusal=conflict(),f=fixture({work:async()=>{throw refusal;}});
 await assert.rejects(f.run(),e=>e===refusal&&e.status===409);
 assert.equal(f.released.length,1);assert.equal(f.released[0],undefined);assert.match(f.queries.at(-1),/^SELECT pg_advisory_unlock/);
 // Identical public-looking callback errors outside the trusted Core bridge retain the journal's fail-closed policy.
 await assert.rejects(f.journal.withTransition(key,async()=>{throw refusal;}),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&e!==refusal);
});
test('uncertain unlock, lease release and conversation-store commit override a pending Core refusal',async()=>{
 const refusal=conflict();
 for(const options of [{unlock:'false'},{unlock:'throw'},{release:'throw'},{afterWork:Object.assign(Error('STORE_COMMIT_UNKNOWN'),{code:'STORE_COMMIT_UNKNOWN'})}]){
  const f=fixture({...options,work:async()=>{throw refusal;}});
  await assert.rejects(f.run(),e=>e!==refusal&&/^RETENTION_/.test(e.code));
  assert.equal(f.released.length,1);
  if(options.unlock)assert.ok(f.released[0] instanceof Error,'uncertain lock lease is retired');
 }
});
test('success and unknown Core outcomes are exact; a forged or different return cannot substitute for the private outcome',async()=>{
 const receipt=Object.freeze({revision:'1'}),success=fixture({work:async()=>receipt});assert.equal(await success.run(),receipt);
 const unknown=Error('SYNTHETIC_CORE_COMMIT_UNKNOWN'),failed=fixture({work:async()=>{throw unknown;}});await assert.rejects(failed.run(),e=>e===unknown);
 for(const withTerminalConversation of [async()=>({error:conflict()}),async(_command,work)=>({marker:await work({})}),async(_command,work)=>{await work({});return work({});}]){
  await assert.rejects(success.owner.manage({principal:{tenantId:'tenant',actorId:'actor'},request:{}},{withTerminalConversation}),/CONVERSATION_MANAGEMENT_(UNAVAILABLE|CONFIGURATION)/);
 }
});
