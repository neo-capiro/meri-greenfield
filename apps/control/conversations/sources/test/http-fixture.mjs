import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {storeFixture,id} from '../../test/store-fixture.mjs';
import {binding,scopes,seedStore,status,proof,check} from './fixture.mjs';
import {createBillTextSourceCapture} from '../bill-text.mjs';
import {createConversationSourceApplication} from '../http.mjs';
import {createConversationHistoryService} from '../../history/service.mjs';
import {createCoreConversationSourceReader} from '../../../../runtime/native-authority/conversation-source.mjs';
import {ProductError} from '../../../product-access/errors.mjs';
import {BILL_TEXT_SOURCE_PATH,BILL_TEXT_SOURCE_READ_SCHEMA} from '../../../../../packages/contracts/conversation-sources/protocol.mjs';
import {captureRuntimePorts,createRuntimeProductApplications} from '../../../../runtime/product-applications.mjs';
import {hearingProof} from './hearing-fixture.mjs';
import {createHearingSourceCapture} from '../hearing-record.mjs';
import {HEARING_SOURCE_READ_SCHEMA} from '../../../../../packages/contracts/conversation-sources/protocol.mjs';
export async function fixture(options={}){
 const database=storeFixture(),store=createPostgresConversationStore({pool:database.pool});const expectedScopes=options.general?[{kind:'private-user',tenantId:binding.tenantId,resourceId:binding.actorId,policyRevision:'policy1'}]:scopes;await seedStore(store,expectedScopes);const p=(options.hearing?hearingProof:proof)({...options,selectedScopes:expectedScopes});
 await (options.hearing?createHearingSourceCapture({store}):createBillTextSourceCapture({store,defaultCongress:119}))({...p,scopes:expectedScopes,check});await store.append(binding,status(10,'completed'),check);
 const state={principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]},membership:0,currentness:0,sourceCalls:0,retentionChecks:0,fenced:false,sourceStatus:200,result:p.result};
 const gate={async admit({credential}){assert.equal(credential,'SYNTHETIC_CURRENT');if(state.admissionDenied)throw new ProductError('ACCESS_DENIED');return {principal:state.principal,expiresAtMs:9000};},async recheck(){state.membership++;if(state.membershipDenied)throw new ProductError('ACCESS_DENIED');}};
 const currentness={async assertCurrent({credential,conversationId,scopes:requested}){assert.equal(credential,'SYNTHETIC_CURRENT');assert.equal(conversationId,binding.conversationId);assert.deepEqual(requested,expectedScopes);state.currentness++;if(state.currentDenied||state.currentness>1&&state.finalDenied)throw new ProductError('ACCESS_DENIED');}};
 const retention={async assertServable(){state.retentionChecks++;if(state.suppressed)throw new ProductError('CONVERSATION_NOT_FOUND');},async withRelease(subjects,fn){assert.equal(subjects[0].subjectId,binding.conversationId);state.fenced=true;try{const r=await fn(undefined,()=>retention.assertServable());assert.ok(r instanceof Response);return r;}finally{state.fenced=false;}}};
 const reader=createCoreConversationSourceReader({origin:'https://core.example.invalid',getServiceSecret:async()=> 'SYNTHETIC_SERVICE',now:()=>1000,maxRequestMs:1000,async fetchImpl(url,transport){
  state.sourceCalls++;assert.equal(String(url),'https://core.example.invalid'+(options.media?'/api/clio/conversations/hearing-media':'/api/clio/tools/'+(options.hearing?'search_committee_hearings':'read_bill_text'))); assert.equal(transport.headers.authorization,'Bearer SYNTHETIC_CURRENT');assert.equal(transport.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');assert.equal(transport.redirect,'error');assert.equal(transport.credentials,'omit');assert.equal(transport.cache,'no-store');state.body=JSON.parse(transport.body);state.afterRead?.();return Response.json(state.result,{status:state.sourceStatus});
 }});
 const history=createConversationHistoryService({store,gate,retention}),app=options.runtimeMount?createRuntimeProductApplications({configuration:{sourceEnabled:false,limits:{requestMs:1000,requestBytes:4096},native:{maxResponseBytes:131072}},sessions:{},ports:captureRuntimePorts({conversationMembership:gate,conversationCurrentness:currentness,conversationSourceReader:reader}),conversationStore:store,retention,now:()=>1000}):createConversationSourceApplication({store,history,gate,currentness,reader,retention,now:()=>1000,limits:{maxRequestMs:1000,maxRequestBytes:4096,maxResponseBytes:131072}});
 const request={schemaVersion:options.hearing?HEARING_SOURCE_READ_SCHEMA:BILL_TEXT_SOURCE_READ_SCHEMA,conversationId:binding.conversationId,runId:binding.runId,referenceId:p.event.eventId};
 const read=body=>app.handle(new Request('https://runtime.example.invalid'+BILL_TEXT_SOURCE_PATH,{method:'POST',headers:{authorization:'Bearer SYNTHETIC_CURRENT','content-type':'application/json'},body:JSON.stringify(body??request)}));
 return {state,read,request,p,store};
}
