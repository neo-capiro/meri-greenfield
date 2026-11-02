/** Closed feedback texts for the text-to-SQL tools: argument refusals, Core SQL refusals and result count lines. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {failureResult,readNotices,READ_FAILURE_CODES,sqlQueryView,modelResultText,SQL_VIEW_ROWS_MAX,SQL_VIEW_CHARS_MAX,SQL_VIEW_CELL_MAX} from '../results.mjs';
import {READ_GUIDANCE,SQL_REFUSAL_GUIDANCE} from '../guidance.mjs';
import {capiroDataPage,privateCapiroDataPage,sqlRefusal,governmentForecastsPage} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';

const NOTHING='No evidence, absence or completeness is established.';
/** Closes every refusal notice (2 November acceptance: a refusal's statement and names reached the user verbatim). */
const FOR_MODEL='This notice is for correcting the request, never for the user: show them neither the statement nor this message, codes or data set and column names; if the request cannot be corrected, say in plain words which data could not be queried.';
const DESCRIBE_TAIL='These names are for writing queries, never for the user: when no described data set holds the subject asked about, tell the user in plain words that this data is not available for structured queries yet and offer what is (for example a search by topic).';
const query={id:'query_capiro_data'},describe={id:'describe_capiro_data'};
const envelope=result=>({binding:{},subject:{},operation:query,argumentsSha256:'0'.repeat(64),result});
const notices=(operation,result)=>readNotices(operation,JSON.stringify(envelope(result)),envelope(result));

test('SQL argument refusals name the exact request shape; other tools keep the generic text',()=>{
 const text=failureResult('INVALID_ARGUMENTS','mcp__meri_reads__query_capiro_data').content[0].text;
 assert.match(text,/^These arguments were refused; supply literal arguments matching the input schema\. query_capiro_data takes sql \(1-16384 bytes\) and parameters \(required; \[\] when nothing is bound/);
 assert.match(text,/rowLimit \(integer 1-1000\)/);assert.match(text,new RegExp(`${NOTHING}$`));
 assert.match(failureResult('INVALID_ARGUMENTS','mcp__meri_reads__describe_capiro_data').content[0].text,/describe_capiro_data takes optional relations: 1-15 unique lowercase data set names/);
 assert.equal(failureResult('INVALID_ARGUMENTS','mcp__meri_reads__get_bill_status').content[0].text,
  `These arguments were refused; supply literal arguments matching the input schema. ${NOTHING}`);
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
  assert.equal(notice.text,`Notice: ${operation.id} refused this request with ${code}. ${SQL_REFUSAL_GUIDANCE[code]} ${FOR_MODEL} ${NOTHING}`);
  assert.equal(notice.text.includes('PRIVATE'),false);
 }
 // Core 362's gate rules, stated as the correction; the retired contract envelope is never mentioned.
 assert.match(SQL_REFUSAL_GUIDANCE.UNSUPPORTED_SQL,/exactly one statement that starts with SELECT or WITH \.\.\. SELECT/);
 assert.match(SQL_REFUSAL_GUIDANCE.UNSUPPORTED_SQL,/no INSERT, UPDATE, DELETE, MERGE, SELECT INTO or data-modifying CTE/);
 for(const text of Object.values(SQL_REFUSAL_GUIDANCE))assert.doesNotMatch(text,/contract/);
 assert.match(SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION,/one query reads one source/);
 // A subject the published data does not hold is explained to the user in their words (the "no grants relation in the text-to-SQL layer" leak).
 assert.match(SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION,/When no listed data set holds the subject asked about, tell the user in plain words that this data is not available for structured queries yet and offer what is \(for example a search by topic\), without naming data sets, statements or methods\./);
 assert.match(SQL_REFUSAL_GUIDANCE.INVALID_QUERY,/PostgreSQL syntax or type error names the character position/);
 for(const text of Object.values(SQL_REFUSAL_GUIDANCE))assert.doesNotMatch(text,/No string literals|SELECT \*|accepted grammar|key equality|base columns|NULLS LAST/);
 assert.match(SQL_REFUSAL_GUIDANCE.UNKNOWN_FIELD,/describe_capiro_data relations:\[\.\.\.\]/);
 assert.match(SQL_REFUSAL_GUIDANCE.PARAMETER_MISMATCH,/\$1\.\.\$n contiguously/);
 const [unknown]=notices(query,{version:'0.1.0',generatedAt:'2026-10-26T12:00:00.000Z',ok:false,error:{code:'OTHER',message:'x'}});
 assert.equal(unknown.text,`Notice: query_capiro_data refused this request with OTHER. ${FOR_MODEL} ${NOTHING}`);
});

