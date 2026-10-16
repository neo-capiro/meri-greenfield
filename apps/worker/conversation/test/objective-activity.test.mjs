/** Scripted SDK transport: an Objective result shares the existing query and completion checkpoint. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createConversationActivity} from '../activity.mjs';
import {buildConversationOptions} from '../options.mjs';
import {continuationFixture,id,NOW} from '../continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {objectiveCompletionId,typedExecutionWitness} from '../../../../packages/runtime/objective-generation-custody.mjs';

function syntheticDescriptor(binding,request,sessionId){
 const ref=objectiveCompletionId(binding),descriptor={schemaVersion:1,kind:'objective.strategy.draft',path:'meri-objective-strategy-draft.result.json',sourceAdmissionSha256:hash('source-admission'),sourceRequestSha256:hash(request),typedRequestSha256:hash('typed-request'),resultRef:ref,resultSha256:hash('result'),fileSha256:hash('file'),bytes:4,
  execution:{provider:'synthetic-provider',model:'synthetic-model',receiptRef:ref,receiptSha256:'',bindingSha256:hash(binding)},
  observation:{sessionId,completedAtMs:NOW,state:'succeeded',payloadSha256:hash('payload')}};
 descriptor.execution.receiptSha256=hash(typedExecutionWitness(descriptor));return descriptor;
}

function fixture({objectiveGeneration,captureEnabled=true}={}){
 const f=continuationFixture(),binding=f.binding,versions=f.target.versions,scopes=f.target.scopes;
 const request={...f.target.sourceRequest,skill:null},contextSha256=hash({window:request.window,skill:request.skill,scopes}),sessionId=f.continuation.checkpoint.sessionId;
 const saved={run:{binding,versions,scopes,policyRevision:scopes[0].policyRevision,state:'queued',createdAt:new Date(NOW).toISOString()},request};
 const observed={queries:0,captures:0,typed:undefined,options:undefined,events:[]};
 const owner={async load(){return saved;},async append({event}){observed.events.push(event);},async nextControls(){return [];},async claimControl(){throw Error('no control');},async ackControl(){throw Error('no control');},async recordCheckpoint(){throw Error('no lifecycle control');}};
 const lifecycle={async captureCheckpoint(){throw Error('no pause');},...(captureEnabled?{async captureCompletion(input){observed.captures++;observed.typed=input.typedResult;assert.equal(input.sessionId,sessionId);const cp=structuredClone(f.continuation.checkpoint);return {checkpoint:cp,checkpointSha256:hash(cp),sourceRequestSha256:hash(request),contextSha256,sessionId,resumeSessionAt:null,verificationId:id(901),workspaceReadbackSha256:cp.workspaceSha256,opaqueSessionReadbackSha256:cp.opaqueSession.sha256,checkedAtMs:NOW,expiresAtMs:NOW+1000};}}:{})};
 const runtime={binding,versions,cwd:'/workspace/'+binding.conversationId,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',sessionStore:{load(){},append(){}},deadlineMs:NOW+1000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024};
 const execute=createConversationActivity({runOwner:owner,lifecycle,objectiveGeneration,now:()=>NOW,prepareRuntime:async()=>runtime,query({prompt,options}){observed.queries++;observed.options=options;return {async *[Symbol.asyncIterator](){const iterator=prompt[Symbol.asyncIterator]();await iterator.next();yield {type:'system',subtype:'init',session_id:sessionId};yield {type:'result',subtype:'success',is_error:false,session_id:sessionId,structured_output:{state:'succeeded'}};},close(){}};}});
 return {execute,binding,request,sessionId,runtime,observed};
}

test('selected Objective captures a typed result through one SDK query and the existing completion',async()=>{
 const format={type:'json_schema',schema:{type:'object',properties:{state:{type:'string'}},required:['state'],additionalProperties:false}};
 let prepared=0,captured=0;
 let f,descriptor;
 const objectiveGeneration={async prepare(input){prepared++;assert.equal(input.model,'synthetic-model');assert.equal(input.proxyCredentialSha256,createHash('sha256').update('synthetic-proxy').digest('hex'));assert.equal('proxyCredential' in input,false);return {deadlineMs:NOW+900,outputFormat:format,async capture({sdkResult}){captured++;assert.equal(sdkResult.structured_output.state,'succeeded');descriptor=syntheticDescriptor(f.binding,f.request,f.sessionId);return descriptor;}};}};
 f=fixture({objectiveGeneration});assert.deepEqual(await f.execute({binding:f.binding}),{state:'completed'});
 assert.deepEqual({prepared,captured,queries:f.observed.queries,captures:f.observed.captures},{prepared:1,captured:1,queries:1,captures:1});
 assert.deepEqual(f.observed.options.outputFormat,format);assert.deepEqual(f.observed.typed,descriptor);
 assert.deepEqual(f.observed.events.map(e=>e.data.state),['starting','running']);
});

test('selected Objective without completion capture refuses before opening an SDK query',async()=>{
 const f=fixture({objectiveGeneration:{async prepare(){return {deadlineMs:NOW+900,outputFormat:{type:'json_schema',schema:{type:'object'}},capture(){}};}},captureEnabled:false});
 await assert.rejects(f.execute({binding:f.binding}),/EXECUTION_FAILED/);
 assert.equal(f.observed.queries,0);assert.equal(f.observed.captures,0);
 assert.deepEqual(f.observed.events.map(e=>e.data.state),['starting','failed']);
});

test('Objective output format is opt-in and refuses a conflicting or malformed format',()=>{
 const f=continuationFixture(),binding=f.binding,versions=f.target.versions;
 const runtime={binding,versions,cwd:'/workspace/'+binding.conversationId,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'synthetic-proxy',model:'synthetic-model',sessionStore:{load(){},append(){}},deadlineMs:NOW+1000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024};
 const plain=buildConversationOptions(runtime,new AbortController());assert.equal(plain.outputFormat,undefined);
 const format={type:'json_schema',schema:{type:'object'}},selected=buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,undefined,undefined,format);
 assert.deepEqual(selected.outputFormat,format);
 assert.throws(()=>buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,undefined,undefined,{type:'json',schema:{type:'object'}}),/RUNTIME_CONFIGURATION/);
});
