# Legal citation precedence extension — 17 October 2026

Base: `a945196efcd417a2ed09bcbacfae876acbefd2c3`, tree `2826443929c4ef797ff52e15e0bb4b296eb4e678`, task branch `codex/meri-read-completion-next-20261017`. The coordinator's [implementation outline](CODEX-READ-COMPLETION-OUTLINE-20261017.md) allocates only the pure legal selector and its tests. No Core, central retrieval schema, handler, runtime owner, SDK, credential, startup, lockfile or deployment edit belongs to this change.

## Implemented condition

`get_legal_reference` admits a nonempty citation exactly when its native selection is independent of the parser result:

```js
raw.view === 'rules' || raw.view === 'versions' ||
(Boolean(raw.referenceId) && ((raw.edition ?? '') === '' || raw.code === 'constitution'))
```

Every other/default view follows the references branch. Existing canonical request validation and bounds still apply. Truthiness is native JavaScript truthiness: the selector is not trimmed or rewritten. In particular, a whitespace reference ID remains an explicit truthy ID rather than becoming an implicit parsed reference. Case/whitespace variants of `constitution` do not acquire its exact native behavior.

Original flat request bytes/data and its canonical request hash are preserved. The context remains `{clientResolution, citationResolution:null}`. No parser is implemented, imported or simulated in production; no parsed fact or current authority is fabricated. Names and truthy folders remain unavailable, and selected client UUIDs still require the existing exact client/resource subject and current native grants. This operation/family remains PARTIAL_INPUT and receives no SDK promotion here.

## Source evidence and failure semantics

Source pin: `neo-capiro/capiro-backend@b525032222515d636b0dae2d46e40c7c3d8b5528`.

- [Native read dispatch](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/keywords/keyword-meri.controller.ts#L79-L85) chooses rules or versions directly and never calls the citation parser in those branches.
- [References implementation](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/apps/intel-api/src/tracker/research/research.service.ts#L425-L450) enforces the 180-unit citation bound before its pure parser calls. A truthy explicit reference ID bypasses `legalReferenceKey(parsed)`; it also disables citation title fallback in the SQL condition. Parsed constitution citations can otherwise suppress edition, so an effective edition remains held unless the raw code explicitly forces constitution behavior. The raw code filter itself is preserved.
- [The existing pure parsers](https://github.com/neo-capiro/capiro-backend/blob/b525032222515d636b0dae2d46e40c7c3d8b5528/packages/shared/src/legislative-research.ts#L45-L98) return a reference or null for bounded strings. They do not call the identity validator. Consequently a deeply subdivided citation cannot trigger the identity validator through an explicit-ID branch; the implicit-ID branch remains held. Native HTTP/parser/domain failures still propagate as failures rather than rewritten empty results.
- Frozen `packages/contracts/retrieval-0.2/research-legal-legislation-validation.mjs:41` has matching explicit-ID and constitution/edition precedence. Tests compare normalized selection with null, statute and constitution resolution facts for every admitted reference case; no test installs a parser or treats hypothetical facts as authority.

Fresh default `HEAD` file reads were also checked through the supported GitHub connector. Both relevant whole-file blobs match the pinned source exactly: ResearchService `2f7be267858af4de0039f33c73d139b7dd7bb562`; shared legislative research `ce3c93ae310885884a20f0a169062a9378dcdfb0`. No relevant source drift was observed in those files. This is source evidence only, not a live installation claim.

## Verification and handoff

Changed `apps/gateway/sources/research-legal-legislation/request-context.mjs`; added `test/citation-precedence.test.mjs`; adjusted the two existing selector-test citation cases to use the still-held references branch and replaced the obsolete blanket citation refusal assertion with implicit-ID/effective-edition refusals. Accepted ignored/overridden cases are now tested positively; name, folder, authority, parser-dependent, malformed and native-failure coverage remains.

Focused Node 24 run, `--preserve-symlinks --max-old-space-size=256 --test --test-concurrency=1`, selected the new citation tests and three intentionally affected existing tests using `--test-name-pattern 'citation precedence|parser-dependent reference citations|unsupported citations'`.

- **18/18 passed**, zero failed/skipped/cancelled, process exit 0; duration 1963.6018 ms.
- [Raw output](read-completion-20261017/legal-citation-precedence-focused.initial.txt) and [exact command/status metadata](read-completion-20261017/legal-citation-precedence-focused.initial.json) are retained. There was no failed run.
- No settled broad suite, dependency installation, archive, live source call or background task was run. The task-owned test session exited.

Production selector bytes are frozen for independent review by `read_family_audit` and coordinator integration. Full operation completion still requires the remaining trusted name/folder/general-citation seams. No commit, stage, source publication or live qualification is claimed by this author.
