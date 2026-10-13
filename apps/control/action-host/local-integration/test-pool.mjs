/** One scripted budget ledger. Other existing SQL fixtures route on their owned tables. No native DB. */
import {harness} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {createTaskLookupPoolFixture} from '../../task-lookup/postgres-fixture.mjs';
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {scriptedPool} from '../../test/commands-fixture.mjs';
export function createSharedPool(){
 const h=harness(),lookup=createTaskLookupPoolFixture(),metadata=createMetadataPoolFixture(),journal=scriptedPool({}),seed=[];let opened=0,closed=0;
 h.state().run=null;h.state().grant=null;h.state().grants.clear();
 function pool(){return {options:{connectionTimeoutMillis:1000,query_timeout:1000},async connect(){let c,kind,setup=[];
  async function select(sql){if(c)return;c=await (sql.includes('meri_approval_metadata')?metadata.pool:sql.includes('meri_command_journal')?journal.pool:sql.includes('meri_task_')?lookup.pool:h.pool).connect();kind=sql.includes('meri_approval_metadata')?'metadata':sql.includes('meri_command_journal')?'journal':sql.includes('meri_task_')?'lookup':'budget';for(const q of setup)await c.query(q);setup=[];}
  return {async query(sql,args=[]){const text=typeof sql==='string'?sql:sql.text;if(text==='BEGIN'||text.startsWith('SET LOCAL')){if(c)return c.query(sql,args);setup.push(sql);return {rows:[]};}
   if(text.startsWith('INSERT INTO meri_qualification.runs')){seed.push({kind:'run',args});return {rows:[]};}
   if(text.startsWith('INSERT INTO meri_qualification.grants')){seed.push({kind:'grant',args});return {rows:[]};}
   if(text==='COMMIT'&&seed.length){await select(text);const out=await c.query(sql,args);for(const v of seed.splice(0)){const a=v.args;if(v.kind==='run')h.state().run={run_id:a[0],attempt:a[1],worker_arn:a[2],fence:a[3],policy_revision:a[4]};else h.state().grants.set(a[0],{grant_id:a[0],run_id:a[1],attempt:a[2],worker_arn:a[3],fence:a[4],policy_revision:a[5],capability_sha256:a[6],expires_at:new Date(a[7]),state:'ACTIVE'});}return out;}
   await select(text);h.setClock(Date.now());
   if(text.includes('grant_id=ANY'))return {rows:[...h.state().bindings.values()].filter(r=>args[0].includes(r.grant_id))};
   if(text==='SELECT * FROM meri_qualification.tool_reservations WHERE run_id=$1')return {rows:[...h.state().reservations.values()].filter(r=>r.run_id===args[0])};
   return c.query(sql,args);
  },release(error){c?.release(error);}};
 },end(){throw Error('Borrowed pool end forbidden');}};}
 const initial=pool();return {pool:initial,h,lookup,metadata,journal,async fresh(){opened++;return {pool:pool(),close:async()=>{closed++;}};},stats:()=>({opened,closed})};
}
