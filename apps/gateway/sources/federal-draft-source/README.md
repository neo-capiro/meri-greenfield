# Federal source and deterministic draft preparation

Catalog 0.2.28 adds two operations and retains the previous 152 operation descriptors unchanged. Both use the existing native read gateway, current Core identity and conversation scope, and the existing bill-text source requirement. The runner receives no Core secret. Catalog registration does not enable or qualify a deployment.

- `read_federal_draft_source`: exact current bill/version/revision/content/text pins, fixed Core route, bounded complete text and explicit source limitations. The receiving fixture is the actual synthetic PostgreSQL-backed Core serialization.
- `prepare_federal_draft`: `{selection, operations}`. The gateway reads that exact source through the same fixed Core route and runs the existing deterministic compiler. The initial scope is `document`, with the full text hash as `expectedScopeSha256`. Subsequent edits to that scope require the prior operation dependency and new intermediate hash.

Preparation returns the native source, an unapproved exact revision, and three separate ordinary `create_word`/TXT requests: operative amendment, consolidated text and typed redline. It performs no artifact write, approval or model call. Existing artifact publication, current access, immutable versions, delivery journal and approval owners still govern each output. A changed preparation cannot be treated as approval of a prior output request. The focused integration test publishes and downloads all three exact outputs through the existing artifact service; it does not claim a human-review UI is connected.

Missing publication dates remain null and render as unreported. Modified and fetched dates stay in exact canonical source metadata and never replace publication. Source metadata, parser limitations, original content and extraction hashes are included in the compiled revision. Enactment, legal currency, structured legal parsing and substantive correctness remain unresolved.

Attended preparation is composed into the native SDK read surface. Saved-job preparation is explicitly unavailable; it cannot use an attended source alias to widen that owner's closed operation list. Deployed/native installation and activation remain unqualified.

The SDK tool keeps the frozen flat-text contract: a retained extraction that is USLM or other markup is refused here with `DRAFT_SOURCE_FORMAT_UNSUPPORTED`; the document application's workbench routes import USLM with section identity, save reviews with approval and history, and export TXT/DOCX (`apps/artifacts/federal-drafting/README.md`). Legal/Office fidelity qualification and live acceptance remain outstanding; the flat bounded compiler and connected native preparation are not full A5 acceptance.
