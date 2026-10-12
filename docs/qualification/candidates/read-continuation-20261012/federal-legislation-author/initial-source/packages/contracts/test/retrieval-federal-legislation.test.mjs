import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {createFederalLegislationValidators} from '../retrieval-0.2/federal-legislation-validation.mjs';
const schema=JSON.parse(readFileSync(new URL('../retrieval-0.2/federal-legislation.schema.json',import.meta.url)));
// Test-only compiler. Shared registration and source/runtime access remain absent.
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const checks=new Map(Object.keys(schema.$defs).map(name=>[name,ajv.compile({$ref:`${schema.$id}#/$defs/${name}`})]));
const validateShape=(name,value)=>{const check=checks.get(name);assert.ok(check(value),ajv.errorsText(check.errors));return value;};
const {normalizeFederalLegislationInput:normalize,assertFederalLegislationOutput:check}=createFederalLegislationValidators({validateShape,schema});
const BILL='get_bill_status',VOTES='search_floor_votes',NOW='2026-10-12T00:00:00.000Z',OLDER='2026-10-11T00:00:00.000Z';
const context=()=>({defaultCongress:119});
const note=key=>schema.$defs[key].const;
const vote=()=>({chamber:'house',rollNumber:7,question:null,result:'Failed',voteType:null,voteDate:NOW,
  yeas:0,nays:2,present:0,notVoting:0,partyTotals:{reported:{D:2}},sourceUrl:null});
const rule=()=>({ruleBillId:'119-hres-9',ruleTitle:'Synthetic rule',ruleStatus:'failed',ruleLatestAction:null,
  ruleVotes:[{rollNumber:8,result:'Failed',yeas:1,nays:2,voteDate:NOW,question:null,sourceUrl:null}]});
const bill=()=>({tool:BILL,authoritativeOwner:'congress_bill_status',currentStatus:'available',generatedAt:NOW,billId:'119-hr-7',found:true,
  title:'Synthetic bill',congress:119,status:'introduced',statusLabel:'Introduced',statusAt:null,
  latestAction:{text:null,date:null},sponsor:{name:null,bioguideId:null},cosponsorsCount:0,
  recentActions:[{date:NOW,text:'Synthetic action',type:null,chamber:null}],floorVotes:[vote()],governingRules:[rule()]});
const invalid=()=>({tool:BILL,authoritativeOwner:'congress_bill_status',currentStatus:'invalid_request',generatedAt:NOW,found:false,note:note('FederalInvalidBillNote')});
const unavailable=()=>({tool:BILL,authoritativeOwner:'congress_bill_status',currentStatus:'unavailable',generatedAt:NOW,billId:'119-hr-7',found:false,
  note:'No bill 119-hr-7 on record in the Capiro database. Say so explicitly — do not describe its status from memory.'});
const searchVote=()=>({id:'house-119-2-7',congress:119,session:2,billId:'119-hr-7',title:null,...vote()});
const votes=()=>({tool:VOTES,generatedAt:NOW,votesFound:1,votes:[searchVote()]});
const memberVotes=()=>({bioguideId:'A000001',fullName:'Synthetic member'});
const position=()=>({voteCast:'Yea',party:null,state:null});
const scoped=()=>{const page=votes();page.member=memberVotes();page.votes[0].memberVotes=[position()];return page;};
const empty=()=>({tool:VOTES,generatedAt:NOW,votesFound:0,votes:[],note:note('FederalNoVotesNote')});

