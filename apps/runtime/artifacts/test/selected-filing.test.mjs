/** Real session, Core artifact authority, runtime document application and immutable storage owners.
 * History/SQL/object transport and the proposed Core filing receiver are synthetic; no live receiver acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createActionSessionOwner} from '../../../control/action-host/session/owner.mjs';
import {createSelectedAttachmentFilingExecution} from '../selected-filing.mjs';
import {createCoreArtifactAuthority} from '../core-authority.mjs';
import {createRuntimeDocumentOptionsComposer} from '../composition.mjs';
import {createFilingVersionResolver} from '../filing-version-resolver.mjs';
import {nativeDocumentFixture,sha} from '../../../artifacts/test/native-document-fixture.mjs';
import {NOW,id} from '../../../artifacts/storage/test/sql-fixture.mjs';

const binding={tenantId:id(100),actorId:id(101),conversationId:id(102),runId:id(103),attemptId:id(104),workerId:id(105),writerFence:1};
const clientId=id(106),scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision:'policy1'}];
const limits={maxRequestMs:5000,maxRequestBytes:131072,maxResponseBytes:10485760};
async function fixture(t){
 t.mock.timers.enable({apis:['Date'],now:NOW});const now=()=>Date.now();
 const state={binding:structuredClone(binding),scopes:structuredClone(scopes),revoked:false,pendingTurn:null,cancelled:false,prior:null,events:[],uploads:[],saves:[],reads:0,decisionHook:null,registerHook:null,executeHook:null,readHook:null,lookupHook:null,coreDenied:false};
 const sessions=createActionSessionOwner({mode:'process-local',now,refusals:()=>{},limits:{maxSessions:8,maxRequestMs:5000,maxTtlMs:30000,maxFactBytes:65536},
  async verifyIdentity(){if(state.revoked)throw Error('REFUSED');return {principal:{tenantId:binding.tenantId,actorId:binding.actorId},identityRevision:'synthetic',checkedAtMs:now(),expiresAtMs:now()+30000};},
  async resolveContext({identity}){if(state.revoked)throw Error('REFUSED');return {binding:structuredClone(state.binding),scopes:structuredClone(state.scopes),selectedClientId:clientId,identitySha256:hash(identity),contextRevision:'synthetic',checkedAtMs:now(),expiresAtMs:now()+30000};}});
 let issued=await sessions.issue({identityCredential:'synthetic-native'});t.after(()=>sessions.close());
 const documents=nativeDocumentFixture({binding,scopes}),typed=await documents.run(),nativeBytes=Buffer.from('Exact captured file bytes');
 const native={objectId:id(700),versionId:'synthetic-exact-s3-version',sha256:sha(nativeBytes),bytes:nativeBytes.length,scopes};documents.state.objects.set(hash(native),nativeBytes);
 const file={kind:'native-file',binding,scopes,manifestId:id(701),createdAt:new Date(NOW).toISOString(),entry:{path:'output/café.txt',kind:'file',executable:false,object:native}};
 const run=()=>({binding:structuredClone(state.binding),scopes:structuredClone(state.scopes),state:state.cancelled?'cancelled':'completed'});
 const store={history:{async transcript(){return {latestRun:run(),pendingTurn:state.pendingTurn};}},async read(){return {run:run()};},lifecycle:{async readArtifactFile({versionId},check){check();return versionId===native.objectId?structuredClone(file):null;}}};
 const authority=createCoreArtifactAuthority({client:{origin:'https://core.synthetic.invalid',async read(){if(state.coreDenied)throw Error('CORE_DENIED');return {receipt:{principal:{tenantId:binding.tenantId,actorId:binding.actorId},conversationId:binding.conversationId,selectedClientId:clientId,identityRevision:'synthetic',contextRevision:'synthetic',authorityRevision:'synthetic',operations:['artifact.inspect','artifact.download'],limits:{maxArtifactBytes:10485760}},observedAtMs:now(),localExpiresAtMs:now()+30000};}},credentials:{serviceSecret:async()=> 'synthetic-service',admitBearer:(bearer,secret)=>{assert.notEqual(bearer,secret);return bearer;}},now,limits,maxOutputBytes:1048576});
 const compose=createRuntimeDocumentOptionsComposer({storage:{objects:documents.options.objects,versions:documents.options.versions},executor:documents.options.executor,pool:documents.options.pool,sessions,store,now});
 const optionsOwner={async resolve(call){state.events.push(call.intent);const {recheck,...options}=await authority.resolve({...call,sessions,store});return {documentOptions:compose(options),recheck};}};
 const command={contractVersion:'0.1.0',commandId:id(800),binding,action:'artifact.file',arguments:{clientId,conversationId:binding.conversationId},attachments:[typed.version.object,native],scopes,idempotencyKey:'synthetic-selected-filing'};
 const principal={tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[clientId]},proposal={proposalId:id(801),command,commandSha256:hash(command),createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),requiredApprover:{tenantId:binding.tenantId,actorId:binding.actorId}};
 const decision={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',approver:proposal.requiredApprover,decidedAt:proposal.createdAt,expiresAt:proposal.expiresAt,policyRevision:scopes[0].policyRevision};
 const result={commandSha256:proposal.commandSha256,files:command.attachments.map((object,i)=>({object,status:i?'pending':'saved',fileName:i?'café.txt':'Synthetic.txt',documentId:'synthetic-document-'+i,location:'synthetic-location',indexingStatus:i?'not_indexed':'pending',reused:false,...(i?{reason:'Indexing pending'}:{})}))};
 const outcome={execution:{kind:'native-artifact-file',proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:command.idempotencyKey,binding,completedAt:new Date(NOW).toISOString(),approvalDecisionSha256:hash(decision)},result};
 const source={async read(call){state.reads++;state.events.push('prior');await state.readHook?.(call);return structuredClone(state.prior);},
  async register(call){state.events.push('register');state.uploads.push(call);await state.registerHook?.(call);return state.receipt??{attachmentId:id(900+state.uploads.length),sha256:call.object.sha256,bytes:call.bytes.length,expiresAtMs:call.deadlineMs};},
  async execute(call){state.events.push('execute');state.saves.push(call);await state.executeHook?.(call);if(state.result)return structuredClone(state.result);state.prior={state:'OUTCOME',outcome};return {status:'observed',outcome:structuredClone(outcome)};}};
 const resolve=createFilingVersionResolver({versions:documents.options.versions,store,selectedClientId:clientId,now});
 const resolveVersion=async call=>{await state.lookupHook?.(call);return resolve(call);};
 const config={bound:()=>({sessions,store,retention:documents.sql.retention}),optionsOwner,source,readDecision:async()=>{await state.decisionHook?.();return state.decisionRevoked?null:structuredClone(decision);},resolveVersion,now,maxRequestMs:5000,limits};
 const owner=createSelectedAttachmentFilingExecution(config),call={proposal,decision,principal,deliveryId:'sdk:'+'a'.repeat(64),deadlineMs:NOW+5000};
 async function replaceSession(){sessions.revoke(issued.credential);issued=await sessions.issue({identityCredential:'synthetic-replacement'});}
 async function advance(){state.binding={...state.binding,runId:id(710),attemptId:id(711),workerId:id(712),writerFence:2};await replaceSession();}
 return {state,sessions,documents,native,nativeBytes,typed,proposal,decision,outcome,config,owner,call,now,replaceSession,advance};
}

test('actual typed and native custody preflight precedes uploads; exact bytes and honest pending outcome survive',async t=>{
 const f=await fixture(t),result=await f.owner.execute(f.call);assert.deepEqual(result,{status:'observed',outcome:f.outcome});
 assert.equal(f.state.events[0],'prior');assert.equal(f.state.events.filter(x=>x==='download').length,2);
 assert(f.state.events.lastIndexOf('download')<f.state.events.indexOf('register'));assert.equal(f.state.saves.length,1);
 assert.deepEqual(f.state.uploads.map(x=>x.bytes),[Buffer.from(f.documents.call.request.content.text),f.nativeBytes]);
 assert.deepEqual(f.state.uploads.map(x=>x.mimeType),['text/plain; charset=utf-8','application/octet-stream']);
 for(const call of [...f.state.uploads,...f.state.saves]){assert.deepEqual(call.proposal,f.proposal);assert.deepEqual(call.binding,binding);assert.equal(Object.hasOwn(call,'credential'),false);assert.equal(call.deadlineMs<=f.call.deadlineMs,true);}
 assert.deepEqual(f.state.saves[0].attachments.map(x=>x.object),f.proposal.command.attachments);
 assert.equal(f.state.events.slice(f.state.events.indexOf('execute')+1).filter(x=>x==='inspect').length,2);
});

test('canonical prior OUTCOME is returned on execute/read without another registration or save',async t=>{
 const f=await fixture(t);await f.owner.execute(f.call);const before=f.state.uploads.length;
 assert.deepEqual(await f.owner.execute(f.call),{status:'observed',outcome:f.outcome});assert.deepEqual(await f.owner.read(f.call),{state:'OUTCOME',outcome:f.outcome});
 assert.equal(f.state.uploads.length,before);assert.equal(f.state.saves.length,1);
});
test('canonical UNKNOWN remains unknown without downloads/uploads; read of fresh null is read-only',async t=>{
 const f=await fixture(t);assert.equal(await f.owner.read(f.call),null);f.state.prior={state:'UNKNOWN'};
 assert.deepEqual(await f.owner.execute(f.call),{status:'indeterminate'});assert.deepEqual(await f.owner.read(f.call),{state:'UNKNOWN'});
 assert.equal(f.state.uploads.length,0);assert.equal(f.state.events.includes('download'),false);
});
for(const revoked of [false,true])test(`historical outcome survives ${revoked?'expired and revoked':'expired'} approval while current custody remains required`,async t=>{
 const f=await fixture(t),call=structuredClone(f.call);f.state.prior={state:'OUTCOME',outcome:f.outcome};
 t.mock.timers.tick(60001);f.documents.state.clock=f.now();await f.replaceSession();call.deadlineMs=f.now()+5000;f.state.decisionRevoked=revoked;
 assert(f.now()>Date.parse(f.proposal.expiresAt));assert(f.now()>Date.parse(f.decision.expiresAt));assert.deepEqual(call.proposal,f.proposal);assert.deepEqual(call.decision,f.decision);
 f.state.readHook=({proposal})=>assert.deepEqual(proposal,f.proposal);
 f.state.decisionHook=()=>{throw Error('Historical observation must not need an executable approval');};
 assert.deepEqual(await f.owner.read(call),{state:'OUTCOME',outcome:f.outcome});assert.deepEqual(await f.owner.execute(call),{status:'observed',outcome:f.outcome});
 assert.equal(f.state.uploads.length,0);f.documents.sql.suppressed.add(`${binding.tenantId}:artifact:${f.native.objectId}`);
 await assert.rejects(f.owner.read(call),e=>e.effect==='none');assert.equal(f.state.uploads.length,0);
});
test('expired or revoked approval with absent canonical outcome never starts a fresh upload',async t=>{
 const f=await fixture(t);f.state.decisionRevoked=true;await assert.rejects(f.owner.execute(f.call),e=>e.effect==='none');f.state.decisionRevoked=false;
 t.mock.timers.tick(60001);f.documents.state.clock=f.now();await f.replaceSession();const expired={...f.call,deadlineMs:f.now()+5000};
 assert(f.now()>Date.parse(expired.proposal.expiresAt));assert.deepEqual(expired.proposal,f.proposal);
 assert.equal(await f.owner.read(expired),null);await assert.rejects(f.owner.execute(expired),{code:'DEADLINE',effect:'none'});
 assert.equal(f.state.uploads.length,0);
 f.state.prior={state:'UNKNOWN'};assert.deepEqual(await f.owner.read(expired),{state:'UNKNOWN'});assert.deepEqual(await f.owner.execute(expired),{status:'indeterminate'});
});
test('later accepted run uses its live session and binding while preserving original proposal/hash',async t=>{
 const f=await fixture(t);await f.advance();assert.deepEqual(await f.owner.currentBinding({proposal:f.proposal,deadlineMs:f.call.deadlineMs}),{binding:f.state.binding,selectedClientId:clientId});
 assert.equal((await f.owner.execute(f.call)).status,'observed');assert.notDeepEqual(f.state.saves[0].binding,binding);assert.deepEqual(f.state.saves[0].proposal,f.proposal);
});
for(const changed of ['second object','retention','Core','principal','client','General','decision','pending turn'])test(`${changed} refusal before registration has no effect`,async t=>{
 const f=await fixture(t),call=structuredClone(f.call);
 if(changed==='second object'){f.documents.state.objects.set(hash(f.native),Buffer.from('different bytes'));}
 if(changed==='retention')f.documents.sql.suppressed.add(`${binding.tenantId}:artifact:${f.native.objectId}`);
 if(changed==='Core')f.state.coreDenied=true;if(changed==='principal')call.principal.actorId=id(999);
 if(changed==='client')call.principal.clientIds=[];
 if(changed==='General'){call.proposal.command.scopes=[{tenantId:binding.tenantId,kind:'user',resourceId:binding.actorId,policyRevision:'policy1'}];call.proposal.commandSha256=hash(call.proposal.command);}
 if(changed==='decision')f.state.decisionRevoked=true;if(changed==='pending turn')f.state.pendingTurn={};
 await assert.rejects(f.owner.execute(call),error=>error.effect==='none');assert.equal(f.state.uploads.length,0);assert.equal(f.state.saves.length,0);
});
test('session replaced during decision await is refused rather than adopting its new credential',async t=>{
 const f=await fixture(t);let replaced=false;f.state.decisionHook=async()=>{if(!replaced){replaced=true;await f.replaceSession();}};
 await assert.rejects(f.owner.execute(f.call),error=>error.effect==='none');assert.equal(f.state.uploads.length,0);
});
test('session revoked during canonical prior read withholds the prior outcome',async t=>{
 const f=await fixture(t);f.state.prior={state:'OUTCOME',outcome:f.outcome};f.state.readHook=()=>{f.state.revoked=true;};
 await assert.rejects(f.owner.read(f.call),error=>error.effect==='none');assert.equal(f.state.uploads.length,0);
});
for(const lost of ['registration ack','receipt hash','retention','approval','session replacement','expired receipt'])test(`${lost} after first registration stays indeterminate and never saves`,async t=>{
 const f=await fixture(t);f.state.registerHook=async()=>{
  if(lost==='registration ack')throw Error('Synthetic transport detail must not escape');
  if(lost==='receipt hash')f.state.receipt={attachmentId:id(980),sha256:'f'.repeat(64),bytes:1,expiresAtMs:f.call.deadlineMs};
  if(lost==='retention')f.documents.sql.suppressed.add(`${binding.tenantId}:artifact:${f.native.objectId}`);
  if(lost==='approval')f.state.decisionRevoked=true;
  if(lost==='session replacement')await f.replaceSession();
  if(lost==='expired receipt')f.state.receipt={attachmentId:id(980),sha256:f.state.uploads[0].object.sha256,bytes:f.state.uploads[0].bytes.length,expiresAtMs:NOW};
 };
 assert.deepEqual(await f.owner.execute(f.call),{status:'indeterminate'});assert.equal(f.state.saves.length,0);assert.equal(f.state.uploads.length,1);
});
for(const lost of ['approval','session','retention','result substitution','approval hash','execution binding','unknown','ack'])test(`post-execute ${lost} cannot release observed success`,async t=>{
 const f=await fixture(t);f.state.executeHook=()=>{
  if(lost==='approval')f.state.decisionRevoked=true;if(lost==='session')f.state.revoked=true;
  if(lost==='retention')f.documents.sql.suppressed.add(`${binding.tenantId}:artifact:${f.native.objectId}`);
  if(lost==='result substitution')f.state.result={status:'observed',outcome:{...f.outcome,result:{...f.outcome.result,commandSha256:'f'.repeat(64)}}};
  if(lost==='approval hash')f.state.result={status:'observed',outcome:{...f.outcome,execution:{...f.outcome.execution,approvalDecisionSha256:'f'.repeat(64)}}};
  if(lost==='execution binding')f.state.result={status:'observed',outcome:{...f.outcome,execution:{...f.outcome.execution,binding:{...binding,runId:id(999)}}}};
  if(lost==='unknown')f.state.result={status:'indeterminate'};if(lost==='ack')throw Error('LOST_ACK');
 };
 assert.deepEqual(await f.owner.execute(f.call),{status:'indeterminate'});assert.equal(f.state.uploads.length,2);assert.equal(f.state.saves.length,1);
});
test('bounds and expired admission refuse without even reading canonical prior',async t=>{
 const f=await fixture(t),large=structuredClone(f.call);large.proposal.command.attachments[0].bytes=10485761;large.proposal.commandSha256=hash(large.proposal.command);
 await assert.rejects(f.owner.execute(large),error=>error.effect==='none');await assert.rejects(f.owner.execute({...f.call,deadlineMs:NOW}),{effect:'none',code:'DEADLINE'});
 assert.equal(f.state.reads,0);assert.equal(f.state.uploads.length,0);
});
test('deadline during first registration stays unknown and late completion cannot start another upload',async t=>{
 const f=await fixture(t);let resolve;f.state.registerHook=()=>new Promise(r=>{resolve=r;t.mock.timers.tick(5000);});
 assert.deepEqual(await f.owner.execute(f.call),{status:'indeterminate'});resolve();await new Promise(r=>setImmediate(r));
 assert.equal(f.state.uploads.length,1);assert.equal(f.state.saves.length,0);
});
