/** Synthetic native HTTP DTOs and credential ports. Dates cross actual Response JSON bytes; no backend/provider. */
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {decodeBillTextCursor} from '../../../../../packages/contracts/retrieval-0.2/bill-text-cursor.mjs';
import {fixture,uuid} from '../../../test/fixtures.mjs';
export const origin='https://native-core.example.invalid';
export const cursor=(billId,offset)=>Buffer.from(JSON.stringify([billId,'ih',uuid('a'),'a'.repeat(64),offset])).toString('base64url');
export function billTextCase(id='read_bill_text',{defaultCongress=119,request}={}){
 const f=fixture(),operation={id,version:'0.2.0'},contract=resolveOperationContract(operation),policyRevision='b'.repeat(64),scope={...f.claims.scopes[0],policyRevision};
 const claims={...f.claims,policyRevision,scopes:[scope],budgets:{...f.claims.budgets,maxOutputBytes:1048576}},subject={...f.subject,policyRevision,scopes:[scope]};
 const state={now:f.state.now,revoked:false,installRevoked:false,total:12},now=()=>state.now,normalizationContext={defaultCongress};
 const authority={binding:f.binding,claims,subject,policyRevision,decision:{decisionId:subject.authorizationDecisionId,actor:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},
  operation:`${id}@0.2.0`,scopes:[scope],policyRevision,evaluatedAt:new Date(now()).toISOString(),decision:'allowed',reasonCode:'SYNTHETIC_ONLY'},
  sourceIds:[...new Set(contract.descriptor.sourceRequirements.map(source=>source.sourceId))],deadlineMs:now()+10000};
 const args=request??(id==='read_bill_text'?{billId:'H.R. 1'}:{query:'H.R. 1'}),wire=[],credentialCalls=[];
 function rawBill(billId){return {id:billId,congress:Number(billId.split('-')[0]),billType:'hr',billNumber:'1',title:'Synthetic stored bill',introducedDate:null,sponsorName:null,sponsorState:null,sponsorParty:null,sponsorBioguideId:null,latestActionText:null,latestActionDate:null,policyArea:null,subjects:[],peCodes:[],committees:{opaque:true},cosponsorsCount:0,originChamber:null,updateDate:null,updateDateIncludingText:null,status:null,statusAt:null,url:null,lastSyncedAt:new Date(now())};}
 function native(input){
  const billId=id==='read_bill_text'?input.billId:/^\d+-hr-\d+$/.test(input.query??'')?input.query:`${defaultCongress}-hr-1`;
  if(id==='search_congress_bills'){
   if(input.textQuery)return {tool:id,generatedAt:new Date(now()),mode:'bill_text',textQuery:input.textQuery,results:[{billId,title:null,versionCode:'ih',passages:[{snippet:'Synthetic «minerals» passage',startOffset:0,readCursor:null}]}],total:1,totalBills:1,page:input.page,perPage:input.limit,hasMore:false,note:'Bills whose stored text matches, best first, with matching passages (« » marks the match). Read a passage in context with read_bill_text and its readCursor. Stored text covers 119th-Congress bills. 1 bill match in all.'};
   const direct=/^\d+-hr-\d+$/.test(input.query??'');return {tool:id,generatedAt:new Date(now()),data:[rawBill(billId)],total:1,page:direct?1:input.page,limit:input.limit,...(direct?{resolvedBy:'bill-id'}:{})};
  }
  if(state.unavailable)return {tool:id,authoritativeOwner:'federal_evidence_current',currentStatus:'unavailable',billId,requestedVersionCode:input.versionCode??null,found:false,coverage:{complete:true,truncated:false,nextCursor:null},note:input.versionCode?`No current complete bill-text revision ${input.versionCode} is available for ${billId}.`:`No current complete bill-text revision is available for ${billId}.`};
  const start=input.cursor?decodeBillTextCursor(input.cursor).offset:0,end=Math.min(state.total,start+9000),more=end<state.total;
  const base={tool:id,authoritativeOwner:'federal_evidence_current',currentStatus:'available',found:true,billId,versionCode:'ih',revisionId:uuid('a'),packageId:'synthetic-package',provider:'synthetic-provider',lineageKey:'synthetic-lineage',versionHash:'b'.repeat(64),textHash:'a'.repeat(64),sourceLocator:'https://evidence.example.invalid/text',sourceModifiedAt:null,publishedAt:new Date(now()),fetchedAt:new Date(now()),text:'x'.repeat(end-start),trust:'external_untrusted',coverage:{locator:{offset:start,endOffset:end},totalCharacters:state.total,pageComplete:true,contentComplete:!more&&start===0,paginationComplete:!more,complete:true,truncated:more||start>0,nextCursor:more?cursor(billId,end):null},note:'This is exact bill-version text from the current federal evidence owner. It is not amendment text or bill status.'};
  if(input.query){const length=Math.min(state.total,1000);return {...base,query:input.query,queryParts:[input.query.toLowerCase()],totalHits:1,passages:[{heading:null,startOffset:0,endOffset:length,matchedTerms:[input.query.toLowerCase()],readCursor:null}],text:`[Text | characters 0-${length}]\n`+'x'.repeat(length),coverage:{locator:{query:input.query},totalCharacters:state.total,pageComplete:true,contentComplete:false,paginationComplete:false,complete:false,truncated:true,nextCursor:null},note:'Excerpts of the exact bill-version text that match the query, best first by section order. Read on from a passage with read_bill_text and its readCursor before relying on surrounding context.'};}
  return base;
 }
 const transport={origin,now,maxRequestMs:1000,maxResponseBytes:1048576,async getCredentials(pins){credentialCalls.push(pins);const {input,deadlineMs,signal,...proof}=pins;
  const receipt={...structuredClone(proof),bearerToken:'SYNTHETIC_NATIVE_USER',serviceSecret:'SYNTHETIC_INTERNAL_SERVICE',expiresAtMs:deadlineMs};state.credentialMutator?.(receipt);return receipt;},
  async fetchImpl(url,options){const body=JSON.parse(options.body);wire.push({url,options,body});const value=native(body);state.nativeValue=value;state.resultMutator?.(value);state.afterSource?.();return state.responseFactory?state.responseFactory(value):new Response(JSON.stringify(value),{headers:{'content-type':'application/json'}});}};
 const call=(request=args,current=authority,context=normalizationContext)=>{const normalized=contract.normalizeInput(request,context);return {input:normalized.input,request,authority:current,argumentsSha256:normalized.argumentsSha256,normalizationContext:context};};
 return {family:'bill-text',operation,contract,authority,binding:f.binding,claims,subject,state,now,normalizationContext,arguments:args,transport,wire,credentialCalls,call,native};
}
