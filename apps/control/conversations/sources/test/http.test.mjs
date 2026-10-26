import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {storeFixture,id} from '../../test/store-fixture.mjs';
import {binding,scopes,seedStore,status,proof,check} from './fixture.mjs';
import {createBillTextSourceCapture} from '../bill-text.mjs';
import {createBillTextSourceApplication} from '../http.mjs';
import {createConversationHistoryService} from '../../history/service.mjs';
import {createCoreBillTextSourceReader} from '../../../../runtime/native-authority/bill-text-source.mjs';
import {ProductError} from '../../../product-access/errors.mjs';
import {BILL_TEXT_SOURCE_PATH,BILL_TEXT_SOURCE_READ_SCHEMA} from '../../../../../packages/contracts/conversation-sources/protocol.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../../../../runtime/product-applications.mjs';
async function fixture(options={}){
 const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool});const expectedScopes=options.general?[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision:'policy1'}]:scopes;await seedStore(store,expectedScopes);const p=proof({...options,selectedScopes:expectedScopes});
 await createBillTextSourceCapture({store,defaultCongress:119})({...p,scopes:expectedScopes,check});await store.append(binding,status(10,'completed'),check);
 const state={principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]},membership:0,currentness:0,sourceCalls:0,retentionChecks:0,fenced:false,sourceStatus:200,result:p.result};
 const gate={async admit({credential}){assert.equal(credential,'SYNTHETIC_CURRENT');if(state.admissionDenied)throw new ProductError('ACCESS_DENIED');return {principal:state.principal,expiresAtMs:9000};},async recheck(){state.membership++;if(state.membershipDenied)throw new ProductError('ACCESS_DENIED');}};
 const currentness={async assertCurrent({credential,conversationId,scopes:requested}){assert.equal(credential,'SYNTHETIC_CURRENT');assert.equal(conversationId,binding.conversationId);assert.deepEqual(requested,expectedScopes);state.currentness++;if(state.currentDenied||state.currentness>1&&state.finalDenied)throw new ProductError('ACCESS_DENIED');}};
 const retention={async assertServable(){state.retentionChecks++;if(state.suppressed)throw new ProductError('CONVERSATION_NOT_FOUND');},async withRelease(subjects,fn){assert.equal(subjects[0].subjectId,binding.conversationId);state.fenced=true;try{const r=await fn(undefined,()=>retention.assertServable());assert.ok(r instanceof Response);return r;}finally{state.fenced=false;}}};
 const reader=createCoreBillTextSourceReader({origin:'https://core.example.invalid',getServiceSecret:async()=> 'SYNTHETIC_SERVICE',now:()=>1000,maxRequestMs:1000,async fetchImpl(url,options){
  state.sourceCalls++;assert.equal(String(url),'https://core.example.invalid/api/clio/tools/read_bill_text');assert.equal(options.headers.authorization,'Bearer SYNTHETIC_CURRENT');assert.equal(options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');state.body=JSON.parse(options.body);state.afterRead?.();return Response.json(state.result,{status:state.sourceStatus});
 }});
 const history=createConversationHistoryService({store,gate,retention}),app=options.runtimeMount?createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:1000,requestBytes:4096},native:{maxResponseBytes:131072}},sessions:{},ports:captureRuntimePorts({conversationMembership:gate,conversationCurrentness:currentness,conversationSourceReader:reader}),conversationStore:store,retention,now:()=>1000}):createBillTextSourceApplication({store,history,gate,currentness,reader,retention,now:()=>1000,limits:{maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072}});
 const request={schemaVersion:BILL_TEXT_SOURCE_READ_SCHEMA,conversationId:binding.conversationId,runId:binding.runId,referenceId:p.event.eventId};
 const read=body=>app.handle(new Request('https://runtime.example.invalid'+BILL_TEXT_SOURCE_PATH,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_CURRENT','content-type':'application/json'},body:JSON.stringify(body??request)}));
 return {state,read,request,p,store};
}
test('completed-run reader uses current native bearer and Core, with final membership/currentness and retention fence',async()=>{
 const f=await fixture(),r=await f.read();assert.equal(r.status,200,await r.clone().text());const value=await r.json();assert.equal(value.current.text,'x'.repeat(12));assert.equal(value.event.binding.runId,binding.runId);assert.equal(value.current.sourceLocator,'https://evidence.example.invalid/text');assert.deepEqual(f.state.body,{billId:'119-hr-1',versionCode:'ih'});assert.equal(f.state.sourceCalls,1);assert.equal(f.state.membership,1);assert.equal(f.state.currentness,2);assert.equal(f.state.retentionChecks,2);assert.equal(r.headers.get('cache-control'),'no-store');
});
test('production product router mounts the same authenticated source owner after completion',async()=>{const f=await fixture({runtimeMount:true}),r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).current.text,'x'.repeat(12));assert.equal(f.state.sourceCalls,1);assert.equal(f.state.currentness,2);});
test('missing, cross-owner, inaccessible-client and forged requests refuse before source read',async()=>{
 for(const change of [f=>{f.state.principal.tenantId=id(90);},f=>{f.state.principal.actorId=id(90);},f=>{f.state.principal.clientIds=[];},f=>{f.state.admissionDenied=true;},f=>{f.state.currentDenied=true;},f=>{f.state.suppressed=true;}]){const f=await fixture();change(f);const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.sourceCalls,0);assert.doesNotMatch(await r.text(),/xxxxxxxx|sourceLocator/);}
 const f=await fixture();assert.equal((await f.read({...f.request,referenceId:id(90)})).status,404);assert.equal((await f.read({...f.request,authority:'forged'})).status,400);assert.equal(f.state.sourceCalls,0);
});
test('stale, unavailable and denied current source are distinct content-free failures',async()=>{
 for(const [status,expected]of [[400,409],[403,403],[503,503]]){const f=await fixture();f.state.sourceStatus=status;const r=await f.read();assert.equal(r.status,expected);assert.doesNotMatch(await r.text(),/xxxxxxxx|sourceLocator/);}
 const f=await fixture();f.state.result={...f.state.result,textHash:'d'.repeat(64)};const r=await f.read();assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:{code:'SOURCE_REFERENCE_STALE'}});
});
test('revocation or suppression after the Core page read withholds the whole response',async()=>{
 for(const key of ['membershipDenied','finalDenied','suppressed']){const f=await fixture();f.state.afterRead=()=>{f.state[key]=true;};const r=await f.read();assert.notEqual(r.status,200);assert.equal(f.state.sourceCalls,1);assert.doesNotMatch(await r.text(),/xxxxxxxx|sourceLocator/);}
});
test('continuation opens the saved positive-offset cursor, and malformed source URLs remain inert',async()=>{
 const first=proof({total:10000}),f=await fixture({total:10000,args:{billId:'119-hr-1',versionCode:'ih',cursor:first.result.coverage.nextCursor}});f.state.result.sourceLocator='javascript:alert(1)';const r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.equal(f.state.body.cursor,first.result.coverage.nextCursor);const value=await r.json();assert.equal(value.current.text.length,1000);assert.equal(value.current.sourceLocator,null);assert.equal(value.current.linkStatus,'unsafe');
});

test('General scope opens the saved bill page without inventing a selected client',async()=>{const f=await fixture({general:true});f.state.principal.clientIds=[];const r=await f.read();assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).event.scopes[0].kind,'private-user');});
test('an existing non-source event is unsupported by this reader, not a corrupt native reference',async()=>{const f=await fixture(),r=await f.read({...f.request,referenceId:id(7)});assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:{code:'SOURCE_REFERENCE_NOT_FOUND'}});assert.equal(f.state.sourceCalls,0);});
