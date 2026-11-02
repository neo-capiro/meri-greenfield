/** The two SQL descriptors render with every optional line: nothing the catalog says about text-to-SQL is dropped, except
 * the registration-era limitations that Meri's operational SQL limitations replace (the catalog's "unknown (null) freshness"
 * made the 2 November answer say the government forecasts' freshness was not recorded). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {familyReads} from '../availability.mjs';
import {describeRead,domainLimitations,MAX_DESCRIPTION} from '../tools.mjs';
import {userVocabulary} from '../../user-vocabulary.mjs';
import {readGuidance} from '../guidance.mjs';

test('the SQL descriptors fit MAX_DESCRIPTION with their limits and negative examples, so no line is dropped',()=>{
 assert.equal(MAX_DESCRIPTION,4096);
 const rows=familyReads().filter(row=>['describe_capiro_data','query_capiro_data'].includes(row.operation.id)&&row.operation.version==='0.3.0');
 assert.equal(rows.length,2);
 for(const row of rows)for(const sqlPrimary of [true,false]){
  const d=row.descriptor,text=describeRead(d,row.family,{sqlPrimary});
  assert.ok(text.length<=MAX_DESCRIPTION,`${row.operation.id} renders ${text.length} characters`);
  const limits=readGuidance(row.operation.id).limitations;assert.equal(limits.length,4);
  assert.ok(text.includes(userVocabulary(`Limits: ${limits.join(' ')}`)),`${row.operation.id} keeps its limits`);
  assert.ok(domainLimitations(d).some(l=>/unknown \(null\) freshness/.test(l)),'the catalog still carries the replaced limitation');
  assert.doesNotMatch(text,/unknown \(null\) freshness/);assert.match(text,/freshness field, when describe lists one, records when Capiro last checked or synchronized its source/);
  for(const example of d.negativeExamples)assert.ok(text.includes(userVocabulary(`Do not: ${example}`)),`${row.operation.id} keeps its negative examples`);
 }
 // The PostgreSQL contract of query_capiro_data@0.3.0 is why the cap is 4096 and not 2600.
 const query=rows.find(row=>row.operation.id==='query_capiro_data');
 assert.ok(describeRead(query.descriptor,query.family,{sqlPrimary:true}).length>2600);
});
