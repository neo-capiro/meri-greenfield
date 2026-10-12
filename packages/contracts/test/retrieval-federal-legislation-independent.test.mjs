import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const source=process.env.MERI_FEDERAL_REVIEW_SOURCE_ROOT?pathToFileURL(process.env.MERI_FEDERAL_REVIEW_SOURCE_ROOT.replace(/\/$/,'')+'/packages/contracts/'):new URL('../',import.meta.url);
const {createFederalLegislationValidators}=await import(new URL('retrieval-0.2/federal-legislation-validation.mjs',source));
const schema=JSON.parse(readFileSync(new URL('retrieval-0.2/federal-legislation.schema.json',source)));
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);ajv.addSchema(schema);
const shapes=new Map(Object.keys(schema.$defs).map(n=>[n,ajv.compile({$ref:`${schema.$id}#/$defs/${n}`})]));
const family=createFederalLegislationValidators({schema,validateShape(n,v){assert.equal(shapes.get(n)(v),true,`Invalid ${n}`);return v;}});
const normalize=family.normalizeFederalLegislationInput,check=family.assertFederalLegislationOutput;
const B='get_bill_status',V='search_floor_votes',T='2026-10-01T12:00:00.000Z',D='2026-10-01T00:00:00.000Z',prior='2026-09-01T12:00:00.000Z';
const ctx={defaultCongress:119},id='119-hr-1',raw={billId:id};
// Independent synthetic projections only, not legacy implementation or actual rows.
function action(){return {date:T,text:'Synthetic action',type:null,chamber:null};}
function billVote(){return {chamber:'house',rollNumber:1,question:null,result:null,voteType:null,voteDate:T,yeas:0,nays:0,present:0,notVoting:0,partyTotals:null,sourceUrl:null};}
function rule(){return {ruleBillId:'119-hres-2',ruleTitle:null,ruleStatus:null,ruleLatestAction:null,ruleVotes:[{rollNumber:1,result:null,yeas:0,nays:0,voteDate:T,question:null,sourceUrl:null}]};}
function bill(){return {tool:B,authoritativeOwner:'congress_bill_status',currentStatus:'available',generatedAt:T,billId:id,found:true,title:'Synthetic bill',congress:119,status:'custom_status',statusLabel:'custom_status',statusAt:null,latestAction:{text:null,date:null},sponsor:{name:null,bioguideId:null},cosponsorsCount:0,recentActions:[action()],floorVotes:[billVote()],governingRules:[rule()]};}
const invalid=()=>({tool:B,authoritativeOwner:'congress_bill_status',currentStatus:'invalid_request',generatedAt:T,found:false,note:schema.$defs.FederalInvalidBillNote.const});
const unavailable=()=>({...invalid(),billId:id,currentStatus:'unavailable',note:`No bill ${id} on record in the Capiro database. Say so explicitly — do not describe its status from memory.`});
function vote(){return {id:'vote-synthetic',congress:119,session:1,billId:id,title:null,...billVote()};}
function votes(){return {tool:V,generatedAt:T,votesFound:1,votes:[vote()]};}
const candidate=(id='A000001')=>({bioguideId:id,fullName:'Synthetic Member',chamber:'house',state:null,party:null,isCurrent:true});
function ambiguity(){return {tool:V,generatedAt:T,votesFound:0,votes:[],ambiguousMember:[candidate(),candidate('B000002')],note:'"Smith" matches 2 members — ask the user which (by state/chamber/full name) before attributing votes. Results are NOT scoped to a member yet.'};}
function memberVotes(){const p=votes();p.member={bioguideId:'A000001',fullName:'Synthetic Member'};p.votes[0].memberVotes=[{voteCast:'Yea',party:null,state:null}];return p;}
const reject=(op,p,input=op===B?raw:{},options=ctx)=>assert.throws(()=>check(op,p,input,options));
function mutants(op,make,list,input=op===B?raw:{}){for(const m of list){const p=make();m(p);reject(op,p,input);}}

