/** Configured HTTP -> existing canonical authority/dispatch/budget -> released projection. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {createToolDispatch} from '../dispatch/tool-dispatch.mjs';
import {createClientEvidenceHttpAdapter} from '../sources/client-evidence/http-adapter.mjs';
import {createClientEvidenceReadHandler} from '../sources/client-evidence/handler.mjs';
import {clientEvidenceFixture,credentialReceipt,operations,endpoints,NOW,clientId,documentId} from '../sources/client-evidence/test/fixtures.mjs';
import {createIdentityContactsHttpAdapter} from '../sources/identity-contacts/http-adapter.mjs';
import {createIdentityContactsReadHandler} from '../sources/identity-contacts/handler.mjs';
import {createIdentityContactsFixture} from '../sources/identity-contacts/test/fixtures.mjs';
import {createClientKnowledgeHttpAdapter} from '../sources/client-knowledge/http-adapter.mjs';
import {createClientKnowledgeReadHandler} from '../sources/client-knowledge/handler.mjs';
import {createClientKnowledgeFixture} from '../sources/client-knowledge/test/fixtures.mjs';
const ids=['get_client_context','read_client_documents','resolve_entity','find_contacts','search_memory','read_monday_client_boards'];
function integration(id,configuration={}) {
 const evidence=id==='get_client_context'||id==='read_client_documents',knowledge=id==='search_memory'||id==='read_monday_client_boards';
 const fixture=evidence?clientEvidenceFixture(id===operations.profile.id?operations.profile:operations.documents,
  id===operations.profile.id?{clientId,section:'people'}:{clientId,documentId}):knowledge?createClientKnowledgeFixture(id):createIdentityContactsFixture(id,{linked:id==='find_contacts'});
 const auth=fixture.authority,binding=auth.binding,subject=auth.subject,claims=auth.claims,contract=fixture.contract,op=contract.descriptor.operation;
 const args=evidence?fixture.request:fixture.args,state={now:evidence?NOW:fixture.state.now,revoked:false},calls=[],wire=[];
 const ports={async verifyCapability(){calls.push('capability');if(state.revoked)throw Error('SYNTHETIC_REVOKED');return JSON.stringify(claims);},
  async currentRun(){return JSON.stringify({binding,policyRevision:auth.policyRevision,deadlineMs:state.now+10000,checkedAtMs:state.now});},
  async authorizeBusiness(){calls.push('policy');return JSON.stringify({decision:{...auth.decision,evaluatedAt:new Date(state.now).toISOString()},subject,grants:contract.descriptor.requiredGrants});},
  async authorizeSources(){return JSON.stringify({sourceIds:auth.sourceIds,enabled:true,policyRevision:auth.policyRevision,checkedAtMs:state.now});}};
 const budget={async reserve({reservationId}){calls.push('reserve');return JSON.stringify({reservationId,decision:'reserved'});},
  async settle({reservationId}){calls.push('settle');state.afterSettle?.();return JSON.stringify({reservationId,decision:'settled'});},
  async markUncertain(){calls.push('uncertain');}};
 const config={endpoints:evidence?endpoints:fixture.config.endpoints,now:()=>state.now,maxRequestMs:1000,maxResponseBytes:1048576,
  async getCredentials(pins){calls.push('credentials');state.pins=pins;const receipt=evidence?credentialReceipt(pins):fixture.credentials(pins);state.changeReceipt?.(receipt);return receipt;},
  async fetchImpl(url,options){calls.push('fetch');wire.push({url,options,body:JSON.parse(options.body)});
   const page=evidence?structuredClone(fixture.page):knowledge?fixture.page(state.pins.input):fixture.page(state.pins.input,auth,state.pins.metadata);
   state.changePage?.(page);state.afterRead?.();return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});}};
 if(knowledge)config.readMemoryEligibility=async pins=>{calls.push('eligibility');const receipt=fixture.eligibility(pins);state.changeEligibility?.(receipt);return receipt;};
 const adapter=(evidence?createClientEvidenceHttpAdapter:knowledge?createClientKnowledgeHttpAdapter:createIdentityContactsHttpAdapter)(config);
 const entry={contract,descriptor:contract.descriptor,execute:(evidence?createClientEvidenceReadHandler:knowledge?createClientKnowledgeReadHandler:createIdentityContactsReadHandler)({operation:op,adapter,now:()=>state.now})};
 const gateway=createToolDispatch({catalog:{entry:()=>entry,discoverable:()=>[]},authority:createCurrentToolAuthority({ports,now:()=>state.now,maxFactBytes:1048576}),budget,
  limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:1000,maxCleanupMs:100},now:()=>state.now,newId:()=>binding.workerId,sourceEnabled:true,defaultCongress:119,...configuration});
 return {fixture,state,calls,wire,args,run:async(value=args)=>JSON.parse(await gateway.execute(JSON.stringify({operation:op,arguments:value}),'SYNTHETIC_OPAQUE'))};
}
for(const id of ids) {
 test(`${id}: actual HTTP projection releases only through current policy and settled budget`,async()=>{
  const f=integration(id),page=await f.run();assert.deepEqual(page.binding,f.fixture.authority.binding);
  assert.equal(f.wire.length,1);assert.equal(f.calls.filter(x=>x==='reserve').length,1);assert.equal(f.calls.filter(x=>x==='settle').length,1);
  assert.equal(f.calls.filter(x=>x==='policy').length>=5,true);assert.equal(f.calls.includes('uncertain'),false);
  assert.deepEqual(Object.keys(f.wire[0].body).sort(),['input','metadata']);
  assert.equal(createHash('sha256').update(f.wire[0].options.body).digest('hex'),f.state.pins.requestSha256);
  assert.equal(f.state.pins.requestSha256,canonicalSha256(f.wire[0].body));
 });
 test(`${id}: revocation after source bytes refuses release and marks reservation uncertain`,async()=>{
  const f=integration(id);f.state.afterRead=()=>{f.state.revoked=true;};await assert.rejects(f.run(),/ACCESS_DENIED/);
  assert.equal(f.wire.length,1);assert.equal(f.calls.includes('settle'),false);assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
 });
 test(`${id}: broker context substitution is refused before Fetch`,async()=>{
  const f=integration(id);f.state.changeReceipt=receipt=>{receipt.normalizationContext={defaultCongress:120};};
  await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.wire.length,0);assert.equal(f.calls.includes('settle'),false);
 });
 test(`${id}: post-settlement revocation refuses final release without double charge`,async()=>{
  const f=integration(id);f.state.afterSettle=()=>{f.state.revoked=true;};await assert.rejects(f.run(),/ACCESS_DENIED/);
  assert.equal(f.calls.filter(x=>x==='settle').length,1);assert.equal(f.calls.includes('uncertain'),false);
 });
}
test('explicit Congress missing refuses before budget or source credentials',async()=>{
 const f=integration('resolve_entity',{defaultCongress:undefined});await assert.rejects(f.run(),/UNAVAILABLE/);
 assert.equal(f.calls.includes('reserve'),false);assert.equal(f.wire.length,0);
});
test('profile observation survives elapsed transport time and Decimal precision stays exact',async()=>{
 const f=integration('get_client_context');f.state.afterRead=()=>{f.state.now+=10;};const page=await f.run();
 assert.equal(page.result.generatedAt,new Date(NOW).toISOString());assert.equal(page.result.profile.people[0].placementConfidence,'9.999');
});
test('caller normalizationContext cannot supply authority or override trusted Congress',async()=>{
 const f=integration('resolve_entity');await assert.rejects(f.run({...f.args,normalizationContext:{defaultCongress:120}}),/INVALID_ARGUMENTS/);
 assert.deepEqual(f.calls,[]);
});

test('memory refused by exact current eligibility receipt never releases or settles',async()=>{
 const f=integration('search_memory');f.state.changeEligibility=r=>{r.records[0].eligibleForRecall=false;};
 await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.wire.length,1);assert.equal(f.calls.includes('settle'),false);
 assert.equal(f.calls.filter(x=>x==='uncertain').length,1);
});
test('Monday unmanaged board mapping refuses before source bytes',async()=>{
 const f=integration('read_monday_client_boards');f.state.changeReceipt=r=>{r.managedBoardMapping.clientId=f.fixture.binding.workerId;};
 await assert.rejects(f.run(),/INVALID_RESULT/);assert.equal(f.wire.length,0);assert.equal(f.calls.includes('settle'),false);
});
