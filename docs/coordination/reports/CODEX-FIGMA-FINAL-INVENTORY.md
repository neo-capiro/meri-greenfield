# Final Meri Figma inventory reconciliation

Codex read-only structural audit, 10 October 2026, dedicated branch `task/figma-final-inventory` from backend `c85ba2f4a1ca27c9715407f170347ddefcf6ece9`. The proportional outline precedes capture at `.task-inputs/CODEX-FIGMA-FINAL-INVENTORY-1/outline.md`. Sole tracked output is this report; original design snapshots and UI-SPEC/UI-COVERAGE/STATUS/QUEUE/G1 documents remain unchanged. The integration owner separately accepted and pushed frontend `28c300093c0886018c49df8764a8e6fac44819eb` for Home plus Browse workflows. That decision is attributed to the owner; this inventory task performs no pixel or behavior qualification.

## Current structure and counting

File `Zc2dEN5aLU47dVdsewDmiJ`, page `411:40601`, owned Meri section `439:81406` remain identifiable. The section is now nested under SECTION `599:136957`, **02 · Meri**, on the same page. Its name changes from **19 · Meri · Standalone agent — complete product mockup** to **Meri · Standalone agent — complete product mockup**. Local section bounds change from x82774/y-2340/7860×31624 under the page to x120/y120/8000×31644 under its new parent. These local coordinates use different parents; they are not a measured global displacement.

| Category and rule | Adopted baseline | Current owned section | Difference |
| --- | --- | --- | --- |
| Direct roots, all section children |115|108|Seven original Settings roots relocated|
| Numbered direct FRAME roots, NN.NN |85|78|Seven Settings screens relocated; 73 screens plus5 state boards remain|
| Direct Overlay FRAME roots |29|29|Same IDs/names/types/parents/sizes; local x+70|
| State FRAME examples within five11.xx boards |60|60|All eight-field tuples unchanged|
| Owned COMPONENT_SET families |15|15|All eight-field family tuples unchanged|
| Component member variant IDs |70|70|Same ordered IDs per family and counts; variant properties/styles not requalified|
| Named prototype starts rooted inside Meri |11|11|Same node IDs; Home start name changes|
| Classified rows: main+overlay+state+family |189|182|Seven retained Settings rows now outside Meri|

Direct-root accounting is **78 main +29 overlays +1 review map =108**. Classified-row accounting is **78+29+60+15 =182**, excluding the review map. Across the prior scope, all original189 classified IDs remain represented by current182 Meri rows plus the seven located Settings rows. There are no added direct roots, main roots, overlay roots, state examples or families within the owned section in this comparison. No capability is silently deferred or deleted by this structural relocation.

All108 common direct-root metadata tuples changed only local positions:107 screen/overlay roots have x+70/y unchanged; the review map `439:81407` has x+77/y-43. Their names, types, immediate parent IDs and dimensions are unchanged. All60 state and15 family full tuples are equal to the adopted inventory. Home `442:81437` remains1440×1040, at localx120/y1153 instead ofx50/y1153. Metadata equivalence does not imply unchanged nested content, typography, assets, interactions or visuals.

## Seven Settings screens remain present

Exactly the seven original09.xx IDs were resolved without descendant traversal. Each is still a FRAME with its original name and1440×1040 dimensions. New ancestry is **Settings · Meri preferences (`599:136967`) → Settings (`599:136971`) →04 · Modules (`599:136959`) → page411:40601**. This is location evidence, not approval to implement or enable Modules/Settings.

| Existing ID | Exact retained name | New local x/y |
| --- | --- | --- |
|448:87360|09.01 · Personal preferences|120/120|
|448:87595|09.02 · Connector accounts and permissions|1660/120|
|448:87836|09.03 · Usage and workspace limits|3200/120|
|448:88066|09.04 · Skills and artifact templates|4740/120|
|448:89130|09.05 · Notifications and account menu|120/1237|
|448:89371|09.06 · Privacy and deletion|1660/1237|
|448:89562|09.07 · Help, shortcuts and feedback|3200/1237|

