/** SYNTHETIC qualified crossing for the schedule operation family (MO-02). It drives the REAL current catalog and
 * the catalog owner's REAL resolver, the real intent mount over the real schedule preparer and the real 0.3 schedule
 * tool interface, the ACTUAL PostgreSQL intent journal store over a serialized SQL double, the real worker
 * availability gate and the real runner client. Only the boundaries are synthetic: a scripted SQL double, a fixed
 * clock and the contract fixtures. No DB, driver, listener, TLS, Core service, SDK, Temporal, model or network call:
 * global fetch is disabled before any module under test is imported.
 *
 * The claim under test: the canonical catalog advertises schedule_task@0.3.0 beside the retained 0.2.0 row, and that
 * exact id@version survives the worker's declaration/receiving validation, the mount's schedule declaration admission,
 * the real owner's preparation, the recorded delivery and the runner, with its exact pin and schema digest. An
 * unsupported pin, a version mismatch and a mismatched byte pin are refused before any context, journal row, effect
 * or dispatch. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// No case here may reach the network. Disable it before importing the modules under test.
globalThis.fetch=()=>{throw new Error('network disabled in this test');};

const {assertCatalog,resolveOperationContract}=await import('../../../../packages/contracts/retrieval-0.2/validate.mjs');
const {assertIntentAvailability,createIntentRuntime}=await import('../../../worker/conversation/intents/runtime.mjs');
const {assertCapabilityPolicy}=await import('../../../worker/conversation/capabilities/policy.mjs');
const {createRunnerIntentsClient,runnerIntentAvailability,runnerIntentRequest}=await import('../intents-client.mjs');
const {createIntentMount}=await import('../../../control/intents/mount.mjs');
const {createScheduleIntentPreparer,SCHEDULE_INTENT_OPERATIONS}=await import('../../../control/intents/schedule-preparer.mjs');
const {createPostgresIntentJournalStore}=await import('../../../control/intents/postgres-journal.mjs');
const {createScheduleToolInterface}=await import('../../../control/schedules/tool-interface.mjs');
const {scheduleToolValidators}=await import('../../../control/schedules/schedule-validators.mjs');
const {fixture,validators,authority,NOW,canonicalSha256}=await import('../../../../packages/contracts/test/schedule-tool-interface-fixtures.mjs');
const {INTENT_ROWS,intentDescriptor,assertIntentCatalog}=await import('../../../worker/conversation/intents/catalog.mjs');
const currentCatalog=JSON.parse(readFileSync(new URL('../../../../packages/contracts/retrieval-0.3/catalog.json',import.meta.url)));

const CURRENT=Object.freeze({id:'schedule_task',version:'0.3.0'}),LEGACY=Object.freeze({id:'schedule_task',version:'0.2.0'});
const CREATE_TASK=Object.freeze({id:'create_task',version:'0.2.0'});
const WORK=Object.freeze({entry:'start-work',jobKind:'scheduled',deliverables:['Brief the team'],dependencies:[]});
const binding=Object.freeze({tenantId:'tenant',actorId:'delegate',conversationId:'00000000-0000-4000-8000-000000000001',runId:'00000000-0000-4000-8000-000000000002',attemptId:'00000000-0000-4000-8000-000000000003',workerId:'00000000-0000-4000-8000-000000000004',writerFence:1});
const scopes=Object.freeze([{tenantId:'tenant',kind:'client',resourceId:'client',policyRevision:'p1'}]);
const delivery=n=>'sdk:'+String(n).padStart(64,'0');
const journalKey=n=>({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:delivery(n)});
const facts=operations=>JSON.parse(JSON.stringify({binding,operations,checkedAtMs:NOW,expiresAtMs:NOW+30000}));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const installedToolBytes=readFileSync(new URL('../../../../packages/contracts/schedules-0.3/tool-interface.schema.json',import.meta.url));
/** The one request the fixture builds, with the canonical Work definition the 0.3 family admits and a recomputed
 * request digest (the fixture binds `requestSha256` to the request it built). */
function request(work){
 const f=fixture('schedule_task');
 if(work)f.request.work=structuredClone(WORK);
 f.context.scheduleContext.requestSha256=canonicalSha256(f.request);
 return f;
}

