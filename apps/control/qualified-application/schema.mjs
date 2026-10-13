/** Fixed owned-disposable schema composition. No import-time file or service calls. */
import {readFile} from 'node:fs/promises';
import {PostgresBudgetStore,BudgetStateDenied} from '../../gateway/budget/postgres-budget-store.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {migrations,relations,sha256,requireSchema,schemaConfiguration,portMethod,rows,assertCatalog} from './schema-contract.mjs';
const root=new URL('../../../',import.meta.url);
const identitySQL=`SELECT current_database() AS database,current_user AS username,inet_server_addr()::text AS address,inet_server_port() AS port,current_setting('server_version_num') AS version,floor(extract(epoch FROM pg_postmaster_start_time())*1000)::text AS start_ms,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS synchronous_commit,(SELECT system_identifier::text FROM pg_control_system()) AS system_identifier,current_setting('search_path') AS search_path`;
const namespaceSQL="SELECT nspname AS name FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%' ORDER BY nspname";
const catalogSQL=`SELECT n.nspname||'.'||c.relname AS name,c.relkind::text AS kind,pg_catalog.pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS "rowSecurity",c.relforcerowsecurity AS "forceRowSecurity",
 (SELECT count(*)::int FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal) AS triggers,
 (SELECT count(*)::int FROM pg_catalog.pg_rewrite w WHERE w.ev_class=c.oid) AS rules,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity::text,'generated',a.attgenerated::text,'collation',CASE WHEN a.attcollation=0 THEN NULL ELSE (SELECT z.nspname||'.'||co.collname FROM pg_catalog.pg_collation co JOIN pg_catalog.pg_namespace z ON z.oid=co.collnamespace WHERE co.oid=a.attcollation) END) ORDER BY a.attnum) FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb) AS columns,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('name',k.conname,'kind',k.contype::text,'definition',pg_catalog.pg_get_constraintdef(k.oid,false),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred) ORDER BY k.conname) FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid),'[]'::jsonb) AS constraints,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('name',ic.relname,'definition',pg_catalog.pg_get_indexdef(i.indexrelid),'unique',i.indisunique,'valid',i.indisvalid,'ready',i.indisready,'predicate',pg_catalog.pg_get_expr(i.indpred,i.indrelid)) ORDER BY ic.relname) FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),'[]'::jsonb) AS indexes,
 CASE WHEN c.relkind='v' THEN pg_catalog.pg_get_viewdef(c.oid,false) ELSE NULL END AS view
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','meri_qualification','meri_task_lookup') AND c.relkind NOT IN ('i','I') ORDER BY n.nspname,c.relname`;
const countSQL=relations.filter(([name])=>!name.endsWith('.budget_liabilities')).map(([name])=>`SELECT '${name}' AS name,count(*)::text AS count FROM ${name}`).join(' UNION ALL ');
function denied(install,submitted,stage,life){
 const error=new Error('QUALIFICATION_SCHEMA_REFUSED');error.code='QUALIFICATION_SCHEMA_REFUSED';
 error.outcome=install?(submitted?'UNKNOWN':'NOT_INSTALLED'):'READ_UNAVAILABLE';
 error.stage=stage;error.unsettledOperations=life?.pendingOperations()??0;return error;
}
async function execute(value,install){
 let c,life,stage='admission',submitted=false;
 try{
  c=schemaConfiguration(value,install);
  life=createOperationLifetime({deadlineMs:c.deadlineMs,now:c.now,signal:c.signal,errorFactory:()=>new BudgetStateDenied('QUALIFICATION_SCHEMA_STOPPED')});
  stage='migration_source';const files=[];
  for(const [name,path,digest]of migrations){const bytes=await life.run(()=>readFile(new URL(path,root)));requireSchema(sha256(bytes)===digest);files.push({name,bytes});}
  // Capture bounded ports, preserving the borrowed pg pool's shorter timeout.
  const pool={async connect(){
   life.check();const client=await c.connect();
   // Retain release before any post-acquisition validation/check can refuse.
   let release;try{release=portMethod(client,'release');const query=portMethod(client,'query');return {
    async query(text,values){
     if(text!=='ROLLBACK')life.check();
     const timeout=Math.max(1,Math.min(c.queryTimeout,c.deadlineMs-c.now()));
     return query({text,...(values===undefined?{}:{values}),query_timeout:timeout});
    },release(error){return release(error);},
   };}catch(error){if(release)release(error);throw error;}
  }};
  const store=new PostgresBudgetStore(pool);
  const receipt=await life.run(()=>store.transact(async client=>{
   const query=async(text,values)=>{life.check();const result=await client.query(text,values);life.check();return rows(result);};
   stage='identity';await query('SET LOCAL search_path TO public');
   const identity=await query(identitySQL);requireSchema(identity.length===1);const r=identity[0],f=c.fixture;
   requireSchema(r.database===f.database&&r.username===f.user&&r.address===f.host&&r.port===f.port&&r.version===f.serverVersion&&r.start_ms===String(Date.parse(f.serverStartTime))&&r.system_identifier===f.systemIdentifier&&r.fsync==='on'&&r.synchronous_commit==='on'&&r.search_path==='public');
   stage='ownership';
   // This lock serializes only this fixed schema owner; it creates no registry.
   if(install){const lock=await query('SELECT pg_catalog.pg_try_advisory_xact_lock(1296388681,1) AS acquired');requireSchema(lock.length===1&&lock[0].acquired===true);}
   const namespaces=await query(namespaceSQL);
   if(install){
    requireSchema(namespaces.length===0);requireSchema((await query(catalogSQL)).length===0);
    stage='migration';
    for(const file of files){life.check();submitted=true;await client.query(file.bytes.toString('utf8'));life.check();}
   }else requireSchema(namespaces.length===2&&namespaces.some(r=>r.name==='meri_qualification')&&namespaces.some(r=>r.name==='meri_task_lookup'));
   stage='catalog';const catalog=assertCatalog(await query(catalogSQL));
   const migrationSha256=Object.fromEntries(migrations.map(([name,,hash])=>[name,hash]));
   const schemaSha256=sha256(JSON.stringify({migrationSha256,catalog}));
   if(!install)requireSchema(schemaSha256===f.schemaSha256);
   stage='accounting';const budget=await query('SELECT id,cap_micro_usd::text,consumed_micro_usd::text,quarantined FROM meri_qualification.budget');
   requireSchema(budget.length===1&&budget[0].id===1&&budget[0].cap_micro_usd==='10000000'&&/^(0|[1-9][0-9]*)$/.test(budget[0].consumed_micro_usd)&&typeof budget[0].quarantined==='boolean');
   if(install){const counts=await query(countSQL);requireSchema(counts.length===relations.length-1&&new Set(counts.map(r=>r.name)).size===counts.length);for(const [name]of relations.filter(([name])=>!name.endsWith('.budget_liabilities')))requireSchema(counts.some(r=>r.name===name&&r.count===(name==='meri_qualification.budget'?'1':'0')));requireSchema(budget[0].consumed_micro_usd==='0'&&budget[0].quarantined===false);}
   stage='commit';return {schema:'meri.owned-qualification-schema/1',status:'PASS',operation:install?'installed':'verified',evidenceKind:'borrowed-pool-catalog-observation',originalDeadlineMs:c.deadlineMs,fixtureId:f.fixtureId,engine:{host:f.host,port:f.port,database:f.database,user:f.user,systemIdentifier:f.systemIdentifier,serverStartTime:f.serverStartTime,serverVersion:f.serverVersion},migrationSha256,schemaSha256,relationCount:catalog.length,catalog,initialStateVerified:install,budget:budget[0],runtimeQualified:false,poolClosed:false};
  },life.check));
  life.check();return data(receipt);
 }catch{throw denied(install,submitted,stage,life);}
 finally{life?.close();}
}
export const prepareOwnedApplicationSchema=options=>execute(options,true);
export const verifyOwnedApplicationSchema=options=>execute(options,false);
