# Neo's local steps: fresh Meri Stage 3 inputs (prepared by Fable on neomart, updated 2026-10-19 ~04:20 UTC for packet 26e8d7b2)

Nothing in this file is secret. It is a checklist of commands for **you** to run on neomart in Git Bash. Fable ran none of the credential-bearing steps and none of these
commands: Fable only read public source, file names/sizes/dates, and AWS read-only metadata. Do not paste the contents of any file named `identity`, `membership.json`,
`core.json`, `*.key.pem`, `db-logins*.json`, `bundle.json` or `config.json` anywhere. Everything the helper scripts print is safe to paste into chat (dates, counts and booleans only;
they never print an id, a token or a claim).

Helper scripts (this folder, outside Git; tested on fake data only): `cert-expiry.mjs`, `bearer-exp.mjs`, `membership-summary.mjs`, `verify-rendered.mjs`.

## Status

- **Scan-evidence WAIT: lifted** by Fable after verifying packets `f0f18c04` and its successor `60754f81` (below). It was the only thing the earlier hold waited for.
- **Still not authorized, by anyone, in this file:** uploading a bundle (`PutSecretValue`), deploying a stack, scaling a service, running a migration, registering a task definition, sending a chat.
  The file ends at locally rendered material and a digest check.
- **Gates that stay:** fresh membership proof, certificate validity, credential validity, DB-login validity (reported `UNKNOWN` unless authorized proof exists) and fresh task-definition
  revisions must all pass immediately before the render (section 6 is a checklist). The render itself also refuses on a pin, chain or key-pair mismatch, any `PENDING_` value left,
  and any validity window that ends after the earliest certificate `notAfter`.
- **The bounded first-chat configuration** (`maxTurns 3`, `maxToolCalls 1`, no capability profile, no `features` block) is dot's first-chat setting. It is **not** the final Meri feature limit.

## Done by Fable (read-only, 2026-10-19 04:08 UTC): you can skip these

- **Step 1, certificate expiry:** `cert-expiry.mjs` on the PKI directory (it opens only public `.pem` files, never a `.key.pem`): all 13 certificates the render uses expire **2027-01-15T14:23:44Z, 88 days left**, exit 0 against the 14-day minimum (the render needs more than 7). This is dates only; the render itself still proves pins, chains and key pairs.
- **Step 5 inputs:** latest task-definition revisions, ACTIVE / INACTIVE-max, read 04:08 UTC: control 30 / 29, temporal-worker 29 / 28, temporal-issuer 29 / 28, owner 28 / 27, proxy 28 / 27, runner 15 / 14 (unchanged since 03:31 UTC). You still re-read them yourself immediately before the render (step 5 and the gate in step 6).
- **Step 6 dependency install:** run on the packet checkout with the published helper (`RENDER_IMPORTS_OK`, `git status` clean), so the install line in step 6 can be skipped for this checkout.

## NEXT: the exact commands for your pending credential steps (steps 2 and 3, then 4)

Paste block A in Git Bash on neomart, read the output, then paste block B. Replace only the three `<...>` values, from your own private records. Nothing below prints a token or an id.

```bash
# ---- block A: setup, then the bearer (stays on your disk)
set -uo pipefail
export AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 AWS_PAGER='' MSYS_NO_PATHCONV=1
R=C:/dev/fable/wt-meri-26e8d7b2; PUB=$R/docs/shipping/20261019/source348-public-render; PREP=C:/dev/fable/meri-stage3-prep-20261018
git -C "$R" rev-parse HEAD; git -C "$R" status --short                # expect 26e8d7b216b0e0ea0c01c101beef9314d5db80a9 and nothing else
aws sts get-caller-identity --query Account --output text            # expect 967807252336
W=C:/dev/fable/meri-stage3-$(date -u +%Y%m%dT%H%M%SZ); mkdir -m 700 "$W"; echo "work dir: $W"
aws secretsmanager describe-secret --secret-id meri/preview/core/identity-bearer --query '{versions:VersionIdsToStages,changed:LastChangedDate}' --output json
umask 077
aws secretsmanager get-secret-value --secret-id meri/preview/core/identity-bearer --version-stage AWSCURRENT --query SecretString --output text | tr -d '\r\n' > "$W/identity"
node "$PREP/bearer-exp.mjs" "$W/identity"; echo "bearer-exp exit: $?"      # send me this JSON and the exit code; if exit 1, stop (renew the bearer yourself)
```

