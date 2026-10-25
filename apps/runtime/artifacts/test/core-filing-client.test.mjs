/** Actual Meri transport with golden proposed Core responses. No Core server or receiver qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createCoreFilingClient} from '../core-filing-client.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,NOW=Date.parse('2026-10-25T00:00:00Z');
function fixture(){
 const bytes=Buffer.from('immutable selected bytes'),binding={tenantId:'tenant',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:'tenant',kind:'client',resourceId:id(9),policyRevision:'p1'}],object={objectId:id(10),versionId:'actual-s3-version',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,scopes};
 const command={contractVersion:'0.1.0',commandId:id(5),binding,action:'artifact.file',arguments:{clientId:id(9),conversationId:id(1)},attachments:[object],scopes,idempotencyKey:'selected-file-1'};
 const proposal={proposalId:id(6),command,commandSha256:hash(command),createdAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),requiredApprover:{tenantId:'tenant',actorId:'actor'}};
 const upload={id:id(20),filename:'memo.txt',kind:'text',status:'unsupported',pages:null,truncated:false,reason:'No extraction',chars:0,contentState:'pending_scan',limitation:'Pending scan',sha256:object.sha256,bytes:object.bytes};
 const outcome={execution:{kind:'native-artifact-file',proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:command.idempotencyKey,binding,completedAt:new Date(NOW).toISOString(),approvalDecisionSha256:'a'.repeat(64)},
  result:{commandSha256:proposal.commandSha256,files:[{object,fileName:'memo.txt',status:'pending',documentId:id(30),location:'/client/files',indexingStatus:'not_indexed',reused:false,reason:'Pending scan'}]}};
 const state={calls:[],credentials:0,now:NOW,hook:null,credentialHook:null};
 const credentials={async getCredentials(call){state.credentials++;assert.equal(call.purpose,'approval.execution');assert.equal(call.proposal.commandSha256,proposal.commandSha256);assert.deepEqual(call.binding,state.expectedBinding??binding);await state.credentialHook?.();return {tenantId:'tenant',actorId:'actor',bearerToken:'synthetic-user',serviceSecret:'synthetic-service',expiresAtMs:state.credentialExpiry??NOW+5000};}};
 const client=createCoreFilingClient({origin:'https://core.invalid',credentials,now:()=>state.now,fetchImpl:async(url,init)=>{
  state.calls.push({url,init});if(state.hook)return state.hook(url,init);
  if(url.endsWith('/attachments'))return Response.json(upload,{status:201});
  return Response.json(url.endsWith('/read')?{state:'OUTCOME',outcome}:{status:'observed',outcome});
 }});
 const common={proposal,binding,deadlineMs:NOW+10000},registration={...common,object,filename:'memo.txt',mimeType:'application/octet-stream',bytes};
 return {bytes,binding,object,proposal,upload,outcome,state,client,common,registration,execution:{...common,attachments:[{attachmentId:id(20),object}]}};
}
test('existing multipart upload201 verifies bytes receipt without treating extraction as filing success',async()=>{
 const f=fixture(),r=await f.client.register(f.registration);assert.deepEqual(r,{attachmentId:id(20),sha256:f.object.sha256,bytes:f.bytes.length,expiresAtMs:NOW+5000});
 const {url,init}=f.state.calls[0];assert.equal(url,'https://core.invalid/api/clio/attachments');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
 assert.equal(init.headers.authorization,'Bearer synthetic-user');assert.equal(init.headers['x-internal-service-secret'],'synthetic-service');assert.equal(init.headers['content-type'],undefined);
 const file=init.body.get('file');assert.equal(file.name,'memo.txt');assert.equal(file.type,'application/octet-stream');assert.deepEqual(Buffer.from(await file.arrayBuffer()),f.bytes);
 assert.deepEqual([...init.body.keys()],['file','filing']);
 assert.deepEqual(JSON.parse(init.body.get('filing')),{proposal:f.proposal,binding:f.proposal.command.binding,object:f.object});
});
test('canonical typed TXT MIME retains its charset parameter in the actual multipart file',async()=>{
 const f=fixture();await f.client.register({...f.registration,mimeType:'text/plain; charset=utf-8'});
 assert.equal(f.state.calls[0].init.body.get('file').type,'text/plain; charset=utf-8');
});
test('native filing execute/read preserves exact proposal and immutable object mapping, including pending observation',async()=>{
 const f=fixture();assert.deepEqual(await f.client.execute(f.execution),{status:'observed',outcome:f.outcome});
 assert.deepEqual(JSON.parse(f.state.calls[0].init.body),{proposal:f.proposal,binding:f.binding,attachments:f.execution.attachments});
 assert.deepEqual(await f.client.read(f.common),{state:'OUTCOME',outcome:f.outcome});assert.equal(f.state.credentials,2);
 assert.deepEqual(JSON.parse(f.state.calls[1].init.body),{proposal:f.proposal,binding:f.binding});
});
test('later current run selects credentials while registration/execute/read retain exact original proposal binding on wire',async()=>{
 const f=fixture(),binding={...f.binding,runId:id(90),attemptId:id(91),workerId:id(92),writerFence:2};f.state.expectedBinding=binding;
 await f.client.register({...f.registration,binding});await f.client.execute({...f.execution,binding});await f.client.read({...f.common,binding});
 assert.deepEqual(JSON.parse(f.state.calls[0].init.body.get('filing')),{proposal:f.proposal,binding:f.proposal.command.binding,object:f.object});
 assert(f.state.calls.slice(1).every(c=>hash(JSON.parse(c.init.body).binding)===hash(f.proposal.command.binding)));
});
test('closed Core UNKNOWN and absent read remain distinct and do not dispatch',async()=>{
 const f=fixture();f.state.hook=async()=>Response.json({status:'indeterminate'});assert.deepEqual(await f.client.execute(f.execution),{status:'indeterminate'});
 for(const answer of [null,{state:'UNKNOWN'}]){f.state.hook=async()=>Response.json(answer);assert.deepEqual(await f.client.read(f.common),answer);}
 assert(f.state.calls.slice(1).every(c=>c.url.endsWith('/execution/read')));
});
test('snapshot bytes and approved registration context survive mutation while credentials are resolving',async()=>{
 const f=fixture(),expected=Buffer.from(f.bytes),context=structuredClone({proposal:f.proposal,binding:f.proposal.command.binding,object:f.object});
 f.state.credentialHook=()=>{f.registration.bytes.fill(0);f.registration.object.sha256='0'.repeat(64);f.proposal.command.binding.runId=id(99);};
 f.upload.sha256=createHash('sha256').update(expected).digest('hex');const out=await f.client.register(f.registration);assert.equal(out.sha256,f.upload.sha256);
 assert.deepEqual(Buffer.from(await f.state.calls[0].init.body.get('file').arrayBuffer()),expected);
 assert.deepEqual(JSON.parse(f.state.calls[0].init.body.get('filing')),context);
});
for(const variation of ['duplicate','substitution','arbitrary-client','wrong-bytes','expired','cancelled'])test(`${variation} refuses before credentials or request dispatch`,async()=>{
 const f=fixture();let call=f.execution,method='execute';
 if(variation==='duplicate')call={...call,attachments:[...call.attachments,...call.attachments]};
 if(variation==='substitution')call={...call,attachments:[{...call.attachments[0],object:{...f.object,versionId:'different-version'}}]};
 if(variation==='arbitrary-client'){call=structuredClone(call);call.proposal.command.arguments.clientId=id(99);call.proposal.commandSha256=hash(call.proposal.command);}
 if(variation==='wrong-bytes'){method='register';call={...f.registration,bytes:Buffer.from('wrong')};}
 if(variation==='expired')f.state.now=NOW+60001;
 if(variation==='cancelled'){const ac=new AbortController();ac.abort();call={...call,signal:ac.signal};}
 await assert.rejects(f.client[method](call),e=>e.effect==='none');assert.equal(f.state.credentials,0);assert.equal(f.state.calls.length,0);
});
for(const variation of ['null-id','hash','bytes','missing-hash','wrong-status','lost-ack','bad-result'])test(`${variation} after write dispatch is UNKNOWN without retry`,async()=>{
 const f=fixture();f.state.hook=async()=>{
  if(variation==='lost-ack')throw Error('private transport details');
  if(variation==='bad-result')return Response.json({status:'observed',outcome:{...f.outcome,result:{...f.outcome.result,commandSha256:'0'.repeat(64)}}});
  const upload={...f.upload};if(variation==='null-id')upload.id=null;if(variation==='hash')upload.sha256='0'.repeat(64);if(variation==='bytes')upload.bytes++;
  if(variation==='missing-hash')delete upload.sha256;
  return Response.json(upload,{status:variation==='wrong-status'?200:201});
 };
 await assert.rejects(variation==='bad-result'?f.client.execute(f.execution):f.client.register(f.registration),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.effect==='unknown'&&!e.message.includes('private'));
 assert.equal(f.state.calls.length,1);
});
test('credential expiry and revoked source prevent writes; malformed read is a no-effect refusal',async()=>{
 const f=fixture();f.state.credentialHook=()=>{f.state.now=NOW+5001;};await assert.rejects(f.client.register(f.registration),e=>e.effect==='none');assert.equal(f.state.calls.length,0);
 const g=fixture();g.state.hook=async()=>Response.json({state:'OUTCOME',outcome:{...g.outcome,result:{...g.outcome.result,files:[]}} });await assert.rejects(g.client.read(g.common),e=>e.effect==='none');assert.equal(g.state.calls.length,1);
});
test('historical canonical outcome can be read after proposal expires, without another upload',async()=>{
 const f=fixture(),original=structuredClone(f.proposal);f.state.now=NOW+60001;f.state.credentialExpiry=NOW+65001;
 assert.deepEqual(await f.client.read({...f.common,deadlineMs:NOW+70000}),{state:'OUTCOME',outcome:f.outcome});
 assert.deepEqual(f.proposal,original);assert(f.state.calls.every(c=>c.url.endsWith('/read')));
});
for(const field of ['kind','proposalId','commandSha256','idempotencyKey','binding','completedAt','approvalDecisionSha256'])test(`uncorrelated native execution ${field} withholds a historical outcome`,async()=>{
 const f=fixture(),outcome=structuredClone(f.outcome);
 outcome.execution[field]=field==='binding'?{...f.binding,runId:id(99)}:field==='completedAt'?new Date(NOW-2000).toISOString():field==='approvalDecisionSha256'?'malformed':'substituted';
 f.state.hook=async()=>Response.json({state:'OUTCOME',outcome});await assert.rejects(f.client.read(f.common),e=>e.effect==='none');assert.equal(f.state.calls.length,1);
});
