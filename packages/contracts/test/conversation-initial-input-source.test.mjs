/** Synthetic source-semantic controls: one Node process, no generation, services, provider or children. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../validate.mjs';import {data} from '../commands-0.2/execution-boundary.mjs';
import {receiveConversationInputRequest,conversationInputView,conversationInputMetadata} from '../dist/conversation-input.mjs';
import {receiveConversationRequest,receiveConversationResponse} from '../dist/conversation-application.mjs';
import {receiveConversationInitialInputRequest as request,admitInitialInputResponse,receiveAllocatedConversationInputResponse as bridge} from '../conversation-initial-input/semantics.mjs';
import {assertInitialInputShape,assertConversationInitialInputReceipt} from '../conversation-initial-input/validate.mjs';
import {conversationInitialInputMetadata as metadata,initialInputErrorStatuses,initialInputErrorOutcomes} from '../conversation-initial-input/protocol.mjs';
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture({input={requestId:id(6),prompt:'Hello'},stored,scopes}={}){
 const at=Date.now(),binding={tenantId:'synthetic-initial',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},selectedClientId=id(5);
 scopes??=[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision:'p1'}];
 const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'},retained=stored??{...input,skill:null,window:null,windowRequest:null};
 const context={tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,runId:binding.runId,clientId:selectedClientId};
 const allocation={binding,scopes,versions,selectedClientId,requestId:input.requestId,inputSha256:hash(input),requestSha256:hash(retained),allocatedAtMs:at-1000,expiresAtMs:at+60000};
 const receipt={allocation,state:'RESERVED',created:true},admitted={run:{binding,scopes,versions,state:'queued',createdAt:new Date(at-1000).toISOString(),policyRevision:'p1'},request:retained,lastSequence:1,replayed:false};
 return {at,binding,scopes,versions,input,retained,context,allocation,receipt,admitted,request:request(bytes(input))};
}
/** Uses the actual source shape + semantic owners; generated public byte controls belong to C's separate artifact lane. */
async function receive(status,raw,request,context,options){const receipt=data(raw);assertInitialInputShape(status===200?'ConversationInitialInputAllocatedResponse':'ConversationInitialInputErrorResponse',receipt);return admitInitialInputResponse(status,receipt,request,context,options);}