```bash
# ---- block B (same terminal, after block A showed exit 0): the ONE step that sends the Core bearer, to Core over TLS
umask 077
printf 'authorization: Bearer %s\n' "$(cat "$W/identity")" > "$W/auth.header"
DEADLINE=$(( $(date +%s) * 1000 + 10000 ))
curl -sS --proto =https --max-time 15 -o "$W/membership.json" -w 'HTTP %{http_code}\n' \
  -X POST https://first-chat-preview.app-dev.capiro.ai/api/clio/application-authority/membership \
  -H @"$W/auth.header" -H 'content-type: application/json' -H 'accept: application/json' \
  -H 'accept-encoding: identity' -H "x-meri-deadline-at: $DEADLINE" --data '{}'
rm -f "$W/auth.header"
export MERI_EXPECT_TENANT=<tenantId> MERI_EXPECT_ACTOR=<actorId> MERI_EXPECT_CLIENT=<selected client uuid>
node "$PREP/membership-summary.mjs" "$W/membership.json" --min-seconds 600 --max-age-seconds 900; echo "membership-summary exit: $?"   # send me the HTTP line and this JSON
# if HTTP 200 and exit 0, continue straight on (same terminal) with section 4 below: core-values, then section 5, then the section 6 gate and render
```

## Handoff at a glance (what needs Neo, what transmits a credential, what to send back)

Only two steps ever transmit a credential, and only step 3 sends the Core bearer anywhere. Fable cannot run any of them; the checks marked "no" can be run without sending a credential to anyone.

| Step | Run by | Reads private input locally | Transmits a credential | Scrubbed output to send back |
|---|---|---|---|---|
| 1 `cert-expiry.mjs` | Neo | public certificate PEMs only | no | the date table and the exit code |
| 2a `describe-secret` (metadata) | Neo | no | Neo's own AWS identity to AWS; no secret value returned | version ids, last-changed time |
| 2b `get-secret-value` into a local file | Neo | writes the bearer to a local file | AWS identity to Secrets Manager; the bearer lands on Neo's disk, goes nowhere further | nothing (the file stays) |
| 2c `bearer-exp.mjs` | Neo | the bearer file | no | its JSON (length, shape, kind, iat/exp, seconds left) |
| 3 membership POST, then `membership-summary.mjs` | Neo | the bearer file | **yes: the Core bearer to Core over TLS** | the summary JSON (booleans, counts, times) |
| 4 `core-values` | Neo | membership file, bearer path | no | "written" only (the status line carries ids: do not paste it) |
| 5 `readrev` loop, `stage3-input` | Neo | no | read-only AWS metadata calls | `latest.tsv`, its read time, the status line |
| 6 dependency install | Neo | no | no (public npm registry only) | `RENDER_IMPORTS_OK` |
| 6 render, then `verify-rendered.mjs` | Neo | PKI, DB logins, bearer path (all local) | no | the `MERI_FIRST_CHAT_MATERIAL_RENDERED` status line, validity end, the expected/config/material-contract hashes, the `verify-rendered` lines |
| later: bundle upload (`PutSecretValue`) | Neo | the bundles | **yes: bundles to Secrets Manager** | not authorized yet |

## Inputs: packet 26e8d7b216b0e0ea0c01c101beef9314d5db80a9 (latest on `handoff/source348-public-render-inputs-20261019`; chain `26e8d7b2` <- `60754f81` <- `f0f18c04` <- `1666b46b` <- source `34851020`; `26e8d7b2` changes only the README (install layout, receipt-gap note); the candidates, the readback bytes, the lockfile and the Dockerfile are byte-identical to `60754f81`)

Checkout `C:/dev/fable/wt-meri-26e8d7b2`, detached, clean; public directory `docs/shipping/20261019/source348-public-render/`.

