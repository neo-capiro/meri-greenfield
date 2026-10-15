/** Synthetic general-read gateway composition for tests: the actual mail HTTP adapter and handler (fake Fetch), the
 * actual current-tool authority (scripted ports), the actual durable dispatch over the scripted SQL protocol, measured
 * handler source bytes and a synthetic native installation and discovery owner. Never native PostgreSQL, source,
 * identity, SDK or qualification evidence. */
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {selectSkill} from '../../../packages/skills/index.mjs';
import {createCurrentToolAuthority} from '../authorization/current-tool-authority.mjs';
import {createMailHttpAdapter} from '../sources/mail/http-adapter.mjs';
import {createMailReadHandler} from '../sources/mail/handler.mjs';
import {createPostgresToolBudget} from '../budget/postgres-tool-budget.mjs';
import {executionCatalogSha256} from '../catalog/installed-catalog.mjs';
import {scriptedToolPool} from '../test/scripted-tool-pool.mjs';
import {createGeneralReadInstallationOwner} from './installation.mjs';
import {createGeneralReadGatewayMount} from './mount.mjs';
import {unitContext,selected,sourcePage,NOW,uid} from '../../control/document-application/mail-history/test/fixtures.mjs';
export {NOW,uid};
export const MAIL_OPERATIONS=Object.freeze(['mail.list_messages','mail.search_messages','mail.read_thread'].map(id=>Object.freeze({id,version:'0.2.0'})));
const MAIL_SOURCES=['apps/gateway/sources/mail/handler.mjs','apps/gateway/sources/mail/http-adapter.mjs','apps/gateway/sources/mail/request-context.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function generalReadFixture(){
 const unit=unitContext(),context={...unit,scopes:unit.scopes.map(s=>({...s,policyRevision:'b'.repeat(64)}))},binding=context.binding,scopes=context.scopes,policy=scopes[0].policyRevision,subject=selected(context).subject,clientId=subject.entityIds[0],credential='synthetic-opaque';
 const state={now:NOW,revoked:false,installRevoked:false,installed:[...MAIL_OPERATIONS],discovery:[...MAIL_OPERATIONS],parkFetch:null,
  produced:new Map(),budget:{cap_micro_usd:1000,consumed_micro_usd:0,quarantined:false},allocations:new Map(),bindings:new Map(),reservations:new Map(),commands:[],releases:[],connections:0};
 const clock=()=>state.now,wire=[],retained=new Map();
 const claims={capabilityId:uid(60),issuer:'synthetic-only',audience:'meri-gateway',binding,actions:['tool.read'],scopes,issuedAt:new Date(NOW-1000).toISOString(),expiresAt:new Date(NOW+60000).toISOString(),policyRevision:policy,budgets:{maxTurns:12,maxRuntimeSeconds:60,maxCostMicrousd:1000,maxOutputBytes:1048576}};
 const ports={async verifyCapability(){if(state.revoked)throw Error('PRIVATE synthetic membership revoked');return JSON.stringify(claims);},
  async currentRun(){return JSON.stringify({binding,policyRevision:policy,deadlineMs:NOW+60000,checkedAtMs:state.now});},
  // Business policy: this actor is authorized for its one client (and its own mail); any other client is denied.
  async authorizeBusiness({operation,requiredGrants,input}){if(input?.subject?.kind==='client'&&input.subject.entityId!==clientId)throw Error('PRIVATE synthetic client not authorized');return JSON.stringify({decision:{decisionId:subject.authorizationDecisionId,actor:{tenantId:binding.tenantId,actorId:binding.actorId},operation:`${operation.id}@${operation.version}`,scopes:subject.scopes,policyRevision:policy,evaluatedAt:new Date(state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},subject,grants:requiredGrants});},
  async authorizeSources({sourceRequirements}){return JSON.stringify({sourceIds:[...new Set(sourceRequirements.map(s=>s.sourceId))],enabled:true,policyRevision:policy,checkedAtMs:state.now});}};
 const endpoints=Object.fromEntries(MAIL_OPERATIONS.map(op=>[op.id,`https://mail.example.invalid/${op.id}`]));
 const sourceFiles=await Promise.all(MAIL_SOURCES.map(async label=>({label,sha256:sha(await readFile(new URL(`../../../${label}`,import.meta.url)))}))),sourceSha256=canonicalSha256(sourceFiles);
 const handlers=new Map(MAIL_OPERATIONS.map(operation=>{let pins;
  const adapter=createMailHttpAdapter({now:clock,maxRequestMs:1500,maxResponseBytes:1048576,endpoints,
   async getCredentials(value){pins=value;const {input,deadlineMs,signal,...correlation}=value;return {...structuredClone(correlation),bearerToken:'SYNTHETIC_TOKEN',serviceSecret:'SYNTHETIC_SECRET',expiresAtMs:Math.min(deadlineMs,state.now+1500)};},
   async fetchImpl(url,options){wire.push({operation,url,body:JSON.parse(options.body)});state.afterFetch?.();if(state.parkFetch)return state.parkFetch(options.signal);
    const page=sourcePage({operation,request:JSON.parse(options.body).input,binding:pins.binding,subject:pins.subject,window:{basis:'unbounded'},normalizationContext:{nowMs:state.now}});
    return new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});}});
  return [`${operation.id}@${operation.version}`,{execute:createMailReadHandler({operation,adapter,now:clock}),sourceFiles,sourceSha256}];}));
 const installationOwner=createGeneralReadInstallationOwner({binding,scopes,handlers,catalogJson:JSON.stringify(catalog),now:clock,
  async readCurrentInstallation(){if(state.installRevoked)throw Error('PRIVATE synthetic qualification revoked');
   const r={binding,scopes,policyRevision:policy,baseCatalogSha256:canonicalSha256(catalog),installationId:uid(80),executionCatalogSha256:'0'.repeat(64),
    operations:state.installed.map(operation=>({operation,descriptorSha256:canonicalSha256(resolveOperationContract(operation).descriptor),handlerSourceSha256:sourceSha256,qualificationReceiptId:uid(81)})),checkedAtMs:state.now,expiresAtMs:NOW+60000};
   r.executionCatalogSha256=executionCatalogSha256(r);return r;}});
 const discoveryOwner={async readDiscoveryGrant({binding:b,policyRevision:p}){return {binding:b,policyRevision:p,operations:state.discovery,checkedAtMs:state.now,expiresAtMs:NOW+60000};}};
 // Synthetic manifest-shaped allocation (the frozen allocation contract; PROPOSAL P3 adds a base read allocation).
 const base=selectSkill('quick_skill.commitments_audit','1.0.0'),manifest={...structuredClone(base.manifest),allowedOperations:[...MAIL_OPERATIONS]};
 const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),manifest,manifestSha256:canonicalSha256(manifest),catalogSha256:base.pin.catalogSha256,budgets:manifest.budgets,
  schedule:{revision:'d'.repeat(64),expiresAt:new Date(NOW+60000).toISOString(),operations:MAIL_OPERATIONS.map(operation=>({operation,chargeMicrousd:1}))}},allocationJson=JSON.stringify(allocation);
 const grant={grantId:uid(82),binding,qualificationBinding:{runId:binding.runId,attempt:1,workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,fence:binding.writerFence,policyRevision:policy},capabilitySha256:sha(credential),allocationSha256:canonicalSha256(allocation)};
 state.run={run_id:binding.runId,attempt:1,worker_arn:grant.qualificationBinding.workerArn,fence:binding.writerFence,policy_revision:policy};
 state.grant={...state.run,grant_id:grant.grantId,state:'ACTIVE',capability_sha256:grant.capabilitySha256,expires_at:new Date(NOW+60000)};
 const pool=scriptedToolPool(state,clock);
 await createPostgresToolBudget({pool,allocationJson,now:clock}).bindTrustedGrant(JSON.stringify({...grant,invocationId:'binding-admission'}));
 const mailContextPorts={async loadPrevious({key}){return JSON.stringify({record:retained.get(canonicalSha256(key))??null,checkedAtMs:state.now});},
  async retain({record}){retained.set(canonicalSha256(record.key),structuredClone(record));return JSON.stringify({decision:'retained',keySha256:canonicalSha256(record.key),previousSha256:record.previousSha256,checkedAtMs:state.now});}};
 const limits={maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:2000,maxCleanupMs:100};
 const mount=(changes={})=>createGeneralReadGatewayMount({pool,allocationJson,authority:createCurrentToolAuthority({ports,now:clock,maxFactBytes:1048576}),limits,producerContext:grant,producer:{namespace:'general-reads',executionId:'synthetic-run'},
  credential,installationOwner,discoveryOwner,catalogJson:JSON.stringify(catalog),contracts:{resolveOperationContract},now:clock,newId:randomUUID,sourceEnabled:true,mailContextPorts,...changes});
 const search={subject:{kind:'client',entityId:clientId},query:'revised briefing',limit:1,asOf:new Date(NOW).toISOString()};
 return {binding,scopes,policy,clientId,subject,state,wire,mount,search,now:clock,deadlineMs:NOW+60000,installationOwner,discoveryOwner,handlers,sourceSha256};
}
