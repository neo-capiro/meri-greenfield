/** STATIC + SYNTHETIC witness: the candidate memory migration against the journal's actual statements, captured from the real
 * `createPostgresMemoryJournal` over a recording pool, and against the Stage 1 runner's statement splitter. No database executes it. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrationBody,splitStatements} from '../../../../infra/product-preview/first-chat-migrate.mjs';
import {createPostgresMemoryJournal,SUBMISSION_STATES} from '../postgres-journal.mjs';
import {buildCandidate} from '../candidate.mjs';
import {MEMORY_SCOPES} from '../wire.mjs';
import {principal,id,CLIENT_A,NOW} from './fixtures.mjs';
const sql=readFileSync(new URL('../migrations/0001_memory_candidates.sql',import.meta.url),'utf8');
const tombstoneSql=readFileSync(new URL('../migrations/0002_candidate_retention_delete.sql',import.meta.url),'utf8');
const TABLE='meri_memory.candidates';
const list=text=>text.split(',').map(s=>s.trim()).filter(Boolean);

/** Columns of the CREATE TABLE: name -> {type, notNull}. */
function columns(){
 const body=/CREATE TABLE meri_memory\.candidates \(\n([\s\S]*?)\n\);/u.exec(sql)[1],out=new Map();
 for(const m of body.matchAll(/^ {2}([a-z][a-z0-9_]*)\s+(text|uuid|char\(64\)|jsonb|timestamptz)\s+(NOT NULL|NULL)\b/gmu))out.set(m[1],{type:m[2],notNull:m[3]==='NOT NULL'});
 out.set('origin_kind',{type:'text',notNull:true});out.set('origin_conversation_id',{type:'uuid',notNull:false});
 out.set('candidate_purged_at',{type:'timestamptz',notNull:false});out.get('candidate').notNull=false;
 return out;
}
/** Every statement the journal issues against its table, captured from the real owner. */
async function statements(){
 const issued=[],{candidate,candidateSha256}=buildCandidate({candidateId:id(1),principal:principal(),scope:'client',clientId:CLIENT_A,content:'Prefers morning briefings.',key:null,ttlDays:null,
  sources:[],origin:{kind:'surface'},idempotencyKey:id(2),createdAt:new Date(NOW).toISOString()});
 const row={candidate,candidate_sha256:candidateSha256,request_sha256:'a'.repeat(64),submission_state:'PREPARED',review_id:null,
  origin_kind:'surface',origin_conversation_id:null,candidate_purged_at:null};
 const pool={async connect(){return {async query(text,params=[]){
  if(!text.includes(TABLE))return {rows:[],rowCount:0};
  issued.push({text:text.replace(/\s+/gu,' ').trim(),params});
  return text.startsWith('UPDATE')?{rows:[],rowCount:1}:{rows:[row],rowCount:1};
 },release(){}};}};
 const j=createPostgresMemoryJournal({pool}),k={tenantId:candidate.tenantId,proposerActorId:candidate.proposerActorId};
 await j.insert({candidate,candidateSha256,requestSha256:row.request_sha256});
 await j.recordSubmission({tenantId:k.tenantId,candidateId:candidate.candidateId,candidateSha256,reviewId:id(3)});
 await j.recordUnknown({tenantId:k.tenantId,candidateId:candidate.candidateId});
 await j.get({...k,candidateId:candidate.candidateId});await j.findOwnByKey({...k,idempotencyKey:candidate.idempotencyKey});
 await j.listOwn({...k,clientIds:[CLIENT_A],clientId:null,cursor:{createdAt:candidate.createdAt,candidateId:candidate.candidateId},limit:10});
 return issued;
}

