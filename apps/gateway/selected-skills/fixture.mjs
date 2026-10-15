/** Scripted existing SQL protocol; never native PostgreSQL acceptance. */
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {fixture,NOW as ORIGINAL_NOW,uuid,limits} from '../test/fixtures.mjs';
import {scriptedToolPool} from '../test/scripted-tool-pool.mjs';
import {createPostgresToolBudget} from '../budget/postgres-tool-budget.mjs';
import {createPostgresAdmittedRunOwner} from '../budget/admitted-run-owner.mjs';
import {createOriginalTrackingSourceMount} from '../sources/original-tracking/mount.mjs';
import {createSelectedSkillInstallationOwner} from '../catalog/selected-installation-owner.mjs';
import {executionCatalogSha256} from '../catalog/installed-catalog.mjs';
export async function setup({binding,scopes,now,skillId='quick_skill.commitments_audit'}={}){
 const NOW=now===undefined?ORIGINAL_NOW:typeof now==='function'?now():now;
 if(!Number.isSafeInteger(NOW))throw Error('SYNTHETIC_FIXTURE_CLOCK');const ttlMs=now===undefined?10000:60000;
 const f=fixture();if(binding)Object.assign(f.binding,structuredClone(binding));f.state.now=NOW;
 if(scopes)f.claims.scopes=structuredClone(scopes);
 const selected=selectSkill(skillId,'1.0.0'),policy=scopes?.[0]?.policyRevision??'a'.repeat(64),credential='synthetic-opaque',clientId=scopes?.find(s=>s.kind==='client')?.resourceId??uuid('9'),operation={id:'query_tasks',version:'0.2.0'},contract=resolveOperationContract(operation);
 f.claims.policyRevision=policy;if(!scopes)Object.assign(f.claims.scopes[0],{tenantId:f.binding.tenantId,policyRevision:policy,kind:'client',resourceId:clientId});
 Object.assign(f.subject,{tenantId:f.binding.tenantId,actorId:f.binding.actorId,policyRevision:policy,kind:'client',entityType:'client',entityIds:[clientId],scopes:f.claims.scopes});Object.assign(f.claims,{issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+ttlMs).toISOString()});if(now!==undefined)Object.assign(f.claims.budgets,{maxTurns:selected.manifest.budgets.maxTurns,maxRuntimeSeconds:selected.manifest.budgets.maxRuntimeSeconds,maxCostMicrousd:selected.manifest.budgets.maxCostMicroUSD,maxOutputBytes:selected.manifest.budgets.maxOutputBytes});f.state.grants=['tool.read'];
 const original=f.ports.authorizeBusiness;f.ports.authorizeBusiness=async(...x)=>{clock();const value=JSON.parse(await original(...x));Object.assign(value.decision,{operation:'query_tasks@0.2.0',actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},scopes:f.claims.scopes,policyRevision:policy,evaluatedAt:new Date(f.state.now).toISOString()});return JSON.stringify(value);};
 const verify=f.ports.verifyCapability;f.ports.verifyCapability=async(...args)=>{clock();return verify(...args);};
 f.ports.currentRun=async()=>{clock();return JSON.stringify({binding:{...f.binding,writerFence:f.state.fence},policyRevision:policy,deadlineMs:NOW+ttlMs,checkedAtMs:f.state.now});};
 f.ports.authorizeSources=async()=>{clock();return JSON.stringify({sourceIds:['tasks'],enabled:f.state.sourceEnabled,policyRevision:policy,checkedAtMs:f.state.now});};
 const request={requestId:uuid('a'),prompt:'Synthetic original skill request',skill:selected.pin,window:{basis:'unbounded'},windowRequest:null},selection={subject:f.subject,window:request.window,mondayBoardIds:[]};
 const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]])),manifest:selected.manifest,manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,budgets:selected.manifest.budgets,schedule:{revision:'d'.repeat(64),expiresAt:new Date(NOW+60000).toISOString(),operations:selected.manifest.allowedOperations.map(operation=>({operation,chargeMicrousd:1}))}};
 const context={grantId:uuid('8'),binding:f.binding,qualificationBinding:{runId:f.binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,fence:f.binding.writerFence,policyRevision:policy},capabilitySha256:createHash('sha256').update(credential).digest('hex'),allocationSha256:canonicalSha256(allocation)};
 const state={produced:new Map(),budget:{cap_micro_usd:1000,consumed_micro_usd:0,quarantined:false},run:{run_id:f.binding.runId,attempt:1,worker_arn:context.qualificationBinding.workerArn,fence:f.binding.writerFence,policy_revision:policy},allocations:new Map(),bindings:new Map(),reservations:new Map(),commands:[],releases:[],connections:0,now:NOW};
 const clock=()=>{if(typeof now==='function')f.state.now=now();state.now=f.state.now;return f.state.now;};
 state.grant={...state.run,grant_id:context.grantId,state:'ACTIVE',capability_sha256:context.capabilitySha256,expires_at:new Date(NOW+60000)};
 const pool=scriptedToolPool(state,clock);

 const aJson=JSON.stringify(allocation);await createPostgresToolBudget({pool,allocationJson:aJson,now:clock}).bindTrustedGrant(JSON.stringify({...context,invocationId:'binding-admission'}));
 const wire=[];const source=createOriginalTrackingSourceMount({operation,sourceIdentity:contract.descriptor.sourceRequirements[0],origin:'https://original.example.invalid',now:clock,newId:randomUUID,getCredentials:async pins=>{const {signal,deadlineMs,...rest}=pins;return {...rest,bearerToken:'SYNTHETIC_USER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+ttlMs};},fetchImpl:async(url,options)=>{wire.push({url,body:JSON.parse(options.body)});if(state.afterFetch)state.afterFetch();const input=JSON.parse(options.body);return new Response(JSON.stringify({tool:'query_tasks',generatedAt:new Date(NOW).toISOString(),clientId,total:0,returned:0,tasks:[],scope:{kind:'client',tenantId:f.binding.tenantId,actorUserId:f.binding.actorId,ownerUserId:input.ownerUserId??null,taskId:input.taskId??null,status:input.status??null,dueBefore:input.dueBefore??null,offset:0,limit:input.limit??25,cursorApplied:false},coverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:true,note:'Synthetic source assertion only.'}}),{headers:{'content-type':'application/json'}});}});
 const label='apps/gateway/sources/original-tracking/mount.mjs',sourceFiles=[{label,sha256:createHash('sha256').update(await readFile(new URL('../sources/original-tracking/mount.mjs',import.meta.url))).digest('hex')}],sourceSha256=canonicalSha256(sourceFiles);
 const handlers=new Map([['query_tasks@0.2.0',{sourceFiles,sourceSha256,execute:source.execute}]]),input={binding:f.binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection)};
 const currentContext=()=>{clock();return {binding:f.binding,scopes:f.claims.scopes,selectedClientId:state.selectedClientId??clientId,checkedAtMs:f.state.now,expiresAtMs:NOW+ttlMs};};
 const receipt=()=>{clock();const r={...input,baseCatalogSha256:selected.pin.catalogSha256,installationId:uuid('b'),executionCatalogSha256:'0'.repeat(64),operations:[{operation,descriptorSha256:canonicalSha256(contract.descriptor),handlerSourceSha256:sourceSha256,qualificationReceiptId:uuid('c')}],checkedAtMs:f.state.now,expiresAtMs:NOW+ttlMs};r.executionCatalogSha256=executionCatalogSha256(r);return {...r,scopes:f.claims.scopes,selectedClientId:clientId,policyRevision:policy};};
 const installConfig={binding:f.binding,request,selection,scopes:f.claims.scopes,selectedClientId:clientId,handlers,readCurrentContext:async()=>currentContext(),readCurrentInstallation:async()=>{if(state.installRevoked)throw Error('synthetic qualification revoked');const r=receipt();state.installChange?.(r);return r;},now:clock};
 const installationOwner=createSelectedSkillInstallationOwner(installConfig),admittedRun=createPostgresAdmittedRunOwner({pool,allocationJson:aJson,grantFactsJsons:[JSON.stringify(context)],now:clock,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const saved={run:{binding:f.binding,scopes:f.claims.scopes},request};
 return {f,selected,policy,credential,clientId,operation,contract,request,selection,allocation,context,state,pool,wire,sourceFiles,sourceSha256,handlers,input,installConfig,installationOwner,admittedRun,saved,currentContext,receipt,limits,contracts:{resolveOperationContract},catalogJson:JSON.stringify(catalog),now:clock,producer:{namespace:'original-selected',executionId:'retained-sdk-task'}};
}
