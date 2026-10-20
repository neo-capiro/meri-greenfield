# Neo: local private render for the runner release

The combined source and image have completed the approved image/measurement cycle. Same-preview rollout is approved after the remaining exact material/template checks. **Private rendering and upload remain Neo-only because Neo prohibited agent secret transmission.** This is a concrete handoff for the existing secure operator host, not a request to share private inputs.

Use the final released `windows/README.md` and its exact helper commit. It pins source `2b4421f612f9fbb728d6da52927aac228d712d40`, the qualified `f5a7abc9…` image, unchanged policy/allocation, fresh public readbacks and label `FIRST_CHAT_20261020E`.

## First step: render locally

Run `Invoke-Pr193LocalRender.ps1` with the **same existing private PKI directory and reviewed Core values file**. Choose a new private output directory outside all Git checkouts and the public cache. Supply paths only locally. Node24, Git and the existing authorized GitHub access are required; the reviewed helper prepares locked public dependencies.

Return **only `local-render-receipt.json`**, which contains hashes, byte counts and public pins. Keep the PKI/Core files, bundles, rendered configs, tokens and real private paths local. Do not attach raw command output.

## Then: exact upload and public bindings

1. The owner reviews that receipt and publishes the exact five-bundle upload manifest and its hash. Until then, the helper's upload and bindings gates intentionally remain pending.
2. Neo invokes the separately released upload command using the existing authorized AWS context. It stages the exact five bytes under label E, preserves AWSCURRENT and existing version history, and retains each idempotency token if an outcome is uncertain. It does not create credentials or change permissions.
3. Return only its public metadata receipt. The owner checks the five exact VersionIds and preserved prior labels read-only.
4. Neo invokes the local bindings command using the same protected output/cache, then returns `local-bindings-receipt.json` and the generated `model.template.json`, `issuer.template.json`, and `app.template.json` from `update-compatible-v2/`. These are the reviewed public deployment artifacts; private config and bundles stay local.

The owner then reviews the exact templates against current live metadata and rolls out MODEL, ISSUER and APP sequentially with qualification at each stage. No model chat is included. If input revisions change meanwhile, stop for refreshed public readbacks; do not guess task revisions or edit private rendered output by hand.
