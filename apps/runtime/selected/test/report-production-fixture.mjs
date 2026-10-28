/** Synthetic Core transport for the production report lane: the real gateway dispatch
 * (`createToolDispatch`) over the real bill-text and federal-legislation handlers, the real
 * selected-runtime request shape, and the report's own congressional subject.
 * No provider, Core, database, credential or renderer call is made. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createHash} from 'node:crypto';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {createExecutionBinding} from '../../../control/conversations/execution-boundary.mjs';
import {reportSkillPin} from '../../../control/document-application/report-brief/skill.mjs';
import {createToolDispatch} from '../../../gateway/dispatch/tool-dispatch.mjs';
import {billTextCase} from '../../../gateway/sources/bill-text/test/fixture.mjs';
import {createBillTextHandlers} from '../../../gateway/sources/bill-text/handler.mjs';
import {storedCase} from '../../../gateway/sources/federal-legislation/test/fixture.mjs';
import {createFederalLegislationHandlers} from '../../../gateway/sources/federal-legislation/handler.mjs';
const uid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const REPORT_NOW=Date.parse('2026-10-13T18:00:00.000Z');
export const REPORT_STAMP=new Date(REPORT_NOW).toISOString();
export const REPORT_REVISION=`${'a'.repeat(8)}-${'a'.repeat(4)}-4${'a'.repeat(3)}-8${'a'.repeat(3)}-${'a'.repeat(12)}`;
export const REPORT_POLICY='report-policy-1';
export const REPORT_SUBJECT={congress:119,session:2,billId:'119-s-88',billVersion:'is',fiscalYear:2028,budgetStage:'authorized'};
export const REPORT_TEXTS={bill_text:'Original independent source: appropriations research requires an authorization review. No appropriation amount is stated.',
 federal_legislation:'Independent status source: the enacted stage has not been established.'};
/** Synthetic bill-text pages over one pinned revision: each page carries the exact document slice. */
function billTextSource({bill,text}){
 const scene=billTextCase('read_bill_text',{defaultCongress:bill.congress,request:{billId:bill.billId}});
 const textHash=createHash('sha256').update(text,'utf8').digest('hex');
 scene.state.total=text.length;
 const cursor=offset=>Buffer.from(JSON.stringify([bill.billId,bill.billVersion,REPORT_REVISION,textHash,offset])).toString('base64url');
 scene.state.resultMutator=value=>{
  if(value.currentStatus!=='available')return;
  const {offset,endOffset}=value.coverage.locator;
  value.text=text.slice(offset,endOffset);value.versionCode=bill.billVersion;value.revisionId=REPORT_REVISION;value.textHash=textHash;
  if(value.coverage.nextCursor!==null)value.coverage.nextCursor=cursor(endOffset);
 };
 return scene;
}
/** One trusted read lane: the real dispatch, real handlers and synthetic CONTROL context receipts. */
export function reportGateway({binding,selection,bill,text,clock=()=>REPORT_NOW}){
 const now=clock,scenes=[billTextSource({bill,text}),storedCase('get_bill_status',{defaultCongress:bill.congress,request:{billId:bill.billId}})];
 const handlers=[createBillTextHandlers({...scenes[0].transport,now:scenes[0].now},[scenes[0].operation])[0],
  createFederalLegislationHandlers({...scenes[1].transport,now:scenes[1].now},[scenes[1].operation])[0]];
 const entries=new Map(scenes.map((scene,index)=>{const contract=resolveOperationContract(scene.operation);
  return [scene.operation.id,{contract,descriptor:contract.descriptor,execute:call=>handlers[index].execute(call)}];}));
 const state={reads:0,wire:[],released:0};
 // The trusted control identity and read context the gateway resolves for itself; a caller never supplies them.
 const {versions:identityVersions,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:'report-production-lane'},
  expiresAtMs:now()+60000,runtimeSessionId:'synthetic-report-source-'+hash(binding).slice(0,32)});
 const executionSha256=hash(execution);
 const identity=Object.freeze({execution,executionSha256,scopes:selection.subject.scopes,policyRevision:selection.subject.policyRevision});
 const contextFor=({entry})=>({binding,subject:selection.subject,executionSha256,
  policyRevision:selection.subject.policyRevision,scopes:selection.subject.scopes,
  sourceIds:[...new Set(entry.descriptor.sourceRequirements.map(source=>source.sourceId))],deadlineMs:now()+60000,maxOutputBytes:1<<20});
 const dispatch=createToolDispatch({catalog:{entry:operation=>entries.get(operation.id)??null,discoverable:()=>[]},
  current:()=>structuredClone(identity),
  contextFor,now,newId:()=>binding.workerId,sourceEnabled:true,defaultCongress:bill.congress,
  limits:{maxRequestBytes:65536,maxResponseBytes:1<<20,maxRequestMs:1500},
  nativeReadContextPorts:{async readCurrent(proof){state.released++;
   // The receipt echoes exactly the trusted proof the dispatcher sent, plus the read context.
   return JSON.stringify({binding:proof.binding,subject:proof.subject,operation:proof.operation,
    requestSha256:proof.requestSha256,policyRevision:proof.policyRevision,sourceIds:proof.sourceIds,
    context:{defaultCongress:bill.congress},checkedAtMs:now(),expiresAtMs:now()+60000});}}});
 return {state,scenes,entries,
  /** The exact port the selected runtime's gateway owner calls; the reply stays Core's own bytes. */
  async execute({operation,arguments:args,signal}){state.reads++;
   const wire=await dispatch.execute(JSON.stringify({operation,arguments:args}),signal);
   state.wire.push({operation,arguments:args,wire});return wire;}};
}
/** The exact run binding a lane uses; a revision is another attempt of the same conversation. */
export function reportRunBinding({runId=uid(42),attemptId=uid(43)}={}){
 return {tenantId:'synthetic-report-tenant',actorId:'synthetic-report-actor',conversationId:uid(41),runId,attemptId,workerId:uid(44),writerFence:1};
}
/** The lane `compositionFixture` consumes: canonical selection, run request and gateway. */
export function reportRuntimeFixture({documentRevision=null,text=REPORT_TEXTS.bill_text,run={}}={}){
 const binding=reportRunBinding(run);
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:uid(31),policyRevision:REPORT_POLICY}];
 const selection={subject:{kind:'client',entityType:'client',entityIds:[uid(31)],tenantId:binding.tenantId,actorId:binding.actorId,
   policyRevision:REPORT_POLICY,scopes,rosterVersionId:null},
  window:{basis:'explicit',startInclusive:'2026-10-13T17:00:00.000Z',endExclusive:'2026-10-13T19:00:00.000Z',timezone:'UTC',weekStartsOn:null},
  mondayBoardIds:[]};
 const selected=selectSkill('quick_skill.bill_watch','2.0.0'),gateway=reportGateway({binding,selection,bill:REPORT_SUBJECT,text});
 const request={requestId:uid(61),prompt:'Independent sourced cited report',skill:reportSkillPin(),window:selection.window,windowRequest:null,
  ...(documentRevision===null?{}:{documentRevision})};
 const installed=selected.manifest.allowedOperations.filter(ref=>['read_bill_text','get_bill_status'].includes(ref.id));
 const configuration={binding,versions,request,scopes,selection,now:()=>REPORT_NOW,gateway,
  async readForSkill(){return {installationId:uid(51),baseCatalogSha256:selected.installationCatalogSha256,
   executionCatalogSha256:'a'.repeat(64),operations:installed,checkedAtMs:REPORT_NOW,expiresAtMs:REPORT_NOW+60000};},
  async currentSkillRun(){return {manifestSha256:selected.pin.manifestSha256,catalogSha256:selected.pin.catalogSha256,
   budgets:selected.manifest.budgets,policyRevision:REPORT_POLICY,checkedAtMs:REPORT_NOW,expiresAtMs:REPORT_NOW+60000};}};
 return {configuration,state:gateway.state,gateway,selected,context:{binding,scopes,evidence:[],assets:[],
   deadlineMs:REPORT_NOW+60000,maxBytes:1<<20},selection,request,binding,scopes,bill:REPORT_SUBJECT,text,
  install:{installationId:uid(51),executionCatalogSha256:'a'.repeat(64),
   baseCatalogSha256:selected.installationCatalogSha256,operations:installed},uid};
}
