/** Twelve analyst questions against the published surface Core 362 describes (`capiro-published-surface.fixture.json`,
 * captured from the Core migration's view and column comments). For each answerable question the test checks that
 * the statement the tool descriptions lead to is one the gate admits (one SELECT/WITH, contiguous $n, no blocked
 * keyword, one source) and that every relation and column it names is published; for the refusal paths it checks
 * that the notice the model receives names the correction. The gate rules are mirrored here as a test oracle only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNotices} from '../results.mjs';
import {SQL_REFUSAL_GUIDANCE} from '../guidance.mjs';
import {READ_FAMILY_GUIDANCE,SQL_FIRST_GUIDANCE} from '../family-guidance.mjs';
import {familyReads} from '../availability.mjs';
import {describeRead} from '../tools.mjs';
import {sqlRefusal} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';

const surface=JSON.parse(readFileSync(new URL('./capiro-published-surface.fixture.json',import.meta.url),'utf8')).relations;
const published=source=>Object.entries(surface).filter(([,r])=>r.source===source).map(([name])=>name);
const BLOCKED=new Set(['insert','update','delete','merge','into']);
const words=sql=>[...sql.replace(/'(?:[^']|'')*'/g,"''").toLowerCase().matchAll(/[a-z_][a-z0-9_]*/g)].map(m=>m[0]);
/** A test oracle mirroring sql-statement-gate.ts: statement shape, parameters, blocked keywords and source mixing. */
function admitted(sql,parameters,source='public'){
 const body=sql.trim().replace(/;\s*$/,'');assert.ok(!body.includes(';'),'one statement');
 assert.match(body,/^(select|with)\b/i,'starts with SELECT or WITH');
 const all=words(body);for(const w of all)assert.ok(!BLOCKED.has(w),`${w} is blocked`);
 const refs=new Set([...body.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])));
 assert.equal(refs.size,parameters.length);for(let i=1;i<=parameters.length;i++)assert.ok(refs.has(i),`$${i} referenced`);
 const foreign=published(source==='public'?'client_records':'public');
 for(const w of all)assert.ok(!foreign.includes(w),`${w} belongs to the other source`);
}
/** Every FROM/JOIN name is a published relation of the source (or a CTE), and every alias.column is one of its columns. */
function namesPublished(sql,source='public'){
 const text=sql.replace(/'(?:[^']|'')*'/g,"''");
 const ctes=new Set([...text.matchAll(/(?:with|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map(m=>m[1].toLowerCase()));
 const aliases=new Map();let used=0;
 for(const m of text.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?/gi)){
  const relation=m[1].toLowerCase(),alias=(m[2]??relation).toLowerCase();if(ctes.has(relation))continue;
  assert.ok(published(source).includes(relation),`${relation} is a published ${source} relation`);aliases.set(alias,relation);used++;
 }
 assert.ok(used>0,'reads at least one published relation');
 for(const m of text.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)/gi)){
  const relation=aliases.get(m[1].toLowerCase());if(!relation)continue;
  assert.ok(Object.hasOwn(surface[relation].columns,m[2].toLowerCase()),`${relation}.${m[2]} is a published column`);
 }
 if(aliases.size===1){const [relation]=aliases.values(),columns=Object.keys(surface[relation].columns);
  for(const w of words(text))if(w.endsWith('_id')||w.endsWith('_date')||w.endsWith('_at')||w.endsWith('_fy')||['title','status','amount','congress'].includes(w))assert.ok(columns.includes(w)||!/^(?:[a-z]+_)+[a-z]+$/.test(w)||text.includes(` AS ${w}`),`${relation}.${w} exists`);}
 return aliases;
}
const envelope=(operation,result)=>({binding:{},subject:{},operation,argumentsSha256:'0'.repeat(64),result});
const notice=(operation,page)=>readNotices(operation,JSON.stringify(envelope(operation,page)),envelope(operation,page))[0]?.text;
const query={id:'query_capiro_data'},describe={id:'describe_capiro_data'};

