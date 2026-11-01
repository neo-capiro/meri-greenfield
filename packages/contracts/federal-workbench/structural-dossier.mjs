/** Canonical structural Word material. Pure presentation of a hash-bound prepared projection; not authority. */
const paragraph=text=>({kind:'paragraph',runs:[{text}]}),heading=text=>({...paragraph(text),style:'Heading 1'});
export const FEDERAL_STRUCTURAL_LEGEND='Comparison has separate original and revised views. Deleted text is struck through in the original; inserted text is underlined in the revised. Marks show changed visible text from exact XML differences; they are not Word tracked changes. Tag-only changes and omitted material remain in the raw legal redline.';
const fault=code=>{throw Object.assign(Error(code),{code});};
export function structuralDossierMaterial(prepared,approval=null,format='docx',title){
 const {draft,sourceArtifact,revisionSha256}=prepared,source=draft.source,structure=draft.structuralProjection;
 if(source.parserVersion!=='federal-uslm-xml/3'||structure?.status!=='supported')fault(structure?.code??'DRAFT_STRUCTURAL_UNSUPPORTED');
 if(!['docx','pdf'].includes(format))fault('DRAFT_OUTPUT_UNEXPORTABLE');
 const blocks=[{...paragraph(`Federal review dossier: ${source.documentId}`),style:'Title'},heading('Provenance'),
  paragraph(`Document ${source.documentId}; publisher ${source.publisher}; version ${source.sourceVersion}; published ${source.publishedAt??'unreported'}.`),
  paragraph(`Source locator (a locator, not verification): ${source.sourceUrl}`),
  paragraph(`Source text SHA-256 ${source.sha256}; parser ${source.parserVersion}; coverage ${source.coverage.complete?'complete':'partial'}.`),
  paragraph(`Retained source artifact version ${sourceArtifact.versionId}; object SHA-256 ${sourceArtifact.sha256}; spec SHA-256 ${sourceArtifact.specSha256}.`),
  paragraph(`Revision SHA-256 ${revisionSha256}; compiled revision SHA-256 ${draft.revisionSha256}.`),
  paragraph(approval===null?'Approval: unapproved revision.':`Approval: approved revision ${approval.revisionSha256}; approved review version ${approval.reviewVersionId}.`),
  ...source.coverage.limitations.map(text=>paragraph('Source limitation: '+text)),
  ...draft.findings.filter(f=>f.status!=='passed').map(f=>paragraph(`Unresolved: ${f.category} (${f.severity}) at ${f.location}.`)),
  paragraph('Structural rendering uses an explicit supported subset. Metadata, content marked display=no, inter-element indentation and XML prolog/trailing trivia are omitted with source-span receipts. XML tags, comments and processing instructions are not printed.'),
  heading('Operative amendment'),...draft.outputs.operative.split('\n').filter(Boolean).map(paragraph)];
 const mapping=[],omissions=[];
 const append=(part,label,projection)=>{
  blocks.push(heading(label));const offset=blocks.length;
  if(projection===null){blocks.push(paragraph('Proposed source-text removal: the separate consolidated TXT contains exactly zero bytes. Empty text is not a valid XML document; this proposal does not establish enactment or legal effect.'));return;}
  blocks.push(...projection.blocks);
  mapping.push(...projection.mapping.map(entry=>({...entry,part,blockIndex:entry.blockIndex+offset})));
  omissions.push(...projection.omissions.map(entry=>({...entry,part})));
 };
 append('consolidated','Consolidated text',structure.consolidated);
 blocks.push(heading('Legal comparison'),paragraph(FEDERAL_STRUCTURAL_LEGEND));
 append('original','Original text — deletions marked',structure.original);
 append('revised','Revised text — insertions marked',structure.revised);
 if(blocks.length>1000)fault('DRAFT_OUTPUT_UNEXPORTABLE');
 const request={operation:'create_word',format,title:title??`Federal review dossier: ${source.documentId}`.slice(0,160),content:{blocks}};
 return {request,mapping,omissions};
}