The original eleven walkthrough start node IDs remain. Ten names are unchanged. Home start `442:81437` changes from **Meri · 01 — Conversation and evidence** to **Capiro 3.1 · Meri, Portfolio and Modules** (exact strings are retained in the data capture). This does not change the authorized independent product boundaries or enable those future features. The full reaction/control graph has not been refreshed.

## Evidence and failed attempts

The prior adopted [inventory](../../design/meri/20261010T004355Z/inventory.json) remains SHA256 `6b04fb2b28ed90c17247a4722d671f8af8b7890534b7c5f83dd309d49b29ec6a`; its original189 rows/115 direct roots and00:43–00:54 capture window remain historical. The later style/dark extension is unchanged. No baseline file is regenerated.

Read-only connector capture is sequential and non-atomic: section metadata 2026-10-10 18:42:58 UTC through 2026-10-10 18:43:03 UTC, with classification/ancestor and seven-ID lookup ending 2026-10-10 18:47:31 UTC. No immutable Figma revision was exposed. The retained files are UTF8 serializations of exact returned connector text/JSON content, not raw HTTP wire captures; XML extraction adds a final newline. `section-metadata.xml` is 707615 bytes/SHA256 `57fca48faafa65b81f2e1530b807a1be4c6efbf8bd9d0462c0bdce6bc3865dd6`; the full connector JSON retains its original text. `structure-4-response.json` is 11240 bytes/SHA256 `0c5add903f28fa786abd9b104bd99408bcfde12cf078e6d21bc1db4f0faa442c`. `settings-response.json` is 3740 bytes/SHA256 `57505afb1c71d791f6be629a604fa18ec1eb2c7a599899fbe93203d4a0c517f4`.

The first page411:40601 metadata call failed **Transport closed**. The smaller same-section metadata call succeeded. The first read-only PluginAPI assertion refused the obsolete direct-page parent assumption; a bounded parent-only lookup found SECTION599:136957. The next complete return exceeded the tool's20480-byte limit (24038 bytes); it was preserved rather than interpreted as success. The smaller type/ID/family/start capture then succeeded. The final seven-ID lookup resolved all Settings rows. Two metadata calls and five scoped PluginAPI calls were made; no screenshots, design-context implementation requests or Figma edits were made. Scripts use only reads plus page-context selection; returned created/mutated lists are empty. Tool errors' generic 'edits not committed' wording does not indicate a canvas write by these read-only scripts.

The Figma design-to-code and Figma-use skills and relevant PluginAPI references were read; the final bounded calls explicitly reloaded Figma-use. One prior parent-only diagnostic reused the already-loaded skill text rather than rereading it immediately; this workflow qualification is retained. XML renders component sets as frame tags, so family type/count authority comes from the successful PluginAPI capture, not an inferred XML type conversion. Current direct types and state IDs were cross-checked between the two forms. XML attribute whitespace normalization is not used as evidence of leaf text equality.

DATA-only `compare.py` compares IDs/names/types/parent/localx/localy/width/height and retains every changed/added/removed tuple. `close.py` validates fixed original inventory identity,108 direct IDs/types,60 state IDs,15 families/70 ordered variant IDs, all seven relocated Settings names/types/sizes,11 start IDs, empty mutation lists, and exact sole-report Git scope. `comparison.json` is 133016 bytes/SHA256 `dc0d81ce5bb53026f069d483bab513920429d461896f6c3ce5be1af235e20b79`. All raw responses, error responses, submitted scripts and available timestamp envelopes are retained in `.task-inputs/CODEX-FIGMA-FINAL-INVENTORY-1/`; the final manifest excludes itself and later commit readback.

No production code, owned current-status document or cleanup candidate was edited. No product tests, build, installation, browser, AWS, provider, Hermes or current-Capiro action occurred. Full leaf/style/token/reaction/control audit, all other screen implementation and whole-UI visual/behavior/accessibility acceptance remain unverified. The owner may add a current structural reference overlay after independent review; this report does not freeze or accept the entire finalized design or advance G1.
