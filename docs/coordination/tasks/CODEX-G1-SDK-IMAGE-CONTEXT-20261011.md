# G1 private SDK fixture image context — source candidate

Base: `5192c575e78957bd4bc8d2c512a1efb5b455a884` on a dedicated worktree.
Shared policy: `neo-capiro/capiro-agent-ops@b32b4803933760dc0a93fffdcd8fba30a89c3aac`.

## Implementation outline

- The qualification worker remains the sole image recipe owner. The existing public `@capiro/meri-contracts@0.1.0` archive and exports stay frozen. The private SDK fixture schema, validators and wire remain owned by `packages/contracts/qualification-sdk`; no duplicate implementation is introduced.
- The fixed context assembler will stage exact byte copies of the private checkpoint modules, their offline tests and the minimal private contract/test dependency closure. The recipe will copy that closure to paths that preserve the repository-relative imports. Direct npm dependencies used by those modules must be declared in the worker package and lockfile.
- The existing borrowed HTTPS transport and channel remain inert at import. The trusted service remains responsible for peer/grant/fence authorization, durable storage, readback and revocation. This change grants no authority and starts no live service.
- The nested package test entry will discover the checkpoint tests. Static packaging checks will bind source bytes, context membership and installed paths. Context assembly and Python image-build preparation tests must retain fail-closed membership and pin behavior.
- Verification: Node 24 package test; Python context tests; generated context manifest verification; offline import/test smoke against staged files where feasible; image-build source tests; diff and clean-tree review. No image build, cloud call, native SDK experiment or G1 acceptance is claimed.

## Reviewed source result

- The assembler selects 44 regular source members (882,025 bytes) and emits an exact canonical manifest. Its final source SHA256 is `67c1cf554e80c62eeb56b6dcb9be00106adf9b1b8b40beba85249de662b835eb`; the final manifest SHA256 is `e89bda8fa60fa2d950bcb9bb9177841e177f458131d4e5a66e8a9a17a1762940`. Both are pinned in the build-only collector. The earlier 34-member manifest remains historical evidence and must not be used for this candidate.
- The image recipe stages the private contract/test closure at `/packages/contracts`, preserves the existing checkpoint imports and adds `/packages` to the fail-closed end-of-recipe inventory. The collector now binds each staged private path to its declared image path and rejects unknown staged prefixes. The public archive SHA and bytes remain unchanged.
- The nested worker `npm test` discovers the channel and HTTPS transport tests: 143/143 pass on Node 24.19.0. Root contract/session `npm run check`: 150/150 pass after an offline install of the existing contract build dependencies. Python context tests: 16/16 pass; generated manifest readback and both SHA pins pass. Image-build tests: 27/27 portable cases pass. The pinned-owner-Python case is unexecutable on this Windows host (27/28 if run as a whole); the same failure is present at the unmodified base. The separate image-inventory suite is 24/25 on this Windows host because its junction case fails here, identically at the unmodified base. No assertion was removed or weakened.
- A fresh `npm ci --offline --ignore-scripts` of the nested worker package succeeded with 130 packages. The lockfile adds three direct dependency declarations while retaining every existing platform `libc` pin. This avoids npm's Windows lockfile rewrite of those Linux optional package pins.

This is a source-only packaging candidate. There is no Docker build, image digest, installed Linux byte readback, SDK native two-task interruption/resume, fresh grant/revocation measurement, or G1 admission. The owner-bound image builder still requires its exact pinned Python runtime and fresh external build authority before an actual build; no dispatch was attempted.