/** Serialized SQL double for the canonical journal table only. Mirrors apps/control/intents/test/postgres-journal.test.mjs. */
function journalDouble(){
 const rows=new Map(),state={commands:[]};let tail=Promise.resolve();
 const pool={async connect(){let local,unlock;return {async query(sql,p=[]){
  state.commands.push(sql);const out=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return out([]);
  if(sql==='COMMIT'){rows.clear();for(const [k,v] of local)rows.set(k,v);return out([]);}
  if(sql==='ROLLBACK')return out([]);
  assert.ok(sql.includes('meri_intents.preparations')&&!sql.includes('public.'),'only the reserved namespaced table');
  if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=new Map(rows);}
  const k=JSON.stringify(p.slice(0,4));
  if(sql.startsWith('INSERT')){if(local.has(k))return out([]);const row={delivery_id:p[3],created_at:new Date(0),record:JSON.parse(p[4]),record_sha256:p[5],state:'PENDING',outcome:null};local.set(k,row);return out([row]);}
  if(sql.startsWith('SELECT'))return out(local.has(k)?[local.get(k)]:[]);
  if(sql.startsWith('UPDATE')){const row=local.get(k);if(!row||row.state!=='PENDING'||row.record_sha256!==p[4])return out([]);row.state=p[5];row.outcome=p[6]===null?null:JSON.parse(p[6]);return out([row]);}
  assert.fail('Unexpected SQL');
 },release(){unlock?.();}};}};
 return {state,pool,rows};
}

/** The trusted context for the operation and the request actually being prepared: its digest is bound to that exact
 * request, and a Work definition is carried by the TRUSTED task resolution — the request only declares it, and the
 * resolved task is what the intent's `configuration.task` is built from. */
function trustedContext(operation,request,work){
 const fx=fixture(operation);
 fx.context.scheduleContext.requestSha256=canonicalSha256(request);
 if(work)fx.context.scheduleContext.taskResolution.task={...fx.context.scheduleContext.taskResolution.task,work:structuredClone(WORK)};
 return fx.context;
}
/** The real mount over the real schedule preparers of one exact pin, the real tool interface of that SAME family,
 * the ACTUAL Postgres journal store and a trusted context resolver bound to the request it is given. */
function composition(version,work=false){
 const f=journalDouble(),store=createPostgresIntentJournalStore({pool:f.pool}),resolved=[];
 const lifecycle={calls:[],async execute(r){lifecycle.calls.push(r);return {operation:r.intent.operation,intentId:r.intent.intentId,generation:r.intent.generation,projection:r.intent.projection,outcome:'ACKNOWLEDGED',physicalStopProven:false};},async list(){throw Error('unexpected lifecycle call');}};
 const tool=createScheduleToolInterface({lifecycle,validators:version==='0.3.0'?scheduleToolValidators:validators,authorize:authority,clock:()=>NOW});
 const preparers=SCHEDULE_INTENT_OPERATIONS.map(operation=>createScheduleIntentPreparer({operation,tool,binding,version,
  resolveContext:async({operation:op,request:rq})=>{resolved.push(op);return trustedContext(op,rq,work);}}));
 const mount=createIntentMount({binding,preparers,journalStore:store,now:()=>NOW,limits:{maxRequestMs:5000},enabled:true,
  resultRelease:{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:NOW,expiresAtMs:NOW+60000};}}});
 return {f,store,mount,lifecycle,resolved};
}

