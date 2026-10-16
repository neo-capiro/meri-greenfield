/** Synthetic producer cases reuse existing canonical fixtures; no Core endpoint is contacted. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {resolveOperationContract,validateShape} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPublicDomainDatasetRegistry} from '../../../../packages/contracts/retrieval-0.2/public-domain-registry.mjs';
import {meetingFixture,clientId as meetingClient,endpoints as meetingEndpoints} from '../../sources/meetings/test/fixtures.mjs';
import {clientEvidenceFixture,clientId as evidenceClient,endpoints as evidenceEndpoints,credentialReceipt} from '../../sources/client-evidence/test/fixtures.mjs';
import {createIdentityContactsFixture} from '../../sources/identity-contacts/test/fixtures.mjs';
import {createClientKnowledgeFixture} from '../../sources/client-knowledge/test/fixtures.mjs';
import {fixture,uuid} from '../../test/fixtures.mjs';
import {setup as researchFixture} from '../../test/research-evidence-fixtures.mjs';
import {nativeScopedPage,id as actionId} from '../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
import {retainedCase} from './retained-cases.mjs';
import {billTextCase} from '../../sources/bill-text/test/fixture.mjs';
import {nativeFamilyCase,NATIVE_FAMILY_CASES,DISCLOSURE_FAMILY_CASES} from './native-family-cases.mjs';
export const CASES=Object.freeze([
 ['meeting-source','meeting.list_upcoming_meetings'],['meeting-source','meeting.query_debriefs'],['meeting-source','meeting.read_client_meetings'],
 ['action-items-complete','actions.query'],['operational-reads','query_tasks'],['operational-reads','query_action_items'],
 ['tenant-contacts','find_contacts'],['entity-candidates','resolve_entity'],['client-knowledge-profile','get_client_context'],
 ['client-documents','read_client_documents'],['client-knowledge-memory','search_memory'],['client-knowledge-monday','read_monday_client_boards'],
 ['dataset-metadata','list_global_datasets'],['memory-proposals','memory.list_own_proposals'],['research-portfolio-evidence','get_research_evidence'],
 ['research-portfolio','get_research_portfolio'],['research-portfolio','get_research_portfolio_changes'],['florida-budget','get_florida_budget_project'],
 ['bill-text','search_congress_bills'],['bill-text','read_bill_text'],
 ...NATIVE_FAMILY_CASES,
 ...DISCLOSURE_FAMILY_CASES,
]);
const POLICY='b'.repeat(64);
function policy(value,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
 for(const [k,v] of Object.entries(value))if(k==='policyRevision')value[k]=POLICY;else policy(v,seen);
}
function authority(f,operation){
 return {binding:f.binding,subject:f.subject,claims:f.claims,policyRevision:f.claims.policyRevision,
  decision:{decisionId:f.subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},
   operation:`${operation.id}@${operation.version}`,scopes:f.claims.scopes,policyRevision:f.claims.policyRevision,
   evaluatedAt:new Date(f.state.now).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},
  sourceIds:resolveOperationContract(operation).descriptor.sourceRequirements.map(s=>s.sourceId),deadlineMs:f.state.now+10000};
}
const pins=p=>{const {input,deadlineMs,signal,...rest}=p;return {...structuredClone(rest),bearerToken:'SYNTHETIC',serviceSecret:'SYNTHETIC',expiresAtMs:deadlineMs};};
const response=page=>new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}});
export function familyCase(family,id){
 if(['public-reports','acquisition-personnel','disclosures'].includes(family))return nativeFamilyCase(family,id);
 if(family==='bill-text')return billTextCase(id);
 if(['research-portfolio','florida-budget'].includes(family))return retainedCase(id);
 const operation={id,version:'0.2.0'};let a,args,transport,page;
 if(family==='meeting-source'){
  const f=meetingFixture(operation,{clientId:meetingClient});a=f.authority;args=f.request;page=f.page;
  transport={endpoints:meetingEndpoints,getCredentials:pins,fetchImpl:async()=>response(page)};
 }else if(['client-knowledge-profile','client-documents'].includes(family)){
  const f=clientEvidenceFixture(operation,{clientId:evidenceClient});a=f.authority;args=f.request;page=f.page;
  transport={endpoints:evidenceEndpoints,getCredentials:credentialReceipt,fetchImpl:async()=>response(page)};
 }else if(['tenant-contacts','entity-candidates'].includes(family)){
  const f=createIdentityContactsFixture(id,{linked:id==='find_contacts'});a=f.authority;args=f.args;transport=f.config;
 }else if(['client-knowledge-memory','client-knowledge-monday'].includes(family)){
  const f=createClientKnowledgeFixture(id);a=f.authority;args=f.args;transport=f.config;
 }else if(family==='research-portfolio-evidence'){
  const f=researchFixture();a=authority(f,operation);args=f.raw;transport=f.config;
 }else{
  const f=fixture(),clientId=actionId(9);args={};
  if(['action-items-complete','operational-reads'].includes(family)){
   Object.assign(f.subject,{kind:'client',entityType:'client',entityIds:[clientId]});
   Object.assign(f.claims.scopes[0],{kind:'client',resourceId:clientId});args={clientId};
  }
  if(family==='memory-proposals'){
   Object.assign(f.binding,{tenantId:uuid('a'),actorId:uuid('b')});
   Object.assign(f.subject,{tenantId:f.binding.tenantId,actorId:f.binding.actorId,entityIds:[f.binding.actorId]});
   Object.assign(f.claims.scopes[0],{tenantId:f.binding.tenantId,kind:'private-user',resourceId:f.binding.actorId});
  }
  a=authority(f,operation);
  if(family==='dataset-metadata')transport={registry:createPublicDomainDatasetRegistry({canonicalSha256,validateMetadata:validateShape})};
  else{
   if(family==='action-items-complete')page=nativeScopedPage(args);
   else if(family==='memory-proposals')page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,
    scope:{tenantId:f.binding.tenantId,userId:f.binding.actorId,clientId:null},candidates:[{id:uuid('e'),status:'pending',approvedFact:false,
     scope:'personal',clientId:null,sourceKind:'explicit_user',createdAt:'2026-10-02T00:00:00.000Z',restricted:false,title:'Synthetic proposal',
     proposedText:'Unapproved synthetic text',contentTruncated:false}],nextCursor:null,coverage:{firstPage:true,complete:true,reason:'own_pending_proposals_complete'}};
   else{
    const normalized=resolveOperationContract(operation).normalizeInput(args,{actorId:a.binding.actorId,nowMs:f.state.now}).input,task=id==='query_tasks';
    page={tool:id,generatedAt:new Date(f.state.now).toISOString(),clientId,total:0,returned:0,[task?'tasks':'actions']:[],
     scope:task?{kind:'client',tenantId:a.binding.tenantId,actorUserId:a.binding.actorId,ownerUserId:normalized.ownerUserId,
      taskId:null,status:null,dueBefore:null,offset:0,limit:normalized.limit,cursorApplied:false}:
      {actionItemId:null,status:null,sort:normalized.sort,page:1,limit:normalized.limit,cursorApplied:false},
     coverage:{sourceStatus:'healthy',sourceReason:null,complete:true,partial:false,paginationComplete:true,hasMore:false,nextCursor:null,
      totalIsExactForScope:true,absenceSupported:true,note:'Synthetic native empty-page assertion, not Meri absence evidence.'}};
   }
   transport={origin:'https://source.example.invalid',getCredentials:family==='operational-reads'?pins:async()=>({binding:a.binding,
    bearerToken:'SYNTHETIC',serviceSecret:'SYNTHETIC',expiresAtMs:a.deadlineMs}),fetchImpl:async()=>response(page)};
  }
 }
 policy(a);policy(page);
 const state={now:Date.parse(a.claims.issuedAt)+1000,revoked:false,installRevoked:false},wire=[];
 const {now:ignored,...source}=transport;
 if(source.fetchImpl){const fetch=source.fetchImpl;source.fetchImpl=async(...values)=>{wire.push(values);const result=await fetch(...values);state.afterSource?.();return result;};}
 return {family,operation,authority:a,arguments:args,state,wire,page,now:()=>state.now,
  transport:family==='dataset-metadata'?source:{maxRequestMs:1000,maxResponseBytes:1048576,...source}};
}
