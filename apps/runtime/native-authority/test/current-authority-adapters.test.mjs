/** The current-authority adapters over a synthetic Core (golden receipts from capiro-backend #84 @ 0304b0ef), the live-session
 * relay, secret files and the product-budget SQL: reads identify/check, each lane E port, every refusal class and the control
 * composition. No live Core, PostgreSQL, SDK or network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract,commandToolValidators} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {safeFailure} from '../../../gateway/dispatch/operation-result.mjs';
import {createIntentResultReleaseAuthority} from '../../../control/intents/result-release-authority.mjs';
import {createTaskCreateApprovalMetadataOwner} from '../../../control/commands/approval-metadata/index.mjs';
import {policySelection,policyReceipt} from '../../../control/commands/approval-metadata/binding.mjs';
import {productionTrust} from './execution-capability-fixture.mjs';
import {createControlIntentExecution} from '../execution-composition.mjs';
import {createCurrentAuthorityAdapters,createControlCurrentAuthority,selectedClientOf,CURRENT_AUTHORITY_CLAIMS_ISSUER} from '../current-authority-adapters.mjs';
import {compileGatewayLimits,GATEWAY_LIMITS_DEFAULTS} from '../current-authority-limits.mjs';
import {fixture,BINDING,SCOPES,POLICY,CLIENT,OTHER_CLIENT,TENANT,ACTOR,NOW,ORIGIN,CORE_ORIGIN,FILES,TASK_CAPABILITY,MODEL_CAPABILITY,SESSION_BEARER,SERVICE_SECRET,CONTROL_CREDENTIAL,PATHS,uuid} from './current-authority-fixture.mjs';
const code=expected=>error=>safeFailure(error).message===expected;
const DESCRIPTOR=resolveOperationContract({id:'search_tracked_bills',version:'0.2.0'}).descriptor;
const TASK_DESCRIPTOR=(()=>{const e=resolveOperationContract({id:'create_task',version:'0.2.0'}).descriptor;return {operation:e.operation,requiredGrants:e.requiredGrants,sourceRequirements:e.sourceRequirements};})();
function adapters(f,extra={}){
 return createCurrentAuthorityAdapters({origin:ORIGIN,coreOrigin:CORE_ORIGIN,nativeCredentials:f.nativeCredentials,readSecret:f.readSecret,reservedFiles:[FILES.identity,FILES.task,FILES.control,FILES.proxy],secretFiles:[FILES.service,FILES.readMode],
  serviceSecretFile:FILES.executionService,sourceEnabled:true,now:f.now,fetchImpl:f.fetchImpl,newId:()=>uuid('7'),...extra});
}
function bound(f,extra={}){const a=adapters(f,extra);a.bind({pool:f.pool,conversations:f.conversations,approvalMetadata:f.approvalMetadata});return a;}
const limitDeadline=()=>{};
async function identified(a,f){const identity=await a.authority.identify({credential:TASK_CAPABILITY,limitDeadline});return {identity,claims:identity.claims,run:identity.run};}

test('construction is inert; unbound pool ports refuse UNAVAILABLE before any secret, Core or SQL',async()=>{
 const f=fixture(),a=adapters(f);
 assert.equal(a.state(),'unbound');assert.deepEqual(a.missing(),['pool']);
 await assert.rejects(a.authority.identify({credential:TASK_CAPABILITY,limitDeadline}),code('UNAVAILABLE'));
 await assert.rejects(a.ports.verifyCapability(TASK_CAPABILITY),code('UNAVAILABLE'));
 await assert.rejects(a.ports.currentRun(BINDING,{}),code('UNAVAILABLE'));
 await assert.rejects(a.owners.currentRights({binding:BINDING,policyRevision:POLICY}),code('UNAVAILABLE'));
 await assert.rejects(a.owners.core.getCredentials({tenantId:TENANT,actorId:ACTOR,purpose:'approval.execution',binding:BINDING}),code('UNAVAILABLE'));
 assert.equal(a.owners.core.origin,CORE_ORIGIN);
 assert.deepEqual([f.state.secretReads,f.state.core,f.state.relay,f.state.sql],[[],[],[],[]]);
 assert.throws(()=>a.bind({}),code('GATEWAY_CONFIGURATION'));
 a.bind({pool:f.pool});assert.equal(a.state(),'composed');assert.deepEqual(a.missing(),[]);assert.throws(()=>a.bind({pool:f.pool}),code('GATEWAY_CONFIGURATION'));
 assert.equal(adapters(f,{serviceSecretFile:undefined}).missing().includes('core.getCredentials:serviceSecretFile'),true);
 for(const bad of [{origin:'http://core.example.test'},{reservedFiles:['relative/path']},{secretFiles:[FILES.identity]},{capabilityAction:'session.persist'},{limits:{maxLeaseMs:1}}])assert.throws(()=>adapters(f,bad),code('GATEWAY_CONFIGURATION'));
});

test('reads: identify projects the admitted task grant into tool.read claims and the fresh admitted-run observation',async()=>{
 const f=fixture(),a=bound(f),{claims,run}=await identified(a,f);
 assert.deepEqual(claims,{capabilityId:f.facts.task.grantId,issuer:CURRENT_AUTHORITY_CLAIMS_ISSUER,audience:'meri-gateway',binding:BINDING,actions:['tool.read'],scopes:SCOPES,
  issuedAt:new Date(NOW-5000).toISOString(),expiresAt:new Date(Math.min(NOW+600000,run.deadlineMs)).toISOString(),policyRevision:POLICY,budgets:{maxTurns:3,maxRuntimeSeconds:900,maxCostMicrousd:2000000,maxOutputBytes:262144}});
 validateShape('CapabilityClaims',claims);
 assert.deepEqual({...run,checkedAtMs:0},{binding:BINDING,policyRevision:POLICY,deadlineMs:run.deadlineMs,checkedAtMs:0});assert.equal(run.checkedAtMs,NOW);
 assert.ok(run.deadlineMs>NOW&&run.deadlineMs<=Date.parse('2026-10-18T15:00:00.000Z'));
 // Identification is Meri-local: the task capability, the budget rows and the run row; no Core or relay call.
 assert.deepEqual([f.state.core,f.state.relay],[[],[]]);
 assert.ok(f.state.sql.some(s=>s.startsWith('SELECT g.grant_id,g.run_id,g.state,g.expires_at,g.policy_revision,b.facts,a.allocation,a.allocation_sha256,a.started_at')));
 assert.ok(f.state.sql.every(s=>!s.includes('FOR UPDATE')));
 // Unknown, revoked and non-admitted capabilities answer no claims.
 await assert.rejects(a.ports.verifyCapability('synthetic-unknown-capability'),code('ACCESS_DENIED'));
 f.state.grantState.set(f.facts.task.grantId,'REVOKED');await assert.rejects(a.ports.verifyCapability(TASK_CAPABILITY),code('ACCESS_DENIED'));f.state.grantState.clear();
 f.state.admittedGrants=[JSON.stringify(f.facts.model)];await assert.rejects(a.ports.verifyCapability(TASK_CAPABILITY),code('ACCESS_DENIED'));f.state.admittedGrants=null;
 f.state.run={...f.state.run,state:'completed'};await assert.rejects(a.ports.verifyCapability(TASK_CAPABILITY),code('ACCESS_DENIED'));
 f.state.run={...f.state.run,state:'running',scopes:[{...SCOPES[0],resourceId:OTHER_CLIENT},{...SCOPES[0]}]};await assert.rejects(a.ports.verifyCapability(TASK_CAPABILITY),code('ACCESS_DENIED'));
 f.state.run=null;await assert.rejects(a.ports.verifyCapability(TASK_CAPABILITY),code('UNAVAILABLE'),'no run row is unavailability, not a denial of record');
});

test('reads: check establishes current authority from Core with the live-session bearer and never a service or candidate credential',async()=>{
 const f=fixture(),a=bound(f),descriptor={operation:DESCRIPTOR.operation,requiredGrants:DESCRIPTOR.requiredGrants,sourceRequirements:DESCRIPTOR.sourceRequirements};
 const before=f.state.core.length,result=await a.authority.check({credential:TASK_CAPABILITY,descriptor,input:{clientId:'Acme Corp',query:'water'},limitDeadline});
 assert.deepEqual(result.binding,BINDING);assert.equal(result.policyRevision,POLICY);
 assert.deepEqual(result.subject,{kind:'client',entityType:'client',entityIds:[CLIENT],tenantId:TENANT,actorId:ACTOR,authorizationDecisionId:uuid('7'),policyRevision:POLICY,scopes:SCOPES,rosterVersionId:null});
 assert.deepEqual(result.decision,{decisionId:uuid('7'),actor:{tenantId:TENANT,actorId:ACTOR},operation:'search_tracked_bills@0.2.0',scopes:SCOPES,policyRevision:POLICY,evaluatedAt:new Date(NOW).toISOString(),decision:'allowed',reasonCode:'CORE_MEMBERSHIP_CONTEXT_CURRENT'});
 assert.deepEqual(result.sourceIds,['tracked_bills']);assert.ok(result.deadlineMs>NOW);
 // Business: identity, (identity+membership), context, identity; sources: identity, (identity+membership), identity. Fresh each.
 const calls=f.state.core.slice(before);
 assert.deepEqual(calls.map(c=>c.path),[PATHS.identity,PATHS.identity,PATHS.membership,PATHS.context,PATHS.identity,PATHS.identity,PATHS.identity,PATHS.membership,PATHS.identity]);
 assert.deepEqual([...f.bearers()],[SESSION_BEARER]);
 for(const c of calls){assert.equal(c.method,'POST');assert.equal(c.headers['x-internal-service-secret'],undefined,c.path);assert.equal(c.headers['cookie'],undefined);}
 assert.deepEqual(calls.find(c=>c.path===PATHS.context).body,{identitySha256:hash({principal:{tenantId:TENANT,actorId:ACTOR},identityRevision:'a'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+60000}),conversationId:BINDING.conversationId,clientId:CLIENT});
 assert.ok(f.state.relay.length>=4);assert.ok(f.state.relay.every(r=>r.selectedClientId===CLIENT&&r.binding.runId===BINDING.runId));
 // Candidate credential digests are read once; service secret files are re-read on every bearer use.
 assert.equal(f.state.secretReads.filter(p=>p===FILES.identity).length,1);assert.ok(f.state.secretReads.filter(p=>p===FILES.service).length>=4);
 // A second check is a new observation: the same decision shape, no cache, and a Core refusal now refuses.
 const again=await a.authority.check({credential:TASK_CAPABILITY,descriptor,input:{clientId:'Acme Corp',query:'water'},limitDeadline});
 assert.deepEqual(again.subject,result.subject);assert.equal(f.state.core.length,before+18);
 f.state.status[PATHS.membership]=403;await assert.rejects(a.authority.check({credential:TASK_CAPABILITY,descriptor,input:{query:'water'},limitDeadline}),code('ACCESS_DENIED'));
});

test('business and source ports answer typed codes: stale, future or expired Core clocks and every binding or client mismatch refuse',async()=>{
 const f=fixture(),a=bound(f),{claims}=await identified(a,f);
 const business=input=>a.ports.authorizeBusiness({claims,operation:DESCRIPTOR.operation,requiredGrants:DESCRIPTOR.requiredGrants,input,signal:undefined});
 const sources=subject=>a.ports.authorizeSources({claims,subject,sourceRequirements:DESCRIPTOR.sourceRequirements,signal:undefined});
 const policy=JSON.parse(await business({query:'water'}));assert.deepEqual(policy.grants,['tool.read']);
 const s=JSON.parse(await sources(policy.subject));assert.deepEqual(s,{sourceIds:['tracked_bills'],enabled:true,policyRevision:POLICY,checkedAtMs:NOW});
 const cases=[
  ['stale membership',h=>{h.state.mutate=(v,p)=>{if(p===PATHS.membership)v.checkedAtMs=NOW-10000;};}],
  ['future identity',h=>{h.state.mutate=(v,p)=>{if(p===PATHS.identity)v.checkedAtMs=NOW+1;};}],
  // Core's receipt is well formed (expires after its check) but Meri's clock has passed it when the answer is read.
  ['context expired at the Meri clock',h=>{h.state.mutate=(v,p)=>{if(p===PATHS.context){v.expiresAtMs=NOW+1;h.clock.at=NOW+1;}};}],
  ['identity revision rotates mid-check',h=>{let n=0;h.state.mutate=(v,p)=>{if(p===PATHS.identity&&++n===3)v.identityRevision='f'.repeat(64);};}],
  ['foreign principal',h=>{h.state.principalActor=uuid('a');}],
  ['client not in the current roster',h=>{h.state.clientIds=[OTHER_CLIENT];}],
  ['context answers another client',h=>{h.state.contextClient=OTHER_CLIENT;}],
  ['membership suspended',h=>{h.state.membershipStatus='suspended';}],
  ['role below standard_user',h=>{h.state.role='client_portal_user';}],
  ['membership 403',h=>{h.state.status[PATHS.membership]=403;}],
 ];
 // Each case on its own fresh fixture: the same claims, one armed Core answer, one typed refusal.
 for(const [name,arm] of cases){const h=fixture();arm(h);const c=bound(h);
  await assert.rejects(c.ports.authorizeBusiness({claims,operation:DESCRIPTOR.operation,requiredGrants:DESCRIPTOR.requiredGrants,input:{query:'water'},signal:undefined}),code('ACCESS_DENIED'),name);}
 // The authority HTTP client (`authority-http.mjs`) has no status mapping: an identity 401 is UNAVAILABLE, the membership gate's 401/403 are ACCESS_DENIED.
 {const h=fixture();h.state.status[PATHS.identity]=401;await assert.rejects(bound(h).ports.authorizeBusiness({claims,operation:DESCRIPTOR.operation,requiredGrants:DESCRIPTOR.requiredGrants,input:{},signal:undefined}),code('UNAVAILABLE'));}
 // A UUID client selector that is not the run's client refuses before Core; a name is left to the native owner's check-ref.
 const n=f.state.core.length;await assert.rejects(business({clientId:OTHER_CLIENT,query:'water'}),code('ACCESS_DENIED'));assert.equal(f.state.core.length,n);
 await business({clientId:'Acme Corp',query:'water'});
 // Core unreachable, or a receipt Core itself malformed (expired at issue), is UNAVAILABLE, not a denial of record.
 f.state.respond=()=>{throw Object.assign(Error('ECONNREFUSED'),{code:'ECONNREFUSED'});};await assert.rejects(business({query:'water'}),code('UNAVAILABLE'));f.state.respond=null;
 f.state.mutate=(v,p)=>{if(p===PATHS.context)v.expiresAtMs=NOW;};await assert.rejects(business({query:'water'}),code('UNAVAILABLE'));f.state.mutate=null;
 // Sources: a subject for another client, revision or scope is refused before Core; source enablement follows G1.
 const m=f.state.core.length;
 await assert.rejects(sources({...policy.subject,entityIds:[OTHER_CLIENT]}),code('ACCESS_DENIED'));
 await assert.rejects(sources({...policy.subject,policyRevision:'f'.repeat(64),scopes:[{...SCOPES[0],policyRevision:'f'.repeat(64)}]}),code('ACCESS_DENIED'));
 assert.equal(f.state.core.length,m);
 const off=bound(fixture(),{sourceEnabled:false});assert.equal(JSON.parse(await off.ports.authorizeSources({claims,subject:policy.subject,sourceRequirements:DESCRIPTOR.sourceRequirements,signal:undefined})).enabled,false);
 // Claims naming another client scope find no live session for that run and client: UNAVAILABLE, and no Core call.
 {const k=f.state.core.length;await assert.rejects(a.ports.authorizeBusiness({claims:{...claims,scopes:[{...SCOPES[0],resourceId:OTHER_CLIENT}]},operation:DESCRIPTOR.operation,requiredGrants:DESCRIPTOR.requiredGrants,input:{},signal:undefined}),code('UNAVAILABLE'));assert.equal(f.state.core.length,k);}
 assert.equal(selectedClientOf([{...SCOPES[0]},{...SCOPES[0],kind:'tenant'}]),null);assert.equal(selectedClientOf(SCOPES),CLIENT);
});

test('control-credential substitution, a replaced, expired or absent live session and a bearer equal to a secret refuse before Core',async()=>{
 const f=fixture(),a=bound(f),{claims}=await identified(a,f);
 const business=()=>a.ports.authorizeBusiness({claims,operation:DESCRIPTOR.operation,requiredGrants:DESCRIPTOR.requiredGrants,input:{},signal:undefined});
 const n=()=>f.state.core.length;
 f.state.session={credential:CONTROL_CREDENTIAL,expiresAtMs:NOW+300000};let before=n();await assert.rejects(business(),code('UNAVAILABLE'));assert.equal(n(),before);
 f.state.session={credential:SERVICE_SECRET,expiresAtMs:NOW+300000};before=n();await assert.rejects(business(),code('UNAVAILABLE'));assert.equal(n(),before);
 f.state.session={credential:MODEL_CAPABILITY,expiresAtMs:NOW+300000};before=n();await assert.rejects(business(),code('UNAVAILABLE'));assert.equal(n(),before);
 f.state.session={credential:SESSION_BEARER,expiresAtMs:NOW};before=n();await assert.rejects(business(),code('UNAVAILABLE'));assert.equal(n(),before);
 f.state.session=null;before=n();await assert.rejects(business(),code('UNAVAILABLE'));assert.equal(n(),before);
 f.state.session={credential:SESSION_BEARER,expiresAtMs:NOW+300000};
 // The session is replaced while the Core calls are in flight: the observation is refused, nothing is answered from it.
 f.state.replaceAfter=f.state.relay.length+2;await assert.rejects(business(),code('UNAVAILABLE'));delete f.state.replaceAfter;
 // A service secret file that now holds the bearer fails closed on the next call (rotation is re-read every time).
 f.files[FILES.readMode]=SESSION_BEARER;await assert.rejects(business(),code('UNAVAILABLE'));f.files[FILES.readMode]=SERVICE_SECRET;
 await business();
 // The session expiry bounds every observation: no receipt outlives the live session.
 f.state.session={credential:SESSION_BEARER,expiresAtMs:NOW+2000};const rights=await a.owners.currentRights({binding:BINDING,policyRevision:POLICY});assert.equal(rights.expiresAtMs,NOW+2000);
});

test('lane E: currentRights feeds the result-release authority; preparePolicy drives the approval-metadata owner; getCredentials relays the approver bearer',async()=>{
 const f=fixture(),a=bound(f);
 const rights=await a.owners.currentRights({binding:BINDING,policyRevision:POLICY,deadlineMs:NOW+5000});
 assert.deepEqual(rights,{tenantId:TENANT,actorId:ACTOR,scopes:SCOPES,checkedAtMs:NOW,expiresAtMs:NOW+5000});
 await assert.rejects(a.owners.currentRights({binding:BINDING,policyRevision:'f'.repeat(64)}),code('ACCESS_DENIED'));
 const release=createIntentResultReleaseAuthority({binding:BINDING,currentRun:a.ports.currentRun,currentRights:a.owners.currentRights,now:f.now});
 const selection={binding:BINDING,operation:{id:'create_task',version:'0.2.0'},deliveryId:'sdk:'+'1'.repeat(64),argumentsSha256:'2'.repeat(64),original:null,resultSha256:null};
 const receipt=await release.check({selection,selectionSha256:hash(selection),limitDeadline});
 assert.deepEqual({...receipt,checkedAtMs:0,expiresAtMs:0},{authorized:true,selectionSha256:hash(selection),binding:BINDING,scopes:SCOPES,checkedAtMs:0,expiresAtMs:0});
 // preparePolicy under the real owner: prepare + before_release, then read: before_read + read_release, all against Core.
 const commandContext={binding:BINDING,clientResolution:{reference:CLIENT,clientId:CLIENT}},phases=[];
 const preparePolicy=async call=>{phases.push(call.phase);const r=await a.owners.preparePolicy(call);policyReceipt(r,call.selection,NOW,f.now(),null);return r;};
 const owner=createTaskCreateApprovalMetadataOwner({store:f.approvalMetadata,commandContext,preparePolicy,now:f.now,newId:()=>uuid('8'),maxRequestMs:5000});
 const request={title:'Call the clerk',clientId:CLIENT,dueDate:'2026-10-30'},operation={id:'create_task',version:'0.2.0'},input=commandToolValidators.normalizeCommandToolInput('task.create',request,{commandContext}).input;
 const record=await owner.prepare({operation,action:'task.create',binding:BINDING,request,input,inputSha256:hash(input),deadlineMs:NOW+5000,signal:undefined});
 assert.deepEqual(phases,['prepare','before_release']);assert.deepEqual(record.scopes,SCOPES);assert.deepEqual(record.requiredApprover,{tenantId:TENANT,actorId:ACTOR});
 const deadline=JSON.parse(await a.ports.currentRun(BINDING,{})).deadlineMs;assert.equal(record.expiresAt,new Date(Math.min(NOW+900000,deadline)).toISOString());
 const read=await owner.read({proposalId:record.proposalId,commandSha256:f.state.stored.commandSha256,operation,action:'task.create',binding:BINDING,deadlineMs:NOW+5000,signal:undefined});
 assert.deepEqual(phases,['prepare','before_release','before_read','read_release']);assert.deepEqual({...read,checkedAtMs:0},{...record,checkedAtMs:0});
 // The stored proposal must still match the CURRENT policy: a changed run selection or a lost client refuses the read.
 f.state.clientIds=[OTHER_CLIENT];await assert.rejects(owner.read({proposalId:record.proposalId,commandSha256:f.state.stored.commandSha256,operation,action:'task.create',binding:BINDING,deadlineMs:NOW+5000,signal:undefined}));f.state.clientIds=undefined;
 const selectionOf=(phase,extra)=>{const s=policySelection(phase,{operation,action:'task.create',binding:BINDING,...extra});return {phase,selection:s,selectionSha256:hash(s)};};
 await assert.rejects(a.owners.preparePolicy(selectionOf('before_read',{proposalId:uuid('6'),commandSha256:f.state.stored.commandSha256})),code('ACCESS_DENIED'));
 await assert.rejects(a.owners.preparePolicy({...selectionOf('prepare',{request,inputSha256:hash(input)}),selectionSha256:'0'.repeat(64)}),code('ACCESS_DENIED'));
 await assert.rejects(a.owners.preparePolicy(selectionOf('prepare',{request,inputSha256:hash(input),operation:{id:'update_task',version:'0.2.0'},action:'task.update'})),code('ACCESS_DENIED'));
 // getCredentials: the approver's live-session bearer, correlated at Core, and the verified execution service secret.
 const credentials=await a.owners.core.getCredentials({tenantId:TENANT,actorId:ACTOR,purpose:'approval.execution',binding:BINDING,deadlineMs:NOW+5000});
 assert.deepEqual(credentials,{tenantId:TENANT,actorId:ACTOR,bearerToken:SESSION_BEARER,serviceSecret:SERVICE_SECRET,expiresAtMs:NOW+5000});
 await assert.rejects(a.owners.core.getCredentials({tenantId:TENANT,actorId:uuid('a'),purpose:'approval.execution',binding:BINDING}),code('ACCESS_DENIED'));
 await assert.rejects(a.owners.core.getCredentials({tenantId:TENANT,actorId:ACTOR,purpose:'tool.read',binding:BINDING}),code('ACCESS_DENIED'));
 f.state.principalActor=uuid('a');await assert.rejects(a.owners.core.getCredentials({tenantId:TENANT,actorId:ACTOR,purpose:'approval.execution',binding:BINDING}),code('ACCESS_DENIED'));f.state.principalActor=undefined;
 f.files[FILES.executionService]=CONTROL_CREDENTIAL;await assert.rejects(a.owners.core.getCredentials({tenantId:TENANT,actorId:ACTOR,purpose:'approval.execution',binding:BINDING}),code('UNAVAILABLE'));f.files[FILES.executionService]=SERVICE_SECRET;
 const none=bound(fixture(),{serviceSecretFile:undefined});await assert.rejects(none.owners.core.getCredentials({tenantId:TENANT,actorId:ACTOR,purpose:'approval.execution',binding:BINDING}),code('UNAVAILABLE'));
 // The execution descriptor's business/source authority uses the same adapters with command.execute claims.
 const claims={capabilityId:uuid('5'),issuer:'capiro-core:meri-execution:v1',audience:'meri-gateway',binding:BINDING,actions:['command.execute'],scopes:SCOPES,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+120000).toISOString(),policyRevision:POLICY,budgets:{maxTurns:3,maxRuntimeSeconds:900,maxCostMicrousd:2000000,maxOutputBytes:262144}};
 const policy=JSON.parse(await a.owners.authorizeBusiness({claims,operation:TASK_DESCRIPTOR.operation,requiredGrants:TASK_DESCRIPTOR.requiredGrants,input:{title:'Call the clerk',clientId:CLIENT,dueDate:null},signal:undefined}));
 assert.deepEqual(policy.grants,['command.execute']);assert.equal(policy.decision.operation,'create_task@0.2.0');
 assert.deepEqual(JSON.parse(await a.owners.authorizeSources({claims,subject:policy.subject,sourceRequirements:TASK_DESCRIPTOR.sourceRequirements,signal:undefined})).sourceIds,['capiro_commands']);
});

test('createControlCurrentAuthority composes from the runtime configuration; the intents execution owner reaches composed with the five owners',async()=>{
 const f=fixture(),t=productionTrust();
 const configuration={sourceEnabled:true,limits:{requestMs:5000,requestBytes:65536},native:{maxResponseBytes:262144},
  nativeCandidate:{identity:{origin:ORIGIN,credentialFile:FILES.identity,commandContext:{binding:BINDING,clientResolution:{reference:CLIENT,clientId:CLIENT}}},taskCapabilityFile:FILES.task,controlCapabilityFile:FILES.control,proxyCredentialFile:FILES.proxy,other:true},
  reads:{enabled:true,serviceSecretFile:FILES.service,readModeServiceSecretFile:FILES.readMode,gateway:{maxResponseBytes:1048576}},
  intents:{enabled:true,execution:{coreOrigin:CORE_ORIGIN,issuer:t.issuer,keys:t.keys,serviceSecretFile:FILES.executionService}}};
 const authority=createControlCurrentAuthority({configuration,readSecret:f.readSecret,nativeCredentials:f.nativeCredentials,fetchImpl:f.fetchImpl,now:f.now});
 assert.deepEqual(authority.gateway.limits,{...GATEWAY_LIMITS_DEFAULTS,maxResponseBytes:1048576});assert.equal(typeof authority.gateway.authority.identify,'function');assert.equal(typeof authority.gateway.authority.check,'function');
 assert.deepEqual(Object.keys(authority.owners),['core','preparePolicy','authorizeBusiness','authorizeSources','currentRights']);assert.equal(authority.owners.core.origin,CORE_ORIGIN);
 assert.deepEqual(f.state.secretReads,[],'no secret is read at composition');
 assert.deepEqual(compileGatewayLimits(undefined),GATEWAY_LIMITS_DEFAULTS);
 for(const bad of [{maxRequestMs:100},{maxResponseBytes:16777217},{other:1},{maxRequestBytes:'65536'}])assert.throws(()=>compileGatewayLimits(bad),code('GATEWAY_CONFIGURATION'));
 assert.throws(()=>createControlCurrentAuthority({configuration:{...configuration,nativeCandidate:undefined},readSecret:f.readSecret,nativeCredentials:f.nativeCredentials}),code('GATEWAY_CONFIGURATION'));
 // The cli.mjs composition: the authority binds the first trusted context through the intents family wrapper.
 const {createProductPortsFactory,PRODUCT_FAMILIES}=await import('../../product-ports/index.mjs');
 const {captureRuntimePorts}=await import('../../product-applications.mjs');
 const execution=createControlIntentExecution({readSecret:f.readSecret,owners:authority.owners});
 const family=context=>{authority.bind(context);return execution.family(context);};
 // The trusted context carries the control configuration; the execution owner compiles `nativeCandidate` only when present.
 const {nativeCandidate,...contextConfiguration}=configuration;
 const context=Object.freeze({configuration:contextConfiguration,pool:f.pool,client:{},native:{call:async()=>{throw Error('no native');}},now:f.now,
  canonicalProductPorts:captureRuntimePorts({conversationMembership:{async admit(){throw Error('not used');},async recheck(){throw Error('not used');}}})});
 const ports=createProductPortsFactory({families:PRODUCT_FAMILIES.map(([n,fn])=>[n,n==='intents'?family:fn])})(context);
 assert.ok(ports.intentApplication);assert.equal(authority.state(),'composed');assert.equal(execution.state(),'composed');assert.deepEqual(execution.missing(),[]);
 assert.deepEqual([f.state.core,f.state.sql],[[],[]],'composition makes no Core or SQL call');
 // The bound gateway authority serves a read over the real conversation store shapes only when supplied; here the real
 // Postgres store would hit the scripted pool with conversation SQL, so the identify path answers UNAVAILABLE instead of
 // claims, and never a credential or a Core call.
 await assert.rejects(authority.gateway.authority.identify({credential:TASK_CAPABILITY,limitDeadline}),code('ACCESS_DENIED'));
 assert.deepEqual(f.state.core,[]);
});
