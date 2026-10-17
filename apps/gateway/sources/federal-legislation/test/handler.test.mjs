/** Domain receiving over bounded JSON transport; synthetic source rows, no native execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createFederalLegislationHandlers} from '../handler.mjs';
import {storedCase,ids,note,billVote,governingRule,statusPage,votesPage} from './fixture.mjs';
const json=value=>JSON.parse(JSON.stringify(value));

for(const id of ids){
 test(`${id}: fixed native POST and exact original request proof`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:json(f.page)});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');
  assert.deepEqual(wire.body,id==='get_bill_status'?{billId:'119-hr-1'}:{});
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{defaultCongress:119});
 });
 test(`${id}: current actor, operation grant and source coherence precede credential IO`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.decision.decision='denied',a=>a.decision.operation='list_members@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other',a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));
   assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
  }
 });
 test(`${id}: caller authority, substituted normalization and arguments digest fail before credentials`,async()=>{
  const f=storedCase(id);
  for(const field of ['tenantId','actorId','actorRole','defaultCongress','clientId'])await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,[field]:'forged'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{defaultCongress:119,actorId:'forged'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 });
 test(`${id}: native credential binding, limits, abort and deadline withhold source bytes`,async()=>{
  for(const field of ['normalizationContext','requestSha256','operation','serviceSecret']){
   const f=storedCase(id);f.state.credentialMutator=r=>r[field]=null;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  const missing=storedCase(id);await assert.rejects(missing.handler({getCredentials:undefined})(missing.call()),{message:'UNAVAILABLE'});assert.equal(missing.wire.length,0);
  const small=storedCase(id);await assert.rejects(small.handler({maxResponseBytes:16})(small.call()),{message:'RESOURCE_LIMIT'});
  const cancelled=storedCase(id);await assert.rejects(cancelled.handler()({...cancelled.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(cancelled.wire.length,0);
  const late=storedCase(id);late.state.now=late.authority.deadlineMs;await assert.rejects(late.handler()(late.call()),{message:'DEADLINE'});assert.equal(late.wire.length,0);
 });
 test(`${id}: foreign projections and unsupported completeness cannot release`,async()=>{
  for(const mutate of [p=>p.tool='list_members',p=>p.complete=true,p=>p.sourceFresh=true,p=>p.authorized=true]){
   const f=storedCase(id);f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
}

test('captured defaultCongress selects bill status independently of native calendar and alias spelling',async()=>{
 for(const [request,defaultCongress,billId] of [
  [{billId:'H.R. 1'},118,'118-hr-1'],[{query:' H. Con. Res. 0003 '},119,'119-hconres-3'],
  [{billId:'H.R. 1 (118th)',query:'S. 99'},119,'118-hr-1'],[{billId:'119-HR-00001'},118,'119-hr-00001']]){
  const f=storedCase('get_bill_status',{request,defaultCongress}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(out.result.billId,billId);assert.deepEqual(f.wire[0].body,{...request,billId});
  assert.equal(f.credentialCalls[0].requestSha256,hash(request));assert.deepEqual(f.credentialCalls[0].normalizationContext,{defaultCongress});
 }
});

test('floor bill identity is canonicalized while raw text member chamber and numeric fields stay untouched',async()=>{
 const request={billId:' H.R. 1 ',query:'Q'.repeat(199)+' Z',member:'M'.repeat(79)+' X',chamber:' HOUSE ',congress:'119',limit:'2.9'},f=storedCase('search_floor_votes',{request});
 f.state.page={tool:'search_floor_votes',generatedAt:f.page.generatedAt,votesFound:0,votes:[],note:`Could not resolve a member named "${'M'.repeat(79)} ". Results are NOT scoped to that member — say so explicitly; do not attribute any vote to them.`};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.votesFound,0);
 assert.deepEqual(f.wire[0].body,{...request,billId:'119-hr-1'});assert.equal(f.call().input.member,'M'.repeat(79)+' ');
 assert.equal(f.call().input.query,'Q'.repeat(199)+' ');assert.equal(f.call().input.limit,2);
});

test('floor designation uses captured congress and refuses a different congress in receiving or call normalization',async()=>{
 const f=storedCase('search_floor_votes',{defaultCongress:118,request:{billId:'H.R. 1'}}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.votes[0].billId,'118-hr-1');assert.deepEqual(f.wire[0].body,{billId:'118-hr-1'});
 f.state.resultMutator=p=>p.votes[0].billId='119-hr-1';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 const before=storedCase('search_floor_votes',{request:{billId:'H.R. 1'}}),call=before.call();call.normalizationContext={defaultCongress:118};
 await assert.rejects(before.handler()(call),{message:'INVALID_ARGUMENTS'});assert.equal(before.credentialCalls.length,0);assert.equal(before.wire.length,0);
});

test('invalid selected bill remains raw; status query cannot override a nonempty invalid billId',async()=>{
 for(const request of [{},{billId:'not a bill',query:'H.R. 1'},{billId:' ',query:'not a bill'}]){
  const f=storedCase('get_bill_status',{request}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(out.result.currentStatus,'invalid_request');assert.deepEqual(f.wire[0].body,request);assert.equal(Object.hasOwn(out.result,'billId'),false);
 }
 const f=storedCase('search_floor_votes',{request:{billId:'not a bill',query:'H.R. 1'}});
 await f.handler()(f.call());assert.deepEqual(f.wire[0].body,f.arguments);assert.equal(f.call().input.billId,null);
});

test('stored absent bill is an explicit source result with no invented status',async()=>{
 const f=storedCase();f.state.page={tool:'get_bill_status',authoritativeOwner:'congress_bill_status',currentStatus:'unavailable',generatedAt:f.page.generatedAt,billId:'119-hr-1',found:false,
  note:'No bill 119-hr-1 on record in the Capiro database. Say so explicitly — do not describe its status from memory.'};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.found,false);assert.equal(Object.hasOwn(out.result,'status'),false);
 f.state.resultMutator=p=>p.note=p.note.replace('—','-');await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('stored rule failure never substitutes rule roll calls for the bill floor votes or derives status',async()=>{
 const f=storedCase();f.state.page={...statusPage(),status:'rule_failed',statusLabel:'Rule failed — stalled on the floor',floorVotes:[],
  note:note('FederalNoBillVoteNote')+' '+note('FederalRuleFailedNote')};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.status,'rule_failed');assert.equal(out.result.floorVotes.length,0);
 assert.equal(out.result.governingRules[0].ruleVotes[0].result,'Passed');
 for(const mutate of [p=>delete p.note,p=>p.note=note('FederalRuleFailedNote'),p=>p.statusLabel='Passed a chamber',p=>p.floorVotes=p.governingRules[0].ruleVotes]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('stored opaque status and party totals are preserved without inferring outcomes',async()=>{
 const f=storedCase();f.state.resultMutator=p=>{p.status='future_status';p.statusLabel='future_status';p.floorVotes[0].partyTotals={unverified:{yes:9999}};p.floorVotes[0].yeas=-1;};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.statusLabel,'future_status');assert.equal(out.result.floorVotes[0].result,'Passed');assert.equal(out.result.floorVotes[0].yeas,-1);
 f.state.resultMutator=p=>{p.status='constructor';p.statusLabel='constructor';};await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('bill action and vote windows retain separate ordering identities and bounds',async()=>{
 for(const mutate of [p=>p.recentActions.push({...p.recentActions[0],date:new Date('2026-10-13T00:00:00.000Z')}),p=>p.floorVotes.push({...billVote(),voteDate:new Date('2026-10-13T00:00:00.000Z')}),p=>p.governingRules.push(governingRule()),p=>p.governingRules[0].ruleVotes=Array.from({length:4},()=>governingRule().ruleVotes[0])]){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('ambiguous member stays unresolved and never releases or attributes unscoped roll calls',async()=>{
 const f=storedCase('search_floor_votes',{request:{member:'Smith'}}),candidate=(bioguideId)=>({bioguideId,fullName:'Synthetic Smith',chamber:'house',state:null,party:null,isCurrent:true});
 f.state.page={tool:'search_floor_votes',generatedAt:f.page.generatedAt,votesFound:0,votes:[],ambiguousMember:[candidate('A000001'),candidate('B000002')],
  note:'"Smith" matches 2 members — ask the user which (by state/chamber/full name) before attributing votes. Results are NOT scoped to a member yet.'};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.ambiguousMember.length,2);assert.equal(Object.hasOwn(out.result,'member'),false);
 for(const mutate of [p=>{p.votes=votesPage().votes;p.votesFound=1;},p=>p.member={bioguideId:'A000001',fullName:'Synthetic Smith'},p=>p.ambiguousMember[1]=p.ambiguousMember[0]]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('missing name and missing Bioguide member stay empty with precise attribution refusals',async()=>{
 for(const [member,message] of [['A000001','No member with Bioguide id A000001 is on record. Results are NOT scoped to a member — say so; do not attribute votes.'],['Smith','Could not resolve a member named "Smith". Results are NOT scoped to that member — say so explicitly; do not attribute any vote to them.']]){
  const f=storedCase('search_floor_votes',{request:{member}});f.state.page={tool:'search_floor_votes',generatedAt:f.page.generatedAt,votesFound:0,votes:[],note:message};
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.votesFound,0);
  f.state.resultMutator=p=>{p.votes=votesPage().votes;p.votesFound=1;};await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('resolved member requires exact Bioguide identity and returned member-position evidence',async()=>{
 const f=storedCase('search_floor_votes',{request:{member:'a000001',billId:'H.R. 1',chamber:'house',congress:119,limit:1}});
 f.state.page={...votesPage(),member:{bioguideId:'A000001',fullName:'Synthetic Member'}};
 f.state.page.votes[0].memberVotes=[{voteCast:'Yea',party:null,state:null},{voteCast:'Present',party:'Other',state:'XX'}];
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.votes[0].memberVotes.length,2);
 for(const mutate of [p=>p.member.bioguideId='B000002',p=>delete p.votes[0].memberVotes,p=>p.votes[0].memberVotes=[],p=>p.votes[0].billId='119-hr-2',p=>p.votes[0].chamber='senate',p=>p.votes[0].congress=118]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('vote count is returned length and limited window; absence does not imply outcome',async()=>{
 const f=storedCase('search_floor_votes',{request:{limit:1}});f.state.page={tool:'search_floor_votes',generatedAt:f.page.generatedAt,votesFound:0,votes:[],note:note('FederalNoVotesNote')};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.votesFound,0);assert.match(out.result.note,/do not infer a vote outcome or tally/);
 for(const mutate of [p=>p.votesFound=1,p=>p.note='No votes means failed']){f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});}
 const unscoped=storedCase('search_floor_votes');unscoped.state.resultMutator=p=>p.votes[0].memberVotes=[{voteCast:'Yea',party:null,state:null}];
 await assert.rejects(unscoped.handler()(unscoped.call()),{message:'INVALID_RESULT'});
});

test('per-call credentials see original call and late abort withholds a completed source result',async()=>{
 const f=storedCase(),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
 const handler=createFederalLegislationHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{captured={operation,original};return getCredentials;}},[f.operation])[0];
 await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);
 const late=storedCase(),controller=new AbortController();late.state.afterSource=()=>controller.abort();
 await assert.rejects(late.handler()({...late.call(),signal:controller.signal}),{message:'CANCELLED'});assert.equal(late.wire.length,1);
});

test('family construction rejects foreign duplicate and wrong-version operations without source calls',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'list_members',version:'0.2.0'}],[{id:'get_bill_status',version:'0.1.0'}]])
  assert.throws(()=>createFederalLegislationHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(f.wire.length,0);
});
