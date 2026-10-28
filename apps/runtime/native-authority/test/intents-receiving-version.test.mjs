/** SYNTHETIC F1 receiving-path regression. Drives the real runner availability/prepare admission, the real worker
 * intent availability gate and the ACTUAL PostgreSQL intent journal store over a serialized SQL double, against the
 * real current catalog and the real current validators (no stubbed catalog). Only the boundaries are synthetic: a
 * scripted SQL double, a scripted Core responder, a fixed clock. No DB, driver, listener, TLS, Core service, SDK
 * query or network: global fetch is disabled before any module under test is imported.
 *
 * This is the coverage the independent review found missing (F1): the advertised create_client@0.3.0 must survive
 * the whole receiving path, while legacy 0.2 keeps working and unregistered/version-mismatched/unknown facts refuse. */
import test from 'node:test';
import assert from 'node:assert/strict';

// No case here may reach the network. Disable it before importing the modules under test.
globalThis.fetch=()=>{throw new Error('network disabled in this test');};

const {assertIntentAvailability,createIntentRuntime}=await import('../../../worker/conversation/intents/runtime.mjs');
const {assertCapabilityPolicy}=await import('../../../worker/conversation/capabilities/policy.mjs');
const {createRunnerIntentsClient,runnerIntentAvailability,runnerIntentRequest}=await import('../intents-client.mjs');
const {createIntentMount}=await import('../../../control/intents/mount.mjs');
const {createClientRecordPreparer}=await import('../../../control/intents/client-record-preparer.mjs');
const {createPostgresIntentJournalStore}=await import('../../../control/intents/postgres-journal.mjs');
const {createClientRecordCoreClient}=await import('../client-record-client.mjs');
const {productFailure}=await import('../../../control/product-access/errors.mjs');

const NOW=1800000000000,digest='a'.repeat(64);
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const delivery=n=>'sdk:'+String(n).padStart(64,'0');
const journalKey=n=>({tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,deliveryId:delivery(n)});
const CREATE_CLIENT=Object.freeze({id:'create_client',version:'0.3.0'});
const CREATE_TASK=Object.freeze({id:'create_task',version:'0.2.0'});
const binding=Object.freeze({tenantId:'tenant',actorId:'actor',conversationId:uuid(1),runId:uuid(2),attemptId:uuid(3),workerId:uuid(4),writerFence:1});
const clientId=uuid(5),scopes=Object.freeze([{tenantId:'tenant',kind:'client',resourceId:clientId,policyRevision:'p1'}]);
const request={name:'New client',skipLdaCheck:true};
const facts=operations=>data({binding,operations,checkedAtMs:NOW,expiresAtMs:NOW+30000});
function data(value){return JSON.parse(JSON.stringify(value));}

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

/** The real mount over the real client-record preparer, the ACTUAL Postgres journal store and the current Core client. */
function composition(){
 const f=journalDouble(),store=createPostgresIntentJournalStore({pool:f.pool}),state={prepares:0};
 const client=createClientRecordCoreClient({origin:'https://core.invalid',now:()=>NOW,getServiceSecret:async()=>'synthetic-service-secret',
  reservedCredentials:async()=>new Set(),getCredentials:async()=>({credential:'synthetic-attended',expiresAtMs:NOW+60000}),
  async fetchImpl(url,init){
   const body=JSON.parse(init.body);assert.equal(init.headers.authorization,'Bearer synthetic-attended');assert.equal(body.version,2);
   state.prepares++;
   return Response.json({version:'0.1.0',proposalId:uuid(10),status:'proposed',request:body.request,
    context:{...body.context,identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),contextRevision:'c'.repeat(64)},
    createdAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString(),receipt:null,preflight:{duplicate:'clear',capacity:'allowed'}});
  }});
 const preparer=createClientRecordPreparer({operation:'create_client',binding,scopes,selectedClientId:clientId,client,
  currentRights:async()=>({scopes,expiresAtMs:NOW+60000}),policyRevision:'p1',now:()=>NOW,deadlineMs:NOW+60000});
 const mount=createIntentMount({binding,preparers:[preparer],journalStore:store,now:()=>NOW,limits:{maxRequestMs:5000},enabled:true,
  resultRelease:{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes,checkedAtMs:NOW,expiresAtMs:NOW+60000};}}});
 return {f,store,mount,state};
}

