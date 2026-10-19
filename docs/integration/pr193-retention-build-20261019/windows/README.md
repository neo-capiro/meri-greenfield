# Windows local render and private upload

## Implementation outline

This is a Windows PowerShell 5.1 composition of the existing canonical tools. `Invoke-Pr193LocalRender.ps1` owns local render orchestration. `Pr193PublicInputs.ps1` owns fixed Git retrieval, raw-byte manifest/source checks and bounded installation of the existing locked dependencies only when canonical imports need them. `Pr193Common.ps1` owns the shared child-process, hash and Windows ACL boundaries. The separate manual upload entry point owns AWS actions and approval checks; local post-upload bindings are a separate command.

The source pin is `5b395d4ce9218b872b21c420dc00a3af31739824`; the published public packet pin is `b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527`. A separately reviewed readback commit and manifest hash bind the render's fresh revisions and existing foundation outputs. No wrapper reconstructs runtime values, configuration or material bundles. Canonical `stage3-deploy.mjs`, `render-material.mjs` and the preserved C compatibility helper retain those responsibilities.

Public Git/npm preparation occurs before private inputs are used. All private paths are operator parameters. New private output is protected by an explicit owner-only Windows ACL before canonical tools run; child output and errors stay suppressed. Failed output is retained privately for operator inspection and cannot be reused as a successful render. No automatic upload, deployment, identity fetch or credential copy is performed.

Verification completed: PowerShell 5.1 parsing, eight argument roundtrips, wrong-readback and existing-output refusals without private-path leakage, and fake canonical composition through the actual entry point and ACL helpers. The fake composition produced exactly five receipt rows, preserved absent activation selectors and suppressed child output. Real private material, live rendering, Git/npm downloads and AWS writes were not exercised by these tests. The source and manifest validators are independently pinned; these offline checks do not claim a live private render.

## Run the local render

Prerequisites: Windows PowerShell 5.1, Git with Neo's existing authorized GitHub authentication, Node 24, and the existing private PKI/core-values files. Do not paste those files, their contents or their real paths into chat. This wrapper does not install Node or create credentials. Use the reviewed wrapper publication supplied by root; its public packet and source pins are independently fixed above.

From the checkout containing these wrapper files, replace the path placeholders **only on the secure operator host**:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docs\integration\pr193-retention-build-20261019\windows\Invoke-Pr193LocalRender.ps1 `
  -PrivatePkiDirectory '<EXISTING_PRIVATE_PKI_DIRECTORY>' `
  -CoreValuesPath '<EXISTING_REVIEWED_PRIVATE_CORE_VALUES_JSON>' `
  -OutputDirectory '<NEW_PRIVATE_OUTPUT_DIRECTORY_OUTSIDE_REPOSITORIES>' `
  -PublicCacheRoot '<PUBLIC_CACHE_DIRECTORY>' `
  -ReadbackCommit '05b73a61cb4f2bbfa52eae38ea23e44598c33e9f'
```

`-NodePath '<EXISTING_NODE24_EXE>'` is optional when `node.exe` on PATH is Node 24. Choose a short public cache path to leave room for Windows source paths. Output's parent directory must already exist; the output directory itself must be new. An existing output or changed source is refused, never reset. The invocation's execution-policy option applies only to that PowerShell process.

The default readback pin is `05b73a61cb4f2bbfa52eae38ea23e44598c33e9f`, with `FILE-MANIFEST.json` SHA256 `adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613`; another pin is refused. These readbacks derive candidate revisions control 34, application worker 33, issuer 33, owner 32, proxy 32, runner 19. They do not reserve revisions. If another registration or deployment has occurred, stop for a refreshed reviewed readback pin before rendering/uploading.

The wrapper fetches only the three exact commits into the reusable public cache, checks the two pinned manifests and raw tracked source bytes, and probes the canonical imports. It runs `npm ci --ignore-scripts --no-audit --no-fund` only for a missing dependency's existing lockfile owner, at most once for each of root, `apps/runtime`, `apps/worker/conversation` and `apps/control/conversations`. A working existing dependency installation is reused. Each Git/npm subprocess has a ten-minute ceiling; the canonical stage and render have two- and three-minute ceilings. No npm script, feature activation, model call or AWS command is run.

