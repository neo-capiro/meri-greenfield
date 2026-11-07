/** Model-facing read descriptions: family coverage, result states and SQL-first routing, within the SDK text budget. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {READ_FAMILIES} from '../families.mjs';
import {READ_FAMILY_GUIDANCE,READ_FAMILY_GUIDANCE_IDS,GUIDANCE_LIMITS,RESULT_STATE_GUIDANCE,SQL_FIRST_GUIDANCE,SQL_ABSENT_GUIDANCE} from '../family-guidance.mjs';
import {describeRead,domainLimitations,MAX_DESCRIPTION,SQL_TOOL_IDS} from '../tools.mjs';
import {userVocabulary} from '../../user-vocabulary.mjs';
import {readGuidance} from '../guidance.mjs';
import {sdkToolName} from '../../skills/mcp.mjs';
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
  // The frozen descriptor words reach the model projected into the user's vocabulary.
  assert.ok(text.startsWith(userVocabulary(`${d.displayName}. ${d.whenToUse}`)),row.operation.id);
  assert.ok(text.includes(`Covers: ${guidance.covers}`)&&text.includes(`Returns: ${guidance.returns}`)&&text.includes(`Result states: ${guidance.states}`),row.operation.id);
  assert.ok(text.includes(d.inputSchema.sha256)&&text.endsWith('Supply literal arguments only; identity, permissions and client selection come from the trusted run, never from arguments.'),row.operation.id);
  assert.ok(text.length<=MAX_DESCRIPTION,`${row.operation.id} ${text.length}`);
  for(const line of text.split('\n'))assert.ok(line.length>0,row.operation.id);
 }
});
test('structured families route counts and filters to text-to-SQL first only when both SQL tools are mounted',()=>{
 const structured=rows.filter(row=>READ_FAMILY_GUIDANCE[row.family].structured),narrative=rows.filter(row=>!READ_FAMILY_GUIDANCE[row.family].structured);
 assert.ok(structured.some(row=>row.family==='federal-market')&&structured.some(row=>row.family==='program-elements')&&structured.some(row=>row.family==='bill-text'));
 assert.ok(narrative.some(row=>row.family==='public-web')&&narrative.some(row=>row.family==='mail')&&narrative.some(row=>row.family==='graph-paths'));
 for(const row of structured.filter(row=>!SQL_TOOL_IDS.has(row.operation.id))){
  assert.ok(describeRead(row.descriptor,row.family,{sqlPrimary:true}).includes(SQL_FIRST_GUIDANCE),row.operation.id);
  assert.ok(describeRead(row.descriptor,row.family,{sqlPrimary:false}).includes(SQL_ABSENT_GUIDANCE),row.operation.id);
 }
 // The two SQL tools are the destination of that routing sentence, so they never carry it themselves.
 const sqlRows=structured.filter(row=>SQL_TOOL_IDS.has(row.operation.id));assert.ok(sqlRows.length>=2);
 for(const row of [...narrative,...sqlRows])for(const sqlPrimary of [true,false])assert.doesNotMatch(describeRead(row.descriptor,row.family,{sqlPrimary}),/Structured questions:/u,row.operation.id);
 assert.match(SQL_FIRST_GUIDANCE,/describe_capiro_data first and query_capiro_data/u);
});
test('registration-era catalog limitations never reach the model; data limitations still do',()=>{
 const stale=/null handler|Pending (?:private )?contract only|no enabled source|remains? unqualified/iu;
 for(const row of rows){
  const text=describeRead(row.descriptor,row.family,{sqlPrimary:true});
  assert.doesNotMatch(text,stale,row.operation.id);
  const operational=readGuidance(sdkToolName(row.operation));
  const limits=(operational?.limitations.length?operational.limitations:domainLimitations(row.descriptor)).slice(0,4);
  if(limits.length){const line=userVocabulary(`Limits: ${limits.join(' ')}`);assert.ok(text.includes(line)||text.length+line.length+1>MAX_DESCRIPTION,`${row.operation.id}: limits are shown unless they cannot fit`);}
 }
 const market=rows.find(row=>row.operation.id==='search_federal_contract_awards').descriptor;
 assert.equal(domainLimitations(market).length,2);assert.equal(market.limitations.length,5);
});
test('the shared result-state vocabulary names every closed failure meaning the server can return, in user terms',()=>{
 for(const meaning of ['refused as not permitted (for this user, client or conversation) is not absent data','not connected here is not absent data','did not answer this call is not an empty result','withheld malformed result is not evidence'])assert.ok(RESULT_STATE_GUIDANCE.includes(meaning),meaning);
 assert.doesNotMatch(RESULT_STATE_GUIDANCE,/UNAVAILABLE|ACCESS_DENIED|INVALID_RESULT/u,'codes never reach the instructions the model repeats');
 assert.ok(READ_FAILURE_CODES.includes('SOURCE_UNAVAILABLE'));
 assert.match(RESULT_STATE_GUIDANCE,/empty list is absence inside that page, window and source set, never proof of global absence/u);
});
test('an unknown family cannot be described',()=>{
 assert.throws(()=>describeRead(rows[0].descriptor,'no-such-family',{sqlPrimary:false}),{code:'READ_GUIDANCE_CONFIGURATION'});
});

test('program element guidance names the loaded funding data and refuses to estimate unpopulated budget positions',()=>{
 const pe=READ_FAMILY_GUIDANCE['program-elements'];
 assert.match(pe.covers,/by federal fiscal year and stage \(request, HASC\/SASC and HAC-D\/SAC-D marks, NDAA conference, enacted\)/u);
 assert.match(pe.returns,/USD millions per federal FY and stage/u);
 assert.match(pe.states,/an absent stage is not loaded, not zero/u);
 assert.match(pe.states,/budget-position table unpopulated, say amounts are not loaded; give funding by FY from the timeline or program_element_years; never estimate/u);
 for(const [key,limit] of Object.entries(GUIDANCE_LIMITS))assert.ok(pe[key].length<=limit,key);
});
