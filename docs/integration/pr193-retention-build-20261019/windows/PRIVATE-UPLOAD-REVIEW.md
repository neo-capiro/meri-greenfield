# Windows private-upload implementation and review

## Implementation outline (before implementation)

The local renderer owns private material generation and a hash-bound local render receipt. This upload wrapper owns only the explicitly approved transfer of the five resulting bundles to their existing Secrets Manager ARNs. Canonical stage3 bindings and the unchanged C update-compatibility helper remain a separate local step after authenticated VersionIds exist. Root owns public AWS metadata and publication; Neo owns private files and any actual upload.

`Invoke-Pr193PrivateUpload.ps1` composes `Pr193Common.ps1` for private-directory ACL checks, hashing and captured argv execution. The initial PowerShell 7 proposal was narrowed to Windows PowerShell 5.1 at the operator's request; no PowerShell installation is required. It requires exact public/readback pins, the local render receipt, and an explicit Neo approval switch. The fixed new label is `FIRST_CHAT_20261019D`; no default AWSCURRENT upload or staging-label mutation is supported.

Before writes, metadata-only reads must identify the exact account, exact existing five secrets, absent proposed label and their unchanged current versions. A create-only private state file will bind role, ARN, bundle size/hash, render/readback pins and one persisted token per role. Resume may only reconcile/reuse that same token for those same bytes. Any uncertain outcome stops the workflow, retaining state; another token is never generated for an existing attempt. Private paths, command output and provider errors are never printed. Successful authenticated versions produce local metadata and the canonical role/VersionId TSV.

Verification will use fake bundles, fake metadata/put adapters and argument assertions only. It must cover absent approval without side effects; exact role/ARN/bundle binding; fixed stage and raw argv; unchanged AWSCURRENT; label collisions; persistence before mutation; same-token recovery after uncertainty; refusal of changed inputs; and bounded safe failure output. No real private inputs, AWS or deployment will be used during preparation. The local renderer/shared helper will also receive independent source review before publication.

## Implementation outcome

The separate upload entry is implemented. It takes the existing private output directory, public cache, exact readback commit, absolute AWS executable, existing profile and `-NeoApprovedPrivateUpload`. Missing approval refuses before private input access or state creation. No real private file, AWS operation, upload or deployment was used to prepare or verify it.

The public context is pinned to source `5b395d4ce9218b872b21c420dc00a3af31739824`, packet `b79d4b0c4b1027757e1d3ad5ca2ed0cbdf05e527`, and readbacks `05b73a61cb4f2bbfa52eae38ea23e44598c33e9f`. Readback manifest SHA256 is `adc81416f2b4c93d3fe3ee4694fbe3160e7a5180182a4b482e892d9e922ff613`. Five exact roles resolve only to their existing ARNs in the pinned public deployment candidate. The render receipt, raw bundle bytes, stage3, summary, runtime, policy and allocation hashes are checked before the workflow. `NEO-UPLOAD-MANIFEST.json`, SHA256 `870bc3e9abd6a53f6da97d220261ccb83ff5f9947ec1be5c8d0623fe54c19c50`, additionally binds every receipt pin and the five reviewed role/ARN/path/size/hash records. This is a fixed production pin, with no command-line override. State and final receipt also bind its hash.

An exclusive local `upload.lock` protects the upload/bind sequence. `upload-state.json` binds each role, ARN, bundle path relative to the work directory, size/hash, original current version, KMS identifier, complete initial version IDs/stages and one UUID token. Complete paginated metadata is captured for all five secrets before state creation. A secret already at 100 or more versions refuses before state creation or a new put. Resume validates the stored normalized IDs/stages, uniqueness and original current version; old state lacking this evidence refuses. Every subsequent pre/post snapshot must retain all original IDs/stages exactly and may add only that role's saved token. Tokens are persisted before the first mutation and status `SUBMITTING` is durably saved before each put. A bundle read handle denies modification/deletion while its hash and AWS file argument are consumed. A failed or uncertain operation stops immediately. A later invocation must use the same state and bytes, reconcile the same token, and reuse that token if submission is still necessary. It does not create a replacement attempt.

AWS invocation uses an executable and argv through the common captured-process adapter, without a shell command string. The adapter captures output and emits constant refusal codes, sets AWS maximum attempts to one, and bounds each process to 60 seconds with 10/20-second connect/read timeouts. Calls are limited to caller identity, secret description, secret-version metadata and the five workflow puts. No secret-value reads, stage-movement calls, deployment or automatic AWSCURRENT assignment occur. Label absence is a metadata preflight, not an atomic server-side conditional put. The sole Neo operator window remains necessary; a conflicting external mutation causes refusal when observed but cannot be prevented by these checks.

After all five versions are confirmed by metadata and every original version/stage remains unchanged, the wrapper writes exact role/VersionId `secret-versions.tsv` and `upload-receipt.json` with status `PR193_PRIVATE_UPLOAD_VERIFIED`. The final receipt binds the render receipt, approved manifest, durable state, TSV and five role/ARN/version/size/hash records. Metadata confirms version IDs/stages; the raw bundle hashes are local input evidence, not a remote secret-value reread. Exact transport relies on the canonical ASCII/base64 bundle serialization and the AWS file argument. The separate `Invoke-Pr193LocalBindings.ps1` consumes these records for canonical bindings and the unchanged C compatibility helper.

### Historical metadata completeness

The pinned root readback contains a complete described **staged-version map**, but its `listedVersions` field contains only the first page of deprecated-version history. That list is explicitly treated as partial. Historical label absence and original AWSCURRENT are established from the described staged map; this review does not claim a complete historical version listing. Before any future Neo upload, the wrapper performs explicit `list-secret-version-ids --include-deprecated` pagination, preserves `NextToken`, bounds pages/versions and refuses repeated tokens or inconsistent described/listed stages.

