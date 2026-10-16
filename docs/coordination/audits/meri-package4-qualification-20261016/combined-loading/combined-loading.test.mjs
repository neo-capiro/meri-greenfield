import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve,normalize} from 'node:path';
import {multiRunOwners,retentionGate} from '../apps/runtime/control.mjs';
import {createPreparedRunBindings} from '../apps/runtime/prepared-run-bindings.mjs';
import {candidateFixture} from '../apps/runtime/test/prepared-candidate-fixture.mjs';
import {createControlGeneralReadRuntime} from '../apps/runtime/general-read-runtime.mjs';
import {createNativeReadsOwner} from '../apps/runtime/native-authority/reads-owner.mjs';

const forbidden=()=>{throw Error('Synthetic check forbids SQL, material and network effects');};
const pool={query:forbidden,connect:forbidden};
test('integrated canonical startup owners satisfy actual model/task bindings without I/O or material creation',()=>{
 const f=candidateFixture(),directory=resolve('audit-evidence','never-created-material');
 const intent=f.configuration.nativeCandidate.preparationIntent;
 // Reuse the existing prepared-run-bindings fixture's native path normalization.
 for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])intent[key]=normalize(intent[key]);
 intent.launchTemplate.command=normalize(intent.launchTemplate.command);
 intent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=intent.secureStorageDirectory;
 assert.equal(existsSync(directory),false);
 f.configuration.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:directory};
 const owners=multiRunOwners(f.configuration,pool);
 assert.equal(typeof owners.modelGrants.issue,'function');
 const inputs={configuration:f.configuration,pool,store:{allocations:{read:forbidden},readOptional:forbidden},
  credentials:{control:f.secret.control},...owners,limits:{maxRequestMs:1000,maxFactBytes:131072}};
 const combined=createPreparedRunBindings(inputs);
 assert.equal(typeof combined.runIssuance.prepare,'function');
 assert.equal(typeof combined.issuanceIntent,'function');
 assert.equal(typeof combined.admissionForBinding,'function');
 assert.throws(()=>createPreparedRunBindings({...inputs,modelGrants:undefined}),/MODEL_GRANT_UNAVAILABLE/);
 assert.equal(existsSync(directory),false);
});
test('integrated control retention composes mandatory atomic store ports and refuses missing external ledger before effects',async()=>{
 const f=candidateFixture();f.configuration.retention={enabled:true};
 const owner=retentionGate(f.configuration,pool);
 assert.equal(owner.startup.state().enabled,false);
 assert.equal(owner.startup.state().unavailable,'RETENTION_LEDGER_UNAVAILABLE');
 await assert.rejects(owner.startup.start(),/RETENTION_LEDGER_UNAVAILABLE/);
 await assert.rejects(owner.gate.assertServable({tenantId:f.binding.tenantId,kind:'conversation',subjectId:f.binding.conversationId}),/RETENTION_RECOVERY_BARRIER/);
});
test('integrated control READS factory and native sibling expose no authority without genuine allocated owners',async()=>{
 const f=candidateFixture(),gateway=createControlGeneralReadRuntime({sourceEnabled:true});
 await assert.rejects(gateway.readAvailability(),/UNAVAILABLE/);
 const native=createNativeReadsOwner({binding:f.binding});
 await assert.rejects(native.handle('availability',{},'synthetic-unused'),/UNAVAILABLE/);
});
