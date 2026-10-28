---
name: meri-cited-report
description: Compile an explicitly selected general long-form cited report for a client, portfolio or personal subject from current authorized source evidence into an editable seven-section Word document. Bill-specific and congressional questions stay with Bill Watch; this recipe never requires, invents or aliases a bill or Congress subject.
disable-model-invocation: true
---

# Cited Report

Produce one long-form cited report for the subject the trusted request selected. The recipe is general:
its subject is a client, an authorized client portfolio, or the caller's own personal scope. It has no bill,
session, chamber or fiscal-year requirement, and it must never be requested as, described as, or answered as
Bill Watch.

## Output

The recipe's own identity is `quick_skill.cited_report` at exactly version 1.0.0; it is selected explicitly and
never falls back to another version or another workflow.

An editable Word document with the accepted seven sections, always in this order:

1. Summary
2. Scope and as-of
3. Findings
4. Conflicting evidence
5. Recommendations
6. Limitations
7. References

Every Findings entry is either a verbatim excerpt of a cited passage or a claim supported by citations. A
citation names its source, record, immutable source version and the exact character range inside the record;
the recipe reads those characters from a decisive read — a canonical source-read the gateway owns — and binds
them by hash. Unequal cited passages are disclosed as possible conflicts. Unequal text is not proof of a
semantic contradiction, and an unread passage is never evidence of agreement.

## Scope

The report covers exactly the selected subject and the selected window. The subject, its scopes and the
window arrive from the trusted selection; they are never taken from model output, and a read for another
tenant, client, portfolio or actor is refused. Missing, stale, partial, truncated, unavailable or
continuation-required evidence is disclosed in Limitations and never asserted as absence.

## Sources

Evidence comes from the existing authorized read owners declared by this recipe's manifest: client
knowledge search, stored mail, and the research portfolio evidence. Evidence coverage travels with every
citation: a read that is partial, truncated, unavailable or continuation-required is disclosed in
Limitations, and absence is never asserted from it. The canonical artifact owner records the resulting
document version; the recipe itself makes no call, no mutation and no grant, and publication remains a
separate immutable approval proposal.

## Revision

A revision keeps the immutable parent's version, object hash, specification hash and retained source
evidence, records the parent in immutable provenance, and may never roll the as-of backwards. A parent that
does not carry this recipe's provenance, belongs to another binding or scope, or carries assets of its own
is refused rather than silently replaced.

## Known limitations

- General branding, cover treatment and the whitepaper template/entry decision are not part of this version;
  the seven confirmed sections above are.
- The recipe is one bounded document compiler. It does not add retrieval capability, a route, a second model
  loop or any authority beyond the reads its manifest declares.
- Native document rendering and Meri semantic evaluation are separate qualifications, not established here.