/** @type {{question:string,sql:string,parameters:unknown[],source?:'public'|'client_records',uses:string[],why:string}[]} */
const ANSWERABLE=[
 {question:'Which members cosponsored the most bills in the 119th Congress?',uses:['congress_bill_cosponsors.withdrawn_date','congress_bills.congress'],why:'cosponsors limitation: withdrawn_date IS NULL for active cosponsors; join on the enforced bill_id relationship',
  sql:'SELECT c.bioguide_id, c.full_name, COUNT(DISTINCT c.bill_id) AS bills_cosponsored FROM congress_bill_cosponsors c JOIN congress_bills b ON b.id = c.bill_id WHERE b.congress = $1 AND c.withdrawn_date IS NULL GROUP BY c.bioguide_id, c.full_name ORDER BY bills_cosponsored DESC, c.bioguide_id LIMIT 20',parameters:[119]},
 {question:'How many bills were introduced per month in 2025?',uses:['congress_bills.introduced_date'],why:'date_trunc over the date column with bound, cast date parameters',
  sql:"SELECT date_trunc('month', b.introduced_date)::date AS month, COUNT(*) AS bills FROM congress_bills b WHERE b.introduced_date >= $1::date AND b.introduced_date < $2::date GROUP BY 1 ORDER BY 1",parameters:['2025-01-01','2026-01-01']},
 {question:'Which bills mention hypersonic in their title?',uses:['congress_bills.title'],why:'ILIKE with a bound % pattern; keyset-ready order',
  sql:'SELECT b.id, b.title, b.status, b.introduced_date FROM congress_bills b WHERE b.title ILIKE $1 ORDER BY b.introduced_date DESC NULLS LAST, b.id',parameters:['%hypersonic%']},
 {question:'Which bills does the selected client track, newest first? (client scope)',source:'client_records',uses:['client_tracked_bills.client_id','client_tracked_bills.bill_id'],why:'client_records source; the client_id column is the scope key and no public relation is mixed in',
  sql:'SELECT t.id, t.bill_id, t.created_at FROM client_tracked_bills t WHERE t.client_id = $1 ORDER BY t.created_at DESC, t.id',parameters:['00000000-0000-4000-8000-00000000000b']},
 {question:'What did the FY2026 President\'s Budget assert for PE 0604000X by fiscal year?',uses:['program_element_budget_positions.position_cycle','program_element_budget_positions.asserted_fy','program_element_budget_positions.value_kind'],why:'filter value_kind and position_cycle before reading amounts (relation limitation)',
  sql:"SELECT p.asserted_fy, p.amount FROM program_element_budget_positions p WHERE p.pe_code = $1 AND p.position_cycle = $2 AND p.value_kind = 'total' ORDER BY p.asserted_fy",parameters:['0604000X','pb_fy2026']},
 {question:'Which Texas senators sponsored bills in the 119th Congress, and how many each?',uses:['congress_bills.sponsor_bioguide_id','congress_members.chamber','congress_members.state'],why:'join on the soft sponsor_bioguide_id relationship, never on names',
  sql:'SELECT m.bioguide_id, m.full_name, COUNT(*) AS sponsored FROM congress_bills b JOIN congress_members m ON m.bioguide_id = b.sponsor_bioguide_id WHERE b.congress = $1 AND m.chamber = $2 AND m.state = $3 GROUP BY m.bioguide_id, m.full_name ORDER BY sponsored DESC, m.bioguide_id',parameters:[119,'senate','TX']},
 {question:'How many distinct bills carry the subject Armed Forces and National Security?',uses:['congress_bill_subjects.bill_id','congress_bill_subjects.name'],why:'subjects limitation: (bill_id, name) is not unique, deduplicate bill ids',
  sql:'SELECT COUNT(DISTINCT s.bill_id) AS bills FROM congress_bill_subjects s WHERE s.name = $1',parameters:['Armed Forces and National Security']},
 {question:'How many 119th-Congress bills are at each legislative stage?',uses:['congress_bills.status'],why:'status is the derived stage; grouping needs no value guess',
  sql:'SELECT b.status, COUNT(*) AS bills FROM congress_bills b WHERE b.congress = $1 GROUP BY b.status ORDER BY bills DESC, b.status',parameters:[119]},
 {question:'Which projects under PE 0604000X have the largest FY2026 PB totals?',uses:['program_element_project_budget_positions.project_code','program_element_projects.project_code'],why:'join on the full declared (pe_code, project_code) key so parent amounts are not multiplied',
  sql:"SELECT pr.project_code, pr.title, pos.amount FROM program_element_project_budget_positions pos JOIN program_element_projects pr ON pr.pe_code = pos.pe_code AND pr.project_code = pos.project_code WHERE pos.pe_code = $1 AND pos.position_cycle = $2 AND pos.asserted_fy = $3 AND pos.value_kind = 'total' ORDER BY pos.amount DESC, pr.project_code",parameters:['0604000X','pb_fy2026',2026]},
 {question:'List Republican-sponsored bills introduced since 2025, second page',uses:['congress_bills.sponsor_party','congress_bills.id'],why:'keyset paging on the full key id after rowLimitReached, instead of OFFSET',
  sql:'SELECT b.id, b.title, b.introduced_date FROM congress_bills b WHERE b.sponsor_party = $1 AND b.introduced_date >= $2::date AND b.id > $3 ORDER BY b.id LIMIT 200',parameters:['R','2025-01-01','119-hr-1000']},
 {question:'Which RDT&E program elements were first seen in FY2024 or later?',uses:['program_elements.appropriation_type','program_elements.first_seen_fy'],why:'single-relation filter on the PE roster',
  sql:'SELECT e.pe_code, e.title, e.service, e.first_seen_fy FROM program_elements e WHERE e.appropriation_type = $1 AND e.first_seen_fy >= $2 ORDER BY e.first_seen_fy DESC, e.pe_code',parameters:['RDT&E',2024]},
];

