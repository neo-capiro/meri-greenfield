import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createLegislativeComparisonValidators} from '../../../../../packages/contracts/retrieval-0.2/legislative-comparisons-validation.mjs';
const require=createRequire(new URL('../../../../../packages/contracts/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js'),formats=require('ajv-formats');
const schema=JSON.parse(readFileSync(new URL('../../../../../packages/contracts/retrieval-0.2/legislative-comparisons.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true});formats(ajv);ajv.addSchema(schema);
const validators=createLegislativeComparisonValidators({validateShape(name,value){const valid=ajv.getSchema(`${schema.$id}#/$defs/${name}`);assert.ok(valid(value),JSON.stringify(valid.errors));}});
const {rows}=JSON.parse(readFileSync(new URL('./producer-pages.json',import.meta.url)));
const context={legiwatchReviewScope:{clientId:null,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64)}};
for(const row of rows)test(`${row.name}: actual canonical producer bytes survive the typed receiver`,()=>{
 const input=validators.normalizeInput(row.id,row.input,context).input;
 assert.deepEqual(validators.assertOutput(row.id,row.page,input,context),row.page);
});
test('wrong pair, numeric precision loss and selected-client context are refused',()=>{
 const row=rows[0];
 for(const mutate of [p=>p.data.left.sourceRevision='stale',p=>p.data.deltaMinorUnits=1,p=>p.selection.rightId='other']){
  const page=structuredClone(row.page);mutate(page);assert.throws(()=>validators.assertOutput(row.id,page,row.input,context));
 }
 assert.throws(()=>validators.normalizeInput(row.id,row.input,{legiwatchReviewScope:{...context.legiwatchReviewScope,clientId:'10000000-0000-4000-8000-000000000001'}}));
});
test('line provenance cannot be moved to the wrong side or use Unicode code-point offsets',()=>{
 const row=rows.find(r=>r.name==='versions');
 for(const mutate of [p=>p.data.changes[0].left.end--,p=>p.data.changes[0].left=null,p=>p.data.warning='enacted',p=>p.data.right.revision='stale']){
  const page=structuredClone(row.page);mutate(page);assert.throws(()=>validators.assertOutput(row.id,page,row.input,context));
 }
});
test('whole-envelope UTF8 size is bounded and no truncation is silently accepted',()=>{
 const row=rows[0],page=structuredClone(row.page);page.data.left.locator='界'.repeat(90000);
 assert.throws(()=>validators.assertOutput(row.id,page,row.input,context));
 const extra=structuredClone(row.page);extra.byteTruncated=true;
 assert.throws(()=>validators.assertOutput(row.id,extra,row.input,context));
});
test('cross-session intent and effect/authority arguments are closed',()=>{
 const row=rows.find(r=>r.name==='versions');
 for(const extra of [{rightSessionKey:'2028'},{apply:true},{tenantId:'invented'},{url:'https://other.invalid'}])
  assert.throws(()=>validators.normalizeInput(row.id,{...row.input,...extra},context));
});
