/** Closed feedback texts for the text-to-SQL tools: argument refusals, Core SQL refusals and result count lines. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {failureResult,readNotices,READ_FAILURE_CODES} from '../results.mjs';
import {READ_GUIDANCE,SQL_REFUSAL_GUIDANCE} from '../guidance.mjs';
import {capiroDataPage,sqlRefusal} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';

const NOTHING='No evidence, absence or completeness is established.';
const query={id:'query_capiro_data'},describe={id:'describe_capiro_data'};
const envelope=result=>({binding:{},subject:{},operation:query,argumentsSha256:'0'.repeat(64),result});
const notices=(operation,result)=>readNotices(operation,JSON.stringify(envelope(result)),envelope(result));

test('SQL argument refusals name the exact request shape; other tools keep the generic text',()=>{
 const text=failureResult('INVALID_ARGUMENTS','mcp__meri_reads__query_capiro_data').content[0].text;
 assert.match(text,/^INVALID_ARGUMENTS: mcp__meri_reads__query_capiro_data refused these arguments; supply literal arguments matching its input schema\. query_capiro_data takes sql \(1-16384 bytes\) and parameters \(required; \[\] when nothing is bound/);
 assert.match(text,/rowLimit \(integer 1-1000\)/);assert.match(text,new RegExp(`${NOTHING}$`));
 assert.match(failureResult('INVALID_ARGUMENTS','mcp__meri_reads__describe_capiro_data').content[0].text,/describe_capiro_data takes optional relations \(1-15 unique lowercase relation names\)/);
 assert.equal(failureResult('INVALID_ARGUMENTS','mcp__meri_reads__get_bill_status').content[0].text,
  `INVALID_ARGUMENTS: mcp__meri_reads__get_bill_status refused these arguments; supply literal arguments matching its input schema. ${NOTHING}`);
 for(const code of READ_FAILURE_CODES.filter(code=>code!=='INVALID_ARGUMENTS'))
  assert.doesNotMatch(failureResult(code,'mcp__meri_reads__query_capiro_data').content[0].text,/takes sql/);
});

test('every closed Core SQL refusal code yields one fixed correction notice and the unknown code only names itself',()=>{
 const codes=['INVALID_QUERY','UNSUPPORTED_SQL','UNKNOWN_RELATION','UNKNOWN_FIELD','PARAMETER_MISMATCH','SOURCE_UNAVAILABLE','QUERY_TIMEOUT','OUTPUT_LIMIT'];
 assert.deepEqual(Object.keys(SQL_REFUSAL_GUIDANCE).sort(),[...codes].sort());
 for(const id of ['describe_capiro_data','query_capiro_data'])assert.equal(READ_GUIDANCE[id].refusals,SQL_REFUSAL_GUIDANCE,`${id} refusal guidance has one owner`);
 for(const operation of [query,describe])for(const code of codes){
  const page={version:'0.1.0',generatedAt:'2026-10-26T12:00:00.000Z',ok:false,error:{code,message:'PRIVATE detail from Core'}};
  const [notice,...rest]=notices(operation,page);assert.equal(rest.length,0);assert.equal(notice.type,'text');
  assert.equal(notice.text,`Notice: ${operation.id} refused this request with ${code}. ${SQL_REFUSAL_GUIDANCE[code]} ${NOTHING}`);
  assert.equal(notice.text.includes('PRIVATE'),false);
 }
 assert.match(SQL_REFUSAL_GUIDANCE.UNSUPPORTED_SQL,/current describe_capiro_data contract grammar and Core refusal message/);
 assert.doesNotMatch(SQL_REFUSAL_GUIDANCE.UNSUPPORTED_SQL,/pg_sleep|dblink|lo_\*/);
 assert.match(SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION,/one query reads one source/);
 assert.match(SQL_REFUSAL_GUIDANCE.INVALID_QUERY,/PostgreSQL syntax or type error names the character position/);
 for(const text of Object.values(SQL_REFUSAL_GUIDANCE))assert.doesNotMatch(text,/No string literals|SELECT \*|accepted grammar|key equality|base columns|NULLS LAST/);
 assert.match(SQL_REFUSAL_GUIDANCE.UNKNOWN_FIELD,/describe_capiro_data relations:\[\.\.\.\]/);
 assert.match(SQL_REFUSAL_GUIDANCE.PARAMETER_MISMATCH,/\$1\.\.\$n contiguously/);
 const [unknown]=notices(query,{version:'0.1.0',generatedAt:'2026-10-26T12:00:00.000Z',ok:false,error:{code:'OTHER',message:'x'}});
 assert.equal(unknown.text,`Notice: query_capiro_data refused this request with OTHER. ${NOTHING}`);
});

