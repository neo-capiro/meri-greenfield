/** Explicit synthetic canonical decisive reads; never source/native qualification. */
import {createHash} from 'node:crypto';
import {selectSkill} from '../index.mjs';
const id=n=>`70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const asOf='2026-10-13T12:00:00.000Z';
export const sha=text=>createHash('sha256').update(Buffer.from(text)).digest('hex');
export const texts={mail:'We will send the draft memo. Perhaps also prepare a slide deck.',meetings:'The draft memo is owned by Ana and due on October 20.',client_documents:'The memo was reportedly delivered; receipt is not confirmed.',tasks:'Native task 7 is marked completed. This flag does not establish delivery or acceptance.',action_recommendation:'Recommendation: prepare the draft memo. This is not an accepted task.',client_knowledge_monday:'Board mapped-client-board has an in-progress memo item.'};
export function fixture(){
 const binding={tenantId:'synthetic-skills',actorId:'skills-reviewer',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:id(9),policyRevision:'skills-policy-1'}];
 const subject={kind:'client',entityType:'client',entityIds:[id(9)],tenantId:binding.tenantId,actorId:binding.actorId,authorizationDecisionId:id(10),policyRevision:'skills-policy-1',scopes,rosterVersionId:null};
 const context={binding,subject,window:{basis:'unbounded'},asOf,mondayBoardIds:['mapped-client-board']},manifest=selectSkill('quick_skill.commitments_audit','1.0.0').manifest;
 const sources=manifest.requiredSources.map(row=>row.sourceId);
 const reads=sources.map((sourceId,i)=>{
  const source=manifest.requiredSources.find(row=>row.sourceId===sourceId),content=texts[sourceId];
  const operation=manifest.allowedOperations.find(ref=>({mail:'mail.read_thread',meetings:'meeting.read_client_meetings',client_documents:'read_client_documents',tasks:'query_tasks',action_recommendation:'query_action_items',client_knowledge_monday:'read_monday_client_boards'})[sourceId]===ref.id);
  return {contractVersion:'0.2.0',requestId:id(20+i),traceId:id(30+i),operation,binding:structuredClone(binding),subject:structuredClone(subject),window:{basis:'unbounded'},argumentsSha256:'a'.repeat(64),
   appliedFilters:sourceId==='client_knowledge_monday'?[{name:'board_ids',valueSha256:sha(JSON.stringify(['mapped-client-board']))}]:[],method:'source-read',status:'complete',reasonCode:'OK',retryable:false,
   sources:[{sourceId,authority:source.authority,snapshotVersionId:'snapshot-1',adapterVersion:'1.0.0',status:'checked',synchronizedAt:asOf,asOf,retrievedAt:asOf,freshness:'fresh'}],
   data:{kind:'source-read',records:[{sourceId,recordId:'record-'+sourceId,recordVersionId:'v1',citationId:id(40+i),contentSha256:sha(content),scopes:structuredClone(scopes),content:{kind:'full-read',text:content}}]},
   coverage:{sourcesRequested:[sourceId],sourcesChecked:[sourceId],sourcesUnavailable:[],enumeration:'complete',enumerableTotal:1,returnedCount:1,truncated:false,historySupport:'supported',limitations:['Synthetic one-record fixture; no live completeness claim.']},
   continuation:{cursor:null,requiredReads:[],remainingSources:[]},negativeAssertion:{kind:'none'}};
 });
 const quote=(sourceId,start=0,end=texts[sourceId].length)=>({sourceId,recordId:'record-'+sourceId,recordVersionId:'v1',start,end,quote:texts[sourceId].slice(start,end)});
 const observation=(id,kind,sourceId,changes={})=>({id,kind,relatedPromiseId:kind==='promise'||kind==='suggestion'?null:'promise',owner:null,dueDate:null,passage:quote(sourceId),...changes});
 return {context,reads,quote,observation,input:{observations:[observation('promise','promise','mail',{passage:quote('mail',0,28)})]}};
}
