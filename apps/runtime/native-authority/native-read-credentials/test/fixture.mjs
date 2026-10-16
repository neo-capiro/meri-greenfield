/** Offline SQL protocol and HTTP JSON fixtures over real task/store owners. No live credentials or database. */
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {billTextCase} from '../../../../gateway/sources/bill-text/test/fixture.mjs';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {durableFamilyFixture} from '../../../../gateway/general-reads/test/durable-fixture.mjs';
import {createPostgresAdmittedRunOwner} from '../../../../gateway/budget/admitted-run-owner.mjs';
import {createPostgresConversationStore} from '../../../../control/conversations/postgres-store.mjs';
import {storeFixture,versions} from '../../../../control/conversations/test/store-fixture.mjs';
import {createReadTaskVerifier} from '../../read-task-verifier.mjs';
import {createNativeToolAuthorityClient} from '../core-client.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
export const uuid=d=>`${d.repeat(8)}-${d.repeat(4)}-4${d.repeat(3)}-8${d.repeat(3)}-${d.repeat(12)}`;
export const origin='https://native-core.example.invalid';
export function coreFixture(options={}){
 const state={now:1800000000000,role:'standard_user',identityRevision:'a'.repeat(64),membershipRevision:'b'.repeat(64),calls:[],nativeExpiry:1800000060000},now=options.now??(()=>state.now),principal={tenantId:uuid('b'),actorId:uuid('c')};
 const fetchImpl=async(url,init)=>{
  const path=new URL(url).pathname;state.calls.push({url,init,path});await state.beforeResponse?.(path);
  const value=path.endsWith('/identity')?{principal:state.principal??principal,identityRevision:state.identityRevision,checkedAtMs:now(),expiresAtMs:state.nativeExpiry}:{...principal,status:'active',role:state.role,permissions:[],clientIds:[],membershipRevision:state.membershipRevision,checkedAtMs:now(),expiresAtMs:state.nativeExpiry};
  state.mutate?.(value,path);return state.response?.(value,path)??Response.json(value);
 };
 const configuration={origin,fetchImpl,now,enabled:true},client=createNativeToolAuthorityClient(configuration);
 return {state,now,principal,fetchImpl,configuration,client,request:()=>({credential:'SYNTHETIC_NATIVE',deadlineMs:now()+10000})};
}
function retarget(value,old,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const [key,v] of Object.entries(value)){if(v===old.tenantId)value[key]=uuid('b');else if(v===old.actorId)value[key]=uuid('c');else retarget(v,old,seen);}}
export async function ownerFixture(id='read_bill_text',options={}){
 const operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),group=contract.binding.group;
 const scene=['public-reports','acquisition-personnel','disclosures','legislative-directory'].includes(group)?nativeFamilyCase(group,id,options):billTextCase(['read_bill_text','search_congress_bills'].includes(id)?id:'read_bill_text');retarget(scene,{...scene.binding});
 const request=['bill-text','public-reports','acquisition-personnel','disclosures','legislative-directory'].includes(group)?scene.arguments:{};
 scene.operation=operation;scene.authority.sourceIds=[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))];scene.authority.decision.operation=`${id}@0.2.0`;scene.arguments=request;
 const f=await durableFamilyFixture(scene),grant=[...f.state.bindings.values()][0].facts,allocated=[...f.state.allocations.values()][0].allocation;
 const sf=storeFixture(),store=createPostgresConversationStore({pool:sf.pool,now:f.now}),runRequest={requestId:uuid('e'),prompt:'Offline native read'},run={binding:f.binding,state:'queued',scopes:f.scopes,createdAt:new Date(f.now()).toISOString(),policyRevision:f.policyRevision,versions},conversation={conversationId:f.binding.conversationId,owner:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},scopes:f.scopes,createdAt:run.createdAt,policyRevision:f.policyRevision};
 await store.accept({conversation,run,request:runRequest,event:{contractVersion:'0.1.0',eventId:uuid('f'),binding:f.binding,sequence:1,createdAt:run.createdAt,scopes:f.scopes,type:'run.status',data:{state:'queued',reasonCode:null}}},()=>{});
 const state={entryReads:0,nativeCredentials:0,secrets:0,reads:[]};
 const pool={async connect(){let snap;return {async query(sql,args=[]){state.reads.push(sql);assert.equal(sql.includes('FOR UPDATE'),false);if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'){snap=structuredClone({budget:f.state.budget,run:f.state.run,grant:f.state.grant,allocations:f.state.allocations,bindings:f.state.bindings});return {rows:[]};}if(sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL'))return {rows:[]};assert.ok(sql.startsWith('SELECT'));if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now())}]};if(sql.includes('meri_qualification.budget WHERE'))return {rows:[snap.budget]};if(sql.includes('meri_qualification.runs WHERE'))return {rows:[snap.run]};if(sql.includes('meri_qualification.grants WHERE'))return {rows:[snap.grant]};if(sql.includes('meri_qualification.tool_run_allocations WHERE'))return {rows:[snap.allocations.get(args[0])]};if(sql.includes('meri_qualification.tool_grant_bindings WHERE'))return {rows:[snap.bindings.get(args[0])]};throw Error('UNEXPECTED_SQL');},release(){}};}};
 const currentOwner=createPostgresAdmittedRunOwner({pool,allocationJson:JSON.stringify(allocated),grantFactsJsons:[JSON.stringify(grant)],now:f.now,limits:{maxRequestMs:1000,maxFactBytes:131072}}),approvedReads={schemaVersion:'meri-native-general-reads/1',enabled:true,operations:[operation],maxExecuteMs:10000,maxRequestBytes:65536,maxResponseBytes:1048576};
 const entry={binding:f.binding,runRequestSha256:hash(runRequest),grantId:grant.grantId,taskArn:grant.qualificationBinding.workerArn,issuanceFactsSha256:'f'.repeat(64),allocationSha256:hash(allocated),scopes:f.scopes,policyRevision:f.policyRevision,readConfigurationSha256:hash(approvedReads),checkedAtMs:f.now(),expiresAtMs:f.deadlineMs};
 const readCurrentEntry=async()=>{state.entryReads++;const row={...entry,checkedAtMs:f.now()};state.entryMutator?.(row);return row;};
 const taskVerifier=createReadTaskVerifier({allocationJson:JSON.stringify(allocated),grantFactsJsons:[JSON.stringify(grant)],grantId:grant.grantId,currentOwner,readCurrentEntry,taskArn:entry.taskArn,issuanceFactsSha256:entry.issuanceFactsSha256,runRequestSha256:entry.runRequestSha256,scopes:f.scopes,approvedReads,expiresAtMs:f.deadlineMs,enabled:true,now:f.now});
 const core=coreFixture({now:f.now});core.state.nativeExpiry=f.now()+60000;if(options.actorRole)core.state.role=options.actorRole;const coreAuthority=core.client;
 const configuration={binding:f.binding,expiresAtMs:f.deadlineMs,store,taskVerifier,readCurrentEntry,taskCapability:'synthetic-opaque',allocationJson:JSON.stringify(allocated),approvedReads,coreAuthority,defaultCongress:119,now:f.now,enabled:true,
  getNativeCredential:async()=>{state.nativeCredentials++;return state.credential===undefined?'SYNTHETIC_NATIVE':state.credential;},getServiceSecret:async proof=>{state.secrets++;state.secretProof=proof;await state.beforeSecret?.();return state.secret===undefined?'SYNTHETIC_SERVICE':state.secret;}};
 const owner=createNativeReadCredentialOwner(configuration),scope=new AbortController();
 const proof=()=>({binding:f.binding,subject:f.authority.subject,operation,request,requestSha256:hash(request),policyRevision:f.policyRevision,sourceIds:scene.authority.sourceIds,deadlineMs:f.deadlineMs,signal:scope.signal});
 const credentials=context=>{const normalized=contract.normalizeInput(request,context);return {...proof(),argumentsSha256:normalized.argumentsSha256,normalizationContext:context,input:normalized.input,origin,scopeSignal:scope.signal};};
 return {...f,stateOwner:state,core,configuration,owner,scope,proof,credentials,entry,storeState:sf.state,contract,request,operation};
}
