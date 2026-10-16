/** Synthetic SQL/native/HTTPS resources over actual admission, verifier, gateway and transport owners. No ports. */
import assert from 'node:assert/strict';
import {familyCase} from '../../../gateway/general-reads/test/family-cases.mjs';
import {durableFamilyFixture} from '../../../gateway/general-reads/test/durable-fixture.mjs';
import {createPostgresAdmittedRunOwner} from '../../../gateway/budget/admitted-run-owner.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion,nativeReadConfigurationSha256} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {createReadTaskVerifier} from '../read-task-verifier.mjs';
import {createNativeReadsOwner} from '../reads-owner.mjs';
import {createNativeReadsApplication} from '../reads-http.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
export {schemaVersion};
export async function readsFixture(options={}){
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts')),grant=[...f.state.bindings.values()][0].facts,allocation=[...f.state.allocations.values()][0].allocation,credential='synthetic-opaque',commands=[],releases=[],nativeWire=[];
 const config={schemaVersion,enabled:true,operations:[f.operation],maxExecuteMs:10000,maxRequestBytes:65536,maxResponseBytes:1048576,...options.config},initial=f.now();
 const entry={binding:f.binding,runRequestSha256:'a'.repeat(64),grantId:grant.grantId,taskArn:grant.qualificationBinding.workerArn,issuanceFactsSha256:'c'.repeat(64),allocationSha256:hash(allocation),scopes:f.scopes,policyRevision:f.policyRevision,readConfigurationSha256:nativeReadConfigurationSha256(config),checkedAtMs:initial,expiresAtMs:f.deadlineMs};
 const state={entryRevoked:false,entryReads:0,entryHook:null,fetchHook:null,responseHook:null};
 const pool={async connect(){let snapshot;return {async query(sql,args=[]){commands.push(sql);assert.equal(sql.includes('FOR UPDATE'),false,'task assertion must never acquire a row lock');
  if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){snapshot=structuredClone({budget:f.state.budget,run:f.state.run,grant:f.state.grant,allocations:f.state.allocations,bindings:f.state.bindings});return {rows:[]};}
  if(sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};assert.ok(sql.startsWith('SELECT'),'read-only transaction cannot mutate');
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now())}]};if(sql.includes('meri_qualification.budget WHERE'))return {rows:[snapshot.budget]};
  if(sql.includes('meri_qualification.runs WHERE'))return {rows:[snapshot.run]};if(sql.includes('meri_qualification.grants WHERE'))return {rows:snapshot.grant.grant_id===args[0]?[snapshot.grant]:[]};
  if(sql.includes('meri_qualification.tool_run_allocations WHERE'))return {rows:snapshot.allocations.has(args[0])?[snapshot.allocations.get(args[0])]:[]};
  if(sql.includes('meri_qualification.tool_grant_bindings WHERE'))return {rows:snapshot.bindings.has(args[0])?[snapshot.bindings.get(args[0])]:[]};throw Error('UNEXPECTED_SYNTHETIC_SQL');
 },release(error){releases.push(error);}};}};
 const admission=createPostgresAdmittedRunOwner({pool,allocationJson:JSON.stringify(allocation),grantFactsJsons:[JSON.stringify(grant)],now:f.now,limits:{maxRequestMs:1000,maxFactBytes:131072}});
 const verifierConfiguration={allocationJson:JSON.stringify(allocation),grantFactsJsons:[JSON.stringify(grant)],grantId:grant.grantId,currentOwner:admission,readCurrentEntry:async()=>{state.entryReads++;await state.entryHook?.();if(state.entryRevoked)throw Error('PRIVATE entry revoked');return {...structuredClone(entry),checkedAtMs:f.now()};},taskArn:entry.taskArn,issuanceFactsSha256:entry.issuanceFactsSha256,runRequestSha256:entry.runRequestSha256,scopes:f.scopes,approvedReads:config,expiresAtMs:f.deadlineMs,enabled:true,now:f.now};
 const verifier=createReadTaskVerifier(verifierConfiguration),ownerConfiguration={binding:f.binding,approvedReads:config,taskVerifier:verifier,gateway:f.mount(),allocationSha256:hash(allocation),policyRevision:f.policyRevision,scopes:f.scopes,now:f.now},owner=createNativeReadsOwner({...ownerConfiguration,...options.owner});
 const application=createNativeReadsApplication({owner,approvedReads:config,now:f.now});
 const fetchImpl=async(url,init)=>{nativeWire.push({url,init});await state.fetchHook?.(url,init);const response=await application.handle(new Request(url,init));return state.responseHook?state.responseHook(response):response;};
 const clientConfiguration={origin:'https://native.synthetic.invalid',credential,binding:f.binding,approvedReads:config,fetchImpl,now:f.now};const client=createNativeReadsClient(clientConfiguration);
 const request={schemaVersion,binding:f.binding},executeRequest={...request,operation:f.operation,arguments:f.arguments,deliveryId:'native:synthetic:1',installationId:'71000000-0000-4000-8000-000000000080',executionCatalogSha256:(await f.mount().readAvailability()).installation.executionCatalogSha256};
 return {...f,grant,allocation,config,entry,stateNative:state,credential,commands,releases,nativeWire,verifierConfiguration,verifier,ownerConfiguration,owner,application,clientConfiguration,client,request,executeRequest};
}
