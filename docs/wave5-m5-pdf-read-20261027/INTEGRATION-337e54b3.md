# W5-M5-01 integration continuation

27 October 2026. The retained-PDF read slice is reapplied to merged Meri PR296, exact main `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`, tree `d631bdf6a3d1b22e6a0a6fa4e30018f49e65f481`. New isolated branch: `codex/wave5-m5-pdf-read-integration-20261027`; checkout: this chat's `work/m5-pdf-read-integration-20261027`. Author/cleanup owner: Wave 5 M5 lane/orchestrator. Existing root/Release owns integration and target operations; Hermes owns independent review and acceptance.

PR294's original branch, checkout and head `1fbfe49cff488f1bf73b424c2d0690fd6f5f9e54` remain unchanged. Original commits `86b59ce9e2a6cb898381b2834d3bc92df38b8a46` and `1fbfe49cff488f1bf73b424c2d0690fd6f5f9e54` applied as `8704764ef` and `957ee62a5cea029d4e0c06a4d01d4f3ee208bb85`, without source conflicts. A refused application attempt during checkout initialization was aborted only in the new task-owned checkout before the clean application; it was not an upstream compatibility conflict.

## Source and dependency comparison

The application, preview comment and focused test are byte-equivalent to PR294 (`git diff --exit-code` over those three paths: exit 0). The new base does not change the document application, current authority wrapper, format admission, preview route, artifact service or immutable storage owners. Its nearby `apps/runtime/artifacts/workspace-restore.mjs` change provides a random private retained-directory fallback after numbered names are exhausted; it does not change retained document read admission. This continuation makes no additional executable change and does not edit conversation-runner or artifact-restore source.

New base dependencies are contracts `0.1.21`, retrieval catalog `0.2.23`, and UI stream `0.1.8`. Their shared writer remains the Wave 4 Meri owner. The source reapplication edited no package, catalog, schema, generated distribution, vendor, lockfile or registry; the subsequently released metadata-only refresh is recorded below.

## Verification

On applied source head `957ee62a5cea029d4e0c06a4d01d4f3ee208bb85`, tree `2dd4f00cd855182f7e367ea5a585cb6a246886d9`, Node `v24.22.1`:

```text
node --test --test-concurrency=1 apps/control/document-application/test/pdf-read-admission.test.mjs apps/control/document-application/test/preview-custody-configuration.test.mjs
```

**11 passed, 0 failed, 0 skipped; exit 0.** Run once against the new base. Tests retain exact bytes/metadata, writer and preview gating, current-session and retention denial, substituted bytes, foreign actor/client and metadata refusal checks. The existing root dependency cache was reused through one task-owned ignored junction, with no installation or cache mutation. `git diff --check` passed. Original failure witness and mutation evidence are retained in `HANDOFF.md`; neither was repeated. No broader runtime tests, build, live/paid/provider/browser/database or deployment operation occurred.

## Metadata source binding and remaining integration hold

Both existing generators still hash `apps/control/document-application/index.mjs`:

- `packages/contracts/generate-documents.mjs` → `packages/contracts/dist/document-application.metadata.json`.
- `packages/contracts/generate-document-access.mjs` → `packages/contracts/dist/document-access-application.metadata.json`.

Wave 4 root released only these two generated metadata files to the M5 owner. The refresh continues from `8612935327045b1c57766e380c7ec6dbf2a5863a` in isolated branch `codex/wave5-m5-metadata-binding-20261027`, checkout `work/m5-metadata-binding-20261027`. Each metadata diff changes only its index source entry from SHA256 `ed5eb408ff280e528bef4d73b8c1d2fdd69d52fda595192b4cc0d7189b60259f`, 10,326 bytes, to `2b57b6eaee18c069efd6600c2155e740377fdd5a6fec297df443cc2fdb6cf37d`, 10,622 bytes. Browser bundles, declarations, schemas, public API and retained-PDF behavior are unchanged.

With Node `v24.22.1`, both canonical generators and both corresponding `--check` commands exited 0. The existing distribution checks were selected with:

```text
node --test --test-concurrency=1 --test-name-pattern='metadata is derived|distribution is self-contained|isolated package consumer exposes document export' packages/contracts/test/document-access-application-public.test.mjs packages/contracts/test/document-application-public.test.mjs
```

**3 passed, 0 failed, 0 skipped; exit 0.** Generated metadata SHA256 values: document application `771bc24c0573a24ed31dba8ac1e8fb046a5ba92253c74c6117152e5e56adce40`; document access `f182f87a204e6fc4bc145e614aab6a60540d8b305c898b0fc70fc3ba43c1382b`. The existing 11 source-check passes above are reused; source tests were not rerun. The aggregate `npm run check:contracts:distribution` was NOT RUN: it invokes every contract generator, type fixture and public suite, including other held owners, rather than a document-only check.

