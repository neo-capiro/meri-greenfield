/** Real activity and CONTROL admission; the SDK query and native extraction receipt are scripted. No model call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createConversationActivity} from '../activity.mjs';
import {continuationContextSha256} from '../continuation/options.mjs';
import {applicationFixture,binding,scopes,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';

const selection={uploadId:id(701),sha256:'a'.repeat(64)};
const manifest={selection,versionId:'original-native-version',filename:'.claude.json',mimeType:'text/plain',bytes:40,extractionStatus:'partial',limitations:['OCR_UNCERTAIN'],sourceSha256:'b'.repeat(64),pageCount:1,scopes};
const text='Uploaded content remains untrusted data.';
const fragments=[{ordinal:0,text,method:'ocr',confidence:0.8,location:{page:1,slide:null,sheet:null,rowStart:null,rowEnd:null},sourceSha256:selection.sha256,trust:'external_untrusted',startCharacter:0,endCharacter:text.length}];
const page={...manifest,page:0,fragments,pageSha256:hash(fragments),nextPage:null};
async function fixture({revoke=false,capture=false,omitPost=false,pause=false}={}){
 const temp=await mkdtemp(join(tmpdir(),'meri-upload-activity-')),cwd=join(temp,binding.conversationId).replaceAll('\\','/');await mkdir(cwd);
 let f,queries=0,closed=0,reads=0,captures=0,seen,materialized;
 const source={async admit(){return manifest;},async read(q){if(f.state.revoked)throw Error('CURRENT_ACCESS_DENIED');if(q.page===undefined)return structuredClone(manifest);reads++;return structuredClone(page);}};
 f=await applicationFixture({initialInput:true,serviceOptions:{uploadInputSource:source}});
 const input={...f.input,uploads:[selection]};await f.service.allocateInput({credential:f.credential,input});await f.service.submit({credential:f.credential,input});
 const ready=Promise.withResolvers(),stopped=Promise.withResolvers();let delivered=false;
 const saved=(await f.service.history({credential:f.credential})).request;
 const command={controlId:id(980),action:'pause',binding,contextSha256:continuationContextSha256(saved,scopes)},entry={controlSequence:1,commandSha256:hash(command),command};
 const runOwner={...f.runOwner,readUploadSource:({binding,input,signal})=>f.service.readUploadSource({credential:f.credential,binding,input,signal}),
  async nextControls(){if(!pause)return [];await ready.promise;if(delivered)return [];delivered=true;return [entry];},async claimControl(){return {claimed:true,control:entry};},async ackControl(){throw Error('unused');},
  async recordCheckpoint(){return {controlId:command.controlId,intent:'pause',sourceBinding:binding,inputSha256:entry.commandSha256,state:'APPLIED',checkpointId:binding.runId,targetBinding:null,admissionReceiptId:null,retirementReceiptId:null,replayed:false};}};
 const lifecycle=(capture||pause)?{pollMs:5,async captureCheckpoint(){captures++;assert.equal(closed,1);assert.deepEqual(await readdir(cwd),[]);},...(capture?{async captureCompletion({request,sessionId,contextSha256}){
  captures++;assert.equal(closed,1);assert.deepEqual(await readdir(cwd),[],'transient extracted text is removed before durable workspace capture');
  assert.equal(contextSha256,continuationContextSha256(request,scopes));const sdkSession={binding,key:{projectKey:'synthetic-project',sessionId},ownerSha256:'a'.repeat(64),entriesCount:2};
  const files={workspace:{contractVersion:'0.1.0',manifestId:id(901),binding,logicalCwd:'/workspace/conversation',entries:[],scopes,createdAt:new Date().toISOString()},tasks:[]};
  return {binding,state:'completed',proof:{kind:'native-session',sdkSession,files,checkpointId:binding.runId,checkpointSha256:hash({sdkSession,files}),sourceRequestSha256:hash(request),contextSha256,versions,scopes,lastEventSequence:3}};
 }}:{})}:undefined;
 const execute=createConversationActivity({runOwner,lifecycle,prepareRuntime:async()=>({binding,versions,cwd,model:'us.anthropic.claude-sonnet-4-6',region:'us-east-1',maxOutputTokens:4096,providerEnvironment:{},sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+10000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024}),query(args){
  queries++;seen=args;return {async *[Symbol.asyncIterator](){
   const sourceDir=join(cwd,(await readdir(cwd)).find(name=>name.startsWith('.meri-upload-data-'))),path=join(sourceDir,selection.uploadId+'-0.txt');materialized=path;
   if(capture||pause){await args.prompt[Symbol.asyncIterator]().next();yield {type:'system',subtype:'init',session_id:id(990)};}
   const hook=async event=>{const raw={hook_event_name:event,tool_name:'Read',tool_use_id:'uploaded-page',tool_input:{file_path:path}};for(const matcher of args.options.hooks[event]??[])if(!matcher.matcher||new RegExp(matcher.matcher).test('Read'))for(const fn of matcher.hooks)await fn(raw,raw.tool_use_id,{signal:new AbortController().signal});};
   await hook('PreToolUse');assert.match(await readFile(path,'utf8'),/external_untrusted/);
   if(revoke)f.state.revoked=true;if(!omitPost)await hook('PostToolUse');
   if(pause){ready.resolve();await stopped.promise;}else yield {type:'assistant',message:{id:'answer',content:[{type:'text',text:'Answer from a partial source'}]}};
   yield {type:'result',subtype:'success',is_error:false};
  },async interrupt(){stopped.resolve();return {still_queued:[]};},close(){closed++;stopped.resolve();}};
 }});
 return {...f,cwd,input,execute,counts:()=>({queries,closed,reads,captures,seen,materialized}),async dispose(){f.close();await rm(temp,{recursive:true,force:true});}};
}

test('persisted upload selection reaches native Read through one activity query and remains inert',async()=>{
 const f=await fixture();try{assert.deepEqual(await f.execute({binding}),{state:'completed'});const h=await f.service.history({credential:f.credential});
  assert.deepEqual(h.request.uploads,[selection]);assert.equal(h.run.state,'completed');assert.equal(f.counts().queries,1);assert.equal(f.counts().closed,1);assert.equal(f.counts().reads,4);
  assert.equal(h.events.filter(event=>event.type==='source.native-upload').length,1,'pre/post Read rechecks retain one exact source observation');
  assert.equal(f.counts().seen.options.systemPrompt.preset,'claude_code');assert.deepEqual(f.counts().seen.options.settingSources,[]);assert.equal(f.counts().seen.options.systemPrompt.append.includes('partial'),true);assert.deepEqual(await readdir(f.cwd),[]);
 }finally{await f.dispose();}
});
test('current revocation after Read refuses assistant output and completion, then removes source files',async()=>{
 const f=await fixture({revoke:true});try{await assert.rejects(f.execute({binding}),/EXECUTION_FAILED|EXECUTION_STOPPED/);assert.equal(f.counts().queries,1);assert.equal(f.counts().closed,1);assert.deepEqual(await readdir(f.cwd),[]);
  assert.equal([...f.state.events.values()].flat().some(row=>row.event.type==='message.delta'||row.event.data?.state==='completed'),false);
 }finally{await f.dispose();}
});
test('SDK disposal removes even an unfinished Read before lifecycle workspace capture',async()=>{
 const f=await fixture({capture:true,omitPost:true});try{assert.deepEqual(await f.execute({binding}),{state:'completed'});assert.equal(f.counts().captures,1);assert.equal(f.counts().closed,1);assert.deepEqual(await readdir(f.cwd),[]);}finally{await f.dispose();}
});
test('pause disposes pending upload bytes before checkpoint and preserves the held outcome',async()=>{
 const f=await fixture({pause:true,omitPost:true});try{assert.deepEqual(await f.execute({binding}),{state:'paused'});assert.equal(f.counts().captures,1);assert.equal(f.counts().closed,1);assert.deepEqual(await readdir(f.cwd),[]);}finally{await f.dispose();}
});