test('metadata fixes allocation transport, separate errors and unchanged old bridge cap',()=>{
 assert.equal(metadata.packageVersion,'0.1.8');assert.equal(metadata.schemaId,'urn:meri:conversation-initial-input:1.0.0');assert.equal(metadata.routes.allocate.path,'/api/conversations/input/allocate');
 assert.deepEqual(metadata.limits,{requestBytes:131072,responseBytes:131072,maxRequestMs:3000});assert.equal(metadata.bridge.responseBytes,2097152);assert.equal(metadata.bridge.responseBytes,conversationInputMetadata.limits.responseBytes);
 assert.equal(initialInputErrorOutcomes.INVALID_REQUEST,'NOT_DISPATCHED');assert.equal(initialInputErrorOutcomes.INITIAL_INPUT_UNAVAILABLE,'UNKNOWN');assert.ok(Object.isFrozen(initialInputErrorStatuses));
});
test('allocation request remains genuine for accepted old submit receiver and allocation is not a Conversation view',async()=>{
 const f=fixture(),receipt=await receive(200,f.receipt,f.request,f.context);assert.ok(Object.isFrozen(f.request));
 await receiveConversationResponse('submit',200,bytes({run:f.admitted.run,requestId:f.input.requestId,lastSequence:1,replayed:false}),f.request);
 assert.deepEqual(receipt,f.receipt);assert.throws(()=>conversationInputView(receipt),/UNADMITTED_VIEW/);assert.deepEqual(await assertConversationInitialInputReceipt(f.receipt,f.input),f.receipt);
});
test('exact retained intent permits genuine created:false recovery and an actual old branded input view',async()=>{
 const f=fixture(),allocated=await receive(200,{...f.receipt,created:false},f.request,{...f.context}),result=await bridge(200,bytes(f.admitted),f.request,{...f.context},allocated);
 assert.deepEqual(result,f.admitted);const view=conversationInputView(result);assert.deepEqual(view.request,f.retained);
 const page=await receiveConversationResponse('history',200,bytes({...f.admitted,events:[],nextSequence:1,hasMore:false}),receiveConversationRequest('history',bytes({after:1})),view);assert.deepEqual(page.request,f.retained);
});
test('proof requires the exact original request and receipt objects, including after brand-valid re-admission',async()=>{
 const f=fixture(),allocated=await receive(200,f.receipt,f.request,f.context);
 for(const altered of [structuredClone(allocated),f.receipt,{}])await assert.rejects(bridge(200,bytes(f.admitted),f.request,f.context,altered),/UNADMITTED_INITIAL_INPUT_PROOF/);
 for(const altered of [structuredClone(f.request),request(bytes(f.input)),receiveConversationInputRequest(bytes(f.input))])await assert.rejects(bridge(200,bytes(f.admitted),altered,f.context,allocated),/UNADMITTED_INITIAL_INPUT_PROOF/);
 await assert.rejects(receive(200,f.receipt,receiveConversationInputRequest(bytes(f.input)),f.context),/UNADMITTED_INITIAL_INPUT_REQUEST/);
});
for(const field of ['tenantId','actorId','conversationId','runId','clientId'])test(`independent ${field} mismatch prevents allocation proof and bridge reuse`,async()=>{
 const f=fixture(),context={...f.context,[field]:['tenantId','actorId'].includes(field)?'foreign':id(80)};
 await assert.rejects(receive(200,f.receipt,f.request,context),/INITIAL_INPUT_CONTEXT_MISMATCH/);const allocated=await receive(200,f.receipt,f.request,f.context);await assert.rejects(bridge(200,bytes(f.admitted),f.request,context,allocated),/UNADMITTED_INITIAL_INPUT_PROOF/);
});
test('closed independent context rejects receipt-authored extra fields and accessors without reading them',async()=>{
 const f=fixture();for(const context of [undefined,null,{...f.context,scopes:f.scopes},{...f.context,tenantId:'x'.repeat(129)}])await assert.rejects(receive(200,f.receipt,f.request,context),/INITIAL_INPUT_CONTEXT_INVALID/);
 let reads=0;const context={...f.context};Object.defineProperty(context,'clientId',{enumerable:true,get(){reads++;return f.context.clientId;}});await assert.rejects(receive(200,f.receipt,f.request,context),/INITIAL_INPUT_CONTEXT_INVALID/);assert.equal(reads,0);
});
test('canonical JCS input hash preserves exact optional fields and prompt content',async()=>{
 const f=fixture(),reordered=request(new TextEncoder().encode(JSON.stringify({prompt:f.input.prompt,requestId:f.input.requestId})));assert.deepEqual(await receive(200,{...f.receipt,created:false},reordered,f.context),{...f.receipt,created:false});
 for(const changed of [{...f.input,prompt:'Hello '},{...f.input,windowRequest:{basis:'unbounded'}}])await assert.rejects(receive(200,f.receipt,request(bytes(changed)),f.context),/INITIAL_INPUT_REQUEST_MISMATCH/);
 const wrong=structuredClone(f.receipt);wrong.allocation.requestId=id(7);await assert.rejects(receive(200,wrong,f.request,f.context),/INITIAL_INPUT_REQUEST_MISMATCH/);
});
test('fixed timestamps and every allocation pin survive duplicate responses; ACCEPTED never regresses',async()=>{
 const f=fixture();await receive(200,f.receipt,f.request,f.context);
 const repeated=await receive(200,{...f.receipt,created:false},f.request,{...f.context});assert.equal(repeated.created,false);
 for(const mutate of [a=>a.allocatedAtMs--,a=>a.expiresAtMs++,a=>a.requestSha256='c'.repeat(64),a=>a.binding.attemptId=id(90),a=>a.binding.workerId=id(91),a=>a.versions.sdk='0.3.296',a=>a.scopes.push({...a.scopes[0],resourceId:id(92)})]){const altered=structuredClone(f.receipt);altered.created=false;mutate(altered.allocation);await assert.rejects(receive(200,altered,f.request,f.context),/INITIAL_INPUT_RECEIPT_DRIFT/);}
 await assert.rejects(receive(200,f.receipt,f.request,f.context),/INITIAL_INPUT_STATE_MISMATCH/);await receive(200,{...f.receipt,state:'ACCEPTED',created:false},f.request,f.context);
 await assert.rejects(receive(200,{...f.receipt,created:false},f.request,f.context),/INITIAL_INPUT_STATE_MISMATCH/);
});
test('concurrent different full pins cannot establish two positive facts for one retained request',async()=>{
 const f=fixture(),different=structuredClone(f.receipt);different.allocation.requestSha256='c'.repeat(64);const results=await Promise.allSettled([receive(200,f.receipt,f.request,f.context),receive(200,different,f.request,f.context)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('original expiry is checked after digest and before bridge; renewed context cannot extend it',async()=>{
 const f=fixture();await assert.rejects(receive(200,f.receipt,f.request,f.context,{now:()=>f.allocation.expiresAtMs}),/INITIAL_INPUT_EXPIRED/);
 await assert.rejects(receive(200,f.receipt,f.request,f.context,{now:()=>f.allocation.allocatedAtMs-1}),/INITIAL_INPUT_EXPIRED/);
 const expired=structuredClone(f.receipt);expired.allocation.allocatedAtMs=f.at-2000;expired.allocation.expiresAtMs=f.at-1000;const allocated=await receive(200,expired,f.request,f.context,{now:()=>f.at-1500});
 await assert.rejects(bridge(200,bytes(f.admitted),f.request,{...f.context},allocated),/INITIAL_INPUT_EXPIRED/);
});
test('facts reject nonoriginal fence, tenant/policy/client mismatch, duplicate scopes and impossible times',async()=>{
 for(const mutate of [a=>a.binding.writerFence=2,a=>a.scopes[0].tenantId='foreign',a=>a.scopes.push({...a.scopes[0],resourceId:id(40),policyRevision:'other'}),a=>a.scopes[0].resourceId=id(41),a=>a.expiresAtMs=a.allocatedAtMs]){const f=fixture();mutate(f.receipt.allocation);await assert.rejects(receive(200,f.receipt,f.request,f.context),/INITIAL_INPUT_FACTS_MISMATCH/);}
 const f=fixture();f.receipt.allocation.scopes.push({...f.receipt.allocation.scopes[0]});await assert.rejects(receive(200,f.receipt,f.request,f.context));
 for(const mutate of [r=>r.created='true',r=>r.state='ABSENT',r=>r.authorized=true,r=>r.allocation.inputSha256='A'.repeat(64),r=>r.allocation.requestSha256='short',r=>r.allocation.allocatedAtMs=-1]){const f=fixture();mutate(f.receipt);await assert.rejects(receive(200,f.receipt,f.request,f.context));}
 const accepted=fixture();accepted.receipt.state='ACCEPTED';await assert.rejects(receive(200,accepted.receipt,accepted.request,accepted.context),/INITIAL_INPUT_STATE_MISMATCH/);
});
test('bridge full binding/scopes/versions pin adds constraints beyond independent run/client context',async()=>{
 for(const mutate of [r=>r.run.binding.attemptId=id(70),r=>r.run.binding.workerId=id(71),r=>r.run.scopes.push({...r.run.scopes[0],resourceId:id(72)}),r=>r.run.versions.sdk='0.3.296']){const f=fixture(),allocated=await receive(200,f.receipt,f.request,f.context),body=structuredClone(f.admitted);mutate(body);await assert.rejects(bridge(200,bytes(body),f.request,f.context,allocated),/INITIAL_INPUT_ADMISSION_MISMATCH/);}
});
test('bridge hashes complete canonical skill asset pins and original normalized window',async()=>{
 const input={requestId:id(6),prompt:'Hello',skill:{skillId:'quick_skill.commitments_audit',skillVersion:'1.0.0'},windowRequest:{basis:'calendar-week',offset:-1,timezone:'Etc/UTC',weekStartsOn:'monday'}},stored={...input,skill:{...input.skill,manifestSha256:'a'.repeat(64),proseSha256:'b'.repeat(64),catalogSha256:'c'.repeat(64)},window:{basis:'calendar-week',timezone:'Etc/UTC',weekStartsOn:'monday',startInclusive:'2026-10-05T00:00:00Z',endExclusive:'2026-10-12T00:00:00Z'}};
 for(const mutate of [r=>r.request.skill.manifestSha256='d'.repeat(64),r=>r.request.skill.proseSha256='d'.repeat(64),r=>r.request.skill.catalogSha256='d'.repeat(64),r=>{r.request.window.startInclusive='2026-09-28T00:00:00Z';r.request.window.endExclusive='2026-10-05T00:00:00Z';}]){const f=fixture({input,stored}),allocated=await receive(200,f.receipt,f.request,f.context),body=structuredClone(f.admitted);mutate(body);await assert.rejects(bridge(200,bytes(body),f.request,f.context,allocated),/INITIAL_INPUT_ADMISSION_MISMATCH/);}
});
test('allocation response cap never replaces the accepted bridge response cap',async()=>{
 const scopes=[{tenantId:'synthetic-initial',kind:'client',resourceId:id(5),policyRevision:'p1'},...Array.from({length:99},(_,n)=>({tenantId:'synthetic-initial',kind:'client',resourceId:'secondary-'+n+'-'+'x'.repeat(225),policyRevision:'p1'}))];
 const f=fixture({input:{requestId:id(6),prompt:'a'.repeat(100000)},scopes}),allocated=await receive(200,f.receipt,f.request,f.context),body=bytes(f.admitted);assert.ok(body.byteLength>metadata.limits.responseBytes);assert.ok(body.byteLength<metadata.bridge.responseBytes);assert.equal((await bridge(200,body,f.request,f.context,allocated)).request.prompt.length,100000);
});
test('allocation errors stay closed, status-correlated and separate from old admission errors',async()=>{
 const f=fixture();for(const [code,statuses]of Object.entries(initialInputErrorStatuses))for(const status of statuses){const error={error:{code,outcome:initialInputErrorOutcomes[code]}};assert.deepEqual(await receive(status,error,f.request,f.context),error);}
 for(const error of [{error:{code:'INITIAL_INPUT_CONFLICT',outcome:'UNKNOWN'}},{error:{code:'INITIAL_INPUT_UNAVAILABLE'}},{error:{code:'INITIAL_INPUT_UNAVAILABLE',outcome:'UNKNOWN',prompt:'private'}}])await assert.rejects(receive(503,error,f.request,f.context));
 const allocated=await receive(200,f.receipt,f.request,f.context);await assert.rejects(bridge(503,bytes({error:{code:'INITIAL_INPUT_UNAVAILABLE',outcome:'UNKNOWN'}}),f.request,f.context,allocated));
 assert.deepEqual(await bridge(403,bytes({error:{code:'SESSION_REFUSED'}}),f.request,f.context,allocated),{error:{code:'SESSION_REFUSED'}});
});