test('the canonical catalog advertises the 0.3 schedule successor at the exact installed tool digest, beside the retained 0.2 pin',()=>{
 const installed=sha256(installedToolBytes);
 const successor=resolveOperationContract(CURRENT).descriptor,retained=resolveOperationContract(LEGACY).descriptor;
 // the successor's declared pin IS the digest of the installed 0.3 tool document, not a copy of it
 assert.equal(successor.inputSchema.sha256,installed);
 assert.equal(successor.outputSchema.sha256,installed);
 assert.equal(successor.inputSchema.id,'urn:meri:schedules:tool-interface:0.3.0#/$defs/ScheduleTaskRequest');
 assert.equal(successor.availability,'unimplemented');assert.equal(successor.handler,null);
 // the retained 0.2 row keeps its own published digest and its own family
 assert.equal(retained.inputSchema.sha256,'2de8450111ea263876553f86b895d7fe93bca65ec55bcd649421e21a6f6d3fcf');
 assert.notEqual(retained.inputSchema.sha256,installed);
 // the worker can name the exact successor descriptor, and every advertised/retained row still resolves
 assert.equal(intentDescriptor(CURRENT).inputSchema.id,successor.inputSchema.id);
 assert.equal(intentDescriptor(LEGACY).inputSchema.sha256,retained.inputSchema.sha256);
 assertIntentCatalog();
 for(const row of INTENT_ROWS)assert.ok(intentDescriptor(row.operation),`${row.operation.id}@${row.operation.version}`);
 // a mismatched byte pin is refused at catalog admission, before any context or effect
 const tampered=structuredClone(currentCatalog);
 tampered.operations.find(e=>e.operation.id==='schedule_task'&&e.operation.version==='0.3.0').inputSchema.sha256='0'.repeat(64);
 assert.throws(()=>assertCatalog(tampered),/Catalog schema byte pin mismatch/);
});

test('the durable journal store admits the 0.3 schedule operation and still refuses unsupported, mismatched and unknown',async()=>{
 const f=journalDouble(),store=createPostgresIntentJournalStore({pool:f.pool});
 assert.deepEqual(await store.claim({key:journalKey(1),record:{operation:CURRENT,argumentsSha256:'a'.repeat(64)},signal:undefined}),{claimed:true});
 assert.equal(f.state.commands.filter(sql=>sql.startsWith('INSERT')).length,1,'the 0.3 claim reached the journal SQL');
 assert.deepEqual(await store.claim({key:journalKey(2),record:{operation:LEGACY,argumentsSha256:'a'.repeat(64)},signal:undefined}),{claimed:true});
 // the same delivery for the same recorded operation is a replay, never a second row
 assert.equal((await store.claim({key:journalKey(1),record:{operation:CURRENT,argumentsSha256:'a'.repeat(64)},signal:undefined})).claimed,false);
 let n=4;
 for(const operation of [{id:'schedule_task',version:'0.9.9'},{id:'schedule_task',version:'0.2.1'},{id:'cancel_scheduled_task',version:'0.3.1'},{id:'unknown_operation',version:'0.3.0'},{id:'create_task',version:'0.3.0'}]){
  const before=f.state.commands.length;
  await assert.rejects(store.claim({key:journalKey(n++),record:{operation,argumentsSha256:'a'.repeat(64)},signal:undefined}),undefined,JSON.stringify(operation));
  assert.equal(f.state.commands.length,before,`${JSON.stringify(operation)} reached no SQL`);
 }
});

test('the advertised 0.3 schedule successor survives the worker gate, the mount, the recorded delivery and the runner',async()=>{
 const {f,store,mount,lifecycle,resolved}=composition('0.3.0');
 const advertised=SCHEDULE_INTENT_OPERATIONS.map(id=>({id,version:'0.3.0'}));
 const availability=await mount.readAvailability({signal:undefined});
 assert.deepEqual(availability.operations,advertised);
 // the worker accepts the whole snapshot: the successors are registered in the canonical catalog, so they are admissible
 assert.equal(assertIntentAvailability(availability,binding,NOW).size,advertised.length);
 assert.deepEqual(runnerIntentAvailability(availability,binding,NOW).operations,advertised);
 assert.doesNotThrow(()=>runnerIntentRequest('prepare',{binding,operation:CURRENT,arguments:request().request,deliveryId:delivery(1)}));
 const runtime=await createIntentRuntime({binding,scopes,policy:assertCapabilityPolicy({governedIntents:true}),port:mount,now:()=>NOW,deadlineMs:NOW+60000});
 try{
  assert.deepEqual(runtime.available,advertised);
  const prepared=await mount.prepare({operation:CURRENT,arguments:request().request,deliveryId:delivery(1)});
  assert.equal(prepared.status,'approval_required');assert.equal(prepared.proposal.operation,'schedule_task');
  assert.equal(f.state.commands.filter(sql=>sql.startsWith('INSERT')).length,1,'the 0.3 claim reached the journal SQL');
  assert.equal(f.state.commands.filter(sql=>sql.startsWith('UPDATE')).length,1,'PREPARED custody was settled');
  const [row]=f.rows.values();
  // the RECORDED delivery retains the exact pin the composition prepared under, never a shape or a downgrade
  assert.deepEqual(row.record.operation,{id:'schedule_task',version:'0.3.0'});
  assert.equal(row.state,'PREPARED');
  // and nothing was dispatched: the prepared context carries no approval
  assert.deepEqual(lifecycle.calls,[]);assert.equal(resolved.length,1);
 }finally{await runtime.close();}
});

