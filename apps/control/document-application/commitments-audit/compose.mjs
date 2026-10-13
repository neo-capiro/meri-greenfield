/** Original Commitments Audit compilation into the existing Word artifact request. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {compileCommitmentsAudit} from '../../../../packages/skills/commitments/index.mjs';
import {bindWorkflowReads} from '../../../../packages/skills/evidence/typed-reads.mjs';
import {asset,input,selection,createCollection,same,fail} from './source.mjs';
import {blocks,marker} from './rendering.mjs';
const prepared=new WeakMap(),defaults={maxCalls:24,maxPages:3,maxRecords:3,sectionCodeUnits:2000,maxBodyCodeUnits:120000,maxSourceBytes:2097152};
const stableSelection=s=>{const {authorizationDecisionId,...subject}=s.subject;return {...s,subject};};
function baseRecord(value,base,context,i,selected){
 const r=own(v.snapshot(value),['version','spec','specSha256','requestSha256','inspection']);v.version(r.version);v.request(r.spec);v.inspection(r.inspection);
 if(r.version.versionId!==base.versionId||r.specSha256!==base.specSha256||r.specSha256!==v.hash(r.spec)||r.version.binding.tenantId!==context.binding.tenantId||r.version.binding.actorId!==context.binding.actorId||r.version.binding.conversationId!==context.binding.conversationId||!same(r.version.scopes,context.scopes)||r.spec.operation!=='create_word'||r.spec.format!=='docx'||r.inspection.format!=='docx'||r.inspection.sha256!==r.version.object.sha256||r.inspection.bytes!==r.version.object.bytes)fail('COMMITMENTS_BASE');
 const matches=r.spec.content.blocks.filter(b=>b.kind==='paragraph'&&b.runs.length===1&&b.runs[0].text.startsWith(marker));if(matches.length!==1)fail('COMMITMENTS_BASE');
 let prior;try{prior=JSON.parse(matches[0].runs[0].text.slice(marker.length));}catch{fail('COMMITMENTS_BASE');}
 if(!same(prior.skill,i.skill)||!same(stableSelection(prior.selection),stableSelection(selected))||!same(prior.target,i.target)||Date.parse(i.asOf)<Date.parse(prior.asOf))fail('COMMITMENTS_BASE_CONTEXT');
 return {parent:{versionId:r.version.versionId,objectSha256:r.version.object.sha256,specSha256:r.specSha256,provenanceSha256:v.hash(prior)},evidence:r.version.evidence};
}
export function createCommitmentsAuditCompiler({readSource,readBase,now,limits={}}){
 if(typeof readSource!=='function'||typeof now!=='function'||readBase!==undefined&&typeof readBase!=='function')fail('COMMITMENTS_CONFIGURATION');
 own(v.snapshot(limits),[],Object.keys(defaults));const bounds={...defaults,...limits};for(const [key,value]of Object.entries(bounds))if(!Number.isSafeInteger(value)||value<1||value>defaults[key])fail('COMMITMENTS_CONFIGURATION');
 return Object.freeze({async prepare(raw,rawContext,options){
  const i=input(raw),context=v.context(rawContext),opts=own(options,['selection'],['base','signal']),selected=selection(opts.selection,context),base=opts.base??null;
  if(Date.parse(i.asOf)>now()||context.assets.length||context.analysisAdmission||context.evidence.length)fail('COMMITMENTS_CONTEXT');
  if(base!==null){own(base,['versionId','specSha256']);if(!readBase||!/^[a-f0-9]{64}$/u.test(base.specSha256??''))fail('COMMITMENTS_BASE');}
  const deadlineMs=Math.min(context.deadlineMs,now()+asset.manifest.budgets.maxRuntimeSeconds*1000),life=createOperationLifetime({deadlineMs,now,signal:opts.signal,
   errorFactory:code=>Object.assign(new Error('COMMITMENTS_'+code),{code:'COMMITMENTS_'+code})});
  try{
   let parent=null,retainedEvidence=[];if(base){const retained=baseRecord(await life.run(signal=>readBase({versionId:base.versionId,context:v.snapshot(context),signal})),base,context,i,selected);parent=retained.parent;retainedEvidence=retained.evidence;}
   const collection=createCollection({readSource,context,selected,asOf:i.asOf,query:i.target.query,deadlineMs,life,now,limits:bounds});await collection.collect();
   const evidenceContext={binding:context.binding,subject:selected.subject,window:selected.window,asOf:new Date(now()).toISOString(),mondayBoardIds:selected.mondayBoardIds};
   const bound=bindWorkflowReads(evidenceContext,collection.reads,{skillId:asset.manifest.skillId,skillVersion:asset.manifest.skillVersion});
   const observations=[],unresolved=[];
   for(const row of i.observations){own(row,['id','kind','relatedPromiseId','owner','dueDate','passage']);own(row.passage,['sourceId','recordId','recordVersionId','start','end','quote']);
    const found=bound.records.get(v.hash([row.passage.sourceId,row.passage.recordId,row.passage.recordVersionId]));
    if(!found||found.record.content.text.slice(row.passage.start,row.passage.end)!==row.passage.quote)unresolved.push({...row,reason:'Missing exact full version/hash-bound source passage.'});else observations.push(row);}
   const promiseIds=new Set(observations.filter(row=>row.kind==='promise').map(row=>row.id));const usable=observations.filter(row=>{if(row.relatedPromiseId===null||promiseIds.has(row.relatedPromiseId))return true;unresolved.push({...row,reason:'Related promise is not bound in retained material.'});return false;});
   const ledger=compileCommitmentsAudit({observations:usable},{context:evidenceContext,reads:collection.reads});
   const evidence=[...bound.records.values()].map(({record,source,authorizationDecisionId})=>({sourceId:record.sourceId,recordId:record.recordId,
    sourceVersionId:record.recordVersionId,citationId:record.citationId,contentSha256:record.contentSha256,scopes:record.scopes,
    authorizationDecisionId,observedAt:source.retrievedAt,sourceUpdatedAt:source.asOf??null}));
   for(const current of evidence)if(retainedEvidence.some(prior=>prior.sourceId===current.sourceId&&prior.recordId===current.recordId&&prior.sourceVersionId===current.sourceVersionId&&prior.contentSha256!==current.contentSha256))fail('COMMITMENTS_SOURCE_VERSION_CONFLICT');
   const provenance={recipe:'commitments-audit',skill:i.skill,selection:selected,target:i.target,asOf:i.asOf,collectedThrough:evidenceContext.asOf,inputSha256:v.hash(i),
    readsSha256:v.hash(collection.reads),ledgerSha256:v.hash(ledger),parent,gaps:collection.gaps,collection:{...collection.stats(),capHits:collection.capHits}};
   const request=v.request({operation:'create_word',format:'docx',title:i.title,content:{blocks:blocks(i,selected,ledger,unresolved,provenance)}}),nextContext=v.context({...context,evidence});life.check();
   const result=data({request,context:nextContext,baseVersionId:base?.versionId??null,provenance,ledger,unresolved,reads:collection.reads});prepared.set(result,{requestSha256:v.hash(request),contextSha256:v.hash(nextContext),baseVersionId:result.baseVersionId});return result;
  }finally{life.close();}
 }});
}
export function admitPreparedCommitmentsAudit(value,context){const pin=prepared.get(value);if(!pin||pin.contextSha256!==v.hash(context))fail('COMMITMENTS_CONFIGURATION');return intent=>{if(v.hash(intent.request)!==pin.requestSha256||intent.baseVersionId!==pin.baseVersionId)fail('COMMITMENTS_REQUEST_SUBSTITUTION');};}
