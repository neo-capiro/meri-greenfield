# Word drafting application continuation

Status: **ACCEPT_SOURCE** after independent review; native/runtime qualification remains HOLD. Base is PR49 `b5243ae164f68c7591b039e8365d9897390543d2`; source acceptance is distinct from native qualification.

## Requirement and expected outcome

This increment implements the missing application path for R2 W07/native artifacts and selected `create_word`: create a Word draft, request a typed replacement based on an exact version, inspect retained versions and download either original or revision. Original DOCX content survives revision. The planned Claude Agent SDK supplies natural-language/model behavior; this path executes its typed document requests without introducing a second loop. This is generic local drafting. Native meeting/memo source mutations remain deferred and filing remains a separate approved command.

Discovery found existing artifact generation, lineage, resource authorization, immutable storage and shared-budget owners with no non-test application/controller caller. The change wires them instead of adding a generator, identity system, persistence subsystem or registry. Ordinary ToolDispatch does not accept the artifact-execution profile; the existing dedicated PostgreSQL artifact owner is the correct write path. Its catalog output assertion models creation only; the application correlates revision results against the explicit parent and existing version schema.

## Ownership and implementation

- New document application: fixed create/revise/inspect/download routes, trusted server context, existing opaque sessions and current-state rechecks, safe attachment responses. Bodies carry typed document requests and delivery/version identifiers only.
- Existing artifacts/service.mjs: immutable versions, original bytes, resource authorization, inspection, downloads and uncertain-effect reporting.
- Existing artifacts/postgres-service.mjs and gateway budget owner: writes charged to the existing run allocation, durable delivery identity, settlement and replay refusal. No new accounting algorithm.
- Existing local executor and python-docx: real DOCX generation for the disposable source fixture. Existing local store retains objects and versions. Production storage remains separately supplied.
- Existing session issuance and Node HTTP listener: reused unchanged. Frontend and Capiro files are outside this lane.

No existing migration, public 0.1 contract, private artifact 0.2 schema, capability selection or production catalog handler changes. Production source connectivity remains disabled. An explicitly configured fixture can execute the new application.

## Evidence and qualification boundary

The executable path is documented in [the local fixture README](../../../apps/control/document-application/local/README.md). It produces real DOCX bytes over actual loopback HTTP, reopens downloads, checks old/new paragraph and table content, reconstructs the application over retained stores, verifies shared accounting, refuses replay without regeneration, and denies historical downloads after revocation. Synthetic identity and the scripted SQL pool are explicit. All owned child groups, temporary files and sockets must close.

Native PostgreSQL, actual Clerk/current-policy integration, approved worker/sandbox, Office rendering and visual quality, SDK natural-language execution, event publication/frontend consumption, production persistence and source filing are unrun here. `generationStatus:'draft'`, `previewStatus:'pending'` and `nativeQualified:false` are retained. G1 stays OPEN; this increment does not enter or accept G2–G7.

## Accepted source and checks

- Application source: `8e21145f7f4745d20e84c3c2e51efcd93d33483f`; author packet `f36c072509db02f709682db3ff812ef36cff73b6`.
- Independent ACCEPT_SOURCE: `2339dacda10ee9b0d63939c5dee6d6dc39a9e52d`, 37/37 checks passed. The unchanged reviewer tests and raw failures are integrated.
- Root final application/HTTP suite: 21/21 passed at `b4d5380d936d1a7d5e34356c3cdf93eb90578989`, with zero source diff. Exact new production bytes match the independent source freeze.
- Existing canonical artifact, accounting, session, transport and contract regressions: 512/512 passed at `e36f1ae2c2ec3fce512518a8128de4c62bd0e32f`. The later repair changes only the new document adapter; all these existing owners/tests remain byte-identical.
- Actual loopback CLI: PASS with two generated/reopened DOCX versions, exact original/new content, one allocation and two settled synthetic 10 microUSD charges, no unknown liability, replay refusal and revoked historical-download denial. No paid model call or spend occurred.
- Preservation audit: all 11,411 PR49 entries unchanged, including every original test, migration, public/private contract and prior failure. Scope remains 139 originals / 96 selected / 43 deferred; 96 mapped selections, 97 operations, all production handlers null/unavailable with zero retries.
- All 46 author/reviewer manifest members verified. Every captured root process group was freshly absent. Only root-owned borrowed dependency links were removed; donor directories remain. Executable fixture cleanup confirmed child groups, files and HTTP sockets closed.

## Preserved failures and fixes

The first author run had a nonexistent Python path and a malformed paragraph fixture; corrected fixture inputs retain the same required assertions. A new negative control found that the application initially accepted an altered trusted descriptor; the factory now requires the exact canonical create_word descriptor projection.

Independent review found hostile rejected port values could trigger property access inside existing owners before HTTP sanitization. The new adapter now sanitizes borrowed authorization/session/storage/executor/ID rejections before those owners see them. Seven independent pre-repair counterexamples remain in Git and pass unchanged on the accepted repair. Post-write ambiguity remains UNKNOWN or RESULT_NOT_RELEASED; no retry/refund was introduced.

One root combined test command omitted required MERI_REVIEW_SOURCE_ROOT. Its raw failure is retained; the explicit source-bound rerun passed without changing source. Reviewer fixture-only corrections and all raw negative outcomes are also preserved. No failed check was reclassified as a pass.

See `docs/qualification/candidates/document-drafting-20261013/integration/` for exact command receipts, hashes, process cleanup, scope audit and publication receipt. The PR49 endpoint/schema compatibility repair requested later is owned in a separate branch and is not bundled into this document increment.