test('an ordinary 0.3 request and a Work 0.3 request both prepare through the real 0.3 owner, and the retained 0.2 owner keeps refusing Work',async()=>{
 const plainRequest=request(),workRequest=request(true);
 // the real 0.3 owner admits the Work definition into the intent it proposes, and the real 0.2 owner refuses it
 const workContext=trustedContext('schedule_task',workRequest.request,true);
 assert.deepEqual(scheduleToolValidators.prepare('schedule_task',workRequest.request,workContext).intent.configuration.task.work,WORK);
 assert.throws(()=>validators.prepare('schedule_task',workRequest.request,workContext),e=>e.code==='SCHEDULE_TOOL_DATA');
 const ordinary=composition('0.3.0'),withWork=composition('0.3.0',true);
 const plain=await ordinary.mount.prepare({operation:CURRENT,arguments:plainRequest.request,deliveryId:delivery(1)});
 assert.equal(plain.status,'approval_required');assert.equal(plain.proposal.operation,'schedule_task');
 const work=await withWork.mount.prepare({operation:CURRENT,arguments:workRequest.request,deliveryId:delivery(2)});
 assert.equal(work.status,'approval_required');
 // the recorded delivery is the Work intent, not the ordinary one: the approved hash differs, and the pin is exact
 assert.notEqual(work.proposal.intentSha256,plain.proposal.intentSha256);
 assert.deepEqual([...withWork.f.rows.values()][0].record.operation,{id:'schedule_task',version:'0.3.0'});
 assert.deepEqual(ordinary.lifecycle.calls,[]);assert.deepEqual(withWork.lifecycle.calls,[]);
 // the frozen 0.2 owner still admits the ordinary request and refuses the same Work definition before any effect
 const retained=composition('0.2.0');
 const legacy=await retained.mount.prepare({operation:LEGACY,arguments:plainRequest.request,deliveryId:delivery(1)});
 assert.equal(legacy.status,'approval_required');
 await assert.rejects(retained.mount.prepare({operation:LEGACY,arguments:workRequest.request,deliveryId:delivery(2)}),e=>e.code==='REFUSED');
 assert.deepEqual(retained.lifecycle.calls,[]);
 // the ordinary 0.2 delivery is PREPARED and the refused Work delivery is recorded FAILED, both under the exact 0.2 pin
 const retainedRows=[...retained.f.rows.values()];
 assert.deepEqual(retainedRows.map(r=>r.state).sort(),['FAILED','PREPARED']);
 assert.deepEqual([...new Set(retainedRows.map(r=>`${r.record.operation.id}@${r.record.operation.version}`))],['schedule_task@0.2.0']);
});