## Focused verification

`Test-Pr193PrivateUploadOffline.ps1` initially passed on actual Windows PowerShell 5.1 with 178 assertions. After the historical-preservation and reviewed-manifest enhancements it passed with 281 assertions across a small set of fake scenarios. These are assertions, not distinct tests. The scenarios cover:

- Approval refusal before side effects; exact five-role context from actual public metadata and fake bundles; owner-only root plus inherited child ACLs.
- Captured argv, explicit new label, account/current/key checks, persisted token and SUBMITTING status before a fake mutation, and bundle modification denied while a fake put consumes it.
- Uncertainty both before and after a fake remote mutation, same-token recovery, no duplicate completed put, and no final receipt on a partial attempt.
- Changed bundle, label collision, current-version drift, repeated pagination token and paginated deprecated/staged metadata.
- Final state/TSV/receipt hash joins and successful rerun without another put.
- Complete initial version metadata persisted before mutation; refusal after historical version removal, prior-stage change or a foreign version, with unchanged saved tokens and no final receipt.
- Refusal at exactly 100 existing versions before state/put, rejection of resumed state missing initial history, and reviewed-manifest summary mismatch.

The test exposed and corrected a Windows PowerShell 5.1 `File.Replace` null-argument conversion: `[NullString]::Value` is now used for the absent backup path. Effective child ACL checks allow the owner-only inherited ACLs created by the canonical renderer. The historical partial-list handling was checked against the actual public metadata without calling AWS.

Independent local-render review covered `Pr193Common.ps1`, `Pr193PublicInputs.ps1` and `Invoke-Pr193LocalRender.ps1`. `Test-Pr193LocalRenderOffline.ps1` passed actual PowerShell 5.1 using fake public/child adapters and the actual entry/common ACL code. It checks five-role receipt construction, canonical argv composition, inherited ACLs, suppressed synthetic private stdout and existing-output refusal. A separate seven-argument CRT roundtrip covered empty strings, spaces, quotes, trailing backslashes, shell metacharacters and Windows paths. Root independently confirmed parser and early-refusal cases; the author separately verified the exact source's 20,254 raw Git blob hashes and both public manifest exports without network access. Those author/root results are attributed evidence, not reruns by this reviewer.

The fake composition tests do not execute real PKI input handling, AWS credentials or Secrets Manager, canonical private rendering, or deployment. They validate the wrapper boundary and joins; existing canonical behavior is retained. Root must independently review the upload script before publication. Actual upload remains a later Neo-only action after upstream approval, with the explicit approval switch; no operator action has been performed by this reviewer.

## Local bindings review

The separate local bindings source review confirms exact render/state/final-upload-receipt/TSV joins, five existing ARNs, pinned public manifests/source, canonical `stage3-deploy.mjs bindings` followed by the unchanged C helper, private ACL checks and constant-only output. It has no AWS or deployment command. One bounded review finding was corrected: final acceptance now rechecks the original TSV hash and all five bundle sizes/hashes after child commands, so a mid-command input change cannot receive a successful receipt. The final receipt retains the initial checked TSV hash.

Final static Bind delta review: **PASS**, executable SHA256 `063776bbc9ee236c08a5cec46e74a9a8e720792437d6a8f9490268ef6c3c6105`. The author reported a focused actual-PowerShell-5.1 fake test PASS, and this reviewer inspected its added case: a child changes the TSV, the entry returns `PR193_INPUT_CHANGED_DURING_BIND`, and no final receipt is written. Test SHA256 `3a1a33df9ad2c3f9c9d5c4f2aab188276c9d77dbd27e3fecc995df0884c7f40f`. The test also covers missing final upload receipt refusal, complete five-role composition, three resulting template records, suppressed fake stdout and private ACLs. No remaining static Bind blocker was found.

## Reviewed artifact hashes

| Artifact | SHA256 |
| --- | --- |
| `Invoke-Pr193PrivateUpload.ps1` | `df9442e4960c605bc50a4c0fe25f8e934a3e84da71ddf42d53a27a4fe2e75bb5` |
| `Test-Pr193PrivateUploadOffline.ps1` | `eecad3ec9e14af59934d5eed664f3b76aca0b057cc2549751aecf568dfd19005` |
| `Test-Pr193LocalRenderOffline.ps1` | `5e40707551a4b2f6439dfa9a2296b720696728d7692349b9c4e4ed1052800bcf` |

All three parsed successfully with Windows PowerShell 5.1. The Windows directory passed `git diff --check`. The upload implementation is authored here and is awaiting root's independent review; these results are not represented as an independent review of this author's own upload code.

## Root independent review — 2026-10-19

The preceding author report is retained as chronology. Root subsequently reviewed the complete upload implementation, including strict historical-state normalization, exact approved-manifest joins, initial all-five metadata capture, durable token/status writes, same-token uncertainty recovery, original-version/stage preservation and metadata-only output. Root independently ran `Test-Pr193PrivateUploadOffline.ps1` under actual Windows PowerShell 5.1: **281 assertions PASS**, exit 0. No real AWS or private input was used by that test. The reviewed upload and test hashes remain exactly those in the table above.

Publication scope is the upload entry, test, reviewed Neo manifest, fresh public metadata and [UPLOAD-HANDOFF.md](UPLOAD-HANDOFF.md). The historical local-bind section is not publication or execution approval for that separate script. Upload remains pending parent receipt/operation-claim review and a sole Neo writer window. Root has not performed an upload.
