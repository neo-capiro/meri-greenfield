/** The two SQL descriptors render with every optional line: nothing the catalog says about text-to-SQL is dropped. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {familyReads} from '../availability.mjs';
import {describeRead,domainLimitations,MAX_DESCRIPTION} from '../tools.mjs';

test('the SQL descriptors fit MAX_DESCRIPTION with their limits and negative examples, so no line is dropped',()=>{
 assert.equal(MAX_DESCRIPTION,4096);
 const rows=familyReads().filter(row=>['describe_capiro_data','query_capiro_data'].includes(row.operation.id)&&row.operation.version==='0.3.0');
 assert.equal(rows.length,2);
 for(const row of rows)for(const sqlPrimary of [true,false]){
  const d=row.descriptor,text=describeRead(d,row.family,{sqlPrimary});
  assert.ok(text.length<=MAX_DESCRIPTION,`${row.operation.id} renders ${text.length} characters`);
  assert.ok(text.includes(`Limits: ${domainLimitations(d).slice(0,4).join(' ')}`),`${row.operation.id} keeps its limits`);
  for(const example of d.negativeExamples)assert.ok(text.includes(`Do not: ${example}`),`${row.operation.id} keeps its negative examples`);
 }
 // The PostgreSQL contract of query_capiro_data@0.3.0 is why the cap is 4096 and not 2600.
 const query=rows.find(row=>row.operation.id==='query_capiro_data');
 assert.ok(describeRead(query.descriptor,query.family,{sqlPrimary:true}).length>2600);
});