test('a successful query gets one count line; truncation and empty pages add their fixed remedies',()=>{
 const page=capiroDataPage();
 assert.deepEqual(notices(query,page),[{type:'text',text:'Notice: 2 row(s) returned of rowLimit 2 from program_elements; each row lists its values in the order of columns.'}]);
 const cut={...page,rowLimitReached:true,byteTruncated:true};
 assert.equal(notices(query,cut)[0].text,'Notice: 2 row(s) returned of rowLimit 2 from program_elements; each row lists its values in the order of columns. rowLimitReached: more rows matched; to say how many, count them (count(*) OVER () AS total_matching in the same query), or narrow the filters, aggregate, or page by keyset (ORDER BY the full key, WHERE key > $n). byteTruncated: whole rows were dropped at the 256 KiB output budget; select fewer columns or lower rowLimit.');
 const empty={...page,rows:[],rowCount:0};
 assert.equal(notices(query,empty)[0].text,'Notice: 0 row(s) returned of rowLimit 2 from program_elements. Zero rows is not proof of absence: check parameter values, ILIKE wildcards (%) and the data set coverage limitations before concluding.');
 assert.deepEqual(notices(describe,capiroDataPage('describe_capiro_data')),[{type:'text',text:`Notice: 1 public data set(s) described: program_elements. Spell data set and column names exactly as listed, filter enum columns by their listed values, join on the listed relationships, and respect each data set's grain and limitations; rowLimit default 200, max 1000. ${DESCRIBE_TAIL}`}]);
 assert.match(notices(describe,privateCapiroDataPage('describe_capiro_data'))[0].text,/^Notice: 1 client_records data set\(s\) described: client_objectives\./);
 assert.deepEqual(notices(describe,{...capiroDataPage('describe_capiro_data'),relations:undefined}),[],'a malformed describe page gets no orientation line');
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
 assert.equal(line(sqlRefusal()),`Notice: query_capiro_data refused this request with UNKNOWN_FIELD. ${SQL_REFUSAL_GUIDANCE.UNKNOWN_FIELD} PostgreSQL 42703: column b.titel does not exist at character 8. Hint: Perhaps you meant "b.title". Did you mean: title. ${FOR_MODEL} ${NOTHING}`);
 const relation=sqlRefusal({code:'UNKNOWN_RELATION',message:'relation "congress_bill" does not exist',sqlstate:'42P01',candidates:['congress_bills','congress_members'],position:31});delete relation.error.hint;
 assert.equal(line(relation),`Notice: query_capiro_data refused this request with UNKNOWN_RELATION. ${SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION} PostgreSQL 42P01: relation "congress_bill" does not exist at character 31. Did you mean: congress_bills, congress_members. ${FOR_MODEL} ${NOTHING}`);
 const syntax=sqlRefusal({code:'INVALID_QUERY',message:'syntax error at or near ")"',sqlstate:'42601',position:3});delete syntax.error.hint;delete syntax.error.candidates;
 assert.equal(line(syntax),`Notice: query_capiro_data refused this request with INVALID_QUERY. ${SQL_REFUSAL_GUIDANCE.INVALID_QUERY} PostgreSQL 42601: syntax error at or near ")" at character 3. ${FOR_MODEL} ${NOTHING}`);
 const describeRefusal=sqlRefusal({code:'UNKNOWN_RELATION',message:'congress_bill is not a published relation.',candidates:['congress_bills']});for(const key of ['position','hint','sqlstate'])delete describeRefusal.error[key];
 assert.equal(notices(describe,describeRefusal)[0].text,`Notice: describe_capiro_data refused this request with UNKNOWN_RELATION. ${SQL_REFUSAL_GUIDANCE.UNKNOWN_RELATION} PostgreSQL: congress_bill is not a published relation. Did you mean: congress_bills. ${FOR_MODEL} ${NOTHING}`);
 // A SQLSTATE alone (sanitized SOURCE_UNAVAILABLE), empty candidates or the gate's own refusal render no diagnostic line and never echo the message.
 for(const refusal of [sqlRefusal({code:'SOURCE_UNAVAILABLE',message:'Data is currently unavailable.',sqlstate:'53200',position:undefined,hint:undefined,candidates:undefined}),
  sqlRefusal({code:'UNSUPPORTED_SQL',message:'PRIVATE gate text',position:undefined,hint:undefined,sqlstate:undefined,candidates:[]})]){
  const text=line(refusal);assert.doesNotMatch(text,/PostgreSQL|PRIVATE|unavailable\./);assert.match(text,new RegExp(`^Notice: query_capiro_data refused this request with ${refusal.error.code}\\. `));
 }
});

