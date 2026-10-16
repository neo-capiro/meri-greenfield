/** Synthetic Core-shaped producer and proposed trusted ports. No credential issuer or service is called. */
import {fixture,uuid} from '../../test/fixtures.mjs';
import {resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
export const portfolioId=uuid('a'),clientId=uuid('9');
export function retainedCase(id){
 const f=fixture(),operation={id,version:'0.2.0'},florida=id==='get_florida_budget_project';
 const policyRevision='b'.repeat(64),scope={...f.claims.scopes[0],policyRevision};
 f.claims.policyRevision=policyRevision;f.claims.scopes=[scope];
 Object.assign(f.subject,{policyRevision,scopes:[scope],...(florida?{}:{kind:'entity',entityType:'research-portfolio',entityIds:[portfolioId]})});
 const state={now:f.state.now,revoked:false,installRevoked:false,contextReads:0},now=()=>state.now,at=new Date(now()).toISOString();
 const authority={binding:f.binding,claims:f.claims,subject:f.subject,policyRevision,
  decision:{decisionId:f.subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},operation:`${id}@0.2.0`,
   scopes:[scope],policyRevision,evaluatedAt:at,decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},
  sourceIds:[...new Set(resolveOperationContract(operation).descriptor.sourceRequirements.map(s=>s.sourceId))],deadlineMs:now()+10000};
 const args={},wire=[],page=florida?{tool:id,generatedAt:at,authority:'Core retained source notice',result:{
  scope:{jurisdiction:'FL',sessionKey:'',folderId:null,clientId:null},fiscalYear:'2026-27',projects:[],nextOffset:null,
  documents:[],amounts:[],events:[],notice:'Core retained evidence notice'}}:
  id==='get_research_portfolio_changes'?{items:[{id:'event-z',eventKind:'updated',aggregateRevision:1,actorUserId:'previous-actor',occurredAt:at,
   payload:{claim:'Synthetic retained text'},state:{eventId:'event-z',recipientUserId:f.binding.actorId,revision:1,seenAt:null,acknowledgedAt:null,dismissedAt:null,updatedAt:at}}],nextCursor:null}:
  {id:portfolioId,name:'Synthetic portfolio',purpose:null,mode:'manual',lifecycle:'archived',revision:3,ownerUserId:f.binding.actorId,
   memberCount:0,clientLinkCount:0,myRole:'viewer',archivedAt:at,createdAt:at,updatedAt:at,
   grants:[{id:'grant-reader',principalType:'user',principalUserId:f.binding.actorId,role:'viewer',grantedByUserId:'previous-owner',createdAt:at,updatedAt:at}],
   clientLinks:[],members:[],recentEvents:[]};
 const retainedContextPorts={async readCurrent(p){state.contextReads++;
  const {request,observationAt,deadlineMs,signal,...proof}=p;
  const context=florida?{asOf:observationAt,effectiveScope:{jurisdiction:'FL',sessionKey:request.sessionKey??'',folderId:request.folderId||null,
   clientId:request.clientId?clientId:request.folderId?state.folderClient??null:null},
   clientResolution:request.clientId?{selector:request.clientId.trim().slice(0,80),clientId}:null}:{binding:p.binding,subject:p.subject};
  const receipt={...proof,context,checkedAtMs:now(),expiresAtMs:deadlineMs};state.contextMutator?.(receipt,state.contextReads);
  return JSON.stringify(receipt);}};
 const transport={origin:'https://core.example.invalid',maxRequestMs:1000,maxResponseBytes:1048576,
  async getCredentials(p){const {input,deadlineMs,signal,...proof}=p;
   const r={...proof,bearerToken:'SYNTHETIC_USER',expiresAtMs:deadlineMs,...(florida?{serviceSecret:'SYNTHETIC_SERVICE'}:{})};
   state.brokerMutator?.(r);return r;},
  async fetchImpl(url,options){wire.push([url,options]);state.afterSource?.();return new Response(JSON.stringify(page),{
   status:state.httpStatus??200,headers:{'content-type':'application/json',...(state.responseHeaders??{})}});}};
 return {family:florida?'florida-budget':'research-portfolio',operation,authority,arguments:args,state,wire,page,now,transport,retainedContextPorts};
}
