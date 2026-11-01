/** Model-facing read descriptions: family coverage, result states and SQL-first routing, within the SDK text budget. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {READ_FAMILIES} from '../families.mjs';
import {READ_FAMILY_GUIDANCE,READ_FAMILY_GUIDANCE_IDS,GUIDANCE_LIMITS,RESULT_STATE_GUIDANCE,SQL_FIRST_GUIDANCE,SQL_ABSENT_GUIDANCE} from '../family-guidance.mjs';
import {describeRead,domainLimitations,MAX_DESCRIPTION} from '../tools.mjs';
import {familyReads} from '../availability.mjs';
import {READ_FAILURE_CODES} from '../results.mjs';
const rows=familyReads();

test('guidance is a closed, bounded set equal to the mounted read families',()=>{
 assert.deepEqual([...READ_FAMILY_GUIDANCE_IDS].sort(),Object.keys(READ_FAMILIES).sort());
 for(const [family,guidance] of Object.entries(READ_FAMILY_GUIDANCE)){
  assert.ok(Object.isFrozen(guidance),family);
  for(const key of ['covers','returns','states'])assert.ok(typeof guidance[key]==='string'&&guidance[key].length>20&&guidance[key].length<=GUIDANCE_LIMITS[key],`${family}.${key}`);
  assert.equal(typeof guidance.structured,'boolean',family);
 }
});
test('every mounted read describes what it covers, returns and how its result declares absent, partial and stale data',()=>{
 for(const row of rows)for(const sqlPrimary of [true,false]){
  const d=row.descriptor,text=describeRead(d,row.family,{sqlPrimary}),guidance=READ_FAMILY_GUIDANCE[row.family];
  assert.ok(text.startsWith(`${d.displayName}. ${d.whenToUse}`),row.operation.id);
  assert.ok(text.includes(`Covers: ${guidance.covers}`)&&text.includes(`Returns: ${guidance.returns}`)&&text.includes(`Result states: ${guidance.states}`),row.operation.id);
  assert.ok(text.includes(d.inputSchema.sha256)&&text.endsWith('Supply literal arguments only; credentials and scope authority remain with the gateway.'),row.operation.id);
  assert.ok(text.length<=MAX_DESCRIPTION,`${row.operation.id} ${text.length}`);
  for(const line of text.split('\n'))assert.ok(line.length>0,row.operation.id);
 }
});
test('structured families route counts and filters to text-to-SQL first only when both SQL tools are mounted',()=>{
 const structured=rows.filter(row=>READ_FAMILY_GUIDANCE[row.family].structured),narrative=rows.filter(row=>!READ_FAMILY_GUIDANCE[row.family].structured);
 assert.ok(structured.some(row=>row.family==='federal-market')&&structured.some(row=>row.family==='program-elements')&&structured.some(row=>row.family==='bill-text'));
 assert.ok(narrative.some(row=>row.family==='public-web')&&narrative.some(row=>row.family==='mail')&&narrative.some(row=>row.family==='graph-paths'));
 for(const row of structured){
  assert.ok(describeRead(row.descriptor,row.family,{sqlPrimary:true}).includes(SQL_FIRST_GUIDANCE),row.operation.id);
  assert.ok(describeRead(row.descriptor,row.family,{sqlPrimary:false}).includes(SQL_ABSENT_GUIDANCE),row.operation.id);
 }
 for(const row of narrative)for(const sqlPrimary of [true,false])assert.doesNotMatch(describeRead(row.descriptor,row.family,{sqlPrimary}),/Structured questions:/u,row.operation.id);
 assert.match(SQL_FIRST_GUIDANCE,/describe_capiro_data first and query_capiro_data/u);
});
test('registration-era catalog limitations never reach the model; data limitations still do',()=>{
 const stale=/null handler|Pending (?:private )?contract only|no enabled source|remains? unqualified/iu;
 for(const row of rows){
  const text=describeRead(row.descriptor,row.family,{sqlPrimary:true});
  assert.doesNotMatch(text,stale,row.operation.id);
  for(const limitation of domainLimitations(row.descriptor).slice(0,4))assert.ok(text.includes(limitation)||text.length>MAX_DESCRIPTION-limitation.length,row.operation.id);
 }
 const market=rows.find(row=>row.operation.id==='search_federal_contract_awards').descriptor;
 assert.equal(domainLimitations(market).length,2);assert.equal(market.limitations.length,5);
});
test('the shared result-state vocabulary names every closed failure meaning the server can return',()=>{
 for(const code of ['ACCESS_DENIED','UNAVAILABLE','SOURCE_UNAVAILABLE','INVALID_RESULT'])assert.ok(RESULT_STATE_GUIDANCE.includes(code),code);
 assert.ok(READ_FAILURE_CODES.includes('SOURCE_UNAVAILABLE'));
 assert.match(RESULT_STATE_GUIDANCE,/empty list is absence inside that page, window and source set, never proof of global absence/u);
});
test('an unknown family cannot be described',()=>{
 assert.throws(()=>describeRead(rows[0].descriptor,'no-such-family',{sqlPrimary:false}),{code:'READ_GUIDANCE_CONFIGURATION'});
});
