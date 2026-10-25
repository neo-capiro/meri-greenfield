/** Current compiler/transport fixture; the external producer is synthetic. */
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import certification from '../../../packages/contracts/retrieval-0.2/certification-status.schema.json' with {type:'json'};
import sam from '../../../packages/contracts/retrieval-0.2/sam-opportunities.schema.json' with {type:'json'};
import {fixture,uuid} from './reads-native-fixture.mjs';
export const CASES=[['certification-status','get_certification_status'],['rule-status','get_state_rule_status'],['sam-opportunities','search_sam_opportunities']];
export function secondaryScene(id,{personal=false}={}){
 const operation={id,version:'0.2.0'},binding={tenantId:uuid('1'),actorId:uuid('2'),conversationId:uuid('3'),runId:uuid('4'),attemptId:uuid('5'),workerId:uuid('6'),writerFence:1};
 const clientId=uuid('7'),policyRevision='synthetic-policy',scopes=[{tenantId:binding.tenantId,kind:personal?'private-user':'client',resourceId:personal?binding.actorId:clientId,policyRevision}];
 const subject={kind:personal?'personal':'client',entityType:personal?'user':'client',entityIds:[personal?binding.actorId:clientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision,scopes,rosterVersionId:null};
 const args=id==='get_certification_status'?{program:'fedramp',query:'Synthetic'}:id==='get_state_rule_status'?{query:'Synthetic'}:{query:'Synthetic',limit:1};
 const state={now:Date.parse('2026-10-25T00:00:00.000Z'),contexts:[],afterSource:null,responseFactory:null};
 const now=()=>state.now,contract=resolveOperationContract(operation);
 const transport={async fetchImpl(url,options){
  assert.equal(new URL(url).pathname,`/api/clio/tools/${id}`);const request=JSON.parse(options.body);assert.deepEqual(request,args);
  const {context}=decodeNativeReadObservation(options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation,request});state.contexts.push(context);
  const page=secondaryPage(id,context,now());state.afterSource?.();return state.responseFactory?.(page)??Response.json(page);
 }};
 return {binding,operation,authority:{binding,subject},arguments:args,contract,state,now,transport};
}
export function secondaryPage(id,context,at){
 const instant=new Date(at).toISOString();
 if(id==='get_certification_status')return {tool:id,program:'fedramp',searchedEntireDataset:true,found:true,ambiguous:false,record:{program:'fedramp',productId:'FR123',cspName:'Synthetic CSP',csoName:'Synthetic Cloud',status:'FedRAMP Certified',impactLevel:'Moderate',authorizationDate:null,sponsoringAgencies:[],sourceUrl:certification.$defs.CertificationMarketplaceUrl.const,observedAt:instant}};
 if(id==='get_state_rule_status')return {tool:id,generatedAt:instant,found:true,jurisdiction:'federal',id:'synthetic-rule',title:'Synthetic rule',abstract:null,agencyNames:[],ruleType:'NOTICE',stage:'notice',stageLabel:'Notice',publicationDate:new Date(at-86400000).toISOString(),commentPeriod:{start:null,end:new Date(at+86400000).toISOString(),isOpen:true},effectiveDate:null,docketIds:[],sourceUrl:null,linkedBillKeys:[]};
 const row={id:'00000000-0000-0000-0000-000000000001',noticeId:'synthetic-notice',solicitationNumber:null,title:'Synthetic opportunity',noticeType:'synthetic',agency:null,office:null,pscCode:null,naicsCode:null,postedDate:null,responseDeadline:null,description:'',sourceUrl:null,active:true};
 if(context.evidenceAccuracyMode==='enforce')row.deadline={at:null,dateOnly:null,timeZone:null,basis:'unknown',daysRemaining:null,status:'unknown'};
 return {tool:id,generatedAt:context.asOf,total:1,sourceFreshness:[],sourceStatus:'unknown',sourceReason:'source_freshness_unavailable',notes:sam.$defs.SamOpportunitiesOutput.properties.notes.enum[1],results:[row]};
}
export const secondaryFixture=(family,id,options={})=>fixture(family,id,{...options,scene:secondaryScene(id,options)});
