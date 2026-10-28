---
name: meri-cited-report
description: Compile an explicitly selected general long-form cited report for the trusted selected client subject from current authorized source evidence into an editable seven-section Word document. Bill-specific and congressional questions stay with Bill Watch; this recipe never requires, invents or aliases a bill or Congress subject.
disable-model-invocation: true
---

# Cited Report

Produce one long-form cited report for the subject the trusted request selected. The recipe is general: it has
no bill, session, chamber or fiscal-year requirement, and it must never be requested as, described as, or
answered as Bill Watch.

## Output

The recipe's own identity is `quick_skill.cited_report` at exactly version 1.0.0, declared at manifest
contract version 0.3.0 and admitted by the versioned 0.3.0 manifest receiver; it is selected explicitly and
never falls back to another version or another workflow.

An editable Word document with the accepted seven sections, always in this order:

1. Summary
2. Scope and as-of
3. Findings
4. Conflicting evidence
5. Recommendations
6. Limitations
7. References

Every Findings entry is either a verbatim excerpt of a cited stored passage or a claim supported by citations.
A citation names the real read locator: a stored mail thread, message and exact UTF-16 character range, or a
portfolio evidence record. The compiler re-reads each cited locator through the selected runtime's own typed
read and reports a citation as verified only when the returned source result proves it — the excerpt's
characters come from the stored record section we received, and the citation id, immutable record version and
content hash are the source result's own fields. Unequal cited passages are disclosed as possible conflicts.
Unequal text is not proof of a semantic contradiction, and an unread passage is never evidence of agreement.
A citation whose read is refused refuses the report; it is never restated as if it had been read.

## Scope

The report covers exactly the selected subject and the selected window. The subject, its scopes and the window
arrive from the trusted selection; they are never taken from model output, and a read for another tenant,
client, portfolio or actor is refused. The current selected path resolves a client subject, so this version
declares and supports client subjects only; a portfolio or personal selected subject is an outstanding
dependency on the selected selection owner, not a scope this recipe may assume. Missing, stale, partial,
truncated, unavailable or continuation-required evidence is disclosed in Limitations and never asserted as
absence.

## Sources

Evidence comes from the read owners declared by this recipe's manifest, using their real operation contracts:
stored mail (`mail.read_thread@0.2.0`) and research portfolio evidence (`get_research_evidence@0.2.0`). Reads
are made only for the locators a finding cites, one decisive typed read per distinct locator, and each returned
result is admitted by the canonical receiver that source family already owns. Coverage, source state and
continuation travel with every read into Limitations and References: a read that is partial, truncated or
continuation-required is disclosed, and absence is never asserted from it. A portfolio evidence projection is
deliberately narrower than its sources; it is carried as a preserved claim with its own coverage, never
recomputed and never upgraded into byte verification or artifact evidence. The canonical artifact owner
records the resulting document version; the recipe itself makes no call, no mutation and no grant, and
publication remains a separate immutable approval proposal.

## Revision

A revision keeps the immutable parent's version, object hash, specification hash and retained source evidence,
records the parent in immutable provenance, and may never roll the as-of backwards. A parent that does not
carry this recipe's provenance, belongs to another binding or scope, or carries assets of its own is refused
rather than silently replaced.

## Known limitations

- General branding, cover treatment and the whitepaper template/entry decision are not part of this version;
  the seven confirmed sections above are.
- Client-knowledge-search projections are not a source of this recipe: their typed result carries no subject
  or stored-record lineage, so the current selected-output retention owner would refuse a read of it.
- The recipe is one bounded document compiler. It does not add retrieval capability, a route, a second model
  loop or any authority beyond the reads its manifest declares.
- Native document rendering and Meri semantic evaluation are separate qualifications, not established here.
