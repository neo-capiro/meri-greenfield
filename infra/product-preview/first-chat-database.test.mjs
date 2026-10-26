/** Offline checks for the D2 Stage 1 database script, its grants and the one-shot runner. No database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
 ROOT,DATABASE_SCRIPT,INTEGRATION_SCRIPT,OWNER_READS_SCRIPT,PLAN,PASSWORD_VARIABLES,lex,loadPlan,migrationBody,splitStatements,psqlLiteral,
 runPsqlScript,scramVerifier,passwordVariables,verifyLedger,runStage
} from './first-chat-migrate.mjs';

const read=path=>readFileSync(resolve(ROOT,path),'utf8');
const script=read(DATABASE_SCRIPT);
const SDK_GRANTS='apps/control/conversations/migrations/0022_sdk_run_usage_grants.sql';
const RETENTION_GRANTS='infra/product-preview/first-chat-native-retention-grants.sql';
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
/** The statements phase_owner_conversation_reads executes, through the real interpreter. */
async function ownerReadsStatements(){
 const statements=[];
 await runPsqlScript({text:read(OWNER_READS_SCRIPT),variables:{phase_owner_conversation_reads:'1'},
  connect:async()=>({async query(q){if(typeof q==='string')statements.push(q);return {rows:[]};},async end(){}})});
 return statements;
}
async function integrationStatements(){
 const statements=[];
 await runPsqlScript({text:read(INTEGRATION_SCRIPT),variables:{phase_integration_grants:'1'},
  connect:async()=>({async query(q){if(typeof q==='string')statements.push(q);return {rows:[]};},async end(){}})});
 return statements;
}
const sdkGrantStatements=()=>splitStatements(migrationBody(loadPlan().find(e=>e.path===SDK_GRANTS).text)).map(s=>s.text);

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

