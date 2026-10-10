import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canonicalSha256, validateShape as oldShape } from '../validate.mjs';
import { validateShape, assertWindow, assertWindowResolution, assertSubject, assertCatalog, assertEvidence, assertSkillManifest, assertSkillPin, assertSkillContinuity } from '../retrieval-0.2/validate.mjs';

// Every enabled descriptor below is synthetic fixture metadata. No handler is
// imported/executed and no actual operation/skill is qualified by this suite.
const ledger = JSON.parse(readFileSync(new URL('../../../docs/coordination/r2/capabilities.json', import.meta.url)));
const skills = JSON.parse(readFileSync(new URL('../../../docs/coordination/r2/skills.json', import.meta.url)));
const scope = () => ({tenantId:'synthetic-a',kind:'client',resourceId:'client-a',policyRevision:'policy-1'});
const binding = () => ({tenantId:'synthetic-a',actorId:'actor-a',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1});
const subject = () => ({kind:'client',entityType:'client',entityIds:['client-a'],tenantId:'synthetic-a',actorId:'actor-a',authorizationDecisionId:randomUUID(),policyRevision:'policy-1',scopes:[scope()],rosterVersionId:null});
const window = () => ({basis:'calendar-week',startInclusive:'2026-03-02T05:00:00Z',endExclusive:'2026-03-09T04:00:00Z',timezone:'America/New_York',weekStartsOn:'monday'});
const sourceRequirement = () => ({sourceId:'mail',authority:'authoritative',purpose:'enumeration'});
const operationRef = () => ({id:'synthetic.mail.count',version:'1.0.0'});
const descriptor = () => ({operation:operationRef(),displayName:'Synthetic mailbox count',whenToUse:'Count a fixture after trusted authorization',limitations:['Synthetic; no live handler'],positiveExamples:['How many fixture records?'],negativeExamples:['Read full message body'],sourceRequirements:[sourceRequirement()],inputSchema:{id:'urn:meri:synthetic:count-input:1',sha256:'a'.repeat(64)},outputSchema:{id:'urn:meri:synthetic:count-output:1',sha256:'b'.repeat(64)},aliases:[],sideEffect:'none',requiredGrants:['tool.read'],approvalBoundary:'none',handler:{module:'synthetic/fixture.mjs',export:'read_count',sourceSha256:'c'.repeat(64)},availability:'enabled',qualification:'qualified',retry:{maxRetries:0,retryableCodes:[],unknownOutcome:'reconcile-before-retry'},replacement:null,requirementIds:['R-01','R-05'],ticketIds:['REL-02'],gateIds:['RG-05'],fixtureIds:['synthetic.count']});
const catalog = () => ({contractVersion:'0.2.0',catalogId:'synthetic',catalogVersion:'1.0.0',sourceRegistryCommit:'fd8765ec01d292013758606204f2c9d886cd31c1',originals:ledger.records.map(row=>({id:row.fields.ID,disposition:row.acceptedScope.disposition,boundary:row.acceptedScope.boundary,replacement:null,state:row.acceptedScope.disposition==='selected'?'pending':'deferred'})),operations:[descriptor()]});
const envelope = () => ({contractVersion:'0.2.0',requestId:randomUUID(),traceId:randomUUID(),operation:operationRef(),binding:binding(),subject:subject(),window:window(),argumentsSha256:'d'.repeat(64),appliedFilters:[],method:'exact',status:'empty',reasonCode:'NO_MATCH',retryable:false,sources:[{sourceId:'mail',authority:'authoritative',snapshotVersionId:'mail-v1',adapterVersion:'1.0.0',status:'checked',synchronizedAt:'2026-03-09T05:00:00Z',asOf:'2026-03-09T05:00:00Z',retrievedAt:'2026-03-09T05:01:00Z',freshness:'fresh'}],data:{kind:'count',value:0},coverage:{sourcesRequested:['mail'],sourcesChecked:['mail'],sourcesUnavailable:[],enumeration:'complete',enumerableTotal:0,returnedCount:1,truncated:false,historySupport:'supported',limitations:[]},continuation:{cursor:null,requiredReads:[],remainingSources:[]},negativeAssertion:{kind:'absence',sourceIds:['mail'],predicateSha256:'e'.repeat(64)}});
const record = () => ({sourceId:'mail',recordId:'message-1',recordVersionId:'message-v1',citationId:randomUUID(),contentSha256:'f'.repeat(64),scopes:[scope()],content:{kind:'full-read',text:'Synthetic complete decisive passage.'}});
const manifest = () => ({contractVersion:'0.2.0',skillId:'quick_skill.relationship_brief',skillVersion:'1.0.0',prose:{id:'urn:meri:synthetic:skill-prose:1',sha256:'a'.repeat(64)},requiredSources:[sourceRequirement()],allowedOperations:[operationRef()],subjectKinds:['client'],windowBases:['calendar-week'],completion:{requireAllSources:true,allowDisclosedPartial:true,negativeClaims:'complete-covered-only',rubric:[{id:'evidence',requirement:'Cite required source and disclose limits',evidenceRequired:true}]},approval:{mutations:'separate-immutable-proposal',autoCreateTasks:false},budgets:{maxTurns:4,maxToolCalls:4,maxRecoveryAttempts:1,maxRuntimeSeconds:30,maxCostMicroUSD:1000,maxOutputBytes:10000},versionPolicy:{existingRuns:'pin-immutable',resume:'exact-or-explicit-migration',fork:'preserve-unless-explicit-reselection'}});
const pin = (m,c) => ({contractVersion:'0.2.0',invocationId:randomUUID(),skillId:m.skillId,skillVersion:m.skillVersion,manifestSha256:canonicalSha256(m),catalogSha256:canonicalSha256(c),subject:subject(),window:window()});

