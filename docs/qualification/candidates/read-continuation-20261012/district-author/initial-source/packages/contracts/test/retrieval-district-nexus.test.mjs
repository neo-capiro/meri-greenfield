import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertSubject} from '../retrieval-0.2/validate.mjs';
import {createDistrictNexusValidators} from '../retrieval-0.2/district-nexus-validation.mjs';

// Test-only compiler until the canonical root owner registers this family.
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const schema=read('../retrieval-0.2/district-nexus.schema.json');
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
ajv.addSchema(read('../meri.schema.json'));ajv.addSchema(read('../retrieval-0.2/common.schema.json'));ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const validateShape=(name,value)=>{const check=checks.get(name);assert.ok(check(value),ajv.errorsText(check.errors));return value;};
const {normalizeDistrictNexusInput:normalize,assertDistrictNexusReadResult:check}=
  createDistrictNexusValidators({validateShape,assertSubject,canonicalSha256});
const CONTEXT='get_district_nexus_context', CHANGES='get_district_nexus_changes';
const UUID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const NOW='2026-10-12T00:00:00.000Z',OLDER='2026-10-11T00:00:00.000Z';
const input=()=>({clientId:'client-one',state:'FL',district:'08'});
const context=()=>({
  binding:{tenantId:'synthetic',actorId:'reader',conversationId:UUID,runId:UUID,attemptId:UUID,workerId:UUID,writerFence:1},
  subject:{kind:'client',entityType:'client',entityIds:['client-one'],tenantId:'synthetic',actorId:'reader',
    authorizationDecisionId:UUID,policyRevision:'synthetic-policy',rosterVersionId:null,
    scopes:[{tenantId:'synthetic',kind:'client',resourceId:'client-one',policyRevision:'synthetic-policy'}]},
});
const fact=()=>({id:'cpf_cds:requested:synthetic',section:'cpf_cds',label:'Synthetic request',value:0,unit:'USD',
  amountStage:'requested',basis:'public_context',
  source:{type:'cpf_cds',label:'Synthetic source',recordId:'synthetic',url:null},
  asOf:{date:null,fiscalYear:2027,sourceYear:null},
  geography:{state:'FL',district:'08',scope:'district',basis:null,boundaryCongress:null},
  freshness:{lastSyncedAt:null,stale:true,unavailable:true},coverage:'unknown',caveats:['Source not qualified']});
const gap=()=>({section:'opportunities',reason:'Source coverage unavailable',source:'synthetic-source'});
const change=()=>({changeKind:'request_updated',source:'cpf_cds',sourceRecordId:'synthetic',observedAt:NOW,effectiveAt:null,severity:'notable'});
const detail=()=>({...context(),data:{available:true,...input(),clientName:'Synthetic client',generatedAt:NOW,facts:[fact()],gaps:[gap()],truncated:false}});
const changes=()=>({...context(),data:{available:true,...input(),generatedAt:NOW,changes:[change()],gaps:[],truncated:false}});
const disabled=()=>({...context(),data:{available:false,reason:'feature_disabled'}});

