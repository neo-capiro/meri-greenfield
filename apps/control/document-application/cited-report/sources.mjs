/** General source adapters of the installed long-form cited report.
 *
 * The trusted selected runtime gives a compiler exactly one read seam:
 *   readSource({binding,window,subject,operation,request,signal}) -> the operation's canonical typed result
 * It returns that typed result itself — there is no envelope, no second retrieval loop and no authority the
 * caller can hand itself. This module owns the three general-report specifics:
 *   - the real operation reference and request of each declared source, built from the trusted selected
 *     subject/window and from a citation's own stored locator, never from model prose;
 *   - admission of the returned result by the canonical receiver the source family already owns;
 *   - the evidence that result actually carries, and nothing more.
 *
 * Only what a real DTO proves is treated as evidence. A stored mail section proves an exact UTF-16 range of a
 * named immutable record version: the citation id, record version and content hash are the DTO's own fields
 * and the characters we received are hashed as read. A research-portfolio evidence projection proves nothing
 * about bytes — its own coverage says whether source bytes were verified — so it is carried as a preserved
 * claim and is never upgraded into byte verification or into artifact evidence. */
import {artifactValidators as v,assertMailThreadSourcePage,assertResearchPortfolioEvidenceOutput} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createHash} from 'node:crypto';
import {fail,text} from './input.mjs';
import {citedReportOperation} from './skill.mjs';
/** The exact bytes we received: a passage is bound by the hash of its UTF-8 text, not of a JSON string. */
const passageDigest=value=>createHash('sha256').update(Buffer.from(value,'utf8')).digest('hex');

