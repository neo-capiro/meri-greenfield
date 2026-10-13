/** Bounded read-only commitment ledger. Extracted meaning and links stay reviewable. */
import {canonicalSha256 as hash} from '../../contracts/validate.mjs';
import {data,own} from '../../contracts/commands-0.2/execution-boundary.mjs';
import {selectSkill} from '../index.mjs';
import {bindReads,passage,text,fail} from './evidence.mjs';

function observation(raw,bound){
  const value=data(own(raw,['id','kind','relatedPromiseId','owner','dueDate','passage']));text(value.id,128);
  if(!['promise','suggestion','tracking','delivery-claim'].includes(value.kind)||
    (['promise','suggestion'].includes(value.kind)?value.relatedPromiseId!==null:typeof value.relatedPromiseId!=='string'))fail('COMMITMENTS_OBSERVATION');
  if(value.relatedPromiseId!==null)text(value.relatedPromiseId,128);
  if(value.owner!==null)text(value.owner,256);
  if(value.dueDate!==null&&(!/^\d{4}-\d\d-\d\d$/u.test(value.dueDate)||
    !Number.isFinite(Date.parse(value.dueDate+'T00:00:00.000Z'))||new Date(value.dueDate+'T00:00:00.000Z').toISOString().slice(0,10)!==value.dueDate))fail('COMMITMENTS_DATE');
  const evidence=passage(value.passage,bound);
  if(value.kind==='tracking'&&!['tasks','action_recommendation','client_knowledge_monday'].includes(evidence.sourceId))fail('COMMITMENTS_TRACKING_SOURCE');
  return {...value,passage:evidence,classificationVerification:'requires-human-verification'};
}
function field(rows,name){
  const values=[...new Set(rows.map(row=>row[name]).filter(value=>value!==null))];
  return {status:values.length===0?'unknown':values.length===1?'extracted-unverified':'conflicting',value:values.length===1?values[0]:null,candidates:values};
}
/** Caller supplies authorized current envelopes; this function never fetches, authorizes or mutates. */
export function compileCommitmentsAudit(raw,options){
  const {context,reads}=own(options,['context','reads']);
  const input=data(own(raw,['observations']));
  if(!Array.isArray(input.observations)||input.observations.length>250)fail('COMMITMENTS_INPUT');
  const bound=bindReads(context,reads),rows=input.observations.map(row=>observation(row,bound));
  if(new Set(rows.map(row=>row.id)).size!==rows.length)fail('COMMITMENTS_DUPLICATE_OBSERVATION');
  const promises=rows.filter(row=>row.kind==='promise'),suggestions=rows.filter(row=>row.kind==='suggestion');
  for(const row of rows.filter(row=>row.relatedPromiseId!==null))if(!promises.some(p=>p.id===row.relatedPromiseId))fail('COMMITMENTS_PROMISE_LINK');
  const groups=new Map();
  for(const promise of promises){
    const {sourceId,recordId,recordVersionId,start,end}=promise.passage,key=hash([sourceId,recordId,recordVersionId,start,end]);
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(promise);
  }
  const commitments=[...groups.entries()].map(([originSha256,origins])=>{
    const ids=origins.map(row=>row.id),related=rows.filter(row=>ids.includes(row.relatedPromiseId)),owners=field([...origins,...related],'owner'),dates=field([...origins,...related],'dueDate');
    const tracking=related.filter(row=>row.kind==='tracking'),delivery=related.filter(row=>row.kind==='delivery-claim');
    const conflicting=owners.status==='conflicting'||dates.status==='conflicting';
    const status=conflicting?'conflicting-evidence':delivery.length?'delivery-claimed-unverified':tracking.length?'tracking-found-delivery-unverified':'no-linked-tracking-in-extracted-observations';
    return {originSha256,observationIds:ids,promise:origins[0].passage,classificationVerification:'requires-human-verification',
      owner:owners,dueDate:dates,status,completed:false,tracking,deliveryClaims:delivery,
      trackingLinkVerification:'proposed-link-unverified',untracked:tracking.length===0,
      followUp:conflicting?'Resolve conflicting owner/date evidence.':delivery.length?'Verify actual delivery or acceptance; a completion flag is insufficient.':tracking.length?'Confirm tracking link and actual delivery.':'Check missing sources and confirm whether this promise needs a tracked action.'};
  });
  return data({skill:selectSkill('quick_skill.commitments_audit','1.0.0').pin,subject:bound.context.subject,window:bound.context.window,asOf:bound.context.asOf,
    commitments,suggestions,coverage:bound.coverage,status:bound.coverage.every(row=>row.complete)?'covered-extraction-unverified':'partial',
    negativeClaimSupported:false,mutations:[],limitations:['Exact excerpts are bound to supplied gateway records; semantic promise, owner, date and tracking links require verification.',
      'No qualified delivery/acceptance adapter was supplied. This projection never upgrades native task completion to delivered work.',
      'Current authorization and authenticity are gateway/control duties; hashes alone do not establish either.']});
}