test('relation refusals render Core\'s restated message verbatim: Core, not Meri, owns what a permission or schema error says',()=>{
 const line=text=>notices(query,text)[0].text;
 // translateDatabaseError (Core sql-reader-connection.ts) replaces PostgreSQL's text with the name the model wrote, or none.
 const restated=sqlRefusal({code:'UNKNOWN_RELATION',message:'clients is not published in this source; use only the relations describe_capiro_data lists.',sqlstate:'42501',position:12,hint:undefined,candidates:['client_objectives']});delete restated.error.hint;
 assert.match(line(restated),/PostgreSQL 42501: clients is not published in this source; use only the relations describe_capiro_data lists at character 12\. Did you mean: client_objectives\./);
 const locking=sqlRefusal({code:'UNKNOWN_RELATION',message:'Only a read-only SELECT is permitted on congress_bills; locking and write clauses are refused.',sqlstate:'42501',position:undefined,hint:undefined,candidates:undefined});for(const k of ['position','hint','candidates'])delete locking.error[k];
 assert.match(line(locking),/PostgreSQL 42501: Only a read-only SELECT is permitted on congress_bills; locking and write clauses are refused\./);
 // PostgreSQL's own report of the model's statement still renders in full.
 assert.match(line(sqlRefusal({code:'INVALID_QUERY',message:'could not determine data type of parameter $1',sqlstate:'42P18',position:undefined,hint:undefined,candidates:undefined})),/PostgreSQL 42P18: could not determine data type of parameter \$1\./);
});

