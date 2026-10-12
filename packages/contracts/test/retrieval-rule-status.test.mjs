import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createRuleStatusValidators, RULE_STATUS_OPERATION_IDS} from '../retrieval-0.2/rule-status-validation.mjs';

const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/rule-status.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const shapes=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v=createRuleStatusValidators({schema,validateShape(name,value){const check=shapes.get(name);if(!check?.(value))throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`);return value;}});
const id='get_state_rule_status',at='2026-06-01T00:00:00.000Z',before='2026-05-31T00:00:00.000Z',after='2026-06-02T00:00:00.000Z';
const context={stageAsOf:at,commentAsOf:at}, request={query:'Synthetic'};
const constant=name=>schema.$defs[name].const;
const normalize=(raw={},options=context)=>v.normalizeRuleStatusInput(id,raw,options);
const output=(page,raw=request,options=context)=>v.assertRuleStatusOutput(id,page,raw,options);
const empty=note=>({tool:id,generatedAt:at,found:false,note});
const candidate=(jurisdiction,n=0)=>({id:`synthetic-${n}`,title:'Synthetic rule',jurisdiction,state:jurisdiction==='state'?'FL':null});
const ambiguous=rows=>({...empty(`"Synthetic" matches ${rows.length} rules/notices — ask which one (by id) before describing its status.`),ambiguousMatches:rows});
const federal=(extra={})=>({tool:id,generatedAt:at,found:true,jurisdiction:'federal',id:'synthetic-rule',title:'Synthetic rule',abstract:null,
  agencyNames:[],ruleType:'NOTICE',stage:'notice',stageLabel:'Notice',publicationDate:before,
  commentPeriod:{start:null,end:after,isOpen:true},effectiveDate:null,docketIds:[],sourceUrl:null,linkedBillKeys:[],...extra});
const state=(extra={})=>({...federal(),jurisdiction:'state',agencyNames:['Synthetic agency'],ruleType:'notice',publicationDate:null,
  sourceUrl:'stored-not-validated-url',filingDate:null,linkedRuleNumbers:[],sourceRevision:null,
  coverage:'Notice metadata; adopted text/history qualification is reported by legislative research.',...extra});

test('one private operation exposes canonical definition names',()=>{
  assert.deepEqual(RULE_STATUS_OPERATION_IDS,[id]);assert.equal(v.ruleStatusInputDefinition(id),'RuleStatusInput');assert.equal(v.ruleStatusOutputDefinition(id),'RuleStatusOutput');
});
test('normalization preserves clipping, null omission, casing and frozen detached values',()=>{
  const raw={query:' Synthetic ',state:' fl '}, normalized=normalize(raw);raw.query='changed';
  assert.deepEqual(normalized,{input:{query:'Synthetic',state:'FL'},metadata:{}});
  assert.ok(Object.isFrozen(normalized)&&Object.isFrozen(normalized.input)&&Object.isFrozen(normalized.metadata));
  assert.deepEqual(normalize({query:null,state:' '}),{input:{},metadata:{}});
  assert.equal(normalize({query:'🧭'.repeat(101)}).input.query.length,200);
  assert.equal(normalize({state:'ß'}).input.state,'SS');assert.throws(()=>normalize({state:'ßß'}));
});
test('two observed clocks are required outside model input, with no extra context',()=>{
  for(const value of [undefined,null,[],{}, {asOf:at},{stageAsOf:at},{commentAsOf:at},{...context,actorId:'forged'}]) {
    assert.throws(()=>v.normalizeRuleStatusInput(id,{},value));
  }
  for(const field of ['stageAsOf','commentAsOf','asOf','tenantId','actorId','current','sql'])assert.throws(()=>normalize({query:'x',[field]:at}));
  for(const value of [1,[],{},true])assert.throws(()=>normalize({query:value}));
});
test('clock anchors must be canonical instants but need not be ordered',()=>{
  for(const invalid of ['invalid','2026-06-01T00:00:00Z','2026-02-30T00:00:00.000Z',1]) {
    assert.throws(()=>normalize({}, {...context,stageAsOf:invalid}));assert.throws(()=>normalize({}, {...context,commentAsOf:invalid}));
  }
  normalize({}, {stageAsOf:after,commentAsOf:before});
});
test('hostile operation and shape selectors are inert',()=>{
  let calls=0;const hostile={[Symbol.toPrimitive](){calls++;return id;},get toString(){calls++;return()=>id;}};
  for(const selector of [hostile,null,1,true,[],Symbol('id'),'constructor','__proto__']) {
    assert.throws(()=>v.normalizeRuleStatusInput(selector,{},context));assert.throws(()=>v.ruleStatusInputDefinition(selector));
    assert.throws(()=>v.ruleStatusOutputDefinition(selector));assert.throws(()=>v.validateRuleStatusShape(selector,{}));
  }
  assert.equal(calls,0);
});
test('accessors, proxies, cycles and nonfinite data refuse without side effects',()=>{
  let calls=0;const getter={get query(){calls++;return 'Synthetic';}},proxy=new Proxy({}, {ownKeys(){calls++;return [];}}),cycle={};cycle.query=cycle;
  for(const raw of [getter,proxy,cycle,new Date(at),{query:undefined},{query:Infinity}])assert.throws(()=>normalize(raw));
  const clockGetter={stageAsOf:at,get commentAsOf(){calls++;return at;}};assert.throws(()=>normalize({},clockGetter));assert.equal(calls,0);
});
test('missing query retains only its explicit found-false note',()=>{
  output(empty(constant('RuleStatusMissingNote')),{});
  assert.throws(()=>output(empty('No matches'),{}));assert.throws(()=>output(federal(),{}));
  assert.throws(()=>output(ambiguous([candidate('state',1),candidate('state',2)]),{}));
});
test('no-match notes bind normalized query/state and disclose no memory inference',()=>{
  output(empty('No rule or notice matched "Synthetic". Say so explicitly — do not describe a rule\'s status from memory.'));
  output(empty('No rule or notice matched "Synthetic" in FL. Say so explicitly — do not describe a rule\'s status from memory.'),{query:' Synthetic ',state:' fl '});
  assert.throws(()=>output(empty('No rule or notice matched "Other". Say so explicitly — do not describe a rule\'s status from memory.')));
});
test('ambiguity allows six state plus six federal candidates in source grouping',()=>{
  const rows=[...Array.from({length:6},(_,n)=>candidate('state',n)),...Array.from({length:6},(_,n)=>candidate('federal',n))];
  output(ambiguous(rows));assert.throws(()=>output(ambiguous([...rows,candidate('state',7)])));
  assert.throws(()=>output(ambiguous(rows.slice(0,7).map((r,n)=>candidate('state',n)))));
  assert.throws(()=>output(ambiguous([candidate('federal'),candidate('state')])));
});
test('ambiguity is at least two, unique per namespace and exact returned count only',()=>{
  assert.throws(()=>output(ambiguous([candidate('state')])));
  assert.throws(()=>output(ambiguous([candidate('state'),candidate('state')])));
  output(ambiguous([candidate('state'),candidate('federal')]));
  assert.throws(()=>output({...ambiguous([candidate('state'),candidate('federal')]),note:'"Synthetic" matches 99 rules/notices — ask which one (by id) before describing its status.'}));
});
test('state hint suppresses federal ambiguity and enforces each projected state',()=>{
  const rows=[candidate('state',1),candidate('state',2)];output(ambiguous(rows),{...request,state:'fl'});
  assert.throws(()=>output(ambiguous([rows[0],{...rows[1],state:'VA'}]),{...request,state:'FL'}));
  assert.throws(()=>output(ambiguous([rows[0],candidate('federal')]),{...request,state:'FL'}));
  assert.throws(()=>output(ambiguous([{...candidate('federal'),state:'FL'},candidate('state')])));
});
test('found namespaces preserve different state/federal projections and hint restrictions',()=>{
  output(federal());output(state(),{...request,state:'FL'});
  assert.throws(()=>output(federal(),{...request,state:'FL'}));
  assert.throws(()=>output({...federal(),coverage:constant('RuleStatusStateCoverage')}));
  const {filingDate,...missing}=state();assert.throws(()=>output(missing));
  assert.throws(()=>output({...state(),state:'FL'}));
});
test('stored strings are not invented ID/URL/type enums and nullable state ruleType remains notice',()=>{
  output(state({ruleType:null,abstract:'',sourceRevision:'',id:'not-a-uuid',sourceUrl:''}));
  output(federal({id:'free-form-id',sourceUrl:'unvalidated source reference',ruleType:'future-type'}));
  assert.throws(()=>output(federal({ruleType:null})));
});
test('federal publication is nonnull DateTime; state source dates retain SQLDate midnight',()=>{
  output(federal({publicationDate:'2026-05-31T12:34:56.789Z'}));assert.throws(()=>output(federal({publicationDate:null})));
  for(const field of ['publicationDate','effectiveDate','filingDate'])assert.throws(()=>output(state({[field]:'2026-05-31T12:34:56.789Z'})));
  for(const key of ['start','end'])assert.throws(()=>output(state({commentPeriod:{...state().commentPeriod,[key]:'2026-05-31T12:34:56.789Z'}})));
});
test('federal period has no start; state may retain a stored start',()=>{
  assert.throws(()=>output(federal({commentPeriod:{start:before,end:after,isOpen:true}})));
  output(state({commentPeriod:{start:at,end:after,isOpen:true}}));
});
test('state single agency and optional single nonempty docket preserve projection',()=>{
  output(state({docketIds:[' '],linkedBillKeys:['stored-key'],linkedRuleNumbers:['rule-1']}));
  for(const agencyNames of [[],['one','two'],[null]])assert.throws(()=>output(state({agencyNames})));
  for(const docketIds of [[''],['one','two']])assert.throws(()=>output(state({docketIds})));
  output(federal({agencyNames:['','agency'],docketIds:['','one','two']}));
  assert.throws(()=>output(federal({linkedBillKeys:['invented']})));
});
test('state coverage is exact and federal/state URL nullability differs',()=>{
  assert.throws(()=>output(state({coverage:'Complete adopted text'})));assert.throws(()=>output(state({sourceUrl:null})));
  output(federal({sourceUrl:null}));
});
for(const ruleType of ['PROPOSED_RULE','proposed'])test(`${ruleType}: stage deadline is strictly earlier, open deadline strictly later`,()=>{
  output(federal({ruleType,stage:'nprm',stageLabel:'NPRM'}));
  output(federal({ruleType,stage:'nprm',stageLabel:'NPRM',commentPeriod:{start:null,end:at,isOpen:false}}));
  output(federal({ruleType,stage:'comment_closed',stageLabel:'Comment closed',commentPeriod:{start:null,end:before,isOpen:false}}));
  assert.throws(()=>output(federal({ruleType,stage:'comment_closed',stageLabel:'Comment closed',commentPeriod:{start:null,end:at,isOpen:false}})));
});
for(const ruleType of ['RULE','FINAL','PRESIDENTIAL_DOCUMENT','EXECUTIVE_ORDER','EMERGENCY'])test(`${ruleType}: inclusive effective boundary never opens lingering comment window`,()=>{
  for(const effectiveDate of [null,after])output(federal({ruleType,stage:'final',stageLabel:'Final rule',effectiveDate,commentPeriod:{start:null,end:after,isOpen:false}}));
  output(federal({ruleType,stage:'effective',stageLabel:'Effective',effectiveDate:at,commentPeriod:{start:null,end:after,isOpen:false}}));
  assert.throws(()=>output(federal({ruleType,stage:'effective',stageLabel:'Effective',effectiveDate:at})));
});
test('unknown and whitespace-surrounded document types stay notice, without trimming or guessing',()=>{
  for(const ruleType of ['', ' proposed ', 'NOTICE','constructor','future',' final '])output(federal({ruleType}));
  assert.throws(()=>output(federal({ruleType:'unknown',stage:'effective',stageLabel:'Effective',effectiveDate:before})));
});
test('stage labels correlate exactly and cannot be freely swapped',()=>{
  assert.throws(()=>output(federal({stageLabel:'NPRM'})));assert.throws(()=>output(federal({stage:'made-up'})));
});
test('comment start is inclusive; future start prevents an otherwise open stage',()=>{
  output(state({commentPeriod:{start:at,end:after,isOpen:true}}));
  output(state({commentPeriod:{start:after,end:after,isOpen:false}}));
  assert.throws(()=>output(state({commentPeriod:{start:after,end:after,isOpen:true}})));
});
test('no end means not open and exact missing-deadline note only at accepting stages',()=>{
  for(const [ruleType,stage,stageLabel] of [['NOTICE','notice','Notice'],['PROPOSED_RULE','nprm','NPRM']]) {
    const page=federal({ruleType,stage,stageLabel,commentPeriod:{start:null,end:null,isOpen:false},note:constant('RuleStatusMissingDeadlineNote')});output(page);
    const {note,...missing}=page;assert.throws(()=>output(missing));assert.throws(()=>output({...page,note:'No deadline'}));
  }
  output(federal({ruleType:'RULE',stage:'final',stageLabel:'Final rule',commentPeriod:{start:null,end:null,isOpen:false}}));
  assert.throws(()=>output({...federal(),note:constant('RuleStatusMissingDeadlineNote')}));
});
test('separate clocks retain stage-before-deadline and comment-after-deadline observations',()=>{
  const page=federal({ruleType:'PROPOSED_RULE',stage:'nprm',stageLabel:'NPRM',commentPeriod:{start:null,end:at,isOpen:false},generatedAt:before});
  output(page,request,{stageAsOf:before,commentAsOf:after});
  assert.throws(()=>output(page,request,{stageAsOf:after,commentAsOf:after}));
});
test('a regressed comment clock does not override previously derived closed stage',()=>{
  output(federal({ruleType:'PROPOSED_RULE',stage:'comment_closed',stageLabel:'Comment closed',commentPeriod:{start:null,end:at,isOpen:false}}),request,{stageAsOf:after,commentAsOf:before});
});
test('generatedAt is independent metadata, never an implicit decision clock',()=>{
  for(const generatedAt of ['2000-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z'])output(federal({generatedAt}));
  assert.throws(()=>output(federal({generatedAt:'2026-06-01T00:00:00Z'})));
  assert.throws(()=>output({...federal(),stageAsOf:at}));
});
test('hostile result values, extra fields and cross-operation envelopes refuse',()=>{
  assert.throws(()=>output({...federal(),tool:'get_committee_roster'}));assert.throws(()=>output({...federal(),complete:true}));
  let calls=0;const page=federal();Object.defineProperty(page,'stage',{get(){calls++;return 'notice';},enumerable:true});assert.throws(()=>output(page));assert.equal(calls,0);
});
test('output rows and periods are detached mutable data',()=>{
  const page=state();const checked=output(page);checked.agencyNames.push('edited');checked.commentPeriod.end=before;
  assert.equal(page.agencyNames.length,1);assert.equal(page.commentPeriod.end,after);
});
