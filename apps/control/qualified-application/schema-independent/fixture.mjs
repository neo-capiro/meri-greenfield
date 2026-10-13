// Independent scripted port data, transcribed from the six unchanged DDL owners.
// Definitions below are distinguishable inert strings, NOT a PostgreSQL catalog emulator.
import {readFileSync} from 'node:fs';
export const fixture={mode:'owned-disposable-qualification',fixtureId:'11111111-2222-3333-4444-555555555555',host:'127.0.0.1',port:55432,database:'meri_qualification_test',user:'qualification_owner',systemIdentifier:'7400000000000000001',serverStartTime:'2026-10-13T00:00:00.000Z',serverVersion:'160006',schemaSha256:null};
const root=new URL('../../../../',import.meta.url);
export const paths=['apps/proxy/qualification/state/migrations/0001_qualification_state.sql','apps/proxy/qualification/state/migrations/0002_tool_budget.sql','apps/proxy/qualification/state/migrations/0003_tool_invocations.sql','apps/control/task-lookup/migrations/0001_task_lookup.sql','apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql','apps/control/commands/migrations/0001_commands.sql'];
export const ddl=paths.map(p=>readFileSync(new URL(p,root),'utf8'));
const types={i:'integer',b:'bigint',s:'text',u:'uuid',h:'character(64)',t:'timestamp with time zone',j:'jsonb',v:'character varying(128)',z:'boolean'};
// ? denotes nullable, = denotes a declared SQL DEFAULT. PK columns are NOT NULL.
const specs=[
 ['meri_qualification.budget','id:i cap_micro_usd:b consumed_micro_usd:b= quarantined:z=',{p:1,c:3}],
 ['meri_qualification.runs','run_id:u attempt:i worker_arn:s fence:i policy_revision:h',{p:1,c:3}],
 ['meri_qualification.grants','grant_id:u run_id:u attempt:i worker_arn:s fence:i policy_revision:h capability_sha256:h expires_at:t state:s',{p:1,u:1,f:1,c:4}],
 ['meri_qualification.requests','request_id:v grant_id:u run_id:u attempt:i worker_arn:s fence:i policy_revision:h native_body_sha256:h raw_request_sha256:h model_id:s profile_id:s pricing_revision:h pricing_valid_until:t input_tokens:i max_output_tokens:i hold_micro_usd:b state:s actual_micro_usd:b? evidence_sha256:h? created_at:t= settled_at:t?',{p:1,f:1,c:6}],
 ['meri_qualification.tool_run_allocations','run_id:u allocation_sha256:h allocation:j started_at:t= max_tool_calls:b max_cost_micro_usd:b',{p:1,f:1,c:3}],
 ['meri_qualification.tool_grant_bindings','grant_id:u run_id:u facts:j',{p:1,f:2}],
 ['meri_qualification.tool_reservations','invocation_id:v reservation_id:u grant_id:u run_id:u facts:j operation:j arguments_sha256:h hold_micro_usd:b max_output_bytes:b state:s charged_micro_usd:b? output_bytes:b? created_at:t= settled_at:t?',{p:1,u:1,f:2,c:7}],
 ['meri_qualification.tool_invocations','invocation_id:v run_id:u producer_key_sha256:h delivery:j facts:j raw_request_sha256:h operation:j deadline_ms:b created_at:t= reservation_id:u? arguments_sha256:h? completion:j?',{p:1,u:2,f:2,c:6}],
 ['meri_qualification.budget_liabilities','kind:s? slot:s? run_id:u? grant_id:u? state:s? hold_micro_usd:b? consumed_micro_usd:b?',{}],
 ['meri_task_lookup.lookups','tenant_id:s lookup_id:u result_reference:u payload:j state:s record:j?',{p:1,u:1,c:2}],
 ['meri_task_lookup.events','tenant_id:s run_id:u sequence:b event_id:u lookup_id:u kind:s event:j?',{p:1,u:2,f:1,c:2}],
 ['public.meri_approval_metadata','tenant_id:s actor_id:s proposal_id:u command_id:u idempotency_key:v command_sha256:h payload_sha256:h payload:j',{p:1,u:2,c:3}],
 ['public.meri_command_journal','tenant_id:s actor_id:s idempotency_key:s command_id:u command_sha256:s proposal_sha256:s payload_sha256:s payload:j executor:j state:s outcome:j? created_at:t= updated_at:t=',{p:1,u:1,c:8}]
];
export function catalog(){return specs.map(([name,cols,counts],n)=>{
 const view=name.endsWith('budget_liabilities'),partial=n===3||n===6;
 return {name,kind:view?'v':'r',owner:'qualification_owner',rowSecurity:false,forceRowSecurity:false,triggers:0,rules:view?1:0,
 columns:cols.split(' ').map(s=>{const [name,code]=s.split(':');return{name,type:types[code[0]],notNull:!code.includes('?'),default:code.includes('=')?`inert default ${name}`:null,identity:'',generated:'',collation:null};}),
 constraints:Object.entries(counts).flatMap(([kind,count])=>Array.from({length:count},(_,i)=>({name:`constraint_${kind}_${i}`,kind,definition:`inert ${kind} ${i}`,validated:true,deferrable:false,deferred:false}))),
 indexes:Array.from({length:(counts.p??0)+(counts.u??0)+(partial?1:0)},(_,i)=>({name:`index_${i}`,definition:`inert index ${i}`,unique:true,valid:true,ready:true,predicate:partial&&i===0?"state = 'UNKNOWN'":null})),view:view?'inert UNION ALL liabilities view':null};});}
