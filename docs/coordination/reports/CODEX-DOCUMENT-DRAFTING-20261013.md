# Word drafting application continuation

Status: implementation and independent review in progress. Base is PR49 `b5243ae164f68c7591b039e8365d9897390543d2`; source acceptance is distinct from native qualification.

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

Final source pins, independent verdict, checks, preserved failures and publication receipt will be added after review.
