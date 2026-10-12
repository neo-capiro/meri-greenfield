/** Independent actual artifact/current-authority/budget composition; scripted pool, no SQL engine. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createArtifactValidators} from '../../../packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createCurrentToolAuthority} from '../../gateway/authorization/current-tool-authority.mjs';
import {createPostgresArtifactService} from '../postgres-service.mjs';
import {harness,NOW,uuid} from '../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
const schema=JSON.parse(await readFile(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const pub=JSON.parse(await readFile(new URL('../../../packages/contracts/meri.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(pub);ajv.addSchema(schema);
const validators=createArtifactValidators({canonicalSha256,validatePublicShape:validateShape,validateShape(name,value){const check=ajv.getSchema(`${schema.$id}#/$defs/${name}`);assert.ok(check(value),ajv.errorsText(check.errors));}});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>structuredClone(value);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function subjectWithoutDecision(value){const copy=clone(value);delete copy.authorizationDecisionId;return copy;}
function setup(){
  const db=harness(),binding=clone(db.f.binding),scopes=clone(db.f.claims.scopes);
  const descriptor={operation:{id:'create_word',version:'0.2.0'},requiredGrants:['artifact.test'],sourceRequirements:[{sourceId:'artifact_versions',authority:'authoritative',purpose:'enumeration'}]};
  db.allocation.manifest.allowedOperations=[descriptor.operation];db.allocation.manifestSha256=canonicalSha256(db.allocation.manifest);
  db.allocation.schedule.operations=[{operation:descriptor.operation,chargeMicrousd:13}];db.invocation.allocationSha256=canonicalSha256(db.allocation);
  const {invocationId:unused,...grant}=db.invocation;
  const context={binding,scopes,evidence:[],assets:[],deadlineMs:NOW+7000,maxBytes:1024};
  const call={deliveryId:'review-delivery',baseVersionId:null,request:{operation:'create_word',format:'txt',title:'Independent',content:{text:'Evidence'}}};
  const state={generated:0,stored:0,committed:0,policyChecks:0,artifactChecks:0,reads:0,closed:0,body:Buffer.from('review bytes'),records:new Map(),objects:new Map(),commits:[],resources:[],policies:[],policyHook:null,artifactHook:null,executeHook:null,putHook:null,commitHook:null,getHook:null,capabilityHook:null,runHook:null,sourceHook:null,readHook:null};
  const policyPorts={
    async verifyCapability(){const claims=clone(db.f.claims);await state.capabilityHook?.(claims);return JSON.stringify(claims);},
    async currentRun(){const row={binding:clone(binding),policyRevision:db.f.claims.policyRevision,deadlineMs:NOW+8000,checkedAtMs:db.f.state.now};await state.runHook?.(row);return JSON.stringify(row);},
    async authorizeBusiness({operation,requiredGrants,input}){assert.deepEqual(operation,descriptor.operation);assert.deepEqual(requiredGrants,descriptor.requiredGrants);assert.equal(input.request.operation,'create_word');state.policyChecks++;
      const row={decision:{decisionId:uuid('6'),actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:'create_word@0.2.0',scopes:clone(scopes),policyRevision:db.f.claims.policyRevision,evaluatedAt:new Date(db.f.state.now).toISOString(),decision:'allowed',reasonCode:'INERT_REVIEW'},subject:clone(db.f.subject),grants:['artifact.test']};
      await state.policyHook?.(row);state.policies.push(clone(row));return JSON.stringify(row);},
    async authorizeSources({sourceRequirements}){assert.deepEqual(sourceRequirements,descriptor.sourceRequirements);const row={sourceIds:['artifact_versions'],enabled:true,policyRevision:db.f.claims.policyRevision,checkedAtMs:db.f.state.now};await state.sourceHook?.(row);return JSON.stringify(row);},
  };
  const authority=createCurrentToolAuthority({ports:policyPorts,now:()=>db.f.state.now,maxFactBytes:65536});
  const authorize=async input=>{state.artifactChecks++;state.resources.push(clone({...input,signal:undefined}));const receipt={receiptId:`review-receipt-${state.artifactChecks}`,decision:'allow',action:input.action,binding:clone(input.binding),scopesSha256:canonicalSha256(input.scopes),resourceSha256:canonicalSha256(input.resource),requestSha256:input.requestSha256,expiresAtMs:NOW+7000};await state.artifactHook?.(receipt,input);return receipt;};
  const versions={async read(id){assert.equal(this,versions);state.reads++;await state.readHook?.(id);return clone(state.records.get(id));},async commit(value){assert.equal(this,versions);state.committed++;state.commits.push(clone(value));const {expectedParentVersionId,...record}=clone(value);state.records.set(value.version.versionId,record);const receipt={status:'committed',versionId:value.version.versionId,requestSha256:value.requestSha256,versionSha256:canonicalSha256(value.version)};await state.commitHook?.(receipt,value);return receipt;}};
  const objects={async put(value){assert.equal(this,objects);state.stored++;const ref={objectId:value.objectId,versionId:'immutable-review',sha256:digest(value.bytes),bytes:value.bytes.length,scopes:clone(value.scopes)};state.objects.set(ref.objectId,Buffer.from(value.bytes));await state.putHook?.(ref,value);return ref;},async get(ref){assert.equal(this,objects);let bytes=Buffer.from(state.objects.get(ref.objectId));if(state.getHook)bytes=await state.getHook(bytes,ref);return bytes;}};
  const executor={async execute(value){assert.equal(this,executor);state.generated++;await state.executeHook?.(value);const bytes=Buffer.from(state.body);return {bytes,inspection:{sha256:digest(bytes),bytes:bytes.length,format:'txt',nativeOpened:false,rendered:false,recalculated:false,members:[],details:{encoding:'UTF-8',whitespace:'unchanged'}}};}};
  const options={pool:db.pool,allocationJson:JSON.stringify(db.allocation),producerContext:{context:grant,producer:db.producer},descriptor,context,validators,authority,authorize,versions,objects,executor,now:()=>db.f.state.now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),newReservationId:randomUUID,limits:{maxRequestMs:9000,maxResponseBytes:65536},sourceEnabled:true};
  const owner=changes=>createPostgresArtifactService({...options,...changes});
  return {db,state,context,call,options,owner,async bind(){await owner().bindTrustedGrant(JSON.stringify(db.invocation));},run:(value=call)=>owner().execute(value,db.credential),row:()=>[...db.state().produced.values()][0],reservation:()=>[...db.state().reservations.values()][0]};
}

test('real current-authority + artifact + canonical owner hashes committed record, not delivery',async()=>{
  const t=setup();await t.bind();const result=await t.run(),record=t.state.commits[0],row=t.row();
  assert.equal(row.completion.resultSha256,canonicalSha256(record));assert.notEqual(row.completion.resultSha256,canonicalSha256(result));
  assert.equal(row.arguments_sha256,canonicalSha256({request:t.call.request,context:t.context,baseVersionId:null}));assert.equal(record.requestSha256,row.arguments_sha256);
  assert.equal(record.specSha256,canonicalSha256(t.call.request));assert.equal(row.completion.outputBytes,result.version.object.bytes);
  assert.equal(t.db.state().budget.consumed_micro_usd,'13');assert.equal(t.reservation().state,'SETTLED');assert.equal(t.state.policyChecks,5);assert.equal(t.state.artifactChecks,5);
  const last=t.state.resources.at(-1);assert.deepEqual(last.resource.object,result.version.object);assert.deepEqual(last.binding,t.context.binding);
  const historical=await t.owner({sourceEnabled:false}).reconcileInvocation(t.call);assert.equal(historical.resultDelivered,false);assert.equal(historical.stage,'SETTLED');
});
test('fresh decision ID may rotate while stable selected subject is unchanged',async()=>{
  const t=setup();t.state.policyHook=row=>{const id=randomUUID();row.decision.decisionId=id;row.subject.authorizationDecisionId=id;};await t.bind();await t.run();assert.equal(new Set(t.state.policies.map(p=>p.decision.decisionId)).size,5);assert.deepEqual(subjectWithoutDecision(t.state.policies[0].subject),subjectWithoutDecision(t.state.policies[4].subject));
});
for(const [name,hook] of [
  ['decision actor',r=>{r.decision.actor.actorId='another-actor';}],
  ['subject actor',r=>{r.subject.actorId='another-actor';}],
  ['missing grant',r=>{r.grants=[];}],
  ['decision policy',r=>{r.decision.policyRevision='b'.repeat(64);}],
  ['unmatched decision ID',r=>{r.subject.authorizationDecisionId=uuid('9');}],
])test(`canonical policy refuses ${name} before budget reservation`,async()=>{const t=setup();t.state.policyHook=hook;await t.bind();await assert.rejects(t.run());assert.equal(t.state.generated,0);assert.equal(t.db.state().reservations.size,0);});
for(const [name,field,hook] of [
  ['current writer fence','runHook',r=>r.binding.writerFence++],
  ['expired capability','capabilityHook',r=>r.expiresAt=new Date(NOW).toISOString()],
  ['disabled source','sourceHook',r=>r.enabled=false],
  ['missing source','sourceHook',r=>r.sourceIds=[]],
])test(`canonical authority refuses ${name} without effects`,async()=>{const t=setup();t.state[field]=hook;await t.bind();await assert.rejects(t.run());assert.equal(t.state.generated,0);assert.equal(t.db.state().reservations.size,0);});
test('subject change after reserve refuses execution and leaves UNKNOWN, never refund',async()=>{
  const t=setup();t.state.policyHook=row=>{if(t.state.policyChecks===2){row.subject.kind='team';row.subject.entityType='team';row.subject.entityIds=['another-team'];}};await t.bind();await assert.rejects(t.run());assert.equal(t.state.generated,0);assert.equal(t.reservation().state,'UNKNOWN');assert.equal(t.db.state().budget.consumed_micro_usd,'0');
});
test('artifact resource digest mismatch cannot borrow canonical policy permission',async()=>{const t=setup();t.state.artifactHook=r=>r.resourceSha256='0'.repeat(64);await t.bind();await assert.rejects(t.run());assert.equal(t.state.generated,0);assert.equal(t.db.state().reservations.size,0);});
test('changed trusted scopes cannot be substituted by otherwise valid current policy',async()=>{const t=setup();await t.bind();const context=clone(t.context);context.scopes[0].resourceId='another-tenant-scope';await assert.rejects(t.owner({context}).execute(t.call,t.db.credential));assert.equal(t.state.generated,0);});
test('current revocation after settlement prevents release but preserves charged version',async()=>{const t=setup();t.state.policyHook=r=>{if(t.state.policyChecks===5)r.decision.decision='denied';};await t.bind();await assert.rejects(t.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.versionCommitted);assert.equal(t.state.committed,1);assert.equal(t.db.state().budget.consumed_micro_usd,'13');assert.equal((await t.owner().reconcileInvocation(t.call)).resultDelivered,false);});
test('resource release expiry while marker ACK parked refuses now, reconciles historical completion',async()=>{
  const t=setup();await t.bind();t.state.artifactHook=r=>{if(t.state.artifactChecks===4)r.expiresAtMs=NOW+200;};const gate=t.db.parkCommit('marker'),pending=t.run();await gate.ready;t.db.setClock(NOW+201);gate.resume();await assert.rejects(pending);assert.equal(t.state.committed,1);assert.equal(t.db.state().budget.consumed_micro_usd,'0');assert.equal((await t.owner().reconcileInvocation(t.call)).stage,'SETTLED');assert.equal(t.db.state().budget.consumed_micro_usd,'13');
});
test('wrong commit acknowledgement cannot publish durable completion',async()=>{const t=setup();t.state.commitHook=r=>r.versionSha256='0'.repeat(64);await t.bind();await assert.rejects(t.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');assert.equal(t.state.committed,1);assert.equal(t.row().completion,null);assert.equal(t.reservation().state,'UNKNOWN');assert.equal(t.db.state().budget.consumed_micro_usd,'0');});
test('wrong immutable readback forbids version commit while retaining object uncertainty',async()=>{const t=setup();t.state.getHook=b=>Buffer.concat([b,Buffer.from('x')]);await t.bind();await assert.rejects(t.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');assert.equal(t.state.stored,1);assert.equal(t.state.committed,0);assert.equal(t.row().completion,null);});
test('late returned object write is retained as UNKNOWN and never starts version commit',async()=>{const t=setup();t.state.putHook=()=>t.db.setClock(NOW+9000);await t.bind();await assert.rejects(t.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');assert.equal(t.state.stored,1);assert.equal(t.state.committed,0);assert.equal(t.reservation().state,'UNKNOWN');});
test('late version acknowledgement cannot become a completion marker',async()=>{const t=setup();t.state.commitHook=()=>t.db.setClock(NOW+9000);await t.bind();await assert.rejects(t.run(),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN');assert.equal(t.state.records.size,1);assert.equal(t.row().completion,null);assert.equal(t.reservation().state,'UNKNOWN');});
test('borrowed receivers survive create and revise with exact base object and intent',async()=>{const t=setup();await t.bind();const first=await t.run();const original=clone(t.state.records.get(first.version.versionId));t.state.executeHook=value=>{assert.equal(value.base.request.title,original.spec.title);assert.equal(digest(value.base.bytes),first.version.object.sha256);};const next={...t.call,deliveryId:'new-revision',baseVersionId:first.version.versionId};const revised=await t.run(next);assert.equal(revised.version.parentVersionId,first.version.versionId);assert.deepEqual(t.state.records.get(first.version.versionId),original);assert.equal(t.state.commits[1].expectedParentVersionId,first.version.versionId);assert.equal(t.db.state().budget.consumed_micro_usd,'26');});
test('snapshot of delivery remains exact while generation is parked',async()=>{const t=setup(),gate=deferred(),entered=deferred();await t.bind();t.state.executeHook=async()=>{entered.resolve();await gate.promise;};const pending=t.run();await entered.promise;t.call.request.title='Mutated';t.call.request.content.text='Changed';gate.resolve();const result=await pending;assert.equal(t.state.commits[0].spec.title,'Independent');assert.notEqual(result.execution.requestSha256,canonicalSha256({request:t.call.request,context:t.context,baseVersionId:null}));});
for(const phase of ['reserve','marker','settle'])test(`lost ${phase} ACK cannot regenerate, only canonical reconciliation`,async()=>{const t=setup();await t.bind();t.db.loseStage(phase);await assert.rejects(t.run());const generated=t.state.generated;await assert.rejects(t.run());assert.equal(t.state.generated,generated);const old=await t.owner({sourceEnabled:false}).reconcileInvocation(t.call);assert.equal(old.resultDelivered,false);assert.equal(old.stage,phase==='reserve'?'UNKNOWN':'SETTLED');assert.equal(t.db.state().budget.consumed_micro_usd,phase==='reserve'?'0':'13');});
test('same delivery plus changed parent conflicts before read or regeneration',async()=>{const t=setup();await t.bind();const first=await t.run();await assert.rejects(t.run({...t.call,baseVersionId:first.version.versionId}));assert.equal(t.state.reads,0);assert.equal(t.state.generated,1);});
test('wrong producer task binding cannot reuse a bound grant',async()=>{const t=setup();await t.bind();const producerContext=clone(t.options.producerContext);producerContext.context.binding.attemptId=uuid('8');assert.throws(()=>t.owner({producerContext}));assert.equal(t.state.generated,0);});
test('no startup pool calls or invocation bypass; default disabled before prepare',()=>{const t=setup();const options={...t.options};delete options.sourceEnabled;const owner=createPostgresArtifactService(options);assert.equal(owner.sourceEnabled,false);assert.equal(t.db.commands.length,0);assert.throws(()=>owner.execute(t.call,t.db.credential),/UNAVAILABLE/);assert.deepEqual(Object.keys(owner).sort(),['bindTrustedGrant','execute','prepareInvocation','reconcileInvocation','sourceEnabled'].sort());assert.equal(t.db.commands.length,0);});
test('postpublication response ceiling reports exact committed uncertainty',async()=>{const t=setup();await t.bind();await assert.rejects(t.owner({limits:{maxRequestMs:9000,maxResponseBytes:512}}).execute(t.call,t.db.credential),e=>e.code==='ARTIFACT_EFFECT_UNKNOWN'&&e.versionCommitted&&e.cause.code==='ARTIFACT_RESPONSE_LIMIT');assert.equal(t.db.state().budget.consumed_micro_usd,'13');assert.equal(t.state.records.size,1);});
test('generator exception preserves original cause and durable UNKNOWN without marker',async()=>{const t=setup();const cause=Error('independent generator failure');t.state.executeHook=()=>{throw cause;};await t.bind();await assert.rejects(t.run(),e=>e.code==='ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN'&&e.cause===cause&&e.budgetSettlementUnknown);assert.equal(t.row().completion,null);assert.equal(t.reservation().state,'UNKNOWN');await assert.rejects(t.run());assert.equal(t.state.generated,1);});
for(const phase of ['putHook','commitHook'])test(`outer cancellation during ${phase} retains explicit effect uncertainty`,async()=>{
  const t=setup(),entered=deferred(),gate=deferred(),controller=new AbortController();await t.bind();
  t.state[phase]=async()=>{entered.resolve();await gate.promise;};
  const pending=t.owner().execute(t.call,t.db.credential,controller.signal);await entered.promise;controller.abort();
  let error;try{await pending;}catch(e){error=e;}finally{gate.resolve();await new Promise(resolve=>setImmediate(resolve));}
  assert.equal(error?.code,'ARTIFACT_EFFECT_UNKNOWN',JSON.stringify({name:error?.name,message:error?.message,ownKeys:Object.keys(error??{}),stored:t.state.stored,committed:t.state.committed,reservation:t.reservation()?.state,completion:t.row()?.completion}));assert.equal(typeof error.versionId,'string');assert.equal(t.reservation().state,'UNKNOWN');assert.equal(t.row().completion,null);
});
