---
name: meri-bill-watch
description: Produce the sourced cited report for one explicitly selected congressional bill identity — seven sections, decisive gateway-owned reads and exact cited passages. This version is congressional only: it does not replace the ordinary federal/state Bill Watch workflow, and a general branded report is not provided here.
disable-model-invocation: true
---

# Sourced cited report (private recipe prose)

Installed identity: quick_skill.bill_watch, version 2.0.0. This recipe is one report output of the
bill-watch family; it is not the general Bill Watch workflow, it does not qualify that workflow's
source adapters, and it is not yet a general branded report. Its subject is one explicitly selected
congressional bill identity, and its sources are the bill/legislation/program-element reads named in
its manifest. Anything outside that legislative subject and those sources is out of scope here.

Deliverable: one editable DOCX report with exactly seven sections, in this order.

1. Summary — a short draft narrative. It is narrative, not evidence: it is never a verified claim,
   and every factual assertion in it must be traceable to a Findings entry the reader can inspect.
2. Scope and as-of — Congress, session, bill identity and version, fiscal year and budget stage, and
   the as-of instant of the reads. A later revision may not roll the as-of backwards.
3. Findings — the bounded set of cited facts the requester supplied. Each entry keeps its identifier,
   its verification status derived from the decisive read, and its citations with exact character
   offsets. Free-form claims stay unverified.
4. Conflicting evidence — the unequal cited passages that were actually read, and any named conflict
   the requester identifies for a finding that is genuinely in conflict. Unequal text is disclosed as
   a possible conflict, never asserted as a proven semantic contradiction.
5. Recommendations — draft recommendations for human review. They are proposals, not findings.
6. Limitations — the stated limitations plus the coverage limitations of each source read: missing,
   partial, stale, unavailable, truncated and continuation-required evidence is disclosed. Missing or
   partial evidence never establishes absence.
7. References — every source read with its status, reason code, freshness, snapshot, adapter version,
   coverage and timing, followed by the exact cited passages and their hashes, and, for a revision,
   the retained evidence of the immutable parent.

Rules that hold for every section:

- Only a gateway-owned decisive read may produce evidence. The report never authenticates a citation
  the requester supplied, and a citation that was not read is reported as missing evidence.
- Every excerpt must byte-match the passage it cites. A mismatch is reported, not repaired.
- Original skill and immutable revision provenance is recorded in the document: the skill pin, the
  selected subject and window, the subject, the as-of, the exact source ids and versions, and, on
  revision, the immutable parent version, object hash and spec hash. That record is part of the
  retained bytes.
- A revision replaces the document body in full. Nothing the parent retained may be dropped silently:
  the parent's evidence survives in the report and in the artifact version, and retained assets are
  re-presented by the trusted owner rather than re-derived by a model.