test('independent bill invalid unavailable found and ordinary vote branches admit',()=>{
  check(B,invalid(),{},ctx);check(B,unavailable(),raw,ctx);check(B,bill(),raw,ctx);check(V,votes(),{},ctx);
});
test('default congress is explicit trusted context with no model authority fields',()=>{
  assert.throws(()=>normalize(B,raw));for(const options of [{defaultCongress:0},{defaultCongress:'119'},{defaultCongress:119,actorId:'forged'},{defaultCongress:119,authorized:true}])assert.throws(()=>normalize(B,raw,options));
  for(const x of [{...raw,defaultCongress:118},{...raw,tenantId:'x'},{...raw,actorId:'x'},{...raw,cursor:'x'}])assert.throws(()=>normalize(B,x,ctx));
});
test('bill designation grammar preserves canonical and explicit congress precedence',()=>{
  const p=bill();check(B,p,{billId:'H.R. 1'},ctx);check(B,p,{query:'H R 1'},ctx);check(B,p,{billId:'H.R. 1 (119)'},{defaultCongress:118});check(B,p,{billId:id,query:'S. 9'},ctx);
  const alternate=bill();alternate.billId='118-hr-1';alternate.congress=118;check(B,alternate,{billId:'H.R. 1'},{defaultCongress:118});
});
test('bill invalid and unavailable branches cannot claim resolved or successful data',()=>{
  reject(B,unavailable(),{});reject(B,invalid(),raw);reject(B,bill(),{});
  mutants(B,unavailable,[p=>p.found=true,p=>p.currentStatus='available',p=>p.title='leaked',p=>p.billId='119-s-2']);
  const bad=invalid();bad.billId=id;reject(B,bad,{});
});
test('bill owner markers and resolved identity stay exact while stored congress remains a separate column',()=>{
  mutants(B,bill,[p=>p.authoritativeOwner='federal_evidence_current',p=>p.currentStatus='fresh',p=>p.found=false,p=>p.billId='119-s-2']);
  const p=bill();p.congress=118;check(B,p,raw,ctx);
});
test('stored unknown null and empty statuses retain exact label semantics',()=>{
  for(const [status,label] of [[null,'Unknown'],['',''],['future_status','future_status'],['constructor','constructor'],['__proto__','__proto__']]){const p=bill();p.status=status;p.statusLabel=label;check(B,p,raw,ctx);p.statusLabel='invented';reject(B,p);}
});
test('actions and direct floor votes have separate fifteen-row windows without count proof',()=>{
  const p=bill();p.recentActions=Array.from({length:15},action);p.floorVotes=Array.from({length:15},billVote);check(B,p,raw,ctx);p.recentActions.push(action());reject(B,p);p.recentActions.pop();p.floorVotes.push(billVote());reject(B,p);
  mutants(B,bill,[p=>p.complete=true,p=>p.totalActions=15,p=>p.hasMore=false]);
});
test('governing rule uniqueness and three-vote bound do not imply history completeness',()=>{
  const p=bill();p.governingRules[0].ruleVotes=Array.from({length:3},()=>rule().ruleVotes[0]);check(B,p,raw,ctx);p.governingRules[0].ruleVotes.push(rule().ruleVotes[0]);reject(B,p);
  const duplicate=bill();duplicate.governingRules.push(rule());reject(B,duplicate);
});
test('bill date fields preserve date-only latestAction but general status/action instants',()=>{
  const p=bill();p.latestAction.date=D;p.statusAt=T;check(B,p,raw,ctx);p.latestAction.date=T;reject(B,p);
  mutants(B,bill,[p=>p.statusAt='2016-12-31T23:59:60Z',p=>p.recentActions[0].date='bad',p=>p.floorVotes[0].voteDate='bad']);
});
test('each bill action and vote history descends while tied dates remain admissible',()=>{
  const p=bill();p.recentActions.push({...action(),date:prior});check(B,p,raw,ctx);p.recentActions.reverse();reject(B,p);
  const v=bill();v.floorVotes.push({...billVote(),voteDate:prior});check(B,v,raw,ctx);v.floorVotes.reverse();reject(B,v);
});
test('opaque partyTotals and signed Int storage fields are not turned into tally or outcome proof',()=>{
  for(const partyTotals of [null,[],{},'opaque',3,true,{D:{yes:1000}}]){const p=bill();p.floorVotes[0].partyTotals=partyTotals;p.floorVotes[0].yeas=-1;p.cosponsorsCount=-1;check(B,p,raw,ctx);}
  mutants(B,bill,[p=>p.floorVotes[0].yeas=2147483648,p=>p.cosponsorsCount=1.2]);
});
test('floor votes count is returned length and request bound not a global source count',()=>{
  mutants(V,votes,[p=>p.votesFound=0,p=>p.votesFound=2,p=>p.total=1,p=>p.hasMore=true]);
  const p=votes();p.votes.push({...vote(),id:'other'});reject(V,p,{limit:1});
});
test('floor exact bill/chamber/congress selectors refuse substitution',()=>{
  check(V,votes(),{billId:id,chamber:'HOUSE',congress:'119'},ctx);
  reject(V,votes(),{billId:'119-s-2'});reject(V,votes(),{chamber:'senate'});reject(V,votes(),{congress:118});
});
test('invalid floor bill/chamber become no filter rather than an invented scoped request',()=>{
  check(V,votes(),{billId:'not a bill',chamber:'invalid'},ctx);
  check(V,votes(),{query:'source question or title match'},ctx);
});
test('floor member not-found and ambiguous branches are empty and conditional',()=>{
  const empty={tool:V,generatedAt:T,votesFound:0,votes:[],note:'No member with Bioguide id A000001 is on record. Results are NOT scoped to a member — say so; do not attribute votes.'};check(V,empty,{member:'A000001'},ctx);check(V,ambiguity(),{member:'Smith'},ctx);
  reject(V,ambiguity(),{});reject(V,ambiguity(),{member:'A000001'});const p=ambiguity();p.votes=[vote()];p.votesFound=1;reject(V,p,{member:'Smith'});
});
test('ambiguity requires bounded multiple distinct candidates and no resolved member',()=>{
  const p=ambiguity();p.ambiguousMember.pop();reject(V,p,{member:'Smith'});p.ambiguousMember=[candidate(),candidate()];reject(V,p,{member:'Smith'});p.ambiguousMember=Array.from({length:9},(_,i)=>candidate(`A${String(i).padStart(6,'0')}`));reject(V,p,{member:'Smith'});
  const q=ambiguity();q.member={bioguideId:'A000001',fullName:'Synthetic'};reject(V,q,{member:'Smith'});
});
test('canonical member result matches requested identity and keeps conditional vote records',()=>{
  check(V,memberVotes(),{member:'a000001'},ctx);reject(V,memberVotes(),{member:'B000002'});reject(V,memberVotes(),{});
  const p=memberVotes();delete p.votes[0].memberVotes;reject(V,p,{member:'A000001'});
  const q=votes();q.votes[0].memberVotes=[{voteCast:'Yea',party:null,state:null}];reject(V,q,{});
});
test('multiple matched member records are preserved but empty resolved nested match fails closed',()=>{
  const p=memberVotes();p.votes[0].memberVotes.push({voteCast:'Present',party:'Other',state:'XX'});check(V,p,{member:'A000001'},ctx);p.votes[0].memberVotes=[];reject(V,p,{member:'A000001'});
});
test('votes without a matching source member cannot silently enter unfiltered success branch',()=>{
  reject(V,votes(),{member:'A000001'});const p=memberVotes();p.votes[0].memberVotes[0].actorId='invented';reject(V,p,{member:'A000001'});
});
test('full vote identity uniqueness and descending time keep ties without fabricated roll sequence',()=>{
  const p=votes();p.votes.push({...vote(),id:'other'});p.votesFound=2;check(V,p,{},ctx);p.votes[1].id=p.votes[0].id;reject(V,p);p.votes[1].id='other';p.votes[1].voteDate=prior;check(V,p,{},ctx);p.votes.reverse();reject(V,p);
});
test('all nullable fields remain required and unprojected data cannot leak',()=>{
  mutants(B,bill,[p=>delete p.sponsor.name,p=>delete p.statusAt,p=>p.policyArea='unprojected',p=>p.floorVotes[0].billId=id]);
  mutants(V,votes,[p=>delete p.votes[0].question,p=>p.votes[0].source='stored-unprojected',p=>p.votes[0].lastSyncedAt=T,p=>p.authorized=true]);
});
test('operation selector, raw inputs and trusted options admit no coercion/accessor effects',()=>{
  let effects=0;const op={};Object.defineProperty(op,Symbol.toPrimitive,{get(){effects++;return ()=>B;}});assert.throws(()=>normalize(op,raw,ctx));
  const input={};Object.defineProperty(input,'billId',{enumerable:true,get(){effects++;return id;}});assert.throws(()=>normalize(B,input,ctx));
  const proxy=new Proxy(ctx,{get(){effects++;throw Error('effect');},ownKeys(){effects++;throw Error('effect');}});assert.throws(()=>normalize(B,raw,proxy));assert.equal(effects,0);
});
test('nested arbitrary JSON rejects effects and non-JSON values without interpreting party totals',()=>{
  let effects=0;const p=bill();p.floorVotes[0].partyTotals={};Object.defineProperty(p.floorVotes[0].partyTotals,'D',{enumerable:true,get(){effects++;return 1;}});reject(B,p);assert.equal(effects,0);
  mutants(V,votes,[p=>p.votes[0].partyTotals=NaN,p=>p.votes[0].partyTotals={[Symbol('bad')]:1},p=>p.generatedAt=new Date(T)]);
});
test('no-bill-vote and rule-failed warnings remain separate and required',()=>{
  const p=bill();p.floorVotes=[];reject(B,p);p.note=schema.$defs.FederalNoBillVoteNote.const;check(B,p,raw,ctx);
  p.status='rule_failed';p.statusLabel=schema.$defs.FederalBillStatusLabels.const.rule_failed;reject(B,p);p.note+=' '+schema.$defs.FederalRuleFailedNote.const;check(B,p,raw,ctx);
  const q=bill();q.note='Unsupported proof';reject(B,q);
});
test('floor scalar defaults and ineffective zero numeric filters are explicit',()=>{
  const n=normalize(V,{},ctx);assert.equal(n.limit,10);assert.equal(n.congress,null);assert.equal(n.chamber,null);assert.equal(n.billId,null);assert.equal(n.member,null);assert.equal(n.bioguideId,null);
  for(const congress of [null,0,'0','','bad'])assert.equal(normalize(V,{congress},ctx).congress,null);
  assert.equal(normalize(V,{limit:'2.9'},ctx).limit,2);assert.equal(normalize(V,{limit:999},ctx).limit,25);assert.equal(normalize(V,{limit:' '},ctx).limit,1);
  for(const raw of [{congress:1.5},{congress:2147483648},{congress:'Infinity'},{limit:true},{member:9}])assert.throws(()=>normalize(V,raw,ctx));
  assert.equal(normalize(B,{billId:'119-HR-00001'},ctx).billId,'119-hr-00001');assert.equal(normalize(B,{billId:'H.R. 00001'},ctx).billId,id);
});
