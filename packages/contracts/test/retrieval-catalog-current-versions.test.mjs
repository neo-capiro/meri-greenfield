/** The version-aware catalog continuation. A preserved catalog keeps asserting at its own exact counts and
 * every preserved descriptor keeps its published bytes, while the current catalog advertises registered
 * successors that route to their own schema family and validator group. Nothing here resolves a version
 * that is not registered, and no successor is reachable through a retained version. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import {canonicalSha256} from '../validate.mjs';
import {assertCatalog,resolveOperationContract} from '../retrieval-0.2/validate.mjs';
import {CATALOG_OPERATION_BINDINGS,CURRENT_CATALOG_VERSION} from '../retrieval-0.2/catalog-validation.mjs';
import {executionSchemaDependencies} from '../retrieval-0.2/execution-schema-sources.mjs';
import {workSelectionSchema} from '../schedules-0.2/lifecycle-validation.mjs';
import {INTENT_ROWS,intentDescriptor,assertIntentCatalog} from '../../../apps/worker/conversation/intents/catalog.mjs';
import assets from '../../skills/assets.json' with {type:'json'};

const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const preserved=read('../retrieval-0.2/catalog.json'),current=read('../retrieval-0.3/catalog.json');
const key=o=>`${o.id}@${o.version}`;
const rowOf=(catalog,ref)=>catalog.operations.find(row=>key(row.operation)===key(ref));
const SUCCESSORS=['create_client@0.3.0','schedule_task@0.3.0','list_scheduled_tasks@0.3.0','cancel_scheduled_task@0.3.0','update_scheduled_task@0.3.0'];
const CR03='urn:meri:retrieval:client-record-action:0.3.0',SC03='urn:meri:schedules:tool-interface:0.3.0';
const CR03_SHA='14b5923738b0f0d530a9c841f127bb8114e9757c4ca284b7b6f2beaf325b336f';
const SC03_SHA='56c169022a2759b861863e324996571a8acd3bf203cc486d3612db7828e77e64';
const SOURCED={name:'New client',skipLdaCheck:true,provenance:{name:{sourceUrl:'https://sam.gov/entity/acme',confidence:'high'}}};

test('the preserved catalog still asserts at its own exact counts and keeps its published digest',()=>{
 assertCatalog(preserved);
 assert.equal(preserved.catalogVersion,'0.2.23');
 assert.equal(preserved.operations.length,142);
 assert.equal(preserved.originals.length,153);
 // the real installation pin the skills owner verifies, read from the real assets file
 assert.equal(canonicalSha256(preserved),assets.installationCatalogSha256);
});

test('the current catalog asserts and carries exactly the five registered successors',()=>{
 assertCatalog(current);
 assert.equal(current.catalogVersion,CURRENT_CATALOG_VERSION);
 // the preservation ledger is closed at 153 rows, so one row serves both retained versions
 assert.equal(current.originals.length,preserved.originals.length);
 assert.equal(current.operations.length,preserved.operations.length+SUCCESSORS.length);
 const added=current.operations.map(row=>key(row.operation)).filter(id=>!rowOf(preserved,{id:id.split('@')[0],version:id.split('@')[1]}));
 assert.deepEqual(added.sort(),[...SUCCESSORS].sort());
 assert.equal(CATALOG_OPERATION_BINDINGS.length,current.operations.length);
});

test('every preserved descriptor is byte-identical in the current catalog',()=>{
 assert.equal(preserved.operations.length,142);
 for(const row of preserved.operations){
  const kept=rowOf(current,row.operation);
  assert.ok(kept,`${key(row.operation)} is missing from the current catalog`);
  assert.equal(canonicalSha256(kept),canonicalSha256(row),`${key(row.operation)} changed bytes`);
 }
});

test('each version resolves to its own validator group and its own byte pin',()=>{
 const group=(ref)=>resolveOperationContract(ref).binding.group;
 assert.equal(group({id:'create_client',version:'0.2.0'}),'client-record-action');
 assert.equal(group({id:'create_client',version:'0.3.0'}),'client-record-action-03');
 assert.equal(group({id:'update_client_profile',version:'0.2.0'}),'client-record-action');
 assert.equal(group({id:'schedule_task',version:'0.2.0'}),'schedule-tools');
 assert.equal(group({id:'schedule_task',version:'0.3.0'}),'schedule-tools-v3');
 const created=resolveOperationContract({id:'create_client',version:'0.3.0'}).descriptor;
 assert.equal(created.inputSchema.id,`${CR03}#/$defs/CreateClientInput`);
 assert.equal(created.outputSchema.id,`${CR03}#/$defs/ClientRecordPrepared`);
 assert.equal(created.inputSchema.sha256,CR03_SHA);
 // the four schedule successors pin the exact M7 0.3 tool interface
 for(const [id,out] of [['schedule_task','ScheduleMutationOutput'],['list_scheduled_tasks','ListScheduledTasksOutput'],['cancel_scheduled_task','ScheduleMutationOutput'],['update_scheduled_task','ScheduleMutationOutput']]){
  const d=resolveOperationContract({id,version:'0.3.0'}).descriptor;
  assert.equal(d.outputSchema.id,`${SC03}#/$defs/${out}`,id);
  assert.equal(d.inputSchema.sha256,SC03_SHA,id);
  assert.equal(d.outputSchema.sha256,SC03_SHA,id);
  // availability stays truthful: a successor is registered, not qualified
  assert.equal(d.availability,'unimplemented');assert.equal(d.qualification,'pending');assert.equal(d.handler,null);
  assert.equal(d.retry.maxRetries,0);assert.deepEqual(d.retry.retryableCodes,[]);
 }
});

test('the resolver normalizes a sourced create through the advertised successor and the retained version refuses it',()=>{
 const advertised=intentDescriptor({id:'create_client',version:'0.3.0'});
 assert.equal(advertised.inputSchema.id,`${CR03}#/$defs/CreateClientInput`);
 const viaSuccessor=resolveOperationContract({id:'create_client',version:'0.3.0'}).normalizeInput(SOURCED);
 assert.deepEqual(viaSuccessor.input.provenance,SOURCED.provenance);
 // the retained 0.2 descriptor is still resolvable and still closes its input
 assert.equal(resolveOperationContract({id:'create_client',version:'0.2.0'}).descriptor.inputSchema.id,`urn:meri:retrieval:client-record-action:0.2.0#/$defs/CreateClientInput`);
 assert.throws(()=>resolveOperationContract({id:'create_client',version:'0.2.0'}).normalizeInput(SOURCED));
 assert.doesNotThrow(()=>resolveOperationContract({id:'create_client',version:'0.2.0'}).normalizeInput({name:'New client',skipLdaCheck:true}));
});

test('the schedule successor admits the version-only source-event field the retained version closes',()=>{
 const doc3=read('../schedules-0.3/tool-interface.schema.json'),doc2=read('../schedules-0.2/tool-interface.schema.json');
 assert.equal(resolveOperationContract({id:'list_scheduled_tasks',version:'0.3.0'}).descriptor.outputSchema.sha256,SC03_SHA);
 assert.equal(resolveOperationContract({id:'list_scheduled_tasks',version:'0.2.0'}).descriptor.outputSchema.sha256,'2de8450111ea263876553f86b895d7fe93bca65ec55bcd649421e21a6f6d3fcf');
 // both list rows are closed, and only the 0.3 one carries the trigger observation
 assert.equal(doc3.$defs.ListRow.additionalProperties,false);assert.equal(doc2.$defs.ListRow.additionalProperties,false);
 assert.equal(doc3.$defs.ListRow.properties.trigger.$ref,'#/$defs/TriggerObservation');
 assert.ok(!Object.hasOwn(doc2.$defs.ListRow.properties,'trigger'));
 // and the field is really enforced by the 0.3 document, not merely declared
 const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
 ajv.addSchema(read('../meri.schema.json'));
 for(const path of executionSchemaDependencies)ajv.addSchema(read(`../retrieval-0.2/${path}`));
 ajv.addSchema(workSelectionSchema());
 ajv.addSchema(doc3);ajv.addSchema(doc2);
 const trigger=ajv.getSchema(`${SC03}#/$defs/TriggerObservation`);
 assert.ok(trigger({kind:'timed'}));
 assert.ok(!trigger({kind:'source-event'}));   // sourceTrigger is required on that branch
 assert.ok(!trigger({kind:'unsupported'}));
 assert.equal(ajv.getSchema('urn:meri:schedules:tool-interface:0.2.0#/$defs/TriggerObservation'),undefined);
});

test('an unregistered or tampered version refuses before it can resolve',()=>{
 for(const ref of [{id:'create_client',version:'0.2.1'},{id:'create_client',version:'0.4.0'},{id:'schedule_task',version:'0.3.1'},{id:'schedule_task',version:'0.9.9'},{id:'unknown_operation',version:'0.3.0'}]){
  assert.throws(()=>resolveOperationContract(ref),/Unknown operation contract version/,JSON.stringify(ref));
 }
 // a version registered at another version of the same id is still a version mismatch, not a fallback
 const drifted=structuredClone(preserved);rowOf(drifted,{id:'create_client',version:'0.2.0'}).operation.version='0.2.1';
 assert.throws(()=>assertCatalog(drifted),/version/);
});

test('the catalog version scoping refuses a stale count, a tampered pin and a foreign operation',()=>{
 // claiming the current version without the current operation set is refused, so the scoping is not a blanket weakening
 assert.throws(()=>assertCatalog({...structuredClone(preserved),catalogVersion:CURRENT_CATALOG_VERSION}),/complete registered operation set/);
 assert.throws(()=>assertCatalog({...structuredClone(preserved),catalogVersion:'9.9.9'}));
 // dropping a registered successor leaves its preservation row pointing at nothing
 const missing=structuredClone(current);missing.operations.pop();
 assert.throws(()=>assertCatalog(missing),/Missing mapped operation/);
 // and dropping the preservation target instead leaves the registered operation set incomplete
 const orphan=structuredClone(current);orphan.operations=orphan.operations.filter(row=>key(row.operation)!=='update_scheduled_task@0.3.0');
 orphan.originals.find(row=>row.id==='update_scheduled_task').replacement={id:'update_scheduled_task',version:'0.2.0'};
 assert.throws(()=>assertCatalog(orphan),/complete registered operation set/);
 const tampered=structuredClone(current);rowOf(tampered,{id:'create_client',version:'0.3.0'}).inputSchema.sha256='0'.repeat(64);
 assert.throws(()=>assertCatalog(tampered),/Catalog schema byte pin mismatch/);
 const foreign=structuredClone(current);foreign.operations.push({...rowOf(foreign,{id:'create_client',version:'0.3.0'}),operation:{id:'foreign_operation',version:'0.3.0'}});
 assert.throws(()=>assertCatalog(foreign),/registered operation binding/);
 const duplicate=structuredClone(current);duplicate.operations.push(structuredClone(rowOf(duplicate,{id:'create_client',version:'0.3.0'})));
 assert.throws(()=>assertCatalog(duplicate),/duplicate items|Duplicate operation version/);
});

test('the advertised intent rows resolve through the current catalog and every retained row still resolves',()=>{
 assertIntentCatalog();
 const advertised=new Map(INTENT_ROWS.map(r=>[r.operation.id,r.operation.version]));
 assert.equal(advertised.get('create_client'),'0.3.0');
 assert.equal(advertised.get('update_client_profile'),'0.2.0');
 // MO-02 crossed the schedule conversational family to the registered 0.3 successor: the advertised row is now the
 // exact id@version the current catalog registers, and every stored 0.2.0 reference still resolves to the retained
 // 0.2.0 descriptor asserted below. This expectation moved with that deliberate crossing, not with the catalog bytes.
 assert.equal(advertised.get('schedule_task'),'0.3.0');
 assert.equal(advertised.get('cancel_scheduled_task'),'0.3.0');
 assert.equal(advertised.get('update_scheduled_task'),'0.3.0');
 // a stored row that still names an earlier version resolves to that version's descriptor
 assert.equal(intentDescriptor({id:'create_client',version:'0.2.0'}).inputSchema.id,`urn:meri:retrieval:client-record-action:0.2.0#/$defs/CreateClientInput`);
 assert.equal(intentDescriptor({id:'schedule_task',version:'0.2.0'}).inputSchema.id,'urn:meri:schedules:tool-interface:0.2.0#/$defs/ScheduleTaskRequest');
});
