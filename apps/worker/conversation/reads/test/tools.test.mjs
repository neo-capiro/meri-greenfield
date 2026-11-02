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
 // Every shipped version (0.2.0-0.5.0): query_capiro_data@0.5.0 is the longest.
 const rows=familyReads().filter(row=>['describe_capiro_data','query_capiro_data'].includes(row.operation.id));
 assert.deepEqual([...new Set(rows.map(row=>row.operation.version))].sort(),['0.2.0','0.3.0','0.4.0','0.5.0']);assert.equal(rows.length,8);
 for(const row of rows)for(const sqlPrimary of [true,false]){
  const d=row.descriptor,text=describeRead(d,row.family,{sqlPrimary});
  assert.ok(text.length<=MAX_DESCRIPTION,`${row.operation.id}@${row.operation.version} renders ${text.length} characters`);
  const limits=readGuidance(row.operation.id).limitations;assert.equal(limits.length,4);
  assert.ok(text.includes(userVocabulary(`Limits: ${limits.join(' ')}`)),`${row.operation.id} keeps its limits`);
  // 0.3.0 and 0.5.0 say "unknown (null) freshness", 0.2.0 and 0.4.0 "unknown source freshness/version is null".
  const replaced=/unknown (\(null\) freshness|source freshness\/version is null)/;
  assert.ok(domainLimitations(d).some(l=>replaced.test(l)),'the catalog still carries the replaced limitation');
  assert.doesNotMatch(text,replaced);assert.match(text,/A public data set's freshness field records when Capiro last checked or synchronized its source; a private one \(updated_at, created_at\) is the latest record change/);
  for(const example of d.negativeExamples)assert.ok(text.includes(userVocabulary(`Do not: ${example}`)),`${row.operation.id} keeps its negative examples`);
 }
 // The PostgreSQL contract of query_capiro_data@0.3.0 is why the cap is 4096 and not 2600.
 const query=rows.find(row=>row.operation.id==='query_capiro_data'&&row.operation.version==='0.3.0');
 assert.ok(describeRead(query.descriptor,query.family,{sqlPrimary:true}).length>2600);
});
