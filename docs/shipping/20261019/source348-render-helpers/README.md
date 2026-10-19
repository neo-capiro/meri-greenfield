# Source348 render helpers: dependency layout and an offline dry run

Published by Fable (the private-custody preparation side) for review on PR #121. Base: `60754f812a49e3832ba731caf12d8e1adecfd271` on `handoff/source348-public-render-inputs-20261019`. This branch changes **no** packet file, no candidate JSON, no source or image pin (source `34851020aa0d73fead4db59ba6e26a098e2d0313`, Node `7b295b42…`, proxy `734a20ec…` stay as the packet states them). It authorizes no build, AWS write, upload, deployment, task registration, migration or chat.

Nothing here contains a credential, key, database login, bundle, membership data, tenant/actor/client id, private directory path or machine-specific path. Every path is a parameter (`<checkout>`); every secret-shaped input in the dry run is generated at random under a temporary directory and deleted on exit.

## Why the helper exists

`npm ci` at the repository root alone cannot run `infra/product-preview/first-chat/render-material.mjs`. The render imports `apps/runtime`, which needs `@aws-sdk/client-ecs` (declared only in `apps/runtime/package.json`, not in the root lockfile) and `@capiro/meri-contracts` (a link to `packages/contracts`). Verified on fresh checkouts of `60754f81`: after the root install alone the render stops with `ERR_MODULE_NOT_FOUND`, first for `@aws-sdk/client-ecs`, then for `@capiro/meri-contracts`. The working layout is the one `apps/runtime/Dockerfile` builds (lines 8-24 and 41).

## Files

| File | What it does | What it touches |
| --- | --- | --- |
| `install-render-deps.sh <checkout>` | Eight lockfile installs (`root`, `apps/runtime`, `apps/worker/conversation`, `packages/ui-stream`, `packages/window-resolution`, `apps/control/conversations`, and `apps/artifacts/storage`, `apps/artifacts/generation` with `--omit=dev`; all `--ignore-scripts`) plus three directory links (`@capiro/meri-contracts`, `@anthropic-ai/claude-agent-sdk`, `@aws-sdk/client-s3`). Ends with `RENDER_IMPORTS_OK` or `RENDER_IMPORT_FAILED`. | Public npm packages; git-ignored `node_modules` folders only; never a lockfile. `git status` stays clean. |
| `verify-rendered.mjs <rendered-dir> <node digest> <proxy digest>` | Proves every rendered role is bound to the expected image digests. | Reads only each role's `expected.json` and `summary.json`; never `bundle.json` or `config.json`. Output is safe to share. |
| `dry-run-render.sh <checkout> <node digest> <proxy digest> [packet dir]` | Offline render with **throwaway** private inputs (below). Ends with `DRY_RUN_OK` or `DRY_RUN_FAILED`. | A temporary directory that is deleted on exit; the public candidates are read-only (a copy receives the throwaway pins). No network, no AWS, no Core call. |

Requirements: Node 24.x (the repository's `engines`), Python 3 with `cryptography` (what `pki.py` already needs), a checkout whose dependencies were installed with `install-render-deps.sh`.

## Dry-run instructions

```bash
git -C <checkout> rev-parse HEAD        # expect the packet commit you intend to test
bash install-render-deps.sh <checkout>  # expect RENDER_IMPORTS_OK
bash dry-run-render.sh <checkout> 7b295b4265141ff8feefc86dd3fec18e10be5e1a72cd88b7a50511ef53501044 734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551
```

What the dry run does, in order: (1) generates a 30-day PKI with the repository's own `pki.py`, random fake database logins and a random bearer-shaped file; (2) copies `deployment-inputs.candidate.json` and swaps only the 16 certificate pins for the throwaway PKI's; (3) writes fake Core values and fake task-definition revisions and runs the repository's own `stage3-deploy.mjs stage3-input`; (4) runs `render-material.mjs` with the public `runtime-values.candidate.json`; (5) runs `verify-rendered.mjs`.

Expected result: `MERI_FIRST_CHAT_MATERIAL_RENDERED`, `render exit: 0`, five `ok` lines (the four Node roles on the Node digest, `model-proxy` on the proxy digest, source `34851020…`), a seven-day validity window, then `DRY_RUN_OK`.

## What a pass means, and what it does not

A pass shows that the public candidates, the accepted image pins, the measured runtime values and the dependency layout render end to end, so a later failure of a real render points at the private inputs (certificate pins, chains, expiry, ids) rather than at the public packet. It does **not** show: that the real certificates, pins, bearer, membership receipt or database logins are valid; that real task-definition revisions are current; that a bundle is correct for the live account; or any live readiness. A real render still needs the fresh membership proof, certificate and credential validity checks, and a fresh task-definition read immediately before it, performed by the private-custody owner.
