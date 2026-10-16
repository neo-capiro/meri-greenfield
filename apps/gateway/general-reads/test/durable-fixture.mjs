/** Synthetic native receipts, authority ports and SQL protocol over real gateway owners. Not PostgreSQL qualification. */
import {createHash,randomUUID} from 'node:crypto';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {createCurrentToolAuthority} from '../../authorization/current-tool-authority.mjs';
import {createPostgresToolBudget} from '../../budget/postgres-tool-budget.mjs';
import {scriptedToolPool} from '../../test/scripted-tool-pool.mjs';
import {executionCatalogSha256} from '../../catalog/installed-catalog.mjs';
import {createGeneralReadInstallationOwner} from '../installation.mjs';
import {createGeneralReadGatewayMount} from '../mount.mjs';
import {createGeneralReadFamilyHandlers} from '../integration.mjs';
export async function durableFamilyFixture(scene){
 const {authority:a,operation,now,state}=scene,{binding,claims,subject,policyRevision}=a,scopes=claims.scopes;
 const handlers=await createGeneralReadFamilyHandlers({families:{[scene.family]:scene.transport},now,newId:randomUUID});
 const credential='synthetic-opaque',at=now(),expires=at+10000;
 Object.assign(state,{produced:new Map(),budget:{cap_micro_usd:1000,consumed_micro_usd:0,quarantined:false},allocations:new Map(),
  bindings:new Map(),reservations:new Map(),commands:[],releases:[],connections:0});
 const base=selectSkill('quick_skill.commitments_audit','1.0.0'),manifest={...structuredClone(base.manifest),allowedOperations:[operation]};
 const allocation={run:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,binding[k]])),manifest,
  manifestSha256:canonicalSha256(manifest),catalogSha256:base.pin.catalogSha256,budgets:manifest.budgets,
  schedule:{revision:'d'.repeat(64),expiresAt:new Date(expires).toISOString(),operations:[{operation,chargeMicrousd:1}]}},allocationJson=JSON.stringify(allocation);
 const grant={grantId:randomUUID(),binding,qualificationBinding:{runId:binding.runId,attempt:1,
  workerArn:`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${'a'.repeat(32)}`,fence:binding.writerFence,policyRevision},
  capabilitySha256:createHash('sha256').update(credential).digest('hex'),allocationSha256:canonicalSha256(allocation)};
 state.run={run_id:binding.runId,attempt:1,worker_arn:grant.qualificationBinding.workerArn,fence:binding.writerFence,policy_revision:policyRevision};
 state.grant={...state.run,grant_id:grant.grantId,state:'ACTIVE',capability_sha256:grant.capabilitySha256,expires_at:new Date(expires)};
 const pool=scriptedToolPool(state,now);
 await createPostgresToolBudget({pool,allocationJson,now}).bindTrustedGrant(JSON.stringify({...grant,invocationId:'synthetic-admission'}));
 const installationOwner=createGeneralReadInstallationOwner({binding,scopes,handlers,catalogJson:JSON.stringify(catalog),now,
  async readCurrentInstallation(){if(state.installRevoked)throw Error('PRIVATE synthetic qualification revoked');
   const r={binding,scopes,policyRevision,baseCatalogSha256:canonicalSha256(catalog),installationId:'71000000-0000-4000-8000-000000000080',
    executionCatalogSha256:'0'.repeat(64),operations:[{operation,descriptorSha256:canonicalSha256(resolveOperationContract(operation).descriptor),
     handlerSourceSha256:handlers.get(`${operation.id}@${operation.version}`).sourceSha256,qualificationReceiptId:'71000000-0000-4000-8000-000000000081'}],checkedAtMs:now(),expiresAtMs:expires};
   r.executionCatalogSha256=executionCatalogSha256(r);return r;}});
 const ports={async verifyCapability(){if(state.revoked)throw Error('PRIVATE synthetic revocation');return JSON.stringify(claims);},
  async currentRun(){return JSON.stringify({binding,policyRevision,deadlineMs:expires,checkedAtMs:now()});},
  async authorizeBusiness({operation:op,requiredGrants,input}){
   if(input?.clientId!=null&&subject.kind==='client'&&input.clientId.trim()!==subject.entityIds[0])throw Error('PRIVATE foreign client');
   return JSON.stringify({decision:{...a.decision,operation:`${op.id}@${op.version}`,evaluatedAt:new Date(now()).toISOString()},subject,grants:requiredGrants});},
  async authorizeSources({sourceRequirements}){return JSON.stringify({sourceIds:[...new Set(sourceRequirements.map(s=>s.sourceId))],enabled:true,policyRevision,checkedAtMs:now()});}};
 const retained=new Map(),memoryContextPorts={async loadPrevious({key}){return JSON.stringify({record:retained.get(canonicalSha256(key))??null,checkedAtMs:now()});},
  async retain({record}){retained.set(canonicalSha256(record.key),structuredClone(record));return JSON.stringify({decision:'retained',keySha256:canonicalSha256(record.key),previousSha256:record.previousSha256,checkedAtMs:now()});}};
 const mount=(changes={})=>createGeneralReadGatewayMount({pool,allocationJson,authority:createCurrentToolAuthority({ports,now,maxFactBytes:1048576}),
  limits:{maxRequestBytes:65536,maxResponseBytes:1048576,maxRequestMs:3000,maxCleanupMs:100},producerContext:grant,
  producer:{namespace:'general-reads',executionId:'synthetic-family-run'},credential,installationOwner,
  discoveryOwner:{async readDiscoveryGrant(){return {binding,policyRevision,operations:[operation],checkedAtMs:now(),expiresAtMs:expires};}},
  catalogJson:JSON.stringify(catalog),contracts:{resolveOperationContract},now,newId:randomUUID,sourceEnabled:true,defaultCongress:119,memoryContextPorts,...changes});
 return {...scene,binding,scopes,policyRevision,handlers,mount,deadlineMs:expires,
  execute:(deliveryId='synthetic:read',args=scene.arguments)=>mount().execute({operation,arguments:args,deliveryId})};
}
