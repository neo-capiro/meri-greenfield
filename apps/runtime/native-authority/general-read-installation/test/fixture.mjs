/** Scripted admitted rows and source HTTP over canonical owners. No current production qualification or database. */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ownerFixture} from '../../native-read-credentials/test/fixture.mjs';
import {billTextCase} from '../../../../gateway/sources/bill-text/test/fixture.mjs';
import {createPostgresAdmittedRunOwner} from '../../../../gateway/budget/admitted-run-owner.mjs';
import {storeFixture,versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../../../control/conversations/execution-boundary.mjs';
import {createPreparedNativeReads} from '../../prepared-reads.mjs';
import {createNativeReadsClient} from '../../reads-client.mjs';
import {prepareGeneralReadInstallation} from '../runtime.mjs';

function admissionPool(f){return {async connect(){let snapshot;return {async query(sql,args=[]){
 assert.equal(sql.includes('FOR UPDATE'),false);if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){snapshot=structuredClone({budget:f.state.budget,run:f.state.run,grant:f.state.grant,allocations:f.state.allocations,bindings:f.state.bindings});return {rows:[]};}
 if(sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};
 if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now())}]};
 if(sql.includes('meri_qualification.budget WHERE'))return {rows:[snapshot.budget]};if(sql.includes('meri_qualification.runs WHERE'))return {rows:[snapshot.run]};if(sql.includes('meri_qualification.grants WHERE'))return {rows:[snapshot.grant]};
 if(sql.includes('meri_qualification.tool_run_allocations WHERE'))return {rows:[snapshot.allocations.get(args[0])]};if(sql.includes('meri_qualification.tool_grant_bindings WHERE'))return {rows:[snapshot.bindings.get(args[0])]};throw Error('UNEXPECTED_ADMISSION_SQL');
 },release(){}};}};}
/** Route each whole scripted transaction to its existing canonical SQL fixture. */
function combinedPool(budget,conversation){return {async connect(){let client;const queued=[];return {async query(sql,args=[]){
 if(!client&&!sql.includes('meri_')){queued.push([sql,args]);return {rows:[]};}
 if(!client){client=await (sql.includes('meri_conversations.')?conversation:budget).connect();for(const [q,p] of queued)await client.query(q,p);}
 return client.query(sql,args);
 },release(error){client?.release(error);}};}};}

export async function installationFixture({scene=billTextCase()}={}){
 const f=await ownerFixture(scene.operation.id,{scene}),sf=storeFixture();Object.assign(sf.state,f.storeState);
 const pool=combinedPool(f.gatewayConfiguration.pool,sf.pool),original=createExecutionBinding({binding:f.binding,versions,plan:{synthetic:true},expiresAtMs:f.deadlineMs}),grant=f.grant;
 const currentOwner=createPostgresAdmittedRunOwner({pool:admissionPool(f),allocationJson:f.allocationJson,grantFactsJsons:[JSON.stringify(grant)],now:f.now,limits:{maxRequestMs:1000,maxFactBytes:131072}});
 const tuple={pool,binding:f.binding,original,allocationJson:f.allocationJson,grantFactsJsons:[JSON.stringify(grant)],grantId:grant.grantId,taskArn:grant.qualificationBinding.workerArn,issuanceFactsSha256:f.entry.issuanceFactsSha256,runRequestSha256:f.entry.runRequestSha256,scopes:f.scopes,readCurrentEntry:f.configuration.readCurrentEntry,currentOwner,sourceEnabled:true,limits:{maxRequestMs:3000,maxFactBytes:131072},now:f.now,taskVerifier:f.configuration.taskVerifier,taskCapability:f.configuration.taskCapability,approvedReads:f.configuration.approvedReads};
 const state={taskPortsCalls:0,qualifierCalls:[],portsMutator:null,tupleInputs:[]};
 const taskPorts=value=>{
  state.taskPortsCalls++;state.tupleInputs.push(value);const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
  const p={gateway:{authority:f.gatewayConfiguration.authority,limits:f.gatewayConfiguration.limits,producerContext:grant,producer:{...f.gatewayConfiguration.producer,executionId:original.executionId},credential:tuple.taskCapability,sourceEnabled:true,
   async readCurrentInstallation(proof){state.qualifierCalls.push(proof);assert.deepEqual(proof.binding,f.binding);assert.deepEqual(proof.scopes,f.scopes);assert.equal(proof.policyRevision,f.policyRevision);return f.installationOwner.readCurrent({signal:proof.signal});},discoveryOwner:f.gatewayConfiguration.discoveryOwner},
   families:{[f.family]:transport},nativeCredentials:{coreAuthority:f.core.client,getNativeCredential:f.configuration.getNativeCredential,getServiceSecret:f.configuration.getServiceSecret,...(f.configuration.getReadModeServiceSecret===undefined?{}:{getReadModeServiceSecret:f.configuration.getReadModeServiceSecret}),defaultCongress:119},contextPorts:{memoryContextPorts:f.gatewayConfiguration.memoryContextPorts}};
  state.portsMutator?.(p);return p;
 };
 const preparation=await prepareGeneralReadInstallation({familyIds:[f.family],newId:randomUUID,taskPorts});
 const prepared=configuration=>createPreparedNativeReads({...Object.fromEntries(['binding','allocationJson','grantFactsJsons','grantId','taskArn','issuanceFactsSha256','runRequestSha256','scopes','currentOwner','readCurrentEntry','taskCapability','approvedReads','now'].map(key=>[key,tuple[key]])),expiresAtMs:f.deadlineMs,enabled:true,...configuration,createReadsRuntime:configuration?.createReadsRuntime??(inner=>preparation.createReadsRuntime({...tuple,...inner}))});
 const mounted=prepared(),client=createNativeReadsClient({origin:'https://native.synthetic.invalid',credential:tuple.taskCapability,binding:f.binding,approvedReads:tuple.approvedReads,fetchImpl:(url,init)=>mounted.application.handle(new Request(url,init)),now:f.now});
 return {...f,pool,tuple,stateComposition:state,preparation,taskPorts,prepared,mounted,client};
}