test('requires explicit client and normalizes state/district without mutating input/context',()=>{
  const raw={clientId:' client-one ',state:' fl ',district:' 08 '},ctx=context(),before=structuredClone(ctx);
  assert.deepEqual(normalize(CONTEXT,raw,ctx),input());assert.equal(raw.state,' fl ');assert.deepEqual(ctx,before);
  assert.deepEqual(normalize(CHANGES,input(),ctx),{...input(),since:null});
  assert.throws(()=>normalize(CONTEXT,{state:'FL',district:'08'},ctx));
});
test('since preserves inclusive instant and producer parseable ISO-prefix grammar',()=>{
  assert.equal(normalize(CHANGES,{...input(),since:'2026-10-11T20:00:00-04:00'},context()).since,NOW);
  for(const since of [null,'',4,'2026-10-12',' 2026-10-12T00:00:00Z','invalid','2016-12-31T23:59:60Z'])
    assert.throws(()=>normalize(CHANGES,{...input(),since},context()));
  assert.throws(()=>normalize(CONTEXT,{...input(),since:NOW},context()));
});
test('geography grammar preserves at-large and does not assert a recognized-state crosswalk',()=>{
  assert.deepEqual(normalize(CONTEXT,{...input(),state:' zz ',district:'00'},context()),{...input(),state:'ZZ',district:'00'});
  for(const raw of [{state:'Florida'},{state:'1A'},{district:'8'},{district:8},{district:'008'},{district:'-1'},{clientId:' '}])
    assert.throws(()=>normalize(CONTEXT,{...input(),...raw},context()));
});
test('raw selectors cannot choose a foreign client or inject authority/limits/cursor',()=>{
  for(const raw of [{clientId:'other'},{clientId:null},{actorId:'reader'},{tenantId:'synthetic'},{role:'admin'},
    {limit:20},{cursor:'opaque'},{available:true},{subject:context().subject},{flags:{district_nexus_v2:true}}])
    assert.throws(()=>normalize(CHANGES,{...input(),...raw},context()));
});
test('context is closed canonical lineage with one selected client',()=>{
  for(const ctx of [{},null,{...context(),nowMs:1},{...context(),authorized:true},
    {...context(),subject:{...context().subject,kind:'entity'}},
    {...context(),subject:{...context().subject,entityIds:['client-one','client-two']}},
    {...context(),subject:{...context().subject,actorId:'other'}},
    {...context(),subject:{...context().subject,tenantId:'other'}}])
    assert.throws(()=>normalize(CONTEXT,input(),ctx));
});
test('both operations preserve the closed disabled result',()=>{
  for(const op of [CONTEXT,CHANGES]) {const page=disabled();assert.equal(check(op,page,input(),context()),page);}
  for(const extra of [{reason:'permission_denied'},{facts:[]},{clientId:'client-one'},{available:true}]){
    const page=disabled();Object.assign(page.data,extra);assert.throws(()=>check(CONTEXT,page,input(),context()));
  }
});
test('available context and changes retain their exact nonempty projection',()=>{
  for(const [op,page] of [[CONTEXT,detail()],[CHANGES,changes()]]){
    const before=structuredClone(page);assert.equal(check(op,page,input(),context()),page);assert.deepEqual(page,before);
  }
  assert.throws(()=>check(CONTEXT,changes(),input(),context()));
  assert.throws(()=>check(CHANGES,detail(),input(),context()));
});
test('fact stages, zero/null and source coverage remain distinct reported values',()=>{
  for(const stage of ['requested','enacted','obligated','awarded','forecast',null]){
    const page=detail();page.data.facts[0].amountStage=stage;check(CONTEXT,page,input(),context());
  }
  for(const coverage of ['complete','partial','unknown']){
    const page=detail();page.data.facts[0].coverage=coverage;page.data.facts[0].value=null;
    check(CONTEXT,page,input(),context());assert.equal(page.data.facts[0].value,null);
  }
  const page=detail();check(CONTEXT,page,input(),context());assert.equal(page.data.facts[0].value,0);
  page.data.facts[0].amountStage='spent';assert.throws(()=>check(CONTEXT,page,input(),context()));
});
test('all fact sections and basis values retain their typed provenance',()=>{
  for(const section of ['footprint','economic','opportunities','representation','cpf_cds','changes']){
    const page=detail();page.data.facts[0].section=section;
    page.data.facts[0].basis='verified_client_nexus';page.data.facts[0].value='Unverified reported value';
    check(CONTEXT,page,input(),context());
  }
  const page=detail();page.data.facts[0].basis='authorized';assert.throws(()=>check(CONTEXT,page,input(),context()));
});
test('nullable source/freshness fields and date-only source metadata are not fabricated',()=>{
  const page=detail();page.data.facts[0].source.recordId=null;page.data.facts[0].unit=null;
  page.data.facts[0].asOf.date='2026-10-11';page.data.facts[0].freshness.lastSyncedAt='2026-10-11';
  check(CONTEXT,page,input(),context());
  delete page.data.facts[0].freshness.unavailable;assert.throws(()=>check(CONTEXT,page,input(),context()));
});
test('fact geography permits statewide context but cannot replace the selected district',()=>{
  for(const district of [null,'08']){
    const page=detail();Object.assign(page.data.facts[0].geography,{scope:'statewide',district});
    check(CONTEXT,page,input(),context());
  }
  for(const fields of [{state:'CA'},{district:'09'},{district:null}]){
    const page=detail();Object.assign(page.data.facts[0].geography,fields);assert.throws(()=>check(CONTEXT,page,input(),context()));
  }
});
test('bounds context at 40 facts and 30 projected gaps',()=>{
  const page=detail();page.data.facts=Array.from({length:40},(_,i)=>({...fact(),id:`synthetic-${i}`}));
  check(CONTEXT,page,input(),context());page.data.facts.push(fact());assert.throws(()=>check(CONTEXT,page,input(),context()));
  const gaps=detail();gaps.data.gaps=Array.from({length:31},gap);assert.throws(()=>check(CONTEXT,gaps,input(),context()));
});
test('reported context truncation allows gap omission without imposing fact completeness',()=>{
  const page=detail();page.data.gaps=Array.from({length:29},gap);check(CONTEXT,page,input(),context());
  // This same projection may represent exactly30 original gaps: no completeness inference.
  assert.equal(page.data.truncated,false);page.data.truncated=true;check(CONTEXT,page,input(),context());
  page.data.facts=Array.from({length:40},fact);page.data.gaps.push({section:'footprint',reason:'1 facts omitted by tool output limit; consult the district page for full context',source:null});
  check(CONTEXT,page,input(),context());page.data.truncated=false;assert.throws(()=>check(CONTEXT,page,input(),context()));
});
test('changes respects 20-result truncation without inventing a 21st row/cursor/total',()=>{
  const page=changes();page.data.changes=Array.from({length:20},(_,i)=>({...change(),sourceRecordId:`record-${i}`}));
  page.data.truncated=true;check(CHANGES,page,input(),context());
  page.data.truncated=false;assert.throws(()=>check(CHANGES,page,input(),context()));
  page.data.truncated=true;page.data.changes.pop();assert.throws(()=>check(CHANGES,page,input(),context()));
  page.data.changes.push(change(),change());assert.throws(()=>check(CHANGES,page,input(),context()));
});
test('since is inclusive and observation order descending with ties allowed',()=>{
  const page=changes();page.data.changes.push({...change(),sourceRecordId:'other'});
  check(CHANGES,page,{...input(),since:NOW},context());
  page.data.changes[1].observedAt=OLDER;check(CHANGES,page,{...input(),since:OLDER},context());
  assert.throws(()=>check(CHANGES,page,{...input(),since:NOW},context()));
  page.data.changes.reverse();assert.throws(()=>check(CHANGES,page,input(),context()));
});
test('future effective dates and observations after generation are distinct reported timestamps',()=>{
  const page=changes();page.data.generatedAt=OLDER;page.data.changes[0].effectiveAt='2027-01-01T00:00:00Z';
  check(CHANGES,page,input(),context());
  for(const field of ['observedAt','effectiveAt']){
    const bad=changes();bad.data.changes[0][field]='2016-12-31T23:59:60Z';assert.throws(()=>check(CHANGES,bad,input(),context()));
  }
});
test('database string fields are bounded but no invented change/source/severity enum is imposed',()=>{
  const page=changes();Object.assign(page.data.changes[0],{changeKind:'new_source_event',source:'future_source',severity:'future_level'});
  check(CHANGES,page,input(),context());
  for(const [field,count] of [['changeKind',49],['source',33],['severity',17]]){
    const bad=changes();bad.data.changes[0][field]='x'.repeat(count);assert.throws(()=>check(CHANGES,bad,input(),context()));
  }
});
test('ledger failure is an available empty read with explicit gap, never absence proof',()=>{
  const page=changes();page.data.changes=[];
  page.data.gaps=[{section:'changes',reason:'Change ledger unavailable',source:'district_nexus_change'}];
  check(CHANGES,page,input(),context());
  page.data.changes=[change()];assert.throws(()=>check(CHANGES,page,input(),context()));
  page.data.changes=[];page.data.complete=true;assert.throws(()=>check(CHANGES,page,input(),context()));
});
test('changes gaps remain changes-only, bounded at30 and distinct from feature disabled',()=>{
  const page=changes();page.data.changes=[];page.data.gaps=Array.from({length:30},()=>({section:'changes',reason:'Unavailable',source:null}));
  check(CHANGES,page,input(),context());page.data.gaps.push(page.data.gaps[0]);assert.throws(()=>check(CHANGES,page,input(),context()));
  const bad=changes();bad.data.gaps=[gap()];assert.throws(()=>check(CHANGES,bad,input(),context()));
});
test('closed change projection omits baseline rows, values, tenant claims and unreturned source health',()=>{
  for(const field of ['observationKind','oldValue','newValue','id','dedupeKey','tenantId']){
    const page=changes();page.data.changes[0][field]=field==='observationKind'?'baseline':'injected';
    assert.throws(()=>check(CHANGES,page,input(),context()));
  }
  // Missing baseline discriminator is not independently authenticated by validation.
  const page=detail();page.data.sourceHealth=[];assert.throws(()=>check(CONTEXT,page,input(),context()));
});
test('available selectors and every current binding/subject member remain correlated',()=>{
  for(const field of ['clientId','state','district']){
    const page=detail();page.data[field]=field==='state'?'CA':field==='district'?'09':'other';
    assert.throws(()=>check(CONTEXT,page,input(),context()));
  }
  for(const field of Object.keys(context().binding)){
    const page=changes();page.binding[field]=field==='writerFence'?2:OTHER;
    assert.throws(()=>check(CHANGES,page,input(),context()));
  }
  for(const field of ['authorizationDecisionId','policyRevision']){
    const page=disabled();page.subject[field]='other';assert.throws(()=>check(CONTEXT,page,input(),context()));
  }
});
test('closed output rejects additional authority/absence/completeness claims at every boundary',()=>{
  for(const locate of [p=>p,p=>p.data,p=>p.data.facts[0],p=>p.data.facts[0].source,p=>p.data.facts[0].geography,
    p=>p.data.facts[0].freshness,p=>p.data.facts[0].asOf,p=>p.data.gaps[0]]){
    const page=detail();locate(page).authorized=true;assert.throws(()=>check(CONTEXT,page,input(),context()));
  }
  for(const field of ['complete','noChanges','baselineExcluded','flagsVerified','total','nextCursor']){
    const page=changes();page.data[field]=true;assert.throws(()=>check(CHANGES,page,input(),context()));
  }
});
test('canonical admission refuses getters/proxies without executing their effects',()=>{
  let effects=0;const hostile={get clientId(){effects++;return 'client-one';},state:'FL',district:'08'};
  assert.throws(()=>normalize(CONTEXT,hostile,context()));
  assert.throws(()=>normalize(CONTEXT,new Proxy(input(),{ownKeys(){effects++;return [];}}),context()));
  const page=detail();Object.defineProperty(page.data.facts[0],'value',{get(){effects++;return 0;},enumerable:true});
  assert.throws(()=>check(CONTEXT,page,input(),context()));assert.equal(effects,0);
});
test('canonical admission refuses symbols, prototypes, cycles, undefined and nonfinite fields',()=>{
  const cycle=detail();cycle.data.facts[0].value=cycle;
  const inherited=Object.create(input());
  const symbol={...input(),[Symbol('role')]:'admin'};
  for(const raw of [inherited,symbol,{...input(),extra:undefined}])assert.throws(()=>normalize(CONTEXT,raw,context()));
  for(const bad of [cycle,(()=>{const p=detail();p.data.facts[0].value=NaN;return p;})()])
    assert.throws(()=>check(CONTEXT,bad,input(),context()));
  assert.throws(()=>normalize('get_research_evidence',input(),context()));
});
