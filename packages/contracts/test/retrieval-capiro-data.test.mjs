/** New wire only; the legacy QuerySpec schema and normalizer remain unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {capiroDataPage,nextGenerationPage,privateCapiroDataPage,requests,sqlRefusal} from '../../../apps/gateway/sources/capiro-data/test/fixture.mjs';
const query=resolveOperationContract({id:'query_capiro_data',version:'0.2.0'});
const check=page=>query.assertOutput(page,{request:requests.query_capiro_data});
test('SQL text is preserved exactly with separately bound finite scalar parameters',()=>{
  const request={sql:'SELECT pe_code FROM program_elements WHERE pe_code = $1',parameters:['0600001A',null,false,0,1.25]};
  assert.deepEqual(query.normalizeInput(request).input,request);
  for(const parameters of [[{}],[[]],[Infinity],[9007199254740992],['界'.repeat(12000)],Array(65).fill(null)])assert.throws(()=>query.normalizeInput({...request,parameters}));
  assert.throws(()=>query.normalizeInput({...request,sql:'界'.repeat(6000)}));
});
test('exact integer/decimal strings, nulls and zero survive without coercion',()=>{
  const page=capiroDataPage();assert.deepEqual(check(page),page);
  for(const [column,value] of [['total',100.1],['total','Infinity'],['count',0],['count','1.1'],['pe_code',null]]){
    const invalid=structuredClone(page);invalid.rows[0][column]=value;assert.throws(()=>check(invalid));
  }
});
test('shape, request limit and coverage relation correlation fail closed',()=>{
  for(const mutate of [p=>p.columns.push(p.columns[0]),p=>delete p.rows[0].absent,p=>p.rows[0].extra='x',p=>p.rowCount=0,p=>p.limits.rowLimit=3,p=>p.coverage.relations[0].name='other',p=>p.coverage.sqlLimit=1,p=>p.coverage.sourceUniverseComplete=true,p=>p.coverage.relations[0].sourceAsOf=p.generatedAt]){
    const page=capiroDataPage();mutate(page);assert.throws(()=>check(page));
  }
});
test('row-limit sentinel and whole-row byte truncation are separate disclosures',()=>{
  const page=capiroDataPage();page.rowLimitReached=true;assert.doesNotThrow(()=>check(page));
  page.rows.pop();page.rowCount=1;assert.throws(()=>check(page));
  page.byteTruncated=true;assert.doesNotThrow(()=>check(page));
  page.rowLimitReached=false;assert.doesNotThrow(()=>check(page));
});
test('entire UTF8 envelope is bounded, including metadata and errors',()=>{
  const page=capiroDataPage();page.rows[0].pe_code='界'.repeat(90000);
  assert.ok(JSON.stringify(page).length<262144);assert.ok(Buffer.byteLength(JSON.stringify(page))>262144);assert.throws(()=>check(page));
  assert.throws(()=>check({version:'0.1.0',generatedAt:page.generatedAt,ok:false,error:{code:'QUERY_TIMEOUT',message:'x'.repeat(513)}}));
});
test('describe validates selected relation identity and published field/key relationships',()=>{
  const contract=resolveOperationContract({id:'describe_capiro_data',version:'0.2.0'}),page=capiroDataPage('describe_capiro_data'),request=requests.describe_capiro_data;
  assert.deepEqual(contract.assertOutput(page,{request}),page);
  for(const mutate of [p=>p.relations[0].name='foreign',p=>p.relations[0].primaryKey=['missing'],p=>p.relations[0].freshness.field='missing',p=>p.relations[0].fields.push(p.relations[0].fields[0])]){
    const invalid=structuredClone(page);mutate(invalid);assert.throws(()=>contract.assertOutput(invalid,{request}));
  }
});

const privateRequest={source:'client_records',sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2};
const scope={clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)};
const context={capiroDataScope:scope};
test('private selectors require current native revision context and cannot label public input private',()=>{
  assert.deepEqual(query.normalizeInput(privateRequest,context).input,privateRequest);
  for(const options of [{},{capiroDataScope:{...scope,membershipRevision:'wrong'}},{capiroDataScope:{...scope,extra:true}}])assert.throws(()=>query.normalizeInput(privateRequest,options));
  for(const request of [{...privateRequest,clientId:null},{...privateRequest,clientId:'name'},{...privateRequest,source:'other'},{...requests.query_capiro_data,clientId:'10000000-0000-4000-8000-000000000001'}])assert.throws(()=>query.normalizeInput(request,context));
  assert.throws(()=>query.normalizeInput(requests.query_capiro_data,context));
  assert.deepEqual(query.normalizeInput({...requests.query_capiro_data,source:'public'}).metadata,{scope:'public_curated_relations',absenceEvidence:false});
});
test('private output binds source version and effective scope for success and errors',()=>{
  const page=privateCapiroDataPage(),check=value=>query.assertOutput(value,{request:privateRequest,...context});
  assert.deepEqual(check(page),page);
  for(const mutate of [p=>p.version='0.1.0',p=>p.scope.clientId='10000000-0000-4000-8000-000000000001',p=>p.relationsUsed=['program_elements'],p=>p.rows[0].count=0]){
    const bad=structuredClone(page);mutate(bad);assert.throws(()=>check(bad));
  }
  const error={version:'0.2.0',generatedAt:page.generatedAt,ok:false,error:{code:'QUERY_TIMEOUT',message:'Time budget exceeded.'}};
  // 0.2.0 is also the public Core 362 generation, so the public refusal check uses the version only the private source carries.
  assert.deepEqual(check(error),error);assert.throws(()=>check({...error,version:'0.1.0'}));assert.throws(()=>query.assertOutput({...error,version:'0.3.0'},{request:requests.query_capiro_data}));
});
test('private description admits the two owner projections with authorized-record coverage',()=>{
  const describe=resolveOperationContract({id:'describe_capiro_data',version:'0.2.0'}),page=privateCapiroDataPage('describe_capiro_data'),request={source:'client_records',relations:['client_objectives']};
  assert.deepEqual(describe.assertOutput(page,{request,...context}),page);
  for(const mutate of [p=>p.relations[0].coverage.basis='ingested_public_records',p=>p.relations[0].name='program_elements',p=>p.relations[0].fields[0].parameterType='UUID']){
    const bad=structuredClone(page);mutate(bad);assert.throws(()=>describe.assertOutput(bad,{request,...context}));
  }
});

// Core 362 (capiro-backend#362) envelope generation; the pre-362 cases above are deleted by fable/sql-envelope-retire-old-generation.
for(const version of ['0.2.0','0.3.0'])test(`${version}: both envelope generations per source, pgType/enum, PostgreSQL diagnostics and timestamp text`,()=>{
  const q=resolveOperationContract({id:'query_capiro_data',version}),d=resolveOperationContract({id:'describe_capiro_data',version});
  const publicQuery={request:requests.query_capiro_data},privateQuery={request:privateRequest,...context};
  const publicDescribe={request:requests.describe_capiro_data},privateDescribe={request:{source:'client_records',relations:['client_objectives']},...context};
  const page=nextGenerationPage(capiroDataPage()),described=nextGenerationPage(capiroDataPage('describe_capiro_data'));
  const privatePage=nextGenerationPage(privateCapiroDataPage()),privateDescribed=nextGenerationPage(privateCapiroDataPage('describe_capiro_data'));
  assert.equal(page.version,'0.2.0');assert.equal(privatePage.version,'0.3.0');assert.equal(Object.hasOwn(described.limits,'maxColumns'),false);
  assert.deepEqual(q.assertOutput(page,publicQuery),page);assert.deepEqual(d.assertOutput(described,publicDescribe),described);
  assert.deepEqual(q.assertOutput(privatePage,privateQuery),privatePage);assert.deepEqual(d.assertOutput(privateDescribed,privateDescribe),privateDescribed);
  const refusal=sqlRefusal(),privateRefusal=sqlRefusal({},'0.3.0');
  assert.deepEqual(q.assertOutput(refusal,publicQuery),refusal);assert.deepEqual(q.assertOutput(privateRefusal,privateQuery),privateRefusal);
  const unknownRelation=sqlRefusal({code:'UNKNOWN_RELATION',message:'congress_bill is not a published relation.',candidates:['congress_bills']});
  delete unknownRelation.error.position;delete unknownRelation.error.hint;delete unknownRelation.error.sqlstate;
  assert.deepEqual(d.assertOutput(unknownRelation,publicDescribe),unknownRelation);
  assert.deepEqual(q.assertOutput(sqlRefusal({candidates:[]}),publicQuery).error.candidates,[]);
  // The version set is bound to the request's source: a public page never carries 0.3.0, a private one never 0.1.0.
  assert.throws(()=>q.assertOutput({...page,version:'0.3.0'},publicQuery));assert.throws(()=>q.assertOutput({...privatePage,version:'0.1.0'},privateQuery));
  assert.throws(()=>q.assertOutput({...refusal,version:'0.3.0'},publicQuery));assert.throws(()=>q.assertOutput({...privateRefusal,version:'0.1.0'},privateQuery));
  assert.throws(()=>q.assertOutput({...refusal,version:'0.4.0'},publicQuery));
  // Diagnostics and the added metadata stay closed.
  for(const mutate of [e=>e.error.position=0,e=>e.error.position='8',e=>e.error.position=16385,e=>e.error.sqlstate='4270',e=>e.error.sqlstate='42p01',e=>e.error.hint='',e=>e.error.candidates=['bad name'],e=>e.error.candidates=['title','title'],e=>e.error.detail='x']){
    const bad=sqlRefusal();mutate(bad);assert.throws(()=>q.assertOutput(bad,publicQuery),JSON.stringify(bad.error));
  }
  for(const mutate of [p=>p.columns[0].pgType='',p=>p.columns[0].pgType=7,p=>p.columns[0].enum=['x'],p=>p.columns[0].extra='x']){
    const bad=structuredClone(page);mutate(bad);assert.throws(()=>q.assertOutput(bad,publicQuery));
  }
  for(const mutate of [p=>p.relations[0].fields[1].enum=[],p=>p.relations[0].fields[1].enum=['total','total'],p=>p.relations[0].fields[1].enum=[1],p=>p.relations[0].fields[0].pgType='',p=>p.limits.maxColumns=33]){
    const bad=structuredClone(described);mutate(bad);assert.throws(()=>d.assertOutput(bad,publicDescribe));
  }
  // Timestamp cells: PostgreSQL text in UTC with up to six fractional digits (plain timestamp without an offset) or the pre-362 ISO form.
  for(const value of ['2026-01-01 00:00:00.123456+00','2026-01-01 00:00:00+00','2026-01-01 00:00:00.5','2026-01-01 00:00:00','2026-01-01 00:00:00.123456+05:30','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00+00:00']){
    const ok=structuredClone(page);ok.rows[0].last_synced_at=value;assert.doesNotThrow(()=>q.assertOutput(ok,publicQuery),value);
  }
  for(const value of ['2026-01-01 00:00:00.1234567+00','2026-01-01','2026-01-01 00:00','01/01/2026 00:00:00','2026-01-01 25:00:00+00','2026-01-01T00:00:00',1735689600,'']){
    const bad=structuredClone(page);bad.rows[0].last_synced_at=value;assert.throws(()=>q.assertOutput(bad,publicQuery),String(value));
  }
});
