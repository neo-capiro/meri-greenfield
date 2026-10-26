/** New wire only; the legacy QuerySpec schema and normalizer remain unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {capiroDataPage,requests} from '../../../apps/gateway/sources/capiro-data/test/fixture.mjs';
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
