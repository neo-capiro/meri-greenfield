/** Typed general cited-report compilation. Source and base ports belong to existing trusted owners.
 * Adds no route, no authority and no second model loop: the compiler turns the selected runtime's own typed
 * reads into the accepted seven-section cited DOCX report and pins immutable revision provenance. The subject
 * is the trusted selected subject, never model input. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {fail,hash,CITED_REPORT_SECTIONS,citedReportInput,reportSelection} from './input.mjs';
import {citedReportManifest} from './skill.mjs';
import {admitRead,assessFindings,citedReportReadGroups} from './sources.mjs';
import {admitRetainedDocumentAssets,retainedAssetBlocks} from '../retained-assets.mjs';
const prepared=new WeakMap();
const marker='Meri cited report provenance: ';
const p=(text,style='Normal')=>({kind:'paragraph',style,runs:[{text}]});
const same=(a,b)=>v.hash(a)===v.hash(b);
const describe=subject=>`${subject.kind}${subject.entityIds.length?': '+subject.entityIds.join(', '):''}${subject.rosterVersionId?` | authorized roster ${subject.rosterVersionId}`:''}`;
/** Immutable parent pins plus the evidence and assets the parent retained. */
function baseProvenance(record,base,context,input,selected){
 own(record,['version','spec','specSha256','inspection'],['requestSha256','assets']);
 v.version(record.version);v.request(record.spec);v.inspection(record.inspection);
 if(record.version.versionId!==base.versionId||record.specSha256!==base.specSha256||!same(record.specSha256,v.hash(record.spec))||
  record.version.binding.tenantId!==context.binding.tenantId||record.version.binding.actorId!==context.binding.actorId||
  record.version.binding.conversationId!==context.binding.conversationId||!same(record.version.scopes,context.scopes)||
  record.version.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document')fail('CITED_REPORT_BASE');
 // The parent's declared asset references survive only through its own durable retained map, admitted by
 // the ONE canonical rule: a declared reference the writer never retained, or a map that is not exactly
 // the parent's own mapping, stays explicitly unavailable rather than being stripped or re-derived.
 let retainedAssets;try{retainedAssets=admitRetainedDocumentAssets(record.spec,record.assets,record.version.object.scopes);}catch{fail('CITED_REPORT_BASE_ASSETS');}
 const blocks=record.spec.content.blocks.filter(x=>x.kind==='paragraph'&&x.runs.length===1&&x.runs[0].text.startsWith(marker));
 if(blocks.length!==1)fail('CITED_REPORT_BASE');
 let prior;try{prior=JSON.parse(blocks[0].runs[0].text.slice(marker.length));}catch{fail('CITED_REPORT_BASE');}
 if(!same(prior.skill,input.skill)||!same(prior.subject,selected.subject)||Date.parse(input.asOf)<Date.parse(prior.asOf))fail('CITED_REPORT_BASE_CONTEXT');
 const retainedEvidence=record.version.evidence.map(item=>v.nativeSourceEvidence(item));
 for(const item of retainedEvidence)if(['tenantId','actorId','conversationId'].some(key=>item.binding[key]!==record.version.binding[key]))fail('CITED_REPORT_BASE_EVIDENCE');
 return {parent:{versionId:record.version.versionId,objectSha256:record.version.object.sha256,specSha256:record.specSha256,provenanceSha256:v.hash(prior)},
  retainedEvidence,retainedAssets};
}
function conflictsFor(input,findings){
 const byId=new Map(findings.map(f=>[f.id,f])),passages=f=>f.citations.filter(x=>x.passage).map(x=>x.passage);
 const named=input.conflicts.map(entry=>{
  const finding=byId.get(entry.findingId);
  if(!finding||finding.conflict!==true)fail('CITED_REPORT_CONFLICT');
  return {findingId:entry.findingId,note:entry.note,passages:passages(finding)};
 });
 const derived=findings.filter(f=>f.conflict===true&&!named.some(x=>x.findingId===f.id)).map(f=>({findingId:f.id,note:null,passages:passages(f)}));
 return [...named,...derived];
}
function coverageLine(read){
 const c=read.coverage,e=read.continuation;
 return `${read.sourceId}: coverage ${c.enumeration}; truncated ${c.truncated}; returned ${c.returnedCount}; total ${c.enumerableTotal??'unknown'}; `+
  `requested ${c.sourcesRequested.join(', ')||'none'}; checked ${c.sourcesChecked.join(', ')||'none'}; unavailable ${c.sourcesUnavailable.join(', ')||'none'}; history ${c.historySupport}; `+
  `snapshot ${read.snapshotVersionId??'unknown'}; continuation ${e.cursor??'none'}; required reads ${e.requiredReads.join(', ')||'none'}; remaining sources ${e.remainingSources.join(', ')||'none'}`;
}
/** A portfolio evidence projection carries its own coverage type: it proves no bytes, so its line says so. */
function projectionLine(read){
 const c=read.coverage;
 return `${read.sourceId}: projection ${c.scope}/${c.sourceView}; corpus complete ${c.corpusComplete}; source bytes verified ${c.sourceBytesVerified}`;
}
function blocksFor(input,selection,findings,conflicts,reads,retained,retainedAssets,provenance){
 const subject=selection.subject,blocks=[p(input.title,'Title'),p('Cited report | Draft for review'),
  p(`Subject ${describe(subject)}`),p('As of '+input.asOf)];
 blocks.push(p('Summary','Heading 1'),p(input.summary),p('Draft narrative: the cited status of every Findings entry is recorded with that citation.'));
 blocks.push(p('Scope and as-of','Heading 1'),
  p(`${CITED_REPORT_SECTIONS[1]}: the report covers exactly this subject, its authorized scopes and the selected window (${selection.window.basis}), as of the stated instant. A revision may not roll the as-of backwards.`),
  p(`Sources read: ${reads.length?reads.map(read=>read.sourceId).join(', '):'none'}`));
 blocks.push(p('Findings','Heading 1'));
 for(const f of findings){blocks.push(p(`${f.id} [${f.status}${f.conflict?'; potentially conflicting cited passages':''}]: ${f.text}`));
  for(const l of f.citations)blocks.push(p(l.status==='verified'
   ?`Citation: ${l.citation.sourceId} / message ${l.citation.recordId} / version ${l.citation.sourceVersionId}; characters ${l.citation.start}-${l.citation.end}; verified`
   :`Citation: ${l.citation.sourceId} / ${l.citation.origin} / ${l.citation.recordId??'current view'}; preserved claim (source bytes verified by the projection: ${l.coverage.sourceBytesVerified===true?'yes':'no'})`));}
 blocks.push(p('Conflicting evidence','Heading 1'),p('Unequal cited passages are disclosed as possible conflicts; unequal text is not proof of a semantic contradiction, and an unread passage is not evidence of agreement.'));
 if(!conflicts.length)blocks.push(p('No conflicting cited passages were read for these findings; missing or partial evidence does not establish absence.'));
 for(const c of conflicts){blocks.push(p(`${c.findingId}: ${c.note??'disclosed possible conflict; no explanation supplied'}`));
  c.passages.forEach((passage,index)=>blocks.push(p(`Conflicting passage ${index+1}: ${passage}`)));}
 blocks.push(p('Recommendations','Heading 1'),p('Draft recommendations for human review; not verified facts and not an instruction to act.'));
 input.recommendations.forEach((x,index)=>blocks.push(p(`${index+1}. ${x}`)));
 blocks.push(p('Limitations','Heading 1'),p('Missing, stale, partial, unavailable, truncated or continuation-required evidence is disclosed here and never establishes absence.'));
 input.limitations.forEach(x=>blocks.push(p('Stated limitation: '+x)));
 for(const read of reads){
  blocks.push(p(read.kind==='mail'?coverageLine(read):projectionLine(read)));
  read.coverage.limitations.forEach(x=>blocks.push(p('Read limitation: '+x)));
  if(read.kind==='mail')read.sources.forEach(source=>blocks.push(p(`Source ${source.sourceId}: ${source.status} (${source.authority}, ${source.freshness}); as-of ${source.asOf??'unknown'}; synchronized ${source.synchronizedAt??'unknown'}; retrieved ${source.retrievedAt}; adapter ${source.adapterVersion}`)));
 }
 for(const f of findings)for(const l of f.citations)if(l.limitations)l.limitations.forEach(x=>blocks.push(p('Claim limitation: '+x)));
 blocks.push(p('References','Heading 1'),p('Verification means an exact excerpt of a stored record version was read and byte-bound. A preserved claim is not verification.'));
 for(const read of reads){
  blocks.push(p(`${read.sourceId}: operation ${read.operation.id}@${read.operation.version}; request ${JSON.stringify(read.request)}; result SHA256 ${read.resultSha256}`));
  blocks.push(p(read.kind==='mail'?coverageLine(read):projectionLine(read)));
 }
 for(const f of findings)for(const l of f.citations)if(l.evidence){const e=l.evidence;
  blocks.push(p(`Source ${e.sourceId}; record ${e.recordId}; version ${e.sourceVersionId}; citation ${e.citationId}; run ${e.binding.runId}.`));
  blocks.push(p(`Cited passage (UTF-16 characters ${l.citation.start}-${l.citation.end}): ${l.passage}`));
  blocks.push(p(`Preserved content SHA256: ${e.contentSha256}\nPassage SHA256: ${l.passageSha256}\nScope: ${JSON.stringify(e.scopes)}\nObserved ${e.observedAt}; body completeness ${l.bodyCompleteness}; section ${l.section.start}-${l.section.endExclusive} of ${l.section.totalCodeUnits}${l.section.hasMore?'; more body outside the read section':''}.`));}
 if(retained.length){blocks.push(p('Retained source evidence (immutable parent)','Heading 2'));
  for(const e of retained)blocks.push(p(`Retained ${e.sourceId}; record ${e.recordId}; version ${e.sourceVersionId}; citation ${e.citationId}; run ${e.binding.runId}; content SHA256 ${e.contentSha256}; observed ${e.observedAt}.`));}
 blocks.push(...retainedAssetBlocks(retainedAssets,p));
 blocks.push(p('Original skill and immutable revision provenance','Heading 2'),p(marker+JSON.stringify(provenance)));
 return blocks;
}
export function createCitedReportCompiler({readSource,readBase,now}){
 if(typeof readSource!=='function'||typeof now!=='function'||readBase!==undefined&&typeof readBase!=='function')fail('CITED_REPORT_CONFIGURATION');
 return Object.freeze({async prepare(inputValue,contextValue,{base=null,selection,signal}={}){
  if(signal?.aborted)fail('CITED_REPORT_CANCELLED');
  const input=citedReportInput(inputValue),context=v.context(contextValue),selected=reportSelection(selection,context,citedReportManifest());
  if(Date.parse(input.asOf)>now()||context.assets.length||context.analysisAdmission)fail('CITED_REPORT_CONTEXT');
  if(base!==null){own(base,['versionId','specSha256']);if(!hash(base.specSha256)||typeof base.versionId!=='string'||!readBase)fail('CITED_REPORT_BASE');}
  const life=createOperationLifetime({deadlineMs:context.deadlineMs,now,signal,errorFactory:code=>Object.assign(new Error('CITED_REPORT_'+code),{code:'CITED_REPORT_'+code})});
  try{
   let parent=null,retained=[],retainedAssets=Object.freeze({assets:null,blocks:[]});
   if(base){const admitted=baseProvenance(v.snapshot(await life.run(signal=>readBase({versionId:base.versionId,context:v.snapshot(context),signal}))),base,context,input,selected);
    parent=admitted.parent;retained=admitted.retainedEvidence;retainedAssets=admitted.retainedAssets;}
   // One real typed read per distinct cited locator, through the selected runtime's own read seam.
   const reads=[];
   for(const group of citedReportReadGroups(input,selected)){
    let value;
    try{value=await life.run(signal=>readSource({binding:context.binding,window:selected.window,subject:selected.subject,operation:group.operation,request:group.request,signal}));}
    catch(error){
     if(signal?.aborted||error?.code==='CITED_REPORT_CANCELLED')throw error;
     // A source the runtime will not read is disclosed as exactly that: nothing was read, so no citation of
     // it can be presented and no absence can be claimed from it.
     fail(`CITED_REPORT_READ_${typeof error?.code==='string'?error.code:'UNAVAILABLE'}`);
    }
    reads.push(admitRead(group,value,{context,selected}));
   }
   const findings=assessFindings(input.findings,reads,{context,asOf:input.asOf}),conflicts=conflictsFor(input,findings),
    evidence=[...retained,...findings.flatMap(f=>f.citations.map(l=>l.evidence).filter(Boolean))]
     .filter((item,index,all)=>all.findIndex(candidate=>candidate.citationId===item.citationId)===index);
   if(new Set(evidence.map(x=>x.citationId)).size!==evidence.length)fail('CITED_REPORT_RETAINED_EVIDENCE');
   const provenance={recipe:'general-cited-report',skill:input.skill,selection:v.snapshot(selected),subject:selected.subject,asOf:input.asOf,inputSha256:v.hash(input),
    readsSha256:v.hash(reads),retainedEvidenceSha256:v.hash(retained),parent};
   const blocks=blocksFor(input,selected,findings,conflicts,reads,retained,retainedAssets,provenance);
   const nextContext=v.context({...context,evidence,...(retainedAssets.assets===null?{}:{assets:retainedAssets.assets})}),request=v.request({operation:'create_word',format:'docx',title:input.title,content:{blocks}});
   life.check();
   const result=Object.freeze({request:v.snapshot(request),context:v.snapshot(nextContext),baseVersionId:base?.versionId??null,
    retainedEvidence:v.snapshot(retained),provenance:v.snapshot(provenance),findings:v.snapshot(findings),conflicts:v.snapshot(conflicts),reads:v.snapshot(reads)});
   prepared.set(result,{requestSha256:v.hash(request),contextSha256:v.hash(nextContext),baseVersionId:result.baseVersionId,evidenceSha256:v.hash(nextContext.evidence)});return result;
  }finally{life.close();}
 }});
}
/** Server configuration guard, not an authorization grant or public request schema. */
export function admitPreparedCitedReport(value,context){
 const pin=prepared.get(value);if(!pin||pin.contextSha256!==v.hash(context))fail('CITED_REPORT_CONFIGURATION');
 return call=>{if(v.hash(call.request)!==pin.requestSha256||call.baseVersionId!==pin.baseVersionId)fail('CITED_REPORT_REQUEST_SUBSTITUTION');};
}
/** The exact prepared-context evidence the retained-evidence admission may admit, or nothing. */
export const preparedCitedReportEvidenceSha256=value=>prepared.get(value)?.evidenceSha256;