test('Meri grants (phase_meri_grants plus the owner reads phase) equal the reviewed proposal blocks plus the issuer grants',async()=>{
 const m=await trace('meri_grants'),actual=grants([...m.statements.map(s=>s.text),...await ownerReadsStatements()]);
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
  if(/^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/u.test(s)&&/\b(FROM|INTO|SET)\b/u.test(s))out.push(s);
 }
 return out;
}
function resolveTemplates(sql,path){
 const variants=[];
 const tables=path.endsWith('native-preparation-journal.mjs')?['meri_conversations.native_allocations','meri_conversations.native_restorations']
  :path.endsWith('prepared-run-issuance-postgres.mjs')?['meri_conversations.run_issuances','meri_conversations.model_run_issuances']:[null];
 for(const table of tables){
  let s=sql.replace(/\$\{tables\.budgets\}/gu,BUDGET('tenant_budgets')).replace(/\$\{tables\.reservations\}/gu,BUDGET('tenant_run_reservations'))
   .replace(/\$\{(?:t|tables|store\.tables|this\.tables)\.([a-z_]+)\}/gu,(_,n)=>BUDGET(n))
   .replace(/\$\{(suffix|locked\?' FOR UPDATE':'')\}/gu,' FOR UPDATE').replace(/\$\{(?:model|omitted)\?[^}]*\}/gu,'')
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
 // Only this simple projection/equality form can prove column SELECT coverage. Any more complex
 // expression/predicate falls back to table SELECT below; never infer access from partial parsing.
 const columns=/^SELECT ([a-z_][a-z0-9_]*(?:,\s*[a-z_][a-z0-9_]*)*) FROM (meri_[a-z_]+\.[a-z_]+) WHERE ([a-z_][a-z0-9_]*)=\$[0-9]+(?: FOR (?:NO KEY UPDATE|UPDATE|KEY SHARE|SHARE))?$/u.exec(sql);
 const insert=/^INSERT INTO ([a-z_.]+)/u.exec(sql);if(insert&&meri(insert[1]))need.push(['INSERT',insert[1]]);
 const remove=/^DELETE FROM ([a-z_.]+)/u.exec(sql);if(remove&&meri(remove[1]))need.push(['DELETE',remove[1]]);
 const upd=/^UPDATE ([a-z_.]+)(?: [a-z])? SET (.+?)(?: WHERE | RETURNING |$)/u.exec(sql);
 const conflict=/ON CONFLICT \([a-z_]+\) DO UPDATE SET (.+?)(?: WHERE |$)/u.exec(sql);
 for(const [table,set] of [[upd?.[1],upd?.[2]],[insert?.[1],conflict?.[1]]])if(table&&set&&meri(table)){
  let depth=0,part='';const parts=[];for(const ch of set){if(ch==='(')depth++;if(ch===')')depth--;if(ch===','&&depth===0){parts.push(part);part='';}else part+=ch;}parts.push(part);
  for(const p of parts){const col=/^\s*([a-z_][a-z0-9_]*)\s*=/u.exec(p);assert.ok(col,`unparsed SET item "${p}" in ${sql}`);need.push([`UPDATE(${col[1]})`,table]);}
  need.push(['SELECT',table]);
 }
 for(const m of sql.matchAll(/\b(?:FROM|JOIN) ([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/gu))if(meri(m[1])){
  if(columns)for(const column of new Set([...columns[1].split(/,\s*/u),columns[3]]))need.push([`SELECT(${column})`,m[1]]);
  else need.push(['SELECT',m[1]]);
  if(/ FOR (?:NO KEY UPDATE|UPDATE|KEY SHARE|SHARE)\b/u.test(sql))need.push(['LOCK',m[1]]);
 }
 if(/RETURNING/u.test(sql)&&insert&&meri(insert[1]))need.push(['SELECT',insert[1]]);
 return need;
}
/** Every privilege the statements need that `role` lacks, as `path: PRIVILEGE table`. */
function uncovered(role,statements,granted){
 const has=(priv,table)=>granted.has(`${role} ${priv} TABLE ${table}`),out=[];
 for(const {sql,path} of statements)for(const [priv,table] of required(sql)){
  const ok=priv==='LOCK'?has('UPDATE',table)||[...granted].some(g=>g.startsWith(`${role} UPDATE(`)&&g.endsWith(` TABLE ${table}`))
   :has(priv,table)||(priv.startsWith('SELECT(')&&has('SELECT',table));
  if(!ok)out.push(`${path}: ${priv} ${table}`);
 }
 return [...new Set(out)];
}
const assertCovered=(role,statements,granted)=>assert.deepEqual(uncovered(role,statements,granted),[]);
const CONTROL_FILES=['apps/control/conversations/postgres-store.mjs','apps/control/conversations/completion-journal.mjs',
 'apps/control/conversations/execution-journal.mjs','apps/control/conversations/initial-input-journal.mjs',
 'apps/control/conversations/initial-run-binding-journal.mjs','apps/control/conversations/lifecycle/journal.mjs',
 'apps/control/conversations/native-preparation-journal.mjs','apps/control/conversations/next-run-journal.mjs',
 'apps/control/conversations/sequence-ranges.mjs','apps/control/conversations/history/store.mjs',
 'apps/control/conversations/skills/retention.mjs','apps/runtime/sdk-session-owner.mjs',
 // Selected publication now uses the canonical skills/retention owner above;
 // the retired selected-read spend ledger has no executable replacement.
 'apps/runtime/prepared-run-issuance-postgres.mjs',
 'apps/gateway/budget/native-allocation-admission.mjs','apps/gateway/budget/admitted-run-current.mjs',
 'apps/gateway/budget/postgres-budget-store.mjs','apps/gateway/budget/tenant/postgres-store.mjs',
 'apps/gateway/budget/tenant/native-admission.mjs','apps/gateway/budget/execution-grant-admission.mjs',
 'apps/gateway/budget/occurrence-cost-scope.mjs','apps/gateway/budget/run-allocation-budgets.mjs'];

test('every table and column the control sources read, lock or write is granted to meri_control_runtime',async()=>{
 const granted=grants([...(await trace('meri_grants')).statements.map(s=>s.text),...await integrationStatements(),...sdkGrantStatements()]);
 const statements=CONTROL_FILES.flatMap(path=>literals(path).flatMap(sql=>resolveTemplates(sql,path).map(s=>({sql:s,path}))));
 assert.ok(statements.length>80,String(statements.length));
 for(const path of CONTROL_FILES)assert.ok(statements.some(s=>s.path===path),`${path} yields no statement`);
 for(const write of ['INSERT INTO meri_conversations.sdk_session_entries','UPDATE meri_conversations.runs SET sequence_end',
  'INSERT INTO meri_conversations.selected_outputs',
  'INSERT INTO meri_product_budget.tenant_run_reservations','UPDATE meri_product_budget.grants SET state=\'ACTIVE\'',
  'UPDATE meri_conversations.model_run_issuances SET facts_sha256'])
  assert.ok(statements.some(s=>s.sql.startsWith(write)),write);
 assertCovered('meri_control_runtime',statements,granted);
 // The 0009 event trigger locks the parent run as the inserting role.
 assert.ok([...granted].some(g=>g.startsWith('meri_control_runtime UPDATE(')&&g.endsWith('TABLE meri_conversations.runs')));
});

test('tenant settings forward correction grants only canonical read/save/audit columns',()=>{
 const entry=loadPlan().find(e=>e.path==='apps/control/settings/migrations/0002_tenant_settings_control_grants.sql');
 assert.equal(entry.ordinal,58);assert.equal(entry.stage,'integration');assert.equal(entry.kind,'migration');
 const statements=splitStatements(migrationBody(entry.text)).map(s=>s.text);
 assert.equal(statements.length,3);assert.ok(statements.every(s=>/^GRANT /u.test(s)));
 const tenant=['tenant_id','revision','document','document_sha256','updated_at','updated_by','monthly_cap_micro_usd','sdk_max_turns','sdk_max_budget_micro_usd'];
 const audit=['sequence','audit_id','tenant_id','target','subject_actor_id','actor_id','from_revision','to_revision','before_sha256','after_sha256','platform_sha256','changed_fields','recorded_at'];
 assert.deepEqual(grants(statements),new Set([
  ...tenant.flatMap(column=>['SELECT','INSERT',...(column==='tenant_id'?[]:['UPDATE'])].map(privilege=>`meri_control_runtime ${privilege}(${column}) TABLE meri_settings.tenant_settings`)),
  ...audit.map(column=>`meri_control_runtime SELECT(${column}) TABLE meri_settings.settings_audit`)
 ]));
});

test('SDK grants are column-only; the source audit refuses missing predicate/read/write grants and policy locks',async()=>{
 const actual=grants(sdkGrantStatements()),role='meri_control_runtime',table='meri_settings.tenant_settings';
 const reads=['tenant_id','monthly_cap_micro_usd','sdk_max_turns','sdk_max_budget_micro_usd'];
 const writes=['sdk_usage','sdk_usage_sha256','sdk_charge_micro_usd','sdk_usage_recorded_at'];
 assert.deepEqual([...actual].sort(),[
  ...reads.map(c=>`${role} SELECT(${c}) TABLE ${table}`),
  ...writes.map(c=>`${role} UPDATE(${c}) TABLE meri_conversations.runs`)
 ].sort());
 const statements=literals('apps/control/conversations/postgres-store.mjs').map(sql=>({sql,path:'store'}));
 const policy=statements.find(s=>s.sql.includes('FROM '+table));assert.ok(policy);
 const usage=statements.find(s=>s.sql.startsWith('UPDATE meri_conversations.runs SET sdk_usage='));assert.ok(usage);
 const granted=grants([...(await trace('meri_grants')).statements.map(s=>s.text),...await integrationStatements(),...sdkGrantStatements()]);
 assert.ok(granted.has(`${role} USAGE SCHEMA meri_settings`));
 assertCovered(role,[policy,usage],granted);
 for(const grant of actual){const missing=new Set(granted);missing.delete(grant);assert.notDeepEqual(uncovered(role,[policy,usage],missing),[],grant);}
 for(const suffix of [' FOR SHARE',' FOR KEY SHARE',' FOR UPDATE',' FOR NO KEY UPDATE'])
  assert.deepEqual(uncovered(role,[{...policy,sql:policy.sql+suffix}],granted),[`store: LOCK ${table}`]);
 for(const sql of [policy.sql.replace('SELECT ','SELECT document,'),policy.sql+' AND revision=$2',policy.sql.replace(/SELECT .* FROM/u,'SELECT * FROM')])
  assert.notDeepEqual(uncovered(role,[{...policy,sql}],granted),[],'additional columns/unknown forms must refuse');
});

/** Applied historical owner-read grants remain immutable after the proxy is retired.
 * Keep checking the real canonical SQL readers and their least-privilege grants; this is
 * historical ACL coverage, not evidence of a current model-proxy process or factory graph. */
const OWNER_BORROWED={
 'apps/control/conversations/initial-run-binding-journal.mjs#readConversation':[['apps/control/conversations/initial-run-binding-journal.mjs',
  'SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY generation DESC LIMIT 1 FOR UPDATE']],
 'apps/control/conversations/postgres-store.mjs#allocations.read':[['apps/control/conversations/native-preparation-journal.mjs',
  'SELECT * FROM meri_conversations.native_allocations WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE']],
 'apps/control/conversations/postgres-store.mjs#nextRuns.current':[
  ['apps/control/conversations/next-run-journal.mjs','SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE'],
  ['apps/control/conversations/next-run-journal.mjs','SELECT * FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3']],
 'apps/control/conversations/postgres-store.mjs#readOptional':[
  ['apps/control/conversations/postgres-store.mjs','SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE'],
  ['apps/control/conversations/postgres-store.mjs','SELECT * FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 AND sequence>$4 ORDER BY sequence LIMIT $5']],
 // Reads through admitted-run-current.mjs and the budget store, which the owner files cover whole.
 'apps/gateway/budget/admitted-run-owner.mjs#currentTaskRun':[],
 'apps/runtime/prepared-run-issuance-postgres.mjs#read':[['apps/runtime/prepared-run-issuance-postgres.mjs',
  'SELECT * FROM meri_conversations.model_run_issuances WHERE issuance_key=$1']]};
test('applied historical model-owner grants cover retained SQL readers and budget writers without granting new privileges',async()=>{
 const meriGrants=(await trace('meri_grants')).statements.map(s=>s.text),granted=grants([...meriGrants,...await ownerReadsStatements()]);
 const files=['apps/gateway/budget/product-model-budget.mjs','apps/gateway/budget/product-model-settlement.mjs',
  'apps/gateway/budget/admitted-run-current.mjs','apps/gateway/budget/postgres-budget-store.mjs','apps/gateway/budget/occurrence-cost-scope.mjs'];
 const statements=files.flatMap(path=>literals(path).flatMap(sql=>resolveTemplates(sql,path).map(s=>({sql:s,path}))));
 // Each retained historical read must still be present in its actual canonical SQL owner.
 for(const [call,borrowed] of Object.entries(OWNER_BORROWED)){
  if(!borrowed.length)assert.deepEqual(literals(call.split('#')[0]),[],`${call} lists no statements, so its module has none`);
  for(const [path,sql] of borrowed){
   assert.ok(literals(path).flatMap(s=>resolveTemplates(s,path)).includes(sql),`${call}: ${path}: ${sql}`);
   statements.push({sql,path});
  }
 }
 assert.ok(statements.some(s=>s.sql.startsWith('INSERT INTO meri_product_budget.requests')));
 assert.ok(statements.some(s=>s.sql.startsWith('UPDATE meri_product_budget.budget SET consumed_micro_usd')));
 assertCovered('meri_model_budget_owner',statements,granted);
 // phase_meri_grants alone leaves exactly the live refusal (20 Oct 12:16:07Z) and the next one; the owner reads phase closes both.
 assert.deepEqual(uncovered('meri_model_budget_owner',statements,grants(meriGrants)),[
  'apps/control/conversations/initial-run-binding-journal.mjs: SELECT meri_conversations.initial_run_bindings',
  'apps/control/conversations/initial-run-binding-journal.mjs: LOCK meri_conversations.initial_run_bindings',
  'apps/control/conversations/next-run-journal.mjs: SELECT meri_conversations.next_runs']);
 // No model write to grants state, issuance or tenant policy.
 for(const g of granted)if(g.startsWith('meri_model_budget_owner '))
  assert.doesNotMatch(g,/(INSERT|UPDATE\(state\)) TABLE meri_product_budget\.grants|TABLE meri_conversations\.(model_run_issuances|run_issuances) .*(INSERT|UPDATE)|tenant_/u);
});

test('historical applied issuer grants remain immutable after runtime retirement',async()=>{
 const granted=grants((await trace('meri_grants')).statements.map(s=>s.text));
 const updates=[...granted].filter(g=>g.startsWith('meri_temporal_issuer_service UPDATE(')).map(g=>/UPDATE\(([a-z0-9_]+)\)/u.exec(g)[1]);
 assert.deepEqual(updates.sort(),['certificate_sha256','expires_at_ms','proof_observed_at_ms','generation','updated_at','revoked_at'].sort());
 assert.deepEqual([...granted].filter(g=>g.startsWith('meri_temporal_issuer_service ')&&!g.includes('UPDATE(')).sort(),
  ['meri_temporal_issuer_service INSERT TABLE meri_service_identity.service_task_registrations',
   'meri_temporal_issuer_service SELECT TABLE meri_service_identity.service_task_registrations',
   'meri_temporal_issuer_service USAGE SCHEMA meri_service_identity']);
 assert.match(script,/CREATE ROLE %I NOLOGIN NOINHERIT/u);
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
  'first-chat-database-owner-reads.sql#owner_conversation_reads',
  '0001_settings.sql','0001_commands.sql','0001_approval_metadata.sql','0001_intent_preparations.sql','0001_schedule_owner.sql','0002_occurrences.sql','0003_run_cancel_proofs.sql','0004_read_consent.sql',
  '0001_task_lookup.sql','0001_objective_custody.sql','0002_objective_run_starts.sql','0003_objective_reader_replays.sql','0001_versions.sql','0002_retention.sql','0003_previews.sql','0001_memory_candidates.sql','0001_read_delegation_facts.sql','0002_prepared_approval_facts.sql','first-chat-database-integration.sql#integration_grants','0020_initial_generations.sql','0021_sdk_run_usage.sql','0022_sdk_run_usage_grants.sql',
  '0018_memory_candidate_targets.sql','0019_memory_proposal_contexts.sql','0002_candidate_retention_delete.sql','first-chat-native-retention-grants.sql',
  '0024_general_initial_binding_scope.sql','0002_memory_preparation_tombstone.sql','0023_expired_conversation_purge.sql','first-chat-expired-conversation-purge-grants.sql','0003_native_routine_facts.sql','0004_objective_run_start_retention.sql','0025_retention_target_lookup.sql','first-chat-schedule-worker-grants.sql#schedule_worker_grants','0026_retention_target_dispatch.sql','0002_tenant_settings_control_grants.sql','0027_retention_target_projection.sql','0028_retention_sdk_identity.sql','0029_native_correction_feedback.sql']);
 assert.ok(!plan.some(e=>/00(12|14)_/u.test(e.name)));
 assert.equal(plan.find(e=>e.name.includes('temporal-issuer')).path,'apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql');
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path.endsWith('0009_next_runs.sql')?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
 const seed=read('infra/product-preview/first-chat-seed-budget.sql');
 assert.match(seed,/INSERT INTO meri_product_budget\.budget \(id, cap_micro_usd, consumed_micro_usd, quarantined\)\nVALUES \(1, 25000000, 0, false\)/u);
 const budget=read('apps/gateway/budget/migrations/0001_product_budget.sql');
 for(const column of ['id integer PRIMARY KEY CHECK (id=1)','cap_micro_usd bigint','consumed_micro_usd bigint','quarantined boolean'])assert.ok(budget.includes(column));
 assert.match(read('apps/runtime/Dockerfile'),/^COPY infra\/product-preview\/first-chat-migrate\.mjs infra\/product-preview\/first-chat-database\.sql infra\/product-preview\/first-chat-database-temporal\.sql infra\/product-preview\/first-chat-database-integration\.sql infra\/product-preview\/first-chat-database-owner-reads\.sql infra\/product-preview\/first-chat-seed-budget\.sql infra\/product-preview\/first-chat-native-retention-grants\.sql infra\/product-preview\/first-chat-expired-conversation-purge-grants\.sql infra\/product-preview\/first-chat-schedule-worker-grants\.sql \.\/infra\/product-preview\/$/mu);
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

test('Core admission snapshot installs as its restricted definer and removes temporary privileges',async()=>{
 const statements=[];
 await runPsqlScript({
  text:read(INTEGRATION_SCRIPT),variables:{phase_integration_grants:'1'},
  connect:async()=>({async query(q){if(typeof q==='string')statements.push(q.replace(/\s+/gu,' ').trim());return {rows:[]};},async end(){}})
 });
 const start=statements.findIndex(s=>s.startsWith('DO $install$'));
 const end=statements.findIndex((s,i)=>i>start&&s==='COMMIT;');
 assert.ok(start>0&&end>start);
 const block=statements.slice(start-1,end+1),at=pattern=>block.findIndex(s=>pattern.test(s));
 const order=[
  /^BEGIN;$/u,/^DO \$install\$.*current_user <> session_user/u,
  /^CREATE ROLE meri_core_admission_reader NOLOGIN NOINHERIT NOSUPERUSER/u,
  /^GRANT meri_core_admission_reader TO SESSION_USER WITH SET TRUE, INHERIT FALSE, ADMIN FALSE;$/u,
  /^SET ROLE meri_product_migrator;$/u,/^GRANT USAGE ON SCHEMA meri_product_budget TO meri_core_admission_reader;$/u,
  /^SET ROLE NONE;$/u,/^CREATE SCHEMA meri_core_authority;$/u,
  /^GRANT USAGE, CREATE ON SCHEMA meri_core_authority TO meri_core_admission_reader;$/u,
  /^GRANT USAGE ON SCHEMA meri_core_authority TO capiro_app;$/u,
  /^SET ROLE meri_core_admission_reader;$/u,/^CREATE FUNCTION meri_core_authority\.current_admission_v1/u,
  /^REVOKE EXECUTE ON FUNCTION meri_core_authority\.current_admission_v1/u,
  /^GRANT EXECUTE ON FUNCTION meri_core_authority\.current_admission_v1/u,
  /^SET ROLE NONE;$/u,/^REVOKE CREATE ON SCHEMA meri_core_authority FROM meri_core_admission_reader;$/u,
  /^REVOKE meri_core_admission_reader FROM SESSION_USER;$/u,/^COMMIT;$/u
 ];
 let cursor=0;
 for(const expected of order){
  const index=block.findIndex((s,i)=>i>=cursor&&expected.test(s));
  assert.ok(index>=cursor,`missing or out of order: ${expected}`);cursor=index+1;
 }
 assert.equal(block[at(/^CREATE FUNCTION/u)].match(/FOR SHARE/gu)?.length,1);
 assert.doesNotMatch(block.join(' '),/CREATE OR REPLACE FUNCTION|ALTER FUNCTION .* OWNER TO/u);
 const sql=read(INTEGRATION_SCRIPT);
 assert.match(sql,/has_schema_privilege\('meri_core_admission_reader', 'meri_core_authority', 'CREATE'\)/u);
 assert.match(sql,/m\.member = session_user::regrole AND m\.set_option/u);
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
function fakeDatabase({failOn,beforeQuery,commitAckOrdinal}={}){
 const state={ledger:[],owner:false,ledgerTable:false,executed:[],phases:[],released:0,locked:false,
  queries:[],temporalLogin:false,disabled:0,memberships:new Set()};
 const connect=async database=>{
  let pending=null,ownsLock=false;
  return {async query(q,params){
   const text=(typeof q==='object'?q.text:q).replace(/\s+/gu,' ').trim();
   state.queries.push(text);beforeQuery?.({text,params,database,state});
   if(typeof q==='object')return {rows:/^SELECT format\('ALTER ROLE meri_temporal_migrator WITH LOGIN/u.test(text)
    ?[['ALTER ROLE meri_temporal_migrator WITH LOGIN NOINHERIT;']]:[]};
   if(/pg_try_advisory_lock/u.test(text)){ownsLock=!state.locked;if(ownsLock)state.locked=true;return {rows:[{locked:ownsLock}]};}
   if(/to_regclass\('meri_migration_ledger\.applied'\) IS NOT NULL AS ledger/u.test(text))return {rows:[{ledger:state.ledgerTable,owner:state.owner}]};
   if(/^SELECT EXISTS \(SELECT 1 FROM pg_roles/u.test(text))return {rows:[{owner:state.owner}]};
   if(/^SELECT ordinal,name,sha256 FROM/u.test(text))return {rows:state.ledger.map(r=>({...r}))};
   if(text==='BEGIN'){pending=[];return {rows:[]};}
   if(text==='COMMIT'){
    const lostAck=pending.some(row=>row.ordinal===commitAckOrdinal);state.ledger.push(...pending);pending=null;
    if(lostAck)throw Object.assign(Error('phase commit acknowledgement lost'),{code:'08006'});return {rows:[]};
   }
   if(text==='ROLLBACK'){pending=null;return {rows:[]};}
   if(/^INSERT INTO meri_migration_ledger/u.test(text)){assert.ok(pending,'ledger write outside a transaction');pending.push({ordinal:params[0],name:params[1],sha256:params[2]});return {rows:[]};}
   if(/^SELECT CASE WHEN \(TRUE\)::int\s*\+/u.test(text)){state.phases.push('bootstrap');}
   if(/^SELECT CASE WHEN \(TRUE\)::int = 1 THEN 'ok'/u.test(text))state.phases.push(/SCHEDULE_GRANTS/u.test(text)?'schedule_worker_grants':/INTEGRATION_GRANTS/u.test(text)?'integration_grants':/OWNER_CONVERSATION_READS/u.test(text)?'owner_conversation_reads':'temporal_grants');
   if(/^SELECT CASE WHEN \(FALSE\)::int \+ \(TRUE\)::int \+ \(FALSE\)::int/u.test(text))state.phases.push('meri_grants');
   if(/^SELECT CASE WHEN \(FALSE\)::int \+ \(FALSE\)::int \+ \(TRUE\)::int/u.test(text))state.phases.push('temporal_grants');
   if(/^SELECT CASE WHEN \(FALSE\)::int \+ \(FALSE\)::int \+ \(FALSE\)::int \+ \(TRUE\)::int/u.test(text))state.phases.push('release');
   if(/CREATE TABLE IF NOT EXISTS meri_migration_ledger\.applied/u.test(text)){state.ledgerTable=true;state.owner=true;}
   if(/^ALTER ROLE meri_temporal_migrator WITH LOGIN\b/u.test(text))state.temporalLogin=true;
   if(/^ALTER ROLE meri_temporal_migrator WITH NOLOGIN\b/u.test(text)){assert.equal(state.locked,true);state.temporalLogin=false;state.disabled++;}
   const membership=/^(GRANT|REVOKE) (meri_product_migrator|meri_temporal_migrator) (?:TO|FROM) CURRENT_USER/u.exec(text);
   if(membership)state.memberships[membership[1]==='GRANT'?'add':'delete'](membership[2]);
   if(/^REVOKE meri_product_migrator FROM CURRENT_USER/u.test(text))state.released++;
   if(pending&&!/^SET LOCAL/u.test(text)){state.executed.push(text);if(failOn&&text.includes(failOn))throw Object.assign(Error('boom'),{code:'XX000'});}
   return {rows:[]};
  },async end(){if(ownsLock)state.locked=false;}};
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
 assert.equal(db.state.temporalLogin,true,'ordinal 20 preserves the official sql-tool login window');
 assert.equal(db.state.disabled,0);assert.equal(db.state.memberships.size,0);
 // Re-run: nothing re-applied, bootstrap and release still run.
 const again=fakeDatabase();again.state.ledger=db.state.ledger;again.state.ledgerTable=again.state.owner=true;
 const log=[];await runStage({stage:'meri',plan,variables,connect:again.connect,log:e=>log.push(e)});
 assert.equal(again.state.executed.length,0);
 assert.equal(log.filter(e=>e.event==='skipped').length,20);
 assert.deepEqual(again.state.phases,['bootstrap','release']);
 assert.equal(again.state.temporalLogin,true);assert.equal(again.state.disabled,0);
 // Temporal stage then applies only its phase and stops at the owner reads (stage meri, ordinal 22).
 await runStage({stage:'temporal',plan,variables,connect:again.connect});
 assert.deepEqual(again.state.ledger.map(r=>r.ordinal),plan.slice(0,21).map(e=>e.ordinal));
 assert.deepEqual(again.state.phases,['bootstrap','release','bootstrap','temporal_grants','release']);
 assert.equal(again.state.temporalLogin,false);assert.equal(again.state.memberships.size,0);
 // A fresh database therefore runs meri, temporal, meri; the last run applies only the owner reads.
 await runStage({stage:'meri',plan,variables,connect:again.connect});
 assert.deepEqual(again.state.ledger.map(r=>r.ordinal),plan.filter(e=>e.stage!=='integration').map(e=>e.ordinal));
 assert.deepEqual(again.state.phases.slice(-3),['bootstrap','owner_conversation_reads','release']);
 assert.equal(again.state.temporalLogin,false);assert.equal(again.state.memberships.size,0);
});

function databaseWithLedger(plan,count,options){
 const db=fakeDatabase(options);
 Object.assign(db.state,{ledger:plan.slice(0,count).map(({ordinal,name,sha256})=>({ordinal,name,sha256})),
  ledgerTable:true,owner:true});
 return db;
}

test('each stage replay closes bootstrap LOGIN from the verified committed Temporal ledger',async()=>{
 const plan=loadPlan();
 for(const stage of ['meri','temporal','integration']){
  const db=databaseWithLedger(plan,plan.length);db.state.temporalLogin=true;
  await runStage({stage,plan,variables,connect:db.connect});
  assert.equal(db.state.temporalLogin,false,stage);assert.equal(db.state.disabled,1,stage);
  assert.equal(db.state.memberships.size,0,stage);assert.equal(db.state.released,1,stage);
  assert.equal(db.state.executed.length,0);assert.equal(db.state.ledger.length,plan.length);
  assert.equal(db.state.queries.filter(sql=>/^SELECT ordinal,name,sha256 FROM/u.test(sql)).length,2);
 }
});

test('a post-Temporal migration failure still closes LOGIN and releases memberships',async()=>{
 const plan=loadPlan(),db=databaseWithLedger(plan,22,{failOn:'CREATE SCHEMA meri_settings'});
 await assert.rejects(runStage({stage:'integration',plan,variables,connect:db.connect}),{code:'XX000'});
 assert.equal(db.state.ledger.length,22);assert.equal(db.state.temporalLogin,false);
 assert.equal(db.state.disabled,1);assert.equal(db.state.released,1);assert.equal(db.state.memberships.size,0);
});

test('an interrupted Temporal phase preserves the uncommitted sql-tool window or its already executed NOLOGIN',async()=>{
 const plan=loadPlan();
 for(const afterDisable of [false,true]){
  const db=databaseWithLedger(plan,20,{beforeQuery({text,params,database}){
   if((!afterDisable&&database==='temporal'&&text.startsWith('DO $$'))
    ||(afterDisable&&text.startsWith('INSERT INTO meri_migration_ledger')&&params[0]===21))
    throw Object.assign(Error('temporal interrupted'),{code:'XX001'});
  }});
  await assert.rejects(runStage({stage:'temporal',plan,variables,connect:db.connect}),{code:'XX001'});
  assert.equal(db.state.ledger.length,20);assert.equal(db.state.temporalLogin,!afterDisable);
  assert.equal(db.state.disabled,afterDisable?1:0,'no cleanup ALTER without a committed ordinal 21');
  assert.equal(db.state.released,1);assert.equal(db.state.memberships.size,0);
 }
});

test('cleanup reads the committed ordinal 21 after a lost phase COMMIT acknowledgement',async()=>{
 const plan=loadPlan(),db=databaseWithLedger(plan,20,{commitAckOrdinal:21});
 await assert.rejects(runStage({stage:'temporal',plan,variables,connect:db.connect}),{code:'08006'});
 assert.equal(db.state.ledger.length,21);assert.equal(db.state.temporalLogin,false);
 assert.equal(db.state.disabled,2,'phase disable plus cleanup based on actual committed ledger');
 assert.equal(db.state.released,1);assert.equal(db.state.memberships.size,0);
});

test('changed, misnamed or gapped Temporal ledger entries never qualify for cleanup ALTER',async()=>{
 const plan=loadPlan();
 for(const corrupt of [rows=>{rows[20].sha256='f'.repeat(64);},rows=>{rows[20].name='wrong';},rows=>{rows.splice(19,1);}]){
  const db=databaseWithLedger(plan,21);corrupt(db.state.ledger);db.state.temporalLogin=true;
  await assert.rejects(runStage({stage:'meri',plan,variables,connect:db.connect}),error=>{
   assert.match(error.code,/MERI_D2_(?:APPLIED_FILE_CHANGED|LEDGER_ORDER|LEDGER_GAP_OR_UNKNOWN)/u);return true;
  });
  assert.deepEqual(db.state.phases,['release']);assert.equal(db.state.disabled,0);
  assert.equal(db.state.temporalLogin,true);assert.equal(db.state.memberships.size,0);
 }
});

test('cleanup validates a fresh ledger read rather than trusting the previously verified prefix',async()=>{
 const plan=loadPlan();let reads=0;
 const db=databaseWithLedger(plan,44,{beforeQuery({text,state}){
  if(text.startsWith('SELECT ordinal,name,sha256 FROM')&&++reads===2)state.ledger[20].sha256='f'.repeat(64);
 }});
 await assert.rejects(runStage({stage:'meri',plan,variables,connect:db.connect}),{code:'MERI_D2_APPLIED_FILE_CHANGED'});
 assert.equal(db.state.disabled,0);assert.equal(db.state.temporalLogin,true);
 assert.equal(db.state.released,1);assert.equal(db.state.memberships.size,0);
});

test('cleanup read or NOLOGIN failure still releases and is reported together with a primary failure',async()=>{
 const plan=loadPlan();
 for(const failRead of [false,true])for(const primary of [false,true]){
  let reads=0;
  const db=databaseWithLedger(plan,22,{failOn:primary?'CREATE SCHEMA meri_settings':undefined,
   beforeQuery({text}){
    if((failRead&&text.startsWith('SELECT ordinal,name,sha256 FROM')&&++reads===2)
     ||(!failRead&&text==='ALTER ROLE meri_temporal_migrator WITH NOLOGIN'))
     throw Object.assign(Error(failRead?'cleanup read failed':'cleanup disable failed'),{code:'XX002'});
   }});
  await assert.rejects(runStage({stage:'integration',plan,variables,connect:db.connect}),error=>{
   if(primary){assert.ok(error instanceof AggregateError);assert.deepEqual(error.errors.map(e=>e.code),['XX000','XX002']);assert.equal(error.code,'XX000');}
   else assert.equal(error.code,'XX002');
   assert.match(error.message,failRead?/cleanup read failed/u:/cleanup disable failed/u);return true;
  });
  assert.equal(db.state.temporalLogin,true);assert.equal(db.state.disabled,0);
  assert.equal(db.state.released,1);assert.equal(db.state.memberships.size,0);
 }
});

test('release failures remain visible alongside primary and NOLOGIN failures',async()=>{
 const plan=loadPlan(),db=databaseWithLedger(plan,22,{failOn:'CREATE SCHEMA meri_settings',
  beforeQuery({text}){
   if(text==='ALTER ROLE meri_temporal_migrator WITH NOLOGIN')throw Object.assign(Error('disable failed'),{code:'XX002'});
   if(text.startsWith('REVOKE meri_product_migrator FROM'))throw Object.assign(Error('release failed'),{code:'XX003'});
  }});
 await assert.rejects(runStage({stage:'integration',plan,variables,connect:db.connect}),error=>{
  assert.ok(error instanceof AggregateError);assert.deepEqual(error.errors.map(e=>e.code),['XX000','XX002','XX003']);
  assert.equal(error.code,'XX000');assert.match(error.message,/boom; disable failed; release failed/u);return true;
 });
 assert.ok(db.state.phases.includes('release'));assert.equal(db.state.locked,false);
 assert.equal(db.state.memberships.size,2,'failed release is reported, never claimed successful');
});

test('a lock contender performs no ledger grant, bootstrap, ALTER or release and leaves winner membership intact',async()=>{
 const plan=loadPlan(),db=databaseWithLedger(plan,44);db.state.locked=true;db.state.temporalLogin=true;
 db.state.memberships=new Set(['meri_product_migrator','meri_temporal_migrator']);
 await assert.rejects(runStage({stage:'meri',plan,variables,connect:db.connect}),{code:'MERI_D2_ANOTHER_RUN_ACTIVE'});
 assert.equal(db.state.queries.length,1);assert.match(db.state.queries[0],/pg_try_advisory_lock/u);
 assert.deepEqual([...db.state.memberships],['meri_product_migrator','meri_temporal_migrator']);
 assert.equal(db.state.locked,true);assert.equal(db.state.temporalLogin,true);assert.equal(db.state.disabled,0);
 assert.deepEqual(db.state.phases,[]);assert.equal(db.state.released,0);
});

test('the live ledger (meri and temporal applied, 21 entries) takes the owner reads in one meri run and stops before integration',async()=>{
 const plan=loadPlan(),live=fakeDatabase();
 live.state.ledger=plan.slice(0,21).map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));live.state.ledgerTable=live.state.owner=true;
 assert.equal(plan[21].kind,'phase:owner_conversation_reads');assert.equal(plan[21].stage,'meri');assert.equal(plan[22].stage,'integration');
 const events=[];await runStage({stage:'meri',plan,variables,connect:live.connect,log:e=>events.push(e)});
 assert.deepEqual(live.state.ledger.map(r=>r.ordinal),plan.slice(0,22).map(e=>e.ordinal));
 assert.deepEqual(events.filter(e=>e.event==='applied').map(e=>e.name),[`${OWNER_READS_SCRIPT}#owner_conversation_reads`]);
 assert.deepEqual(live.state.phases,['bootstrap','owner_conversation_reads','release']);
 assert.equal(live.state.executed.length,0,'a phase runs no migration body');
});

test('owner reads grant the model owner only SELECT on the two tables and the lock-only binding column',async()=>{
 assert.deepEqual([...grants(await ownerReadsStatements())].sort(),[
  'meri_model_budget_owner SELECT TABLE meri_conversations.initial_run_bindings',
  'meri_model_budget_owner SELECT TABLE meri_conversations.next_runs',
  'meri_model_budget_owner UPDATE(record_sha256) TABLE meri_conversations.initial_run_bindings'
 ]);
 const text=read(OWNER_READS_SCRIPT),code=text.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
 assert.equal(text.match(/^\\if /gmu).length,1);assert.match(text,/^\\if :\{\?phase_owner_conversation_reads\}$/mu);
 assert.ok(!/phase_(bootstrap|meri_grants|temporal_grants|integration_grants|release)/u.test(code),'only the owner reads phase lives here');
 assert.ok(!/\b(INSERT|DELETE|TRUNCATE)\b[^;]*\bTO meri_model_budget_owner/u.test(code));
 // The binding column is lock-only: 0017 rejects every UPDATE. The statements that need these privileges are derived from the
 // owner's call sites in the source coverage test.
 assert.match(read('apps/control/conversations/migrations/0017_initial_run_bindings.sql'),
  /CREATE TRIGGER immutable_initial_run_binding BEFORE UPDATE OR DELETE ON meri_conversations\.initial_run_bindings/u);
});

test('integration stage runs only after meri and temporal are ledgered; earlier stages never reach its entries',async()=>{
 const plan=loadPlan().slice(0,55),integration=plan.filter(e=>e.stage==='integration');
 assert.equal(plan.length,55);assert.equal(integration.length,33);assert.equal(plan[40].kind,'phase:integration_grants');
 assert.equal(integration.at(-1).path,'apps/control/conversations/migrations/0025_retention_target_lookup.sql');
 const early=fakeDatabase();
 await assert.rejects(runStage({stage:'integration',plan,variables,connect:early.connect}),/MERI_D2_PRIOR_STAGE_INCOMPLETE/u);
 assert.equal(early.state.executed.length,0);
 const ready=fakeDatabase();ready.state.ledger=plan.filter(e=>e.stage!=='integration').map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));ready.state.ledgerTable=ready.state.owner=true;
 await runStage({stage:'meri',plan,variables,connect:ready.connect});await runStage({stage:'temporal',plan,variables,connect:ready.connect});
 assert.equal(ready.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:ready.connect});
 assert.deepEqual(ready.state.ledger.map(r=>r.ordinal),plan.map(e=>e.ordinal));
 assert.equal(ready.state.executed.length,32);assert.ok(ready.state.phases.includes('integration_grants'));
 // An exact 54-entry ledger applies only the target lookup index.
 const live=fakeDatabase();live.state.ledger=plan.slice(0,-1).map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));live.state.ledgerTable=live.state.owner=true;
 await runStage({stage:'integration',plan,variables,connect:live.connect});
 assert.equal(live.state.executed.length,1);assert.deepEqual(live.state.ledger.map(r=>r.ordinal),plan.map(e=>e.ordinal));
 assert.deepEqual(live.state.executed,[migrationBody(plan.at(-1).text).replace(/\s+/gu,' ').trim()]);
 const beforeSdk=fakeDatabase();beforeSdk.state.ledger=plan.slice(0,42).map(e=>({ordinal:e.ordinal,name:e.name,sha256:e.sha256}));beforeSdk.state.ledgerTable=beforeSdk.state.owner=true;
 await runStage({stage:'integration',plan,variables,connect:beforeSdk.connect});
 assert.equal(beforeSdk.state.executed.length,13);assert.deepEqual(beforeSdk.state.ledger.map(r=>r.ordinal),plan.map(e=>e.ordinal));
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

test('native retention appends exactly four integration entries to the unchanged 44-entry prefix',async()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,44))).digest('hex'),
  '0161989b7e2acb72729982fae3d24b2c58c203c60aa2a0502cce0a2dbab51011');
 const plan=loadPlan().slice(0,48),added=plan.slice(44);
 assert.deepEqual(added.map(e=>[e.ordinal,e.kind,e.stage]),[45,46,47,48].map(n=>[n,'migration','integration']));
 const db=databaseWithLedger(plan,44),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,44),prefix);
 assert.deepEqual(db.state.executed,added.map(e=>migrationBody(e.text).replace(/\s+/gu,' ').trim()));
 assert.equal(db.state.ledger.length,48);assert.equal(db.state.temporalLogin,false);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.equal(db.state.executed.length,4,'replay executes no migration twice');
 for(const entry of added)assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
 const failed=databaseWithLedger(plan,47,{failOn:'GRANT SELECT, INSERT ON meri_conversations.memory_proposal_contexts'});
 await assert.rejects(runStage({stage:'integration',plan,variables,connect:failed.connect}),/boom/u);
 assert.equal(failed.state.ledger.length,47);assert.equal(failed.state.temporalLogin,false);
 assert.equal(failed.state.memberships.size,0,'failed forward grant still releases temporary ownership');
});

