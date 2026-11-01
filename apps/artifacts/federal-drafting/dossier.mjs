/** The reviewed revision as the existing typed Word request: provenance (source identity, source hash, retained
 * source artifact, revision hash, approval state), the operative instructions, the exact consolidated text and the
 * legal comparison. The canonical renderer owns the DOCX bytes; this builds only the exact request. */
import {artifactValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
const fault=code=>{throw Object.assign(Error(code),{code,operationId:null});};
const paragraph=(runs,style)=>({kind:'paragraph',...(style?{style}:{}),runs});
const p=(text,style)=>paragraph([{text}],style);
const lines=text=>text.split('\n');
export const FEDERAL_DOSSIER_LEGEND='Legal comparison: unchanged text is plain, struck text is italic, inserted text is bold. Each paragraph is one source line.';

/** Segments become runs; a newline inside a segment starts the next paragraph so every source line stays one paragraph. */
function comparisonParagraphs(segments){
 const style={unchanged:{},delete:{italic:true},insert:{bold:true}},paragraphs=[];let runs=[];
 for(const segment of segments){
  const parts=lines(segment.text);
  parts.forEach((part,index)=>{
   if(index>0){paragraphs.push(paragraph(runs.length?runs:[{text:''}]));runs=[];}
   if(part)runs.push({text:part,...style[segment.kind]});
  });
 }
 paragraphs.push(paragraph(runs.length?runs:[{text:''}]));
 return paragraphs;
}
export function federalDraftDossier(prepared,approval=null){
 const {draft,sourceArtifact,revisionSha256}=prepared,source=draft.source;
 const blocks=[p(`Federal review dossier: ${source.documentId}`,'Title'),p('Provenance','Heading 1'),
  p(`Document ${source.documentId}; publisher ${source.publisher}; version ${source.sourceVersion}; published ${source.publishedAt??'unreported'}.`),
  p(`Source locator (a locator, not verification): ${source.sourceUrl}`),
  p(`Source text SHA-256 ${source.sha256}; parser ${source.parserVersion}; coverage ${source.coverage.complete?'complete':'partial'}.`),
  p(`Retained source artifact version ${sourceArtifact.versionId}; object SHA-256 ${sourceArtifact.sha256}; spec SHA-256 ${sourceArtifact.specSha256}.`),
  p(`Revision SHA-256 ${revisionSha256}; compiled revision SHA-256 ${draft.revisionSha256}.`),
  p(approval===null?'Approval: unapproved revision.':`Approval: approved revision ${approval.revisionSha256}; approved review version ${approval.reviewVersionId}.`),
  ...source.coverage.limitations.map(text=>p('Source limitation: '+text)),
  ...draft.findings.filter(f=>f.status!=='passed').map(f=>p(`Unresolved: ${f.category} (${f.severity}) at ${f.location}.`)),
  p('Operative amendment','Heading 1'),...lines(draft.outputs.operative).filter(Boolean).map(text=>p(text)),
  p('Consolidated text','Heading 1'),...(draft.resultKind==='source-text-removed'?[p('Proposed source-text removal: the separate consolidated TXT export contains exactly zero bytes. This review record does not establish enactment or legal effect.')]:lines(draft.outputs.consolidated).map(text=>p(text))),
  p('Legal comparison','Heading 1'),p(FEDERAL_DOSSIER_LEGEND),...comparisonParagraphs(draft.outputs.segments)];
 try{return artifactValidators.request({operation:'create_word',format:'docx',title:`Federal review dossier: ${source.documentId}`.slice(0,160),content:{blocks}});}
 catch{fault('DRAFT_OUTPUT_UNEXPORTABLE');}
}