| File | SHA-256 (verified by Fable against the README) |
|---|---|
| `deployment-inputs.candidate.json` (byte-identical to `1666b46b`) | `40d92b957a50dc70fa25f9495125679a0d3f1cb3b0c65451959d93dc239832d5` |
| `runtime-values.candidate.json` (byte-identical to `1666b46b`) | `1f51b015ed9842ed7ebecb1510e6bd8c8f0993889400d1f63d6352878db678b1` |
| `image-scans.candidate.json` | `160198f9187ee1ce125758a9ab096d480c022275535e7e2ba1e70648d620a6f7` |
| `node-terminal-readback.json` (1,197 bytes; the Node scan evidence) | `ec89528ec9dae32689b086dbc9040a75e9ceac6aeaf8c9e4da4c6141cbe000c8` |
| root `package-lock.json` | `4a18a2e5eeb672758df381eba55653da2dc0d9e9ab26e3f6f7943ad19120753c` |

Scan evidence, as verified (read-only AWS and source reading; the 23,934-byte measurement ZIP was downloaded once read-only from the cited object version, checked in memory and deleted):

| Claim in `IMAGE-SCAN-EVIDENCE.md` | Fable's check | Result |
|---|---|---|
| `proxy` = `04d24b4b…9f53`, SHA-256 of the 950-byte `proxy-image-receipt.json` at the cited key and VersionId | S3 `HeadObject`: size 950, VersionId equal, S3's own stored full-object SHA-256 decoded to hex equals the candidate value | **exact match** |
| proxy build `e8bcfa6a…` succeeded; deployable image scan `COMPLETE`, empty severity counts | CodeBuild `SUCCEEDED`; ECR scan of `…734a20ec…` `COMPLETE`, `findingSeverityCounts {}`, no findings | confirmed |
| `nodeRuntime` = `ec89528e…c000c8`, hash of the exact 1,197-byte terminal build/ECR readback; original producer receipt not exported (`404`) | published bytes (`node-terminal-readback.json` at `60754f81`): 1,197 bytes, SHA-256 equals `ec89528e…`; its build id, start/end, source commit, source-archive version, image digest, scan completion time and empty severity counts all equal what Fable read from CodeBuild and ECR; `productImageReceiptKeyStatus 404` matches the empty `results/product-image/` prefix | **verified and now re-derivable.** The readback's `note` points at `node-success-receipt-gap.md`, which is not in the packet (dangling reference; the gap itself is stated in the evidence note). Used only as an opaque 64-hex (`stage3-bindings.mjs` checks the two exact keys and 64-hex; `model-proxy-plan.mjs` and the template pass it through as `reviewedScanSha256`) |
| exact-image measurement build `90e6b6f3…`, evidence ZIP at the cited key/VersionId, SHA-256 `106febd9…552e`, six members, receipt `2cd14ff7…` | CodeBuild `SUCCEEDED` on the same source-archive version as the Node build; the ZIP's SHA-256 equals `106febd9…`; exactly the six named members, all sizes and SHA-256 equal the published `MEASUREMENT-ZIP-INDEX.md`; no path-traversal names; receipt `status MEASURED`, schema `meri.existing-image-measurement.v1`, names source `34851020`, image digest `7b295b42…` and original Node build `526c3e16…`; Linux tests `COMPLETE`, **24 observed, 0 skipped, no failures**; launch measurement `VERIFIED` with **all seven gates PASS**, `selectionMode inventory-only`, no capability profile; seven of eight candidate runtime fields (executable, sdk-options, runner, skills digest, general-read measurement, catalog, policy revision) appear inside the archive and `scheduleRevision` equals `canonicalSha256(allocation.operations)` (derived, not measured) | **verified** |
| (not claimed) a second smaller measurement ZIP exists under the same prefix | its build `d071bc68…` **FAILED** | not the accepted evidence; do not use it |

Accepted caveats that stay on the record: the Node original producer receipt is **missing** (replacement evidence, as the note says), and the README's other statements are dot's, not Fable's. README facts Fable checked:
only `images` differs from the historical `deployment-inputs.json`; Temporal unchanged; runner hash `177a982b…` equals the git blob at `34851020`; the nine named missing composer operations are all in the
76-operation measurement; the Core placeholder is top-level `core`; the retained split is 55 native / 12 source-composable / 9 missing, all held (Fable did not recompute the 55/12 split).

## 0. Setup (no credentials sent anywhere)

