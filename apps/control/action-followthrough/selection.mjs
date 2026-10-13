/** Pure supporting-evidence correlation; never grants task or source authority. */
import {canonicalSha256,validateShape as publicShape} from '../../../packages/contracts/validate.mjs';
import {validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {normalizeTaskCreateInput} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data,own,deny} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value))deny('FOLLOWTHROUGH_DATA');return value.toLowerCase();}
export function selection(value){const s=data(own(value,['resultReference','resultSha256','actionId']));uuid(s.resultReference);
 if(typeof s.resultSha256!=='string'||!/^[0-9a-f]{64}$/u.test(s.resultSha256)||typeof s.actionId!=='string'||!s.actionId.length||s.actionId.length>256)deny('FOLLOWTHROUGH_DATA');
 return data({...s,resultReference:s.resultReference.toLowerCase()});}
export function selectedRead(value,wanted,context,clientId,maxBytes){
 const v=data(value);if(Buffer.byteLength(JSON.stringify(v))>maxBytes)deny('FOLLOWTHROUGH_LIMIT');
 own(v,['lookupId','resultReference','resultSha256','classification','acceptedTasks','events','observation']);uuid(v.lookupId);
 if(uuid(v.resultReference)!==wanted.resultReference||v.resultSha256!==wanted.resultSha256||v.classification!=='recommendations'||v.acceptedTasks!==false||canonicalSha256(v.observation)!==wanted.resultSha256)deny('FOLLOWTHROUGH_SOURCE');
 const o=v.observation;own(o,['binding','subject','operation','argumentsSha256','result']);publicShape('RunBinding',o.binding);
 if(!same(o.operation,{id:'actions.query',version:'0.2.0'})||!same(o.binding,o.result.binding)||!same(o.subject,o.result.subject)||
  ['tenantId','actorId','conversationId','runId'].some(k=>o.binding[k]!==context.currentBinding[k]))deny('FOLLOWTHROUGH_SOURCE');
 validateShape('ActionItemClientScopedPage',o.result);
 if(uuid(o.result.clientId)!==clientId||o.subject.kind!=='client'||o.subject.entityIds.length!==1||uuid(o.subject.entityIds[0])!==clientId||o.subject.tenantId!==context.currentBinding.tenantId||o.subject.actorId!==context.currentBinding.actorId)deny('FOLLOWTHROUGH_SOURCE');
 const found=o.result.actions.filter(a=>a.id===wanted.actionId);if(found.length!==1)deny('FOLLOWTHROUGH_SELECTION');
 const recommendation=found[0];if(uuid(recommendation.clientId)!==clientId||recommendation.acceptedAsTask!==false||recommendation.recommendation!==true)deny('FOLLOWTHROUGH_SOURCE');
 if(!Array.isArray(v.events)||v.events.length!==2)deny('FOLLOWTHROUGH_SOURCE');
 for(const [i,type]of ['tool.started','tool.completed'].entries()){const event=v.events[i];publicShape('UIEvent',event);if(event.type!==type||!same(event.binding,o.binding)||!same(event.scopes,o.subject.scopes))deny('FOLLOWTHROUGH_SOURCE');}
 if(v.events[0].data.requestId!==v.events[1].data.requestId||uuid(v.events[1].data.resultReference)!==wanted.resultReference)deny('FOLLOWTHROUGH_SOURCE');
 return data({source:{...wanted,lookupId:v.lookupId,actionSha256:canonicalSha256(recommendation),originalBinding:o.binding,clientId},recommendation});
}
export function taskInput(value,commandContext){
 const task=data(own(value,['title','clientId','dueDate']));const normalized=normalizeTaskCreateInput(task,commandContext);
 if(!same(task,normalized))deny('FOLLOWTHROUGH_DRAFT');return normalized;
}
export function makeDraft(selected,edits,commandContext){
 const changes=data(own(edits,[],['title','dueDate']));
 const task=normalizeTaskCreateInput({title:selected.recommendation.title,dueDate:selected.recommendation.deadline,...changes,clientId:selected.source.clientId},commandContext);
 const content={status:'draft',...selected,task};return data({...content,draftSha256:canonicalSha256(content)});
}
export function draft(value,commandContext){
 const d=data(own(value,['status','source','recommendation','task','draftSha256']));if(d.status!=='draft')deny('FOLLOWTHROUGH_DRAFT');
 const {draftSha256,...content}=d;if(canonicalSha256(content)!==draftSha256)deny('FOLLOWTHROUGH_DRAFT');
 own(d.source,['resultReference','resultSha256','actionId','lookupId','actionSha256','originalBinding','clientId']);
 selection({resultReference:d.source.resultReference,resultSha256:d.source.resultSha256,actionId:d.source.actionId});taskInput(d.task,commandContext);return d;
}
