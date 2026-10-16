/** Synthetic source-shaped bytes and echo broker only; no native role/principal qualification. */
import {fixture} from '../../../test/fixtures.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createAcquisitionPersonnelHandlers} from '../handler.mjs';
export const personId='abcdefab-1234-0000-0000-000000000001';
export const operationIds=['search_acquisition_personnel','get_acquisition_person'];
export function acquisitionFixture(id=operationIds[0],{actorRole='standard_user',request=id===operationIds[0]?{}:{id:personId}}={}){
 const f=fixture(),operation={id,version:'0.2.0'},policyRevision='b'.repeat(64),scope={...f.claims.scopes[0],policyRevision};
 f.claims.policyRevision=policyRevision;f.claims.scopes=[scope];Object.assign(f.subject,{policyRevision,scopes:[scope]});
 const state={now:f.state.now,credentials:0,fetches:0},now=()=>state.now,at=new Date(now()).toISOString();
 const contract=resolveOperationContract(operation),normalizationContext={actorRole},normalized=contract.normalizeInput(request,normalizationContext);
 const authority={binding:f.binding,subject:f.subject,claims:f.claims,policyRevision,sourceIds:[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))],deadlineMs:now()+1000,
  decision:{decisionId:f.subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},operation:`${id}@0.2.0`,scopes:[scope],policyRevision,evaluatedAt:at,decision:'allowed',reasonCode:'SYNTHETIC_ONLY'}};
 const common={id:personId,fullName:'Synthetic Person',service:null,organization:null,title:null,role:null,pePrimary:null,peSecondary:[],emailDomain:null,publicProfileUrl:null,confidence:0.5,status:'unclassified',firstSeenAt:at,lastSeenAt:at,email:null,phone:null,parentOffice:null,department:null};
 const result=id===operationIds[0]?{tool:id,generatedAt:at,data:[{...common,headshotUrl:{untrusted:true},sourceCount:2}],total:1,page:normalized.input.page,limit:normalized.input.limit}:
  {tool:id,generatedAt:at,person:{...common,nameKey:'synthetic person',programOfRecord:null,metadata:{},sources:[{id:'00000000-0000-0000-0000-000000000001',source:'synthetic',sourceUrl:null,snippet:null,observedAt:at,confidence:0.5,metadata:{opaque:'retained'}}]}};
 const call={input:normalized.input,request,authority,normalizationContext,argumentsSha256:normalized.argumentsSha256};
 const configuration={origin:'https://core.example.invalid',now,maxRequestMs:250,maxResponseBytes:65536,
  async getCredentials(p){state.credentials++;state.proof=p;const {input,deadlineMs,signal,...proof}=p;
   const r={...proof,bearerToken:'SYNTHETIC_USER',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:deadlineMs};state.mutateCredentials?.(r);return r;},
  async fetchImpl(url,options){state.fetches++;state.wire={url,options};state.afterFetch?.();
   if(state.response)return state.response();return new Response(JSON.stringify(result),{status:state.status??200,headers:{'content-type':'application/json',...state.headers}});}};
 const handler=(changes={})=>createAcquisitionPersonnelHandlers({...configuration,...changes},[operation])[0].execute;
 return {operation,contract,request,normalizationContext,normalized,authority,result,call,state,now,configuration,handler};
}
