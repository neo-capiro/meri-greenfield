/** Scripted existing SQL protocol; never native PostgreSQL acceptance. */
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../packages/skills/index.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {fixture,NOW,uuid,limits} from '../test/fixtures.mjs';
import {createPostgresToolBudget} from '../budget/postgres-tool-budget.mjs';
import {createPostgresAdmittedRunOwner} from '../budget/admitted-run-owner.mjs';
import {createOriginalTrackingSourceMount} from '../sources/original-tracking/mount.mjs';
import {createSelectedSkillInstallationOwner} from '../catalog/selected-installation-owner.mjs';
import {executionCatalogSha256} from '../catalog/installed-catalog.mjs';
export async function setup(){
 const f=fixture(),selected=selectSkill('quick_skill.commitments_audit','1.0.0'),policy='a'.repeat(64),credential='synthetic-opaque',clientId=uuid('9'),operation={id:'query_tasks',version:'0.2.0'},contract=resolveOperationContract(operation);
 f.claims.policyRevision=policy;Object.assign(f.claims.scopes[0],{policyRevision:policy,kind:'client',resourceId:clientId});
 Object.assign(f.subject,{policyRevision:policy,kind:'client',entityType:'client',entityIds:[clientId]});f.state.grants=['tool.read'];
 const original=f.ports.authorizeBusiness;f.ports.authorizeBusiness=async(...x)=>{const value=JSON.parse(await original(...x));value.decision.operation='query_tasks@0.2.0';return JSON.stringify(value);};
 f.ports.authorizeSources=async()=>JSON.stringify({sourceIds:['tasks'],enabled:f.state.sourceEnabled,policyRevision:policy,checkedAtMs:f.state.now});
 const request={requestId:uuid('a'),prompt:'Synthetic original skill request',skill:selected.pin,window:{basis:'unbounded'},windowRequest:null},selection={subject:f.subject,window:request.window,mondayBoardIds:[]};
 const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]])),manifest:selected.manifest,manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,budgets:selected.manifest.budgets,schedule:{revision:'d'.repeat(64),expiresAt:new Date(NOW+60000).toISOString(),operations:selected.manifest.allowedOperations.map(operation=>({operation,chargeMicrousd:1}))}};
 const context={grantId:uuid('8'),binding:f.binding,qualificationBinding:{runId:f.binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,fence:1,policyRevision:policy},capabilitySha256:createHash('sha256').update(credential).digest('hex'),allocationSha256:canonicalSha256(allocation)};
 const state={produced:new Map(),budget:{cap_micro_usd:1000,consumed_micro_usd:0,quarantined:false},run:{run_id:f.binding.runId,attempt:1,worker_arn:context.qualificationBinding.workerArn,fence:1,policy_revision:policy},allocations:new Map(),bindings:new Map(),reservations:new Map(),commands:[],releases:[],connections:0,now:NOW};
 state.grant={...state.run,grant_id:context.grantId,state:'ACTIVE',capability_sha256:context.capabilitySha256,expires_at:new Date(NOW+60000)};
  const liabilities=()=>[...state.reservations.values()].map(r=>({...r,consumed_micro_usd:r.charged_micro_usd??0}));
  let locked=Promise.resolve();
  const pool={async connect(){state.connections++;let releaseLock,backup,phase='read';return {
    async query(sql,p=[]){
      state.commands.push({sql,p});let rows=[];
      if(sql.includes('budget WHERE id=1 FOR UPDATE')){
        const previous=locked;locked=new Promise(r=>releaseLock=r);await previous;
        backup=structuredClone({budget:state.budget,allocations:state.allocations,bindings:state.bindings,reservations:state.reservations,produced:state.produced});rows=[state.budget];
      }else if(sql==='SELECT clock_timestamp() AS now')rows=[{now:new Date(state.now)}];
      else if(sql==='COMMIT'){
        if(state.parkPhase===phase){state.entered?.();await state.gate;}
        state.afterCommit?.(phase);releaseLock?.();releaseLock=null;
        if(state.loseAck===phase){state.loseAck=null;throw Error('synthetic lost acknowledgement');}
      }else if(sql==='ROLLBACK'){if(backup)Object.assign(state,backup);releaseLock?.();releaseLock=null;}
      else if(sql.startsWith('SELECT * FROM meri_qualification.runs'))rows=[state.run];
      else if(sql.startsWith('SELECT * FROM meri_qualification.grants'))rows=[state.grant];
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_run_allocations'))rows=state.allocations.has(p[0])?[state.allocations.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_run_allocations'))state.allocations.set(p[0],{run_id:p[0],allocation_sha256:p[1],allocation:structuredClone(p[2]),max_tool_calls:p[3],max_cost_micro_usd:p[4],started_at:new Date(state.now)});
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_grant_bindings'))rows=state.bindings.has(p[0])?[state.bindings.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_grant_bindings'))state.bindings.set(p[0],{grant_id:p[0],run_id:p[1],facts:structuredClone(p[2])});
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_invocations'))rows=[...state.produced.values()].filter(r=>r.run_id===p[0]&&r.producer_key_sha256===p[1]);
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_invocations')){phase='prepare';state.produced.set(p[0],{invocation_id:p[0],run_id:p[1],producer_key_sha256:p[2],delivery:structuredClone(p[3]),facts:structuredClone(p[4]),raw_request_sha256:p[5],operation:structuredClone(p[6]),deadline_ms:p[7],created_at:new Date(state.now),reservation_id:null,arguments_sha256:null,completion:null});}
      else if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET reservation_id')){phase='claim';Object.assign(state.produced.get(p[0]),{reservation_id:p[1],arguments_sha256:p[2]});}
      else if(sql.startsWith('UPDATE meri_qualification.tool_invocations SET completion')){phase='marker';state.produced.get(p[0]).completion=structuredClone(p[1]);}
      else if(sql.startsWith('SELECT * FROM meri_qualification.tool_reservations'))rows=state.reservations.has(p[0])?[state.reservations.get(p[0])]:[];
      else if(sql.startsWith('INSERT INTO meri_qualification.tool_reservations'))state.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:structuredClone(p[4]),operation:structuredClone(p[5]),arguments_sha256:p[6],hold_micro_usd:p[7],max_output_bytes:p[8],state:'UNKNOWN',created_at:new Date(state.now),charged_micro_usd:null,output_bytes:null,settled_at:null});
      else if(sql.startsWith('UPDATE meri_qualification.budget SET consumed_micro_usd')){phase='settle';state.budget.consumed_micro_usd+=Number(p[0]);}
      else if(sql.startsWith('UPDATE meri_qualification.tool_reservations SET'))Object.assign(state.reservations.get(p[0]),{state:'SETTLED',charged_micro_usd:state.reservations.get(p[0]).hold_micro_usd,output_bytes:p[1],settled_at:new Date(state.now)});
      else if(sql.startsWith('SELECT 1 FROM meri_qualification.budget_liabilities'))rows=liabilities().filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN');
      else if(sql.includes('AS run_total FROM meri_qualification.budget_liabilities'))rows=[{held:liabilities().filter(r=>r.state==='UNKNOWN').reduce((n,r)=>n+r.hold_micro_usd,0),run_total:liabilities().reduce((n,r)=>n+(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0)}];
      else if(sql.startsWith('SELECT count(*) AS calls'))rows=[{calls:state.reservations.size}];
      else if(sql!=='BEGIN'&&!sql.startsWith('SET LOCAL'))throw Error('unmodelled SQL');
      if(state.afterQuery)await state.afterQuery(sql);
      return {rows};
    },release(error){releaseLock?.();releaseLock=null;state.releases.push(error);}
  };}};

 const aJson=JSON.stringify(allocation);await createPostgresToolBudget({pool,allocationJson:aJson,now:()=>f.state.now}).bindTrustedGrant(JSON.stringify({...context,invocationId:'binding-admission'}));
 const wire=[];const source=createOriginalTrackingSourceMount({operation,sourceIdentity:contract.descriptor.sourceRequirements[0],origin:'https://original.example.invalid',now:()=>f.state.now,newId:randomUUID,getCredentials:async pins=>{const {signal,deadlineMs,...rest}=pins;return {...rest,bearerToken:'SYNTHETIC_USER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+10000};},fetchImpl:async(url,options)=>{wire.push({url,body:JSON.parse(options.body)});if(state.afterFetch)state.afterFetch();const input=JSON.parse(options.body);return new Response(JSON.stringify({tool:'query_tasks',generatedAt:new Date(NOW).toISOString(),clientId,total:0,returned:0,tasks:[],scope:{kind:'client',tenantId:f.binding.tenantId,actorUserId:f.binding.actorId,ownerUserId:input.ownerUserId??null,taskId:input.taskId??null,status:input.status??null,dueBefore:input.dueBefore??null,offset:0,limit:input.limit??25,cursorApplied:false},coverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,totalIsExactForScope:true,absenceSupported:true,note:'Synthetic source assertion only.'}}),{headers:{'content-type':'application/json'}});}});
 const label='apps/gateway/sources/original-tracking/mount.mjs',sourceFiles=[{label,sha256:createHash('sha256').update(await readFile(new URL('../sources/original-tracking/mount.mjs',import.meta.url))).digest('hex')}],sourceSha256=canonicalSha256(sourceFiles);
 const handlers=new Map([['query_tasks@0.2.0',{sourceFiles,sourceSha256,execute:source.execute}]]),input={binding:f.binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection)};
 const currentContext=()=>({binding:f.binding,scopes:f.claims.scopes,selectedClientId:state.selectedClientId??clientId,checkedAtMs:f.state.now,expiresAtMs:NOW+10000});
 const receipt=()=>{const r={...input,baseCatalogSha256:selected.pin.catalogSha256,installationId:uuid('b'),executionCatalogSha256:'0'.repeat(64),operations:[{operation,descriptorSha256:canonicalSha256(contract.descriptor),handlerSourceSha256:sourceSha256,qualificationReceiptId:uuid('c')}],checkedAtMs:f.state.now,expiresAtMs:NOW+10000};r.executionCatalogSha256=executionCatalogSha256(r);return {...r,scopes:f.claims.scopes,selectedClientId:clientId,policyRevision:policy};};
 const installConfig={binding:f.binding,request,selection,scopes:f.claims.scopes,selectedClientId:clientId,handlers,readCurrentContext:async()=>currentContext(),readCurrentInstallation:async()=>{if(state.installRevoked)throw Error('synthetic qualification revoked');const r=receipt();state.installChange?.(r);return r;},now:()=>f.state.now};
 const installationOwner=createSelectedSkillInstallationOwner(installConfig),admittedRun=createPostgresAdmittedRunOwner({pool,allocationJson:aJson,grantFactsJsons:[JSON.stringify(context)],now:()=>f.state.now,limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const saved={run:{binding:f.binding,scopes:f.claims.scopes},request};
 return {f,selected,policy,credential,clientId,operation,contract,request,selection,allocation,context,state,pool,wire,sourceFiles,sourceSha256,handlers,input,installConfig,installationOwner,admittedRun,saved,currentContext,receipt,limits,contracts:{resolveOperationContract},catalogJson:JSON.stringify(catalog),producer:{namespace:'original-selected',executionId:'retained-sdk-task'}};
}