// 2 November acceptance: "which government forecasts have a window in the next two quarters" returned a result too large for
// the SDK's tool-result limit; it spilled to a file the model read with Read and a shell command, and the answer gave monthly
// counts instead of the forecasts.
test('a large query result reaches the model compact and bounded while the canonical envelope stays the result of record',()=>{
 const page=governmentForecastsPage(250),canonical=JSON.stringify(envelope(page));
 assert.ok(canonical.length>120000,`the canonical result is ${canonical.length} characters`);
 const text=modelResultText(query,canonical,envelope(page)),view=JSON.parse(text);
 assert.ok(text.length<=SQL_VIEW_CHARS_MAX,`${text.length} characters`);assert.equal(text,JSON.stringify(sqlQueryView(page)));
 assert.equal(view.binding,undefined);assert.equal(view.coverage,undefined);
 // Columns once; every row an array in that order; the columns the same in every row given once.
 assert.deepEqual(view.sameInEveryRow,{status:'published',edition:'202604',observed_at:'2026-11-02 09:31:07.412+00',recorded_at:'2026-10-30 09:30:55.118+00'});
 assert.deepEqual(view.columns,['forecast_id','rin','title','event_type','window_from','window_to','period_precision','period_text','source_url','revision']);
 assert.equal(view.rowCount,250);assert.ok(view.shownRows>=40&&view.shownRows<=SQL_VIEW_ROWS_MAX,`${view.shownRows} rows shown`);assert.equal(view.rows.length,view.shownRows);
 const title=view.columns.indexOf('title');assert.equal(view.rows[0][title],page.rows[0].title);assert.equal(view.cutCells,undefined,'titles are short enough to stay whole');
 const [line]=notices(query,page);
 assert.match(line.text,/^Notice: 250 row\(s\) returned of rowLimit 1000 from government_forecasts; each row lists its values in the order of columns, and sameInEveryRow gives once the columns whose value is the same in every row\. Only the first \d+ row\(s\) are shown; the rest are kept for the record\. For a list answer name about 20 representative rows from these with the total and offer the rest; for counts, totals or trends aggregate in SQL/);
 // The listing query the guidance asks for: identifying columns, the total and the source check time in one result.
 const listing={...page,columns:['title','rin','event_type','window_from','total_matching','source_checked_at'].map(name=>({name,type:'string',pgType:'text',nullable:true})),
  rows:page.rows.slice(0,60).map(r=>({title:r.title,rin:r.rin,event_type:r.event_type,window_from:r.window_from,total_matching:'250',source_checked_at:r.observed_at})),rowCount:60,limits:{rowLimit:60,maxOutputBytes:262144},rowLimitReached:true};
 const compact=sqlQueryView(listing);
 assert.deepEqual(compact.sameInEveryRow,{total_matching:'250',source_checked_at:'2026-11-02 09:31:07.412+00'});assert.equal(compact.rows.length,60);assert.equal(compact.shownRows,undefined);
 assert.ok(JSON.stringify(compact).length<12000,`${JSON.stringify(compact).length} characters for 60 listed forecasts`);
});

test('a result that fits is shown whole; only an oversized one has its long text cut, and at least one row is always shown',()=>{
 const page=capiroDataPage(),long='x'.repeat(5000);
 const whole=sqlQueryView({...page,rows:[{...page.rows[0],pe_code:long},page.rows[1]]});
 assert.equal(whole.rows[0][0],long);assert.equal(whole.cutCells,undefined);assert.equal(whole.shownRows,undefined);
 assert.deepEqual(whole.columns,['pe_code','total','count','absent','last_synced_at']);assert.equal(whole.sameInEveryRow,undefined,'two rows never fold a column');
 assert.deepEqual(whole.units,{total:'USD millions'});
 const huge=sqlQueryView({...page,rows:[{...page.rows[0],pe_code:'y'.repeat(60000)}],rowCount:1});
 assert.equal(huge.rows.length,1);assert.equal(huge.rows[0][0],`${'y'.repeat(SQL_VIEW_CELL_MAX)}...`);assert.equal(huge.cutCells,1);assert.equal(huge.shownRows,undefined);
 const [line]=notices(query,{...page,rows:[{...page.rows[0],pe_code:'y'.repeat(60000)}],rowCount:1});
 assert.match(line.text,/ 1 long text value\(s\) are cut to 300 characters and end with "\.\.\.": to quote one whole, select substr\(column, 1, 20000\) for that row\.$/);
 const many=sqlQueryView({...page,rows:Array.from({length:500},(_,i)=>({...page.rows[0],count:String(i)})),rowCount:500});
 assert.equal(many.rows.length,SQL_VIEW_ROWS_MAX);assert.equal(many.shownRows,SQL_VIEW_ROWS_MAX);
 assert.deepEqual(many.sameInEveryRow,{pe_code:'0600001A',total:'100.10',absent:null,last_synced_at:'2026-01-01 00:00:00.123456+00'});
 // Refusals and describe pages reach the model unchanged.
 for(const result of [sqlRefusal(),capiroDataPage('describe_capiro_data')]){const text=JSON.stringify(envelope(result));assert.equal(modelResultText(query,text,envelope(result)),text);}
});

