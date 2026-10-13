import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareOwnedApplicationSchema,verifyOwnedApplicationSchema} from './schema.mjs';

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
 const f=fixture(),log=[],releases=[],state={installed:false,catalog:catalog(),budget:{id:1,cap_micro_usd:'10000000',consumed_micro_usd:'0',quarantined:false},locked:null,commits:0,ended:0};let next=0;
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
const ddls=s=>s.log.filter(r=>ddl.includes(r.text));
const rejects=async(work,outcome,stage)=>assert.rejects(work,e=>e.code==='QUALIFICATION_SCHEMA_REFUSED'&&e.outcome===outcome&&(!stage||e.stage===stage)&&!JSON.stringify(e).includes('PASSWORD'));

test('installs exactly the six unchanged files, then verifies13 relations and empty accounting',async()=>{
 const s=scripted(),r=await prepareOwnedApplicationSchema(s.args());assert.equal(r.status,'PASS');assert.equal(r.operation,'installed');assert.equal(r.relationCount,13);assert.equal(r.initialStateVerified,true);assert.match(r.schemaSha256,/^[a-f0-9]{64}$/);assert.deepEqual(Object.keys(r.migrationSha256),['qualification','budget','invocation','lookup','metadata','command']);assert.deepEqual(ddls(s).map(r=>r.text),ddl);assert(s.log.findIndex(r=>r.text.startsWith('SELECT current_database'))<s.log.findIndex(r=>ddl.includes(r.text)));assert(s.log.some(r=>r.text==='SET LOCAL search_path TO public'));assert.equal(s.state.commits,1);assert.equal(s.releases.length,1);assert.equal(s.state.ended,0);assert(Object.isFrozen(r.catalog[0].columns));
});
test('reconstruction permits retained accounting but binds original complete catalog hash',async()=>{
 const s=scripted(),initial=await prepareOwnedApplicationSchema(s.args());s.state.budget.consumed_micro_usd='20';s.state.budget.quarantined=true;
 const before=ddls(s).length,r=await verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:initial.schemaSha256}});assert.equal(r.operation,'verified');assert.equal(r.initialStateVerified,false);assert.equal(r.budget.consumed_micro_usd,'20');assert.equal(r.budget.quarantined,true);assert.equal(ddls(s).length,before);assert.equal(r.schemaSha256,initial.schemaSha256);
});
for(const [field,value]of Object.entries({database:'other',username:'postgres',address:'::1',port:55433,version:'170010',start_ms:'0',system_identifier:'different',fsync:'off',synchronous_commit:'off',search_path:'private, public'}))test(`identity ${field} mismatch refuses before DDL`,async()=>{const s=scripted({identity:{[field]:value}});await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','identity');assert.equal(ddls(s).length,0);assert.equal(s.releases.length,1);});
test('closed descriptor, accessors, proxy and expired/cancelled inputs allocate no client',async()=>{
 const s=scripted();for(const change of [{fixture:{...s.f,extra:true}},{fixture:new Proxy(s.f,{})},{deadlineMs:Date.now()-1},{deadlineMs:Date.now()+120000},{signal:AbortSignal.abort()}])await rejects(prepareOwnedApplicationSchema({...s.args(),...change}),'NOT_INSTALLED','admission');let getters=0;const f={...s.f};Object.defineProperty(f,'host',{get(){getters++;return '127.0.0.1';},enumerable:true});await rejects(prepareOwnedApplicationSchema({...s.args(),fixture:f}),'NOT_INSTALLED');assert.equal(getters,0);assert.equal(s.log.length,0);
});
test('install refuses partial namespaces, preexisting relation and same fixture reapply',async()=>{
 for(const opts of [{namespaces:[{name:'meri_qualification'}]},{preexisting:[{name:'public.other'}]}]){const s=scripted(opts);await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');assert.equal(ddls(s).length,0);}
 const s=scripted();await prepareOwnedApplicationSchema(s.args());await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');assert.equal(ddls(s).length,6);
});
test('concurrent installers cannot both acquire fixed transaction lock',async()=>{
 let unlock;const barrier=new Promise(r=>unlock=r);let arrived;const entered=new Promise(r=>arrived=r);
 const s=scripted({before:async text=>{if(text===ddl[0]){arrived();await barrier;}}});const first=prepareOwnedApplicationSchema(s.args());await entered;await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');unlock();assert.equal((await first).status,'PASS');assert.equal(ddls(s).length,6);
});
for(const [name,change]of Object.entries({missing:r=>r.pop(),nullable:r=>r[0].columns[0].notNull=false,type:r=>r[0].columns[0].type='text',constraint:r=>r[0].constraints.pop(),unvalidated:r=>r[0].constraints[0].validated=false,index:r=>r[0].indexes[0].valid=false,trigger:r=>r[0].triggers=1,owner:r=>r[0].owner='other',view:r=>r[8].view=null,rowSecurity:r=>r[0].rowSecurity=true}))test(`post-install ${name} corruption is UNKNOWN, never retry/success`,async()=>{const s=scripted();change(s.state.catalog);await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN','catalog');assert.equal(ddls(s).length,6);assert.equal(s.state.commits,0);assert.equal(s.releases.length,1);});
test('reconstruction catches changed check definition even when type/counts remain',async()=>{const s=scripted(),r=await prepareOwnedApplicationSchema(s.args());s.state.catalog[0].constraints[0].definition='changed semantically';await rejects(verifyOwnedApplicationSchema({...s.args(),fixture:{...s.f,schemaSha256:r.schemaSha256}}),'READ_UNAVAILABLE','catalog');assert.equal(ddls(s).length,6);});
test('fresh install requires exact empty application rows and zero unquarantined accounting',async()=>{for(const dirty of ['rows','consumed','quarantine']){const s=scripted({dirty:dirty==='rows'});if(dirty==='consumed')s.state.budget.consumed_micro_usd='1';if(dirty==='quarantine')s.state.budget.quarantined=true;await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN','accounting');}});
test('migration, commit and release errors preserve UNKNOWN and no retry',async()=>{
 for(const opts of [{fail:ddl[2]},{loseCommit:true},{releaseFails:true}]){const s=scripted(opts);await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN');assert.equal(ddls(s).filter(r=>r.text===ddl[0]).length,1);assert.equal(s.state.ended,0);assert.equal(s.releases.length,1);}
});
test('unknown errors are not reflected or evaluated',async()=>{let getter=0;const s=scripted({before(text){if(text===ddl[0])throw Object.defineProperty({},'message',{get(){getter++;throw Error('PASSWORD-CANARY');}});}});await rejects(prepareOwnedApplicationSchema(s.args()),'UNKNOWN','migration');assert.equal(getter,0);});
test('owner query timeout6000 is admitted and shorter bound is preserved for every query',async()=>{const s=scripted();s.pool.options.query_timeout=97;await prepareOwnedApplicationSchema(s.args());assert(s.log.every(r=>r.query_timeout<=97&&r.query_timeout>0));for(const query_timeout of [0,6001,Infinity]){const bad=scripted();bad.pool.options.query_timeout=query_timeout;await rejects(prepareOwnedApplicationSchema(bad.args()),'NOT_INSTALLED','admission');assert.equal(bad.log.length,0);}});
test('late acquisition is released with no BEGIN or DDL after original deadline',async()=>{
 let resolve,entered;const gate=new Promise(r=>resolve=r),started=new Promise(r=>entered=r);const s=scripted({connect:()=>{entered();return gate;}}),pending=prepareOwnedApplicationSchema({...s.args(),deadlineMs:Date.now()+50});await started;await rejects(pending,'NOT_INSTALLED');resolve();await new Promise(r=>setTimeout(r,10));assert.equal(s.log.length,0);assert.equal(s.releases.length,1);assert.equal(s.state.ended,0);
});
test('cancelled parked migration remains UNKNOWN, then rolls back and releases without another DDL',async()=>{
 let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r),controller=new AbortController();const s=scripted({before:async text=>{if(text===ddl[0]){enter();await gate;}}});const pending=prepareOwnedApplicationSchema({...s.args(),signal:controller.signal});await entered;controller.abort();await rejects(pending,'UNKNOWN','migration');release();await new Promise(r=>setTimeout(r,10));assert.equal(ddls(s).length,1);assert(s.log.some(r=>r.text==='ROLLBACK'));assert.equal(s.releases.length,1);assert.equal(s.state.commits,0);
});
test('absolute clock advancement after identity prevents migration despite responsive ports',async()=>{
 let now=Date.now();const s=scripted({before(text){if(text.startsWith('SELECT current_database'))now+=1000;}});await rejects(prepareOwnedApplicationSchema({...s.args(),now:()=>now,deadlineMs:now+500}),'NOT_INSTALLED','identity');assert.equal(ddls(s).length,0);
});
test('receipt binds original cutoff and reports port observation without native qualification',async()=>{const s=scripted(),args=s.args(),r=await prepareOwnedApplicationSchema(args);assert.equal(r.originalDeadlineMs,args.deadlineMs);assert.equal(r.evidenceKind,'borrowed-pool-catalog-observation');assert.equal(r.runtimeQualified,false);assert.equal(r.poolClosed,false);});
test('namespace query excludes only literal pg_ prefix and refuses user pgx_private',async()=>{
 const s=scripted({namespaces:[{name:'pgx_private'}]});await rejects(prepareOwnedApplicationSchema(s.args()),'NOT_INSTALLED','ownership');assert.equal(ddls(s).length,0);
 const query=s.log.find(r=>r.text.startsWith('SELECT nspname')).text;
 assert.doesNotMatch(query,/NOT\s+LIKE\s+'pg_%'/i);
 assert.match(query,/left\(nspname,3\)\s*<>\s*'pg_'/i);
});
