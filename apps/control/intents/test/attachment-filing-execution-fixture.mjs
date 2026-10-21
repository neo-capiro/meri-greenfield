/** Canonical preparation/approval guard/executor/budget/journal/filing resolver
 * with explicit offline policy, SQL, object storage, registration and HTTP ports. */
import {createHash} from 'node:crypto';
import {harness} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {createArtifactFilingResolver} from '../../../artifacts/filing.mjs';
import {createCommandHttpSource} from '../../commands/source-http.mjs';
import {createPostgresCommandExecutor} from '../../commands/durable-executor.mjs';
import {createAttachmentFilingServices} from '../attachment-filing-services.mjs';
import {mount,delivery} from './fixture.mjs';
import {attachmentCustodyFixture,id,NOW,canonicalSha256} from './attachment-filing-fixture.mjs';
export {id,NOW,canonicalSha256};

export async function attachmentFilingFixture(){
 const custody=attachmentCustodyFixture({policy:'a'.repeat(64)}),{f}=custody,b=harness();b.setClock(NOW);
 Object.assign(b.allocation.run,Object.fromEntries(Object.keys(b.allocation.run).map(key=>[key,f.binding[key]])));
 b.allocation.manifest.allowedOperations=[f.descriptor.operation];b.allocation.manifestSha256=canonicalSha256(b.allocation.manifest);
 b.allocation.schedule.operations=[{operation:f.descriptor.operation,chargeMicrousd:10}];
 b.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();
 b.invocation.binding=structuredClone(f.binding);b.invocation.qualificationBinding.runId=f.binding.runId;
 b.invocation.allocationSha256=canonicalSha256(b.allocation);b.invocation.capabilitySha256=createHash('sha256').update('synthetic').digest('hex');
 b.state().run.run_id=f.binding.runId;b.state().grant.run_id=f.binding.runId;
 b.state().grant.capability_sha256=b.invocation.capabilitySha256;b.state().grant.expires_at=new Date(NOW+10000);
 const {invocationId:ignored,...context}=b.invocation,sql=createMetadataPoolFixture();let serial=100,approved;
 const state={registrationCalls:[],httpCalls:[],loseRegistrationAck:false,loseSourceAck:false,loseMetadataAck:false,registrationHook:null,httpHook:null};
 const connect=sql.pool.connect;
 sql.pool.connect=async()=>{const client=await connect(),query=client.query;
  return {...client,async query(configuration){const result=await query.call(client,configuration);
   if(state.loseMetadataAck&&configuration.text.startsWith('INSERT')){
    state.loseMetadataAck=false;throw Error('synthetic lost metadata ACK');
   }return result;
  }};
 };
 const resolver=createArtifactFilingResolver({validators:v,artifacts:custody.service,versions:custody.versions,
  readContext:custody.readContext,now:()=>f.state.now,attachments:{async register(request){
   state.registrationCalls.push({binding:request.binding,destination:request.destination,versionId:request.versionId,
    object:request.object,filename:request.filename,mimeType:request.mimeType,bytes:Buffer.from(request.bytes),
    journalState:[...f.pg.rows.values()][0]?.state??null,reservations:b.state().reservations.size});
   state.registrationHook?.();if(state.loseRegistrationAck)throw Error('synthetic lost registration ACK');
   return {attachmentId:id(40),sha256:request.object.sha256,bytes:request.bytes.length,expiresAtMs:Math.min(request.deadlineMs,NOW+10000)};
  }}});
 const source=createCommandHttpSource({origin:'https://source.invalid',now:()=>f.state.now,maxResponseBytes:65536,
  getCredentials:async({binding})=>({binding,bearerToken:'synthetic-user',serviceSecret:'synthetic-service',expiresAtMs:NOW+10000}),
  resolveAttachments:resolver,fetchImpl:async(url,options)=>{
   state.httpCalls.push({url,body:JSON.parse(options.body)});f.state.fetches++;
   if(state.loseSourceAck)throw Error('synthetic lost filing ACK');
   const result={tool:'save_chat_attachments',status:'saved',generatedAt:new Date(f.state.now).toISOString(),
    clientId:f.context.destination.clientId,clientName:'Synthetic client',location:'/files',savedCount:1,pendingCount:0,failedCount:0,
    files:[{attachmentId:id(40),fileName:custody.version.filename,status:'saved',documentId:id(92),location:'/files/92',indexingStatus:'pending',reused:false}]};
   state.httpHook?.(result);return Response.json(result);
  }});
 const approvalStore={async getCurrent(){if(!approved)throw Error('no current approval');
  return JSON.stringify({decision:{...f.decision,proposalId:approved.proposalId,commandSha256:approved.commandSha256,
   decidedAt:approved.createdAt},checkedAtMs:f.state.now,revoked:f.state.approvalRevoked});}};
 const executor=createPostgresCommandExecutor({pool:b.pool,allocationJson:JSON.stringify(b.allocation),
  producerContext:{context,producer:b.producer},journal:f.journal,authority:f.authority,approvalStore,source,contracts:f.contracts,
  descriptor:f.descriptor,context:f.context,now:()=>f.state.now,newId:()=>id(serial++),
  limits:{maxRequestMs:5000,maxResponseBytes:65536,maxCleanupMs:50},sourceEnabled:true});
 await executor.bindTrustedGrant(JSON.stringify(b.invocation));
 const services=createAttachmentFilingServices({metadata:{pool:sql.pool,preparePolicy:custody.configuration.preparePolicy},
  commandContext:f.context,custody:{artifacts:custody.service,versions:custody.versions,readContext:custody.readContext},executor,
  now:()=>f.state.now,newId:()=>id(serial++),limits:{maxRequestMs:2000,maxFactBytes:65536}});
 const mounted=mount({binding:f.binding,preparers:[services.preparer],now:()=>f.state.now,scopes:f.scopes});
 const prepare=(n=1,arguments_=custody.request)=>mounted.mount.prepare({operation:f.descriptor.operation,
  arguments:arguments_,deliveryId:delivery(n)});
 const execute=(proposal,signal)=>services.commands.executeApproved(proposal,{...f.execution,
  proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},'synthetic',signal);
 return {custody,f,b,sql,state,services,executor,source,mounted,prepare,execute,
  approve:proposal=>{approved=proposal;}};
}