test('the durable journal store admits the current 0.3 record and 0.2, and still refuses unregistered or unknown',async()=>{
 const f=journalDouble(),store=createPostgresIntentJournalStore({pool:f.pool});
 // create_client@0.3.0 is the record the mount journals; it must reach SQL instead of being refused before it
 assert.deepEqual(await store.claim({key:journalKey(1),record:{operation:CREATE_CLIENT,argumentsSha256:digest},signal:undefined}),{claimed:true});
 assert.equal(f.state.commands.filter(sql=>sql.startsWith('INSERT')).length,1,'the 0.3 claim reached the journal SQL');
 // legacy 0.2 is preserved
 assert.deepEqual(await store.claim({key:journalKey(2),record:{operation:CREATE_TASK,argumentsSha256:digest},signal:undefined}),{claimed:true});
 // unregistered version, version-mismatched id and unknown id refuse before any SQL
 for(const operation of [{id:'create_client',version:'0.9.9'},{id:'create_task',version:'0.3.0'},{id:'unknown_operation',version:'0.2.0'}]){
  const before=f.state.commands.length;
  await assert.rejects(store.claim({key:journalKey(3),record:{operation,argumentsSha256:digest},signal:undefined}),e=>productFailure(e)?.code==='INTENT_JOURNAL_STATE',JSON.stringify(operation));
  assert.equal(f.state.commands.length,before,'a refused operation reached no SQL');
 }
});

test('the advertised create_client@0.3.0 survives the worker gate and the runner, and prepares through the durable journal',async()=>{
 const {f,mount,state}=composition();
 const availability=await mount.readAvailability({signal:undefined});
 assert.deepEqual(availability.operations,[CREATE_CLIENT]);
 // F1.2: the worker accepts the whole snapshot instead of refusing it because of the 0.3 row
 assert.equal(assertIntentAvailability(availability,binding,NOW).size,1);
 // F1.3: the runner availability facts survive
 assert.deepEqual(runnerIntentAvailability(availability,binding,NOW).operations,[CREATE_CLIENT]);
 // F1.4: the runner admits a 0.3 prepare request
 assert.doesNotThrow(()=>runnerIntentRequest('prepare',{binding,operation:CREATE_CLIENT,arguments:request,deliveryId:delivery(1)}));
 // the advertised 0.3 tool is reachable through the worker runtime, not silently dropped
 const runtime=await createIntentRuntime({binding,scopes,policy:assertCapabilityPolicy({governedIntents:true}),port:mount,now:()=>NOW,deadlineMs:NOW+60000});
 try{
  assert.deepEqual(runtime.available,[CREATE_CLIENT]);
  // F1.1 end to end: the first journal claim of a create_client prepare reaches SQL, and Core prepares
  const prepared=await mount.prepare({operation:CREATE_CLIENT,arguments:request,deliveryId:delivery(1)});
  assert.equal(prepared.proposal.operation,'create_client');
  assert.equal(state.prepares,1);
  assert.equal(f.state.commands.filter(sql=>sql.startsWith('INSERT')).length,1,'the 0.3 claim reached the journal SQL');
  assert.equal(f.state.commands.filter(sql=>sql.startsWith('UPDATE')).length,1,'PREPARED custody was settled');
  const [row]=f.rows.values();assert.equal(row.record.operation.version,'0.3.0');assert.equal(row.state,'PREPARED');
 }finally{await runtime.close();}
});

