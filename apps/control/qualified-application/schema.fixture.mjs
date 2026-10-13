/** Source-test-only scripted observations. No PostgreSQL/database import or execution. */
import {readFile} from 'node:fs/promises';

const root=new URL('../../../',import.meta.url);
const paths=['apps/proxy/qualification/state/migrations/0001_qualification_state.sql','apps/proxy/qualification/state/migrations/0002_tool_budget.sql','apps/proxy/qualification/state/migrations/0003_tool_invocations.sql','apps/control/task-lookup/migrations/0001_task_lookup.sql','apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql','apps/control/commands/migrations/0001_commands.sql'];
const ddl=await Promise.all(paths.map(p=>readFile(new URL(p,root),'utf8')));
// Scripted catalog observations, not a SQL interpreter or native PG evidence.
const definitions=[
 ['meri_qualification.budget','id:i cap_micro_usd:b consumed_micro_usd:b= quarantined:o=',{p:1,c:3}],
 ['meri_qualification.runs','run_id:u attempt:i worker_arn:t fence:i policy_revision:h',{p:1,c:3}],
 ['meri_qualification.grants','grant_id:u run_id:u attempt:i worker_arn:t fence:i policy_revision:h capability_sha256:h expires_at:z state:t',{p:1,u:1,f:1,c:4}],
 ['meri_qualification.requests','request_id:v grant_id:u run_id:u attempt:i worker_arn:t fence:i policy_revision:h native_body_sha256:h raw_request_sha256:h model_id:t profile_id:t pricing_revision:h pricing_valid_until:z input_tokens:i max_output_tokens:i hold_micro_usd:b state:t actual_micro_usd:b? evidence_sha256:h? created_at:z= settled_at:z?',{p:1,f:1,c:6}],
 ['meri_qualification.tool_run_allocations','run_id:u allocation_sha256:h allocation:j started_at:z= max_tool_calls:b max_cost_micro_usd:b',{p:1,f:1,c:3}],
 ['meri_qualification.tool_grant_bindings','grant_id:u run_id:u facts:j',{p:1,f:2}],
 ['meri_qualification.tool_reservations','invocation_id:v reservation_id:u grant_id:u run_id:u facts:j operation:j arguments_sha256:h hold_micro_usd:b max_output_bytes:b state:t charged_micro_usd:b? output_bytes:b? created_at:z= settled_at:z?',{p:1,u:1,f:2,c:7}],
 ['meri_qualification.tool_invocations','invocation_id:v run_id:u producer_key_sha256:h delivery:j facts:j raw_request_sha256:h operation:j deadline_ms:b created_at:z= reservation_id:u? arguments_sha256:h? completion:j?',{p:1,u:2,f:2,c:6}],
 ['meri_qualification.budget_liabilities','kind:t? slot:t? run_id:u? grant_id:u? state:t? hold_micro_usd:b? consumed_micro_usd:b?',{}],
 ['meri_task_lookup.lookups','tenant_id:t lookup_id:u result_reference:u payload:j state:t record:j?',{p:1,u:1,c:2}],
 ['meri_task_lookup.events','tenant_id:t run_id:u sequence:b event_id:u lookup_id:u kind:t event:j?',{p:1,u:2,f:1,c:2}],
 ['public.meri_approval_metadata','tenant_id:t actor_id:t proposal_id:u command_id:u idempotency_key:v command_sha256:h payload_sha256:h payload:j',{p:1,u:2,c:3}],
 ['public.meri_command_journal','tenant_id:t actor_id:t idempotency_key:t command_id:u command_sha256:t proposal_sha256:t payload_sha256:t payload:j executor:j state:t outcome:j? created_at:z= updated_at:z=',{p:1,u:1,c:8}],
];
function catalog(){return definitions.map(([name,fields,counts])=>{
 const view=name.endsWith('.budget_liabilities'),partial=['meri_qualification.requests','meri_qualification.tool_reservations'].includes(name),indexes=[];
 for(let i=0;i<(counts.p??0)+(counts.u??0)+(partial?1:0);i++)indexes.push({name:'index_'+i,definition:'scripted unique index '+i,unique:true,valid:true,ready:true,predicate:partial&&i===(counts.p??0)+(counts.u??0)?"state = 'UNKNOWN'":null});
 return {name,kind:view?'v':'r',owner:'qualification_owner',rowSecurity:false,forceRowSecurity:false,triggers:0,rules:view?1:0,
 columns:fields.split(' ').map(field=>{const [name,spec]=field.split(':');return {name,type:{i:'integer',b:'bigint',o:'boolean',u:'uuid',t:'text',h:'character(64)',z:'timestamp with time zone',v:'character varying(128)',j:'jsonb'}[spec[0]],notNull:!spec.includes('?'),default:spec.includes('=')?'scripted default':null,identity:'',generated:'',collation:null};}),
 constraints:Object.entries(counts).flatMap(([kind,n])=>Array.from({length:n},(_,i)=>({name:kind+i,kind,definition:'scripted '+kind+i,validated:true,deferrable:false,deferred:false}))),indexes,view:view?'scripted canonical union':null};
});}
function fixture(overrides={}){return {mode:'owned-disposable-qualification',fixtureId:'11111111-1111-1111-1111-111111111111',host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',systemIdentifier:'1234567890123456789',serverStartTime:'2026-10-13T00:00:00.000Z',serverVersion:'170011',schemaSha256:null,...overrides};}
function scripted(options={}){
 const f=fixture(options.fixture),log=[],releases=[],state={installed:false,catalog:catalog(),budget:{id:1,cap_micro_usd:'10000000',consumed_micro_usd:'0',quarantined:false},locked:null,commits:0,ended:0};let next=0;
 const pool={options:{connectionTimeoutMillis:5000,query_timeout:6000},async connect(){
  const id=++next;await options.connect?.();return {async query(config){
   const {text}=config;log.push({id,...config});await options.before?.(text,state);
   if(options.fail===text)throw Object.assign(new Error('PASSWORD-CANARY'),{get secret(){throw Error('getter');}});
   let result={rows:[]};
   if(text==='COMMIT'){state.commits++;if(state.locked===id)state.locked=null;if(options.loseCommit)throw Error('PASSWORD-CANARY');}
   else if(text==='ROLLBACK'){if(state.locked===id)state.locked=null;}
   else if(text.startsWith('SELECT current_database()'))result={rows:[{database:f.database,username:f.user,address:f.host,port:f.port,version:f.serverVersion,start_ms:String(Date.parse(f.serverStartTime)),fsync:'on',synchronous_commit:'on',system_identifier:f.systemIdentifier,search_path:'public',...options.identity}]};
   else if(text.startsWith('SELECT pg_catalog.pg_try')){const acquired=state.locked===null;state.locked??=id;result={rows:[{acquired}]};}
   else if(text.startsWith('SELECT nspname'))result={rows:state.installed?[{name:'meri_qualification'},{name:'meri_task_lookup'}]:options.namespaces??[]};
   else if(text.startsWith('SELECT n.nspname'))result={rows:state.installed?structuredClone(state.catalog):options.preexisting??[]};
   else if(ddl.includes(text)){if(text===ddl.at(-1))state.installed=true;result=[{rows:[]},{rows:[]}];}
   else if(text.startsWith('SELECT id,cap_'))result={rows:[{...state.budget}]};
   else if(text.startsWith("SELECT 'meri_qualification.budget'"))result={rows:definitions.filter(([n])=>!n.endsWith('.budget_liabilities')).map(([name])=>({name,count:name==='meri_qualification.budget'?'1':'0'})).map(row=>options.dirty&&row.name==='public.meri_command_journal'?{...row,count:'1'}:row)};
   return result;
  },release(error){releases.push(error);if(options.releaseFails)throw Error('PASSWORD-CANARY');}};
 },end(){state.ended++;}};
 return {pool,f,log,releases,state,args:()=>({pool,fixture:f,deadlineMs:Date.now()+5000})};
}

export {scripted as createScriptedSchemaFixture,fixture as fixtureSchemaDescriptor,ddl as fixtureMigrationBytes,catalog as fixtureCatalog};
