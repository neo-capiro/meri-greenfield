/** Real artifact service and canonical budget owner; inert SQL-script pool only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createArtifactValidators} from '../../../packages/contracts/artifacts-0.2/artifact-validation.mjs';
import {createPostgresArtifactService} from '../postgres-service.mjs';
import {harness,NOW,uuid} from '../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';

const schema=JSON.parse(await readFile(new URL('../../../packages/contracts/artifacts-0.2/artifact.schema.json',import.meta.url)));
const pub=JSON.parse(await readFile(new URL('../../../packages/contracts/meri.schema.json',import.meta.url)));
const ajv=addFormats(new Ajv({strict:true,allErrors:true}));ajv.addSchema(pub);ajv.addSchema(schema);
const v=createArtifactValidators({canonicalSha256,validatePublicShape:validateShape,validateShape(name,value){const check=ajv.getSchema(schema.$id+'#/$defs/'+name);assert.ok(check(value),ajv.errorsText(check.errors));}});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const requests={
  create_word:{operation:'create_word',format:'txt',title:'Test',content:{text:'Synthetic\n'}},
  create_excel:{operation:'create_excel',format:'xlsx',title:'Test',content:{sheets:[{name:'Data',rows:[[{value:2}]]}]}},
  create_powerpoint:{operation:'create_powerpoint',format:'pptx',title:'Test',content:{slides:[{title:'Synthetic',bullets:['Fixture']}]}},
  run_analysis:{operation:'run_analysis',format:'zip',title:'Test',content:{tables:[{name:'input',columns:['value'],rows:[[2]]}],source:'input',steps:[]}},
};
const details={txt:{encoding:'UTF-8',whitespace:'unchanged'},xlsx:{sheets:['Data'],formulas:0,formulaCache:'unverified-zero-placeholder; recalculation required'},pptx:{slides:1,editable:true,visualInspection:'pending'},zip:{rows:1,columns:['value'],chart:false}};
function fixture(operation='create_word'){
  const b=harness(),binding=structuredClone(b.f.binding),scopes=structuredClone(b.f.claims.scopes);
  const descriptor={operation:{id:operation,version:'0.2.0'},requiredGrants:['synthetic-artifact'],sourceRequirements:[]};
  b.allocation.manifest.allowedOperations=[descriptor.operation];b.allocation.manifestSha256=canonicalSha256(b.allocation.manifest);
  b.allocation.schedule.operations=[{operation:descriptor.operation,chargeMicrousd:10}];
  b.invocation.allocationSha256=canonicalSha256(b.allocation);
  const {invocationId:ignored,...grant}=b.invocation;
  const context={binding,scopes,evidence:[],assets:[],deadlineMs:NOW+8000,maxBytes:1024};
  const state={generations:0,puts:0,commits:0,authorizations:0,currentChecks:0,deny:false,closed:false,output:'synthetic',authExpiry:context.deadlineMs,executeHook:null,authorizeHook:null};
  const records=new Map(),buffers=new Map();
  const authority={async check({limitDeadline,signal}){
    state.currentChecks++;if(state.deny||signal?.aborted)throw Error('SYNTHETIC_DENIAL');limitDeadline(NOW+8000);
    return {binding,claims:structuredClone(b.f.claims),policyRevision:b.f.claims.policyRevision,subject:structuredClone(b.f.subject),deadlineMs:NOW+8000,
      decision:{decisionId:uuid('6'),actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${operation}@0.2.0`,scopes,policyRevision:b.f.claims.policyRevision,evaluatedAt:new Date(b.f.state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC'}};
  }};
  const authorize=async call=>{state.authorizations++;await state.authorizeHook?.(call);return {receiptId:'synthetic-authority',decision:'allow',action:call.action,binding:call.binding,scopesSha256:v.hash(call.scopes),resourceSha256:v.hash(call.resource),requestSha256:call.requestSha256,expiresAtMs:state.authExpiry};};
  const objects={async put(call){state.puts++;const object={objectId:call.objectId,versionId:'synthetic-storage',sha256:hash(call.bytes),bytes:call.bytes.length,scopes:call.scopes};buffers.set(object.objectId,Buffer.from(call.bytes));return object;},async get(object){return Buffer.from(buffers.get(object.objectId));}};
  const versions={async read(id){return structuredClone(records.get(id));},async commit(call){state.commits++;records.set(call.version.versionId,structuredClone({version:call.version,spec:call.spec,specSha256:call.specSha256,requestSha256:call.requestSha256,inspection:call.inspection}));return {status:'committed',versionId:call.version.versionId,requestSha256:call.requestSha256,versionSha256:v.hash(call.version)};}};
  const executor={async execute(call){state.generations++;await state.executeHook?.(call);const bytes=Buffer.from(state.output);return {bytes,inspection:{sha256:hash(bytes),bytes:bytes.length,format:call.request.format,nativeOpened:false,rendered:false,recalculated:false,members:[],details:details[call.request.format]}};}};
  const options={pool:b.pool,allocationJson:JSON.stringify(b.allocation),producerContext:{context:grant,producer:b.producer},descriptor,context,validators:v,authority,authorize,versions,objects,executor,now:()=>b.f.state.now,ids:()=>({artifactId:randomUUID(),versionId:randomUUID(),objectId:randomUUID()}),newReservationId:randomUUID,limits:{maxRequestMs:9000,maxResponseBytes:65536},sourceEnabled:true};
  const create=changes=>createPostgresArtifactService({...options,...changes});
  const call={deliveryId:'artifact-one',baseVersionId:null,request:structuredClone(requests[operation])};
  return {b,state,context,descriptor,options,create,call,records,buffers,ready:()=>create().bindTrustedGrant(JSON.stringify(b.invocation)),run:(value=call,signal)=>create().execute(value,b.credential,signal)};
}
for(const op of Object.keys(requests))test(`${op}: actual canonical reserve/marker/settle charges once and never regenerates on replay`,async()=>{
  const t=fixture(op);assert.equal(t.b.commands.length,0);await t.ready();const result=await t.run();
  assert.equal(result.version.generationStatus,'draft');assert.equal(result.execution.nativeQualified,false);assert.equal(t.state.generations,1);
  const row=[...t.b.state().produced.values()][0],r=[...t.b.state().reservations.values()][0];
  const retained=t.records.get(result.version.versionId),completion={...retained,expectedParentVersionId:null};
  assert.equal(row.completion.resultSha256,v.hash(completion));assert.equal(row.arguments_sha256,result.execution.requestSha256);
  assert.equal(row.completion.outputBytes,result.version.object.bytes);assert.equal(r.state,'SETTLED');assert.equal(t.b.state().budget.consumed_micro_usd,'10');
  await assert.rejects(t.run());assert.equal(t.state.generations,1);assert.equal(t.b.state().reservations.size,1);
  const observed=await t.create().reconcileInvocation(t.call);assert.equal(observed.stage,'SETTLED');assert.equal(observed.resultDelivered,false);assert.equal(t.state.generations,1);
});
test('revision consumes exact prior version, charges a distinct delivery and preserves original',async()=>{
  const t=fixture();await t.ready();const first=await t.run();const next={...t.call,deliveryId:'artifact-two',baseVersionId:first.version.versionId};
  const second=await t.run(next);assert.equal(second.version.parentVersionId,first.version.versionId);assert.equal(second.version.artifactId,first.version.artifactId);assert.equal(t.records.size,2);assert.equal(t.b.state().budget.consumed_micro_usd,'20');
});
test('default disabled and sandbox refusal precede all pool/executor ports',()=>{
  const t=fixture();assert.throws(()=>t.create({sourceEnabled:false}).execute(t.call,t.b.credential),/UNAVAILABLE/);
  const a=fixture('run_analysis'),program={objectId:randomUUID(),versionId:'immutable',sha256:'a'.repeat(64),bytes:1,scopes:a.context.scopes};
  assert.throws(()=>a.run({...a.call,request:{operation:'run_analysis',format:'sandbox',title:'General',content:{program,inputs:[],outputs:['result.json']}}}),/ANALYSIS_SANDBOX_DISPATCH_REQUIRED/);
  assert.equal(t.b.commands.length,0);assert.equal(a.b.commands.length,0);
});
test('factory never closes borrowed pool and does not expose kernel bypasses',()=>{
  const t=fixture(),owner=t.create();assert.equal(t.b.commands.length,0);
  for(const key of ['pool','dispose','budget','producer','settle','forInvocation','executeOwned','createExecutor'])assert.equal(Object.hasOwn(owner,key),false);
  for(const key of ['budget','producer','createExecutor'])assert.throws(()=>t.create({[key]:{}}));
});
test('mutation of factory inputs cannot substitute current request context or scopes',async()=>{
  const t=fixture();await t.ready();const owner=t.create();t.context.evidence.push({invalid:true});t.descriptor.operation.id='other';
  const result=await owner.execute(t.call,t.b.credential);assert.deepEqual(result.version.evidence,[]);assert.equal(t.state.generations,1);
});
test('same delivery with changed request conflicts before generation',async()=>{
  const t=fixture();await t.ready();await t.run();await assert.rejects(t.run({...t.call,request:{...t.call.request,title:'Substitution'}}));assert.equal(t.state.generations,1);
});
test('same delivery with changed trusted evidence conflicts before generation',async()=>{
  const t=fixture();await t.ready();await t.run();const context={...t.context,maxBytes:1000};await assert.rejects(t.create({context}).execute(t.call,t.b.credential));assert.equal(t.state.generations,1);
});
test('credential mismatch and current authority denial cause no generation/reservation',async()=>{
  const t=fixture();await t.ready();await assert.rejects(t.create().execute(t.call,'wrong'));t.state.deny=true;await assert.rejects(t.run());assert.equal(t.state.generations,0);assert.equal(t.b.state().reservations.size,0);
});
test('unrelated operation and foreign producer binding fail before I/O',()=>{
  const t=fixture();assert.throws(()=>t.run({...t.call,request:requests.create_excel}));assert.throws(()=>t.create({context:{...t.context,binding:{...t.context.binding,writerFence:2}}}));assert.equal(t.b.commands.length,0);
});
test('canonical allocation/capability ceilings reach actual executor and forbid oversized publication',async()=>{
  const t=fixture();t.b.f.claims.budgets.maxOutputBytes=4;await t.ready();t.state.executeHook=call=>assert.equal(call.maxBytes,4);await assert.rejects(t.run());assert.equal(t.state.puts,0);assert.equal([...t.b.state().reservations.values()][0].state,'UNKNOWN');
});
test('lower current output ceiling before publication refuses with retained liability',async()=>{
  const t=fixture();await t.ready();t.state.executeHook=()=>{t.b.f.claims.budgets.maxOutputBytes=4;};await assert.rejects(t.run());assert.equal(t.state.puts,0);assert.equal(t.b.state().budget.consumed_micro_usd,'0');assert.equal([...t.b.state().reservations.values()][0].state,'UNKNOWN');
});
test('generator failure retains explicit UNKNOWN without marker, refund or retry',async()=>{
  const t=fixture();await t.ready();t.state.executeHook=()=>{throw Error('GENERATION_FAILED');};await assert.rejects(t.run(),error=>error.code==='ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN'&&error.cause.message==='GENERATION_FAILED');
  const row=[...t.b.state().produced.values()][0];assert.equal(row.completion,null);assert.equal([...t.b.state().reservations.values()][0].state,'UNKNOWN');assert.equal(t.b.state().budget.consumed_micro_usd,'0');await assert.rejects(t.run());assert.equal(t.state.generations,1);
});
for(const phase of ['prepare','reserve','marker','settle'])test(`lost ${phase} ACK preserves actual owner identity and only explicit reconciliation`,async()=>{
  const t=fixture();await t.ready();t.b.loseStage(phase);await assert.rejects(t.run());assert.equal(t.b.state().produced.size,1);
  assert.equal(t.state.generations,['marker','settle'].includes(phase)?1:0);
  const r=await t.create().reconcileInvocation(t.call);assert.equal(r.stage,phase==='prepare'?'PREPARED':phase==='reserve'?'UNKNOWN':'SETTLED');
  assert.equal(t.b.state().budget.consumed_micro_usd,['marker','settle'].includes(phase)?'10':'0');
  if(phase!=='prepare'){await assert.rejects(t.run());assert.equal(t.state.generations,['marker','settle'].includes(phase)?1:0);}
});
for(const phase of ['connect','BEGIN',"SET LOCAL statement_timeout = '5s'"])test(`cancelled preparation at ${phase} cannot start generator or later accounting`,async()=>{
  const t=fixture();await t.ready();const gate=t.b.parkSetup(phase),controller=new AbortController(),pending=t.run(t.call,controller.signal);await gate.ready;controller.abort();gate.resume();await assert.rejects(pending);await new Promise(r=>setImmediate(r));assert.equal(t.state.generations,0);assert.equal(t.b.state().produced.size,0);
});
test('short artifact release deadline survives parked completion ACK and needs historical reconciliation',async()=>{
  const t=fixture();await t.ready();t.state.authorizeHook=()=>{if(t.state.authorizations===4)t.state.authExpiry=NOW+500;};
  const gate=t.b.parkCommit('marker'),pending=t.run();await gate.ready;t.b.setClock(NOW+501);gate.resume();await assert.rejects(pending);assert.equal(t.b.state().budget.consumed_micro_usd,'0');assert.equal(t.state.commits,1);
  assert.equal((await t.create().reconcileInvocation(t.call)).stage,'SETTLED');assert.equal(t.b.state().budget.consumed_micro_usd,'10');assert.equal(t.state.generations,1);
});
test('post-settlement revocation prevents result release without refund or regeneration',async()=>{
  const t=fixture();await t.ready();t.state.authorizeHook=()=>{if(t.state.authorizations===5)throw Error('SYNTHETIC_REVOKED');};await assert.rejects(t.run(),/ARTIFACT_EFFECT_UNKNOWN/);assert.equal(t.b.state().budget.consumed_micro_usd,'10');assert.equal(t.state.commits,1);assert.equal((await t.create().reconcileInvocation(t.call)).stage,'SETTLED');
});
test('borrowed version read keeps its original receiver for revision',async()=>{
  const t=fixture();await t.ready();const original=t.options.versions.read;t.options.versions.read=async function(...args){assert.equal(this,t.options.versions);return original(...args);};
  const result=await t.run();const revised=await t.run({...t.call,deliveryId:'receiver-revision',baseVersionId:result.version.versionId});assert.equal(revised.version.parentVersionId,result.version.versionId);
});
test('oversized released metadata reports committed effect uncertainty rather than apparent no-effect failure',async()=>{
  const t=fixture();await t.ready();await assert.rejects(t.create({limits:{maxRequestMs:9000,maxResponseBytes:512}}).execute(t.call,t.b.credential),error=>error.code==='ARTIFACT_EFFECT_UNKNOWN'&&error.versionCommitted===true&&error.cause.code==='ARTIFACT_RESPONSE_LIMIT');
  assert.equal(t.state.commits,1);assert.equal(t.b.state().budget.consumed_micro_usd,'10');assert.equal((await t.create().reconcileInvocation(t.call)).stage,'SETTLED');
});
