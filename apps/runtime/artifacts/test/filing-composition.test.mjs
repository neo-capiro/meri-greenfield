/** Actual Meri preparation/metadata, document custody, action sessions and fixed Core transport composed together.
 * Golden Core HTTP handlers and scripted SQL/history qualify only Meri's proposed wire; no Core/DB/provider acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {filingCustodyFixture,binding,scopes,selectedClientId,limits,now} from './filing-fixture.mjs';
import {createMetadataPoolFixture} from '../../../control/commands/approval-metadata/test/fixture.mjs';
import {createRuntimeAttachmentFilingPreparer} from '../filing-preparer.mjs';
import {createSelectedAttachmentFilingExecution} from '../selected-filing.mjs';
import {createFilingVersionResolver} from '../filing-version-resolver.mjs';
import {createCoreFilingClient} from '../core-filing-client.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {currentNativeApprovalSession} from '../../native-authority/approval-session.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,deliveryId='sdk:'+'f'.repeat(64);
for(const native of [false,true])test(`${native?'native captured':'typed generated'} exact selected bytes prepare, upload, file and replay through concrete Meri owners`,async t=>{
 const x=await filingCustodyFixture(t,{native}),sql=createMetadataPoolFixture(),connect=sql.pool.connect;
 sql.pool.connect=async()=>{const connection=await connect(),query=connection.query;return {...connection,async query(value){return typeof value==='string'?{rows:[]}:query(value);}};};
 const store={...x.f.store,history:{async transcript(_query,check){const saved=await x.f.store.read(binding,{limit:1},check);return {latestRun:saved.run,pendingTurn:null};}},
  lifecycle:{...x.f.store.lifecycle,async readArtifactFile(value,check){check();return native&&value.versionId===x.object.objectId?structuredClone(x.state.file):null;}}};
 const owned={sessions:x.f.sessions,store,retention:x.documents.sql.retention},bound=()=>owned;
 const resolveVersion=createFilingVersionResolver({versions:x.documents.options.versions,store,selectedClientId,now});
 const preparer=createRuntimeAttachmentFilingPreparer({pool:sql.pool,binding,scopes,selectedClientId,policyRevision:scopes[0].policyRevision,expiresAtMs:now()+45000,
  readCurrent:async()=>({binding,scopes,selectedClientId,policyRevision:scopes[0].policyRevision,checkedAtMs:now(),expiresAtMs:now()+5000}),bound:owned,
  optionsOwner:x.config.optionsOwner,resolveVersion,now,limits});
 const prepared=await preparer.prepare({arguments:{clientId:selectedClientId,conversationId:binding.conversationId,objects:[x.object]},deliveryId});
 assert.equal(prepared.status,'approval_required');assert.equal(sql.rows.size,1);assert(!x.state.intents.includes('download'),'preparation only inspects');
 const {proposal}=prepared,decision={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',approver:{tenantId:binding.tenantId,actorId:binding.actorId},
  decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};
 const wire={uploads:0,executes:0,reads:0,receipt:null,staged:null};
 const source=createCoreFilingClient({origin:'https://filing.synthetic.invalid',now,credentials:{async getCredentials(call){
  assert.deepEqual(call.binding,binding);assert.deepEqual(call.proposal,proposal);return {tenantId:binding.tenantId,actorId:binding.actorId,bearerToken:'synthetic-member',serviceSecret:'synthetic-service',expiresAtMs:now()+5000};
 }},fetchImpl:async(url,init)=>{
  if(url.endsWith('/attachments')){
   wire.uploads++;const file=init.body.get('file'),bytes=Buffer.from(await file.arrayBuffer());assert.deepEqual(bytes,x.expectedBytes);
   assert.equal(file.name,native?'café.txt':'Synthetic.txt');assert.equal(file.type,native?'application/octet-stream':'text/plain; charset=utf-8');
   wire.staged={id:id(900),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length};
   return Response.json({...wire.staged,filename:file.name,kind:'text',status:'ok',pages:null,truncated:false,reason:null,chars:bytes.length},{status:201});
  }
  const body=JSON.parse(init.body);assert.deepEqual(body.proposal,proposal);assert.deepEqual(body.binding,proposal.command.binding);
  if(url.endsWith('/execution/read')){wire.reads++;return Response.json(wire.receipt===null?null:{state:'OUTCOME',outcome:wire.receipt});}
  assert(url.endsWith('/native/execute'));wire.executes++;assert.deepEqual(body.attachments,[{attachmentId:wire.staged.id,object:x.object}]);
  wire.receipt={execution:{kind:'native-artifact-file',proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey,binding:proposal.command.binding,completedAt:new Date(now()).toISOString(),approvalDecisionSha256:hash(decision)},
   result:{commandSha256:hash(proposal.command),files:[{object:x.object,fileName:native?'café.txt':'Synthetic.txt',status:'pending',documentId:id(901),location:'/clients/files',indexingStatus:'not_indexed',reused:false,reason:'Pending document scan'}]}};
  return Response.json({status:'observed',outcome:wire.receipt});
 }});
 const owner=createSelectedAttachmentFilingExecution({bound,optionsOwner:x.config.optionsOwner,source,readDecision:async()=>decision,resolveVersion,now,maxRequestMs:5000,limits});
 const call={proposal,principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[selectedClientId]},deliveryId,decision,deadlineMs:now()+5000};
 await currentNativeApprovalSession({...owned,now,proposal,check:()=>{}});
 const result=await owner.execute(call);assert.equal(result.status,'observed');assert.equal(result.outcome.result.files[0].status,'pending');
 assert.equal(wire.uploads,1);assert.equal(wire.executes,1);assert.deepEqual(result.outcome.result.files[0].object,x.object);
 assert.deepEqual(await owner.execute(call),result);assert.deepEqual(await owner.read(call),{state:'OUTCOME',outcome:result.outcome});
 assert.equal(wire.uploads,1);assert.equal(wire.executes,1);assert.equal(wire.reads,3);assert.equal(sql.rows.size,1);
 assert.equal(x.documents.state.executions.length,native?0:1,'filing creates no replacement artifact');
});
