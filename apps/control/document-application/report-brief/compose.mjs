/** Typed report recipe compilation. Source and base ports belong to existing trusted owners.
 * Adds no route, no authority and no second model loop: the compiler turns gateway-owned decisive
 * reads into the accepted seven-section cited DOCX report and pins immutable revision provenance. */
import {artifactValidators as v,assertSubject,assertWindow} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {fail,hash,REPORT_SECTIONS,reportInput} from './input.mjs';
import {reportManifest} from './skill.mjs';
import {createReportNativeSources,assessReportFindings} from './native-source.mjs';
import {admitRetainedDocumentAssets,retainedAssetBlocks} from '../retained-assets.mjs';
const prepared=new WeakMap();
const marker='Meri report provenance: ';
const p=(text,style='Normal')=>({kind:'paragraph',style,runs:[{text}]});
const same=(a,b)=>v.hash(a)===v.hash(b);
/** The canonical selected subject/window of this run, exactly as the other original recipes take it. */
function reportSelection(raw,context){
  const s=own(v.snapshot(raw),['subject','window','mondayBoardIds']);
  assertSubject(s.subject,context.binding);assertWindow(s.window);
  if(s.subject.kind!=='client'||!same(s.subject.scopes,context.scopes)||!reportManifest().windowBases.includes(s.window.basis)||
    !Array.isArray(s.mondayBoardIds)||s.mondayBoardIds.length>100||new Set(s.mondayBoardIds).size!==s.mondayBoardIds.length||
    s.mondayBoardIds.some(id=>typeof id!=='string'||!id||id.length>256))fail('REPORT_SELECTION');
  return s;
}
/** Immutable parent pins plus the evidence and assets the parent retained. */
function baseProvenance(record,selection,context,input){
  own(record,['version','spec','specSha256','inspection'],['requestSha256','assets']);
  v.version(record.version);v.request(record.spec);v.inspection(record.inspection);
  if(record.version.versionId!==selection.versionId||record.specSha256!==selection.specSha256||!same(record.specSha256,v.hash(record.spec))||
    record.version.binding.tenantId!==context.binding.tenantId||record.version.binding.actorId!==context.binding.actorId||
    record.version.binding.conversationId!==context.binding.conversationId||!same(record.version.scopes,context.scopes)||
    record.version.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document')fail('REPORT_BASE');
  // The parent's declared asset references survive only through its own durable retained map, admitted by
  // the ONE canonical rule: a declared reference the writer never retained, or a map that is not exactly
  // the parent's own mapping, stays explicitly unavailable rather than being stripped or re-derived.
  let retainedAssets;try{retainedAssets=admitRetainedDocumentAssets(record.spec,record.assets,record.version.object.scopes);}catch{fail('REPORT_BASE_ASSETS');}
  const blocks=record.spec.content.blocks.filter(x=>x.kind==='paragraph'&&x.runs.length===1&&x.runs[0].text.startsWith(marker));
  if(blocks.length!==1)fail('REPORT_BASE');
  let prior;try{prior=JSON.parse(blocks[0].runs[0].text.slice(marker.length));}catch{fail('REPORT_BASE');}
  if(!same(prior.skill,input.skill)||!same(prior.subject,input.subject)||Date.parse(input.asOf)<Date.parse(prior.asOf))fail('REPORT_BASE_CONTEXT');
  const retainedEvidence=record.version.evidence.map(item=>v.nativeSourceEvidence(item));
  for(const item of retainedEvidence)if(['tenantId','actorId','conversationId'].some(key=>item.binding[key]!==record.version.binding[key]))fail('REPORT_BASE_EVIDENCE');
  return {parent:{versionId:record.version.versionId,objectSha256:record.version.object.sha256,specSha256:record.specSha256,provenanceSha256:v.hash(prior)},
    retainedEvidence,retainedAssets};
}
function conflictsFor(input,findings){
  const byId=new Map(findings.map(f=>[f.id,f])),passages=f=>f.links.map(x=>x.passage).filter(x=>x!==null);
  const named=input.conflicts.map(entry=>{
    const finding=byId.get(entry.findingId);
    if(!finding||finding.conflict!==true)fail('REPORT_CONFLICT');
    return {findingId:entry.findingId,note:entry.note,passages:passages(finding)};
  });
  const derived=findings.filter(f=>f.conflict===true&&!named.some(x=>x.findingId===f.id)).map(f=>({findingId:f.id,note:null,passages:passages(f)}));
  return [...named,...derived];
}
function blocksFor(input,findings,conflicts,sources,retained,retainedAssets,provenance){
  const s=input.subject,blocks=[p(input.title,'Title'),p('Sourced cited report | Draft for review'),
    p(`Congress ${s.congress} | Session ${s.session} | ${s.billId} | Bill version ${s.billVersion} | FY ${s.fiscalYear} | Budget stage ${s.budgetStage}`),
    p('As of '+input.asOf)];
  blocks.push(p('Summary','Heading 1'),p(input.summary),p('Draft narrative: unverified until the cited passage of every Findings entry is read and byte-bound.'));
  blocks.push(p('Scope and as-of','Heading 1'),p(`${REPORT_SECTIONS[1]}: the report covers exactly this bill identity, version, fiscal year, budget stage and as-of instant. A revision may not roll the as-of backwards.`),
    p(`Sources requested: ${sources.map(source=>`${source.sourceId} (${source.operation})`).join(', ')}`));
  blocks.push(p('Findings','Heading 1'));
  for(const f of findings){blocks.push(p(`${f.id} [${f.status}${f.conflict?'; potentially conflicting cited passages':''}]: ${f.text}`));
    for(const l of f.links)blocks.push(p(`Citation: ${l.citation.sourceId} / ${l.citation.recordId} / ${l.citation.sourceVersionId}; characters ${l.citation.start}-${l.citation.end}; ${l.status}${l.citation.url?'; locator URL (not verification): '+l.citation.url:''}`));}
  blocks.push(p('Conflicting evidence','Heading 1'),p('Unequal cited passages are disclosed as possible conflicts; unequal text is not proof of a semantic contradiction, and an unread passage is not evidence of agreement.'));
  if(!conflicts.length)blocks.push(p('No conflicting cited passages were read for these findings; missing or partial evidence does not establish absence.'));
  for(const c of conflicts){blocks.push(p(`${c.findingId}: ${c.note??'disclosed possible conflict; no explanation supplied'}`));
    c.passages.forEach((passage,index)=>blocks.push(p(`Conflicting passage ${index+1}: ${passage}`)));}
  blocks.push(p('Recommendations','Heading 1'),p('Draft recommendations for human review; not enacted language and not verified facts.'));
  input.recommendations.forEach((x,index)=>blocks.push(p(`${index+1}. ${x}`)));
  blocks.push(p('Limitations','Heading 1'),p('Missing, stale, partial, unavailable, truncated or continuation-required evidence is disclosed here and never establishes absence.'));
  input.limitations.forEach(x=>blocks.push(p('Stated limitation: '+x)));
  for(const source of sources){
    const c=source.coverage;
    blocks.push(p(`${source.sourceId}: status ${source.status}${source.reason?' ('+source.reason+')':''}${c?`; pages ${c.pages}; characters ${c.offset} of ${c.totalCharacters===null?'unknown':c.totalCharacters}; complete ${c.complete}; truncated ${c.truncated}`:''}`));
    if(source.pin)blocks.push(p(`${source.sourceId} pinned identity: bill ${source.pin.recordId}; revision ${source.pin.sourceVersionId}; version ${source.pin.versionCode}; version SHA256 ${source.pin.versionHash}; text SHA256 ${source.pin.textHash}; observed ${source.pin.observedAt}; source updated ${source.pin.sourceUpdatedAt??'unknown'}; locator ${source.pin.sourceLocator} (a locator, not verification)`));
    if(source.sourceId==='federal_legislation'&&source.status==='read')
      blocks.push(p(`Stored bill status: ${source.statusLabel??'unknown'}${source.statusAt?'; status at '+source.statusAt:''}; observed ${source.observed}; latest action ${source.latestAction&&source.latestAction.text?source.latestAction.text:'none'}`));
    source.limitations.forEach(x=>blocks.push(p('Read limitation: '+x)));}
  blocks.push(p('References','Heading 1'),p('Verification means an exact excerpt was read and byte-bound. Free-form claims remain unverified.'));
  for(const f of findings){blocks.push(p(`${f.id}: ${f.status}${f.conflict?'; unresolved potentially conflicting cited passages':''}`));
    for(const l of f.links)if(l.evidence){const e=l.evidence;
      blocks.push(p(`Source ${e.sourceId}; record ${e.recordId}; version ${e.sourceVersionId}; citation ${e.citationId}; run ${e.binding.runId}.`));
      blocks.push(p(`Cited passage (UTF-16 characters ${l.citation.start}-${l.citation.end}): ${l.passage}`));
      blocks.push(p(`Full text SHA256: ${e.contentSha256}\nPassage SHA256: ${l.passageSha256}\nScope: ${JSON.stringify(e.scopes)}\nObserved ${e.observedAt}; updated ${e.sourceUpdatedAt??'unknown'}.`));}}
  if(retained.length){blocks.push(p('Retained source evidence (immutable parent)','Heading 2'));
    for(const e of retained)blocks.push(p(`Retained ${e.sourceId}; record ${e.recordId}; version ${e.sourceVersionId}; citation ${e.citationId}; run ${e.binding.runId}; content SHA256 ${e.contentSha256}; observed ${e.observedAt}.`));}
  blocks.push(...retainedAssetBlocks(retainedAssets,p));
  blocks.push(p('Original skill and immutable revision provenance','Heading 2'),p(marker+JSON.stringify(provenance)));
  return blocks;
}
export function createCongressionalReportCompiler({readSource,readBase,now}){
  if(typeof readSource!=='function'||typeof now!=='function'||readBase!==undefined&&typeof readBase!=='function')fail('REPORT_CONFIGURATION');
  return Object.freeze({async prepare(inputValue,contextValue,{base=null,selection,signal}={}){
    if(signal?.aborted)fail('REPORT_CANCELLED');
    const input=reportInput(inputValue),context=v.context(contextValue),selected=reportSelection(selection,context);
    if(Date.parse(input.asOf)>now()||context.assets.length||context.analysisAdmission)fail('REPORT_CONTEXT');
    if(base!==null){own(base,['versionId','specSha256']);if(!hash(base.specSha256)||typeof base.versionId!=='string'||!readBase)fail('REPORT_BASE');}
    const life=createOperationLifetime({deadlineMs:context.deadlineMs,now,signal,errorFactory:code=>Object.assign(new Error('REPORT_'+code),{code:'REPORT_'+code})});
    try{
      let parent=null,retained=[],retainedAssets=Object.freeze({assets:null,blocks:[]});
      if(base){const admitted=baseProvenance(v.snapshot(await life.run(signal=>readBase({versionId:base.versionId,context:v.snapshot(context),signal}))),base,context,input);
        parent=admitted.parent;retained=admitted.retainedEvidence;retainedAssets=admitted.retainedAssets;}
      // One native receiving session: exact canonical selectors over the trusted gateway port, no envelope.
      const collector=createReportNativeSources({readSource,selected,subject:input.subject,context,asOf:Date.parse(input.asOf)});
      const sources=await life.run(signal=>collector.collect(signal)),reads=collector.receipts();
      const findings=assessReportFindings(input.findings,sources),conflicts=conflictsFor(input,findings),
        evidence=[...retained,...sources.flatMap(source=>source.records.map(record=>record.evidence)).filter(item=>item!==null)];
      if(new Set(evidence.map(x=>x.citationId)).size!==evidence.length)fail('REPORT_RETAINED_EVIDENCE');
      const provenance={recipe:'sourced-cited-report',skill:input.skill,selection:selected,subject:input.subject,asOf:input.asOf,inputSha256:v.hash(input),
        readsSha256:v.hash(reads),sourcesSha256:v.hash(sources),retainedEvidenceSha256:v.hash(retained),parent};
      const nextContext=v.context({...context,evidence,...(retainedAssets.assets===null?{}:{assets:retainedAssets.assets})}),request=v.request({operation:'create_word',format:'docx',title:input.title,content:{blocks:blocksFor(input,findings,conflicts,sources,retained,retainedAssets,provenance)}});
      life.check();
      const result=Object.freeze({request:v.snapshot(request),context:v.snapshot(nextContext),baseVersionId:base?.versionId??null,
        retainedEvidence:v.snapshot(retained),provenance:v.snapshot(provenance),findings:v.snapshot(findings),conflicts:v.snapshot(conflicts),
        reads:v.snapshot(reads),coverage:v.snapshot(sources)});
      prepared.set(result,{requestSha256:v.hash(request),contextSha256:v.hash(nextContext),baseVersionId:result.baseVersionId,evidenceSha256:v.hash(nextContext.evidence)});return result;
    }finally{life.close();}
  }});
}
/** Server configuration guard, not an authorization grant or public request schema. */
export function admitPreparedReport(value,context){
  const pin=prepared.get(value);if(!pin||pin.contextSha256!==v.hash(context))fail('REPORT_CONFIGURATION');
  return call=>{if(v.hash(call.request)!==pin.requestSha256||call.baseVersionId!==pin.baseVersionId)fail('REPORT_REQUEST_SUBSTITUTION');};
}
/** The exact prepared-context evidence the retained-evidence admission may admit, or nothing. */
export const preparedReportEvidenceSha256=value=>prepared.get(value)?.evidenceSha256;
