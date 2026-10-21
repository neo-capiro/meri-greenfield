# Conversational write receiving outline

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`, verified descendant of frozen source `34851020aa0d73fead4db59ba6e26a098e2d0313`.
Branch: `codex/meri-conversational-writes-20261019`. PR189 (`231122607ff16c67a8fe19f8e945b2f8776431ae`) remains independent. No PR189 source is assumed here.

## Source-verified gaps

| Capability | Existing owner | Missing connection at base |
| --- | --- | --- |
| PowerPoint | Pinned PptxGenJS generator; canonical immutable artifact service/storage; current Core artifact authority | Document format admission, durable replay allowlist and intent preparer exclude PPTX. Production intent mount supplies only task creation. CLI does not supply artifact authority ports. |
| Analysis | Typed ZIP artifact generator; separately admitted sandbox boundary and canonical durable analysis executor | No intent preparer/composition; sandbox needs actual manifest/image admission/verifier/port. Pending sandbox outputs are not published ArtifactVersions. |
| Memory | `memory.propose` canonical payload/result validation; pending-only governed Core W8 source, durable Meri candidate and review owners | Task-only approval-metadata registry, preparation mapping and production command routing. Core native record/issuance/receiver admit only task creation. Legacy `save_memory` is not a safe substitute. |
| Attachment filing | `artifact.file` payload/result validation; generic durable command executor, artifact filing resolver | Metadata/preparation mapping; trusted exact-version attachment registration/custody owner. Original chat-upload metadata does not establish immutable Meri artifact custody. Core native record/issuance/receiver are task-only. |

Catalog admission, source integration, native qualification and live success are separate states. The catalog's `qualified-source-review` boundary permits immutable artifact drafts under current artifact authority; filing/sharing remains a separately approved command. Saving memory submits a pending candidate, never commits memory inline.

## Implementation order and ownership

1. Artifact lane extends existing admission/replay and implements analysis preparation with truthful draft/pending states.
2. Memory and attachment lanes implement action codecs/preparation over existing canonical command owners, with current source/destination checks.
3. Metadata lane generalizes the existing immutable metadata state machine through a closed action registry; no parallel approval system or persistence table.
4. Integration owner connects existing document authority/session/application into the ordinary intent mount, shared routing and result validation. Unsupported external bindings stay explicit.
5. Run focused lane checks, receive coherent commits, then one combined affected suite and runtime typecheck. Preserve failed evidence and refresh only successor source proofs, never historical image receipts.
6. Publish a separate review branch and consolidated Git handoff, including the smallest Core/frontend dependency contracts and exact integration order.

No frozen input, PR175, PR189, Core/frontend source, deployment configuration, live database, credentials, image build or production action is changed by this assignment.
