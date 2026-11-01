# Remaining drafting contracts — what is implemented and what stays proposed

The retained requirements are Core `docs/meri/implementation/02-Meri-Coworker-and-Congressional-Drafting.md` §8.6 and DR-09–16/24–26, program plan §5.7, and the 7 October finish-plan §3.8. They require pinned original formats, reversible locations, explicit intermediate dependencies, atomic preview and useful unsupported outcomes. This record keeps the earlier proposals and states exactly which parts the 1 November 2026 change implements. Nothing here certifies legal effect.

## XML/USLM

Implemented (`federal-uslm-xml/1`, [README](README.md)):

1. A retained USLM extraction imports through the workbench `federal-import` route as raw XML with section identity derived from declared `identifier` attributes by the strict `saxes` reader already adopted for artifact structure. Core's exact selection, text hash and currentness checks are unchanged; no external URL fetch occurs at import or replay.
2. Exact replace/insert/delete apply to markup spans inside an identified element; bytes outside the edited span are preserved and the result is re-read as one well-formed document with the original root before any output exists. Whole-element deletion through the parent is a supported repeal of that unit.
3. The current source/operation/revision hashes, atomicity, review record, approval rule and artifact history apply unchanged. The consolidated XML is exported as exact bytes in a TXT artifact.

Still proposed, not implemented:

- XSD/DTD validation against the pinned USLM `100338992150c276aae5544d01d9b821a27eb383` and bill DTD `18a68dad697ea7447881e0c10dd96dcecbdeb508` assets. Well-formedness and the declared namespace are checked; schema validity is not claimed. A DOCTYPE is refused rather than resolved.
- Decoded text-run anchoring (operations expressed over rendered text with reversible run offsets, refusal across an intervening `<ref>`), node replacement, renumbering, tables and page/line metadata. Today an anchor is literal markup text; inserted text is literal markup and must leave the document well-formed.
- A Core raw-format projection carrying the original bytes and declared schema version. Today the USLM baseline is Core's retained extracted text when that extraction is XML; the frozen SDK `prepare_federal_draft` tool stays flat-only and refuses markup explicitly.

## Whole-source removal / proposed repeal

Implemented in the retained workbench successor: explicit terminal `remove_source_text` binds original source and current intermediate text hashes and all preceding dependencies, requires complete coverage, and produces typed `source-text-removed` with genuine zero-byte consolidated TXT. The existing generic TXT artifact path already supports empty bytes; no generic storage/schema relaxation was necessary. Old saved revision hashes and the frozen SDK operation grammar remain unchanged. Ordinary delete-to-empty still refuses `DRAFT_WHOLE_SOURCE_REPEAL_UNSUPPORTED`; a typed removal is a distinct proposed outcome and never an enactment claim. The public receiver, immutable review/load/history and byte-exact export tests cover the new semantics. Package shipment, physical rendering and deployed acceptance remain separate requirements.

## Review approval

Implemented: approval as an immutable child version of the exact approved review, bound to the recompiled revision hash; any revision is unapproved by construction and a stale approval is an invalid record. Exports cite the saved review they come from and are approved only when that exact version carries an approval for that exact revision. History lists every retained review version with its approval state. Review approval is a workflow record, not legal approval or enactment.
