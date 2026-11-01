/** Rendered SDK tool descriptions derive from catalog descriptors and never reach the slice. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {familyReads} from '../availability.mjs';
import {MAX_DESCRIPTION,readToolDescription} from '../tools.mjs';

test('every constructible read description fits the cap, so the model never sees a mid-sentence slice',()=>{
 assert.equal(MAX_DESCRIPTION,4096);
 const rows=familyReads();assert.ok(rows.length>100);
 for(const row of rows){
  const text=readToolDescription(row.descriptor);
  assert.ok(text.length<=MAX_DESCRIPTION,`${row.operation.id}@${row.operation.version} renders ${text.length} characters`);
  assert.ok(text.endsWith('Supply literal arguments only; credentials and scope authority remain with the gateway.'),row.operation.id);
 }
 // The PostgreSQL contract of query_capiro_data@0.3.0 is why the cap is 4096 and not 2048.
 const query=rows.find(row=>row.operation.id==='query_capiro_data'&&row.operation.version==='0.3.0');
 assert.ok(query);assert.ok(readToolDescription(query.descriptor).length>2048);
});
