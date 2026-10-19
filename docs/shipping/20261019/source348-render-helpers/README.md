# Source348 render helpers: dependency layout, digest check and an offline dry run

Published by Fable (the private-custody preparation side) for review on PR #121. Base: `60754f812a49e3832ba731caf12d8e1adecfd271` on `handoff/source348-public-render-inputs-20261019`. This branch changes **no** packet file, no candidate JSON, no source or image pin (source `34851020aa0d73fead4db59ba6e26a098e2d0313`, Node `7b295b42…`, proxy `734a20ec…` stay as the packet states them). It authorizes no build, AWS write, upload, deployment, task registration, migration or chat.

Nothing here contains a credential, key, database login, bundle, membership data, tenant/actor/client id, private directory path or machine-specific path. Every path is a parameter (`<checkout>`); every secret-shaped input in the dry run is generated at random in one temporary directory and removed by a guarded cleanup.

These helpers are **not** the credential handoff. The private-custody steps (bearer, membership, `core.json`, the real render, any upload) are separate and stay with the custodian; nothing here reads or sends a real credential.

## Why the dependency helper exists

`npm ci` at the repository root alone cannot run `infra/product-preview/first-chat/render-material.mjs`. The render imports `apps/runtime`, which needs `@aws-sdk/client-ecs` (declared only in `apps/runtime/package.json`, not in the root lockfile) and `@capiro/meri-contracts` (a link to `packages/contracts`). Verified on fresh checkouts of `60754f81`: after the root install alone the render stops with `ERR_MODULE_NOT_FOUND`, first for `@aws-sdk/client-ecs`, then for `@capiro/meri-contracts`. The working layout is the one `apps/runtime/Dockerfile` builds (lines 8-24 and 41); the packet README (`26e8d7b2`) documents the same eight installs and three links.

## Files

| File | What it does | What it touches |
| --- | --- | --- |
| `install-render-deps.sh <checkout>` | Eight lockfile installs (`root`, `apps/runtime`, `apps/worker/conversation`, `packages/ui-stream`, `packages/window-resolution`, `apps/control/conversations`, and `apps/artifacts/storage`, `apps/artifacts/generation` with `--omit=dev`; all `--ignore-scripts`) plus the three directory links with the Dockerfile's fixed relative targets (`@capiro/meri-contracts`, `@anthropic-ai/claude-agent-sdk`, `@aws-sdk/client-s3`). An existing link is accepted only if it resolves to the intended package. Ends with `RENDER_IMPORTS_OK` or `RENDER_IMPORT_FAILED`. | Public npm packages; git-ignored `node_modules` folders only; never a lockfile. `git status` stays clean. |
| `verify-rendered.mjs <rendered-dir> <node digest> <proxy digest> <node source commit> <proxy source commit>` | Proves every rendered role is bound to the expected image digest **and full 40-hex source commit**, and that `summary.json` and each `expected.json` describe the same render (`materialContractSha256`, `sha256ByPath`, `imageDigest` and config pin must agree, as `stage3-bindings.mjs` requires). A missing or unreadable `summary.json`, or a role absent from it, is a failure. | Reads only each role's `expected.json` and `summary.json`; never `bundle.json` or `config.json`. Output is safe to share. |
| `dry-run-render.sh <checkout> <node digest> <proxy digest>` | Offline render with **throwaway** private inputs (below). The checkout path is canonicalized and validated as a git checkout root containing the render files; the packet directory is fixed (`docs/shipping/20261019/source348-public-render`), never an argument; the expected source commits come from the public deployment candidate and must be full 40-hex SHAs. Ends with `DRY_RUN_OK` or `DRY_RUN_FAILED`. | One temporary directory named `dryrun.*` directly under the resolved temporary root. Before any recursive removal the guard re-resolves the path and refuses anything that is not a real (non-link) directory with that name and parent; a failed removal is reported (`CLEANUP_FAILED`) and makes the script exit non-zero. The public candidates are read-only (a copy receives the throwaway pins). No network, no AWS, no Core call. |
| `test-helpers.sh` | 31 focused cases for the guards above (fake data in temporary directories; no network, no AWS, no render, no product suites). Includes an entry-point run of the install script against a stub checkout and stub npm (exit status, links, idempotence). Ends with `TESTS_OK` or `TESTS_FAILED`. | Temporary directories only. |

Requirements: Node 24.x (the repository's `engines`), a Python 3 that can import `cryptography` (what `pki.py` already needs; the dry run picks the first of `python`, `python3` that can), a checkout whose dependencies were installed with `install-render-deps.sh`.

## npm and credentials: an anonymous configuration is required

The install uses packages from `registry.npmjs.org` only: before installing, the script scans the eight lockfiles it installs from (the same eight as the Dockerfile; other tracked lockfiles, such as the qualification fixtures that reference a vendored in-repo tarball, are not installed and not scanned) and refuses if any entry resolves anywhere but `registry.npmjs.org`, or if the checkout carries a project `.npmrc`. It runs npm with empty user and global configuration files (two distinct files; npm rejects one file loaded as both) and with `NPM_TOKEN` / `NODE_AUTH_TOKEN` unset, so no npm token or private registry setting from the operator's own configuration can be used. **This requires anonymous access to the public registry.** If the network path needs an authenticated proxy or registry, the install fails rather than sending a credential. Do not work around that by supplying a token to this script. This statement is about npm credentials only; the helpers use no other credential of any kind.

## Dry-run instructions

```bash
bash test-helpers.sh                    # expect TESTS_OK
git -C <checkout> rev-parse HEAD        # expect the packet commit you intend to test
bash install-render-deps.sh <checkout>  # expect RENDER_IMPORTS_OK
bash dry-run-render.sh <checkout> 7b295b4265141ff8feefc86dd3fec18e10be5e1a72cd88b7a50511ef53501044 734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551
```

What the dry run does, in order: (1) generates a 30-day PKI with the repository's own `pki.py`, random fake database logins and a random bearer-shaped file; (2) copies `deployment-inputs.candidate.json` and swaps only the 16 certificate pins for the throwaway PKI's; (3) writes fake Core values and fake task-definition revisions and runs the repository's own `stage3-deploy.mjs stage3-input`; (4) runs `render-material.mjs` with the public `runtime-values.candidate.json`; (5) runs `verify-rendered.mjs` with the digests you passed and the source commits read from the candidate.

Expected result: `MERI_FIRST_CHAT_MATERIAL_RENDERED`, `render exit: 0`, five `ok` lines (the four Node roles on the Node digest, `model-proxy` on the proxy digest, full source SHA `34851020…`), a seven-day validity window, then `DRY_RUN_OK`.

## What a pass means, and what it does not

A fake-input pass is **tested-path evidence only**: the public candidates, the pinned images, the measured runtime values and the dependency layout rendered end to end on throwaway inputs, so a later failure of a real render points at the private inputs rather than at the public packet. It does **not** qualify private material and shows none of: that the real certificates, pins, bearer, membership receipt or database logins are valid; that real task-definition revisions are current; that a bundle is correct for the live account; any live readiness. A real render still needs the fresh membership proof, certificate and credential validity checks, and a fresh task-definition read immediately before it, performed by the private-custody owner.

## Platform note

Tested on Windows (Git Bash, Node 24, npm 11). On Windows the links are directory junctions created by PowerShell with the two paths passed as environment values (data), never inside the command text. The POSIX branch uses `ln -s` with the Dockerfile's fixed relative targets and is **untested here**; no Linux or macOS support is claimed, and the focused tests exercise only the guard logic on the platform they run on.