test('the describe output publishes every relation and column the eleven answerable questions need',()=>{
 assert.deepEqual(published('public'),['congress_bills','congress_bill_subjects','congress_bill_cosponsors','congress_members','program_elements','program_element_projects','program_element_budget_positions','program_element_project_budget_positions']);
 assert.equal(published('client_records').length,14);
 for(const q of ANSWERABLE)for(const use of q.uses){const [relation,column]=use.split('.');assert.ok(surface[relation]?.columns[column],`${q.question}: ${use}`);}
 // Enumerations and limitations the questions rely on are in the published metadata.
 assert.deepEqual(surface.program_element_budget_positions.columns.value_kind.enum,['total','quantity','unit_cost']);
 assert.deepEqual(surface.congress_bills.columns.bill_type.enum,['hr','s','hjres','sjres','hres','sres','hconres','sconres']);
 assert.match(surface.congress_bill_cosponsors.limitations.join(' '),/withdrawn_date IS NULL for active cosponsors/);
 assert.match(surface.congress_bill_subjects.limitations.join(' '),/Deduplicate bill IDs before counting bills/);
 assert.deepEqual(surface.program_element_project_budget_positions.relationships[1].fields,['pe_code','project_code']);
});

for(const q of ANSWERABLE)test(`Q: ${q.question}`,()=>{
 admitted(q.sql,q.parameters,q.source);
 const aliases=namesPublished(q.sql,q.source);
 for(const use of q.uses){const [relation]=use.split('.');assert.ok([...aliases.values()].includes(relation),`${relation} is read`);}
 // Parameters follow the sql argument's binding rules: strings for text, dates and UUIDs; numbers only for safe integers.
 for(const p of q.parameters)assert.ok(typeof p==='string'||Number.isSafeInteger(p),`${p} is a bindable scalar`);
});

test('Q: bills introduced after March, written with a typo-prone column name, is corrected by the refusal the model receives',()=>{
 const typo='SELECT b.id, b.title FROM congress_bills b WHERE b.introduced_at > $1::date ORDER BY b.id';
 assert.equal(Object.hasOwn(surface.congress_bills.columns,'introduced_at'),false);
 // What Core 362 returns for that statement (PostgreSQL 42703 with the gate's nearest published names).
 const position=typo.indexOf('b.introduced_at')+1;
 const refusal=sqlRefusal({code:'UNKNOWN_FIELD',message:'column b.introduced_at does not exist',position,hint:undefined,sqlstate:'42703',candidates:['introduced_date']});delete refusal.error.hint;
 const text=notice(query,refusal);
 assert.match(text,/^Notice: query_capiro_data refused this request with UNKNOWN_FIELD\. Use column names exactly as describe_capiro_data lists them/);
 assert.ok(text.includes(`PostgreSQL 42703: column b.introduced_at does not exist at character ${position}. Did you mean: introduced_date.`),text);
 const corrected=typo.replace('introduced_at','introduced_date');admitted(corrected,['2025-03-31']);namesPublished(corrected);
});

