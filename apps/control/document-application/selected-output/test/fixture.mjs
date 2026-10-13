/** Actual artifact/session/accounting owners with clearly synthetic separate approval/current evidence callbacks. */
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createLocalDocumentFixture} from '../../local/fixture.mjs';
import {createActionSessionApplication} from '../../../action-host/session/http.mjs';
import {createCommitmentsAuditCompiler} from '../../commitments-audit/compose.mjs';
import {createRelationshipBriefCompiler} from '../../relationship-brief/compose.mjs';
import * as commitments from '../../commitments-audit/test/fixtures.mjs';
import * as relationships from '../../relationship-brief/test/fixtures.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createSelectedOutputBridge} from '../bridge.mjs';
export const pythonExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3',sofficeExecutable='/opt/codex/runtimes/codex-primary-runtime/dependencies/bin/override/soffice';
export const uid=n=>`72000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function bridgeFixture(skillId='quick_skill.commitments_audit'){
 process.env.MERI_REVIEW_SOURCE_ROOT=fileURLToPath(new URL('../../../../../',import.meta.url));
 const domain=skillId==='quick_skill.commitments_audit'?commitments:relationships,manifest=structuredClone(selectSkill('quick_skill.mail_history','1.0.0').manifest);
 // Explicit synthetic output allocation, never the immutable selected original admission.
 manifest.prose={id:'urn:meri:synthetic:separate-approved-output-fixture',sha256:'d'.repeat(64)};manifest.allowedOperations=[{id:'create_word',version:'0.2.0'}];manifest.requiredSources=[{sourceId:'artifact_store',authority:'authoritative',purpose:'evidence'}];
 const output=await createLocalDocumentFixture({mode:'synthetic-local',pythonExecutable,mailboxIds:[domain.mailboxId],skillManifest:manifest,identityIds:{tenantId:uid(20),actorId:uid(21)}});
 const sourceBinding={...output.artifactOptions.context.binding,runId:uid(1),attemptId:uid(2),workerId:uid(3)},sourceContext={...structuredClone(output.artifactOptions.context),binding:sourceBinding};
 const selection=skillId==='quick_skill.commitments_audit'?domain.selection(sourceContext):domain.selected(sourceContext),input=domain.makeInput(new Date(output.now()).toISOString());
 const state={approved:true,revokedSource:false,receiptMutator:null,accessMutator:null,accessPhases:[],readCalls:[],sourceReads:[],credential:null};
 const issuance=createActionSessionApplication({owner:output.sessions,now:output.now,maxRequestMs:3000}),issued=await issuance.handle(new Request('https://meri.invalid/api/action-followthrough/session',{method:'POST',headers:{authorization:'Bearer '+output.nativeCredential,'content-type':'application/json'},body:'{}'}));state.credential=(await issued.json()).credential;
 const compiler=(skillId==='quick_skill.commitments_audit'?createCommitmentsAuditCompiler:createRelationshipBriefCompiler)({now:output.now,defaultCongress:119,async readSource(call){if(['query_tasks','query_action_items'].includes(call.operation.id))throw Object.assign(Error('UNAVAILABLE'),{code:'UNAVAILABLE'});const raw=domain.sourcePage(call);state.sourceReads.push({operation:call.operation,request:call.request,result:raw,resultSha256:canonicalSha256(raw)});return raw;},async readBase({versionId}){return output.artifactOptions.versions.read(versionId);}});
 const prepare=(nextInput=input,base)=>compiler.prepare(nextInput,sourceContext,{selection,...(base?{base}:{})});
 const approvedOutput={async read({sourcePins}){if(!state.approved)return null;state.readCalls.push(sourcePins);const receipt={sourcePinsSha256:canonicalSha256(sourcePins),outputBinding:output.artifactOptions.context.binding,scopes:sourceContext.scopes,policyRevision:sourceContext.scopes[0].policyRevision,allocationSha256:canonicalSha256(output.ledger.allocation),grantId:output.ledger.invocation.grantId,approvalReceiptId:uid(4),projectionRecipe:'original-selected-docx/1',deadlineMs:output.artifactOptions.context.deadlineMs,maxBytes:1048576,checkedAtMs:output.now(),expiresAtMs:output.artifactOptions.context.deadlineMs};state.receiptMutator?.(receipt);return {receipt,sessionCredential:state.credential,documentOptions:{sessions:output.sessions,selectedClientId:output.selectedClientId,artifactOptions:output.artifactOptions,credential:output.credential,now:output.now,limits:output.limits,enabled:true}};}};
 const sourceAccess={async check({phase,sourcePins,outputBinding,evidence}){state.accessPhases.push(phase);if(state.revokedSource)throw Error('CURRENT_SOURCE_REVOKED');const receipt={sourceBinding,outputBinding,sourcePinsSha256:canonicalSha256(sourcePins),evidenceSha256:canonicalSha256(evidence),scopes:sourceContext.scopes,policyRevision:sourceContext.scopes[0].policyRevision,accessReceiptId:randomUUID(),checkedAtMs:output.now(),expiresAtMs:output.artifactOptions.context.deadlineMs};state.accessMutator?.(receipt,phase);return receipt;}};
 const bridge=createSelectedOutputBridge({approvedOutput,sourceAccess,now:output.now});
 const deliver=prepared=>bridge.deliver({prepared,binding:sourceBinding,requestSha256:'e'.repeat(64),selectionSha256:canonicalSha256(selection),inputSha256:prepared.provenance.inputSha256,preparationSha256:canonicalSha256(prepared),reads:prepared.reads??prepared.receipts});
 return {output,state,compiler,prepare,deliver,sourceBinding,sourceContext,selection,input,bridge,approvedOutput,sourceAccess,async close(){await output.close();}};
}
