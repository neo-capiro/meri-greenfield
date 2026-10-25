/** Actual product families, native resolver and public approval owner. SQL, S3 and Core are scripted transports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {documentsFamily,bindDocumentsSessions} from '../documents.mjs';
import {intentsComposition} from '../intents.mjs';
import {bindApprovalSessions} from '../../native-authority/approval-forwarder.mjs';
import {createAgentCoreIntentResolver} from '../../native-authority/execution-composition.mjs';
import {createRunnerIntentsApplication} from '../../native-authority/intents-http.mjs';
import {filingCustodyFixture,binding,scopes,selectedClientId,limits,now} from '../../artifacts/test/filing-fixture.mjs';
import {createMetadataPoolFixture} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {createPreparedSchedulePoolFixture} from '../../../control/intents/test/prepared-schedule-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const deliveryId='sdk:'+'b'.repeat(64),operation={id:'save_chat_attachments',version:'0.2.0'};
async function fixture(t,{bindRetention=true}={}){
 const x=await filingCustodyFixture(t,{native:true}),journal=createPreparedSchedulePoolFixture(),metadata=createMetadataPoolFixture();
 const pool={options:{connectionTimeoutMillis:5000,query_timeout:5000},async connect(){const j=await journal.pool.connect(),m=await metadata.pool.connect();return {async query(q,args){
  const text=typeof q==='string'?q:q.text;if(text.includes('meri_commands.approval_metadata'))return m.query(q);
  if(text.startsWith('SET TRANSACTION'))return {rows:[]};return j.query(q,args);
 },release(){j.release();m.release();}};}};
 const state={requests:[],downloads:0,decision:null,outcome:null,uploads:0,effects:0,secretHook:null,revoked:false,loseUploadAck:false};
 const retention={async assertServable(subject){if(state.revoked)throw Error('suppressed');return x.documents.sql.retention.assertServable(subject);}};
 const store={...x.f.store,history:{async transcript(_q,check){const saved=await x.f.store.read(binding,{limit:1},check);return {latestRun:saved.run,pendingTurn:null};}},
  lifecycle:{...x.f.store.lifecycle,async readArtifactFile(value,check){check();return value.versionId===x.object.objectId?structuredClone(x.state.file):null;}}};
 const kmsKeyId='arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001',origin='https://core.synthetic.invalid';
 const configuration={sourceEnabled:true,intents:{enabled:true,core:{origin,serviceSecretFile:'C:/synthetic/core'}},retention:{enabled:true},
  artifacts:{enabled:true,region:'us-east-1',bucket:'synthetic-artifact-bucket',prefix:'meri-artifacts',expectedBucketOwner:'111122223333',kmsKeyId,authority:{origin,serviceSecretFile:'/synthetic/core'}},
  limits:{requestMs:5000,requestBytes:131072},native:{maxResponseBytes:1048576},agentcore:{maxOutputBytes:1048576}};
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[selectedClientId],role:'member',permissions:[],membershipRevision:'synthetic'};
 const context={configuration,pool,now,client:{},native:{call(){assert.fail('no legacy native call');}},canonicalProductPorts:{conversationMembership:{async admit(){return {principal,expiresAtMs:now()+5000};},async recheck(){return principal;}}},artifactRecovery:{journal:x.documents.sql.journal,retention}};
 const shared=intentsComposition(context,{transport:{async readSecret(){await state.secretHook?.();return Buffer.from('synthetic-service');},async fetchImpl(url,init){
  state.requests.push(url);assert.equal(init.headers.authorization,'Bearer synthetic-native');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');
  if(url.endsWith('/attachments')){
   state.uploads++;const file=init.body.get('file'),bytes=Buffer.from(await file.arrayBuffer()),source=JSON.parse(init.body.get('filing'));assert.deepEqual(bytes,x.expectedBytes);assert.deepEqual(source.object,x.object);assert.deepEqual(source.binding,binding);
   if(state.loseUploadAck){state.loseUploadAck=false;throw Error('SYNTHETIC_REGISTRATION_ACK_LOST');}
   return Response.json({id:id(900),filename:file.name,kind:'text',status:'ok',pages:null,truncated:false,reason:null,chars:bytes.length,sha256:x.object.sha256,bytes:bytes.length},{status:201});
  }
  const body=JSON.parse(init.body);assert.deepEqual(body.binding,binding);
  if(url.endsWith('/record'))state.decision??={proposalId:body.proposal.proposalId,commandSha256:body.proposal.commandSha256,decision:body.decision,approver:body.approver,decidedAt:new Date(now()).toISOString(),expiresAt:body.proposal.expiresAt,policyRevision:scopes[0].policyRevision};
  else if(url.endsWith('/execution/read'))return Response.json(state.outcome===null?null:{state:'OUTCOME',outcome:state.outcome});
  else if(url.endsWith('/execute')){state.effects++;const p=body.proposal;assert.deepEqual(body.attachments,[{object:x.object,attachmentId:id(900)}]);state.outcome={execution:{kind:'native-artifact-file',proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey,binding,completedAt:new Date(now()).toISOString(),approvalDecisionSha256:hash(state.decision)},result:{commandSha256:p.commandSha256,files:[{object:x.object,status:'pending',fileName:'café.txt',documentId:id(901),location:'/files',indexingStatus:'not_indexed',reused:false,reason:'Pending scan'}]}};return Response.json({status:'observed',outcome:state.outcome});}
  else assert(url.endsWith('/decision'));
  return Response.json({decision:state.decision,checkedAtMs:now(),revoked:false});
 }}});
 const family=documentsFamily({authority:x.authority,executor:x.documents.options.executor,nativeCredentials:x.f.sessions,createS3Client(){return {async send(command){
  if(command.constructor.name==='GetBucketVersioningCommand')return {Status:'Enabled'};
  assert(['HeadObjectCommand','GetObjectCommand'].includes(command.constructor.name));assert.equal(command.input.VersionId,x.object.versionId);
  const result={VersionId:x.object.versionId,ContentLength:x.object.bytes,ChecksumSHA256:Buffer.from(x.object.sha256,'hex').toString('base64'),ChecksumType:'FULL_OBJECT',ServerSideEncryption:'aws:kms',SSEKMSKeyId:kmsKeyId,Metadata:{objectid:x.object.objectId,contentsha256:x.object.sha256,scopessha256:hash(scopes),requestsha256:'a'.repeat(64)}};
  if(command.constructor.name==='GetObjectCommand'){state.downloads++;result.Body=Readable.from([x.expectedBytes]);}return result;
 }};}});
 family(context);bindDocumentsSessions(context,x.f.sessions,bindRetention?retention:undefined,store);bindApprovalSessions(context,x.f.sessions,bindRetention?retention:undefined,store);
 const identity={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs:now()+60000,runtimeSessionId:id(950)};
 const current={binding,scopes,selectedClientId,policyRevision:scopes[0].policyRevision,checkedAtMs:now(),expiresAtMs:now()+5000};
 const resolveRun=createAgentCoreIntentResolver({context,nativeCredentials:x.f.sessions,execution:{async authenticate({credential}){assert.equal(credential,'native-execution');if(state.revoked)throw Error('revoked');return {execution:identity,scopes,selectedClientId,policyRevision:scopes[0].policyRevision,state:'running'};}},transitionAuthority:{async readCurrent(){return current;}}});
 const app=createRunnerIntentsApplication({resolveRun,enabled:true,now});
 const native=(route,body={})=>app.handle(new Request('https://meri.invalid/v1/runner/intents/'+route,{method:'POST',headers:{authorization:'Bearer native-execution','content-type':'application/json'},body:JSON.stringify({binding,...body})}));
 const approve=p=>shared.application.handle(new Request('https://meri.invalid/api/conversations/intents/decide',{method:'POST',headers:{authorization:'Bearer synthetic-user','content-type':'application/json'},body:JSON.stringify({conversationId:binding.conversationId,deliveryId,proposalId:p.proposalId,commandSha256:p.commandSha256,decision:'approved'})}));
 return {x,state,metadata,journal,shared,native,approve,store};
}
for(const loseAck of [false,true])test(`composed native filing ${loseAck?'recovers explicit lost-upload ACK':'prepares and approves'} through current product owners`,async t=>{
 const f=await fixture(t),available=await f.native('availability');assert.equal(available.status,200,await available.clone().text());assert((await available.json()).operations.some(o=>o.id===operation.id));
 const prepared=await f.native('prepare',{operation,deliveryId,arguments:{clientId:selectedClientId,conversationId:binding.conversationId,objects:[f.x.object]}});
 assert.equal(prepared.status,200,await prepared.clone().text());const {proposal}=await prepared.json();assert.equal(f.metadata.rows.size,1);assert.equal(f.state.uploads,0);assert.equal(f.state.downloads,2,'canonical native inspection verifies the bytes before and after preparation');
 f.state.loseUploadAck=loseAck;
 if(loseAck){const first=await f.approve(proposal);assert.equal(first.status,200,await first.clone().text());assert.equal((await first.json()).status,'indeterminate');assert.equal(f.state.effects,0);}
 const done=await f.approve(proposal);assert.equal(done.status,200,await done.clone().text());assert.equal((await done.json()).outcome.result.files[0].status,'pending');assert.equal(f.state.effects,1);
 assert.equal((await f.approve(proposal)).status,200);assert.equal(f.state.effects,1);assert.equal(f.state.uploads,loseAck?2:1);
 f.state.revoked=true;assert.notEqual((await f.approve(proposal)).status,200);assert.equal(f.state.effects,1);
});
test('filing availability requires the actual retention binding',async t=>{
 const f=await fixture(t,{bindRetention:false}),available=await f.native('availability');assert.equal(available.status,200);
 assert(!(await available.json()).operations.some(o=>o.id===operation.id));
 assert.notEqual((await f.native('prepare',{operation,deliveryId,arguments:{clientId:selectedClientId,conversationId:binding.conversationId,objects:[f.x.object]}})).status,200);
 assert.equal(f.metadata.rows.size,0);assert.equal(f.state.requests.length,0);
});
test('filing credential borrowing requires retained proposal, exact current binding and the same session across secret resolution',async t=>{
 const f=await fixture(t),prepared=await f.native('prepare',{operation,deliveryId,arguments:{clientId:selectedClientId,conversationId:binding.conversationId,objects:[f.x.object]}}),{proposal}=await prepared.json();
 const call={proposal,binding,deadlineMs:now()+5000};assert.equal(await f.shared.filingSource.read(call),null);const requests=f.state.requests.length;
 const changed=structuredClone(proposal);changed.command.idempotencyKey='other';changed.commandSha256=hash(changed.command);
 await assert.rejects(f.shared.filingSource.read({...call,proposal:changed}));
 await assert.rejects(f.shared.filingSource.read({...call,binding:{...binding,attemptId:id(999)}}));assert.equal(f.state.requests.length,requests);
 f.state.secretHook=()=>f.x.f.sessions.revoke(f.x.f.credential);
 await assert.rejects(f.shared.filingSource.read(call));assert.equal(f.state.requests.length,requests);assert.equal(f.state.uploads,0);
});
test('artifact filing cannot use initial-only provenance when accepted history is unavailable',async t=>{
 const f=await fixture(t),prepared=await f.native('prepare',{operation,deliveryId,arguments:{clientId:selectedClientId,conversationId:binding.conversationId,objects:[f.x.object]}}),{proposal}=await prepared.json();
 f.store.history.transcript=async()=>{throw Object.assign(Error('CONVERSATION_NOT_FOUND'),{code:'CONVERSATION_NOT_FOUND'});};
 const result=await f.approve(proposal);assert.notEqual(result.status,200);assert.equal(f.state.uploads,0);assert.equal(f.state.effects,0);
});