```bash
set -uo pipefail   # no -e on purpose: a failing check (exit 1) must show its output, not close your terminal
export AWS_PROFILE=capiro-dev AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 AWS_PAGER='' MSYS_NO_PATHCONV=1
R=C:/dev/fable/wt-meri-26e8d7b2                      # verified checkout of the public packet, detached, clean (scripts identical to 34851020)
PUB=$R/docs/shipping/20261019/source348-public-render
PREP=C:/dev/fable/meri-stage3-prep-20261018          # this folder
OLD=C:/dev/fable/meri-stage3-20261017T182918Z        # historical working dir: read only, never written
PKI=C:/dev/fable/meri-preview-private-pki            # historical PKI: read only unless step 1 says renew
git -C "$R" rev-parse HEAD                            # must print 26e8d7b216b0e0ea0c01c101beef9314d5db80a9
git -C "$R" status --short                            # must print nothing
sha256sum "$PUB/deployment-inputs.candidate.json" "$PUB/runtime-values.candidate.json" "$PUB/image-scans.candidate.json" "$PUB/node-terminal-readback.json" "$R/package-lock.json"
#   must print 40d92b95…32d5, 1f51b015…78b1, 160198f9…a6f7, ec89528e…c000c8, 4a18a2e5…753c (full values in the table above)
node --version                                        # README requires >=24 <25 (neomart has v24.19.0)
aws sts get-caller-identity --query Account --output text   # must print 967807252336
W=C:/dev/fable/meri-stage3-$(date -u +%Y%m%dT%H%M%SZ); mkdir -m 700 "$W"; echo "$W"   # NEW private working dir; every output below goes here
```

`stage3-deploy.mjs` refuses to write inside the repository and never overwrites an existing file, so the historical inputs cannot be clobbered by it.

## 1. Certificate validity (reads only the public `.pem` files; prints dates)

```bash
node "$PREP/cert-expiry.mjs" "$PKI" 14
```

- Exit 0: every certificate the render uses has at least 14 days left (the render needs more than the 7-day validity). The render's own `verifyPki` separately proves all 13 certificates against `pins.json` and the
  public pins in the candidate, the chains (leaf issued by the right CA, SANs, subjects) and each private key against its certificate; it refuses on any mismatch.
- Exit 1 (short or missing): the PKI must be renewed before any render. Renewal is **your** private-material generation:
  `python -I C:/dev/fable/wt-meri-26e8d7b2/infra/product-preview/first-chat/pki.py C:/dev/fable/meri-preview-private-pki-NEW --days <N>` into a **new** directory (it refuses an existing one), then
  the public pin hashes in `deployment-inputs.json` (`pinsDer`, `pinsPem`) change and go back through dot as a reviewed public JSON. Do not overwrite `$PKI`, and do not edit a pin or an expiry to force a pass.

## 2. Credential validity

Bearer. Read-only metadata (safe, no value): `meri/preview/core/identity-bearer`, AWSCURRENT `15fcf7a3-dd89-49e5-b5f8-f6206964767e`, AWSPREVIOUS `51a0d905-2331-4435-b2fe-b3ac343b467f`,
last changed 2026-10-17 14:28 -04:00. Re-run `describe-secret` first; if the version changed, use what it prints.

```bash
aws secretsmanager describe-secret --secret-id meri/preview/core/identity-bearer --query '{arn:ARN,versions:VersionIdsToStages,changed:LastChangedDate}' --output json
umask 077
aws secretsmanager get-secret-value --secret-id meri/preview/core/identity-bearer --version-stage AWSCURRENT --query SecretString --output text | tr -d '\r\n' > "$W/identity"
node "$PREP/bearer-exp.mjs" "$W/identity"      # prints shape, kind, iat/exp, seconds remaining: no token, no other claim
```

- Exit 0 and (for a JWT) comfortably more than 10 minutes left: continue. `kind: "opaque"` carries no expiry, so step 3 is then the only proof.
- Exit 1 (expired, expiring or bad shape): obtain a fresh Clerk `capiro-template` bearer yourself, `put-secret-value` it to the same secret name, and repeat. Fable cannot and will not mint or store a credential.

DB logins (`db-logins.json`, last written 2026-10-17 11:42). **State: `UNKNOWN`.** The password for each DB role (`control`, `modelOwner`, `issuer`) is only provable by an authenticated database connection, and no authorized proof
of current validity exists in this session. Report `UNKNOWN`; do not change the file, a role, a trust setting or an expiry to force a pass. A wrong password surfaces only when a service starts, so this is a known residual
risk of the render, not something a local check can clear.

