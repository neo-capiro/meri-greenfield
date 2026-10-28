import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_WORK_ITEMS,WORK_ENTRIES,WORK_JOB_KINDS,WORK_SELECTION_SCHEMA,assertWorkSelection} from '../work-selection.mjs';
const brief={entry:'start-work',jobKind:'research',deliverables:['Find the current bill text'],dependencies:[]};
const each=fn=>{for(const entry of WORK_ENTRIES)for(const jobKind of WORK_JOB_KINDS)fn({...brief,entry,jobKind});};
const throws=value=>assert.throws(()=>assertWorkSelection(value),/WORK_SELECTION/);

test('all eight entry and four job-kind combinations are admitted as frozen data',()=>{
 each(value=>{const accepted=assertWorkSelection(value);assert.deepEqual(accepted,value);assert.ok(Object.isFrozen(accepted));
  assert.ok(Object.isFrozen(accepted.deliverables)&&Object.isFrozen(accepted.dependencies));});
 assert.equal(WORK_ENTRIES.length,2);assert.equal(WORK_JOB_KINDS.length,4);
 assert.deepEqual([...WORK_JOB_KINDS],['research','deliverable','audit','scheduled']);
});

test('scheduled is a product kind only: origin, consent, approval and tool authority are refused',()=>{
 const scheduled={...brief,entry:'delegate',jobKind:'scheduled',deliverables:[],dependencies:[]};
 assert.deepEqual(assertWorkSelection(scheduled),scheduled);
 for(const injected of [
  {scheduledOrigin:'cron'},{consentId:'c'},{hashPolicyRevision:'h'},{origin:'unattended'},
  {allowedTools:['*']},{capabilities:['browser']},{depth:'deep'},{concurrency:4},{budget:100},{approval:'pre-approved'},
  {tenantId:'other'},{runId:'r'},{clientId:'c'},{skillId:'s'},
 ]) throws({...scheduled,...injected});
});

test('malformed entries, kinds, lists and smuggling are refusals',()=>{
 for(const value of [null,undefined,{},[],'work',brief.entry,brief.deliverables,
  {...brief,entry:'start'},{...brief,entry:'Start-Work'},{...brief,jobKind:'classify'},{...brief,jobKind:'Research'},
  {entry:'start-work',jobKind:'research',deliverables:[]},
  {entry:'start-work',jobKind:'research',deliverables:[],dependencies:undefined},
  {...brief,deliverables:'one'},{...brief,deliverables:[1]},{...brief,deliverables:['']},{...brief,deliverables:['  ']},
  {...brief,deliverables:['same','same']},{...brief,deliverables:new Array(2)},
  {...brief,deliverables:['x'.repeat(201)]},
  {...brief,dependencies:['d','d']},{...brief,deliverables:Array.from({length:MAX_WORK_ITEMS+1},(_,i)=>'d'+i)},
 ]) throws(value);
});

test('accessor and inherited authority never execute and never pass',()=>{
 let reads=0;
 const accessor={...brief};Object.defineProperty(accessor,'jobKind',{enumerable:true,get(){reads++;return 'research';}});
 throws(accessor);assert.equal(reads,0);
 throws(Object.assign(Object.create({entry:'delegate',jobKind:'scheduled'}),brief));
 throws(Object.assign(Object.create({allowedTools:['*']}),brief));
 const listAccessor={...brief};Object.defineProperty(listAccessor,'deliverables',{enumerable:true,get(){reads++;return ['x'];}});
 throws(listAccessor);assert.equal(reads,0);
});

test('the published schema is closed and names exactly the agreed four fields',()=>{
 assert.equal(WORK_SELECTION_SCHEMA.additionalProperties,false);
 assert.deepEqual([...WORK_SELECTION_SCHEMA.required].sort(),['deliverables','dependencies','entry','jobKind']);
 assert.deepEqual([...WORK_SELECTION_SCHEMA.properties.entry.enum],['start-work','delegate']);
 assert.deepEqual([...WORK_SELECTION_SCHEMA.properties.jobKind.enum],['research','deliverable','audit','scheduled']);
 assert.equal(WORK_SELECTION_SCHEMA.properties.deliverables.maxItems,MAX_WORK_ITEMS);
});
