# REL-02 private `search_capiro_data` contract candidate — H4 source review

Status: local source-only candidate. The existing 0.2 catalog selects this
intent but leaves it pending. This schema and validator are unregistered and
not exposed by the public 0.1 package. They implement neither a handler nor
source access, authorization, freshness, runtime parity or G1 acceptance.

## Ownership and frozen evidence

- Shared policy: `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.
- Allocated source base: `f118ff55dfb96ba4b44099953e6c9724064b723d`;
  bounded H4 branch allocation commit: `fe77b8b3c13fbfa28a552cb0099c84a2a2154c5f`.
- Frozen reference: `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`.
  Codex read only Git objects, not that checkout's working tree.

| Frozen path | Git blob | Bytes | Raw SHA-256 | Evidence lines |
| --- | --- | ---: | --- | --- |
| `apps/api/src/meri/meri-data-search.helpers.ts` | `3194549806fa74147ab61d2ba40ef4182bee42f7` | 5,661 | `54025ffcbf917f0ebbf154a313ed53821387877bda09a319fc26ca84b47a54f1` | 6–8 classes; 22–30 instant grammar; 32–78 parser; 86–108 tool request and envelope |
| `apps/api/src/retrieval/retrieval-v2.types.ts` | `71f80b0d94d78537ab6c5f150ab7960417d319d0` | 11,082 | `95f388145594c5a9052318e4fa0f215de0b10fb92757bbcca8adb17120890fb8` | 4–40 vocabularies; 176–195 records; 223–253 coverage; 332–353 observability/response |
| `apps/api/src/meri/meri-context-plane.service.ts` | `899c23f52350f0abe47c23f6d168c682fd5dddd1` | 52,829 | `320b1e47694ba9d43737cde066c6987c48020c892503d2c37237522953165303` | 89–141 `searchToolData`: server security envelope, client selector check, requestContext, full response return |
| `apps/api/src/meri/meri-tools.service.ts` | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` | 415,704 | `53d9d5b7ed8ba55a1086062812b3aaaf3cc225db485e4542c4ffc5836ea8e194` | 966–1003 advertised tool schema; 2631 dispatch |
| `apps/api/src/knowledge/knowledge.types.ts` | `de4957b091de86a4f45ba585692f119b76bf167b` | 5,768 | `af823f3ba72d84db1bd199896e8b9360f61b5489c79e31335d518d4802e498df` | 2–15 JSON object and reference types |

## Contract and deliberate limits

The normalized input retains all 18 frozen domains, the seven classes that
this tool may select, default `lookup`/50, raw domain count before deduplication,
the conditional institutional memory selector, requested-domain opaque cursors,
and a bounded two-ended window. `clientId` is data for server-side scope
resolution, never a grant. Unknown raw keys are refused deliberately, whereas
the frozen parser ignores them. Raw optional null handling and JSON date
encoding are documented in the module as distinct from the frozen TypeScript
interfaces.

The output schema covers the `RetrievalResponse` record, coverage and
observability members plus the tool envelope. Record payload and provenance
remain generic `KnowledgeJsonObject`; no per-domain fields are invented. The
candidate does not infer count agreement, domain membership of returned
records, completeness from counts, cursor authenticity, source freshness or
authorization. Those relations are enumerated in `RESULT_UNPROVEN_RELATIONS`
and require the retrieval producer and live boundary before acceptance.

## Independent validation

Hermes H4 left uncommitted source at its turn cap, with no executed tests or
report. Codex verified its launcher/child exit, read repository instructions
and implementation standards, inspected the frozen Git objects, reviewed the
source and ran the suites on pinned Node `v24.19.0` with offline dependencies.

- First focused run: 10/13 pass, exit 1. The failures were an incorrect test
  expectation that duplicate institutional domains must fail (the frozen
  parser deduplicates before the memory condition), an incorrect assertion
  that the catalog lacks the already selected `search_capiro_data` ID, and a
  self-recording socket guard in the no-side-effect probe. No schema or
  validator bypass was used to obtain a pass.
- Corrected focused run: 13/13 pass, exit 0. Includes exact vocabulary,
  defaults, conditional memory, cursor/domain bounds, window ordering,
  result envelope, unproven relations and guarded import checks.
- Existing retrieval suites (`retrieval-r2`, operational reads, meeting,
  mail, federal market): 104/104 pass, exit 0.
- Changed paths and `git diff --check` are reviewed at commit. No catalog,
  common schema, public export, package lock or current Capiro source changed.

Codex accepts this as a **local contract candidate only**. REL-02 remains
pending, and G1 remains open. Runtime/source authorization and actual result
parity require separate implementation and acceptance.
