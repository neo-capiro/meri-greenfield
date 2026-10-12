import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createLegislativeDirectoryValidators, LEGISLATIVE_DIRECTORY_OPERATION_IDS} from '../retrieval-0.2/legislative-directory-validation.mjs';

const schema = JSON.parse(readFileSync(new URL('../retrieval-0.2/legislative-directory.schema.json', import.meta.url)));
const ajv = new Ajv({strict:true, allErrors:true}); addFormats(ajv); ajv.addSchema(schema);
const checks = new Map(Object.keys(schema.$defs).map(name => [name, ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const v = createLegislativeDirectoryValidators({schema, validateShape(name, data) {
  const check = checks.get(name); if (!check?.(data)) throw new Error(`${name}: ${ajv.errorsText(check?.errors)}`); return data;
}});
const roster = 'get_committee_roster', list = 'list_members', stamp = '2026-10-12T12:00:00.000Z';
const constant = name => schema.$defs[name].const;
const normalize = (id, request = {}, options = {}) => v.normalizeLegislativeDirectoryInput(id, request, options);
const output = (id, page, request = {}, options = {}) => v.assertLegislativeDirectoryOutput(id, page, request, options);
const federalRequest = {committee:'synthetic-code', jurisdiction:'federal'};
const stateRequest = {committee:'Synthetic-State-ID', jurisdiction:'state', state:'FL'};
const federalMember = (extra = {}) => ({id:'synthetic-member', name:'Synthetic member', party:null, state:null, side:'unmapped-side', rank:null, title:null, ...extra});
const stateMember = (extra = {}) => ({id:'synthetic-member', name:'Synthetic member', party:null, chamber:null, district:null, role:null, ...extra});
const federalPage = (members = []) => ({tool:roster, generatedAt:stamp,
  committee:{id:'synthetic-code', name:'Synthetic committee', chamber:'joint', jurisdiction:'federal', isSubcommittee:false, matchedBy:'code'},
  chair:null, viceChair:null, rankingMember:null, members,
  note:constant(members.length ? 'DirectoryFederalRosterNote' : 'DirectoryEmptyRosterNote')});
const statePage = (members = []) => ({tool:roster, generatedAt:stamp,
  committee:{id:'synthetic-state-id', name:'Synthetic committee', chamber:null, jurisdiction:'state', matchedBy:'id'},
  chair:null, viceChair:null, rankingMember:null, members, note:members.length ? null : constant('DirectoryEmptyRosterNote')});
const unresolved = note => ({tool:roster, generatedAt:stamp, committee:null, chair:null, viceChair:null, rankingMember:null, members:[], note});
const person = (extra = {}) => ({id:'synthetic', name:'Synthetic member', party:null, state:'Virginia', district:null, chamber:'senate', ...extra});
const listRefusal = note => ({tool:list, generatedAt:stamp, matchesFound:0, members:[], note});
const listPage = (members = [], state = 'Virginia', chamber = 'senate') => {
  const label = state ? chamber ? `${state}-${chamber}` : state : chamber;
  return {tool:list, generatedAt:stamp, filter:{state,chamber}, matchesFound:members.length, members,
    note:members.length
      ? `Current members from the Capiro congressional roster (congress_member, is_current). Cite as [S:list_members:${label}]. Note every state has exactly 2 senators; if a senate query returns fewer than 2, the roster is incomplete for that state — say so rather than inventing a name.`
      : `No current members found for "${label}" in the Capiro roster — say so explicitly; do not guess names.`};
};
const listRequest = {state:'VA', chamber:'senate'};

test('two operation selectors and exact definitions remain private', () => {
  assert.deepEqual(LEGISLATIVE_DIRECTORY_OPERATION_IDS, [roster,list]);
  assert.equal(v.legislativeDirectoryInputDefinition(roster),'CommitteeRosterInput');
  assert.equal(v.legislativeDirectoryOutputDefinition(list),'MemberListOutput');
});
test('normalization trims, clips, cases and detaches frozen data with empty metadata', () => {
  const raw={committee:' Code ',jurisdiction:' FEDERAL ',chamber:' JOINT ',state:' fl '};
  const result=normalize(roster,raw); raw.committee='changed';
  assert.deepEqual(result,{input:{committee:'Code',jurisdiction:'federal',chamber:'joint',state:'FL'},metadata:{}});
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.input)&&Object.isFrozen(result.metadata));
  assert.deepEqual(normalize(roster,{committee:null,state:' ',chamber:null}),{input:{},metadata:{}});
});
test('UTF16 clipping and explicit post-case overflow refusal', () => {
  assert.equal(normalize(roster,{committee:'🧭'.repeat(101)}).input.committee.length,200);
  assert.equal(normalize(roster,{state:'ß'}).input.state,'SS');
  assert.throws(()=>normalize(roster,{state:'ßß'}));
  assert.throws(()=>normalize(roster,{chamber:'İ'.repeat(10)}));
  assert.equal(normalize(list,{state:'X'.repeat(45)}).input.state.length,40);
});
test('all56 pinned state and territory names normalize from codes and case variants', () => {
  const states=constant('DirectoryStateNames'); assert.equal(Object.keys(states).length,56);
  for(const [code,name] of Object.entries(states)) {
    assert.equal(normalize(list,{state:code.toLowerCase()}).input.state,name);
    assert.equal(normalize(list,{state:name.toUpperCase()}).input.state,name);
  }
});
test('member limits preserve finite numeric/string coercion and invalid chamber omission', () => {
  for(const [limit,expected] of [[undefined,100],[null,100],['',1],['2.9',2],[-10,1],[101,100],['Infinity',100]]) {
    const request=limit===undefined?{}:{limit}; assert.equal(normalize(list,request).input.limit,expected);
  }
  assert.deepEqual(normalize(list,{state:'Texas',chamber:'both'}).input,{limit:100,state:'Texas'});
  assert.deepEqual(normalize(list,{chamber:' HOUSE '}).input,{limit:100,chamber:'house'});
});
test('closed request and context reject malformed values and model authority fields', () => {
  for(const id of [roster,list]) {
    for(const key of ['tenantId','actorId','clientId','sql','current']) assert.throws(()=>normalize(id,{[key]:'forged'}));
    for(const context of [null,[],{actorId:'forged'},{asOf:stamp}]) assert.throws(()=>normalize(id,{},context));
    assert.throws(()=>normalize(id,{state:3}));
  }
  for(const limit of [true,[],{},Infinity]) assert.throws(()=>normalize(list,{limit}));
});
test('unknown and hostile operation/shape names never coerce or invoke accessors', () => {
  let calls=0; const hostile={[Symbol.toPrimitive](){calls++;return roster;},get toString(){calls++;return()=>roster;}};
  for(const id of [hostile,null,true,1,[],Symbol('id'),'__proto__','constructor']) {
    assert.throws(()=>normalize(id)); assert.throws(()=>v.legislativeDirectoryInputDefinition(id));
    assert.throws(()=>v.legislativeDirectoryOutputDefinition(id)); assert.throws(()=>v.validateLegislativeDirectoryShape(id,{}));
  }
  assert.equal(calls,0);
});
test('accessors, proxies, cycles and hidden values refuse without invocation', () => {
  let calls=0; const getter={get committee(){calls++;return 'x';}}, proxy=new Proxy({}, {ownKeys(){calls++;return [];}}), cycle={};cycle.self=cycle;
  for(const value of [getter,proxy,cycle,new Date(),{committee:undefined},Object.defineProperty({},'x',{value:1})]) assert.throws(()=>normalize(roster,value));
  assert.equal(calls,0);
});
test('missing namespace/committee and missing state retain distinct refusal', () => {
  output(roster,unresolved(constant('DirectorySelectionNote')));
  output(roster,unresolved(constant('DirectorySelectionNote')),{committee:'x',jurisdiction:'other'});
  output(roster,unresolved(constant('DirectoryStateNote')),{committee:'x',jurisdiction:'state'});
  assert.throws(()=>output(roster,federalPage(),{jurisdiction:'federal'}));
  assert.throws(()=>output(roster,unresolved(constant('DirectorySelectionNote')),{committee:'x',jurisdiction:'state'}));
});
test('unresolved federal/state notes bind query and chamber without inventing ambiguity detail', () => {
  output(roster,unresolved('No federal committee matched "Rules" in senate — say so explicitly, do not guess.'),{committee:'Rules',jurisdiction:'federal',chamber:'Senate'});
  output(roster,unresolved('No FL committee matched "Rules" in the lower chamber — say so explicitly, do not guess.'),{committee:'Rules',jurisdiction:'state',state:'FL',chamber:'lower'});
  assert.throws(()=>output(roster,unresolved('No federal committee matched "Other" — say so explicitly, do not guess.'),federalRequest));
});
test('resolved empty committee is distinct from unresolved selection', () => {
  output(roster,federalPage(),federalRequest);output(roster,statePage(),stateRequest);
  assert.throws(()=>output(roster,{...statePage(),note:null},stateRequest));
  assert.throws(()=>output(roster,{...unresolved(constant('DirectorySelectionNote')),members:[stateMember()]}));
});
test('federal and state projected rows preserve nullable and freeform stored scalars', () => {
  output(roster,federalPage([federalMember({rank:-1,title:'Future title'})]),federalRequest);
  output(roster,statePage([stateMember({district:'at-large',role:'Future role'})]),stateRequest);
  for(const rank of [1.5,2147483648]) assert.throws(()=>output(roster,federalPage([federalMember({rank})]),federalRequest));
  assert.throws(()=>output(roster,statePage([stateMember({role:2})]),stateRequest));
});
test('federal committee rows cannot imply district and state rows cannot carry federal attributes', () => {
  assert.throws(()=>output(roster,federalPage([federalMember({district:1})]),federalRequest));
  assert.throws(()=>output(roster,statePage([stateMember({side:'majority'})]),stateRequest));
  assert.throws(()=>output(roster,{...statePage(),committee:{...statePage().committee,state:'FL'}},stateRequest));
});
test('committee namespace/chamber and code/id matching preserve different case rules', () => {
  assert.throws(()=>output(roster,federalPage(),{...federalRequest,committee:'SYNTHETIC-CODE'}));
  output(roster,statePage(),{...stateRequest,committee:'SYNTHETIC-STATE-ID'});
  assert.throws(()=>output(roster,federalPage(),{...federalRequest,chamber:'house'}));
  assert.throws(()=>output(roster,statePage(),federalRequest));
  const p=federalPage();p.committee.matchedBy='name';output(roster,p,{committee:'Armed Services',jurisdiction:'federal'});
});
test('federal first matching leadership rows and role variants correlate exactly', () => {
  const rows=[federalMember({id:'one',rank:1,title:' Co—Chairwoman '}),federalMember({id:'two',rank:2,title:'Vice-Chairperson'}),federalMember({id:'three',rank:3,title:'Ranking'})];
  const page={...federalPage(rows),chair:{...rows[0]},viceChair:{...rows[1]},rankingMember:{...rows[2]}};output(roster,page,federalRequest);
  assert.throws(()=>output(roster,{...page,chair:null},federalRequest));
  assert.throws(()=>output(roster,{...page,chair:{...rows[0],name:'invented'}},federalRequest));
  assert.throws(()=>output(roster,{...page,chair:rows[1]},federalRequest));
});
test('role policy is anchored and preserves lowercasing rather than Unicode regex case folding', () => {
  for(const title of ['Vice Chair','Assistant Chair','Chairperſon','Future Chairman']) {
    const row=federalMember({title});const page=federalPage([row]);if(title==='Vice Chair')page.viceChair=row;
    output(roster,page,federalRequest);assert.throws(()=>output(roster,{...page,chair:row},federalRequest));
  }
});
test('first of multiple role rows wins while federal null rank sorts as999', () => {
  const first=federalMember({id:'first',rank:1,title:'Chair'}),second=federalMember({id:'second',rank:null,title:'Chair'});
  const page={...federalPage([first,second]),chair:first};output(roster,page,federalRequest);
  assert.throws(()=>output(roster,{...page,chair:second},federalRequest));
  assert.throws(()=>output(roster,{...page,members:[second,first]},federalRequest));
});
test('state first leadership row follows reported order and ranking member remains null', () => {
  const row=stateMember({role:'Chairman'}),ranking=stateMember({id:'ranking',role:'Ranking Member'});
  const page={...statePage([row,ranking]),chair:row};output(roster,page,stateRequest);
  assert.throws(()=>output(roster,{...page,rankingMember:ranking},stateRequest));
});
test('no artificial roster count cap is introduced', () => {
  const rows=Array.from({length:151},(_,n)=>federalMember({id:`synthetic-${n}`,rank:n}));
  output(roster,federalPage(rows),federalRequest);
});
test('roster notes preserve federal district warning and state nullable success', () => {
  assert.throws(()=>output(roster,{...federalPage([federalMember()]),note:'Complete roster'},federalRequest));
  assert.throws(()=>output(roster,{...statePage([stateMember()]),note:'Complete roster'},stateRequest));
});
test('member missing filter and unrecognized state refuse before available result', () => {
  output(list,listRefusal(constant('DirectoryMemberSelectionNote')));
  output(list,listRefusal(constant('DirectoryMemberSelectionNote')),{chamber:'both'});
  output(list,listRefusal('"Freedonia" is not a recognized US state or territory — say so explicitly, do not guess a roster.'),{state:'Freedonia',chamber:'house'});
  assert.throws(()=>output(list,listPage([],null,'senate'),{state:'Freedonia',chamber:'senate'}));
  assert.throws(()=>output(list,listPage([],null,null)));
});
test('member empty/partial results retain exact projection and provenance caveat', () => {
  output(list,listPage(),listRequest);output(list,listPage([person()]),listRequest);
  assert.throws(()=>output(list,{...listPage([person()]),note:'Complete senate roster'},listRequest));
  assert.throws(()=>output(list,listRefusal(constant('DirectoryMemberSelectionNote')),listRequest));
});
test('member list count is exactly returned rows and obeys requested limit', () => {
  assert.throws(()=>output(list,{...listPage([person()]),matchesFound:2},listRequest));
  assert.throws(()=>output(list,listPage([person(),person({id:'second'})]),{...listRequest,limit:1}));
  assert.throws(()=>output(list,{...listPage(),total:50},listRequest));
});
test('member filters and source case-insensitive state selection bind output', () => {
  output(list,listPage([person({state:'VIRGINIA'})]),listRequest);
  assert.throws(()=>output(list,listPage([person({state:'Florida'})]),listRequest));
  assert.throws(()=>output(list,listPage([person({chamber:'house'})]),listRequest));
  assert.throws(()=>output(list,{...listPage(),filter:{state:'Florida',chamber:'senate'}},listRequest));
  output(list,listPage([person({state:null})],null,'senate'),{chamber:'senate'});
});
test('House districts preserve persisted signed integers; other chamber districts must be null', () => {
  output(list,listPage([person({chamber:'house',district:-1})],'Virginia','house'),{state:'VA',chamber:'house'});
  assert.throws(()=>output(list,listPage([person({district:1})]),listRequest));
  output(list,listPage([person({chamber:'future'})],'Virginia',null),{state:'VA'});
  assert.throws(()=>output(list,listPage([person({chamber:'future',district:1})],'Virginia',null),{state:'VA'}));
});
test('generatedAt is canonical metadata, not a current-time assertion', () => {
  output(list,{...listPage(),generatedAt:'2000-01-01T00:00:00.000Z'},listRequest);
  for(const generatedAt of ['2026-10-12T12:00:00Z','2026-02-30T00:00:00.000Z','invalid']) assert.throws(()=>output(list,{...listPage(),generatedAt},listRequest));
});
test('cross-family substitutions, extra result fields and hostile result values refuse', () => {
  assert.throws(()=>output(roster,listPage(),federalRequest));assert.throws(()=>output(list,federalPage(),listRequest));
  assert.throws(()=>output(list,{...listPage(),currentAuthority:true},listRequest));
  let calls=0;const page=listPage();Object.defineProperty(page,'note',{get(){calls++;return 'fake';},enumerable:true});
  assert.throws(()=>output(list,page,listRequest));assert.equal(calls,0);
});
test('output snapshots are detached and mutable without changing source rows', () => {
  const page=listPage([person()]);const detached=output(list,page,listRequest);detached.members[0].name='edited';
  assert.equal(page.members[0].name,'Synthetic member');assert.notEqual(detached.members,page.members);
});
