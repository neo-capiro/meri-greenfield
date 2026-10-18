# Profile 0.3 receiving: source measurement

This is a **source-tree measurement**, not an in-image receipt or live source qualification. It was taken in the dedicated `codex/meri-profile-receiving-v03-20261018` worktree from PR157 integration head `ab83ee97e9cb88b4727291284da9e2485157c309`, with PR158 source head `cdc1c04342da022117401284b4e6bbac032ef84d` and PR160 profile successor `0114f1a97ff9ca0f7b90ec281b557d0d24c1d225` applied before the narrow receiving edits. No deployment packet or Core route was changed by this measurement.

| Pin | Source value |
| --- | --- |
| Catalog version / canonical SHA-256 | `0.2.16` / `58673ff38658c07e608ad209f007c4c6e30b9ee06a04c0f52afa97ac222bca9c` |
| Profile schema `$id` / whole-file SHA-256 | `urn:meri:retrieval:client-knowledge-profile:0.3.0` / `7d422f92a4771b2d7e869e45371396c12b8a69934f9cb8ca50f5821ccab514a2` |
| Profile operation / descriptor SHA-256 | `get_client_context@0.3.0` / `16a3dbe00ff667bb512be2ccdc4ccd29a067d3edcd662a2e2261408b2e4add06` |
| Profile family handler source SHA-256 | `a35d78ab6e3dd057f367f9642060ee5c5c49b5703dd0795e8509cddce1f0294e` |
| Installable read selection | 76 operations, 42 families, zero `get_client_context@0.2.0` rows |
| Canonical SHA-256 of sorted operation references | `2b7e65b59487a85bbf8c938d42a76865c4eb8b3e9b5cab4330e1b8399a9fa973` |
| `skillsDigest` / asset count | `40e6270e9394ebcd86c60ee06f3689d5069ebc04dde0d7b60ece63fd63ce55fa` / 15 |
| `generalReadInstallation.measurementSha256` | `f693d304d279c855435596b16b2909952b5920bbb315ee18c2fe5c190b0704a4` |

The existing P2 manifest now measures these exact labels in `COMMON` for every family. The profile family retains its `SOURCE_PATHS.client-evidence` selection; duplicate labels are removed by the existing `Set` before hashing.

```text
apps/worker/conversation/reads/schema.mjs
packages/contracts/retrieval-0.2/validate.mjs
packages/contracts/retrieval-0.2/catalog-validation.mjs
packages/contracts/retrieval-0.2/catalog.json
packages/contracts/retrieval-0.2/client-knowledge-profile-v03.schema.json
packages/contracts/retrieval-0.2/client-knowledge-profile-v03-validation.mjs
apps/gateway/sources/client-evidence/handler.mjs
apps/gateway/sources/client-evidence/http-adapter.mjs
apps/gateway/sources/client-evidence/request-context.mjs
apps/gateway/sources/identity-contacts/handler.mjs
apps/gateway/sources/identity-contacts/http-adapter.mjs
apps/gateway/sources/identity-contacts/request-context.mjs
apps/gateway/sources/meetings/handler.mjs
apps/gateway/sources/meetings/http-adapter.mjs
apps/gateway/sources/meetings/request-context.mjs
```

Reproduction from this source tree, with the lockfile-pinned `apps/worker/conversation` SDK dependency installed:

```sh
node --test apps/gateway/general-reads/profile-receiving-manifest.test.mjs apps/gateway/general-reads/registration.test.mjs
node --input-type=module <<'NODE'
import {skillsDigest,generalReadInstallation} from './apps/runtime/build/first-chat-launch-measurement.mjs';
import {canonicalSha256} from './packages/contracts/validate.mjs';
const root=process.cwd();
const [skills,installation]=await Promise.all([skillsDigest({root}),generalReadInstallation({root})]);
const rows=installation.measurement.operations;
console.log(JSON.stringify({skills,measurementSha256:installation.measurementSha256,
 operationCount:rows.length,familyCount:new Set(rows.map(row=>row.family)).size,
 operationsDigest:canonicalSha256(rows.map(row=>row.operation))}));
NODE
```

The focused manifest/registration check passed **7/7**. The measurement entry points completed from source with the pinned SDK package present; they did not launch the SDK, contact Core, use credentials, or call a model. The measured image must re-run these entry points before any release pin is accepted. Core PR87 still holds the 0.3 profile receiver closed pending true same-read owner facts and task-bound relay.
