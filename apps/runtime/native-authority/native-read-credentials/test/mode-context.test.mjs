/** Actual task/native owners and fixed HTTP adapters over synthetic SQL/JSON, never live qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {MODE_READ_OPERATIONS,decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {storedCase as publicCase} from '../../../../gateway/sources/public-data/test/fixture.mjs';
import {storedCase as programCase} from '../../../../gateway/sources/program-elements/test/fixture.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture} from './fixture.mjs';

async function setup(id,{mode='off',configuration,requestMs}={}){
 const family=id.includes('program_element')||id==='get_pe_budget_timeline'?'program-elements':'public-data';
 const scene=(family==='public-data'?publicCase:programCase)(id,{evidenceAccuracyMode:mode}),f=await ownerFixture(id,{scene});f.core.state.mode=mode;
 const owner=configuration?createNativeReadCredentialOwner(configuration(f)):f.owner;
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 // Shared fixtures use short 1s source / 3s gateway budgets; a case may raise both to an existing approved lifetime.
 const handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,...(requestMs===undefined?{}:{maxRequestMs:requestMs}),credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;if(requestMs!==undefined)gateway.limits={...gateway.limits,maxRequestMs:requestMs};
 const mount=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,family,owner,handlers,mount,invoke:()=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'native-mode'})};
}
const modes=f=>f.core.state.calls.filter(row=>row.path.endsWith('/read-mode-observation'));
const read=async f=>JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof()));
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
for(const id of MODE_READ_OPERATIONS){
 for(const mode of ['off','shadow','enforce'])test(`${id}: actual ${mode} joins current grants, original request and private carrier`,async()=>{
  const f=await setup(id,{mode});try{
   const current=await read(f);assert.deepEqual(current.context,{evidenceAccuracyMode:mode});
   const normalized=f.contract.normalizeInput(f.request,current.context),call={request:f.request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:current.context,authority:f.authority,signal:f.scope.signal};
   const out=JSON.parse(await f.handlers.get(`${id}@0.2.0`).execute(call));assert.deepEqual(out.result,f.page);assert.deepEqual(f.wire[0].body,f.request);
   assert.deepEqual(decodeNativeReadObservation(f.wire[0].options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation:f.operation,request:f.request}).context,current.context);
   assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.deepEqual(f.stateOwner.secretProof.normalizationContext,current.context);
   assert.ok(f.stateOwner.modeSecrets>=3);assert.ok(modes(f).length>=3);
   for(const row of modes(f)){assert.deepEqual(row.body,{operation:f.operation,requestSha256:hash(f.request)});assert.equal(row.init.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');}
   assert.equal(Object.hasOwn(out,'modeObservation'),false);assert.equal(Object.hasOwn(out,'identityRevision'),false);
  }finally{f.scope.abort();}
 });
 for(const missing of ['reader','secret-getter'])test(`${id}: missing ${missing} refuses before any native credential or HTTP`,async()=>{
  const f=await setup(id,{configuration:f=>{if(missing==='reader'){const {readModeObservation,...coreAuthority}=f.configuration.coreAuthority;return {...f.configuration,coreAuthority};}const {getReadModeServiceSecret,...rest}=f.configuration;return rest;}});
  try{await assert.rejects(read(f),{message:'UNAVAILABLE'});noSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);assert.equal(f.stateOwner.modeSecrets,0);}finally{f.scope.abort();}
 });
 test(`${id}: changed actual mode cannot renew the first context or release source credentials`,async()=>{
  const f=await setup(id);try{await read(f);f.core.state.mode='shadow';await assert.rejects(read(f),{message:'ACCESS_DENIED'});noSource(f);}finally{f.scope.abort();}
 });
 test(`${id}: mode changes during source-secret acquisition withhold that source call`,async()=>{
  const f=await setup(id);try{const first=await read(f);f.stateOwner.beforeSecret=()=>{f.core.state.mode='enforce';};await assert.rejects(f.owner.getCredentials(f.credentials(first.context)),{message:'ACCESS_DENIED'});assert.equal(f.stateOwner.secrets,1);assert.equal(f.wire.length,0);}finally{f.scope.abort();}
 });
 test(`${id}: current task revoked during native credential acquisition prevents mode secret disclosure`,async()=>{
  const f=await setup(id,{configuration:f=>({...f.configuration,getNativeCredential:async args=>{const credential=await f.configuration.getNativeCredential(args);f.state.grant.state='REVOKED';return credential;}})});
  try{await assert.rejects(read(f));noSource(f);assert.equal(f.stateOwner.modeSecrets,0);assert.equal(modes(f).length,0);}finally{f.scope.abort();}
 });
 test(`${id}: current task revoked during native authority acquisition prevents mode secret disclosure`,async()=>{
  const f=await setup(id);f.core.state.beforeResponse=path=>{if(path.endsWith('/membership'))f.state.grant.state='REVOKED';};
  try{await assert.rejects(read(f));noSource(f);assert.equal(f.stateOwner.modeSecrets,0);assert.equal(modes(f).length,0);}finally{f.scope.abort();}
 });
 test(`${id}: native membership drift during mode secret await prevents observation HTTP`,async()=>{
  const f=await setup(id);f.stateOwner.beforeModeSecret=()=>{f.core.state.membershipRevision='c'.repeat(64);};
  try{await assert.rejects(read(f),{message:'ACCESS_DENIED'});noSource(f);assert.equal(f.stateOwner.modeSecrets,1);assert.equal(modes(f).length,0);}finally{f.scope.abort();}
 });
 test(`${id}: first mode expiry remains the upper bound across observations`,async()=>{
  const f=await setup(id);try{const first=await read(f);assert.equal(first.expiresAtMs,f.now()+f.configuration.approvedReads.maxExecuteMs);f.state.now+=25;assert.equal((await read(f)).expiresAtMs,first.expiresAtMs);f.state.now=first.expiresAtMs;await assert.rejects(read(f));assert.equal(f.stateOwner.secrets,0);}finally{f.scope.abort();}
 });
 test(`${id}: a source exceeding the HTTP observation window retains the existing native/operation lifetime`,async()=>{
  const f=await setup(id,{requestMs:10000});assert.ok(3500<f.configuration.approvedReads.maxExecuteMs);f.state.afterSource=()=>{f.state.now+=3500;};
  try{assert.deepEqual(JSON.parse(await f.invoke()).result,f.page);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}finally{f.scope.abort();}
 });
 test(`${id}: actual mounted gateway settles the mode-bound source result`,async()=>{
  const f=await setup(id);try{assert.deepEqual(JSON.parse(await f.invoke()).result,f.page);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}finally{f.scope.abort();}
 });
 test(`${id}: post-source mode drift withholds completion and leaves UNKNOWN`,async()=>{
  const f=await setup(id);f.state.afterSource=()=>{f.core.state.mode='shadow';};
  try{await assert.rejects(f.invoke());assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'UNKNOWN');assert.equal(f.state.budget.consumed_micro_usd,0);for(const row of f.state.produced.values())assert.equal(row.completion,null);}finally{f.scope.abort();}
 });
}
