/** Offline checks for the D2 Stage 1 database script, its grants and the one-shot runner. No database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 ROOT,DATABASE_SCRIPT,INTEGRATION_SCRIPT,PLAN,PASSWORD_VARIABLES,lex,loadPlan,migrationBody,splitStatements,psqlLiteral,
 runPsqlScript,scramVerifier,passwordVariables,verifyLedger,runStage
} from './first-chat-migrate.mjs';

const read=path=>readFileSync(resolve(ROOT,path),'utf8');
const script=read(DATABASE_SCRIPT);
const PHASES=['bootstrap','meri_grants','temporal_grants','release'];
const passwords=Object.fromEntries(Object.keys(PASSWORD_VARIABLES).map((name,i)=>[name,`SCRAM-SHA-256$4096:c2FsdA==$${i}:${i}`]));
const META_SCHEMAS=new Set(['meri_conversations','meri_product_budget','meri_service_identity','meri_migration_ledger']);
const ROLES=new Set(['meri_product_migrator','meri_control_runtime','meri_model_budget_owner','meri_temporal_issuer_service',
 'meri_temporal_migrator','meri_temporal_primary_runtime','meri_temporal_visibility_runtime']);

/** Code with comments and every quoted/dollar-quoted body blanked: what PostgreSQL parses at top level. */
const code=text=>[...lex(text)].map(t=>t.type==='comment'?' ':t.type==='quoted'?"''":t.text).join('');

/** Execute one phase through the real interpreter against a recording fake; \gexec queries yield no rows. */
async function trace(phase,variables=passwords){
 const statements=[],gexec=[];
 const connect=async database=>({
  async query(q){if(typeof q==='object'){gexec.push({database,text:q.text});return {rows:[]};}statements.push({database,text:q});return {rows:[]};},
  async end(){}
 });
 await runPsqlScript({text:script,variables:{[`phase_${phase}`]:'1',...(phase==='bootstrap'?variables:{})},connect});
 return {statements,gexec};
}

/** GRANT parser: one tuple per role, privilege, object and column. */
function grants(statements){
 const out=new Set();
 for(const text of statements){
  const flat=text.replace(/\s+/gu,' ').trim();
  const m=/^GRANT (.+?) ON (?:(TABLE|SEQUENCE|SCHEMA|DATABASE|FUNCTION) )?(.+) TO (.+?);?$/u.exec(flat);
  if(!m)continue;
  const [,privs,kindRaw,objects,roles]=m,kind=kindRaw??'TABLE';
  const objectList=kind==='FUNCTION'?[objects.trim()]:objects.split(',').map(x=>x.trim());
  const privList=[];
  for(const p of privs.match(/[A-Z]+(?: \([^)]*\))?/gu)){
   const col=/^([A-Z]+) \(([^)]*)\)$/u.exec(p);
   if(col)for(const c of col[2].split(','))privList.push(`${col[1]}(${c.trim()})`);else privList.push(p);
  }
  for(const role of roles.split(',').map(x=>x.trim()))for(const object of objectList)for(const priv of privList)
   out.add(`${role} ${priv} ${kind} ${object}`);
 }
 return out;
}

