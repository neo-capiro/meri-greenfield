/** Synthetic native HTTP and scripted SQL over actual CONTROL/task/gateway/budget owners; no live credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture} from './fixture.mjs';
import {NATIVE_FAMILY_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';

async function wired(id,options={}){
 const f=await ownerFixture(id,options),{getCredentials,...transport}=f.transport,owner=options.owner?.(f)??f.owner;
 const family=f.contract.binding.group,handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const mount=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:options.missingContext?undefined:owner.nativeReadContextPorts});
 return {...f,mount,invoke:(extra={})=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'five-native-read',...extra})};
}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.charged_micro_usd,null);assert.equal(r.output_bytes,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal(f.state.produced.size,1);assert.equal([...f.state.produced.values()][0].completion,null);}

for(const [family,id] of NATIVE_FAMILY_CASES){
 test(`${id}: mounted native JSON, scoped credentials and complete carrier bytes settle once`,async()=>{
  const f=await wired(id),raw=await f.invoke(),out=JSON.parse(raw),[r]=f.state.reservations.values();
  assert.deepEqual(Object.keys(out).sort(),['binding','subject','operation','argumentsSha256','result'].sort());
  assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);assert.equal(out.result.tool,id);
  const context=family==='acquisition-personnel'?{actorRole:'standard_user'}:family==='federal-legislation'?{defaultCongress:119}:{},normalized=f.contract.normalizeInput(f.request,context);
  assert.equal(out.argumentsSha256,normalized.argumentsSha256);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.deepEqual(f.stateOwner.secretProof.normalizationContext,context);
  assert.equal(f.wire.length,1);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);
  const expectedBody=id==='get_acquisition_person'?normalized.input:family==='federal-legislation'&&normalized.input.billId!==null?{...f.request,billId:normalized.input.billId}:f.request;
  assert.deepEqual(f.wire[0].body,expectedBody);
  assert.deepEqual(Object.keys(f.wire[0].options.headers).sort(),['authorization','accept','accept-encoding','x-meri-deadline-at','x-internal-service-secret','content-type'].sort());
  assert.equal(f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  assert.equal(r.state,'SETTLED');assert.equal(r.charged_micro_usd,1);assert.equal(r.output_bytes,Buffer.byteLength(raw));assert.equal(f.state.produced.size,1);
  const [receipt]=f.state.produced.values();assert.equal(receipt.completion.resultSha256,hash(out));assert.equal(receipt.arguments_sha256,normalized.argumentsSha256);
  for(const suffix of ['native-read-context.mjs','native-read-credentials/owner.mjs','read-result-envelope.mjs'])assert.ok(f.handlers.get(`${id}@0.2.0`).sourceFiles.some(row=>row.label.endsWith(suffix)));
  await assert.rejects(f.invoke(),{message:'BUDGET_UNCERTAIN'});assert.equal(f.wire.length,1);assert.equal(f.state.budget.consumed_micro_usd,1);
 });
 test(`${id}: absent native context and genuine credential producer refuse before reservation or native IO`,async()=>{
  for(const options of [{missingContext:true},{owner:f=>createNativeReadCredentialOwner({...f.configuration,getNativeCredential:undefined})}]){
   const f=await wired(id,options);await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);assert.equal(f.core.state.calls.length,0);assert.equal(f.state.reservations.size,0);
  }
 });
 test(`${id}: model authority, revoked installation and pre-abort cannot reach native source`,async()=>{
  const f=await wired(id);await assert.rejects(f.invoke({arguments:{...f.request,tenantId:'foreign'}}),{message:'INVALID_ARGUMENTS'});
  f.state.installRevoked=true;await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});f.state.installRevoked=false;
  await assert.rejects(f.invoke({signal:AbortSignal.abort()}));assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);assert.equal(f.core.state.calls.length,0);
 });
 test(`${id}: missing real service secret stays unavailable without fallback and retains UNKNOWN hold`,async()=>{
  const f=await wired(id);f.stateOwner.secret='';await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);unknown(f);
 });
}

test('CBO preserves original case and whitespace in native request and empty-note receiving',async()=>{
 const f=await wired('search_cbo_cost_estimates',{request:{billId:' HR-1 ',congress:119}});f.state.empty=true;
 const out=JSON.parse(await f.invoke());assert.deepEqual(f.wire[0].body,{billId:' HR-1 ',congress:119});assert.match(out.result.note,/HR-1/);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
});
for(const [key,cap] of [['service',60],['organization',200],['role',60],['peCode',32]])test(`acquisition search ${key}: preserve one native trim/clip pass at trailing-space boundary`,async()=>{
 const raw='A'.repeat(cap-1)+' B',expected='A'.repeat(cap-1)+' ',f=await wired('search_acquisition_personnel',{request:{[key]:raw}});
 assert.equal(f.contract.normalizeInput(f.request,{actorRole:'standard_user'}).input[key],expected);
 f.state.resultMutator=page=>{page.data[0][key==='peCode'?'pePrimary':key]=expected;};
 const out=JSON.parse(await f.invoke());assert.equal(f.wire[0].body[key],raw);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
 assert.equal(out.result.data[0][key==='peCode'?'pePrimary':key],expected);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
});
for(const role of ['standard_user','user_admin','capiro_admin'])test(`acquisition ${role}: model role filter never establishes PII authority`,async()=>{
 const f=await wired('get_acquisition_person',{actorRole:role});f.state.resultMutator=page=>{page.person.email='private@example.invalid';};
 if(role==='capiro_admin'){const out=JSON.parse(await f.invoke());assert.equal(out.result.person.email,'private@example.invalid');assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{actorRole:role});}
 else{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});unknown(f);}
 assert.equal(f.wire.length,1);assert.equal(Object.hasOwn(f.wire[0].body,'actorRole'),false);
});
test('acquisition membership role drift before reserve rejects without audit-producing source call',async()=>{
 const f=await wired('search_acquisition_personnel');let members=0;f.core.state.beforeResponse=path=>{if(path.endsWith('/membership')&&++members===2)f.core.state.role='capiro_admin';};
 await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);
});
for(const field of ['identityRevision','membershipRevision','role'])test(`acquisition ${field} drift after producer withholds release and holds UNKNOWN`,async()=>{
 const f=await wired('get_acquisition_person');f.state.afterSource=()=>f.core.state[field]=field==='role'?'user_admin':'c'.repeat(64);
 await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);unknown(f);
});

for(const id of ['get_committee_roster','list_members']){
 for(const field of ['identityRevision','membershipRevision','role'])test(`${id}: current native ${field} drift after source withholds release`,async()=>{
  const f=await wired(id);f.state.afterSource=()=>f.core.state[field]=field==='role'?'user_admin':'c'.repeat(64);
  await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);unknown(f);
 });
 test(`${id}: foreign native principal and unallocated operation refuse before reservation`,async()=>{
  for(const mode of ['principal','operation']){
   const f=await wired(id,{...(mode==='operation'?{owner:f=>createNativeReadCredentialOwner({...f.configuration,approvedReads:{...f.configuration.approvedReads,operations:[{id:'read_bill_text',version:'0.2.0'}]}})}:{})});
   if(mode==='principal')f.core.state.principal={...f.core.principal,actorId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
   await assert.rejects(f.invoke());assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
  }
 });
}
for(const [family,id] of [['public-reports','search_gao_reports'],['acquisition-personnel','get_acquisition_person']])test(`${family}: static plus per-call credential configuration is refused`,async()=>{
 const f=await ownerFixture(id);await assert.rejects(createGeneralReadFamilyHandlers({families:{[family]:{...f.transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID}),{message:'GATEWAY_CONFIGURATION'});assert.equal(f.wire.length,0);
});
