# Independent package-version assertion repair

**ACCEPT_SOURCE** for `951a7021852b5205357c6780ed2c27527bab9d4d`, tree `02f3887314970794384e26db42a41fa5ca133375`, parent/published PR60 `a2aef4a5fcd3c19cec974dc62b69222836d71b3e`.

The exact entire-file comparison proves one change per mail, meeting-source, memory-proposals and operational-reads test: `pkg.version` expectation `0.1.0`→`0.1.2`. Applying only that replacement to each parent blob reproduces the complete candidate blob. Original schema closure, private export exclusions, unavailable-handler, wire, scope/evidence and behavior assertions remain byte-identical. No implementation, catalog, schema, export or dependency metadata changed.

Independent targeted replay: **90/90 tests pass**, exit 0, no timeout; 3.595 seconds with 240-second cap, process reaped and owned process group absent. **39 source/provenance checks pass**. The root's unchanged retained baseline 90 / 86 pass / 4 fail and repaired 90 / 90 pass / 0 fail TAP are hash-bound and inspected; their baseline is not presented as a new independent execution. The broad 3217 suite was not rerun.

Package and README bytes equal PR54 `70516e5c9681917ce493bbc50e3023494f2e1209`. `@capiro/meri-contracts` package version is 0.1.2, including its additive document receiver; README explicitly distinguishes package version from frozen wire protocol. The `urn:meri:contracts:0.1.0` schema and every public UIEvent branch retain wire `contractVersion:'0.1.0'`. Private retrieval 0.2 remains absent from public exports/files; all production catalog handlers remain null/unimplemented/pending. Test titles referring to public 0.1 remain family/wire descriptions and were not renamed.

The first reviewer source-proof script assumed UIEvent used direct properties and returned a `KeyError`; the actual schema uses `oneOf`. Its source preimage and raw failure remain retained. The repaired proof checks all event branches, without any candidate edit or weakened product assertion. Focused changed-test whitespace passes.

This review accepts the narrow stale-test repair, not new mail/meeting implementation or native source access. No DB, provider, model, cloud, credential, private artifact transfer or production operation ran. The reviewer removes only its borrowed dependency link; donor tree/source worktrees and all earlier failure evidence remain preserved. Root owns integration and publication.