Success prints only `PR193_PUBLIC_PREPARATION` then `PR193_LOCAL_RENDER_COMPLETE` and exits 0. Refusal prints one constant `PR193_*` error and exits 2; no private child output or private path is printed. Failed partial output remains under its protected ACL and has no accepted success receipt; choose a new output path only after resolving the refusal. The private output directory's ACL grants FullControl solely to the current Windows SID and protects inheritance; the rendered tree is checked again before receipt publication.

Successful output contains `stage3.json`, `rendered/` and `local-render-receipt.json`. The receipt records exact public/source/readback hashes, summary/stage hashes and exactly five relative bundle paths with sizes/SHA256. It contains no absolute private path or secret value. Return only the success status and the receipt's safe pin/hash metadata to root; keep the private directory, bundles, configs, credentials and real paths local. Root's upstream approval is still required before the separately invoked private upload; this render command never uploads or deploys.

The public cache layout is `source-<sourceCommit>/`, `packet-<packetCommit>/` (evidence contents directly, including `public-candidate/`) and `readbacks-<readbackCommit>/` (readback contents directly). Keep it separate from private output. Raw Git archive bytes preserve the reviewed file hashes regardless of local checkout line-ending settings.

## Separate approved upload, then local bindings

Use these only after root publishes the separately reviewed upload/bind scripts. Obtain explicit upstream approval for the five private uploads first. The upload script requires the explicit approval switch, Neo's own existing AWS executable/profile, the same public cache and the successful private output. It keeps its per-role request tokens/state locally, confirms the five exact versions under `FIRST_CHAT_20261019D` and preserves AWSCURRENT. On an uncertain outcome keep the original state and bytes; do not invent new tokens, change bundles or manually remove state.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docs\integration\pr193-retention-build-20261019\windows\Invoke-Pr193PrivateUpload.ps1 `
  -OutputDirectory '<SUCCESSFUL_PRIVATE_OUTPUT_DIRECTORY>' `
  -PublicCacheRoot '<SAME_PUBLIC_CACHE_DIRECTORY>' `
  -ReadbackCommit '05b73a61cb4f2bbfa52eae38ea23e44598c33e9f' `
  -AwsExecutable '<EXISTING_AWS_EXE>' -AwsProfile '<NEOS_EXISTING_PROFILE>' `
  -NeoApprovedPrivateUpload
```

After upload prints `PR193_PRIVATE_UPLOAD_VERIFIED_BIND_READY` and root confirms read-only version preservation, use the separately reviewed local-only stage described in [BINDINGS-DEPLOYMENT-HANDOFF.md](BINDINGS-DEPLOYMENT-HANDOFF.md):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docs\integration\pr193-retention-build-20261019\windows\Invoke-Pr193LocalBindings.ps1 `
  -OutputDirectory '<SAME_SUCCESSFUL_PRIVATE_OUTPUT_DIRECTORY>' `
  -PublicCacheRoot '<SAME_PUBLIC_CACHE_DIRECTORY>'
```

Bindings require the final `upload-receipt.json`, all five COMPLETE state entries, exact TSV/byte/hash joins and the approved manifest hash on both upload records. This command makes no AWS or Git fetch call. It rechecks the fixed cached packet/readbacks/source, calls canonical `stage3-deploy.mjs bindings`, then the exact preserved C `build-update-compatible-v2.mjs` helper. It checks consumed inputs again and refuses existing `bindings/`, `update-compatible-v2/` or final binding receipt outputs. Success writes `local-bindings-receipt.json` and prints `PR193_LOCAL_BINDINGS_COMPLETE_NO_DEPLOYMENT`; return its safe metadata to root. The parent then needs the three generated helper templates for exact diff review. These templates authorize no registration, change set, service change or deployment; do not execute the raw canonical deploy-plan command arguments.