## 3. Fresh membership validation (credential-bearing: you run it; Fable never sees the response)

```bash
umask 077
printf 'authorization: Bearer %s\n' "$(cat "$W/identity")" > "$W/auth.header"
DEADLINE=$(( $(date +%s) * 1000 + 10000 ))
curl -sS --proto =https --max-time 15 -o "$W/membership.json" -w '%{http_code}\n' \
  -X POST https://first-chat-preview.app-dev.capiro.ai/api/clio/application-authority/membership \
  -H @"$W/auth.header" -H 'content-type: application/json' -H 'accept: application/json' \
  -H 'accept-encoding: identity' -H "x-meri-deadline-at: $DEADLINE" --data '{}'
rm -f "$W/auth.header"
# From your private records (not from this file), so the summary can prove it is the INTENDED tenant, actor and client without printing them:
export MERI_EXPECT_TENANT=<tenantId> MERI_EXPECT_ACTOR=<actorId> MERI_EXPECT_CLIENT=<selected client uuid>
node "$PREP/membership-summary.mjs" "$W/membership.json" --min-seconds 600 --max-age-seconds 900
```

It must print HTTP `200` for the curl and exit 0 for the summary: exact receipt shape, `status active`, an admitted role, client ids are UUIDs, `fresh` (checked within 15 minutes), `validForMargin` (valid for at least 10 more
minutes, which is the time you have for steps 4-6), and the three `expected…` booleans `true`. Anything else: stop and report the HTTP code and the summary only. The `core-values` helper in step 4 does **not** reject an expired
or stale old receipt; this summary is what does.

## 4. New `core.json` (private; copies only the bearer's path)

```bash
FRONTEND_ORIGIN=https://portfolio-preview.app.capiro.ai   # dot's intended origin; Fable verified it equals the live Core task definition's WEB_ORIGIN (03:29 UTC) and passes the render's bare-https-origin rule
node "$R/infra/product-preview/first-chat/stage3-deploy.mjs" core-values --membership "$W/membership.json" --identity "$W/identity" \
  --frontend-origin "$FRONTEND_ORIGIN" [--client-id <uuid, required when the summary says clientCount > 1>] --out "$W/core.json"
```

It prints the tenant/actor/client ids it wrote: treat that line as private. Never compare against or reuse `$OLD/core.json`.

## 5. Fresh task-definition revisions and the new `stage3.json` (no secrets)

Read them **immediately** before the render, ACTIVE and INACTIVE, for all six families. ECS never reuses a revision number and the render pins these ARNs.

```bash
readrev() { : > "$1"; for f in meri-product-preview-control meri-product-preview-temporal-worker meri-product-preview-temporal-issuer meri-product-preview-owner meri-product-preview-proxy meri-product-preview-runner; do
  for s in ACTIVE INACTIVE; do
    printf '%s\t%s\n' "$f" "$(aws ecs list-task-definitions --family-prefix "$f" --status $s --sort DESC --max-items 1 --query 'taskDefinitionArns[0]' --output text)" >> "$1"
  done; done; }
readrev "$W/latest.tsv"; date -u +%FT%TZ > "$W/latest.read-at"
cat "$W/latest.tsv"       # safe to paste: family and revision only
node "$R/infra/product-preview/first-chat/stage3-deploy.mjs" stage3-input --deployment-inputs "$PUB/deployment-inputs.candidate.json" \
  --foundation-outputs "$R/infra/product-preview/first-chat/foundation-outputs.json" --latest "$W/latest.tsv" --out "$W/stage3.json"
```

Fable's read-only check at 03:31 UTC found control 30, temporal-worker 29, temporal-issuer 29, owner 28, proxy 28 (each running at desired 1) and runner ACTIVE 15 (INACTIVE max 14). That is a snapshot, not a prediction:
do not copy numbers from it.

## 6. Pre-render gate, then render locally (reads private custody; writes only into `$W/rendered`)

Run the render only when **every** line is true *now*; if any is false, or more than 15 minutes have passed since the membership read in step 3, repeat steps 3-5 and start this gate again:

