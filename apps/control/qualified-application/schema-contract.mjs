/** Fixed qualification schema identities and inert admission; no connections or DDL. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {isIP} from 'node:net';
import {own,data,nativeSignal,instant} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {snapshotPreservationData} from '../../../packages/contracts/retrieval-0.2/operation-contracts.mjs';
export {snapshotPreservationData as preservationData};

export const migrations=data([
 ['qualification','apps/proxy/qualification/state/migrations/0001_qualification_state.sql','fa33f51c492361c280c4847ea08629f0c777cb6b0e9652f1e67f95543bda0dfc'],
 ['budget','apps/proxy/qualification/state/migrations/0002_tool_budget.sql','53d3933a440ed0801411d3ed544f4c554f397b3338acaad1ce1addcce4ef5809'],
 ['invocation','apps/proxy/qualification/state/migrations/0003_tool_invocations.sql','8d0c6ab5e3027b637f7905bd19ac1d830095f1565f745d4e2954294b115137e5'],
 ['lookup','apps/control/task-lookup/migrations/0001_task_lookup.sql','ae3197c4f898c5a8a493b2bee4cd6c5da16c62730ad3447e4f07ebfeaf1c100f'],
 ['metadata','apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql','448678c2241e40e28190987c1f60c3492f39f9a43da8bc6ae6f0708efdd2d1a5'],
 ['command','apps/control/commands/migrations/0001_commands.sql','64f679e434dbc9d54d700af83357296ba3f4cb2c52e382c72e0d7c1caad7c936'],
]);
// Column order and constraint cardinalities come from those exact migrations.
// Full server definitions (including CHECKs/defaults/index predicates/view) are
// captured in the receipt and must match on reconstruction, without a SQL parser.
export const relations=data([
 ['meri_qualification.budget','id,cap_micro_usd,consumed_micro_usd,quarantined',{p:1,c:3}],
 ['meri_qualification.runs','run_id,attempt,worker_arn,fence,policy_revision',{p:1,c:3}],
 ['meri_qualification.grants','grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state',{p:1,u:1,f:1,c:4}],
 ['meri_qualification.requests','request_id,grant_id,run_id,attempt,worker_arn,fence,policy_revision,native_body_sha256,raw_request_sha256,model_id,profile_id,pricing_revision,pricing_valid_until,input_tokens,max_output_tokens,hold_micro_usd,state,actual_micro_usd,evidence_sha256,created_at,settled_at',{p:1,f:1,c:6}],
 ['meri_qualification.tool_run_allocations','run_id,allocation_sha256,allocation,started_at,max_tool_calls,max_cost_micro_usd',{p:1,f:1,c:3}],
 ['meri_qualification.tool_grant_bindings','grant_id,run_id,facts',{p:1,f:2}],
 ['meri_qualification.tool_reservations','invocation_id,reservation_id,grant_id,run_id,facts,operation,arguments_sha256,hold_micro_usd,max_output_bytes,state,charged_micro_usd,output_bytes,created_at,settled_at',{p:1,u:1,f:2,c:7}],
 ['meri_qualification.tool_invocations','invocation_id,run_id,producer_key_sha256,delivery,facts,raw_request_sha256,operation,deadline_ms,created_at,reservation_id,arguments_sha256,completion',{p:1,u:2,f:2,c:6}],
 ['meri_qualification.budget_liabilities','kind,slot,run_id,grant_id,state,hold_micro_usd,consumed_micro_usd',{}],
 ['meri_task_lookup.lookups','tenant_id,lookup_id,result_reference,payload,state,record',{p:1,u:1,c:2}],
 ['meri_task_lookup.events','tenant_id,run_id,sequence,event_id,lookup_id,kind,event',{p:1,u:2,f:1,c:2}],
 ['meri_commands.approval_metadata','tenant_id,actor_id,proposal_id,command_id,idempotency_key,command_sha256,payload_sha256,payload', {p:1,u:2,c:3}],
 ['meri_commands.command_journal','tenant_id,actor_id,idempotency_key,command_id,command_sha256,proposal_sha256,payload_sha256,payload,executor,state,outcome,created_at,updated_at',{p:1,u:1,c:8}],
]);
const columnTypes=[
 'int,big,big,bool', 'uuid,int,text,int,hash', 'uuid,uuid,int,text,int,hash,hash,time,text',
 'id,uuid,uuid,int,text,int,hash,hash,hash,text,text,hash,time,int,int,big,text,big,hash,time,time',
 'uuid,hash,json,time,big,big', 'uuid,uuid,json', 'id,uuid,uuid,uuid,json,json,hash,big,big,text,big,big,time,time',
 'id,uuid,hash,json,json,hash,json,big,time,uuid,hash,json', 'text,text,uuid,uuid,text,big,big',
 'text,uuid,uuid,json,text,json', 'text,uuid,big,uuid,uuid,text,json', 'text,text,uuid,uuid,id,hash,hash,json',
 'text,text,text,uuid,text,text,text,json,json,text,json,time,time',
];
const sqlTypes={int:'integer',big:'bigint',bool:'boolean',uuid:'uuid',text:'text',hash:'character(64)',time:'timestamp with time zone',id:'character varying(128)',json:'jsonb'};
const nullable=[[],[],[],['actual_micro_usd','evidence_sha256','settled_at'],[],[],['charged_micro_usd','output_bytes','settled_at'],['reservation_id','arguments_sha256','completion'],relations[8][1].split(','),['record'],['event'],[],['outcome']];
const defaults=[['consumed_micro_usd','quarantined'],[],[],['created_at'],['started_at'],[],['created_at'],['created_at'],[],[],[],[],['created_at','updated_at']];
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const requireSchema=condition=>{if(!condition)throw new Error('QUALIFICATION_SCHEMA_REFUSED');};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function fixtureDescriptor(value,allowUnprepared=false){
 const f=data(own(value,['mode','fixtureId','host','port','database','user','systemIdentifier','serverStartTime','serverVersion','schemaSha256'],['serverAddress','serverPort','schemaScope']));
 requireSchema(f.mode==='owned-disposable-qualification'&&typeof f.fixtureId==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(f.fixtureId));
 requireSchema(f.host==='127.0.0.1'&&Number.isSafeInteger(f.port)&&f.port>=1&&f.port<=65535&&f.database==='meri_qualification_test'&&f.user==='qualification_owner');
 requireSchema(typeof f.systemIdentifier==='string'&&/^[0-9]{1,20}$/.test(f.systemIdentifier)&&typeof f.serverVersion==='string'&&/^[1-9][0-9]{5}$/.test(f.serverVersion));instant(f.serverStartTime);
 requireSchema(allowUnprepared&&f.schemaSha256===null||hash(f.schemaSha256));
 const paired=Object.hasOwn(f,'serverAddress');requireSchema(paired===Object.hasOwn(f,'serverPort'));
 if(paired)requireSchema(typeof f.serverAddress==='string'&&isIP(f.serverAddress)!==0&&!f.serverAddress.includes('%')&&Number.isSafeInteger(f.serverPort)&&f.serverPort>=1&&f.serverPort<=65535);
 if(Object.hasOwn(f,'schemaScope')){
  const scope=own(f.schemaScope,['mode','namespaces']);requireSchema(scope.mode==='preserve-declared-evidence'&&Array.isArray(scope.namespaces)&&scope.namespaces.length>=1&&scope.namespaces.length<=128);
  for(const n of scope.namespaces){own(n,['name','owner']);requireSchema(typeof n.name==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(n.name)&&!n.name.startsWith('pg_')&&!['public','information_schema','meri_qualification','meri_task_lookup','meri_commands'].includes(n.name)&&typeof n.owner==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(n.owner));}
  requireSchema(new Set(scope.namespaces.map(n=>n.name)).size===scope.namespaces.length);
 }
 return f;
}
export function schemaConfiguration(value,install){
 const c=own(value,['pool','fixture','deadlineMs'],['signal','now']);
 const now=c.now??Date.now;requireSchema(typeof now==='function');
 const began=now();requireSchema(Number.isSafeInteger(began)&&began>=0&&Number.isSafeInteger(c.deadlineMs)&&c.deadlineMs>began&&c.deadlineMs-began<=60000);nativeSignal(c.signal);requireSchema(!c.signal?.aborted);
 const f=fixtureDescriptor(c.fixture,install);requireSchema(!install||f.schemaSha256===null);
 const connect=portMethod(c.pool,'connect'),opts=portValue(c.pool,'options');
 requireSchema(portValue(opts,'host')===f.host&&portValue(opts,'port')===f.port&&portValue(opts,'database')===f.database&&portValue(opts,'user')===f.user);
 const connectionTimeout=portValue(opts,'connectionTimeoutMillis'),queryTimeout=portValue(opts,'query_timeout');
 requireSchema(Number.isSafeInteger(connectionTimeout)&&connectionTimeout>0&&connectionTimeout<=5000&&Number.isSafeInteger(queryTimeout)&&queryTimeout>0&&queryTimeout<=6000);
 return {...c,fixture:f,now,began,connect,queryTimeout:Math.min(queryTimeout,5000)};
}
export function portValue(value,name){
 requireSchema(value!==null&&typeof value==='object'&&!types.isProxy(value));
 for(let v=value;v;v=Object.getPrototypeOf(v)){
  requireSchema(!types.isProxy(v));const d=Object.getOwnPropertyDescriptor(v,name);
  if(d){requireSchema(Object.hasOwn(d,'value'));return d.value;}
 }
 throw new Error('QUALIFICATION_SCHEMA_PORT');
}
export function portMethod(value,name){const method=portValue(value,name);requireSchema(typeof method==='function');return method.bind(value);}
function boundedRows(result,maxBytes,oneRow,snapshot=data){
 const r=snapshot(portValue(result,'rows'));
 requireSchema(Array.isArray(r)&&(oneRow?r.length===1:r.length<=1024)&&Buffer.byteLength(JSON.stringify(r),'utf8')<=maxBytes);
 return r;
}
export function rows(result){return boundedRows(result,1048576,false);}
// Only the fixed preservation query uses this ceiling. Keep the full metadata,
// shared inert/depth guards, fixed250000 nodes and exactly one row; no caller limit.
export function preservationRows(result){return boundedRows(result,4194304,true,snapshotPreservationData);}

export function assertCatalog(value){
 const catalog=data(value);requireSchema(Array.isArray(catalog)&&catalog.length===relations.length);
 const signatures=[];
 for(const [relationIndex,[name,columns,counts]]of relations.entries()){
  const matches=catalog.filter(row=>row.name===name);requireSchema(matches.length===1);
  const row=own(matches[0],['name','kind','columns','constraints','indexes','view','owner','rowSecurity','forceRowSecurity','triggers','rules']);
  requireSchema(row.owner==='qualification_owner'&&row.rowSecurity===false&&row.forceRowSecurity===false&&row.triggers===0&&row.rules===(name.endsWith('.budget_liabilities')?1:0));
  const view=name.endsWith('.budget_liabilities');requireSchema(row.kind===(view?'v':'r')&&Array.isArray(row.columns)&&row.columns.length===columns.split(',').length);
  for(const [i,column]of row.columns.entries()){
   own(column,['name','type','notNull','default','identity','generated','collation']);requireSchema(column.name===columns.split(',')[i]&&column.type===sqlTypes[columnTypes[relationIndex].split(',')[i]]&&column.notNull===!nullable[relationIndex].includes(column.name)&&(defaults[relationIndex].includes(column.name)?typeof column.default==='string'&&column.default.length>0:column.default===null)&&column.identity===''&&column.generated===''&&(column.collation===null||typeof column.collation==='string'));
  }
  requireSchema(Array.isArray(row.constraints)&&Array.isArray(row.indexes));
  for(const kind of ['p','u','f','c'])requireSchema(row.constraints.filter(c=>c.kind===kind).length===(counts[kind]??0));
  requireSchema(row.constraints.length===Object.values(counts).reduce((a,b)=>a+b,0));
  for(const c of row.constraints){own(c,['name','kind','definition','validated','deferrable','deferred']);requireSchema(typeof c.name==='string'&&c.name.length>0&&typeof c.definition==='string'&&c.definition.length>0&&c.validated===true&&c.deferrable===false&&c.deferred===false);}
  requireSchema(new Set(row.constraints.map(c=>c.name)).size===row.constraints.length);
  const partial=['meri_qualification.requests','meri_qualification.tool_reservations'].includes(name)?1:0;
  requireSchema(row.indexes.length===(counts.p??0)+(counts.u??0)+partial);
  for(const index of row.indexes){own(index,['name','definition','unique','valid','ready','predicate']);requireSchema(typeof index.name==='string'&&index.name.length>0&&typeof index.definition==='string'&&index.definition.length>0&&index.unique===true&&index.valid===true&&index.ready===true&&(index.predicate===null||typeof index.predicate==='string'));}
  requireSchema(new Set(row.indexes.map(i=>i.name)).size===row.indexes.length&&row.indexes.filter(i=>i.predicate!==null).length===partial);
  requireSchema(view?typeof row.view==='string'&&row.view.length>0:row.view===null);
  // Stable order/key layout defines receipt bytes; no hash of server OIDs.
  signatures.push({name,kind:row.kind,columns:row.columns.map(c=>Object.fromEntries(['name','type','notNull','default','identity','generated','collation'].map(k=>[k,c[k]]))),constraints:row.constraints.map(c=>Object.fromEntries(['name','kind','definition','validated','deferrable','deferred'].map(k=>[k,c[k]]))).sort(byName),indexes:row.indexes.map(i=>Object.fromEntries(['name','definition','unique','valid','ready','predicate'].map(k=>[k,i[k]]))).sort(byName),view:row.view,owner:row.owner,rowSecurity:row.rowSecurity,forceRowSecurity:row.forceRowSecurity,triggers:row.triggers,rules:row.rules});
 }
 return data(signatures);
}
const byName=(a,b)=>a.name<b.name?-1:a.name>b.name?1:0;
