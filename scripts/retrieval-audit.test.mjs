/** The reconciliation table in docs/RETRIEVAL-AUDIT.md is derived, not hand-maintained: it must equal the generator. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditRows,auditTable} from './retrieval-audit.mjs';
import {READ_FAMILIES} from '../apps/worker/conversation/reads/families.mjs';
import {READ_FAMILY_GUIDANCE_IDS} from '../apps/worker/conversation/reads/family-guidance.mjs';

test('every mounted read family has a handler, validated output, tests and model-facing guidance',()=>{
 const rows=auditRows(),mounted=rows.filter(row=>Object.hasOwn(READ_FAMILIES,row.family));
 assert.deepEqual(mounted.map(row=>row.family).sort(),Object.keys(READ_FAMILIES).sort());
 for(const row of mounted){
  assert.match(row.handler,/^gateway module; worker mount/u,row.family);
  assert.equal(row.validated,true,row.family);
  assert.ok(row.tests.every(count=>count>0),`${row.family} has an operation no test references`);
  assert.notEqual(row.guidance,'none',row.family);
 }
 // the only read groups without a gateway family are the schedule reads, which another mount serves
 assert.deepEqual(rows.filter(row=>!Object.hasOwn(READ_FAMILIES,row.family)).map(row=>row.family),['schedule-tools','schedule-tools-v3']);
 assert.deepEqual([...READ_FAMILY_GUIDANCE_IDS].sort(),Object.keys(READ_FAMILIES).sort(),'guidance is a closed set equal to the mounted families');
});
test('docs/RETRIEVAL-AUDIT.md carries the current derived table verbatim',()=>{
 const document=readFileSync(new URL('../docs/RETRIEVAL-AUDIT.md',import.meta.url),'utf8');
 assert.ok(document.includes(auditTable()),'regenerate the table with `node scripts/retrieval-audit.mjs` and paste it into docs/RETRIEVAL-AUDIT.md');
});