test('preserves all139 native IDs and exact accepted96/43 selections',()=>{
  const c=catalog();assertCatalog(c);
  assert.equal(new Set(c.originals.map(row=>row.id)).size,139);
  assert.equal(c.originals.filter(row=>row.disposition==='selected').length,96);
  assert.equal(c.originals.filter(row=>row.disposition==='deferred').length,43);
  const wrong=catalog();wrong.originals.find(row=>row.id==='get_research_portfolio').disposition='deferred';assert.throws(()=>assertCatalog(wrong));
  const duplicate=catalog();duplicate.originals[0]={...duplicate.originals[1],boundary:'changed duplicate'};assert.throws(()=>assertCatalog(duplicate),/Duplicate/);
  const unknown=catalog();unknown.originals[0].id='invented_tool';assert.throws(()=>assertCatalog(unknown));
});
test('rejects missing/contradictory mappings and unavailable handlers',()=>{
  for(const mutate of [c=>c.originals[0].replacement=operationRef(),c=>c.originals[1].state='mapped',c=>c.operations[0].handler=null,c=>c.operations[0].qualification='pending',c=>c.operations[0].sideEffect='source-command',c=>c.operations[0].operation.id='query_data',c=>c.operations[0].handler.module='../escape.mjs']){
    const c=catalog();mutate(c);assert.throws(()=>assertCatalog(c));
  }
  const c=catalog();c.operations[0].aliases=['get_research_portfolio'];assert.throws(()=>assertCatalog(c),/Alias contradicts/);
  c.originals[1].replacement=operationRef();c.originals[1].state='mapped';assertCatalog(c);
});
test('rejects ambiguous aliases, canonical shadowing and replacement cycles',()=>{
  const c=catalog(),second=descriptor();second.operation.id='synthetic.other';c.operations.push(second);
  c.operations[0].aliases=['same'];second.aliases=['same'];assert.throws(()=>assertCatalog(c),/Ambiguous alias/);
  c.operations[0].aliases=[];second.aliases=['synthetic.mail.count'];assert.throws(()=>assertCatalog(c),/shadows/);
  second.aliases=[];c.operations[0].replacement=second.operation;second.replacement=operationRef();assert.throws(()=>assertCatalog(c),/Cyclic/);
});
test('distinguishes client/portfolio/personal identity and server lineage',()=>{
  assertSubject(subject(),binding());
  for(const mutate of [s=>s.tenantId='other',s=>s.scopes[0].policyRevision='stale',s=>s.kind='portfolio',s=>s.entityIds.push('client-b'),s=>s.kind='personal']){const s=subject();mutate(s);assert.throws(()=>assertSubject(s,binding()));}
  const p=subject();p.kind='portfolio';p.entityIds.push('client-b');p.rosterVersionId='roster-v1';assertSubject(p);
  assert.throws(()=>validateShape('SubjectRequest',{kind:'client',entityId:'client-a',tenantId:'injected'}));
  assert.throws(()=>validateShape('SubjectRequest',{kind:'portfolio',entityIds:['guessed-client']}));
});
test('accepts DST calendar week and explicit Monday/Sunday policy',()=>{
  assertWindow(window());assert.equal(Date.parse(window().endExclusive)-Date.parse(window().startInclusive),167*3600000);
  const sunday={...window(),startInclusive:'2026-03-08T05:00:00Z',endExclusive:'2026-03-15T04:00:00Z',weekStartsOn:'sunday'};assertWindow(sunday);
  for(const mutate of [w=>w.endExclusive=w.startInclusive,w=>w.endExclusive='2026-03-10T04:00:00Z',w=>w.startInclusive='2026-03-02T06:00:00Z',w=>w.weekStartsOn=null,w=>w.timezone='Mars/Olympus']){const w=window();mutate(w);assert.throws(()=>assertWindow(w));}
});
test('keeps calendar periods, fixed relative durations and FY/stage/revision distinct',()=>{
  const month={basis:'calendar-month',startInclusive:'2026-12-01T05:00:00Z',endExclusive:'2027-01-01T05:00:00Z',timezone:'America/New_York',weekStartsOn:null};assertWindow(month);
  const year={...month,basis:'calendar-year',startInclusive:'2026-01-01T05:00:00Z'};assertWindow(year);
  assert.throws(()=>assertWindow({...month,endExclusive:'2027-02-01T05:00:00Z'}));
  const request={basis:'relative-duration',days:7,anchorAt:'2026-03-09T04:00:00Z',timezone:'America/New_York'};
  const normalized={basis:'relative-duration',startInclusive:'2026-03-02T04:00:00Z',endExclusive:request.anchorAt,timezone:request.timezone,weekStartsOn:null};assertWindowResolution(request,normalized);assert.throws(()=>assertWindowResolution(request,window()));
  const fy={basis:'fiscal-year',year:2027,calendarId:'us-federal',stage:'appropriated',revisionId:'enacted-v1',timezone:'America/New_York'};
  const resolved={...fy,startInclusive:'2026-10-01T04:00:00Z',endExclusive:'2027-10-01T04:00:00Z'};assertWindowResolution(fy,resolved);assert.throws(()=>assertWindowResolution(fy,{...resolved,stage:'requested'}));
  const explicit={basis:'explicit',startInclusive:'2026-10-01T00:00:00Z',endExclusive:'2026-10-02T00:00:00Z',timezone:'UTC'};assertWindowResolution(explicit,{...explicit,weekStartsOn:null});assert.throws(()=>assertWindowResolution(explicit,{...explicit,endExclusive:'2026-10-03T00:00:00Z',weekStartsOn:null}));
});
test('permits complete authoritative zero count and denies incomplete false absence',()=>{
  assertEvidence(envelope());
  for(const mutate of [e=>e.coverage.truncated=true,e=>e.coverage.enumeration='partial',e=>e.continuation.cursor='opaque-next',e=>e.coverage.historySupport='bounded',e=>e.sources[0].freshness='stale',e=>e.sources[0].authority='derived',e=>e.continuation.requiredReads=['opaque-read'],e=>e.negativeAssertion.sourceIds=['other'],e=>e.sources[0].snapshotVersionId=null]){const e=envelope();mutate(e);assert.throws(()=>assertEvidence(e));}
});
test('candidate search cannot invent a total or certify absence',()=>{
  const e=envelope();e.method='candidate-search';e.data={kind:'candidates',records:[]};e.coverage.returnedCount=0;e.coverage.enumerableTotal=null;e.negativeAssertion={kind:'none'};assertEvidence(e);
  e.coverage.enumerableTotal=0;assert.throws(()=>assertEvidence(e),/invent total/);e.coverage.enumerableTotal=null;e.negativeAssertion={kind:'absence',sourceIds:['mail'],predicateSha256:'a'.repeat(64)};assert.throws(()=>assertEvidence(e),/absence/);
});
test('complete exact history binds every returned record and its zero total',()=>{
  const e=envelope();e.data={kind:'history',records:[]};e.coverage.returnedCount=0;assertEvidence(e);
  for(const total of [null,1]){const f=structuredClone(e);f.coverage.enumerableTotal=total;assert.throws(()=>assertEvidence(f),/history/);}
  const f=structuredClone(e);f.sources[0].authority='derived';assert.throws(()=>assertEvidence(f),/authoritative/);
  e.data.records=[record()];e.status='complete';e.reasonCode='OK';e.negativeAssertion={kind:'none'};e.coverage.returnedCount=1;e.coverage.enumerableTotal=1;assertEvidence(e);
  e.coverage.enumerableTotal=2;assert.throws(()=>assertEvidence(e),/history/);
});
test('snippets require follow-up; source reads contain full decisive content',()=>{
  const e=envelope();e.method='candidate-search';e.status='partial';e.reasonCode='PARTIAL_COVERAGE';e.negativeAssertion={kind:'none'};e.data={kind:'candidates',records:[record()]};e.data.records[0].content={kind:'snippet',text:'Preview only',readHandle:'opaque-read'};e.coverage.enumerableTotal=null;e.continuation.requiredReads=['opaque-read'];assertEvidence(e);
  e.continuation.requiredReads=[];assert.throws(()=>assertEvidence(e),/follow-up/);
  e.method='source-read';e.data.kind='source-read';e.continuation.requiredReads=['opaque-read'];assert.throws(()=>assertEvidence(e),/full material/);
  e.data.records[0].content={kind:'full-read',text:'Actual synthetic complete body'};e.continuation.requiredReads=[];e.status='complete';e.reasonCode='OK';assertEvidence(e);
  e.data.records[0].scopes[0].tenantId='other';assert.throws(()=>assertEvidence(e),/lineage/);
});
test('enforces coverage/source/freshness/count and failure consistency',()=>{
  for(const mutate of [e=>e.coverage.sourcesChecked=[],e=>e.coverage.returnedCount=0,e=>e.sources[0].asOf='2027-01-01T00:00:00Z',e=>e.sources.push({...e.sources[0]}),e=>e.subject.actorId='other',e=>e.data.value=1,e=>e.status='denied']){const e=envelope();mutate(e);assert.throws(()=>assertEvidence(e));}
  const e=envelope();e.status='denied';e.reasonCode='ACCESS_DENIED';e.data=null;e.coverage.returnedCount=0;e.coverage.enumerableTotal=null;e.negativeAssertion={kind:'none'};e.sources[0].status='denied';e.coverage.sourcesChecked=[];e.coverage.sourcesUnavailable=['mail'];e.coverage.enumeration='unknown';assertEvidence(e);
  e.coverage.enumerableTotal=123;assert.throws(()=>assertEvidence(e),/Failure outcome/);e.coverage.enumerableTotal=null;e.reasonCode='NO_MATCH';assert.throws(()=>assertEvidence(e),/taxonomy/);e.reasonCode='ACCESS_DENIED';e.retryable=true;assert.throws(()=>assertEvidence(e),/taxonomy/);
});
test('domain comparisons require compatible revision/stage/units',()=>{
  const e=envelope();e.status='complete';e.reasonCode='OK';e.negativeAssertion={kind:'none'};const value={recordId:'pe-1',versionId:'fy27-v1',stage:'appropriated',unit:'usd',value:10};e.data={kind:'comparison',left:value,right:{...value,recordId:'pe-2',value:20},records:[record()]};e.coverage.enumerableTotal=null;assertEvidence(e);
  for(const field of ['versionId','stage','unit']){const f=structuredClone(e);f.data.right[field]='incompatible';assert.throws(()=>assertEvidence(f),/comparison/);}
});
test('all14 skill IDs are retained without adding historical built-ins',()=>{
  assert.equal(skills.records.length,14);
  for(const row of skills.records){const m=manifest();m.skillId=row.fields.ID;validateShape('SkillManifest',m);}
  const m=manifest();m.skillId='invented.memory-only';assert.throws(()=>validateShape('SkillManifest',m));
});
test('skill requirements cannot reference absent, disabled or insufficient operations',()=>{
  assertSkillManifest(manifest(),catalog());
  for(const mutate of [m=>m.allowedOperations[0].id='absent.recipe',m=>m.requiredSources.push({sourceId:'meetings',authority:'authoritative',purpose:'evidence'}),m=>m.requiredSources[0].authority='approved-memory',m=>m.completion.requireAllSources=false,m=>m.approval.autoCreateTasks=true]){const m=manifest();mutate(m);assert.throws(()=>assertSkillManifest(m,catalog()));}
  const c=catalog();c.operations[0].availability='disabled';assert.throws(()=>assertSkillManifest(manifest(),c),/unavailable/);
});
test('manifest/catalog pins and lifecycle versions survive reconnect/resume/fork',()=>{
  const m=manifest(),c=catalog(),p=pin(m,c);assertSkillPin(p,m,c);assertSkillContinuity(p,structuredClone(p));
  for(const field of ['skillId','skillVersion','manifestSha256','catalogSha256']){const n=structuredClone(p);n[field]=field==='skillId'?'quick_skill.mail_history':field==='skillVersion'?'2.0.0':'b'.repeat(64);assert.throws(()=>assertSkillContinuity(p,n));}
  const changed=structuredClone(m);changed.budgets.maxTurns++;assert.throws(()=>assertSkillPin(p,changed,c),/pin mismatch/);
  const n=structuredClone(p);n.subject.tenantId='other';n.subject.scopes[0].tenantId='other';assert.throws(()=>assertSkillContinuity(p,n),/identity/);
});
test('closed selected invocation carries identity/version plus typed scope/window',()=>{
  const value={contractVersion:'0.2.0',invocationId:randomUUID(),skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0',selection:'explicit',scopeRequest:{kind:'client',entityId:'client-a'},windowRequest:{basis:'calendar-week',offset:0,timezone:'America/New_York',weekStartsOn:'monday'},prompt:'Synthetic commitments audit'};validateShape('SkillInvocation',value);
  for(const field of ['skillId','skillVersion','scopeRequest','windowRequest']){const f=structuredClone(value);delete f[field];assert.throws(()=>validateShape('SkillInvocation',f));}
  value.grants=['admin'];assert.throws(()=>validateShape('SkillInvocation',value));
});
test('strict0.1 readers remain strict and0.2 never silently upgrades them',()=>{
  assert.throws(()=>oldShape('ReadResult',envelope()));
  const e=envelope();e.contractVersion='0.1.0';assert.throws(()=>validateShape('EvidenceEnvelope',e));
  assert.throws(()=>validateShape('Budgets',{...manifest().budgets,maxCostMicroUSD:Number.MAX_SAFE_INTEGER+1}));
  for(const group of ['common','catalog','retrieval','skill']){
    const schema=JSON.parse(readFileSync(new URL(`../retrieval-0.2/${group}.schema.json`,import.meta.url)));
    const walk=node=>{if(!node||typeof node!=='object')return;if(node.type==='object')assert.equal(node.additionalProperties,false);for(const child of Object.values(node))if(child&&typeof child==='object')walk(child);};walk(schema);
  }
});

test('immutable record-version identity cannot be inflated by citations or substituted content',()=>{
  const e=envelope();e.status='complete';e.reasonCode='OK';e.negativeAssertion={kind:'none'};e.data={kind:'history',records:[record()]};e.coverage.returnedCount=1;e.coverage.enumerableTotal=1;assertEvidence(e);
  const copy={...structuredClone(e.data.records[0]),citationId:randomUUID()};e.data.records.push(copy);e.coverage.returnedCount=2;e.coverage.enumerableTotal=2;
  assert.throws(()=>assertEvidence(e),/Duplicate evidence record-version identity/);
  copy.contentSha256='a'.repeat(64);copy.content.text='Different content does not create a different version identity.';
  assert.throws(()=>assertEvidence(e),/Duplicate evidence record-version identity/);
  for(const [method,kind] of [['candidate-search','candidates'],['source-read','source-read'],['exact','status']]){
    const f=structuredClone(e);f.method=method;f.data.kind=kind;f.coverage.enumerableTotal=null;if(kind==='status')f.data.statusCode='found';
    assert.throws(()=>assertEvidence(f),/Duplicate evidence record-version identity/);
  }
});
test('record-version tuple identity separates delimiter collisions, versions and sources',()=>{
  const e=envelope();e.status='complete';e.reasonCode='OK';e.negativeAssertion={kind:'none'};
  const a={...record(),recordId:'a:b',recordVersionId:'c'},b={...record(),recordId:'a',recordVersionId:'b:c'},version={...a,citationId:randomUUID(),recordVersionId:'next-version'},otherSource={...a,citationId:randomUUID(),sourceId:'meetings'};
  e.sources.push({...e.sources[0],sourceId:'meetings'});e.coverage.sourcesRequested.push('meetings');e.coverage.sourcesChecked.push('meetings');
  e.data={kind:'history',records:[a,b,version,otherSource]};e.coverage.returnedCount=4;e.coverage.enumerableTotal=4;assertEvidence(e);
  e.data.records.push({...a,citationId:randomUUID()});e.coverage.returnedCount=5;e.coverage.enumerableTotal=5;
  assert.throws(()=>assertEvidence(e),/Duplicate evidence record-version identity/);
});
test('denied or unavailable source state cannot contribute returned candidate evidence',()=>{
  for(const status of ['denied','unavailable']){
    const e=envelope();e.method='candidate-search';e.status='partial';e.reasonCode='PARTIAL_COVERAGE';e.negativeAssertion={kind:'none'};e.data={kind:'candidates',records:[record()]};e.coverage.enumerableTotal=null;e.coverage.enumeration='partial';e.coverage.sourcesChecked=[];e.coverage.sourcesUnavailable=['mail'];e.sources[0].status=status;
    assert.throws(()=>assertEvidence(e),/Evidence source is not eligible/);
  }
});
test('mixed checked or partial and denied sources retain legitimate disclosed partial records',()=>{
  for(const eligibleStatus of ['checked','partial']){
    const e=envelope();e.method='candidate-search';e.status='partial';e.reasonCode='PARTIAL_COVERAGE';e.negativeAssertion={kind:'none'};e.data={kind:'candidates',records:[record()]};e.coverage.enumerableTotal=null;e.coverage.enumeration='partial';e.coverage.limitations=['Synthetic meetings source denied; mail evidence remains eligible.'];e.sources[0].status=eligibleStatus;
    e.sources.push({...e.sources[0],sourceId:'meetings',status:'denied'});e.coverage.sourcesRequested.push('meetings');e.coverage.sourcesUnavailable=['meetings'];assertEvidence(e);
    e.data.records.push({...record(),sourceId:'meetings'});e.coverage.returnedCount=2;
    assert.throws(()=>assertEvidence(e),/Evidence source is not eligible/);
  }
});