test('General binding repair appends only ordinal 49 and preserves every applied migration pin',async()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,48))).digest('hex'),
  'eb0e42eb0cdc61d0c747698b464e85f439813fc39116da0e472bae8b5fc621f9');
 const plan=loadPlan().slice(0,49),entry=plan[48];
 assert.deepEqual([plan.length,entry.ordinal,entry.stage,entry.path],[49,49,'integration','apps/control/conversations/migrations/0024_general_initial_binding_scope.sql']);
 const db=databaseWithLedger(plan,48),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,48),prefix);assert.equal(db.state.ledger.length,49);
 assert.deepEqual(db.state.executed,[migrationBody(entry.text).replace(/\s+/gu,' ').trim()]);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.equal(db.state.executed.length,1,'ledgered forward repair is not reapplied');
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('native retention grants only context locks and serving/recovery projection rights',()=>{
 const body=migrationBody(loadPlan().find(e=>e.path===RETENTION_GRANTS).text),statements=splitStatements(body).map(s=>s.text);
 const actual=grants(statements),expected=new Set();
 const add=(table,privileges)=>{for(const privilege of privileges)expected.add(`meri_control_runtime ${privilege} TABLE ${table}`);};
 add('meri_conversations.memory_proposal_contexts',['SELECT','INSERT','UPDATE(record_sha256)']);
 for(const schema of ['meri_conversations','meri_artifacts']){
  add(`${schema}.retention_subjects`,['SELECT','INSERT',...['owner_actor_id','state','suppressed_at','released_at','ledger_sequence','entry_sha256','projection','projection_sha256'].map(c=>`UPDATE(${c})`)]);
  add(`${schema}.retention_purges`,['INSERT','DELETE','SELECT(tenant_id)',`SELECT(${schema==='meri_conversations'?'conversation_id':'artifact_id'})`]);
 }
 add('meri_conversations.retention_purge_targets',['INSERT','DELETE','SELECT(tenant_id)','SELECT(conversation_id)']);
 add('meri_conversations.retention_recovery_watermark',['SELECT(singleton)','SELECT(sequence)','SELECT(entry_sha256)','INSERT(singleton)','INSERT(sequence)','INSERT(entry_sha256)','UPDATE(sequence)','UPDATE(entry_sha256)']);
 assert.deepEqual(actual,expected);
 assert.ok(statements.every(s=>/^GRANT /u.test(s)), 'no schema, content mutation, ownership, role or execution statements');
 assert.doesNotMatch(code(body),/\b(?:PUBLIC|TRUNCATE|REFERENCES|TRIGGER|EXECUTE|ALL|WITH GRANT OPTION)\b/u);
 assert.match(read('apps/control/conversations/migrations/0019_memory_proposal_contexts.sql'),/BEFORE UPDATE OR DELETE ON meri_conversations\.memory_proposal_contexts/u);
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


test('schedule grants append ordinal 56 through the existing installer phase and preserve all 55 entries',async()=>{
 const plan=loadPlan().slice(0,56),entry=plan.at(-1);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,55))).digest('hex'),'27299fdc73619f4a925995f2b864f67ea1b1a260fb12f5a5de8b209aae03e72f');
 assert.deepEqual([plan.length,entry.ordinal,entry.kind,entry.stage],[56,56,'phase:schedule_worker_grants','integration']);
 assert.equal(entry.path,'infra/product-preview/first-chat-schedule-worker-grants.sql');
 const db=databaseWithLedger(plan,55),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,55),prefix);assert.equal(db.state.ledger.length,56);
 assert.equal(db.state.phases.filter(p=>p==='schedule_worker_grants').length,1);
 assert.ok(db.state.queries.some(q=>q.includes('CREATE ROLE meri_schedule_runtime NOLOGIN')));
 assert.ok(db.state.queries.includes('SET LOCAL ROLE meri_product_migrator;'));
 const executed=structuredClone(db.state.executed);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.executed,executed);assert.equal(db.state.phases.filter(p=>p==='schedule_worker_grants').length,1);
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('exact target dispatch appends only ordinal 57 and preserves the first 56 entries',async()=>{
 const plan=loadPlan().slice(0,57),entry=plan.at(-1);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,56))).digest('hex'),'c501cbf269fc1de1d03daa38f8a960ad0744ec03edf81f7600501e307a90a91c');
 assert.deepEqual([plan.length,entry.ordinal,entry.kind,entry.stage],[57,57,'migration','integration']);
 assert.equal(entry.path,'apps/control/conversations/migrations/0026_retention_target_dispatch.sql');
 const db=databaseWithLedger(plan,56),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,56),prefix);assert.equal(db.state.ledger.length,57);
 assert.deepEqual(db.state.executed,[migrationBody(entry.text).replace(/\s+/gu,' ').trim()]);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.equal(db.state.executed.length,1,'the forward guard is not reapplied');
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('tenant settings grants append ordinal 58 once without changing the applied 57-entry prefix',async()=>{
 const plan=loadPlan().slice(0,58),entry=plan.at(-1);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,57))).digest('hex'),'ce29398a63daba230fcc7aea4a799bd72460dd9dbfb470369dcdce4e7b0bcda8');
 assert.deepEqual([plan.length,entry.ordinal,entry.kind,entry.stage],[58,58,'migration','integration']);
 assert.equal(entry.path,'apps/control/settings/migrations/0002_tenant_settings_control_grants.sql');
 const db=databaseWithLedger(plan,57),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,57),prefix);assert.equal(db.state.ledger.length,58);
 assert.deepEqual(db.state.executed,[migrationBody(entry.text).replace(/\s+/gu,' ').trim()]);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.equal(db.state.executed.length,1,'the grants are ledger-skipped on replay');
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('projection expansion appends only ordinal 59 and preserves the applied 58-entry prefix',async()=>{
 const plan=loadPlan().slice(0,59),entry=plan.at(-1);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,58))).digest('hex'),'d37683ea46f64006c1b8deb510f5c206192e2b1f480bff9326f47aba62881b7f');
 assert.deepEqual([plan.length,entry.ordinal,entry.kind,entry.stage],[59,59,'migration','integration']);
 assert.equal(entry.path,'apps/control/conversations/migrations/0027_retention_target_projection.sql');
 const db=databaseWithLedger(plan,58),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,58),prefix);assert.equal(db.state.ledger.length,59);
 assert.deepEqual(db.state.executed,[migrationBody(entry.text).replace(/\s+/gu,' ').trim()]);
 await runStage({stage:'integration',plan,variables,connect:db.connect});assert.equal(db.state.executed.length,1);
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('projection expansion preserves the complete canonical guard and byte-identical legacy branch',()=>{
 const plan=loadPlan(),before=plan.find(e=>e.ordinal===57).text,after=plan.find(e=>e.ordinal===59).text;
 const legacy=" IF p_table='meri_memory.candidates' AND p_mode='candidate' THEN";
 assert.equal(after.slice(after.indexOf(legacy)),before.slice(before.indexOf(legacy)));
 let canonical=after.slice(after.indexOf('CREATE OR REPLACE FUNCTION'),after.indexOf(legacy));
 assert.equal((canonical.match(/CROSS JOIN LATERAL jsonb_to_record\(/gu)??[]).length,3);
 canonical=canonical.replace(/  CROSS JOIN LATERAL jsonb_to_record\(s\.projection\)[\s\S]*?(?=  WHERE t\.tenant_id)/u,'');
 const fields=[['doc.state',"s.projection->>'state'"],['doc."ownerActorId"',"s.projection->>'ownerActorId'"],
  ['doc."ledgerSequence"',"s.projection->>'ledgerSequence'"],['doc."entrySha256"',"s.projection->>'entrySha256'"],['doc.reason',"s.projection->>'reason'"],
  ['purge_doc.state',"s.projection#>>'{purge,state}'"],['purge_doc."planSha256"',"s.projection#>>'{purge,planSha256}'"],['purge_doc."ledgerSequence"',"s.projection#>>'{purge,ledgerSequence}'"],
  ['trash_doc.revision',"s.projection#>>'{purge,trash,revision}'"],['trash_doc."requestId"',"s.projection#>>'{purge,trash,requestId}'"],
  ['trash_doc."restoreUntilMs"',"s.projection#>>'{purge,trash,restoreUntilMs}'"],['trash_doc."trashedAtMs"',"s.projection#>>'{purge,trash,trashedAtMs}'"]];
 for(const [from,to] of fields.sort((a,b)=>b[0].length-a[0].length))canonical=canonical.replaceAll(from,to);
 assert.equal(canonical,before.slice(before.indexOf('CREATE OR REPLACE FUNCTION'),before.indexOf(legacy)));
});

test('SDK identity construction appends only ordinal 60 and preserves the applied 59-entry prefix',async()=>{
 const plan=loadPlan().slice(0,60),entry=plan.at(-1);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,59))).digest('hex'),'2268948fce1943a29078bc2a2be23922c7c049b6fcdeb7d9af25b6053d80d7bf');
 assert.deepEqual([plan.length,entry.ordinal,entry.kind,entry.stage],[60,60,'migration','integration']);
 assert.equal(entry.path,'apps/control/conversations/migrations/0028_retention_sdk_identity.sql');
 const db=databaseWithLedger(plan,59),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,59),prefix);assert.equal(db.state.ledger.length,60);
 assert.deepEqual(db.state.executed,[migrationBody(entry.text).replace(/\s+/gu,' ').trim()]);
 await runStage({stage:'integration',plan,variables,connect:db.connect});assert.equal(db.state.executed.length,1);
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('native feedback appends only ordinal 61 and preserves the applied 60-entry prefix',async()=>{
 const plan=loadPlan(),entry=plan.at(-1);
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,60))).digest('hex'),'a20d32aeee1b231456510249ec431e7d1e6494bff50c684212b8e04a916f1a95');
 assert.deepEqual([plan.length,entry.ordinal,entry.kind,entry.stage],[61,61,'migration','integration']);
 assert.equal(entry.path,'apps/control/conversations/migrations/0029_native_correction_feedback.sql');
 assert.equal(entry.sha256,'06116bdca41aab13d2adca2263b25f23f29c61255f95e2e87f997dffd88d3ec6');
 const db=databaseWithLedger(plan,60),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,60),prefix);assert.equal(db.state.ledger.length,61);
 assert.deepEqual(db.state.executed,[migrationBody(entry.text).replace(/\s+/gu,' ').trim()]);
 assert.equal(db.state.temporalLogin,false);assert.equal(db.state.memberships.size,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});assert.equal(db.state.executed.length,1);
 assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});