test('the candidate migration is CREATE-only in its own schema and accepted unchanged by the Stage 1 runner',()=>{
 assert.equal(migrationBody(sql),sql,'no transaction control: the runner wraps the file in its own transaction');
 const kinds=splitStatements(sql).map(s=>/^CREATE (SCHEMA|TABLE|INDEX|FUNCTION|TRIGGER)\b/u.exec(s.text)?.[1]);
 assert.deepEqual(kinds,['SCHEMA','TABLE','INDEX','FUNCTION','TRIGGER']);
 const code=sql.replace(/--[^\n]*/gu,'');
 assert.doesNotMatch(code,/\b(?:ALTER|DROP|TRUNCATE|GRANT|REVOKE|INSERT|DELETE|COPY|CREATE ROLE|CREATE OR REPLACE)\b/u);
 for(const m of code.matchAll(/\bCREATE (?:SCHEMA|TABLE|INDEX \S+ ON|FUNCTION|TRIGGER \S+ BEFORE UPDATE ON) ([a-z_.]+)/gu))assert.match(m[1],/^meri_memory(?:\.|$)/u,m[0]);
 assert.match(code,/EXECUTE FUNCTION meri_memory\.candidates_immutable\(\)/u);
});

test('the migration body is the reviewed meri_memory proposal section, unchanged',()=>{
 const proposal=readFileSync(new URL('../../../../docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql',import.meta.url),'utf8').replace(/\r\n/gu,'\n');
 const section=proposal.slice(proposal.indexOf('CREATE SCHEMA meri_memory;'),proposal.indexOf('CREATE SCHEMA meri_settings;')).trimEnd();
 const body=sql.replace(/\r\n/gu,'\n');assert.equal(body.slice(body.indexOf('CREATE SCHEMA meri_memory;')).trimEnd(),section);
});

test('assigned 0002 is a forward content tombstone amendment and never releases candidate replay fences',()=>{
 assert.equal(migrationBody(tombstoneSql),tombstoneSql);
 assert.ok(splitStatements(tombstoneSql).length>=6,'the runner must parse the guarded trigger body as one statement');
 const code=tombstoneSql.replace(/--[^\n]*/gu,'');
 assert.doesNotMatch(code,/\b(?:DELETE FROM|DROP TABLE|TRUNCATE|CREATE ROLE)\b/u);
 assert.match(code,/ALTER COLUMN candidate DROP NOT NULL/u);
 assert.match(code,/SET\s+origin_kind = candidate->'origin'/u);
 assert.match(code,/IF OLD\.candidate IS NULL OR OLD\.candidate_purged_at IS NOT NULL/u);
 assert.match(code,/t\.actor_id=OLD\.proposer_actor_id/u);
 assert.match(code,/t\.candidate_id=OLD\.candidate_id/u);
 assert.match(code,/t\.xmin=pg_current_xact_id\(\)::xid/u);
 assert.match(code,/s\.projection->>'entrySha256'=s\.entry_sha256/u);
 assert.ok(code.includes("s.projection->'purge'->>'state' IN ('PLANNED','UNKNOWN')"));
 assert.match(code,/FOR UPDATE OF t,s/u);
 assert.match(code,/CREATE TRIGGER candidates_no_delete BEFORE DELETE/u);
});

