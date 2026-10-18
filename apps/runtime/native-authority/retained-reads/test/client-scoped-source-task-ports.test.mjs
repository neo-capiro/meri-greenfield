import test from 'node:test';
import assert from 'node:assert/strict';
import {NATIVE_READS_SCHEMA_VERSION} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createClientScopedSourceTaskPorts,CLIENT_SCOPED_SOURCE_FAMILIES} from '../client-scoped-source-task-ports.mjs';

const ORIGIN='https://core.synthetic.invalid';
const operations=Object.freeze([
 {id:'get_client_context',version:'0.3.0'},
 {id:'read_client_documents',version:'0.2.0'},
 {id:'resolve_entity',version:'0.2.0'},
 {id:'find_contacts',version:'0.2.0'},
 {id:'meeting.list_upcoming_meetings',version:'0.2.0'},
 {id:'meeting.read_client_meetings',version:'0.2.0'},
 {id:'meeting.query_debriefs',version:'0.2.0'},
]);
const approvedReads=Object.freeze({schemaVersion:NATIVE_READS_SCHEMA_VERSION,enabled:true,operations,
 maxExecuteMs:3210,maxRequestBytes:65536,maxResponseBytes:987654});
const issue=async()=>{throw Error('NO_TASK_TOKEN_OUTSIDE_GATEWAY');};
const fetchImpl=async()=>{throw Error('NO_LIVE_SOURCE');};

test('the task slice builds seven canonical handlers with exact Core tool endpoints and the existing signed relay',async()=>{
 const create=createClientScopedSourceTaskPorts({coreOrigin:ORIGIN,fetchImpl});
 const {families}=create({task:{approvedReads},getSignedSourceCredentials:issue});
 assert.deepEqual(Object.keys(families),['client-knowledge-profile','client-documents','entity-candidates','tenant-contacts','meeting-source']);
 const ids=Object.values(families).flatMap(family=>Object.keys(family.endpoints));
 assert.deepEqual(ids,operations.map(operation=>operation.id));
 for(const family of Object.values(families)){
  assert.equal(family.getCredentials,issue);
  assert.equal(family.fetchImpl,fetchImpl);
  assert.equal(family.maxRequestMs,approvedReads.maxExecuteMs);
  assert.equal(family.maxResponseBytes,approvedReads.maxResponseBytes);
  for(const [id,endpoint] of Object.entries(family.endpoints))assert.equal(endpoint,`${ORIGIN}/api/clio/tools/${id}`);
 }
 const handlers=await createGeneralReadFamilyHandlers({families,now:()=>123,newId:()=> 'synthetic'});
 assert.deepEqual([...handlers.keys()].sort(),operations.map(operation=>`${operation.id}@${operation.version}`).sort());
 assert.equal(Object.values(families).some(family=>Object.keys(family.endpoints).some(id=>id.startsWith('mail.')||id==='read_monday_client_boards')),false);
});

test('source slice refuses an untrusted origin, absent signed relay, or malformed task read limits before Fetch',()=>{
 for(const coreOrigin of ['http://core.synthetic.invalid','https://core.synthetic.invalid/path','https://user@core.synthetic.invalid'])
  assert.throws(()=>createClientScopedSourceTaskPorts({coreOrigin,fetchImpl}));
 const create=createClientScopedSourceTaskPorts({coreOrigin:ORIGIN,fetchImpl});
 assert.throws(()=>create({task:{approvedReads},getSignedSourceCredentials:undefined}),{message:'CONFIGURATION'});
 assert.throws(()=>create({task:{approvedReads:{...approvedReads,enabled:false}},getSignedSourceCredentials:issue}),{message:'UNAVAILABLE'});
 assert.throws(()=>create({task:{approvedReads:{...approvedReads,maxExecuteMs:30001}},getSignedSourceCredentials:issue}),{message:'CONFIGURATION'});
});

test('a reviewed partial installation constructs only its selected genuine source families',async()=>{
 const create=createClientScopedSourceTaskPorts({coreOrigin:ORIGIN,fetchImpl,familyIds:['client-knowledge-profile','meeting-source']});
 const {families}=create({task:{approvedReads},getSignedSourceCredentials:issue});
 assert.deepEqual(Object.keys(families),['client-knowledge-profile','meeting-source']);
 assert.deepEqual([...await createGeneralReadFamilyHandlers({families,now:()=>123,newId:()=> 'synthetic'})].map(([key])=>key).sort(),
  operations.filter(op=>op.id==='get_client_context'||op.id.startsWith('meeting.')).map(op=>`${op.id}@${op.version}`).sort());
 for(const familyIds of [[],['client-documents','client-documents'],['mail'],[...CLIENT_SCOPED_SOURCE_FAMILIES,'mail']])
  assert.throws(()=>createClientScopedSourceTaskPorts({coreOrigin:ORIGIN,fetchImpl,familyIds}),{message:'CONFIGURATION'});
});