/** Mail reads select one message, so only citations of that same thread/message may share a read. */
export const readKey=citation=>citation.kind==='mail'?`mail:${citation.threadId}:${citation.messageId}`:`portfolio-evidence:${citation.origin}:${citation.portfolioId}:${citation.recordId??''}`;
/** One real read per distinct cited locator, in first-citation order. */
export function citedReportReadGroups(input,selected){
 const groups=new Map();
 for(const finding of input.findings)for(const citation of finding.citations){
  const key=readKey(citation);
  if(groups.has(key))continue;
  groups.set(key,citation.kind==='mail'
   ?Object.freeze({key,sourceId:'mail',kind:'mail',operation:citedReportOperation('mail.read_thread'),
     request:Object.freeze({subject:Object.freeze({kind:'client',entityId:selected.subject.entityIds[0]}),threadId:citation.threadId,messageId:citation.messageId,messageOffset:0,bodyOffset:0,limit:1,maxCharacters:2000})})
   :Object.freeze({key,sourceId:'research_portfolios',kind:'portfolio',operation:citedReportOperation('get_research_evidence'),
     request:Object.freeze({origin:citation.origin,portfolioId:citation.portfolioId,...(citation.recordId===undefined?{}:{recordId:citation.recordId})})}));
 }
 return [...groups.values()];
}
/** Admit one returned typed result with the source family's own receiver, then bind it to this run. */
export function admitRead(group,value,{context,selected}){
 if(group.kind==='mail'){
  const page=assertMailThreadSourcePage(value,group.request);
  if(v.hash(page.binding)!==v.hash(context.binding)||v.hash(page.window)!==v.hash(selected.window)||
   page.subject.kind!=='client'||v.hash(page.subject.entityIds)!==v.hash(selected.subject.entityIds)||
   v.hash(page.subject.scopes)!==v.hash(selected.subject.scopes))fail('CITED_REPORT_READ_BINDING');
  return {key:group.key,sourceId:group.sourceId,kind:'mail',operation:v.snapshot(group.operation),request:group.request,resultSha256:v.hash(value),
   coverage:v.snapshot(page.coverage),sources:v.snapshot(page.sources),continuation:v.snapshot(page.continuation),
   snapshotVersionId:page.snapshotVersionId,evidenceReady:page.evidenceReady,page};
 }
 const result=assertResearchPortfolioEvidenceOutput('get_research_evidence',value,group.request,{binding:context.binding,subject:selected.subject});
 if(v.hash(result.binding)!==v.hash(context.binding))fail('CITED_REPORT_READ_BINDING');
 // A projection has no source inventory, continuation or snapshot identity of its own: none is invented.
 return {key:group.key,sourceId:group.sourceId,kind:'portfolio',operation:v.snapshot(group.operation),request:group.request,resultSha256:v.hash(value),
  coverage:v.snapshot(result.data.coverage),result};
}
/** The verified excerpt of one cited stored message: same thread, same message, inside the section we read. */
function mailLink(read,citation,{context,asOf}){
 const page=read.page,message=page.messages.find(candidate=>candidate.messageId===citation.messageId&&candidate.threadId===citation.threadId);
 if(!message)fail('CITED_REPORT_CITATION');
 // Only a stored, versioned, hash-bearing message can be presented as a verified excerpt.
 if(message.citationId===null||message.contentSha256===null||message.recordVersionId===null||message.removed===true)fail('CITED_REPORT_CITATION_UNPROVEN');
 const source=page.sources.find(candidate=>candidate.sourceId===message.sourceId),section=message.section;
 if(!source||section.text===null||citation.start<section.start||citation.end>section.endExclusive)fail('CITED_REPORT_CITATION_UNREAD');
 const passage=section.text.slice(citation.start-section.start,citation.end-section.start);text(passage,6000);
 if(Date.parse(source.retrievedAt)>Date.parse(asOf))fail('CITED_REPORT_CITATION_UNREAD');
 if(message.scopes.some(scope=>!context.scopes.some(current=>v.hash(current)===v.hash(scope))))fail('CITED_REPORT_CITATION');
 const evidence=v.nativeSourceEvidence(v.snapshot({sourceId:message.sourceId,recordId:message.messageId,sourceVersionId:message.recordVersionId,citationId:message.citationId,
  contentSha256:message.contentSha256,scopes:message.scopes,observedAt:source.retrievedAt,sourceUpdatedAt:null,binding:page.binding}));
 return {kind:'mail',status:'verified',citation:Object.freeze({sourceId:message.sourceId,recordId:message.messageId,sourceVersionId:message.recordVersionId,start:citation.start,end:citation.end}),
  passage,passageSha256:passageDigest(passage),citationId:message.citationId,contentSha256:message.contentSha256,observedAt:source.retrievedAt,
  bodyCompleteness:message.bodyCompleteness,section:Object.freeze({start:section.start,endExclusive:section.endExclusive,totalCodeUnits:section.totalCodeUnits,hasMore:section.hasMore}),evidence};
}
/** The preserved claim of one cited portfolio evidence projection: its own coverage, never a byte proof. */
function portfolioLink(read,citation){
 const data=read.result.data;
 if(data.portfolioId!==citation.portfolioId||data.origin!==citation.origin||(citation.recordId!==undefined&&data.id!==citation.recordId))fail('CITED_REPORT_CITATION');
 const coverage=data.coverage;
 return {kind:'portfolio-evidence',status:'claimed',citation:Object.freeze({sourceId:'research_portfolios',portfolioId:data.portfolioId,origin:data.origin,recordId:data.id??null,
   portfolioRevision:data.portfolioRevision??null,contentHash:data.contentHash??null,calculationVersion:data.calculationVersion??null}),
  coverage:Object.freeze({scope:coverage.scope,sourceView:coverage.sourceView,corpusComplete:coverage.corpusComplete,sourceBytesVerified:coverage.sourceBytesVerified}),
  limitations:Object.freeze([...coverage.limitations,...(data.limitations??[])]),observedAt:data.observedAt??data.readAt??data.updatedAt??null,evidence:null};
}
/** Bind every citation to an admitted read of its own locator and to nothing else. A citation whose read was
 * refused is refused here too, so an unread passage is never presented and never taken as agreement. */
export function assessFindings(findings,reads,{context,asOf}){
 const byKey=new Map(reads.map(read=>[read.key,read]));
 return findings.map(finding=>{
  const citations=finding.citations.map(citation=>{
   const read=byKey.get(readKey(citation));
   if(!read)fail('CITED_REPORT_CITATION_UNPROVEN');
   return read.kind==='mail'?mailLink(read,citation,{context,asOf}):portfolioLink(read,citation);
  });
  if(finding.kind==='excerpt'&&citations.some(link=>link.status!=='verified'))fail('CITED_REPORT_CITATION_UNPROVEN');
  // A quoted excerpt IS the stored passage: a quote that differs from the characters we read is a fabricated
  // quotation with a real locator, and it is refused rather than printed as verified.
  if(finding.kind==='excerpt'&&citations[0].passage!==finding.text)fail('CITED_REPORT_CITATION_UNPROVEN');
  const passages=citations.filter(link=>link.passageSha256).map(link=>link.passageSha256);
  // Only an excerpt is itself verified. A claim is model prose: when every citation is byte-verified it is
  // `cited`, otherwise `claimed`; neither label upgrades the claim text into read evidence.
  return {id:finding.id,kind:finding.kind,text:finding.text,
   status:finding.kind==='excerpt'?'verified':citations.every(link=>link.status==='verified')?'cited':'claimed',
   conflict:passages.length>1&&new Set(passages).size>1,citations};
 });
}