test('every column, cast, conflict target, mutable column and ordering the journal uses exists in the schema',async()=>{
 const cols=columns(),issued=await statements();
 assert.deepEqual([...cols.keys()],['tenant_id','candidate_id','proposer_actor_id','idempotency_key','request_sha256','candidate','candidate_sha256','scope','client_id','created_at','submission_state','review_id','submitted_at','origin_kind','origin_conversation_id','candidate_purged_at']);
 assert.equal(issued.length,6);
 for(const {text} of issued){
  const identifiers=text.replaceAll(TABLE,' ').replace(/'[^']*'/gu,' ').replace(/::[a-z[\]]+/gu,' ').replace(/\b[a-z_]+\(\)/gu,' ').match(/\b[a-z][a-z0-9_]*\b/gu)??[];
  for(const name of identifiers)assert.ok(cols.has(name),`${name} in: ${text}`);
 }
 // Insert covers every NOT NULL column (no defaults exist), casts agree with column types, and the literal state is a checked state.
 const insert=issued.find(s=>s.text.startsWith('INSERT')).text,target=list(/INSERT INTO meri_memory\.candidates\(([^)]+)\)/u.exec(insert)[1]),values=list(/VALUES\(([^)]+)\)/u.exec(insert)[1]);
 assert.equal(target.length,values.length);
 for(const [name,column] of cols)if(column.notNull)assert.ok(target.includes(name),`NOT NULL ${name} is inserted`);
 target.forEach((name,i)=>{const cast=/::([a-z]+)$/u.exec(values[i])?.[1];if(cast)assert.equal(cols.get(name).type,cast,name);const literal=/^'([A-Z_]+)'$/u.exec(values[i])?.[1];if(literal)assert.ok(SUBMISSION_STATES.includes(literal));});
 assert.deepEqual(list(/ON CONFLICT \(([^)]+)\)/u.exec(insert)[1]),list(/UNIQUE \(([^)]+)\)/u.exec(sql)[1]));
 // uuid parameters match uuid columns; the cursor's timestamptz cast matches created_at.
 const listing=issued.at(-1).text;
 assert.match(listing,/client_id = ANY\(\$3::uuid\[\]\)/u);assert.equal(cols.get('client_id').type,'uuid');
 assert.match(listing,/\(created_at,candidate_id\) < \(\$5::timestamptz,\$6::uuid\)/u);assert.equal(cols.get('created_at').type,'timestamptz');assert.equal(cols.get('candidate_id').type,'uuid');
 assert.equal(cols.get('review_id').type,'uuid','Core review ids are UUIDs (core-review.mjs)');
 // The listing order is served by the proposer index.
 assert.match(listing,/WHERE tenant_id=\$1 AND proposer_actor_id=\$2 .* ORDER BY created_at DESC, candidate_id DESC LIMIT \$7$/u);
 assert.match(sql,/CREATE INDEX candidates_proposer_recent ON meri_memory\.candidates \(tenant_id, proposer_actor_id, created_at DESC, candidate_id DESC\);/u);
 // Only the submission columns move; the trigger guards exactly every other column.
 const moved=new Set(issued.filter(s=>s.text.startsWith('UPDATE')).flatMap(s=>list(/ SET (.+?) WHERE /u.exec(s.text)[1]).map(a=>a.split('=')[0].trim())));
 assert.deepEqual([...moved].sort(),['review_id','submission_state','submitted_at']);
 const guarded=list(/IF \(([^)]+)\)\s+IS DISTINCT FROM/u.exec(sql)[1].replace(/\s+/gu,' ')).map(c=>c.replace(/^NEW\./u,''));
 assert.deepEqual([...guarded,...moved].sort(),[...cols.keys()].filter(k=>!['origin_kind','origin_conversation_id','candidate_purged_at'].includes(k)).sort());
 assert.match(tombstoneSql,/ADD COLUMN origin_kind text/u);assert.match(tombstoneSql,/ADD COLUMN origin_conversation_id uuid/u);
 assert.match(tombstoneSql,/ADD COLUMN candidate_purged_at timestamptz/u);
 assert.match(tombstoneSql,/ALTER COLUMN candidate DROP NOT NULL/u);
 assert.match(tombstoneSql,/NEW\.candidate IS DISTINCT FROM OLD\.candidate/u);
 assert.match(tombstoneSql,/t\.xmin=pg_current_xact_id\(\)::xid/u);
 assert.match(tombstoneSql,/CREATE TRIGGER candidates_no_delete BEFORE DELETE/u);
 // Checked vocabularies equal the owners' own constants.
 assert.deepEqual(list(/submission_state\s+text\s+NOT NULL CHECK \(submission_state IN \(([^)]+)\)\)/u.exec(sql)[1]).map(s=>s.slice(1,-1)),[...SUBMISSION_STATES]);
 assert.deepEqual(list(/scope\s+text\s+NOT NULL CHECK \(scope IN \(([^)]+)\)\)/u.exec(sql)[1]).map(s=>s.slice(1,-1)),[...MEMORY_SCOPES]);
 assert.match(sql,/CHECK \(\(scope = 'client'\) = \(client_id IS NOT NULL\)\)/u);
 assert.match(sql,/CHECK \(\(submission_state = 'SUBMITTED'\) = \(review_id IS NOT NULL\)\)/u);
});
