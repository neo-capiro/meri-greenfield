/**
 * Focused developer checks for the two watch leaves that are entirely ours
 * (runtime/native-authority/watch-client.mjs, control/intents/watch-preparer.mjs)
 * against synthetic Core responses and the real wire validators. The full mount /
 * approval composition test (watch.test.mjs) additionally needs the shared S3 edits.
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {createWatchCoreClient} from '../../../runtime/native-authority/watch-client.mjs';
import {createWatchPreparer} from '../watch-preparer.mjs';
import {watchValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {binding as seedBinding,id} from '../../conversations/test/store-fixture.mjs';
const NOW=1800000000000;
const REV={identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)};
function harness(state={}){
 const binding={...seedBinding,tenantId:id(80),actorId:id(81)},clientId=id(5),
  scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'p1'}],
  request={family:'legiwatch_keyword',clientId,targetKind:'keyword_rule',targetKey:'rule-1',operation:'pause',expectedVersion:4,sourceRevision:null,reason:null,enabled:null},
  calls=[];
 const client=createWatchCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service',reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:'synthetic-attended',expiresAtMs:NOW+60000}),async fetchImpl(url,init){
  const path=new URL(url).pathname;calls.push(path);
  assert.equal(init.headers.authorization,'Bearer synthetic-attended');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');
  const body=JSON.parse(init.body);
  if(path.endsWith('/prepare_watch_action')){
   if(state.lose)throw Error('lost prepare');
   const status=state.status??'proposed',proposalId=id(10);
   return Response.json({version:'0.1.0',proposalId,status,request:body.request,context:{...body.context,...REV},createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),receipt:status==='succeeded'?{request:body.request,owner:body.request.family,binding:hash({family:body.request.family,clientId:body.request.clientId,targetKind:body.request.targetKind,targetKey:body.request.targetKey,operation:body.request.operation,expectedVersion:body.request.expectedVersion}),operation:body.request.operation,targetKey:body.request.targetKey,identity:'rule-1',state:'paused',version:5,deliveryEnabled:false,eventId:null,alreadyInState:false}:null});
  }
  // The owner answers for its own target ('rule-1'), never for whatever was asked:
  // a substituted target must be caught, not echoed back as if it were the truth.
  return Response.json({version:'0.1.0',state:{family:body.target.family,clientId:body.target.clientId,targetKind:body.target.targetKind,targetKey:'rule-1',identity:'rule-1',state:'paused',version:4,deliveryEnabled:false,facts:{folderCount:2}}});
 }});
 const preparer=createWatchPreparer({binding,scopes,selectedClientId:clientId,client,now:()=>NOW,deadlineMs:NOW+60000,policyRevision:'p1',currentRights:async()=>({scopes:state.revoked?[]:scopes,expiresAtMs:NOW+60000})});
 const prepare=(argumentsValue=request)=>preparer.prepare({arguments:argumentsValue,deliveryId:'sdk:'+String(1).padStart(64,'0')});
 return {binding,scopes,clientId,request,client,preparer,prepare,calls,scopes,client};
}
test('prepares one bound, canonical, approval-required watch proposal',async()=>{
 const f=harness(),prepared=await f.prepare(),p=prepared.proposal;
 assert.equal(prepared.status,'approval_required');assert.equal(p.kind,'watch_action');assert.equal(p.operation,'watch_action');
 assert.equal(f.calls.length,1);assert.ok(f.calls[0].endsWith('/prepare_watch_action'));
 // The canonical requestKey is derived from the delivery, never supplied by the model.
 assert.match(p.request.requestKey,/^meri-watch-[a-f0-9]{64}$/u);
 assert.equal(watchValidators.assertOutput(prepared).proposal.proposalId,p.proposalId);
 assert.throws(()=>watchValidators.assertOutput({...prepared,proposal:{...p,commandSha256:'f'.repeat(64)}}));
});
test('an owner receipt is bound to this exact request and verb',async()=>{
 const f=harness(),request={...f.request,requestKey:'meri-watch-'+'0'.repeat(64)};
 const receipt={request,owner:request.family,binding:'d'.repeat(64),operation:'pause',targetKey:'rule-1',identity:'rule-1',state:'paused',version:5,deliveryEnabled:false,eventId:null,alreadyInState:false};
 assert.equal(watchValidators.receipt(receipt,request).operation,'pause');
 assert.throws(()=>watchValidators.receipt({...receipt,operation:'unsubscribe'},request));
 assert.throws(()=>watchValidators.receipt(receipt,{...request,targetKey:'rule-2'}));
});
test('lost prepare acknowledgement stays UNKNOWN without another POST',async()=>{
 const f=harness({lose:true});
 await assert.rejects(f.prepare());
 assert.equal(f.calls.filter(p=>p.endsWith('/prepare_watch_action')).length,1);
 await assert.rejects(f.prepare());
 assert.equal(f.calls.filter(p=>p.endsWith('/prepare_watch_action')).length,2);
});
test('an unsupported owner verb, an injected requestKey and a foreign client are refused before any HTTP',async()=>{
 const f=harness();
 await assert.rejects(f.prepare({...f.request,family:'defense_budget_target',targetKind:'pe',operation:'pause'}));
 await assert.rejects(f.prepare({...f.request,requestKey:'meri-watch-injected'}));
 await assert.rejects(f.prepare({...f.request,clientId:id(9)}));
 assert.equal(f.calls.length,0);
});
test('a revoked authority set is refused and a stale policy revision is refused',async()=>{
 const f=harness({revoked:true});
 await assert.rejects(f.prepare());
 assert.equal(f.calls.length,0);
});
test('inspect reads one exact owner target and refuses a substituted state',async()=>{
 const f=harness();
 const observed=await f.client.inspect({binding:f.binding,selectedClientId:f.clientId,target:{family:'legiwatch_keyword',clientId:f.clientId,targetKind:'keyword_rule',targetKey:'rule-1'},deadlineMs:NOW+10000});
 assert.equal(observed.state.state,'paused');assert.deepEqual(f.calls,['/api/clio/tools/inspect_watch_state']);
 await assert.rejects(f.client.inspect({binding:f.binding,selectedClientId:f.clientId,target:{family:'legiwatch_keyword',clientId:f.clientId,targetKind:'keyword_rule',targetKey:'rule-9'},deadlineMs:NOW+10000}));
});
