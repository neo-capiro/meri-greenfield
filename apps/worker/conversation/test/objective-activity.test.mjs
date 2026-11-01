/** Scripted SDK transport: an Objective result shares the existing query and completion checkpoint. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {createConversationActivity} from '../activity.mjs';
import {buildConversationOptions} from '../options.mjs';
import {continuationFixture,id,NOW} from '../continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {typedExecutionWitness} from '../../../../packages/runtime/objective-generation-custody.mjs';

function syntheticDescriptor(binding,request,sessionId){
 const ref=binding.runId,descriptor={schemaVersion:1,kind:'objective.strategy.draft',path:'meri-objective-strategy-draft.result.json',sourceAdmissionSha256:hash('source-admission'),sourceRequestSha256:hash(request),typedRequestSha256:hash('typed-request'),resultRef:ref,resultSha256:hash('result'),fileSha256:hash('file'),bytes:4,
  execution:{provider:'synthetic-provider',model:'synthetic-model',receiptRef:ref,receiptSha256:'',bindingSha256:hash(binding)},
  observation:{sessionId,completedAtMs:NOW,state:'succeeded',payloadSha256:hash('payload')}};
 descriptor.execution.receiptSha256=hash(typedExecutionWitness(descriptor));return descriptor;
}

function fixture({objectiveGeneration,captureEnabled=true,capabilities}={}){
 const f=continuationFixture(),binding=f.binding,versions=f.target.versions,scopes=f.target.scopes;
 const request={...f.target.sourceRequest,skill:null},contextSha256=hash({window:request.window,skill:request.skill,scopes}),sessionId=f.continuation.checkpoint.sessionId;
 const saved={run:{binding,versions,scopes,policyRevision:scopes[0].policyRevision,state:'queued',createdAt:new Date(NOW).toISOString()},request,...(capabilities===undefined?{}:{capabilities})};
 const observed={queries:0,captures:0,typed:undefined,options:undefined,events:[]};
 const owner={async load(){return saved;},async append({event}){observed.events.push(event);},async nextControls(){return [];},async claimControl(){throw Error('no control');},async ackControl(){throw Error('no control');},async recordCheckpoint(){throw Error('no lifecycle control');}};
 const lifecycle={async captureCheckpoint(){throw Error('no pause');},...(captureEnabled?{async captureCompletion(input){observed.captures++;observed.typed=input.typedResult;assert.equal(input.sessionId,sessionId);const sdkSession={binding,key:{projectKey:'synthetic-project',sessionId},ownerSha256:'a'.repeat(64),entriesCount:2},files={workspace:{contractVersion:'0.1.0',manifestId:id(901),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date(NOW).toISOString()},tasks:[]};return {binding,state:'completed',proof:{kind:'native-session',sdkSession,files,checkpointId:binding.runId,checkpointSha256:hash({sdkSession,files}),sourceRequestSha256:hash(request),contextSha256,versions,scopes,lastEventSequence:3}};}}:{})};
 const runtime={binding,versions,cwd:'/workspace/'+binding.conversationId,...SDK_MODEL_CONFIGURATION,sessionStore:{load(){},append(){}},deadlineMs:NOW+1000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024};
 const execute=createConversationActivity({runOwner:owner,lifecycle,objectiveGeneration,now:()=>NOW,prepareRuntime:async()=>runtime,query({prompt,options}){observed.queries++;observed.options=options;return {async *[Symbol.asyncIterator](){const iterator=prompt[Symbol.asyncIterator]();await iterator.next();yield {type:'system',subtype:'init',session_id:sessionId};yield {type:'result',subtype:'success',is_error:false,session_id:sessionId,structured_output:{state:'succeeded'}};},close(){}};}});
 return {execute,binding,request,sessionId,runtime,observed};
}

test('selected Objective captures a typed result through one SDK query and the existing completion',async()=>{
 const format={type:'json_schema',schema:{type:'object',properties:{state:{type:'string'}},required:['state'],additionalProperties:false}};
 let prepared=0,captured=0;
 let f,descriptor;
 const objectiveGeneration={async prepare(input){prepared++;assert.equal(input.model,SDK_MODEL_CONFIGURATION.model);assert.equal('proxyCredential' in input,false);assert.equal('proxyCredentialSha256' in input,false);return {deadlineMs:NOW+900,outputFormat:format,async capture({sdkResult}){captured++;assert.equal(sdkResult.structured_output.state,'succeeded');descriptor=syntheticDescriptor(f.binding,f.request,f.sessionId);return descriptor;}};}};
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
 const runtime={binding,versions,cwd:'/workspace/'+binding.conversationId,...SDK_MODEL_CONFIGURATION,sessionStore:{load(){},append(){}},deadlineMs:NOW+1000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024};
 const plain=buildConversationOptions(runtime,new AbortController());assert.equal(plain.outputFormat,undefined);
 const format={type:'json_schema',schema:{type:'object'}},selected=buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,undefined,undefined,format);
 assert.deepEqual(selected.outputFormat,format);
 assert.throws(()=>buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,undefined,undefined,{type:'json',schema:{type:'object'}}),/RUNTIME_CONFIGURATION/);
});
test('an Objective run never admits the SDK clarifying-question tool; such a policy is refused before any SDK query',async()=>{
 const f=fixture({objectiveGeneration:{async prepare(){return {deadlineMs:NOW+900,outputFormat:{type:'json_schema',schema:{type:'object'}},capture(){}};}},capabilities:{userQuestions:true}});
 await assert.rejects(f.execute({binding:f.binding}),/EXECUTION_FAILED/);
 assert.equal(f.observed.queries,0);assert.deepEqual(f.observed.events.map(e=>e.data.state),['starting','failed']);
});
