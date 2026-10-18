# Governed search raw input — reviewed implementation

Base local74bf7032285ed83b17a67e2fc2b0f5308eb9862b / remote PR1040724a744d73356a0e935d15dabc5889ab2337d4b, tree118c29c8ac27df713896a803973616635e9343c0. Task-owned branch `codex/meri-data-search-request-20261017`. The coordinator explicitly allocated the three-file correction described in [the prior proposal](CODEX-DATA-SEARCH-INPUT-CORRECTION-20261017.md), requiring independent review rather than blanket acceptance. Release PR98 and its pin are unchanged.

## Implementation and preserved boundaries

The implementation follows the approved additive request definition, keeping the normalizer, every previous schema definition (including normalized input/allOf), result contracts and SDK conversion guard unchanged. `data-search.schema.json` adds `DataSearchRequest`; `catalog-validation.mjs` changes only this operation's input binding; `catalog.json` changes only its input pointer and the two required whole-schema hashes. No historical accepted/freeze evidence is rewritten.

- Actual schema SHA256, used by both input and output descriptors: `b390270625b4662df487f04b13df745f422d10a2a8aa90e79e90a7ce75219d60`.
- Input URI: `urn:meri:retrieval:data-search:0.2.0#/$defs/DataSearchRequest`.
- Output URI remains `urn:meri:retrieval:data-search:0.2.0#/$defs/SearchCapiroDataResult`.
- Canonical current catalog digest: `f351ebad656225b15e6b4433bdad5d3e9e2ef270c64940d29811ef2f130b71ae`.

The SDK admits the raw grammar and leaves defaulting, normalization and relation decisions with the existing owner. Duplicate raw domains remain legal, absent client/memory selectors remain absent, explicit null selectors remain invalid, and `windowStart`/`windowEnd` remain raw selectors. Cursor membership, memory-domain/class and ordered-window checks remain authoritative in the normalizer. Raw arguments reach the actual fixed native route; current task, actor, tenant, source and per-page Core authorization remain mandatory.

`packages/skills/assets.json` changes only its derived `catalogSha256` to the actual canonical digest above. The existing `verifyCatalog` requires that equality; leaving the old digest made all skill-backed mounted fixtures fail with `SKILL_CATALOG_PIN`. No per-skill record, manifest, prose or manifest/prose pin changes. This necessary source catalog bookkeeping does not change a release/startup pin or qualify an installation.

Compatibility test helpers add an exact operation-specific raw pointer and old/new whole-schema hash transition. Both forward and reverse comparisons strictly reject an unexpected hash; immutable historical fixtures remain unchanged. No general comparison is relaxed.

## Checks and independent review

Author final five-suite contract/catalog/schema run:201/201 passed. Initial broader run34/37 failed because three unchanged tracked fixtures were omitted by sparse checkout; exactly those files were materialized from HEAD (610,800 bytes total). Two subsequent historical comparisons exposed the expected whole-schema hash change; the narrow explicit transition and its wrong-hash negatives resolved them without editing history.

The first root integration run passed104/108; four file/pipeline failures were `SKILL_CATALOG_PIN`. Updating the single derived digest produced **322/322 passing** contract, SDK raw-input, all13 governed MCP reads, worker inventory, native credential-owner wiring and exposure checks. Raw commands/results remain in `governed-next-20261017/data-request-integrated*.{json,txt}`. The normalizer and converter are unchanged.

Independent review returned **ACCEPT_SOURCE, no blocking findings**:27/27 initial contract/schema checks; then73/73 contract/schema/MCP checks and6/6 native-owner checks. A separate actual SDK-to-CONTROL composition settled a raw search with one receipt. Post-source membership revision drift withheld output, retained UNKNOWN and produced no SDK receipt. The reviewer verified every preserved old schema field, the exact descriptor diff, strict hash transitions and the assets' one-field-only change.

Additional original-skill regression checks passed41 tests, with one asset-suite import failure caused by omitted `docs/coordination/r2/skills.json`. That exact25,018-byte tracked fixture was restored from unchanged HEAD. The asset suite then passed16/17: its unchanged isolated-tamper test fails when Windows rejects a normal directory symlink with `EPERM`, before the tamper assertion runs. Its `finally` block removes the owned temporary tree. No test, pin guard or source path policy was relaxed. Both failed runs and their commands are retained in `data-request-skills*` and `data-request-skill-assets-rerun*` evidence.

Current exposure refresh: **56 general operations /33 worker families;54/82 selected source reads implemented and exposed;28 lack complete adapters across15 families;zero implemented adapters lacking general exposure;live0**. Retained research portfolio, changes and Florida budget reads remain exposed. This is source acceptance, not native/live qualification.

The separate old general-inventory generator cannot run at the unchanged base: `parseDispatchProfiles` expects the obsolete literal `if (profile === undefined) return;` and raises `Gateway dispatch profile list not found` on the existing guarded block. The current exposure generator remains valid and passes. This increment does not manually rewrite that generated proposal or weaken its parser; the baseline generator repair is a separate source task.

No live provider/database calls, credential creation, startup, infrastructure, locks, migrations, AWS changes or deployment. Exact task-local Zod4.6.7 is used by worker/MCP/SDK under Node24.19.0 with preserved symlinks, 256MiB heap and serial tests. Owned processes exit; other checkouts and sessions are preserved.