test('a successful query gets one count line; truncation and empty pages add their fixed remedies',()=>{
 const page=capiroDataPage();
 assert.deepEqual(notices(query,page),[{type:'text',text:'Notice: 2 row(s) returned of rowLimit 2 from program_elements.'}]);
 const cut={...page,rowLimitReached:true,byteTruncated:true};
 assert.equal(notices(query,cut)[0].text,'Notice: 2 row(s) returned of rowLimit 2 from program_elements. rowLimitReached: more rows matched; narrow the filters, aggregate, or page by keyset (ORDER BY the full key, WHERE key > $n). byteTruncated: whole rows were dropped at the 256 KiB output budget; select fewer columns or lower rowLimit.');
 const empty={...page,rows:[],rowCount:0};
 assert.equal(notices(query,empty)[0].text,'Notice: 0 row(s) returned of rowLimit 2 from program_elements. Zero rows is not proof of absence: check parameter values, ILIKE wildcards (%) and the relation coverage limitations before concluding.');
 assert.deepEqual(notices(describe,capiroDataPage('describe_capiro_data')),[]);
});

test('notices never touch other tools or malformed envelopes',()=>{
 const page=capiroDataPage();
 assert.deepEqual(readNotices({id:'get_bill_status'},JSON.stringify(envelope(page)),envelope(page)),[]);
 assert.deepEqual(readNotices(query,'{}',{}),[]);
 assert.deepEqual(readNotices(query,'null',null),[]);
 assert.deepEqual(readNotices({id:'find_contacts'},'{"result":{"contacts":[]}}',{result:{contacts:[]}}),[]);
 assert.equal(readNotices({id:'find_contacts'},'update_client_profile',{})[0].text.startsWith('Notice: update_client_profile is not available in Meri.'),true);
});

test('PostgreSQL diagnostics on a Core 362 refusal follow the fixed notice; the gate\'s own and pre-362 refusals stay fixed',()=>{
 const line=text=>notices(query,text)[0].text;
 assert.equal(line(sqlRefusal()),`Notice: query_capiro_data refused this request with UNKNOWN_FIELD. ${SQL_REFUSAL_GUIDANCE.UNKNOWN_FIELD} PostgreSQL 42703: column b.titel does not exist at character 8. Hint: Perhaps you meant "b.title". Did you mean: title. ${NOTHING}`);
 const relation=sqlRefusal({code:'UNKNOWN_RELATION',message:'relation "congress_bill" does not exist',sqlstate:'42P01',candidates:['congress_bills','congress_members'],position:31});delete relation.error.hint;
 assert.equal(line(relation),`Notice: query_capiro_data refused this request with UNKNOWN_RELATION. ${SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION} PostgreSQL 42P01: relation "congress_bill" does not exist at character 31. Did you mean: congress_bills, congress_members. ${NOTHING}`);
 const syntax=sqlRefusal({code:'INVALID_QUERY',message:'syntax error at or near ")"',sqlstate:'42601',position:3});delete syntax.error.hint;delete syntax.error.candidates;
 assert.equal(line(syntax),`Notice: query_capiro_data refused this request with INVALID_QUERY. ${SQL_REFUSAL_GUIDANCE.INVALID_QUERY} PostgreSQL 42601: syntax error at or near ")" at character 3. ${NOTHING}`);
 const describeRefusal=sqlRefusal({code:'UNKNOWN_RELATION',message:'congress_bill is not a published relation.',candidates:['congress_bills']});for(const key of ['position','hint','sqlstate'])delete describeRefusal.error[key];
 assert.equal(notices(describe,describeRefusal)[0].text,`Notice: describe_capiro_data refused this request with UNKNOWN_RELATION. ${SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION} PostgreSQL: congress_bill is not a published relation. Did you mean: congress_bills. ${NOTHING}`);
 // A SQLSTATE alone (sanitized SOURCE_UNAVAILABLE), empty candidates or the gate's own refusal render no diagnostic line and never echo the message.
 for(const refusal of [sqlRefusal({code:'SOURCE_UNAVAILABLE',message:'Data is currently unavailable.',sqlstate:'53200',position:undefined,hint:undefined,candidates:undefined}),
  sqlRefusal({code:'UNSUPPORTED_SQL',message:'PRIVATE gate text',position:undefined,hint:undefined,sqlstate:undefined,candidates:[]})]){
  const text=line(refusal);assert.doesNotMatch(text,/PostgreSQL|PRIVATE|unavailable\./);assert.match(text,new RegExp(`^Notice: query_capiro_data refused this request with ${refusal.error.code}\\. `));
 }
});