export const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
export const tick=()=>new Promise(resolve=>setImmediate(resolve));
export function scripted({verify=false,onQuery,onConnect,onRelease,catalogChange,identityChange,options}={}){
 let current=Date.now();const deadlineMs=current+10000;
 const state={connects:0,releases:[],ends:0,queries:[],ddl:[],catalogReads:0};
 const cat=catalog();catalogChange?.(cat);
 const identity={database:fixture.database,username:fixture.user,address:fixture.host,port:fixture.port,version:fixture.serverVersion,start_ms:String(Date.parse(fixture.serverStartTime)),fsync:'on',synchronous_commit:'on',system_identifier:fixture.systemIdentifier,search_path:'public'};identityChange?.(identity);
 const client={async query(config){
  state.queries.push(config);const text=config.text;
  const intercepted=await onQuery?.(config,state);if(intercepted!==undefined)return intercepted;
  if(ddl.includes(text)){state.ddl.push(text);return{rows:[]};}
  if(text.startsWith('SELECT current_database()'))return{rows:[identity]};
  if(text.includes('pg_try_advisory_xact_lock'))return{rows:[{acquired:true}]};
  if(text.startsWith('SELECT nspname AS name'))return{rows:verify||ddl.every(sql=>state.queries.some(q=>q.text===sql))?[{name:'meri_qualification',owner:'qualification_owner',acl:null},{name:'meri_task_lookup',owner:'qualification_owner',acl:null}]:[]};
  if(text.startsWith('SELECT t.typname'))return{rows:[]};
  if(text.startsWith('SELECT n.nspname')){state.catalogReads++;return{rows:!verify&&state.catalogReads===1?[]:cat};}
  if(text.startsWith('SELECT id,cap_micro_usd'))return{rows:[{id:1,cap_micro_usd:'10000000',consumed_micro_usd:'0',quarantined:false}]};
  if(text.startsWith("SELECT 'meri_qualification.budget'"))return{rows:specs.filter(([n])=>!n.endsWith('budget_liabilities')).map(([name])=>({name,count:name==='meri_qualification.budget'?'1':'0'}))};
  if(['BEGIN','COMMIT','ROLLBACK'].includes(text)||text.startsWith('SET LOCAL '))return{rows:[]};
  throw Error('UNEXPECTED_SCRIPTED_SQL');
 },release(error){state.releases.push(error);onRelease?.(error);}};
 const pool={options:{host:fixture.host,port:fixture.port,database:fixture.database,user:fixture.user,connectionTimeoutMillis:5000,query_timeout:6000,...options},async connect(){state.connects++;return onConnect?onConnect(client):client;},end(){state.ends++;throw Error('BORROWED_POOL_CLOSE');}};
 return{state,pool,client,cat,identity,deadlineMs,now:()=>current,setNow:n=>{current=n;},args:{pool,fixture:{...fixture},deadlineMs,now:()=>current}};
}
