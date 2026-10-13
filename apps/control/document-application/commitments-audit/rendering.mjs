/** Editable presentation of the existing commitment ledger, without new semantic claims. */
export const marker='Meri Commitments Audit provenance: ';
const p=(text,style='Normal')=>({kind:'paragraph',style,runs:[{text}]});
export function blocks(input,selection,ledger,unresolved,provenance){
 const out=[p(input.title,'Title'),p('Commitments Audit | Editable review draft'),p('Original selected skill quick_skill.commitments_audit@1.0.0'),
  p('Audit reference '+input.asOf+'; collected through '+ledger.asOf),p('Exact client/window '+JSON.stringify({subject:selection.subject,window:selection.window})),
  p('Commitment ledger','Heading 1'),p('Promise, suggestion, owner, due date, tracking link and delivery meanings are extracted unverified observations. A native completed flag, URL or quoted passage alone never establishes delivery or acceptance.')];
 for(const row of ledger.commitments){
  out.push(p(row.observationIds.join(', ')+' | '+row.status,'Heading 2'),p('Original promise excerpt: '+row.promise.quote),
   p('Owner '+row.owner.status+': '+(row.owner.value??row.owner.candidates.join(' / ')??'unknown')),
   p('Due date '+row.dueDate.status+': '+(row.dueDate.value??row.dueDate.candidates.join(' / ')??'unknown')),
   p('Completed: false. Tracking '+row.tracking.length+'; delivery claims '+row.deliveryClaims.length+'. Proposed tracking links remain unverified.'),p('Follow-up suggestion: '+row.followUp));
  for(const evidence of[row.promise,...row.tracking.map(r=>r.passage),...row.deliveryClaims.map(r=>r.passage)]){
   out.push(p('Bound-source-excerpt: '+evidence.quote),p(`Source ${evidence.sourceId}; record ${evidence.recordId}; immutable version ${evidence.recordVersionId}; citation ${evidence.citationId}.`),
    p(`UTF-16 ${evidence.start}-${evidence.end}; Full body SHA256 ${evidence.contentSha256}; passage SHA256 ${evidence.passageSha256}.`),
    p('Scope '+JSON.stringify(evidence.scopes)+'; authorization decision '+evidence.authorizationDecisionId+'; observed '+evidence.observedAt+'; authority '+evidence.authority+'; freshness '+evidence.freshness));
  }
 }
 if(!ledger.commitments.length)out.push(p('No bound promise observation was compiled in the checked portion. This does not establish that no commitments exist.'));
 out.push(p('Suggestions and unresolved observations','Heading 1'));for(const row of ledger.suggestions)out.push(p('[suggestion, unverified] '+row.passage.quote));
 for(const row of unresolved)out.push(p('[unbound observation, requires review] '+row.id+' | '+row.reason+' | '+(row.passage?.quote??'')));
 out.push(p('Coverage and verification appendix','Heading 1'),p('Every original required source is shown. All source authenticity, current policy, snapshot, enumeration and semantic completion remain unqualified unless separately accepted. Missing or unrequested material is not empty; no negative claim is supported.'));
 for(const cell of ledger.coverage)out.push(p(cell.sourceId+' | '+cell.status+' | freshness '+cell.freshness+' | enumeration '+cell.enumeration+' | complete '+cell.complete),
  p('Coverage details '+JSON.stringify(cell)));
 for(const material of provenance.materials){out.push(p('Retained material '+material.sourceId+' / '+material.recordId+' / '+material.recordVersionId),p('Citation '+material.citationId+'; local derived references are presentation keys, not native citations or proof of authority. Metadata '+JSON.stringify(material.metadata)));}
 for(const gap of provenance.gaps)out.push(p('Missing source/read '+gap.operation+': '+gap.reason));for(const cap of provenance.collection.capHits)out.push(p('Read cap '+JSON.stringify(cap)));
 ledger.limitations.forEach(limit=>out.push(p('Limitation: '+limit)));
 out.push(p('Original skill and immutable revision provenance','Heading 2'),p(marker+JSON.stringify(provenance)));return out;
}
