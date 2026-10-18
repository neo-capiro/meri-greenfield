#!/usr/bin/env node
/** Meri first-chat Stage 1 (change set D2): one-shot database runner for the existing Aurora `capiro`.
 *
 *   node infra/product-preview/first-chat-migrate.mjs plan      # offline: print the pinned plan, no connection
 *   node infra/product-preview/first-chat-migrate.mjs meri      # bootstrap, ordered migrations, seed, Meri grants
 *   node infra/product-preview/first-chat-migrate.mjs temporal  # bootstrap, Temporal grants (after temporal-sql-tool)
 *
 * Every connection is the admin login from PGHOST/PGPORT/PGUSER/PGPASSWORD on PGDATABASE=capiro with
 * PGSSLMODE=verify-full and PGSSLROOTCERT=<RDS CA bundle>. Migrations run as meri_product_migrator through a
 * transaction-local SET ROLE, so that NOLOGIN role owns every object. Each migration is one transaction that
 * also records the file's sha256 in meri_migration_ledger.applied. An applied file whose bytes changed is
 * refused; applied unchanged files are skipped. Every run ends with phase_release. Nothing runs on import.
 */
import {createHash,createHmac,pbkdf2Sync,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const DATABASE_SCRIPT='infra/product-preview/first-chat-database.sql';
// Supersedes DATABASE_SCRIPT's temporal_grants section (that file stays byte-identical: its sha is ledgered).
export const TEMPORAL_SCRIPT='infra/product-preview/first-chat-database-temporal.sql';
/** Integration packet grants (docs/integration/MIGRATION-PACKET-20261018.md, GRANTS-PROPOSAL-20261018.md); a separate file because
 * DATABASE_SCRIPT's phase_meri_grants sha is ledgered and an edit would refuse every later run. */
export const INTEGRATION_SCRIPT='infra/product-preview/first-chat-database-integration.sql';
export const LEDGER='meri_migration_ledger.applied';
export const OWNER='meri_product_migrator';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=(code,detail)=>{throw Object.assign(Error(detail?`${code}: ${detail}`:code),{code});};

/** The reviewed order (FIRST-CHAT-CHANGE-SET.md Stage 1). 0012 and 0014 are held and do not exist here. */
const conversation=name=>`apps/control/conversations/migrations/${name}`;
export const PLAN=Object.freeze([
 ['migration',conversation('0001_conversations.sql'),'97d4e7058696b8ded1ad7dc0730ab271e75137968831ed34c0b73a7dadc16b26'],
 ['migration',conversation('0002_lifecycle.sql'),'87c27a01a2f36ceb0a4faf6c5242d8e061240037b6775aef777f292323170b69'],
 ['migration',conversation('0003_selected_outputs.sql'),'25d9fc720e0f4a0345e017d5a20285b27d04af55e3cc953d261664ce31db2245'],
 ['migration',conversation('0004_sdk_sessions.sql'),'0370baa18aff134ca75287b468fc00b75e616f63fbb440c02069bccd31dd582a'],
 ['migration',conversation('0005_selected_reads.sql'),'8ffb0b725098aaed8bdd48591b3da9a04c2d751d9098a5b35f8c528ac9ec8cde'],
 ['migration',conversation('0006_native_executions.sql'),'9537daf4f3611cfce8aae0ee148bf4da3bcfc53116faaec6eb1c57cf05b4d714'],
 ['migration',conversation('0007_native_preparation.sql'),'76da1fa221bb463ce116d3ca794566321f219177b2055193c2c7f609f5e6ba19'],
 ['migration',conversation('0008_native_prepared_launch.sql'),'8a257cf9513572ca0efbe2430ea40fd38e859ae484668a6a90fa4b84b6e142ec'],
 ['migration',conversation('0009_next_runs.sql'),'85de8c731a269b00fc8b8f16d95772d56fd70a585431904cbb5049cdc2f8a8ed'],
 ['migration',conversation('0010_retention.sql'),'cfed5bdd7c48dceedd4de0310999085e7c07224b59664ac98038bc2e48b04590'],
 ['migration',conversation('0011_run_issuance.sql'),'f170e0e586ecca612aba98be17a34045cfe440df2e52fae2a251e84fd60c81d1'],
 ['migration',conversation('0013_retention_recovery_watermark.sql'),'5880f4731d9d2e6bface7af1b6a55a9df1ba8bdf8a9b6812332f70bc6cf7a1be'],
 ['migration',conversation('0015_model_run_issuance.sql'),'59692fb7dbb6e02e37dc6cdfa46a9a28732ea1ba293c5b55aebef3e3ee410439'],
 ['migration',conversation('0016_initial_inputs.sql'),'b008b490b744056beafdf94dc1f2c5e52e472c246c1258b90038dd3e95525e27'],
 ['migration',conversation('0017_initial_run_bindings.sql'),'e140cc489fc97ebb63a50406cea3e0b0db5755cdf461d92c0affe601b26900eb'],
 ['migration','apps/gateway/budget/migrations/0001_product_budget.sql','0beb498dbac8d6e092c207b46f8167fb161361e7ad869aea6e33f0d1d8c4a511'],
 ['migration','apps/gateway/budget/migrations/0002_tenant_budgets.sql','651d2573779be28e2be4993ef992d25107d5d51a0e65c5dac6186ab0b9f90da8'],
 ['migration','apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql','59b0e32eac16764bc0d22cb85509b7e9ea1e51c2a50882ed95d9cf14406e0041'],
 ['migration','infra/product-preview/first-chat-seed-budget.sql','adfdbb8590e5c69ccf30c3cecf42bdc483a061ae6639c1db01e952389a39ff3a'],
 ['phase:meri_grants',DATABASE_SCRIPT,'c6e2b5edf6b88030c677cf326c83d8e4f17a0b413808072eae1d1dab3d8814d5'],
 ['phase:temporal_grants',TEMPORAL_SCRIPT,'2d305021ec1c66de034b07d233bb534492f5896d2ed3ff16c7118cf78520f348'],
 // Stage 'integration' (approved by D016, not applied: snapshot first). The 'meri' and 'temporal'
 // stages stop before these entries; only an explicit `integration` run applies them, after both earlier stages are ledgered.
 ['migration','apps/control/settings/migrations/0001_settings.sql','7243fe1e45b4890fc36eeb5c96a6ec493bd92cb8572de11b8d6bae5f06d976e1','integration'],
 ['migration','apps/control/commands/migrations/0001_commands.sql','64f679e434dbc9d54d700af83357296ba3f4cb2c52e382c72e0d7c1caad7c936','integration'],
 ['migration','apps/control/commands/approval-metadata/migrations/0001_approval_metadata.sql','448678c2241e40e28190987c1f60c3492f39f9a43da8bc6ae6f0708efdd2d1a5','integration'],
 ['migration','apps/control/intents/migrations/0001_intent_preparations.sql','108b26fbb30d1e7aa2d38942ed5099413a09d7919f5e7fbf2c541ab92f9c68bc','integration'],
 ['migration','apps/control/schedules/migrations/0001_schedule_owner.sql','bf8c593de97dcdae728765ecd90dac6696b290028d4ffb0586bdae0fe87d91c7','integration'],
 ['migration','apps/control/schedules/migrations/0002_occurrences.sql','6a8369dc45e2bc330425550583daceb706652698ebbdecee1f5a1f2202a07242','integration'],
 ['migration','apps/control/schedules/migrations/0003_run_cancel_proofs.sql','19a4694fa99acb36b55b08ca88e6d7a343944e2fd47e246638a3d5e93971a308','integration'],
 ['migration','apps/control/schedules/migrations/0004_read_consent.sql','d57783e1a9e349d1df43e00a273db588b48a6c1b4a49279b30da8428b0ec9830','integration'],
 ['migration','apps/control/task-lookup/migrations/0001_task_lookup.sql','ae3197c4f898c5a8a493b2bee4cd6c5da16c62730ad3447e4f07ebfeaf1c100f','integration'],
 ['migration','apps/runtime/objective-source/migrations/0001_objective_custody.sql','1e22b44fcc59ae88e593f6d15f63083bdff0c3421584646fc7a357e7f67b9b34','integration'],
 // D7-4 run starts and the reader v2 JTI replay store (objective-source family; central reservation required before apply).
 ['migration','apps/runtime/objective-source/migrations/0002_objective_run_starts.sql','659b5b400d3fe85ed122fbf75653cd5f7c60e5f2c99f055af90304f9fd1e8598','integration'],
 ['migration','apps/runtime/objective-source/migrations/0003_objective_reader_replays.sql','13241e96f5294dffc3e616ef0163bd7eaee5c2e5f6030fd7ca05244314b89286','integration'],
 ['migration','apps/artifacts/migrations/0001_versions.sql','d654a24aa4f45c4b3c43d927263f96b8b2f406af509840819feda36c5f2dee19','integration'],
 ['migration','apps/artifacts/migrations/0002_retention.sql','8212082ea875117afb2ba129474ba5f6ba4f937c3d0192ca07267738cd73cba6','integration'],
 ['migration','apps/artifacts/migrations/0003_previews.sql','d1eb7ea68a150f60e7fb63e654a0892044bf24840a785fcff58dded59129b300','integration'],
 ['migration','apps/control/memory/migrations/0001_memory_candidates.sql','d925ec36d5e4fa98efeb123fb86f602608dbf82b2caa59bd093366e1eb33067d','integration'],
 ['migration','apps/runtime/native-authority/read-delegation/migrations/0001_read_delegation_facts.sql','bc3ec0314839d953909ffd9eda5c9235da0fbf966ff28d46e19d7e76f7702745','integration'],
 ['phase:integration_grants',INTEGRATION_SCRIPT,'298f74bb550194225976c275fe90dee3f218499f883bd5c9ed7b33da211e235f','integration']
].map(([kind,path,pinned,declaredStage],index)=>Object.freeze({ordinal:index+1,kind,path,pinned,
 name:kind==='migration'?path:`${path}#${kind.slice(6)}`,
 stage:declaredStage??(kind==='phase:temporal_grants'?'temporal':'meri')})));

/** Read every planned file and refuse any byte change against the reviewed pins before a connection exists. */
export function loadPlan({root=ROOT,read=path=>readFileSync(resolve(root,path)),plan=PLAN}={}){
 const cache=new Map();
 return plan.map(entry=>{
  if(!cache.has(entry.path))cache.set(entry.path,read(entry.path));
  const bytes=cache.get(entry.path),digest=sha256(bytes);
  if(digest!==entry.pinned)refuse('MERI_D2_SOURCE_CHANGED',`${entry.path} ${digest}`);
  return Object.freeze({...entry,sha256:digest,text:bytes.toString('utf8')});
 });
}

// ---------------------------------------------------------------- SQL lexer shared by both interpreters
/** Walk SQL like psql: quotes, dollar quotes, comments and parentheses never end a statement. */
export function* lex(text){
 let i=0,depth=0;
 const ident=c=>/[A-Za-z0-9_$]/u.test(c??'');
 while(i<text.length){
  const c=text[i],n=text[i+1];
  if(c==='-'&&n==='-'){const end=text.indexOf('\n',i);const stop=end<0?text.length:end;yield {type:'comment',text:text.slice(i,stop),start:i};i=stop;continue;}
  if(c==='/'&&n==='*'){let level=1,j=i+2;while(j<text.length&&level>0){if(text[j]==='/'&&text[j+1]==='*'){level++;j+=2;}else if(text[j]==='*'&&text[j+1]==='/'){level--;j+=2;}else j++;}
   if(level)refuse('MERI_D2_SQL_UNTERMINATED_COMMENT');yield {type:'comment',text:text.slice(i,j),start:i};i=j;continue;}
  if(c==="'"){
   const escaped=(text[i-1]==='E'||text[i-1]==='e')&&!ident(text[i-2]);let j=i+1;
   for(;;){if(j>=text.length)refuse('MERI_D2_SQL_UNTERMINATED_STRING');if(escaped&&text[j]==='\\'){j+=2;continue;}
    if(text[j]==="'"){if(text[j+1]==="'"){j+=2;continue;}break;}j++;}
   yield {type:'quoted',text:text.slice(i,j+1),start:i};i=j+1;continue;}
  if(c==='"'){let j=i+1;for(;;){if(j>=text.length)refuse('MERI_D2_SQL_UNTERMINATED_IDENTIFIER');if(text[j]==='"'){if(text[j+1]==='"'){j+=2;continue;}break;}j++;}
   yield {type:'quoted',text:text.slice(i,j+1),start:i};i=j+1;continue;}
  if(c==='$'&&!ident(text[i-1])){const tag=/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(text.slice(i));
   if(tag){const end=text.indexOf(tag[0],i+tag[0].length);if(end<0)refuse('MERI_D2_SQL_UNTERMINATED_DOLLAR_QUOTE');
    yield {type:'quoted',text:text.slice(i,end+tag[0].length),start:i};i=end+tag[0].length;continue;}}
  if(c==='\\'){const end=text.indexOf('\n',i);const stop=end<0?text.length:end;yield {type:'meta',text:text.slice(i,stop),start:i};i=stop;continue;}
  if(c==='(')depth++;else if(c===')')depth=Math.max(0,depth-1);
  if(c===';'&&depth===0){yield {type:'end',text:c,start:i};i++;continue;}
  if(c===':'){yield {type:'colon',text:c,start:i};i++;continue;}
  yield {type:'text',text:c,start:i};i++;
 }
}

/** Split plain SQL (a migration) into top-level statements. Backslash meta-commands are refused. */
export function splitStatements(text){
 const out=[];let buffer='',start=null;
 for(const t of lex(text)){
  if(t.type==='meta')refuse('MERI_D2_MIGRATION_META_COMMAND');
  if(t.type==='comment')continue;
  if(t.type==='end'){if(buffer.trim())out.push({text:buffer.trim(),start,end:t.start+1});buffer='';start=null;continue;}
  if(start===null&&t.text.trim())start=t.start;
  buffer+=t.text;
 }
 if(buffer.trim())out.push({text:buffer.trim(),start,end:text.length});
 return out;
}

const CONTROL=/^(BEGIN|COMMIT|END|ROLLBACK|ABORT|START\s+TRANSACTION|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION|SET\s+(LOCAL\s+|SESSION\s+)?(ROLE|SESSION\s+AUTHORIZATION)|RESET\s+(ROLE|SESSION\s+AUTHORIZATION|ALL))\b/iu;
/** Return the body to execute inside the runner's own transaction. A file may carry exactly one outer
 * BEGIN;...COMMIT; wrapper (stripped) or no transaction control at all. Anything else is refused. */
export function migrationBody(text){
 const statements=splitStatements(text);
 if(statements.length===0)refuse('MERI_D2_MIGRATION_EMPTY');
 const control=statements.map(s=>CONTROL.test(s.text));
 if(!control.some(Boolean))return text;
 const first=statements[0],last=statements.at(-1);
 if(statements.length<3||!/^BEGIN$/iu.test(first.text)||!/^COMMIT$/iu.test(last.text)||control.slice(1,-1).some(Boolean))
  refuse('MERI_D2_MIGRATION_TRANSACTION_SHAPE');
 return text.slice(first.end,last.start);
}

// ---------------------------------------------------------------- psql subset interpreter
/** PQescapeLiteral: double quotes; a value with a backslash becomes an E'' string with doubled backslashes. */
export function psqlLiteral(value){
 if(typeof value!=='string'||value.includes('\0'))refuse('MERI_D2_VARIABLE_REFUSED');
 const body=value.replaceAll("'","''");
 return value.includes('\\')?` E'${body.replaceAll('\\','\\\\')}'`:`'${body}'`;
}

/** Execute a psql script with the subset first-chat-database.sql uses: \set ON_ERROR_STOP on, \if :{?v},
 * \endif, \connect <db>, \gexec, :'v' and :{?v}. Statements in a false branch are neither interpolated
 * nor executed. `connect(database)` returns a pg-compatible client; the first connection is `database`. */
export async function runPsqlScript({text,variables={},connect,database='capiro',log=()=>{}}){
 let client=await connect(database),buffer='';const branches=[];const open=[client];
 const active=()=>branches.every(Boolean);
 const isTrue=v=>{if(/^(true|on|1|yes)$/iu.test(v))return true;if(/^(false|off|0|no)$/iu.test(v))return false;refuse('MERI_D2_PSQL_IF_VALUE',v);};
 const execute=async sql=>{log({event:'sql',database,statement:sql.split('\n')[0].slice(0,120).replace(/PASSWORD .*/u,'PASSWORD <redacted>')});return client.query(sql);};
 try{
  const tokens=[...lex(text)];
  for(let k=0;k<tokens.length;k++){
   const t=tokens[k];
   if(t.type==='meta'){
    const m=/^\\([a-z]+)\s*(.*?)\s*$/u.exec(t.text);if(!m)refuse('MERI_D2_PSQL_META',t.text);
    const [,command,argument]=m;
    if(command==='if'){
     if(!active()){branches.push(false);continue;}
     const v=/^:\{\?([A-Za-z0-9_]+)\}$/u.exec(argument);if(!v)refuse('MERI_D2_PSQL_IF_FORM',argument);
     branches.push(Object.hasOwn(variables,v[1]));continue;
    }
    if(command==='endif'){if(!branches.length)refuse('MERI_D2_PSQL_ENDIF');branches.pop();continue;}
    if(!active())continue;
    if(command==='set'){if(argument!=='ON_ERROR_STOP on')refuse('MERI_D2_PSQL_SET',argument);continue;}
    if(command==='gexec'){
     if(!buffer.trim())refuse('MERI_D2_PSQL_GEXEC_EMPTY');
     const result=await client.query({text:buffer.trim(),rowMode:'array'});buffer='';
     for(const row of result.rows)for(const cell of row)if(cell!==null&&cell!==undefined)await execute(String(cell));
     continue;
    }
    if(command==='connect'){
     if(buffer.trim())refuse('MERI_D2_PSQL_CONNECT_WITH_PENDING_QUERY');
     if(!/^[a-z_][a-z0-9_]{0,62}$/u.test(argument))refuse('MERI_D2_PSQL_CONNECT',argument);
     await client.end();open.splice(open.indexOf(client),1);database=argument;client=await connect(database);open.push(client);continue;
    }
    refuse('MERI_D2_PSQL_META',command);
   }
   if(!active())continue;
   if(t.type==='comment')continue;
   if(t.type==='end'){buffer+=';';if(buffer.replace(/;/gu,'').trim())await execute(buffer.trim());buffer='';continue;}
   if(t.type==='colon'){
    const rest=tokens.slice(k+1,k+4);
    if(rest[0]?.type==='colon'){buffer+='::';k++;continue;}
    if(rest[0]?.type==='quoted'&&rest[0].text.startsWith("'")){
     const name=rest[0].text.slice(1,-1);if(!/^[A-Za-z0-9_]+$/u.test(name))refuse('MERI_D2_PSQL_VARIABLE_NAME');
     if(!Object.hasOwn(variables,name))refuse('MERI_D2_PSQL_VARIABLE_MISSING',name);
     buffer+=psqlLiteral(variables[name]);k++;continue;
    }
    const brace=/^\{\?([A-Za-z0-9_]+)\}/u.exec(text.slice(t.start+1));
    if(brace){buffer+=Object.hasOwn(variables,brace[1])?'TRUE':'FALSE';
     const stop=t.start+1+brace[0].length;while(tokens[k+1]&&tokens[k+1].start<stop)k++;continue;}
    if(/^[A-Za-z_]/u.test(text[t.start+1]??''))refuse('MERI_D2_PSQL_RAW_INTERPOLATION');
    buffer+=':';continue;
   }
   buffer+=t.text;
  }
  if(branches.length)refuse('MERI_D2_PSQL_UNTERMINATED_IF');
  if(buffer.trim())refuse('MERI_D2_PSQL_UNTERMINATED_STATEMENT');
 }finally{for(const c of open.splice(0))await c.end().catch(()=>{});}
}

// ---------------------------------------------------------------- passwords
export const PASSWORD_VARIABLES=Object.freeze({
 control_password:'MERI_D2_CONTROL_PASSWORD',
 model_owner_password:'MERI_D2_MODEL_OWNER_PASSWORD',
 issuer_password:'MERI_D2_ISSUER_PASSWORD',
 temporal_migrator_password:'MERI_D2_TEMPORAL_MIGRATOR_PASSWORD',
 temporal_primary_password:'MERI_D2_TEMPORAL_PRIMARY_PASSWORD',
 temporal_visibility_password:'MERI_D2_TEMPORAL_VISIBILITY_PASSWORD'
});
/** PostgreSQL stores a SCRAM-SHA-256 verifier verbatim, so no plaintext password reaches the server or its logs. */
export function scramVerifier(password,salt=randomBytes(16),iterations=4096){
 const salted=pbkdf2Sync(Buffer.from(password,'utf8'),salt,iterations,32,'sha256');
 const clientKey=createHmac('sha256',salted).update('Client Key').digest();
 const storedKey=createHash('sha256').update(clientKey).digest();
 const serverKey=createHmac('sha256',salted).update('Server Key').digest();
 return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}
/** Passwords are URL-unreserved so the services' verify-full connection URIs need no escaping. */
export function passwordVariables(env,salt){
 const values=Object.entries(PASSWORD_VARIABLES).map(([name,key])=>{
  const value=env[key];if(typeof value!=='string'||!/^[A-Za-z0-9._~-]{32,128}$/u.test(value))refuse('MERI_D2_PASSWORD_REFUSED',key);
  return [name,value];
 });
 if(new Set(values.map(([,v])=>v)).size!==values.length)refuse('MERI_D2_PASSWORDS_NOT_DISTINCT');
 return Object.fromEntries(values.map(([name,value])=>[name,scramVerifier(value,salt?.(name))]));
}

// ---------------------------------------------------------------- ledger
/** Recorded rows must be exactly the plan prefix 1..k with identical names and sha256. */
export function verifyLedger(rows,plan){
 rows=[...rows].sort((a,b)=>Number(a.ordinal)-Number(b.ordinal));
 rows.forEach((row,index)=>{
  const entry=plan[index];
  if(Number(row.ordinal)!==index+1||!entry)refuse('MERI_D2_LEDGER_GAP_OR_UNKNOWN',String(row.ordinal));
  if(row.name!==entry.name)refuse('MERI_D2_LEDGER_ORDER',`${row.ordinal} ${row.name}`);
  if(row.sha256!==entry.sha256)refuse('MERI_D2_APPLIED_FILE_CHANGED',entry.name);
 });
 return rows.length;
}

async function readLedger(client){
 const exists=(await client.query(`SELECT to_regclass('${LEDGER}') IS NOT NULL AS ledger, EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${OWNER}') AS owner`)).rows[0];
 if(!exists.ledger)return [];
 if(!exists.owner)refuse('MERI_D2_LEDGER_WITHOUT_OWNER');
 // Same temporary SET-only membership phase_bootstrap grants and phase_release revokes.
 await client.query(`GRANT ${OWNER} TO CURRENT_USER WITH INHERIT FALSE, SET TRUE`);
 await client.query('BEGIN');
 try{await client.query(`SET LOCAL ROLE ${OWNER}`);const rows=(await client.query(`SELECT ordinal,name,sha256 FROM ${LEDGER} ORDER BY ordinal`)).rows;await client.query('COMMIT');return rows;}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}

async function record(client,entry){
 await client.query(`INSERT INTO ${LEDGER}(ordinal,name,sha256) VALUES($1,$2,$3)`,[entry.ordinal,entry.name,entry.sha256]);
}

/** One transaction per migration: SET LOCAL ROLE owner, the body, the ledger row, COMMIT. */
export async function applyMigration(client,entry){
 const body=migrationBody(entry.text);
 await client.query('BEGIN');
 try{
  await client.query(`SET LOCAL ROLE ${OWNER}`);
  await client.query("SET LOCAL statement_timeout = '300s'");
  await client.query("SET LOCAL lock_timeout = '10s'");
  await client.query(body);
  await record(client,entry);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}

async function recordPhase(client,entry){
 await client.query('BEGIN');
 try{await client.query(`SET LOCAL ROLE ${OWNER}`);await record(client,entry);await client.query('COMMIT');}
 catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}

/** Run one stage against `connect(database)` clients. The main client holds a session advisory lock. */
export async function runStage({stage,plan,variables,connect,log=()=>{}}){
 if(!['meri','temporal','integration'].includes(stage))refuse('MERI_D2_STAGE');
 const script=plan.find(entry=>entry.path===DATABASE_SCRIPT).text;
 const phase=(name,extra={})=>runPsqlScript({text:script,variables:{[`phase_${name}`]:'1',...extra},connect,log});
 const main=await connect('capiro');let failure;
 try{
  const locked=(await main.query("SELECT pg_try_advisory_lock(hashtextextended('meri-first-chat-d2',0)) AS locked")).rows[0]?.locked;
  if(locked!==true)refuse('MERI_D2_ANOTHER_RUN_ACTIVE');
  const applied=verifyLedger(await readLedger(main),plan);
  if(stage==='temporal'&&applied<plan.findIndex(entry=>entry.stage==='temporal'))refuse('MERI_D2_MERI_STAGE_INCOMPLETE');
  if(stage==='integration'&&applied<plan.findIndex(entry=>entry.stage==='integration'))refuse('MERI_D2_PRIOR_STAGE_INCOMPLETE');
  log({event:'ledger',applied});
  await phase('bootstrap',variables);log({event:'phase',phase:'bootstrap'});
  for(const entry of plan.slice(applied)){
   if(entry.stage!==stage)break;
   if(entry.kind==='migration')await applyMigration(main,entry);
   else{await runPsqlScript({text:entry.text,variables:{[`phase_${entry.kind.slice(6)}`]:'1'},connect,log});await recordPhase(main,entry);}
   log({event:'applied',ordinal:entry.ordinal,name:entry.name,sha256:entry.sha256});
  }
  for(const entry of plan.slice(0,applied))if(entry.stage===stage)log({event:'skipped',ordinal:entry.ordinal,name:entry.name});
 }catch(error){failure=error;}
 try{
  const owner=(await main.query(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${OWNER}') AS owner`)).rows[0]?.owner;
  if(owner)await phase('release');log({event:'phase',phase:'release'});
 }catch(error){failure??=error;}
 finally{await main.end().catch(()=>{});}
 if(failure)throw failure;
}

// ---------------------------------------------------------------- process entry
function environment(env){
 const required=key=>{const value=env[key];if(typeof value!=='string'||!value)refuse('MERI_D2_ENV_MISSING',key);return value;};
 if(required('PGSSLMODE')!=='verify-full')refuse('MERI_D2_SSLMODE_VERIFY_FULL_REQUIRED');
 if(required('PGDATABASE')!=='capiro')refuse('MERI_D2_DATABASE_CAPIRO_REQUIRED');
 const host=required('PGHOST'),port=Number(env.PGPORT??'5432');
 if(!/^[a-z0-9.-]{1,253}$/u.test(host)||!Number.isSafeInteger(port)||port<1||port>65535)refuse('MERI_D2_ENDPOINT');
 const ca=readFileSync(required('PGSSLROOTCERT'),'utf8');if(!ca.includes('-----BEGIN CERTIFICATE-----'))refuse('MERI_D2_CA_BUNDLE');
 return {host,port,user:required('PGUSER'),password:required('PGPASSWORD'),ca};
}

export async function main(argv=process.argv.slice(2),env=process.env,out=line=>process.stdout.write(JSON.stringify(line)+'\n')){
 const [stage]=argv;
 if(!['plan','meri','temporal','integration'].includes(stage))refuse('MERI_D2_STAGE','use plan, meri, temporal or integration');
 const plan=loadPlan();
 if(stage==='plan'){out({event:'plan',entries:plan.map(({ordinal,name,sha256,stage:s})=>({ordinal,name,sha256,stage:s})),databaseScriptSha256:plan.find(entry=>entry.path===DATABASE_SCRIPT).sha256});return;}
 const c=environment(env),variables=passwordVariables(env);
 // The same locked pg 8.23.1 the control runtime uses (apps/runtime/package-lock.json, a production dependency).
 const pg=createRequire(resolve(ROOT,'apps/runtime/package.json'))('pg');
 const connect=async database=>{
  const client=new pg.Client({host:c.host,port:c.port,user:c.user,password:c.password,database,application_name:'meri-first-chat-d2',
   connectionTimeoutMillis:10000,ssl:{ca:c.ca,rejectUnauthorized:true,servername:c.host}});
  await client.connect();return client;
 };
 await runStage({stage,plan,variables,connect,log:out});
 out({event:'complete',stage});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{process.stderr.write(JSON.stringify({event:'failed',code:error.code??'MERI_D2_FAILED',message:String(error.message).slice(0,300)})+'\n');process.exitCode=1;});
}