/** The named first-chat blocks of the reviewed proposal (retention block is optional and not mounted). */
function proposalGrants(blocks){
 const proposal=read('infra/product-preview/existing-database-grants.sql');
 const chosen=[...proposal.matchAll(/\/\* DATABASE [^\n]*?-- ([^\n]+)\n([\s\S]*?)\*\//gu)]
  .filter(([,title])=>blocks.some(b=>title.startsWith(b))).map(([,,body])=>body);
 assert.equal(chosen.length,blocks.length);
 const statements=chosen.flatMap(body=>splitStatements(body.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n')).map(s=>s.text));
 return grants(statements.filter(s=>/^GRANT /u.test(s)&&!/ON DATABASE capiro/u.test(s)));
}

test('script is plain psql: one guarded phase each, ON_ERROR_STOP first, only the supported meta-commands',()=>{
 const metas=[...lex(script)].filter(t=>t.type==='meta').map(t=>t.text.split(/\s/u)[0]);
 assert.equal(metas[0],'\\set');
 assert.deepEqual([...new Set(metas)].sort(),['\\connect','\\endif','\\gexec','\\if','\\set']);
 for(const phase of PHASES)assert.match(script,new RegExp(`^\\\\if :\\{\\?phase_${phase}\\}$`,'mu'));
 assert.equal(metas.filter(m=>m==='\\if').length,PHASES.length);
});

test('no literal password: every PASSWORD takes %L from a psql variable, and only the six declared variables exist',()=>{
 const top=code(script);
 assert.doesNotMatch(top,/PASSWORD\s+'/iu);
 const quotedPasswords=[...script.matchAll(/PASSWORD[^\n]*/gu)].map(m=>m[0]);
 assert.equal(quotedPasswords.length,6);
 for(const line of quotedPasswords)assert.match(line,/PASSWORD %L', :'[a-z_]+_password'\) \\gexec$/u);
 const used=[...script.split('\n').filter(l=>!l.startsWith('--')).join('\n').matchAll(/:'([a-z_]+)'/gu)].map(m=>m[1]).sort();
 assert.deepEqual(used,Object.keys(PASSWORD_VARIABLES).sort());
});

test('no privileged attribute, broad grant, default privilege, grant option or destructive DDL at top level',()=>{
 const top=code(script);
 for(const bad of [/(?<!NO)\bSUPERUSER\b/u,/(?<!NO)\bBYPASSRLS\b/u,/(?<!NO)\bCREATEROLE\b/u,/(?<!NO)\bREPLICATION\b/u,
  /(?<!NO)\bCREATEDB\b/u,/WITH\s+GRANT\s+OPTION/iu,/WITH\s+ADMIN/iu,/DEFAULT\s+PRIVILEGES/iu,/ALL\s+(TABLES|SEQUENCES|FUNCTIONS)/iu,
  /\bDROP\b/iu,/\bTRUNCATE\b/iu,/\bCASCADE\b/iu,/\bDELETE\s+FROM\b/iu,/ALTER\s+DATABASE/iu,/OWNER\s+TO/iu,/REASSIGN/iu])
  assert.doesNotMatch(top,bad,String(bad));
 // Inside DO blocks, CREATE ROLE is only ever the NO-attribute form.
 for(const m of script.matchAll(/CREATE ROLE[^']*'/gu))
  assert.equal(m[0],"CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'");
});

test('every executed statement touches only new Meri roles, Meri schemas, temporal databases or temporal public',async()=>{
 const executed=[];
 for(const phase of PHASES){const t=await trace(phase);executed.push(...t.statements,...t.gexec);}
 for(const {database,text} of executed){
  const top=code(text).replace(/\s+/gu,' ');
  assert.ok(['capiro','temporal','temporal_visibility'].includes(database),database);
  for(const [,schema] of top.matchAll(/\b([a-z_][a-z0-9_]*)\.[a-z_][a-z0-9_]*/gu)){
   if(schema==='public'){assert.notEqual(database,'capiro',`public object on capiro: ${top}`);continue;}
   assert.ok(META_SCHEMAS.has(schema),`foreign schema ${schema}: ${top}`);
  }
  if(/SCHEMA public/u.test(top))assert.notEqual(database,'capiro',top);
  if(/^(GRANT|REVOKE) /u.test(top))for(const [,roles] of top.matchAll(/\b(?:TO|FROM) ((?:[a-z_][a-z0-9_]*|CURRENT_USER|PUBLIC)(?:, ?(?:[a-z_][a-z0-9_]*|CURRENT_USER|PUBLIC))*)/gu))
   for(const role of roles.split(/, ?/u)){
    if(role==='PUBLIC'&&database==='capiro')assert.match(top,/ON (SCHEMA meri_|TABLE meri_|DATABASE temporal)/u,`PUBLIC change on capiro: ${top}`);
    assert.ok(ROLES.has(role)||role==='CURRENT_USER'||role==='PUBLIC',`role ${role}: ${top}`);
   }
  for(const [,db] of top.matchAll(/ON DATABASE ([a-z_]+)/gu)){
   assert.ok(['capiro','temporal','temporal_visibility'].includes(db),db);
   if(db==='capiro')assert.match(top,/^(GRANT CONNECT ON DATABASE capiro TO meri_control_runtime, meri_model_budget_owner, meri_temporal_issuer_service|GRANT CREATE ON DATABASE capiro TO meri_product_migrator|REVOKE CREATE ON DATABASE capiro FROM meri_product_migrator);$/u,top);
  }
  for(const [,role] of top.matchAll(/ALTER ROLE ([a-z_]+)/gu))assert.ok(ROLES.has(role),role);
  for(const [,db] of top.matchAll(/CREATE DATABASE ([a-z_]+)/gu))assert.ok(['temporal','temporal_visibility'].includes(db));
 }
 const bootstrap=await trace('bootstrap');
 assert.deepEqual(bootstrap.gexec.filter(g=>/CREATE DATABASE/u.test(g.text)).map(g=>g.database),['capiro','capiro']);
 assert.ok(bootstrap.gexec.every(g=>!/BEGIN/u.test(g.text)));
});

test('phases run only their own block; bootstrap needs every password and nothing else does',async()=>{
 await assert.rejects(trace('bootstrap',{...passwords,issuer_password:undefined}).catch(e=>{throw e;}),/MERI_D2_PSQL_VARIABLE_MISSING|MERI_D2_VARIABLE_REFUSED/u);
 const missing={...passwords};delete missing.control_password;
 await assert.rejects(trace('bootstrap',missing),/MERI_D2_PSQL_VARIABLE_MISSING: control_password/u);
 const b=await trace('bootstrap'),m=await trace('meri_grants'),t=await trace('temporal_grants'),r=await trace('release');
 assert.ok(b.statements.some(s=>/CREATE EXTENSION IF NOT EXISTS btree_gin/u.test(s.text)&&s.database==='temporal_visibility'));
 assert.equal(b.gexec.filter(g=>/ALTER ROLE/u.test(g.text)).length,6);
 assert.ok(!m.statements.some(s=>/CREATE ROLE|ALTER ROLE/u.test(s.text))&&m.statements.every(s=>s.database==='capiro'));
 assert.deepEqual([...new Set(t.statements.map(s=>s.database))],['capiro','temporal','temporal_visibility']);
 assert.deepEqual(r.statements.slice(1).map(s=>s.text.replace(/\s+/gu,' ')),['DO $$ BEGIN IF current_database() <> \'capiro\' THEN RAISE EXCEPTION \'MERI_D2_RUN_ON_DATABASE_CAPIRO\'; END IF; IF current_setting(\'server_version_num\')::int < 160000 THEN RAISE EXCEPTION \'MERI_D2_POSTGRESQL_16_REQUIRED\'; END IF; END $$;',
  'RESET ROLE;','REVOKE CREATE ON DATABASE capiro FROM meri_product_migrator;','REVOKE meri_product_migrator FROM CURRENT_USER;','REVOKE meri_temporal_migrator FROM CURRENT_USER;']);
 for(const phase of PHASES)assert.match((await trace(phase)).statements[0].text,/^SELECT CASE WHEN \(TRUE\)::int \+ \(FALSE\)::int|^SELECT CASE WHEN \(FALSE\)::int/u);
});

test('Meri grants equal the reviewed first-chat proposal blocks plus the issuer grants its migration names',async()=>{
 const m=await trace('meri_grants'),actual=grants(m.statements.map(s=>s.text));
 const expected=proposalGrants(['existing approved application database','first-chat CONTROL store','CONTROL SDK/selected','CONTROL canonical allocation','MODEL owner']);
 for(const g of ['meri_temporal_issuer_service USAGE SCHEMA meri_service_identity',
  'meri_temporal_issuer_service SELECT TABLE meri_service_identity.service_task_registrations',
  'meri_temporal_issuer_service INSERT TABLE meri_service_identity.service_task_registrations',
  ...['certificate_sha256','expires_at_ms','proof_observed_at_ms','generation','updated_at','revoked_at']
   .map(c=>`meri_temporal_issuer_service UPDATE(${c}) TABLE meri_service_identity.service_task_registrations`)])expected.add(g);
 assert.deepEqual([...actual].sort(),[...expected].sort());
 // The issuer migration's own comment names the same column list.
 assert.match(read('apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql'),
  /UPDATE\(certificate_sha256,expires_at_ms,\n-- proof_observed_at_ms,generation,updated_at,revoked_at\)/u);
});

test('Temporal grants equal the reviewed pinned-catalog proposal',async()=>{
 const t=await trace('temporal_grants'),actual=grants(t.statements.map(s=>s.text));
 const proposal=read('infra/product-preview/existing-database-grants.sql');
 const blocks=[...proposal.matchAll(/\/\* DATABASE (temporal|temporal_visibility) --[\s\S]*?\*\//gu)].map(m=>m[0]);
 assert.equal(blocks.length,2);
 const statements=blocks.flatMap(b=>splitStatements(b.slice(2,-2).split('\n').filter(l=>!l.trim().startsWith('--')&&!l.startsWith(' DATABASE')).join('\n')).map(s=>s.text));
 const expected=grants(statements.filter(s=>/^GRANT /u.test(s)&&!/ON (DATABASE|SCHEMA)/u.test(s)));
 assert.deepEqual([...actual].sort(),[...expected].sort());
 const b=grants((await trace('bootstrap')).statements.map(s=>s.text));
 for(const g of ['meri_temporal_primary_runtime CONNECT DATABASE temporal','meri_temporal_visibility_runtime CONNECT DATABASE temporal_visibility',
  'meri_temporal_primary_runtime USAGE SCHEMA public','meri_temporal_visibility_runtime USAGE SCHEMA public'])assert.ok(b.has(g),g);
 assert.equal([...expected].filter(g=>g.startsWith('meri_temporal_primary_runtime SELECT TABLE')).length,38);
});

// ---------------------------------------------------------------- source coverage
const BUDGET=name=>`meri_product_budget.${name}`;
/** The SQL text argument of every `query(` call: string/template literals joined by `+identifier+`. */
function literals(path){
 const text=read(path),out=[];
 for(const m of text.matchAll(/\bquery\(/gu)){
  let i=m.index+m[0].length,sql='';
  for(;;){
   while(/\s/u.test(text[i]))i++;
   const q=text[i];
   if(q==="'"||q==='"'||q==='`'){
    let j=i+1,depth=0;
    for(;;){const c=text[j];if(c==='\\'){j+=2;continue;}if(q==='`'&&c==='$'&&text[j+1]==='{'){depth++;j+=2;continue;}
     if(depth&&c==='}'){depth--;j++;continue;}if(!depth&&c===q)break;j++;}
    sql+=text.slice(i+1,j);i=j+1;
   }else{const id=/^[A-Za-z_][A-Za-z0-9_]*/u.exec(text.slice(i));if(!id)break;sql+=id[0]==='table'?'<<TABLE>>':`<<${id[0]}>>`;i+=id[0].length;}
   while(/\s/u.test(text[i]))i++;
   if(text[i]!=='+')break;i++;
  }
  const s=sql.replace(/\s+/gu,' ').trim();
  if(/^(SELECT|INSERT|UPDATE|WITH)\b/u.test(s)&&/\b(FROM|INTO|SET)\b/u.test(s))out.push(s);
 }
 return out;
}
function resolveTemplates(sql,path){
 const variants=[];
 const tables=path.endsWith('native-preparation-journal.mjs')?['meri_conversations.native_allocations','meri_conversations.native_restorations']
  :path.endsWith('prepared-run-issuance-postgres.mjs')?['meri_conversations.run_issuances','meri_conversations.model_run_issuances']:[null];
 for(const table of tables){
  let s=sql.replace(/\$\{(?:t|store\.tables|this\.tables)\.([a-z_]+)\}/gu,(_,n)=>BUDGET(n))
   .replace(/\$\{tables\.budgets\}/gu,BUDGET('tenant_budgets')).replace(/\$\{tables\.reservations\}/gu,BUDGET('tenant_run_reservations'))
   .replace(/\$\{(suffix|locked\?' FOR UPDATE':'')\}/gu,' FOR UPDATE').replace(/\$\{model\?[^}]*\}/gu,'')
   .replace(/\$\{(COLUMNS|ROW)\}/gu,'*');
  if(table)s=s.replaceAll('<<TABLE>>',table).replaceAll('${table}',table);
  if(s.includes('${column}'))for(const c of ['released_at','settled_at','not_dispatched_at'])variants.push(s.replace('${column}',c));
  else variants.push(s);
 }
 for(const v of variants)assert.doesNotMatch(v,/\$\{|<<TABLE>>/u,`unresolved template in ${path}: ${v}`);
 return variants;
}
/** Required privileges, as grant tuples, for one SQL statement (meri_* relations only). */
function required(sql){
 const need=[];const meri=t=>/^meri_[a-z_]+\.[a-z_]+$/u.test(t);
 const insert=/^INSERT INTO ([a-z_.]+)/u.exec(sql);if(insert&&meri(insert[1]))need.push(['INSERT',insert[1]]);
 const upd=/^UPDATE ([a-z_.]+)(?: [a-z])? SET (.+?)(?: WHERE | RETURNING |$)/u.exec(sql);
 const conflict=/ON CONFLICT \([a-z_]+\) DO UPDATE SET (.+?)(?: WHERE |$)/u.exec(sql);
 for(const [table,set] of [[upd?.[1],upd?.[2]],[insert?.[1],conflict?.[1]]])if(table&&set&&meri(table)){
  let depth=0,part='';const parts=[];for(const ch of set){if(ch==='(')depth++;if(ch===')')depth--;if(ch===','&&depth===0){parts.push(part);part='';}else part+=ch;}parts.push(part);
  for(const p of parts){const col=/^\s*([a-z_][a-z0-9_]*)\s*=/u.exec(p);assert.ok(col,`unparsed SET item "${p}" in ${sql}`);need.push([`UPDATE(${col[1]})`,table]);}
  need.push(['SELECT',table]);
 }
 for(const m of sql.matchAll(/\b(?:FROM|JOIN) ([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/gu))if(meri(m[1])){
  need.push(['SELECT',m[1]]);if(/ FOR UPDATE\b/u.test(sql))need.push(['LOCK',m[1]]);
 }
 if(/RETURNING/u.test(sql)&&insert&&meri(insert[1]))need.push(['SELECT',insert[1]]);
 return need;
}
function assertCovered(role,statements,granted){
 const has=(priv,table)=>granted.has(`${role} ${priv} TABLE ${table}`);
 const uncovered=[];
 for(const {sql,path} of statements)for(const [priv,table] of required(sql)){
  const ok=priv==='LOCK'?[...granted].some(g=>g.startsWith(`${role} UPDATE(`)&&g.endsWith(` TABLE ${table}`)):has(priv,table);
  if(!ok)uncovered.push(`${path}: ${priv} ${table}`);
 }
 assert.deepEqual([...new Set(uncovered)],[]);
}
const CONTROL_FILES=['apps/control/conversations/postgres-store.mjs','apps/control/conversations/completion-journal.mjs',
 'apps/control/conversations/execution-journal.mjs','apps/control/conversations/initial-input-journal.mjs',
 'apps/control/conversations/initial-run-binding-journal.mjs','apps/control/conversations/lifecycle/journal.mjs',
 'apps/control/conversations/native-preparation-journal.mjs','apps/control/conversations/next-run-journal.mjs',
 'apps/control/conversations/sequence-ranges.mjs','apps/control/conversations/history/store.mjs',
 'apps/control/conversations/skills/retention.mjs','apps/runtime/native-authority/session-owner.mjs',
 'apps/runtime/selected/ledger.mjs','apps/runtime/prepared-run-issuance-postgres.mjs',
 'apps/gateway/budget/native-allocation-admission.mjs','apps/gateway/budget/admitted-run-current.mjs',
 'apps/gateway/budget/postgres-budget-store.mjs','apps/gateway/budget/tenant/postgres-store.mjs',
 'apps/gateway/budget/tenant/native-admission.mjs'];

test('every table and column the control sources read, lock or write is granted to meri_control_runtime',async()=>{
 const granted=grants((await trace('meri_grants')).statements.map(s=>s.text));
 const statements=CONTROL_FILES.flatMap(path=>literals(path).flatMap(sql=>resolveTemplates(sql,path).map(s=>({sql:s,path}))));
 assert.ok(statements.length>80,String(statements.length));
 for(const write of ['INSERT INTO meri_conversations.sdk_session_entries','UPDATE meri_conversations.runs SET sequence_end',
  'INSERT INTO meri_product_budget.tenant_run_reservations','UPDATE meri_product_budget.grants SET state=\'ACTIVE\'',
  'UPDATE meri_conversations.model_run_issuances SET facts_sha256'])
  assert.ok(statements.some(s=>s.sql.startsWith(write)),write);
 assertCovered('meri_control_runtime',statements,granted);
 // The 0009 event trigger locks the parent run as the inserting role.
 assert.ok([...granted].some(g=>g.startsWith('meri_control_runtime UPDATE(')&&g.endsWith('TABLE meri_conversations.runs')));
});

test('every table and column the model budget owner reads, locks or writes is granted to meri_model_budget_owner',async()=>{
 const granted=grants((await trace('meri_grants')).statements.map(s=>s.text));
 const files=['apps/gateway/budget/product-model-budget.mjs','apps/gateway/budget/product-model-settlement.mjs',
  'apps/gateway/budget/admitted-run-current.mjs','apps/gateway/budget/postgres-budget-store.mjs','apps/proxy/product/product-owner-facts.mjs'];
 const statements=files.flatMap(path=>literals(path).flatMap(sql=>resolveTemplates(sql,path).map(s=>({sql:s,path}))));
 // Borrowed canonical conversation reads (postgres-store readState, preparation load, model issuance read).
 const borrowed=[
  ['apps/control/conversations/postgres-store.mjs','SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE'],
  ['apps/control/conversations/postgres-store.mjs','SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND sequence>$4 ORDER BY sequence LIMIT $5'],
  ['apps/control/conversations/native-preparation-journal.mjs','SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE'],
  ['apps/runtime/prepared-run-issuance-postgres.mjs','SELECT * FROM meri_conversations.model_run_issuances WHERE issuance_key=$1']];
 for(const [path,sql] of borrowed){
  assert.ok(literals(path).flatMap(s=>resolveTemplates(s,path)).includes(sql),`${path}: ${sql}`);
  statements.push({sql,path});
 }
 assert.ok(statements.some(s=>s.sql.startsWith('INSERT INTO meri_product_budget.requests')));
 assert.ok(statements.some(s=>s.sql.startsWith('UPDATE meri_product_budget.budget SET consumed_micro_usd')));
 assertCovered('meri_model_budget_owner',statements,granted);
 // No model write to grants state, issuance or tenant policy.
 for(const g of granted)if(g.startsWith('meri_model_budget_owner '))
  assert.doesNotMatch(g,/(INSERT|UPDATE\(state\)) TABLE meri_product_budget\.grants|TABLE meri_conversations\.(model_run_issuances|run_issuances) .*(INSERT|UPDATE)|tenant_/u);
});

test('the issuer\'s writes and its startup probe are satisfied exactly',async()=>{
 const path='apps/runtime/temporal-issuer/service-task-registration-pg.mjs';
 const granted=grants((await trace('meri_grants')).statements.map(s=>s.text));
 const statements=literals(path).flatMap(sql=>resolveTemplates(sql,path).map(s=>({sql:s,path})));
 assert.ok(statements.some(s=>/ON CONFLICT \(task_arn\) DO UPDATE SET revoked_at/u.test(s.sql)));
 assertCovered('meri_temporal_issuer_service',statements,granted);
 const probe=read(path);
 const columns=/a\.attname NOT IN\s*\(([^)]*)\)/u.exec(probe)[1].match(/[a-z0-9_]+/gu);
 const updates=[...granted].filter(g=>g.startsWith('meri_temporal_issuer_service UPDATE(')).map(g=>/UPDATE\(([a-z0-9_]+)\)/u.exec(g)[1]);
 assert.deepEqual(updates.sort(),[...columns].sort());
 assert.deepEqual([...granted].filter(g=>g.startsWith('meri_temporal_issuer_service ')&&!g.includes('UPDATE(')).sort(),
  ['meri_temporal_issuer_service INSERT TABLE meri_service_identity.service_task_registrations',
   'meri_temporal_issuer_service SELECT TABLE meri_service_identity.service_task_registrations',
   'meri_temporal_issuer_service USAGE SCHEMA meri_service_identity']);
 assert.match(script,/CREATE ROLE %I NOLOGIN NOINHERIT/u,'the probe refuses an inheriting issuer role');
});

// ---------------------------------------------------------------- runner
test('plan pins the change-set order, real paths and current bytes; 0012 and 0014 stay held',()=>{
 const plan=loadPlan();
 assert.deepEqual(plan.map(e=>e.name.replace(/^.*\//u,'')),[
  '0001_conversations.sql','0002_lifecycle.sql','0003_selected_outputs.sql','0004_sdk_sessions.sql','0005_selected_reads.sql',
  '0006_native_executions.sql','0007_native_preparation.sql','0008_native_prepared_launch.sql','0009_next_runs.sql',
  '0010_retention.sql','0011_run_issuance.sql','0013_retention_recovery_watermark.sql','0015_model_run_issuance.sql',
  '0016_initial_inputs.sql','0017_initial_run_bindings.sql','0001_product_budget.sql','0002_tenant_budgets.sql',
  '0001_service_task_registrations.sql','first-chat-seed-budget.sql','first-chat-database.sql#meri_grants','first-chat-database-temporal.sql#temporal_grants',
  '0001_settings.sql','0001_commands.sql','0001_approval_metadata.sql','0001_intent_preparations.sql','0001_schedule_owner.sql','0002_occurrences.sql','0003_run_cancel_proofs.sql','0004_read_consent.sql',
  '0001_task_lookup.sql','0001_objective_custody.sql','0002_objective_run_starts.sql','0003_objective_reader_replays.sql','0001_versions.sql','0002_retention.sql','0003_previews.sql','0001_memory_candidates.sql','0001_read_delegation_facts.sql','first-chat-database-integration.sql#integration_grants']);
 assert.ok(!plan.some(e=>/00(12|14)_/u.test(e.name)));
 assert.equal(plan.find(e=>e.name.includes('temporal-issuer')).path,'apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql');
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path.endsWith('0009_next_runs.sql')?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
 const seed=read('infra/product-preview/first-chat-seed-budget.sql');
 assert.match(seed,/INSERT INTO meri_product_budget\.budget \(id, cap_micro_usd, consumed_micro_usd, quarantined\)\nVALUES \(1, 25000000, 0, false\)/u);
 const budget=read('apps/gateway/budget/migrations/0001_product_budget.sql');
 for(const column of ['id integer PRIMARY KEY CHECK (id=1)','cap_micro_usd bigint','consumed_micro_usd bigint','quarantined boolean'])assert.ok(budget.includes(column));
 assert.match(read('apps/runtime/Dockerfile'),/^COPY infra\/product-preview\/first-chat-migrate\.mjs infra\/product-preview\/first-chat-database\.sql infra\/product-preview\/first-chat-database-temporal\.sql infra\/product-preview\/first-chat-database-integration\.sql infra\/product-preview\/first-chat-seed-budget\.sql \.\/infra\/product-preview\/$/mu);
 assert.match(read('apps/runtime/package-lock.json'),/"node_modules\/pg": \{\n\s+"version": "8\.23\.1"/u);
});

test('integration grants only the schedule consent reference update column to control',async()=>{
 const statements=[];
 await runPsqlScript({
  text:read(INTEGRATION_SCRIPT),variables:{phase_integration_grants:'1'},
  connect:async()=>({async query(q){if(typeof q==='string')statements.push(q);return {rows:[]};},async end(){}})
 });
 const actual=grants(statements);
 const projectionUpdates=[...actual].filter(g=>g.startsWith('meri_control_runtime UPDATE')&&
  g.endsWith(' TABLE meri_schedules.projections')).sort();
 assert.deepEqual(projectionUpdates,[
  'active_intent','generation','projection','projection_sha256','read_consent'
 ].map(column=>`meri_control_runtime UPDATE(${column}) TABLE meri_schedules.projections`).sort());
 assert.ok(actual.has('meri_control_runtime SELECT TABLE meri_schedules.projections'));
 assert.ok(!actual.has('meri_control_runtime UPDATE TABLE meri_schedules.projections'));
 assert.match(read('apps/control/schedules/postgres-schedule-owner.mjs'),
  /UPDATE meri_schedules\.projections SET read_consent=\$4 WHERE tenant_id=\$1 AND schedule_id=\$2 AND generation=\$3/u);
});

test('migration bodies: one outer BEGIN/COMMIT is stripped, bare files run whole, anything else is refused',()=>{
 for(const e of loadPlan().filter(e=>e.kind==='migration')){
  const body=migrationBody(e.text);
  assert.ok(splitStatements(body).every(s=>!/^(BEGIN|COMMIT)$/iu.test(s.text)),e.name);
 }
 assert.equal(migrationBody('-- c\nBEGIN;\nCREATE TABLE a(x int);\nCOMMIT;\n'),'\nCREATE TABLE a(x int);\n');
 assert.equal(migrationBody('CREATE TABLE a(x int);'),'CREATE TABLE a(x int);');
 assert.equal(migrationBody("BEGIN;\nDO $$ BEGIN RAISE EXCEPTION 'x;y'; END $$;\nCOMMIT;"),"\nDO $$ BEGIN RAISE EXCEPTION 'x;y'; END $$;\n");
 for(const bad of ['BEGIN;CREATE TABLE a(x int);COMMIT;BEGIN;SELECT 1;COMMIT;','CREATE TABLE a(x int);COMMIT;',
  'BEGIN;SET ROLE postgres;SELECT 1;COMMIT;','SET LOCAL ROLE x;SELECT 1;','RESET ROLE;','\\connect postgres\nSELECT 1;'])
  assert.throws(()=>migrationBody(bad),/MERI_D2_MIGRATION/u,bad);
});

test('psql subset: literal quoting, defined-variable tests, gexec and connect follow psql',async()=>{
 assert.equal(psqlLiteral("a'b"),"'a''b'");
 assert.equal(psqlLiteral('a\\b')," E'a\\\\b'");
 const log=[];
 const connect=async database=>({async query(q){
  if(typeof q==='object'){log.push(['gexec',database,q.text]);return {rows:[['SELECT 2'],[null,'SELECT 3']]};}
  log.push([database,q]);return {rows:[]};},async end(){log.push(['end',database]);}});
 await runPsqlScript({text:"\\set ON_ERROR_STOP on\nSELECT :'v', :{?v}, :{?w}, x::int;\n\\if :{?w}\nSELECT :'missing';\n\\endif\n\\if :{?v}\nSELECT 1 \\gexec\n\\connect other\nSELECT ';' -- c\n;\n\\endif\n",
  variables:{v:"it's"},connect});
 assert.deepEqual(log,[['capiro',"SELECT 'it''s', TRUE, FALSE, x::int;"],['gexec','capiro','SELECT 1'],['capiro','SELECT 2'],['capiro','SELECT 3'],
  ['end','capiro'],['other',"SELECT ';' \n;"],['end','other']]);
 for(const bad of ['\\echo hi\n','\\set ON_ERROR_STOP off\n','\\if :{?v}\nSELECT 1;\n','SELECT 1','SELECT :v;\n','\\endif\n','SELECT :\'nope\';\n'])
  await assert.rejects(runPsqlScript({text:bad,variables:{v:'x'},connect}),/MERI_D2_PSQL/u,bad);
});

test('passwords become SCRAM-SHA-256 verifiers (RFC 7677 vector) and must be distinct URL-safe secrets',()=>{
 const v=scramVerifier('pencil',Buffer.from('W22ZaJ0SNY7soEsUEjb6gQ==','base64'));
 assert.match(v,/^SCRAM-SHA-256\$4096:W22ZaJ0SNY7soEsUEjb6gQ==\$[A-Za-z0-9+/=]{44}:[A-Za-z0-9+/=]{44}$/u);
 const env=Object.fromEntries(Object.values(PASSWORD_VARIABLES).map((k,i)=>[k,`p${i}`.padEnd(40,'x')]));
 const vars=passwordVariables(env);
 assert.deepEqual(Object.keys(vars).sort(),Object.keys(PASSWORD_VARIABLES).sort());
 for(const value of Object.values(vars)){assert.match(value,/^SCRAM-SHA-256\$4096:/u);assert.ok(!Object.values(env).some(p=>value.includes(p)));}
 assert.throws(()=>passwordVariables({...env,MERI_D2_ISSUER_PASSWORD:'short'}),/MERI_D2_PASSWORD_REFUSED/u);
 assert.throws(()=>passwordVariables({...env,MERI_D2_ISSUER_PASSWORD:env.MERI_D2_CONTROL_PASSWORD}),/MERI_D2_PASSWORDS_NOT_DISTINCT/u);
 assert.throws(()=>passwordVariables({...env,MERI_D2_ISSUER_PASSWORD:"x'".padEnd(40,'y')}),/MERI_D2_PASSWORD_REFUSED/u);
});

/** In-memory database: enough of PostgreSQL to drive the runner's ordering, ledger and transaction rules. */
function fakeDatabase({failOn}={}){
 const state={ledger:[],owner:false,ledgerTable:false,executed:[],phases:[],released:0,locked:false};
 const connect=async database=>{
  let pending=null;
  return {async query(q,params){
   const text=(typeof q==='object'?q.text:q).replace(/\s+/gu,' ').trim();
   if(typeof q==='object')return {rows:[]};
   if(/pg_try_advisory_lock/u.test(text)){const ok=!state.locked;state.locked=true;return {rows:[{locked:ok}]};}
   if(/to_regclass\('meri_migration_ledger\.applied'\) IS NOT NULL AS ledger/u.test(text))return {rows:[{ledger:state.ledgerTable,owner:state.owner}]};
   if(/^SELECT EXISTS \(SELECT 1 FROM pg_roles/u.test(text))return {rows:[{owner:state.owner}]};
   if(/^SELECT ordinal,name,sha256 FROM/u.test(text))return {rows:state.ledger.map(r=>({...r}))};
   if(text==='BEGIN'){pending=[];return {rows:[]};}
   if(text==='COMMIT'){state.ledger.push(...pending);pending=null;return {rows:[]};}
   if(text==='ROLLBACK'){pending=null;return {rows:[]};}
   if(/^INSERT INTO meri_migration_ledger/u.test(text)){assert.ok(pending,'ledger write outside a transaction');pending.push({ordinal:params[0],name:params[1],sha256:params[2]});return {rows:[]};}
   if(/^SELECT CASE WHEN \(TRUE\)::int\s*\+/u.test(text)){state.phases.push('bootstrap');}
   if(/^SELECT CASE WHEN \(TRUE\)::int = 1 THEN 'ok'/u.test(text))state.phases.push(/INTEGRATION_GRANTS/u.test(text)?'integration_grants':'temporal_grants');
   if(/^SELECT CASE WHEN \(FALSE\)::int \+ \(TRUE\)::int \+ \(FALSE\)::int/u.test(text))state.phases.push('meri_grants');
   if(/^SELECT CASE WHEN \(FALSE\)::int \+ \(FALSE\)::int \+ \(TRUE\)::int/u.test(text))state.phases.push('temporal_grants');
   if(/^SELECT CASE WHEN \(FALSE\)::int \+ \(FALSE\)::int \+ \(FALSE\)::int \+ \(TRUE\)::int/u.test(text))state.phases.push('release');
   if(/CREATE TABLE IF NOT EXISTS meri_migration_ledger\.applied/u.test(text)){state.ledgerTable=true;state.owner=true;}
   if(/^REVOKE meri_product_migrator FROM CURRENT_USER/u.test(text))state.released++;
   if(pending&&!/^SET LOCAL/u.test(text)){state.executed.push(text);if(failOn&&text.includes(failOn))throw Object.assign(Error('boom'),{code:'XX000'});}
   return {rows:[]};
  },async end(){if(database==='capiro')state.locked=false;}};
 };
 return {state,connect};
}
const variables=passwords;

test('runner applies the meri stage in order, one transaction and ledger row each, then releases',async()=>{
 const plan=loadPlan(),db=fakeDatabase(),events=[];
 await runStage({stage:'meri',plan,variables,connect:db.connect,log:e=>events.push(e)});
 assert.deepEqual(db.state.ledger.map(r=>r.ordinal),plan.slice(0,20).map(e=>e.ordinal));
 assert.deepEqual(db.state.ledger.map(r=>r.sha256),plan.slice(0,20).map(e=>e.sha256));
 assert.deepEqual(db.state.phases,['bootstrap','meri_grants','release']);
 assert.equal(db.state.executed.length,19);
 assert.ok(db.state.executed.every(sql=>!/^\s*BEGIN;|COMMIT;\s*$/u.test(sql)));
 assert.equal(db.state.released,1);
 // Re-run: nothing re-applied, bootstrap and release still run.
 const again=fakeDatabase();again.state.ledger=db.state.ledger;again.state.ledgerTable=again.state.owner=true;
 const log=[];await runStage({stage:'meri',plan,variables,connect:again.connect,log:e=>log.push(e)});
 assert.equal(again.state.executed.length,0);
 assert.equal(log.filter(e=>e.event==='skipped').length,20);
 assert.deepEqual(again.state.phases,['bootstrap','release']);
 // Temporal stage then applies only its phase.
 await runStage({stage:'temporal',plan,variables,connect:again.connect});
 assert.deepEqual(again.state.ledger.map(r=>r.ordinal),plan.filter(e=>e.stage!=='integration').map(e=>e.ordinal));
 assert.deepEqual(again.state.phases,['bootstrap','release','bootstrap','temporal_grants','release']);
});

test('integration stage runs only after meri and temporal are ledgered; earlier stages never reach its entries',async()=>{
 const plan=loadPlan(),integration=plan.filter(e=>e.stage==='integration');
 assert.equal(integration.length,18);assert.equal(integration.at(-1).kind,'phase:integration_grants');
 const early=fakeDatabase();
 await assert.rejects(runStage({stage:'integration',plan,variables,connect:early.connect}),/MERI_D2_PRIOR_STAGE_INCOMPLETE/u);
 assert.equal(early.state.executed.length,0);
 const ready=fakeDatabase();ready.state.ledger=plan.filter(e=>e.stage!=='integration').map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));ready.state.ledgerTable=ready.state.owner=true;
 await runStage({stage:'meri',plan,variables,connect:ready.connect});await runStage({stage:'temporal',plan,variables,connect:ready.connect});
 assert.equal(ready.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:ready.connect});
 assert.deepEqual(ready.state.ledger.map(r=>r.ordinal),plan.map(e=>e.ordinal));
 assert.equal(ready.state.executed.length,17);assert.ok(ready.state.phases.includes('integration_grants'));
});
test('runner refuses a changed applied file, a ledger gap and an early temporal stage before any bootstrap',async()=>{
 const plan=loadPlan();
 const changed=fakeDatabase();changed.state.ledgerTable=changed.state.owner=true;
 changed.state.ledger=plan.slice(0,3).map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));changed.state.ledger[1].sha256='f'.repeat(64);
 await assert.rejects(runStage({stage:'meri',plan,variables,connect:changed.connect}),/MERI_D2_APPLIED_FILE_CHANGED: apps\/control\/conversations\/migrations\/0002_lifecycle\.sql/u);
 assert.deepEqual(changed.state.phases,['release']);
 const gap=fakeDatabase();gap.state.ledgerTable=gap.state.owner=true;
 gap.state.ledger=[plan[0],plan[2]].map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));
 await assert.rejects(runStage({stage:'meri',plan,variables,connect:gap.connect}),/MERI_D2_LEDGER/u);
 const early=fakeDatabase();
 await assert.rejects(runStage({stage:'temporal',plan,variables,connect:early.connect}),/MERI_D2_MERI_STAGE_INCOMPLETE/u);
 assert.deepEqual(early.state.phases,[]);
 assert.throws(()=>verifyLedger([{ordinal:1,name:plan[1].name,sha256:plan[1].sha256}],plan),/MERI_D2_LEDGER_ORDER/u);
});

test('a failing migration rolls back without a ledger row, stops the run and still releases',async()=>{
 const plan=loadPlan(),db=fakeDatabase({failOn:'CREATE TABLE meri_conversations.next_runs'});
 await assert.rejects(runStage({stage:'meri',plan,variables,connect:db.connect}),/boom/u);
 assert.deepEqual(db.state.ledger.map(r=>r.ordinal),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(db.state.phases,['bootstrap','release']);
 const busy=fakeDatabase();busy.state.locked=true;
 await assert.rejects(runStage({stage:'meri',plan,variables,connect:busy.connect}),/MERI_D2_ANOTHER_RUN_ACTIVE/u);
});

test('PLAN is frozen and every entry is pinned to a 64-hex digest',()=>{
 assert.ok(Object.isFrozen(PLAN)&&PLAN.every(Object.isFrozen));
 assert.ok(PLAN.every(e=>/^[a-f0-9]{64}$/u.test(e.pinned)));
 assert.equal(new Set(PLAN.filter(e=>e.path===DATABASE_SCRIPT).map(e=>e.pinned)).size,1);
});

test('every infra file the runtime Dockerfile copies is re-included by .dockerignore',()=>{
 const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
 const ignore=read('.dockerignore').split('\n'),docker=read('apps/runtime/Dockerfile');
 const copied=[...docker.matchAll(/^COPY (?!--from)(?:--\S+ )*(.+) \S+$/gmu)].flatMap(m=>m[1].split(' ')).filter(p=>p.startsWith('infra/product-preview/')&&!p.startsWith('infra/product-preview/runtime-packages'));
 assert.ok(copied.length>=3);
 for(const path of copied)assert.ok(ignore.includes(`!${path}`),`${path} is excluded from the build context`);
});

test('the superseding Temporal grants file pins the live 1.32.1 catalog, including legacy cluster_metadata',()=>{
 // Observed on Aurora after temporal-sql-tool (admin-tools 4fdaf912) on 17 Oct: 40 primary tables.
 const text=readFileSync(new URL('./first-chat-database-temporal.sql',import.meta.url),'utf8');
 const expected=/DECLARE expected text\[\] := ARRAY\[([^\]]+)\]/u.exec(text)[1].match(/'([a-z_0-9]+)'/gu).map(s=>s.slice(1,-1));
 assert.equal(expected.length,40);assert.ok(expected.includes('cluster_metadata')&&expected.includes('cluster_metadata_info'));
 assert.match(text,/public\.cluster_metadata_info, public\.cluster_metadata, public\.cluster_membership/u);
 assert.equal(text.match(/^\\if /gmu).length,1);assert.match(text,/^\\if :\{\?phase_temporal_grants\}$/mu);
 const code=text.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 assert.ok(!/phase_(bootstrap|meri_grants|release)/u.test(code),'only the Temporal grants phase lives here');
});