test('SDK identity construction preserves every guard predicate, lock and legacy mutation rule',()=>{
 const plan=loadPlan(),before=plan.find(e=>e.ordinal===59).text,after=plan.find(e=>e.ordinal===60).text;
 const functionBody=(text,name)=>{const start=text.indexOf(`CREATE OR REPLACE FUNCTION meri_conversations.${name}(`);
  assert.ok(start>=0);return text.slice(start,text.indexOf('END $$;',start)+7);};
 const guard='expired_conversation_purge_target',trigger='reject_sdk_mirror_mutation';
 const aggregate=' SELECT jsonb_object_agg(k,p_row->k) INTO actual_key FROM unnest(columns) AS k;';
 const direct=` IF p_table='meri_conversations.sdk_session_entries' THEN
  actual_key:=jsonb_build_object('run_id',p_row->'run_id','session_id',p_row->'session_id',
   'subpath',p_row->'subpath','sequence',p_row->'sequence');
 ELSE
${aggregate}
 END IF;`;
 const canonical=functionBody(after,guard);assert.ok(canonical.includes(direct));
 assert.equal(canonical.replace(direct,aggregate),functionBody(before,guard),
  'only exact JSONB key construction changes; all canonical/legacy predicates and FOR UPDATE locks remain');
 const identity=` IF TG_OP='DELETE' AND TG_TABLE_SCHEMA='meri_conversations' AND TG_TABLE_NAME='sdk_session_entries' THEN
  IF meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,
   jsonb_build_object('tenant_id',OLD.tenant_id,'conversation_id',OLD.conversation_id,
    'run_id',OLD.run_id,'session_id',OLD.session_id,'subpath',OLD.subpath,'sequence',OLD.sequence),
   'delete') THEN RETURN OLD; END IF;
 ELSIF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;`;
 const mutation=functionBody(after,trigger);assert.ok(mutation.includes(identity));
 const oldCall=" IF TG_OP='DELETE' AND meri_conversations.expired_conversation_purge_target(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,to_jsonb(OLD),'delete') THEN RETURN OLD; END IF;";
 assert.equal(mutation.replace(identity,oldCall),functionBody(read('apps/control/conversations/migrations/0023_expired_conversation_purge.sql'),trigger),
  'all six fields are built only inside the entry branch; other tables, the exact legacy fallback and UPDATE refusal remain');
 assert.deepEqual(splitStatements(migrationBody(after)).map(s=>s.text.match(/^CREATE OR REPLACE FUNCTION ([^(]+)/u)?.[1]),
  [`meri_conversations.${guard}`,`meri_conversations.${trigger}`],
  'no trigger timing, grants, storage or other schema changes');
});

test('retention and routine additions append entries 50 through 55 and preserve the applied ledger',async()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,48))).digest('hex'),
  'eb0e42eb0cdc61d0c747698b464e85f439813fc39116da0e472bae8b5fc621f9');
 const plan=loadPlan().slice(0,55),added=plan.slice(49);
 assert.equal(plan[48].path,'apps/control/conversations/migrations/0024_general_initial_binding_scope.sql');
 assert.equal(plan[48].sha256,'0e5c5449a0cf78ead63c8d4f90a76c0ef789e6a6b86ab128f57d45e9fa3938d3');
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,53))).digest('hex'),'252870c1f2fe3f07b431423254365b0ffc84c479eba98b876a5ac20ada622fda');
 assert.equal(createHash('sha256').update(JSON.stringify(PLAN.slice(0,54))).digest('hex'),'1aacee71c8d2ea2b3c87d72ef3ca626e5079aba1f14ed4ee076ff04e9575a3f5');
 assert.deepEqual(added.map(e=>[e.ordinal,e.kind,e.stage]),[50,51,52,53,54,55].map(n=>[n,'migration','integration']));
 const db=databaseWithLedger(plan,49),prefix=structuredClone(db.state.ledger);
 for(const stage of ['meri','temporal'])await runStage({stage,plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger,prefix);assert.equal(db.state.executed.length,0);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.deepEqual(db.state.ledger.slice(0,49),prefix);
 assert.deepEqual(db.state.executed,added.map(e=>migrationBody(e.text).replace(/\s+/gu,' ').trim()));
 assert.equal(db.state.ledger.length,55);
 await runStage({stage:'integration',plan,variables,connect:db.connect});
 assert.equal(db.state.executed.length,6,'the reserved append replays without reapplying SQL');
 for(const entry of added)assert.throws(()=>loadPlan({read:path=>Buffer.from(read(path)+(path===entry.path?'\n':''))}),/MERI_D2_SOURCE_CHANGED/u);
});
