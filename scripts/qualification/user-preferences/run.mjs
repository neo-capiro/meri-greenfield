/** Port of the original task-owned qualification lifecycle; this portable revision has NEVER executed a database. */
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHost,ensure,exists,plainDirectory,CLEANUP_RESERVE_MS} from './host.mjs';
import {createDeadlineWork,isDeadlineWorkError} from './deadline-work.mjs';
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const roleNames=Object.freeze({admin:'meri_prefs_task6_admin_20261017',app:'meri_prefs_task6_app_20261017'});
export async function qualify(config){
 const adminPassword=randomBytes(32).toString('hex'),appPassword=randomBytes(32).toString('hex');
 const privatePaths=[[config.repo,'<SOURCE>'],[config.out,'<OWNED_OUTPUT>']].flatMap(([directory,label])=>[[pathToFileURL(directory).href,label],[directory,label],[directory.replaceAll('\\','/'),label],[directory.replaceAll('\\','\\\\'),label]]).sort((a,b)=>b[0].length-a[0].length);
 const scrub=value=>{let safe=String(value).replaceAll(adminPassword,'[redacted]').replaceAll(appPassword,'[redacted]').replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gu,'[private-postgres-target]');for(const [directory,label]of privatePaths)safe=safe.replaceAll(directory,label);return safe.replace(/file:\/\/\/[^\s)\r\n]+/gu,'<HOST_FILE>');};
 const host=createHost(config,scrub),normal=createDeadlineWork({deadlineMs:config.cutoff-CLEANUP_RESERVE_MS}),data=path.join(config.out,'data'),passwordFile=path.join(config.out,'temporary-admin-password'),rawLog=path.join(config.out,'private-postgres.log'),dump=path.join(config.out,'private-settings.dump');
 const receipt={wrapperStatus:'PORTABLE_WRAPPER_FUTURE_EXECUTION',sourceCommit:config.sourceCommit,sourceTree:config.sourceTree,migrationBlob:config.target.sqlBlob,startedAt:new Date().toISOString(),cutoff:new Date(config.cutoff).toISOString(),target:config.target,approvalReferenceProvided:true,steps:[],failures:[],tests:null,restore:null,cleanup:null};
 const note=(step,details={})=>{const item={step,at:new Date().toISOString(),...details};receipt.steps.push(item);process.stdout.write(JSON.stringify(item)+'\n');};
 let ownedOutput=false,initialized=false,startAttempted=false,ownedIdentity=null,postgres=null,pgCtl=null,admin=null;const clients=[],databases=[];
 const failure=code=>{if(!receipt.failures.includes(code))receipt.failures.push(code);};
 const markWindow=()=>{if(Date.now()>=config.cutoff)failure('WINDOW_EXPIRED');};
 async function bounded(operation,deadline,label){
  const remaining=deadline-Date.now();ensure(remaining>0,label);let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),remaining);})]);}finally{clearTimeout(timer);}
 }
 async function closeClient(client,deadline){
  try{await bounded(()=>client.end(),Math.min(deadline,Date.now()+3000),'CLIENT_CLOSE_TIMEOUT');}
  catch{failure('CLIENT_CLOSE_FORCED_OR_UNCERTAIN');try{client.connection?.stream?.destroy();}catch{} }
 }
 async function sourceGuard(){
  const git=async args=>(await host.run('git',['-c','safe.directory='+config.repo,'-C',config.repo,...args],{cwd:config.repo})).stdout.trim();
  ensure(await git(['rev-parse','HEAD'])===config.sourceCommit,'SOURCE_HEAD_CHANGED');ensure(await git(['rev-parse','HEAD^{tree}'])===config.sourceTree,'SOURCE_TREE_CHANGED');ensure(await git(['status','--porcelain'])==='','SOURCE_NOT_CLEAN');
  const sql=await readFile(path.join(config.repo,'apps/control/settings/migrations/0001_settings.sql'));
  ensure(createHash('sha1').update('blob '+sql.length+'\0').update(sql).digest('hex')===config.target.sqlBlob,'RESERVED_SQL_BLOB_CHANGED');
  const fixture=await readFile(path.join(config.repo,'apps/control/settings/user-application/test/postgres-qualification-fixture.mjs'),'utf8');
  ensure(!fixture.includes('inet_server_addr()::text AS address'),'HOLD_KNOWN_CIDR_FIXTURE_GUARD_REQUIRES_SEPARATELY_REVIEWED_FIX');return sql.toString('utf8');
 }
 try{
  ensure(process.versions.node.split('.')[0]==='24','NODE_24_REQUIRED');ensure(process.platform==='win32'||process.platform==='linux','UNQUALIFIED_PLATFORM');ensure(process.platform!=='linux'||process.getuid?.()!==0,'LINUX_NONROOT_REQUIRED');
  await plainDirectory(config.repo);await plainDirectory(path.dirname(config.out));ensure(!await exists(config.out),'OUTPUT_MUST_BE_FRESH_AND_ABSENT');
  const sql=await sourceGuard();ensure(await host.freeBytes(path.dirname(config.out))>=2684354560,'INSUFFICIENT_2_5_GIB_HEADROOM');ensure((await host.listeners({cwd:path.dirname(config.out)})).length===0,'ALLOCATED_PORT_IN_USE');
  const binaries={};for(const name of ['initdb','pg_ctl','postgres','pg_dump','pg_restore'])binaries[name]=await host.binary(name);
  ensure(new Set(Object.values(binaries).map(file=>path.dirname(file))).size===1,'POSTGRES_BINARIES_MUST_SHARE_DIRECTORY');
  for(const name of Object.keys(binaries)){const {stdout}=await host.run(binaries[name],['--version'],{cwd:config.repo});ensure(/PostgreSQL\) 16[.]15(?:\s|$)/u.test(stdout),'EXACT_POSTGRES_16_15_REQUIRED');}
  postgres=binaries.postgres;pgCtl=binaries.pg_ctl;
  await mkdir(config.out,{mode:0o700});ownedOutput=true;await plainDirectory(config.out);note('preflight-passed',{freeBytes:await host.freeBytes(config.out)});
  await writeFile(passwordFile,adminPassword+'\n',{flag:'wx',mode:0o600});
  try{await host.run(binaries.initdb,['-D',data,'-U',roleNames.admin,'--encoding=UTF8','--locale=C','--auth=scram-sha-256','--pwfile='+passwordFile],{timeout:60000});initialized=true;}finally{await rm(passwordFile,{force:true});}
  ensure((await host.listeners()).length===0,'PORT_CHANGED_BEFORE_START');startAttempted=true;
  await host.run(pgCtl,['-D',data,'-l',rawLog,'-o',`-h ${config.target.host} -p ${config.target.port} -c shared_buffers=32MB -c work_mem=4MB -c maintenance_work_mem=16MB -c max_connections=12 -c max_parallel_workers=0 -c min_wal_size=32MB -c max_wal_size=64MB -c log_min_error_statement=panic -c log_statement=none`,'-w','-t','15','start'],{timeout:25000});
  ownedIdentity=await host.processIdentity(data,postgres);note('owned-postmaster-verified',{pid:ownedIdentity.pid});
  const {Client}=createRequire(path.join(config.repo,'apps/runtime/package.json'))('pg');
  const connection={host:config.target.host,port:config.target.port,user:roleNames.admin,password:adminPassword,ssl:false,query_timeout:7000};
  async function connect(name){return normal.connect(connectionTimeoutMillis=>{const client=new Client({...connection,database:name,connectionTimeoutMillis});client.on('error',()=>{});clients.push(client);return client;});}
  admin=await connect('postgres');
  const m=(await normal.query(admin,"SELECT current_setting('server_version_num') AS version,current_setting('listen_addresses') AS listen,current_setting('data_directory') AS directory,current_setting('port') AS port,floor(extract(epoch from pg_postmaster_start_time()))::bigint::text AS epoch")).rows[0];
  const directory=await realpath(m.directory);ensure(m.version==='160015'&&m.listen===config.target.host&&Number(m.port)===config.target.port&&directory===await realpath(data)&&m.epoch===ownedIdentity.epoch,'SERVER_IDENTITY_REFUSED');
  async function newDatabase(name){ensure((await normal.query(admin,'SELECT oid::text FROM pg_database WHERE datname=$1',[name])).rowCount===0,'DATABASE_ALREADY_EXISTS');await normal.query(admin,'CREATE DATABASE '+name+' TEMPLATE template0');const oid=(await normal.query(admin,'SELECT oid::text FROM pg_database WHERE datname=$1',[name])).rows[0]?.oid;ensure(oid,'DATABASE_OID_UNCERTAIN');databases.push({name,oid});}
  await newDatabase(config.target.database);const setup=await connect(config.target.database);await normal.query(setup,sql);
  await normal.query(setup,`CREATE ROLE ${roleNames.app} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD '${appPassword}'`);
  for(const query of [`REVOKE ALL ON DATABASE ${config.target.database} FROM PUBLIC`,'REVOKE CREATE ON SCHEMA public FROM PUBLIC',`GRANT CONNECT ON DATABASE ${config.target.database} TO ${roleNames.app}`,`GRANT USAGE ON SCHEMA meri_settings TO ${roleNames.app}`,`GRANT SELECT,INSERT,UPDATE ON meri_settings.user_preferences TO ${roleNames.app}`,`GRANT SELECT,INSERT ON meri_settings.settings_audit TO ${roleNames.app}`,`GRANT USAGE ON SEQUENCE meri_settings.settings_audit_sequence_seq TO ${roleNames.app}`])await normal.query(setup,query);
  note('exact-schema-and-restricted-role-provisioned');
  const url=(role,password)=>`postgresql://${role}:${password}@${config.target.host}:${config.target.port}/${config.target.database}`;
  let result;try{result=await host.run(process.execPath,['--max-old-space-size=512','--test','--test-concurrency=1','--test-reporter=spec','apps/control/settings/user-application/test/postgres-qualification.test.mjs'],{cwd:config.repo,timeout:180000,extraEnv:{MERI_PREFERENCES_PG_QUALIFY:'1',MERI_PREFERENCES_PG_URL:url(roleNames.admin,adminPassword),MERI_PREFERENCES_PG_ROLE_CHECK:'1',MERI_PREFERENCES_PG_APP_URL:url(roleNames.app,appPassword),MERI_PREFERENCES_PG_RESTORE_PLAN:'dispose-task6-owned-database'}});}catch(error){await writeFile(path.join(config.out,'tests.txt'),scrub(error.safeOutput??'CHILD_FAILED_NO_SAFE_DIAGNOSTIC'));throw Error('QUALIFICATION_TESTS_FAILED');}
  await writeFile(path.join(config.out,'tests.txt'),scrub(result.stdout+'\n'+result.stderr));receipt.tests={exit:0};note('tests-exited-zero');
  const snapshot=async client=>({preferences:(await normal.query(client,'SELECT * FROM meri_settings.user_preferences ORDER BY tenant_id,actor_id')).rows,tenant:(await normal.query(client,'SELECT * FROM meri_settings.tenant_settings ORDER BY tenant_id')).rows,audit:(await normal.query(client,'SELECT * FROM meri_settings.settings_audit ORDER BY sequence')).rows});
  const before=await snapshot(setup);await newDatabase(config.target.restoreDatabase);
  const pgEnv={PGPASSWORD:adminPassword,PGPASSFILE:process.platform==='win32'?'NUL':'/dev/null',PGCONNECT_TIMEOUT:'3'};
  const args=['--no-owner','--no-acl','--host='+config.target.host,'--port='+config.target.port,'--username='+roleNames.admin];
  await host.run(binaries.pg_dump,['--format=custom',...args,'--dbname='+config.target.database,'--file='+dump],{timeout:30000,extraEnv:pgEnv});
  await host.run(binaries.pg_restore,['--exit-on-error','--single-transaction',...args,'--dbname='+config.target.restoreDatabase,dump],{timeout:30000,extraEnv:pgEnv});
  const restored=await connect(config.target.restoreDatabase),after=await snapshot(restored);ensure(sha(before)===sha(after),'RESTORE_CONTENT_MISMATCH');let triggerState;try{await normal.query(restored,'UPDATE meri_settings.settings_audit SET recorded_at=recorded_at');}catch(error){if(isDeadlineWorkError(error))throw error;triggerState=error.code;}ensure(triggerState==='P0001','RESTORED_AUDIT_TRIGGER_MISSING');
  receipt.restore={passed:true,sourceSha256:sha(before),restoredSha256:sha(after),preferences:before.preferences.length,auditRows:before.audit.length};
  for(const entry of databases)ensure((await normal.query(admin,'SELECT oid::text FROM pg_database WHERE datname=$1',[entry.name])).rows[0]?.oid===entry.oid,'OWNED_DATABASE_OID_CHANGED');
  await sourceGuard();note('restore-and-source-verified');
 }catch(error){const code=String(error.message);failure(/^[A-Z0-9_.-]+$/u.test(code)?code:'QUALIFICATION_FAILED_PRIVATE_DETAIL_WITHHELD');}
 finally{
  // One shared bound includes connection closes, independent identity, stop, verification and file cleanup.
  // Emergency cleanup may continue at most 30 seconds beyond the approved cutoff; every overrun is HOLD.
  const cleanupDeadline=Math.min(Date.now()+60000,config.cutoff+30000);markWindow();
  await Promise.all(clients.map(client=>closeClient(client,cleanupDeadline)));
  if(ownedOutput){let stopped=false;try{
   if(startAttempted){
    ensure(await bounded(()=>exists(path.join(data,'postmaster.pid')),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED'),'START_OUTCOME_UNCERTAIN_NO_POSTMASTER_FILE');
    const current=await bounded(()=>host.processIdentity(data,postgres,{cleanupDeadline}),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED');
    ensure(!ownedIdentity||JSON.stringify(current)===JSON.stringify(ownedIdentity),'CLEANUP_OWNER_CHANGED');
    await host.run(pgCtl,['-D',data,'-m','fast','-w','-t','15','stop'],{timeout:25000,cleanupDeadline});
   }else ensure(initialized||!await bounded(()=>exists(data),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED'),'INITIALIZATION_OUTCOME_UNCERTAIN');
   ensure((await host.listeners({cleanupDeadline})).length===0,'ALLOCATED_PORT_NOT_FREE');stopped=true;
   if(await bounded(()=>exists(data),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED')){await bounded(()=>plainDirectory(data),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED');ensure(path.dirname(data)===config.out&&path.basename(data)==='data','CLEANUP_TARGET_REFUSED');await bounded(()=>rm(data,{recursive:true}),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED');}
   for(const file of [passwordFile,rawLog,dump])await bounded(()=>rm(file,{force:true}),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED');
   receipt.cleanup={stopped,dataRemoved:!await bounded(()=>exists(data),cleanupDeadline,'CLEANUP_BUDGET_EXPIRED'),portFree:true,beforeDeadline:Date.now()<config.cutoff};
  }catch{receipt.cleanup={stopped,status:'UNCERTAIN_PRESERVE_PRIVATE_OUTPUT_FOR_OWNER_RECONCILIATION'};failure('CLEANUP_UNCERTAIN');}
  markWindow();receipt.finishedAt=new Date().toISOString();
  try{
   await bounded(()=>writeFile(path.join(config.out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n'),cleanupDeadline,'CLEANUP_RECEIPT_BUDGET_EXPIRED');
   if(Date.now()>=config.cutoff){markWindow();if(receipt.cleanup)receipt.cleanup.beforeDeadline=false;receipt.finishedAt=new Date().toISOString();await bounded(()=>writeFile(path.join(config.out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n'),cleanupDeadline,'CLEANUP_RECEIPT_BUDGET_EXPIRED');}
  }catch{failure('CLEANUP_RECEIPT_UNCERTAIN');}
  }
  markWindow();
 }
 markWindow();if(receipt.cleanup&&Date.now()>=config.cutoff)receipt.cleanup.beforeDeadline=false;
 process.stdout.write(JSON.stringify({status:receipt.failures.length?'HOLD':'COMPLETED',failures:receipt.failures,cleanup:receipt.cleanup})+'\n');markWindow();return receipt.failures.length?1:0;
}