// 2 November review: a private data set's updated_at or created_at is when a record changed, not when Capiro checked a source.
test('the describe notice states a public freshness field as the source check time and a private one as the latest record change',()=>{
 const page=capiroDataPage('describe_capiro_data');
 assert.doesNotMatch(notices(describe,page)[0].text,/Freshness fields|Record change fields/,'no field, no freshness line');
 const fresh={...page,relations:[{...page.relations[0],freshness:{field:'last_synced_at',sourceAsOf:null,sourceVersion:null}},{...page.relations[0],name:'government_forecasts',freshness:{field:'observed_at',sourceAsOf:null,sourceVersion:null}}]};
 const text=notices(describe,fresh)[0].text;
 assert.match(text,/ Freshness fields: program_elements\.last_synced_at, government_forecasts\.observed_at\. The latest value of a freshness field is when Capiro last checked or synchronized that source: .*select its max \(for example max\(observed_at\) OVER \(\) AS source_checked_at in the listing query, with the edition where the data set has one\) and state it as the data's as-of time; never say a data set's freshness is not recorded when it lists a freshness field\. These names are for writing queries/);
 assert.doesNotMatch(text,/Record change fields/);
 const own=privateCapiroDataPage('describe_capiro_data'),relation=own.relations[0];
 const records={...own,relations:[{...relation,freshness:{field:'updated_at',sourceAsOf:null,sourceVersion:null}},{...relation,name:'client_campaign_recipients',freshness:{field:'created_at',sourceAsOf:null,sourceVersion:null}},
  {...relation,name:'research_portfolio_bills',coverage:{...relation.coverage,basis:'authorized_research_portfolio'},freshness:{field:'updated_at',sourceAsOf:null,sourceVersion:null}}]};
 const recordText=notices(describe,records)[0].text;
 assert.match(recordText,/rowLimit default 200, max 1000\. Record change fields: client_objectives\.updated_at, client_campaign_recipients\.created_at, research_portfolio_bills\.updated_at\. Each is when a record was last edited or created, not a source check: state its latest value as the latest record change, and these records as current at generatedAt \(the query time\)\. These names are for writing queries/);
 assert.doesNotMatch(recordText,/Freshness fields|checked or synchronized|as-of time/);
});

// 2 November review probes: a folded 80,000-character value made an 80,182-character view, and 150 rows reported 200 cut values for 63 shown.
test('folded values get the same cut as cells, and cutCells counts only the values shown',()=>{
 const page=capiroDataPage(),shared='z'.repeat(80000);
 const folded=sqlQueryView({...page,rows:[0,1,2].map(i=>({...page.rows[0],count:String(i),pe_code:shared})),rowCount:3});
 assert.equal(folded.sameInEveryRow.pe_code,`${'z'.repeat(SQL_VIEW_CELL_MAX)}...`);assert.equal(folded.rows.length,3);assert.equal(folded.shownRows,undefined);
 assert.equal(folded.cutCells,1);assert.ok(JSON.stringify(folded).length<=SQL_VIEW_CHARS_MAX);
 const wide=sqlQueryView({...page,rows:Array.from({length:150},(_,i)=>({...page.rows[0],count:String(i),pe_code:`${i}${'p'.repeat(400)}`,absent:`${i}${'a'.repeat(400)}`})),rowCount:150});
 assert.ok(wide.shownRows<SQL_VIEW_ROWS_MAX,`${wide.shownRows} rows shown`);assert.equal(wide.rows.length,wide.shownRows);
 assert.equal(wide.cutCells,2*wide.shownRows);assert.ok(JSON.stringify(wide).length<=SQL_VIEW_CHARS_MAX);
});
