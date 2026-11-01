/** Synthetic Core and journal boundaries for the saved-note intent: the real note client, preparer, intent
 *  journal, mount and result release run over real wire validators. Nothing is deployed evidence, and no test
 *  answers itself: every released result is the envelope the real owner produced from the scripted Core reply. */
import fixtures from './note-core-fixtures.json' with {type:'json'};
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createNoteClient} from '../../../runtime/native-authority/note-client.mjs';
import {createNoteIntentPreparer} from '../note-preparer.mjs';
import {createIntentMount} from '../mount.mjs';
import {createIntentApprovalOwner} from '../approval.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {assertPreparedResult} from '../../../worker/conversation/intents/prepared.mjs';
import {binding as seedBinding,id} from '../../conversations/test/store-fixture.mjs';
const NOW=1800000000000,delivery=n=>'sdk:'+String(n).padStart(64,'0'),operation={id:'save_note',version:'0.2.0'};
function mount({binding,scopes,preparers,resultRelease}){
 const rows=new Map(),key=k=>JSON.stringify(k),clone=structuredClone;
 const port={
  async claim({key:k,record}){const at=key(k);if(rows.has(at))return {claimed:false,entry:clone(rows.get(at))};rows.set(at,{record:clone(record),state:'PENDING',outcome:null});return {claimed:true};},
  async settle({key:k,record,state,outcome}){const row=rows.get(key(k));assert.equal(row.state,'PENDING');assert.equal(hash(record),hash(row.record));Object.assign(row,{state,outcome:clone(outcome)});return clone(row);},
  async read({key:k}){return clone(rows.get(key(k))??null);},
  async list({conversation:c}){return {entries:[...rows].filter(([k])=>{const v=JSON.parse(k);return ['tenantId','actorId','conversationId'].every(n=>v[n]===c[n]);}).map(([k,v])=>({deliveryId:JSON.parse(k).deliveryId,createdAt:new Date(NOW).toISOString(),...clone(v)})),next:null};},
 };
 const authority=resultRelease??{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:NOW,expiresAtMs:NOW+60000};}};
 return {store:{rows,port},mount:createIntentMount({binding,preparers,journalStore:port,now:()=>NOW,limits:{maxRequestMs:5000},enabled:true,resultRelease:authority})};
}
function setup({selectedClientId=id(5),resultRelease}={}){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5);
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}];
 const state={paths:[],prepares:0,status:'succeeded',policyOutcome:'PASS',errorCode:null,errorMessage:null,loseAck:false,denied:false,revoked:false,revokeAfterSave:false,rawConversationInRequest:false};
 const client=createNoteClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service',reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:'synthetic-attended',expiresAtMs:NOW+60000}),async fetchImpl(url,init){
  const path=new URL(url).pathname,body=JSON.parse(init.body);state.paths.push(path);
  assert.equal(init.headers.authorization,'Bearer synthetic-attended');
  assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');
  assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
  assert.ok(Number(init.headers['x-meri-deadline-at'])>NOW);
  if(state.denied)return Response.json({error:'denied'},{status:403});
  assert.ok(path.endsWith('/prepare_note_action'));state.prepares++;
  assert.deepEqual(Object.keys(body).sort(),['context','request','version']);
  // Nothing invented crosses to strict Core: no caller conversation and no caller-chosen idempotency key.
  assert.ok(!('conversationId' in body.request)&&!('requestKey' in body.request));
  if(state.loseAck)throw Error('lost save acknowledgement');
  if(state.producer)assert.deepEqual(body.request,state.producer.request);
  const request=body.request,generatedAt=new Date(NOW).toISOString(),bodyHash=hash({body:request.body,length:request.body.length});
  const receipt=request.meetingId!==undefined
   ?{destination:'meeting',noteId:id(40),meetingNoteId:id(41),meetingNoteStatus:'published',confidential:false,accessLevel:'internal',readiness:'ready',bodyHash,generatedAt}
   :request.clientId!==undefined
    ?{destination:'client_document',noteId:id(42),documentId:id(42),location:'https://core.invalid/files?attachmentId='+id(42),indexingStatus:'pending',reused:false,readiness:'indexing',bodyHash,generatedAt}
    :{destination:'general',noteId:id(43),clientId:null,readiness:'ready',bodyHash,generatedAt};
  const response={version:'0.1.0',proposalId:id(30),status:state.status,policyOutcome:state.policyOutcome,
   request:state.producer?.view??{tool:'save_note',bodyHash,bodyLength:request.body.length,title:request.title??null,clientId:request.clientId??null,meetingId:request.meetingId??null,confidential:request.confidential??null,accessLevel:request.accessLevel??null,
    ...(state.rawConversationInRequest?{conversationId:body.context.conversationId}:{})},
   context:{conversationId:body.context.conversationId,selectedClientId:body.context.selectedClientId,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},
   createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),
   receipt:state.status==='succeeded'?(state.producer?.receipt??receipt):null,
   ...(state.status==='succeeded'?{}:{errorCode:state.errorCode,errorMessage:state.errorMessage})};
  if(state.revokeAfterSave)state.revoked=true;
  return Response.json(response);
 }});
 const preparer=createNoteIntentPreparer({binding,scopes,selectedClientId,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.revoked?[]:scopes,expiresAtMs:NOW+60000})});
 const m=mount({binding,scopes,preparers:[preparer],resultRelease});
 return {state,binding,scopes,rows:m.store.rows,store:m.store,mount:m.mount,prepare:(args,n=1)=>m.mount.prepare({operation,arguments:args,deliveryId:delivery(n)})};
}
test('a general note saves once, replays exactly and releases the recorded result',async()=>{
 const f=setup({selectedClientId:null}),args={body:'General note text'},prepared=await f.prepare(args,1);
 assert.equal(prepared.status,'saved');assert.equal(prepared.destination,'general');assert.equal(prepared.noteId,id(43));
 assert.equal(prepared.operation,'save_note');assert.equal(prepared.policyOutcome,'PASS');
 assert.equal(prepared.bodyLength,args.body.length);assert.equal(prepared.bodyHash,hash({body:args.body,length:args.body.length}));
 assert.equal(prepared.meetingNoteId,null);assert.equal(prepared.documentId,null);assert.equal(prepared.readiness,'ready');
 assert.ok(!JSON.stringify(prepared).includes('General note text'));
 assert.equal(f.state.prepares,1);
 assert.deepEqual(await f.prepare(args,1),prepared);
 assert.equal(f.state.prepares,1);
 const entry=[...f.rows.values()][0];
 assert.equal(entry.state,'PREPARED');assert.deepEqual(entry.outcome.result,prepared);
 const admitted=assertPreparedResult('note',operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW});
 assert.equal(admitted.status,'saved');assert.equal(admitted.reference,prepared.noteId);
});
test('a client Files document that is still indexing is never surfaced as a ready file',async()=>{
 const f=setup(),args={body:'Client note text',clientId:id(5)},prepared=await f.prepare(args,2);
 assert.equal(prepared.status,'saved');assert.equal(prepared.destination,'client_document');
 assert.equal(prepared.documentId,id(42));assert.equal(prepared.noteId,id(42));
 assert.ok(prepared.location.includes('attachmentId='+id(42)));
 assert.equal(prepared.indexingStatus,'pending');assert.equal(prepared.readiness,'indexing');
 assert.notEqual(prepared.readiness,'ready');assert.notEqual(prepared.readiness,'indexed');
 assert.equal(prepared.reused,false);assert.equal(prepared.meetingNoteId,null);
});
test('a meeting note surfaces the meeting-note identity of the two-write owner',async()=>{
 const f=setup(),prepared=await f.prepare({body:'Meeting note text',meetingId:id(7)},3);
 assert.equal(prepared.status,'saved');assert.equal(prepared.destination,'meeting');
 assert.equal(prepared.meetingNoteId,id(41));assert.equal(prepared.noteId,id(40));
 assert.equal(prepared.readiness,'ready');assert.equal(prepared.documentId,null);assert.equal(prepared.indexingStatus,null);
});
test('an unanswered meeting save is UNKNOWN and is never resent',async()=>{
 const f=setup();f.state.status='outcome_unknown';f.state.errorCode='note_outcome_unknown';f.state.errorMessage='No confirmed saved-note receipt';
 const args={body:'Ambiguous meeting note',meetingId:id(7)},prepared=await f.prepare(args,4);
 assert.equal(prepared.status,'unknown');assert.equal(prepared.destination,null);assert.equal(prepared.noteId,null);
 assert.equal(prepared.meetingNoteId,null);assert.equal(prepared.readiness,null);
 assert.equal(prepared.errorCode,'note_outcome_unknown');assert.equal(f.state.prepares,1);
 assert.deepEqual(await f.prepare(args,4),prepared);assert.equal(f.state.prepares,1);
});
test('a lost save acknowledgement stays UNKNOWN without another save',async()=>{
 const f=setup();f.state.loseAck=true;const args={body:'Lost note'};
 await assert.rejects(f.prepare(args,5),{code:'UNKNOWN'});
 f.state.loseAck=false;
 await assert.rejects(f.prepare(args,5),{code:'UNKNOWN'});
 assert.equal(f.state.prepares,1);
});
test('a revoked principal never receives the recorded receipt and is never resent',async()=>{
 const f=setup();f.state.revokeAfterSave=true;const args={body:'Revoked note'};
 await assert.rejects(f.prepare(args,6),{code:'UNKNOWN'});
 assert.equal(f.state.prepares,1);
 await assert.rejects(f.prepare(args,6),{code:'UNKNOWN'});
 assert.equal(f.state.prepares,1);
});
test('a policy WARN is withheld with no receipt identity and no approval route',async()=>{
 const f=setup();f.state.status='proposed';f.state.policyOutcome='WARN';f.state.errorCode=null;
 const prepared=await f.prepare({body:'Warned note'},7);
 assert.equal(prepared.status,'withheld');assert.equal(prepared.policyOutcome,'WARN');assert.equal(prepared.errorCode,'note_withheld_policy');
 for(const k of ['destination','noteId','meetingNoteId','documentId','location','indexingStatus','readiness','reused'])assert.equal(prepared[k],null);
 assert.deepEqual(Object.keys(f.mount).sort(),['prepare','readAvailability']);
});
test('a BLOCK is blocked and never carries a receipt',async()=>{
 const f=setup();f.state.status='blocked';f.state.policyOutcome='BLOCK';f.state.errorCode='note_blocked';
 const prepared=await f.prepare({body:'Blocked note'},8);
 assert.equal(prepared.status,'blocked');assert.equal(prepared.policyOutcome,'BLOCK');
 assert.equal(prepared.noteId,null);assert.equal(prepared.errorCode,'note_blocked');
});
test('a terminal failure is failed with a code and no receipt identity',async()=>{
 const f=setup();f.state.status='failed_terminal';f.state.errorCode='note_failed';
 const prepared=await f.prepare({body:'Failed note'},9);
 assert.equal(prepared.status,'failed');assert.equal(prepared.noteId,null);assert.equal(prepared.errorCode,'note_failed');
});
test('invalid arguments and a foreign client refuse before any Core call',async()=>{
 const f=setup();let n=10;
 for(const bad of [{body:''},{body:'x'.repeat(40001)},{body:'ok',title:'x'.repeat(161)},{body:'ok',clientId:'not-a-uuid'},{body:'ok',meetingId:'not-a-uuid'},{body:'ok',confidential:'true'},{body:'ok',accessLevel:42},{body:'ok',conversationId:id(99)},{body:'ok',requestKey:'caller-chosen'}])
  await assert.rejects(f.prepare(bad,n++),{code:'INVALID_ARGUMENTS'});
 assert.equal(f.state.paths.length,0);
 const g=setup({selectedClientId:id(6)});
 await assert.rejects(g.prepare({body:'Foreign client note',clientId:id(5)},99),{code:'ACCESS_DENIED'});
 assert.equal(g.state.paths.length,0);
});
test('a Core reply that is not the closed body-free view is refused and never released',async()=>{
 const f=setup();f.state.rawConversationInRequest=true;
 await assert.rejects(f.prepare({body:'Unopened shape'},11),{code:'UNKNOWN'});
 assert.equal(f.state.prepares,1);
});
test('releasing a recorded result still requires current authority',async()=>{
 const scope={tenantId:id(80),kind:'client',resourceId:id(5),policyRevision:'p1'};
 const f=setup({selectedClientId:null,resultRelease:{async check({selection,selectionSha256}){return {authorized:false,selectionSha256,binding:selection.binding,scopes:[scope],checkedAtMs:NOW,expiresAtMs:NOW+60000};}}});
 await assert.rejects(f.prepare({body:'No current authority'},12),{code:'ACCESS_DENIED'});
 assert.equal(f.state.prepares,0);
});
test('a saved note is typed history, withheld whole when its client is no longer visible, and never approvable',async()=>{
 const f=setup({selectedClientId:null}),prepared=await f.prepare({body:'Typed note'},14);
 const owner=createIntentApprovalOwner({journal:f.store.port,now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
 const principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId,clientIds:[id(5)]},request={conversationId:f.binding.conversationId};
 const listed=await owner.list({principal,request});
 assert.equal(listed.intents.length,1);assert.equal(listed.intents[0].state,'prepared');assert.equal(listed.intents[0].kind,'saved_note');
 assert.deepEqual(listed.intents[0].result,prepared);assert.equal(listed.intents[0].proposal,undefined);assert.equal(listed.intents[0].decision,undefined);
 const hidden=await owner.list({principal:{...principal,clientIds:[]},request});
 assert.equal(hidden.intents[0].kind,'saved_note');assert.equal(hidden.intents[0].withheld,true);assert.equal(hidden.intents[0].result,undefined);
 assert.equal((await owner.list({principal:{...principal,tenantId:id(99)},request})).intents.length,0);
 await assert.rejects(owner.decide({principal,request:{...request,deliveryId:delivery(14),proposalId:prepared.proposalId,commandSha256:'f'.repeat(64),decision:'approved'}}),{message:'INTENT_NOT_APPROVABLE'});
 assert.equal(f.state.prepares,1);
});
test("the worker admits only this run's own saved-note envelope",async()=>{
 const f=setup({selectedClientId:null}),prepared=await f.prepare({body:'Admitted note'},13);
 assert.equal(assertPreparedResult('note',operation,prepared,f.binding,{scopes:f.scopes,nowMs:NOW}).status,'saved');
 assert.throws(()=>assertPreparedResult('note',operation,prepared,{...f.binding,tenantId:id(99)},{scopes:f.scopes,nowMs:NOW}));
 assert.throws(()=>assertPreparedResult('note',{id:'save_note',version:'0.1.0'},prepared,f.binding,{scopes:f.scopes,nowMs:NOW}));
 assert.throws(()=>assertPreparedResult('note',operation,{...prepared,status:'executing'},f.binding,{scopes:f.scopes,nowMs:NOW}));
 assert.throws(()=>assertPreparedResult('note',operation,{...prepared,scopes:[{...f.scopes[0],resourceId:id(9)}]},f.binding,{scopes:f.scopes,nowMs:NOW}));
});


test('actual Core normalized bodies cross the mounted note owner and public receiver without another save',async()=>{
 for(const producer of fixtures){
  const f=setup({selectedClientId:null});f.state.producer=producer;
  const result=await f.prepare(producer.input,90);
  assert.equal(result.status,'saved');assert.equal(result.bodyHash,producer.view.bodyHash);assert.equal(result.bodyLength,producer.view.bodyLength);
  assert.deepEqual(await f.prepare(producer.input,90),result);assert.equal(f.state.prepares,1);
  const owner=createIntentApprovalOwner({journal:f.store.port,now:()=>NOW,limits:{maxRequestMs:5000},enabled:true});
  const request={conversationId:f.binding.conversationId},principal={tenantId:f.binding.tenantId,actorId:f.binding.actorId,clientIds:[id(5)]};
  const listed=await owner.list({principal,request});
  assert.equal((await receiveIntentsResponse('list',200,JSON.stringify(listed),{request})).intents[0].result.status,'saved');
  for(const change of [v=>v.intents[0].result.binding.conversationId=id(99),v=>v.intents[0].result.policyOutcome='WARN',v=>v.intents[0].result.meetingNoteId=id(99),v=>v.intents[0].operation.id='watch_action']){
   const bad=structuredClone(listed);change(bad);await assert.rejects(receiveIntentsResponse('list',200,JSON.stringify(bad),{request}));
  }
 }
});
test('in a client conversation a plain note is stamped with the selected client, never saved to General silently',async()=>{
 const f=setup(),prepared=await f.prepare({body:'Client conversation note'},12);
 assert.equal(prepared.status,'saved');assert.equal(prepared.destination,'client_document');assert.equal(prepared.documentId,id(42));assert.equal(f.state.prepares,1);
 // A meeting note keeps the meeting destination: the canonical meeting owner resolves the client.
 const meeting=await f.prepare({body:'Meeting note',meetingId:id(41)},13);assert.equal(meeting.destination,'meeting');
});