Dependencies were reused without installation or cache mutation through fresh task-owned package-local junctions: AJV `8.20.0`, ajv-formats `3.0.1`, canonicalize `5.1.0`, fast-deep-equal `3.1.3`, esbuild `0.28.2`, json-schema-to-typescript `16.0.0`. The initial root-hoisted layout in the earlier integration checkout produced unwanted bundle path labels. Those task-produced tracked changes were restored; automatic approval review rejected unlinking its dependency junction, so it was left untouched and the fresh checkout was used. The earlier integration checkout remains clean at `8612935`; PR294 remains unchanged at `1fbfe49`.

At the metadata checkpoint, a fresh contracts package allocation remained required before packing or publishing; no version had been chosen or reserved. Existing contracts `0.1.21`, catalog `0.2.23`, UI stream `0.1.8`, physical packages and lockfiles were untouched. No packing, publishing, push, build or deployment occurred in that checkpoint. Consumer finalization, shared package cohort work, and bounded Hermes review remained prerequisites. The later allocation below supersedes only that package hold; no deployment/acceptance or MM-09 closure is claimed.

## Coordinated package continuation

Wave 4 coordinator and Wave 5 root exclusively allocated contracts `0.1.22` and UI stream `0.1.9` after all 658 current remote branch manifests and the remote tags showed no competing versions. Main remained `337e54b3`; reviewed metadata head `98e8a53a7ac2b68cda4ee04c40f0b7b301570138` is preserved on its published branch. New continuation branch: `codex/wave5-m5-packages-20261027`; checkout: `work/m5-packages-20261027`.

Contracts changes are limited to its package and lock version fields. UI stream changes are limited to package/lock versions, adding contracts `0.1.22` to its existing peer union, the linked development contracts version, and the supported-versions README. UI runtime/declaration bytes, all public contract receiver/schema/type bytes, introduced wire versions, catalog `0.2.23`, source behavior and the two reviewed document metadata files remain unchanged from `98e8a53a`. No consumer files or historical candidate distributions are changed.

The canonical packaging command is `npm pack ./packages/contracts --ignore-scripts` at repository root, with the corresponding UI stream package path. Use qualified Node `v24.22.1` and npm `11.9.0`, and a fresh task-owned destination `work/m5-package-artifacts-20261027` after the producer commit. Expected physical differences against frozen contracts `0.1.21`: only `package.json` and the two document metadata files (69 regular entries). Expected differences against frozen UI stream `0.1.8`: only `package.json` and `README.md` (six regular entries). Verify every packed member against the committed producer and retain immutable old archive hashes. Physical results follow in the package manifest; no package registry publication, consumer installation, merge, build or target operation is authorized.

After the version updates, both existing document generators' `--check` commands passed and the three focused distribution tests passed (0 failures/skips). Package/lock root versions, the linked contracts version, and the exact peer union were checked: contracts `0.1.20`, `0.1.21` and `0.1.22` admitted; `0.1.23` refused; AI peer remains `7.0.137`. `git diff --check` passed. `git diff --exit-code 98e8a53a` over apps, both public distribution directories, UI source and the catalog passed. Existing 11 source-test passes are reused; no aggregate regeneration or source-test rerun.

Physical packages were produced once from clean commit `74890bb96232dcce96d4fb4f31359038efb9db63`, tree `0a785558b0db372f2027a3630ec791becb82ad01`, using the qualified npm CLI with `pack ./packages/<name> --ignore-scripts --offline --json --pack-destination <fresh-task-directory> --cache <task-cache>`; both commands exited 0. The later handoff-only commit changes no packed member. Canonical pack output and byte-identical content-addressed copies remain in this chat's `work/m5-package-artifacts-20261027`; no archive was overwritten or repacked.

| Archive | Bytes / regular entries | SHA256 |
| --- | --- | --- |
| `capiro-meri-contracts-0.1.22-74890bb9-ff5afd102997.tgz` | 1,298,157 / 69 | `ff5afd10299750c680ec575da8da4937498918e619b8a728693860444ece3fa1` |
| `capiro-meri-ui-stream-0.1.9-74890bb9-5017b072bccb.tgz` | 3,288 / 6 | `5017b072bccbd55797333936e042ddfdde8bcfe5834dfc65c1317e8e35b90365` |

`PACKAGES.json` in that directory records source commit/tree, SHA512 integrity, every member's bytes/SHA256, and predecessor bindings. `verify-packages.py` read both archives without extraction or installation and proved all 75 regular members equal their exact committed producer files. Old/new member sets are identical; changed entry lists match the expectations above exactly. Frozen contracts `0.1.21` SHA256 `b93f9b7ed017de6dcb3b3a52b4ff1f06f5933836b69338d4a1a66c6d8e5b79e4` and UI stream `0.1.8` SHA256 `39451998f9536f17260d393f7c0475d8ec0260f09b55ca50c6b6badbe6319383` were verified unchanged. Node/npm pack records are retained as `contracts-pack.json` and `ui-stream-pack.json`.

Root received these verified physical inputs for the sole frontend consumer author. Consumer manifest/vendor/lock changes and exact combined Hermes producer/archive/consumer binding review remain pending. No consumer install, push, registry publication, merge, build, target operation, or additional M7 check occurred in this producer lane. Catalog `0.2.23`, frozen wire IDs and original source branches remain unchanged.