test('bill normalization requires explicit trusted Congress and uses no ambient clock',()=>{
  assert.deepEqual(normalize(BILL,{billId:'H.R. 7'},context()),{billId:'119-hr-7'});
  assert.deepEqual(normalize(BILL,{billId:'H.R. 7'},{defaultCongress:120}),{billId:'120-hr-7'});
  for(const ctx of [undefined,null,{},[],{defaultCongress:119,nowMs:1},{defaultCongress:'119'},{defaultCongress:0},{defaultCongress:1.5},{defaultCongress:2147483648}])
    assert.throws(()=>normalize(BILL,{billId:'119-hr-7'},ctx));
});
test('all eight designation kinds support documented punctuation and explicit Congress',()=>{
  for(const [raw,type] of [['H.R. 7','hr'],['S. 7','s'],['H. J. Res. 7','hjres'],['S.J.Res.7','sjres'],['H. Con. Res. 7','hconres'],['S Con Res 7','sconres'],['H. Res. 7','hres'],['S Res 7','sres']]){
    assert.equal(normalize(BILL,{billId:raw},context()).billId,`119-${type}-7`);
    assert.equal(normalize(BILL,{billId:`${raw} (118th)`},context()).billId,`118-${type}-7`);
  }
});
test('canonical IDs retain zeroes while designation numbers normalize under producer grammar',()=>{
  assert.equal(normalize(BILL,{billId:' 119-HR-00007 '},context()).billId,'119-hr-00007');
  assert.equal(normalize(BILL,{billId:'H.R. 00007'},context()).billId,'119-hr-7');
  assert.equal(normalize(BILL,{billId:'00-hr-00000'},context()).billId,'00-hr-00000');
  assert.equal(normalize(BILL,{billId:'H.R. 0'},context()).billId,null);
  assert.equal(normalize(BILL,{billId:'H.R. 7 (119TH)'},context()).billId,null);
});
test('bill alias/default refusal preserves primary selector precedence and UTF-16 cap',()=>{
  assert.equal(normalize(BILL,{billId:null,query:' H.R. 7 '},context()).billId,'119-hr-7');
  assert.equal(normalize(BILL,{billId:'nonsense',query:'H.R. 7'},context()).billId,null);
  for(const raw of [{},{billId:' '},{billId:'x'.repeat(60)+'H.R. 7'},{billId:'119-xx-7'}])assert.equal(normalize(BILL,raw,context()).billId,null);
});
test('floor input normalizes optional filters and explicitly drops invalid bill/chamber',()=>{
  assert.deepEqual(normalize(VOTES,{},context()),{billId:null,query:null,member:null,bioguideId:null,chamber:null,congress:null,limit:10});
  const input=normalize(VOTES,{billId:'H.R. 7',query:' x ',member:' a000001 ',chamber:' HOUSE ',congress:'119',limit:'3.9'},context());
  assert.deepEqual(input,{billId:'119-hr-7',query:'x',member:'a000001',bioguideId:'A000001',chamber:'house',congress:119,limit:3});
  assert.equal(normalize(VOTES,{billId:'wrong',chamber:'both'},context()).billId,null);
  assert.equal(normalize(VOTES,{chamber:'both'},context()).chamber,null);
});
test('floor text windows preserve UTF-16 and canonical member versus name distinction',()=>{
  const input=normalize(VOTES,{query:'😀'.repeat(101),member:'😀'.repeat(41),chamber:'house-extra'},context());
  assert.equal(input.query.length,200);assert.equal(input.member.length,80);assert.equal(input.bioguideId,null);assert.equal(input.chamber,null);
  assert.equal(normalize(VOTES,{member:'A001'},context()).bioguideId,null);
});
test('floor numeric parsing preserves effective truthiness and bounded typed admission',()=>{
  for(const [limit,want] of [[null,10],['bad',10],['Infinity',10],['',1],[-1,1],[0,1],[100,25],[3.9,3]])assert.equal(normalize(VOTES,{limit},context()).limit,want);
  for(const congress of [null,0,'0','','bad'])assert.equal(normalize(VOTES,{congress},context()).congress,null);
  assert.equal(normalize(VOTES,{congress:-1},context()).congress,-1);
  for(const congress of [1.5,'Infinity',2147483648])assert.throws(()=>normalize(VOTES,{congress},context()));
});
test('model arguments cannot inject current authority or defaultCongress',()=>{
  for(const raw of [{defaultCongress:119},{actorId:'actor'},{tenantId:'tenant'},{authorized:true},{sourceConnected:true},{cursor:'x'},{query:false}])
    assert.throws(()=>normalize(BILL,raw,context()));
  for(const raw of [{limit:{}},{member:4},{congress:true}])assert.throws(()=>normalize(VOTES,raw,context()));
});
test('all bill branches and nonempty vote projection round-trip as inert DTOs',()=>{
  for(const [page,raw] of [[invalid(),{}],[unavailable(),{billId:'119-hr-7'}],[bill(),{billId:'119-hr-7'}]]){
    const before=structuredClone(page);assert.equal(check(BILL,page,raw,context()),page);assert.deepEqual(page,before);
  }
  const page=votes();assert.equal(check(VOTES,page,{},context()),page);
});
test('invalid request cannot become available/absent bill and no-match identity remains exact',()=>{
  assert.throws(()=>check(BILL,bill(),{},context()));assert.throws(()=>check(BILL,unavailable(),{},context()));
  assert.throws(()=>check(BILL,invalid(),{billId:'119-hr-7'},context()));
  const page=unavailable();page.billId='119-hr-8';assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  const extra=invalid();extra.billId='119-hr-7';assert.throws(()=>check(BILL,extra,{},context()));
});
test('absent bill warning is required and cannot claim status from memory',()=>{
  for(const mutate of [p=>delete p.note,p=>p.note='No bill.',p=>p.status='enacted',p=>p.found=true]){
    const page=unavailable();mutate(page);assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  }
});
test('stored statuses preserve known labels, null/empty/unknown fallback without deriving stage',()=>{
  for(const [status,label] of [...Object.entries(schema.$defs.FederalBillStatusLabels.const),[null,'Unknown'],['',''],['future_status','future_status']]){
    const page=bill();page.status=status;page.statusLabel=label;if(status==='rule_failed')page.note=note('FederalRuleFailedNote');
    check(BILL,page,{billId:'119-hr-7'},context());
  }
  const page=bill();page.statusLabel='Enacted';assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
});
test('rule failure and missing bill floor votes remain distinct with both warnings',()=>{
  const page=bill();page.status='rule_failed';page.statusLabel='Rule failed — stalled on the floor';page.floorVotes=[];
  page.note=note('FederalNoBillVoteNote')+' '+note('FederalRuleFailedNote');check(BILL,page,{billId:'119-hr-7'},context());
  assert.equal(page.governingRules[0].ruleVotes[0].result,'Failed');assert.equal(page.floorVotes.length,0);
  page.note=note('FederalRuleFailedNote');assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
});
test('no bill floor vote does not infer chamber passage from governing-rule vote',()=>{
  const page=bill();page.floorVotes=[];page.note=note('FederalNoBillVoteNote');page.governingRules[0].ruleVotes[0].result='Passed';
  check(BILL,page,{billId:'119-hr-7'},context());delete page.note;assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
});
test('bounds15 actions and15 bill votes with3 per governing rule, no small rule-count cap',()=>{
  const page=bill();page.recentActions=Array.from({length:15},()=>({...page.recentActions[0]}));page.floorVotes=Array.from({length:15},vote);
  page.governingRules=Array.from({length:40},(_,i)=>({...rule(),ruleBillId:`119-hres-${i+1}`,ruleVotes:Array.from({length:3},()=>({...rule().ruleVotes[0]}))}));
  check(BILL,page,{billId:'119-hr-7'},context());
  for(const target of [p=>p.recentActions,p=>p.floorVotes,p=>p.governingRules[0].ruleVotes]){
    const bad=structuredClone(page);target(bad).push({...target(bad)[0]});assert.throws(()=>check(BILL,bad,{billId:'119-hr-7'},context()));
  }
});
test('nullable sponsor/action/rule soft-reference fields remain required and distinct',()=>{
  const page=bill();Object.assign(page.governingRules[0],{ruleTitle:null,ruleStatus:null,ruleLatestAction:null});
  check(BILL,page,{billId:'119-hr-7'},context());
  delete page.sponsor.name;assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
});
test('opaque partyTotals and signed integer source values never derive vote outcomes',()=>{
  for(const totals of [null,0,'opaque',[],{R:{yea:999999},other:true}]){
    const page=bill();page.floorVotes[0].partyTotals=totals;page.floorVotes[0].yeas=-1;page.cosponsorsCount=-1;
    check(BILL,page,{billId:'119-hr-7'},context());
  }
  const page=votes();page.votes[0].voteType='unrecognized';page.votes[0].result=null;check(VOTES,page,{},context());
});
test('bill actions/votes/rule observations descend with ties permitted',()=>{
  for(const target of [p=>p.recentActions,p=>p.floorVotes,p=>p.governingRules[0].ruleVotes]){
    const page=bill(),rows=target(page),key=Object.hasOwn(rows[0],'date')?'date':'voteDate';rows.push({...rows[0],[key]:OLDER});
    check(BILL,page,{billId:'119-hr-7'},context());rows.reverse();assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  }
});
test('serialized timestamps are finite; only latestAction date is a stored Date',()=>{
  const page=bill();page.statusAt='2026-10-12T12:00:00.000Z';page.latestAction.date=NOW;check(BILL,page,{billId:'119-hr-7'},context());
  page.latestAction.date='2026-10-12T12:00:00.000Z';assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  const bad=votes();bad.generatedAt='2016-12-31T23:59:60Z';assert.throws(()=>check(VOTES,bad,{},context()));
});
test('floor no-match requires explicit note rather than a fabricated vote',()=>{
  check(VOTES,empty(),{},context());const page=empty();delete page.note;assert.throws(()=>check(VOTES,page,{},context()));
  const hit=votes();hit.note=note('FederalNoVotesNote');assert.throws(()=>check(VOTES,hit,{},context()));
});
test('unknown direct member and unresolved name never release unscoped votes',()=>{
  for(const [member,message] of [['a000001','No member with Bioguide id A000001 is on record. Results are NOT scoped to a member — say so; do not attribute votes.'],
    ['Nobody','Could not resolve a member named "Nobody". Results are NOT scoped to that member — say so explicitly; do not attribute any vote to them.']]){
    const page={...empty(),note:message};check(VOTES,page,{member},context());page.votes=[searchVote()];page.votesFound=1;assert.throws(()=>check(VOTES,page,{member},context()));
  }
});
test('ambiguous name candidates retain2..8 shape and an exact clarification note',()=>{
  const candidates=[{bioguideId:'A000001',fullName:'One',chamber:'house',state:null,party:null,isCurrent:true},
    {bioguideId:'B000002',fullName:'Two',chamber:'senate',state:'FL',party:'R',isCurrent:false}];
  const page={...empty(),ambiguousMember:candidates,note:'"Smith" matches 2 members — ask the user which (by state/chamber/full name) before attributing votes. Results are NOT scoped to a member yet.'};
  check(VOTES,page,{member:'Smith'},context());
  assert.throws(()=>check(VOTES,page,{member:'A000001'},context()));assert.throws(()=>check(VOTES,page,{},context()));
  page.member=memberVotes();assert.throws(()=>check(VOTES,page,{member:'Smith'},context()));
});
test('resolved direct member preserves canonical identity while name resolution stays external',()=>{
  const page=scoped();check(VOTES,page,{member:'a000001'},context());check(VOTES,page,{member:'Synthetic'},context());
  assert.throws(()=>check(VOTES,page,{member:'B000002'},context()));assert.throws(()=>check(VOTES,page,{},context()));
});
test('resolved member position arrays may contain multiple Bioguide/LIS matches but not be absent',()=>{
  const page=scoped();page.votes[0].memberVotes.push({voteCast:'Nay',party:'D',state:'MD'});check(VOTES,page,{member:'Synthetic'},context());
  page.votes[0].memberVotes=[];assert.throws(()=>check(VOTES,page,{member:'Synthetic'},context()));
  delete page.votes[0].memberVotes;assert.throws(()=>check(VOTES,page,{member:'Synthetic'},context()));
  const unscoped=votes();unscoped.votes[0].memberVotes=[position()];assert.throws(()=>check(VOTES,unscoped,{},context()));
});
test('resolved member with no matching votes preserves explicit no-inference warning',()=>{
  const page={...empty(),member:memberVotes(),note:'No roll-call vote on record matches — including none cast by Synthetic member under these filters. Say so explicitly; do not infer a vote.'};
  check(VOTES,page,{member:'Synthetic'},context());page.note=note('FederalNoVotesNote');assert.throws(()=>check(VOTES,page,{member:'Synthetic'},context()));
});
test('floor exact bill/chamber/congress selectors and returned counts correlate',()=>{
  const page=votes();check(VOTES,page,{billId:'H.R. 7',chamber:'house',congress:119},context());
  for(const raw of [{billId:'119-hr-8'},{chamber:'senate'},{congress:118}])assert.throws(()=>check(VOTES,page,raw,context()));
  check(VOTES,page,{billId:'invalid',chamber:'unsupported',query:'SQL-owned query'},context());
  page.votesFound=0;assert.throws(()=>check(VOTES,page,{},context()));
});
test('floor max25 and request limit are independent of no total/completeness promise',()=>{
  const page=votes();page.votes=Array.from({length:25},(_,i)=>({...searchVote(),id:`vote-${i}`}));page.votesFound=25;
  check(VOTES,page,{limit:25},context());assert.throws(()=>check(VOTES,page,{limit:24},context()));
  page.votes.push({...searchVote(),id:'extra'});page.votesFound=26;assert.throws(()=>check(VOTES,page,{limit:25},context()));
});
test('duplicate rule/roll-call identities are refused without collapsing separate tuples',()=>{
  const page=bill();page.governingRules.push(rule());assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  const dup=votes();dup.votes.push(searchVote());dup.votesFound=2;assert.throws(()=>check(VOTES,dup,{},context()));
});
test('nested tuple boundaries reject fields projected only by different read modes',()=>{
  const page=bill();page.floorVotes[0].id='search-only';assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  const rulePage=bill();rulePage.governingRules[0].ruleVotes[0].chamber='house';assert.throws(()=>check(BILL,rulePage,{billId:'119-hr-7'},context()));
  const p=scoped();p.votes[0].memberVotes[0].bioguideId='A000001';assert.throws(()=>check(VOTES,p,{member:'Synthetic'},context()));
});
test('closed outputs refuse truth/current-policy/full-evidence claims',()=>{
  for(const [op,make,raw] of [[BILL,bill,{billId:'119-hr-7'}],[VOTES,votes,{}]])for(const key of ['complete','sourceFresh','authorized','tenantId','snapshotId','nextCursor','sourceConnected']){
    const page=make();page[key]=true;assert.throws(()=>check(op,page,raw,context()));
  }
  const page=bill();page.authoritativeOwner='live_congress';assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
});
test('hostile operation/context/input/result admission executes no caller code',()=>{
  let effects=0;const op={get [Symbol.toPrimitive](){effects++;return ()=>BILL;}};
  assert.throws(()=>normalize(op,{},context()));
  assert.throws(()=>normalize(BILL,{get billId(){effects++;return 'H.R. 7';}},context()));
  assert.throws(()=>normalize(BILL,{},new Proxy(context(),{ownKeys(){effects++;return [];}})));
  const page=bill();Object.defineProperty(page,'status',{get(){effects++;return 'enacted';},enumerable:true});
  assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));assert.equal(effects,0);
});
test('canonical admission rejects prototypes, hidden fields, undefined, cycles and nonfinite JSON',()=>{
  for(const raw of [Object.create({billId:'H.R. 7'}),{billId:undefined},{[Symbol('authority')]:true}])assert.throws(()=>normalize(BILL,raw,context()));
  const page=bill();page.floorVotes[0].partyTotals=page;assert.throws(()=>check(BILL,page,{billId:'119-hr-7'},context()));
  const bad=votes();bad.votes[0].yeas=Infinity;assert.throws(()=>check(VOTES,bad,{},context()));
  assert.throws(()=>normalize('constructor',{},context()));
});