test('a declaration the owner does not declare, or a request the composition does not prepare, refuses before any context, row or reach',async()=>{
 // the schedule kind is admitted by its exact family pin, never by a version shape: a shape-valid but undeclared pin
 // fails at construction, before any context is resolved
 for(const version of ['0.9.9','0.2.1','v0.3.0','0.3',null]){
  let contexts=0;
  assert.throws(()=>createScheduleIntentPreparer({operation:'schedule_task',tool:createScheduleToolInterface({lifecycle:{calls:[],async execute(){throw Error('unexpected tool call');},async list(){throw Error('unexpected lifecycle call');}},validators:scheduleToolValidators,authorize:authority,clock:()=>NOW}),binding,version,
   resolveContext:async()=>{contexts++;return fixture('schedule_task').context;}}),e=>e.code==='INTENT_CONFIGURATION',`pin ${String(version)}`);
  assert.equal(contexts,0,`pin ${String(version)} resolved a context`);
 }
 // the MOUNT's own rule: a schedule-kind declaration is admitted by its exact family pin, so a shape-valid but
 // undeclared pin never becomes an admissible operation (every other owner kind keeps its version-shape rule)
 const scheduleStub=version=>({owner:'schedule',operation:{id:'schedule_task',version},binding:{...binding},async prepare(){throw Error('unexpected preparation');}});
 for(const version of ['0.2.1','0.9.9','0.3.0.0']){
  assert.throws(()=>createIntentMount({binding,preparers:[scheduleStub(version)],journalStore:createPostgresIntentJournalStore({pool:journalDouble().pool}),now:()=>NOW,limits:{maxRequestMs:5000},enabled:true,
   resultRelease:{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:NOW,expiresAtMs:NOW+60000};}}}),e=>e.code==='INTENT_CONFIGURATION',`declared ${version}`);
 }
 // a request naming a version the composed owner does not prepare is UNAVAILABLE before any context, journal row or reach
 for(const [declared,requested] of [['0.3.0',LEGACY],['0.2.0',CURRENT]]){
  const c=composition(declared);
  await assert.rejects(c.mount.prepare({operation:requested,arguments:request().request,deliveryId:delivery(1)}),e=>e.code==='UNAVAILABLE',`${declared} -> ${requested.version}`);
  assert.equal(c.resolved.length,0);assert.deepEqual(c.lifecycle.calls,[]);assert.equal(c.f.rows.size,0);
  assert.equal(c.f.state.commands.length,0);
 }
 // and the worker/runner refuse an unregistered or version-mismatched offered fact before any effect
 for(const operation of [{id:'schedule_task',version:'0.9.9'},{id:'schedule_task',version:'0.2.1'},{id:'unknown_operation',version:'0.3.0'}]){
  assert.throws(()=>assertIntentAvailability(facts([operation]),binding,NOW),e=>e.code==='INTENT_AVAILABILITY_REFUSED',JSON.stringify(operation));
  assert.throws(()=>runnerIntentAvailability(facts([operation]),binding,NOW),e=>e.code==='UNAVAILABLE',JSON.stringify(operation));
  assert.throws(()=>runnerIntentRequest('prepare',{binding,operation,arguments:request().request,deliveryId:delivery(1)}),e=>e.code==='INVALID_ARGUMENTS',JSON.stringify(operation));
 }
 // the retained 0.2 fact is still admitted everywhere, and the declared deferred original stays unlistable
 assert.equal(assertIntentAvailability(facts([LEGACY]),binding,NOW).size,1);
 assert.deepEqual(runnerIntentAvailability(facts([CREATE_TASK,LEGACY]),binding,NOW).operations,[CREATE_TASK,LEGACY]);
});

test('the runner client dispatches the 0.3 and the retained 0.2 schedule prepare and never dispatches what it cannot admit',async()=>{
 const wire=[];
 const client=createRunnerIntentsClient({origin:'https://control.invalid',credential:'task-capability-synthetic',binding,enabled:true,now:()=>NOW,
  fetchImpl:async(url,init)=>{wire.push({url,body:JSON.parse(init.body)});return Response.json({binding,operations:[CURRENT],checkedAtMs:NOW,expiresAtMs:NOW+30000});}});
 assert.deepEqual((await client.readAvailability()).operations,[CURRENT]);
 for(const operation of [{id:'schedule_task',version:'0.9.9'},{id:'schedule_task',version:'0.2.1'}]){
  await assert.rejects(client.prepare({operation,arguments:request().request,deliveryId:delivery(1)}),e=>e.code==='INVALID_ARGUMENTS',JSON.stringify(operation));
 }
 assert.equal(wire.filter(({body})=>Object.hasOwn(body,'operation')).length,0,'a refused operation never dispatched');
 await client.prepare({operation:CURRENT,arguments:request().request,deliveryId:delivery(1)});
 await client.prepare({operation:LEGACY,arguments:request().request,deliveryId:delivery(2)});
 assert.deepEqual(wire.filter(({body})=>Object.hasOwn(body,'operation')).map(({body})=>[body.operation.id,body.operation.version]),[['schedule_task','0.3.0'],['schedule_task','0.2.0']]);
});