test('malformed, unregistered and unknown availability facts still refuse the whole snapshot at every boundary',()=>{
 for(const operation of [{id:'create_client',version:'0.9.9'},{id:'create_task',version:'0.3.0'},{id:'unknown_operation',version:'0.3.0'}]){
  assert.throws(()=>assertIntentAvailability(facts([operation]),binding,NOW),e=>e.code==='INTENT_AVAILABILITY_REFUSED',JSON.stringify(operation));
  assert.throws(()=>runnerIntentAvailability(facts([operation]),binding,NOW),e=>e.code==='UNAVAILABLE',JSON.stringify(operation));
  assert.throws(()=>runnerIntentRequest('prepare',{binding,operation,arguments:request,deliveryId:delivery(1)}),e=>e.code==='INVALID_ARGUMENTS',JSON.stringify(operation));
 }
 // a duplicate offered operation still refuses, and the retained 0.2 version is admitted everywhere
 assert.throws(()=>assertIntentAvailability(facts([CREATE_CLIENT,CREATE_CLIENT]),binding,NOW),e=>e.code==='INTENT_AVAILABILITY_REFUSED');
 assert.equal(assertIntentAvailability(facts([CREATE_TASK]),binding,NOW).size,1);
 assert.deepEqual(runnerIntentAvailability(facts([CREATE_TASK]),binding,NOW).operations,[CREATE_TASK]);
 assert.doesNotThrow(()=>runnerIntentRequest('prepare',{binding,operation:CREATE_TASK,arguments:{title:'Task'},deliveryId:delivery(1)}));
 // a declared deferred original (a capability the catalog publishes with no operation contract at any version) is
 // tolerated as an unlistable offer instead of refusing the whole snapshot; it can never become a visible tool
 const DEFERRED=Object.freeze({id:'find_path_to',version:'0.2.0'}),deferred=facts([CREATE_TASK,DEFERRED]);
 assert.equal(assertIntentAvailability(deferred,binding,NOW).size,2);
 assert.deepEqual(runnerIntentAvailability(deferred,binding,NOW).operations,[CREATE_TASK,DEFERRED]);
 // ...but it is not an operation, so the runner must never dispatch a prepare for it
 assert.throws(()=>runnerIntentRequest('prepare',{binding,operation:DEFERRED,arguments:{},deliveryId:delivery(1)}),e=>e.code==='INVALID_ARGUMENTS');
});

test('the runner client dispatches the current 0.3 and the retained 0.2 prepare and refuses what it cannot admit',async()=>{
 const wire=[];
 const client=createRunnerIntentsClient({origin:'https://control.invalid',credential:'task-capability-synthetic',binding,enabled:true,now:()=>NOW,
  fetchImpl:async(url,init)=>{wire.push({url,body:JSON.parse(init.body)});return Response.json({binding,operations:[CREATE_CLIENT],checkedAtMs:NOW,expiresAtMs:NOW+30000});}});
 assert.deepEqual((await client.readAvailability()).operations,[CREATE_CLIENT]);
 // an unregistered version is refused locally and never dispatched
 await assert.rejects(client.prepare({operation:{id:'create_client',version:'0.9.9'},arguments:request,deliveryId:delivery(1)}),e=>e.code==='INVALID_ARGUMENTS');
 assert.equal(wire.filter(({body})=>Object.hasOwn(body,'operation')).length,0,'a refused operation never dispatched');
 // the current 0.3 and the retained 0.2 both reach the wire (the scripted answer is what returns)
 await client.prepare({operation:CREATE_CLIENT,arguments:request,deliveryId:delivery(1)});
 await client.prepare({operation:CREATE_TASK,arguments:{title:'Task'},deliveryId:delivery(2)});
 const dispatched=wire.filter(({body})=>Object.hasOwn(body,'operation')).map(({body})=>body.operation.version);
 assert.deepEqual(dispatched,['0.3.0','0.2.0']);
});