test('Q: which LDA registrants lobbied for the selected client is not in the relations, and the guidance routes it to the typed reader',()=>{
 const names=Object.keys(surface).concat(Object.values(surface).flatMap(r=>Object.keys(r.columns)));
 assert.equal(names.some(n=>/lda|lobby|registrant|filing/i.test(n)),false,'no published relation or column covers lobbying disclosures');
 const lda=familyReads().find(row=>row.operation.id==='search_lda_filings');assert.ok(lda);assert.equal(lda.family,'disclosures');
 const description=describeRead(lda.descriptor,lda.family,{sqlPrimary:true});
 assert.ok(description.includes(SQL_FIRST_GUIDANCE));
 assert.match(SQL_FIRST_GUIDANCE,/use this read for the typed record, evidence or citation path, or when the described relations do not cover the question, and say which path you used/);
 assert.equal(READ_FAMILY_GUIDANCE.disclosures.structured,true);
 // Reading the typed tool is not a fallback from a refusal: the describe refusal for a guessed relation still says to stay on the listed names.
 const guessed=sqlRefusal({code:'UNKNOWN_RELATION',message:'lda_filings is not a published relation.',position:undefined,hint:undefined,sqlstate:undefined,candidates:[]});
 assert.match(notice(describe,guessed),/Use a relation name exactly as describe_capiro_data lists it/);
});

test('every refusal path renders a correction the model can act on',()=>{
 const cases=[
  ['two statements',{code:'UNSUPPORTED_SQL',message:'Exactly one SELECT statement is required.'},/Send exactly one statement that starts with SELECT or WITH \.\.\. SELECT/],
  ['a data-modifying keyword',{code:'UNSUPPORTED_SQL',message:'DELETE is not part of a read-only SELECT.'},/no INSERT, UPDATE, DELETE, MERGE, SELECT INTO or data-modifying CTE/],
  ['parameters not all referenced',{code:'PARAMETER_MISMATCH',message:'Every supplied parameter must be referenced, consecutively from $1.'},/bind \$1\.\.\$n contiguously with every entry referenced/],
  ['an untyped parameter',{code:'INVALID_QUERY',message:'could not determine data type of parameter $1',sqlstate:'42P18'},/PostgreSQL 42P18: could not determine data type of parameter \$1/],
  ['a client relation in a public query',{code:'UNKNOWN_RELATION',message:'client_tracked_bills belongs to the client_records source; one query reads one source.'},/one query reads one source\. Use the same source on describe and query/],
  ['a misspelled relation',{code:'UNKNOWN_RELATION',message:'relation "congress_bill" does not exist',sqlstate:'42P01',position:31,candidates:['congress_bills']},/Did you mean: congress_bills\./],
  ['a timeout',{code:'QUERY_TIMEOUT',message:'The query exceeded its execution time limit. Narrow the query.',sqlstate:'57014'},/add selective WHERE filters, join fewer relations, aggregate instead of listing or lower LIMIT/],
  ['an oversized result',{code:'OUTPUT_LIMIT',message:'One result row exceeds the output budget. Select fewer fields.'},/select fewer columns, aggregate, or lower rowLimit and page by keyset/],
 ];
 for(const [name,error,expected] of cases){
  const refusal=sqlRefusal({position:undefined,hint:undefined,sqlstate:undefined,candidates:undefined,...error});
  for(const key of ['position','hint','sqlstate','candidates'])if(refusal.error[key]===undefined)delete refusal.error[key];
  const text=notice(query,refusal);assert.match(text,expected,name);assert.ok(text.endsWith('No evidence, absence or completeness is established.'),name);
 }
 assert.deepEqual(Object.keys(SQL_REFUSAL_GUIDANCE).sort(),['INVALID_QUERY','OUTPUT_LIMIT','PARAMETER_MISMATCH','QUERY_TIMEOUT','SOURCE_UNAVAILABLE','UNKNOWN_FIELD','UNKNOWN_RELATION','UNSUPPORTED_SQL']);
});
