/** Shared finite admission of original-skill native reads. No synthetic EvidenceEnvelope. */
import {assertSubject,assertWindow,resolveOperationContract} from '../../contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash,validateShape} from '../../contracts/validate.mjs';
import {data,own} from '../../contracts/commands-0.2/execution-boundary.mjs';
import {selectSkill} from '../index.mjs';
import {materialSections} from './material-records.mjs';
import {aggregateMaterial,same,fail} from './record-pages.mjs';
const stable=subject=>{const {authorizationDecisionId,...rest}=subject;return rest;};
function contextValue(raw,asset){const c=data(own(raw,['binding','subject','window','asOf','mondayBoardIds']));validateShape('RunBinding',c.binding);assertSubject(c.subject,c.binding);assertWindow(c.window);
 if(!asset.manifest.subjectKinds.includes(c.subject.kind)||!asset.manifest.windowBases.includes(c.window.basis)||typeof c.asOf!=='string'||!Number.isFinite(Date.parse(c.asOf))||new Date(c.asOf).toISOString()!==c.asOf||!Array.isArray(c.mondayBoardIds)||c.mondayBoardIds.length>100||new Set(c.mondayBoardIds).size!==c.mondayBoardIds.length||c.mondayBoardIds.some(x=>typeof x!=='string'||!x))fail('WORKFLOW_CONTEXT_REFUSED');return c;}
export function bindWorkflowReads(rawContext,rawReceipts,identity){
 const asset=selectSkill(identity.skillId,identity.skillVersion);if(!['quick_skill.commitments_audit','quick_skill.relationship_brief'].includes(asset.pin.skillId))fail('WORKFLOW_SKILL_REFUSED');
 const context=contextValue(rawContext,asset),receipts=data(rawReceipts);if(!Array.isArray(receipts)||receipts.length>asset.manifest.budgets.maxToolCalls)fail('WORKFLOW_READ_BUDGET');
 const sections=[],coverage=new Map();
 for(const raw of receipts){const r=own(raw,['operation','request','normalizationContext','result','resultSha256']);if(hash(r.result)!==r.resultSha256||!asset.manifest.allowedOperations.some(op=>same(op,r.operation)))fail('WORKFLOW_RECEIPT_REFUSED');
  const contract=resolveOperationContract(r.operation),normalized=contract.normalizeInput(r.request,r.normalizationContext),sourceId=contract.descriptor.sourceRequirements[0]?.sourceId;
  if(contract.descriptor.sourceRequirements.length!==1||!asset.manifest.requiredSources.some(s=>s.sourceId===sourceId))fail('WORKFLOW_SOURCE_REFUSED');
  const rawResult=r.result,wrapped=Object.hasOwn(rawResult,'result');let result=rawResult,subject=rawResult.subject;
  if(wrapped){own(rawResult,['binding','subject','operation','argumentsSha256','result']);if(!same(rawResult.operation,r.operation)||rawResult.argumentsSha256!==normalized.argumentsSha256)fail('WORKFLOW_REQUEST_BINDING');result=rawResult.result;}
  if(!same(rawResult.binding,context.binding)||!subject||!same(stable(subject),stable(context.subject)))fail('WORKFLOW_READ_BINDING');assertSubject(subject,context.binding);
  contract.assertOutput(result,{request:r.request,...r.normalizationContext});
  if(result.operation&&!same(result.operation,r.operation)||result.argumentsSha256!==undefined&&result.argumentsSha256!==normalized.argumentsSha256)fail('WORKFLOW_REQUEST_BINDING');
  const sourceWindow=result.window??null,windowMatch=sourceWindow===null?'native-window-undeclared':same(sourceWindow,context.window)?'exact':sourceWindow.basis==='unbounded'?'broad-native-read':'refused';
  if(windowMatch==='refused')fail('WORKFLOW_WINDOW_REFUSED');
  const payload=result.data??result,source=result.sources?.[0]??{sourceId,authority:contract.descriptor.sourceRequirements[0].authority,status:'partial',freshness:'unknown',asOf:null,retrievedAt:payload.generatedAt??null,snapshotVersionId:null,observationBasis:payload.generatedAt?'native-generated-at':'unknown'};
  if(source.sourceId!==sourceId||source.authority!==contract.descriptor.sourceRequirements[0].authority||source.retrievedAt!==null&&(!Number.isFinite(Date.parse(source.retrievedAt))||Date.parse(source.retrievedAt)>Date.parse(context.asOf)+asset.manifest.budgets.maxRuntimeSeconds*1000))fail('WORKFLOW_SOURCE_BINDING');
  if(payload.clientId!==undefined&&payload.clientId!==null&&!context.subject.scopes.some(s=>s.kind==='client'&&s.resourceId===payload.clientId))fail('WORKFLOW_CLIENT_SCOPE');
  if(sourceId==='client_knowledge_monday'&&(payload.records??[]).some(row=>!context.mondayBoardIds.includes(row.provenance?.boardId)||row.payload?.sourceActorUserId!==context.binding.actorId||!context.subject.scopes.some(s=>s.kind==='client'&&s.resourceId===row.payload?.clientId)))fail('WORKFLOW_MONDAY_SCOPE');
  const cell=coverage.get(sourceId)??{sourceId,authority:source.authority,status:'partial',freshness:source.freshness??'unknown',asOf:source.asOf??null,retrievedAt:source.retrievedAt,snapshotVersionId:source.snapshotVersionId??null,enumeration:'unknown',returnedCount:0,complete:false,limitations:[],continuation:{cursor:null,requiredReads:[],remainingSources:[]},operations:[],sourceWindows:[],selectedWindow:context.window,windowMatch};
  const cover=result.coverage??payload.coverage??{},continuation=result.continuation??{cursor:cover.nextCursor??null,requiredReads:[],remainingSources:[]};
  cell.operations.push(r.operation);cell.returnedCount+=cover.returnedCount??cover.returned??result.returned??result.count??0;cell.retrievedAt=source.retrievedAt;cell.sourceWindows.push(sourceWindow);cell.continuation=structuredClone(continuation);
  cell.limitations.push(...(cover.limitations??[]),'Native read coverage and metadata do not verify semantic conclusions or exhaustive history.');if(windowMatch!=='exact')cell.limitations.push('Native window differs or is undeclared; coverage is not evidence of complete selected-window enumeration.');
  coverage.set(sourceId,cell);
  if(source.retrievedAt!==null)for(const s of materialSections(result,sourceId,subject))sections.push({...s,source,authorizationDecisionId:subject.authorizationDecisionId,receiptSha256:r.resultSha256});
 }
 const {records,incomplete}=aggregateMaterial(sections,context);
 for(const value of incomplete){const cell=coverage.get(value.sourceId);cell?.limitations.push(`Decisive body remains incomplete: ${value.recordId} (${value.reason}).`);cell?.continuation.requiredReads.push(value.recordId);}
 const cells=asset.manifest.requiredSources.map(required=>{const cell=coverage.get(required.sourceId)??{sourceId:required.sourceId,authority:required.authority,status:required.sourceId==='client_knowledge_monday'&&!context.mondayBoardIds.length?'not-mapped':'not-read',freshness:'unknown',asOf:null,retrievedAt:null,snapshotVersionId:null,enumeration:'unknown',returnedCount:0,limitations:['Required source has no admitted decisive read.'],continuation:{cursor:null,requiredReads:[],remainingSources:[required.sourceId]},complete:false,operations:[],sourceWindows:[],selectedWindow:context.window,windowMatch:'not-read'};cell.limitations=[...new Set(cell.limitations)];return cell;});
 return {context,records,coverage:cells,receipts,incomplete};
}
