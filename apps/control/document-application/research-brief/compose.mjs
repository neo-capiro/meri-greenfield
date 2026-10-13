/** Typed artifact recipe compilation. Source and base ports belong to existing trusted owners. */
import {artifactValidators as v} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {briefInput,fail,hash} from './input.mjs';
import {briefSkillPin,briefSourceIds} from './skill.mjs';
import {bindRead,assessFacts} from './evidence.mjs';
const prepared=new WeakMap();
const marker='Meri brief provenance: ';
const p=(text,style='Normal')=>({kind:'paragraph',style,runs:[{text}]});
const same=(a,b)=>v.hash(a)===v.hash(b);
function baseProvenance(base,selection,context,input){
  own(base,['version','spec','specSha256','requestSha256','inspection']);
  v.version(base.version);v.request(base.spec);v.inspection(base.inspection);
  if(base.version.versionId!==selection.versionId||base.specSha256!==selection.specSha256||!same(base.specSha256,v.hash(base.spec))||
    base.version.binding.tenantId!==context.binding.tenantId||base.version.binding.conversationId!==context.binding.conversationId||
    !same(base.version.scopes,context.scopes)||base.version.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document')fail('BRIEF_BASE');
  const blocks=base.spec.content.blocks.filter(x=>x.kind==='paragraph'&&x.runs.length===1&&x.runs[0].text.startsWith(marker));
  if(blocks.length!==1)fail('BRIEF_BASE');
  let prior;try{prior=JSON.parse(blocks[0].runs[0].text.slice(marker.length));}catch{fail('BRIEF_BASE');}
  if(!same(prior.skill,input.skill)||!same(prior.subject,input.subject)||Date.parse(input.asOf)<Date.parse(prior.asOf))fail('BRIEF_BASE_CONTEXT');
  return {versionId:base.version.versionId,objectSha256:base.version.object.sha256,specSha256:base.specSha256,provenanceSha256:v.hash(prior)};
}
function blocksFor(input,facts,reads,provenance){
  const s=input.subject,blocks=[p(input.title,'Title'),p('Congressional research brief | Draft for review'),
    p(`Congress ${s.congress} | Session ${s.session} | ${s.billId} | Bill version ${s.billVersion} | FY ${s.fiscalYear} | Budget stage ${s.budgetStage}`),
    p('As of '+input.asOf),p('Facts and evidence','Heading 1')];
  for(const f of facts){blocks.push(p(`${f.id} [${f.status}${f.conflict?'; potentially conflicting cited passages':''}]: ${f.text}`));
    for(const l of f.links)blocks.push(p(`Citation: ${l.citation.sourceId} / ${l.citation.recordId} / ${l.citation.sourceVersionId}; characters ${l.citation.start}-${l.citation.end}; ${l.status}${l.citation.url?'; locator URL (not verification): '+l.citation.url:''}`));}
  blocks.push(p('Proposed language','Heading 1'),p('Draft proposals for human review; not enacted language or verified facts.'));
  input.proposedLanguage.forEach(x=>blocks.push(p(x)));
  blocks.push(p('Coverage and verification appendix','Heading 1'),p('Verification means an exact excerpt was read and byte-bound. Free-form claims remain unverified. Missing or partial evidence does not establish absence.'));
  for(const r of reads){const e=r.envelope,s=e.sources[0];
    blocks.push(p(`${s.sourceId}: ${e.status} (${e.reasonCode}); method ${e.method}; freshness ${s.freshness}; snapshot ${s.snapshotVersionId??'unknown'}; adapter ${s.adapterVersion}`));
    blocks.push(p(`Requested ${e.coverage.sourcesRequested.join(', ')}; checked ${e.coverage.sourcesChecked.join(', ')||'none'}; unavailable ${e.coverage.sourcesUnavailable.join(', ')||'none'}; returned ${e.coverage.returnedCount}; total ${e.coverage.enumerableTotal??'unknown'}; enumeration ${e.coverage.enumeration}; truncated ${e.coverage.truncated}; history ${e.coverage.historySupport}`));
    blocks.push(p(`Source as-of ${s.asOf??'unknown'}; synchronized ${s.synchronizedAt??'unknown'}; retrieved ${s.retrievedAt}. Continuation ${e.continuation.cursor??'none'}; required reads ${e.continuation.requiredReads.join(', ')||'none'}; remaining sources ${e.continuation.remainingSources.join(', ')||'none'}.`));
    e.coverage.limitations.forEach(x=>blocks.push(p('Limitation: '+x)));
  }
  for(const f of facts){blocks.push(p(`${f.id}: ${f.status}${f.conflict?'; unresolved potentially conflicting cited passages':''}`));
    for(const l of f.links)if(l.evidence){const e=l.evidence;
      blocks.push(p(`Source ${e.sourceId}; record ${e.recordId}; version ${e.sourceVersionId}; citation ${e.citationId}; authorization decision ${e.authorizationDecisionId}.`));
      blocks.push(p(`Cited passage (UTF-16 characters ${l.citation.start}-${l.citation.end}): ${l.passage}`));
      blocks.push(p(`Full text SHA256: ${e.contentSha256}\nPassage SHA256: ${l.passageSha256}\nScope: ${JSON.stringify(e.scopes)}\nObserved ${e.observedAt}; updated ${e.sourceUpdatedAt??'unknown'}.`));}
  }
  blocks.push(p('Original skill and immutable revision provenance','Heading 2'),p(marker+JSON.stringify(provenance)));
  return blocks;
}
export function createCongressionalBriefCompiler({readSource,readBase,now}){
  if(typeof readSource!=='function'||typeof now!=='function'||readBase!==undefined&&typeof readBase!=='function')fail('BRIEF_CONFIGURATION');
  return Object.freeze({async prepare(inputValue,contextValue,{base=null,signal}={}){
    if(signal?.aborted)fail('BRIEF_CANCELLED');
    const input=briefInput(inputValue,briefSkillPin()),context=v.context(contextValue);
    if(Date.parse(input.asOf)>now()||context.assets.length||context.analysisAdmission)fail('BRIEF_CONTEXT');
    if(base!==null){own(base,['versionId','specSha256']);if(!hash(base.specSha256)||typeof base.versionId!=='string'||!readBase)fail('BRIEF_BASE');}
    const life=createOperationLifetime({deadlineMs:context.deadlineMs,now,signal,errorFactory:code=>Object.assign(new Error('BRIEF_'+code),{code:'BRIEF_'+code})});
    try{
      let parent=null;if(base)parent=baseProvenance(v.snapshot(await life.run(signal=>readBase({versionId:base.versionId,context:v.snapshot(context),signal}))),base,context,input);
      const reads=[];
      for(const sourceId of briefSourceIds){
        const selector={subject:input.subject,asOf:input.asOf},call={sourceId,selector,binding:context.binding,scopes:context.scopes,deadlineMs:context.deadlineMs};
        reads.push(bindRead(await life.run(signal=>readSource({...v.snapshot(call),signal})),call,input.asOf));
      }
      const facts=assessFacts(input.facts,reads),evidence=reads.flatMap(x=>x.evidence);
      if(new Set(evidence.map(x=>x.citationId)).size!==evidence.length)fail('BRIEF_READ_BINDING');
      const provenance={recipe:'congressional-sourced-brief',skill:input.skill,subject:input.subject,asOf:input.asOf,
        inputSha256:v.hash(input),readsSha256:v.hash(reads),parent};
      const nextContext=v.context({...context,evidence}),request=v.request({operation:'create_word',format:'docx',title:input.title,content:{blocks:blocksFor(input,facts,reads,provenance)}});
      life.check();
      const result=Object.freeze({request:v.snapshot(request),context:v.snapshot(nextContext),baseVersionId:base?.versionId??null,
        provenance:v.snapshot(provenance),facts:v.snapshot(facts),reads:v.snapshot(reads)});
      prepared.set(result,{requestSha256:v.hash(request),contextSha256:v.hash(nextContext),baseVersionId:result.baseVersionId});return result;
    }finally{life.close();}
  }});
}
/** Server configuration guard, not an authorization grant or public request schema. */
export function admitPreparedBrief(value,context){
  const pin=prepared.get(value);if(!pin||pin.contextSha256!==v.hash(context))fail('BRIEF_CONFIGURATION');
  return call=>{if(v.hash(call.request)!==pin.requestSha256||call.baseVersionId!==pin.baseVersionId)fail('BRIEF_REQUEST_SUBSTITUTION');};
}