- [ ] step 0 hashes and HEAD printed the expected values
- [ ] `cert-expiry.mjs` exit 0 (step 1)
- [ ] `bearer-exp.mjs` exit 0 (step 2); DB-login state recorded as `UNKNOWN` (or authorized proof, if you hold it)
- [ ] `membership-summary.mjs` exit 0 with `--min-seconds 600`, and the three `expected…` booleans true (step 3)
- [ ] `core.json` and `stage3.json` were written by steps 4 and 5 in this same run
- [ ] **revisions unchanged:** `readrev "$W/latest.again.tsv" && diff -q "$W/latest.tsv" "$W/latest.again.tsv" && echo REVISIONS_UNCHANGED` (otherwise redo step 5)

```bash
# Dependencies first (public npm packages, no credentials; skip if you already ran it in this checkout). Root `npm ci` ALONE FAILS: the render imports apps/runtime, which needs
# @aws-sdk/client-ecs and @capiro/meri-contracts (verified by Fable on a fresh checkout: ERR_MODULE_NOT_FOUND). This script reproduces apps/runtime/Dockerfile lines 8-24 and 41 and ends
# with RENDER_IMPORTS_OK. `git status` stays clean afterwards (node_modules is git-ignored). Do not edit any lockfile.
bash "$PREP/install-render-deps.sh" "$R"
cd "$R"                                                                  # the render is run from the checkout root
git -C "$R" cat-file -e 34851020aa0d73fead4db59ba6e26a098e2d0313^{commit} && echo COMMIT_PRESENT   # the render re-measures the runner from this commit; the candidate runnerSha256 equals that git blob (Fable checked)
node infra/product-preview/first-chat/render-material.mjs --deployment-inputs "$PUB/deployment-inputs.candidate.json" --private "$PKI" \
  --core "$W/core.json" --runtime "$PUB/runtime-values.candidate.json" --stage3 "$W/stage3.json" --out "$W/rendered"
node "$PREP/verify-rendered.mjs" "$W/rendered" 7b295b4265141ff8feefc86dd3fec18e10be5e1a72cd88b7a50511ef53501044 734a20ec036a9aacb1f99cd8f8d2a0d5a3319a44a27e13e14781e396ebec3551
```

- **Dry-run evidence (Fable, throwaway inputs only):** the same candidates rendered end to end (`MERI_FIRST_CHAT_MATERIAL_RENDERED`, exit 0, all five roles bound to the accepted digests, source `34851020`) with a throwaway PKI, fake DB logins, a fake bearer-shaped file and fake ids, after the dependency layout above. It is tested-path evidence only (one machine, throwaway inputs): it says nothing about why a real render might fail, so diagnose a real failure from its own output.
- The render performs no AWS write. `verify-rendered.mjs` reads only each role's `expected.json` and `summary.json` and must print `ok` for all five roles; its output is safe to paste.
- `$W/rendered/*/bundle.json` is secret. It stays in `$W` (outside Git; on Windows rely on the profile ACL) and is **not uploaded**.
- Owner and proxy service tasks and pricing expire 7 days after the render; if any later step slips past that, render again.
- Return only: the scrubbed statuses above, the public pins, the `latest.tsv` revisions with their read time, certificate expiry (earliest notAfter), the render's validity end, and the expected/config/material-contract hashes.
  Never send the private summary, `bundle.json`, `config.json`, `core.json`, the membership file or any stack trace.

## 7. Stop here. What comes later (not authorized by this file)

`docs/shipping/20261017/STAGE3-DEPLOY-RUNBOOK.md` describes a **first** deployment at count 0 on N6/B6. The account is not in that state:

- The `meri-first-chat-*` stacks exist and every service is running (desired 1); the later secret-version and change-set steps are **updates**, and the scale sequence must account for rolling running services (exactly one control task;
  poststart nonces are process-local).
- Core is active: `capiro-preview-first-chat-core:2`, image `capiro/preview-core@sha256:46acfc07…`, release `ade7fc88…`, desired 1, target group healthy on port 4000; `PREVIEW_NATIVE_GETS_ENABLED` is not set in that task definition. Runbook step 2 (activation) does not apply.
- The later `bindings` step takes `--image-scans "$PUB/image-scans.candidate.json"` (hash verified above), live `describe-stacks` outputs and the new `$W/rendered`; it refuses on any drift. Tenant budget (runbook step 4) is an idempotent insert and the row very likely exists.
- Upload (`PutSecretValue`), change sets, scaling and any probe or chat each need their own reviewed request and your explicit go.
