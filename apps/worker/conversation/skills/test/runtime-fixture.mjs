/** Synthetic task/current receipts, actual configured mail HTTP handlers and canonical dispatch. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {mailHistorySourceFixture} from '../../../../gateway/test/mail-history-source-fixture.mjs';
import {createCommitmentsAuditCompiler} from '../../../../control/document-application/commitments-audit/compose.mjs';
import {createRelationshipBriefCompiler} from '../../../../control/document-application/relationship-brief/compose.mjs';
import * as commitments from '../../../../control/document-application/commitments-audit/test/fixtures.mjs';
import * as relationships from '../../../../control/document-application/relationship-brief/test/fixtures.mjs';
import {versions} from '../../../../control/conversations/test/store-fixture.mjs';
export function runtimeFixture(skillId='quick_skill.commitments_audit') {
 const domain=skillId==='quick_skill.commitments_audit'?commitments:relationships,context=domain.unitContext(),selection=skillId==='quick_skill.commitments_audit'?domain.selection(context):domain.selected(context),selected=selectSkill(skillId,'1.0.0'),now=()=>domain.NOW;
 const claims={capabilityId:domain.uid(60),issuer:'synthetic-only',audience:'meri-gateway',binding:context.binding,actions:['tool.read'],scopes:context.scopes,issuedAt:new Date(now()-1000).toISOString(),expiresAt:new Date(now()+5000).toISOString(),policyRevision:context.scopes[0].policyRevision,budgets:{maxTurns:12,maxRuntimeSeconds:60,maxCostMicrousd:1000,maxOutputBytes:1048576}};
 const source=mailHistorySourceFixture({artifactOptions:{context},ledger:{f:{claims}},now},selection),state={installReads:0,runReads:0,compiled:null,revoked:false};
 const request={requestId:domain.uid(61),prompt:'Original selected task',skill:selected.pin,window:selection.window,windowRequest:null},callPins={binding:context.binding,skill:selected.pin,requestSha256:canonicalSha256(request),selectionSha256:canonicalSha256(selection)};
 const stamp=()=>({checkedAtMs:now(),expiresAtMs:now()+5000});
 const installed=selected.manifest.allowedOperations.filter(o=>['resolve_entity','find_contacts','mail.search_messages','mail.read_thread'].includes(o.id));
 const install={...callPins,baseCatalogSha256:selected.pin.catalogSha256,installationId:domain.uid(62),executionCatalogSha256:'a'.repeat(64),operations:installed.map(operation=>({operation,descriptorSha256:canonicalSha256(resolveOperationContract(operation).descriptor),handlerSourceSha256:'b'.repeat(64),qualificationReceiptId:domain.uid(63)})),...stamp()};
 const admission={...callPins,manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,budgets:selected.manifest.budgets,allocationSha256:'c'.repeat(64),policyRevision:context.scopes[0].policyRevision,...stamp()};
 const compileArtifact=async({readSource,input,selection,signal})=>{const compiler=(skillId==='quick_skill.commitments_audit'?createCommitmentsAuditCompiler:createRelationshipBriefCompiler)({readSource,now,defaultCongress:119});state.compiled=await compiler.prepare(input,context,{selection,signal});return state.compiled;};
 const configuration={binding:context.binding,versions,request,scopes:context.scopes,selection,now,
  async readForSkill(){state.installReads++;if(state.revoked)throw Error('synthetic revoked');return structuredClone(install);},async currentSkillRun(){state.runReads++;if(state.revoked)throw Error('synthetic revoked');return structuredClone(admission);},
  gateway:{async execute({operation,arguments:args,signal}){return JSON.stringify(await source.readSource({operation,request:args,binding:context.binding,subject:selection.subject,window:selection.window,signal}));}},compileArtifact};
 return {configuration,state,source,install,admission,selected,context,input:domain.makeInput(),selection,request};
}
