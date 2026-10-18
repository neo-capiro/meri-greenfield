# Meri integrated release: deployment packet (DRAFT, assembled by R0)

Status: **draft for dot's read-only review; nothing in it is executed.** Target: the preview stacks promoted in place as the production deployment (D016-A §10). Every activation below names the decision it depends on (D016, D016-A). Hashes marked `TBD` are filled when the final images are built and measured.

**Dot successor readback, 18 Oct:** ECS task definitions control `:27`, runner `:12`, and Stage 1 migrator `d2-migrate:6` report Linux `X86_64`; `runtime-packages.lock.json` pins `linux/amd64`. N22 therefore remains an amd64 candidate, subject to exact image/scan/measurement evidence. PR121 `6249675109` records the read-only metadata. RD/occurrence/retained-read source status is in `DOT-SOURCE-INTEGRATION-20261018.md`; the 76-operation receipt has 21 retained handlers without production trusted ports, so `reads.missing` cannot be assumed empty. Core #86 `f64047ac` accepts the four-field revoke and supplies the revised snapshot installer; this branch mirrors the installer in source. Neither has a qualified image or live activation. The existing-preview chat diagnosis is in `DOT-CHAT-DIAGNOSTIC-PACKET-20261018.md`. This packet authorizes no live operation.

**Launch gate decision:** Neo approved critical functional, desktop, accessibility, security, isolation, revocation, cancellation/recovery, operations and rollback checks before launch, with the larger labelled corpus and long benchmark program tracked after launch. The separate chat diagnostic may run on a smaller coherent compatible cohort without completing this packet or promoting it to production.

**Destination clarification:** the final production app origin is `https://os.capiro.ai` (`is.capiro.ai` was a typo). Before any later production cutover, pin the same canonical origin through auth callbacks, cookies, CORS, redirect rules and frontend/Core/Meri configuration, and prepare rollback to the prior immutable pins. This does not change current preview DNS. Neo permits production data connections in the confirmed maintenance window on the real code path; it does not authorize irreversible deletion or new security grants. Confirm that window before a disruptive production-facing change.

## 0. Order of operations

1. Source freeze: Meri integration successor tip `TBD` (this branch is a contract input, not the N21 shipping tree), Core #86 head at least `f64047ac`, frontend #92 head `271a267d`.
2. Final runtime image (N22) from the freeze tip; in-image `--shipped` measurement **with** the D016 capability profile and the B1 budget; re-pin `allocation.json`, `policy.json`, `runtime-values.json`, `launch-measurement-receipt.json`, `deployment-inputs.json`, `image-scans.json`.
3. One integrated release qualification on the frozen tree (focused suites plus the full `apps/runtime`, `apps/control`, `apps/gateway`, `packages/contracts` sweep once), results recorded in the release record.
4. Infrastructure (reversible, preview-scoped, under the 17 Oct standing authorization): §3.
5. Database: manual snapshot, then `first-chat-migrate.mjs integration` through the Stage 1 migrate task (§4).
6. Core preview rev 3 (§5), listener rule as a coordinated action with dot (§6).
7. Runtime render with `features` (§2) and deploy of the five Meri stacks plus the schedule worker (§7), with the normal cycle and a fresh archive name.
8. Frontend #92 image through the reviewed template (§8).
9. Readback: product readiness on control, `reads.missing` and `documents.missing` empty, Core routes answering, listener readback; then the authenticated chat test (prompt → response → history after reload → follow-up) and each required workflow.
10. Rollback (§9) is prepared before step 5 runs.

## 1. Images

| Stack | Source | Image | Scan |
|---|---|---|---|
| Runtime (control, worker, owner, proxy, issuer, runner, schedule-worker, migrator) | #145 `TBD` (N22) | `TBD` | 0 findings required |

Runtime image additions for N22 (lane X finding): the document generation executor needs Python 3 and the pinned pptxgenjs module in the wolfi runtime image (`apps/runtime/Dockerfile`, `runtime-packages.lock.json`), rendered as `artifacts.executor {pythonExecutable, nodeExecutable?, pptxModulePath, tempRoot, timeoutMs?}`; without them documents stay 503 by design.
| Core preview | capiro-backend #86 `f64047ac` plus any reviewed successor | `TBD` | 0 findings required |
| Frontend preview | capiro-frontend #92 `271a267d` (tree `5fe8d221`) | `TBD` | 0 findings required |

Last pinned runtime: N21 `176a8811`, `sha256:5534edfe…`, measured without a profile (SDK template `af7f07b8…`) and with the proposed profile (`ba90896e…`, evidence in `docs/integration/evidence/`).

## 2. Render `features` (D016 #2, #3, #6; D016-A)

```json
{
 "sourceEnabled": true,
 "userPreferences": {"enabled": true},
 "tenantSettings": {"enabled": true},
 "intents": {"enabled": true, "core": {"enabled": true}},
 "routines": {"enabled": true, "task": {"taskId": "TBD (generic routine task UUID)", "version": 1}, "workflow": {"taskQueue": "TBD (same queue as schedule worker)", "workflowIdPrefix": "TBD (pinned schedule prefix)"}},
 "retention": {"enabled": true},
 "artifacts": {"enabled": true, "region": "us-east-1", "bucket": "TBD (§3)", "prefix": "preview/", "expectedBucketOwner": "967807252336", "kmsKeyId": "arn:aws:kms:us-east-1:967807252336:key/1cca74fc-d9ae-43a6-8bfd-b93107e90042", "authority": {"enabled": true}},
 "downloadLinks": {"enabled": true},
 "capabilityPlatform": "<PROPOSED_PREVIEW_CAPABILITY_PLATFORM verbatim; profile sha256 908d728a… with 14 skills; measured with N22>",
 "reads": {"enabled": true, "serviceSecretArn": "TBD (Core INTERNAL_SERVICE_SECRET exact ARN)", "defaultCongress": 119, "approvedReads": "<lane 2 catalog, 76 operations>", "installation": {"enabled": true}, "discovery": {"enabled": true}, "delegation": {"enabled": true}}
}
```

Plus `--feature-secrets` with the exact VersionId of each secret at render time, and `"memory": {"enabled": true}` (renders `memory {enabled, origin: core.coreOrigin, serviceSecretFile: the reads secret}`). `"intents": {"enabled": true, "execution": {"issuer", "keys": [Ed25519 public JWKs with kid]}}` and `"routines": {"enabled": true, "core": {"cancellationProof": {issuer, kid, publicKey}, "unattendedGrant": {issuer, kid, publicKey}}}` render the Core origin and the reads service secret file into `intents.execution` / `routines.core`; the public JWKs come from the packet's KMS keys (`GetPublicKey` readback). `intents.core {enabled}` renders the Core P-INT-10 approval forwarder block (`intents.core {origin, serviceSecretFile}`, lane L); `reads.installation` / `reads.discovery` render the P2 installation pin plus the brotli measurement material and the P1 discovery toggle (lane R3; the pin comes from the N22 runtime values); `reads.delegation {enabled}` renders option B's toggle — set it `false` at render time if Core's delegation routes are not live yet (§11), never leave it on against a Core that lacks them.

Budget pins (B1): `allocation.json` `budgets.maxTurns 20`, `maxToolCalls 20`, `maxCostMicroUSD 2000000`, `maxRuntimeSeconds 900`; `policy.json` `runtime.maxTurns 20`; read operations with tariffs (P3). These are configurable test defaults (D016 #3), re-set after the qualification measurement. The tenant daily cap stays the **non-resetting USD 25 row** (remaining plan §2): a later day needs a reviewed cap update by the operator; no automatic reset ships.

## 3. Infrastructure (D016 #9, #10; D016-A #8)

| Resource | Spec | Why |
|---|---|---|
| S3 bucket `TBD` (artifacts) | private, Block Public Access on, SSE-KMS with the existing Meri preview key `1cca74fc…`, versioning on, `expectedBucketOwner 967807252336` | documents |
| KMS key, execution capability | `ECC_NIST_EDWARDS25519`, sign/verify, Core signer role only | intents execution (Core-side signer) |
| KMS key, routines cancellation proof | same spec, separate key and `kid` | routines |
| KMS key, read delegation | separate `ECC_NIST_EDWARDS25519` sign/verify key and `kid`; Core uses `ED25519_SHA_512` over RAW, Meri treats the token as opaque | Option B delegated reads |
| KMS keys ×3, Objective (D7-2) | same spec, one per purpose | Objective activation (keys ready; activation when Core phases land) |
| Core `INTERNAL_SERVICE_SECRET` | **new** secret `meri/preview/core/internal-service-secret` (read back 18 Oct: the preview Core task `capiro-preview-first-chat-core:2` carries no such secret, and `capiro/dev/internal-jwt-secret` is Core's JWT secret, unrelated). Generated at packet execution (32 random bytes, base64url), stored once, never in git; its exact ARN + VersionId go to the Core preview task (`secrets: INTERNAL_SERVICE_SECRET`) and to Meri's `features.reads.serviceSecretArn` / `--feature-secrets` | reads, artifacts, approvals, memory, routines |
| IAM (roles read back 18 Oct) | control task role `MeriPreview-control-task`: `s3:GetBucket*`, `Put/Get/HeadObject` on the artifacts bucket; `kms:GenerateDataKey/Decrypt` on the Meri key `1cca74fc…`. Core preview task role `Capiro-Preview-First-Chat-ServeTaskTaskRoleD6B44EC7-…`: purpose-scoped `kms:Sign` for configured execution, routine and read-delegation signers; `GetPublicKey` readback pins each public key before activation. Secret reads: `MeriPreview-control-execution` (the new service secret, via the control material bundle) and `Capiro-Preview-First-Chat-ServeExecutionRole9B512BD-…` (the same secret for `INTERNAL_SERVICE_SECRET`). The temporal worker task has no task role and needs none. | least privilege |

## 4. Database (D016 #1)

- Snapshot: `aws rds create-db-cluster-snapshot --db-cluster-identifier capiro-dev-data-auroracluster23d869c0-ltmz40k47ewv --db-cluster-snapshot-identifier meri-integration-pre-<UTC>`; wait `available`; record.
- Apply: `node infra/product-preview/first-chat-migrate.mjs integration` (plan ordinals 22-39 at this successor source; final pin `TBD`, `plan` output recorded). Refuses unless `meri` and `temporal` are ledgered.
- In the plan: `meri_memory` 0001 (lane M), `read_delegation_facts` 0001 (option B), and schedules `0004_read_consent.sql` (ordinal 29, SHA-256 `d57783e1a9e349d1df43e00a273db588b48a6c1b4a49279b30da8428b0ec9830`). Integration grants are re-pinned to `298f74bb550194225976c275fe90dee3f218499f883bd5c9ed7b33da211e235f` at ordinal 39; the snapshot installer below still needs isolated PostgreSQL/restore qualification.
- Core's canonical-admission read (done in source, see the next two lines): a **Meri-owned `SECURITY DEFINER` snapshot function** (dot 6248138427, refined 6248171459): fixed signature, static schema-qualified SQL, `SET search_path = pg_catalog, pg_temp`, VOLATILE PARALLEL UNSAFE, lock first then `clock_timestamp()` in a separate statement, Core proposal lock before budget lock, grants in stable id order; owner a dedicated NOLOGIN non-superuser role with only the needed SELECT/row-lock privileges; `REVOKE EXECUTE FROM PUBLIC` in the creation transaction; schema USAGE + exact-signature EXECUTE to the Core API role only. Installer DDL comes from Core #86 `docs/integration/CORE-ADMISSION-SNAPSHOT-FUNCTION-20261018.sql` at `f64047ac` and is carried in `first-chat-database-integration.sql`; rollback (`DROP FUNCTION`, `DROP ROLE`) remains in §9. Core's receiver calls the function on its existing transaction connection.
- Core API role: **`capiro_app`** (Core migration `20260502020000_capiro_app_role`; the preview Core task's `DB_USER` is the `username` key of its app credential secret). **Readback before Stage 1:** `aws secretsmanager get-secret-value` on that secret, print the `username` key only; the grants phase fails closed (`MERI_D2_CORE_APP_ROLE_MISSING`) if the role is absent.
- Placed in `first-chat-database-integration.sql` (phase `integration_grants`, re-pinned): USAGE + SELECT on the four `meri_read_delegation_facts` views to `capiro_app`; the snapshot function `meri_core_authority.current_admission_v1(uuid,uuid,uuid)` (Core successor #86 `f64047ac`, source SHA-256 `12e158b62678d5eac3d196d70ae3dfffbe6d118f194fe4ea20a3bc76b9790dd3`, function body preserved) is created as NOLOGIN `meri_core_admission_reader` after a temporary SET-only installer membership and temporary schema CREATE grant; both are removed in the same transaction. Its grants remain SELECT on the five budget tables + `native_allocations` and `UPDATE (quarantined)` for the `FOR SHARE` lock. `capiro_app` receives only function EXECUTE, schema USAGE and the four view SELECTs. The phase readback rejects a retained reader schema CREATE or installer SET edge. Before this phase, verify the Aurora installer's CREATE ROLE, SET ROLE `meri_product_migrator`, temporary membership and schema CREATE capabilities, the `capiro_app` login and base-object ownership. Rollback in §9.
- Core migrations on #86 (approvals, memory, routines consent, read delegation `20281018060000`): Core owner's packet section, same snapshot. The isolated draft `070000` is superseded and must not be applied.
- Rollback: §9.

## 5. Core preview rev 3

- Current: `capiro-preview-first-chat-core:2`, image `…preview-core@sha256:46acfc07…` (secrets today: DB_USER, DB_PASSWORD, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET). Target: image from #86 `TBD`; task template adds `INTERNAL_SERVICE_SECRET` by the new exact ARN (§3); `MERI_TOOL_ALLOWLIST` exact 65 names (fail closed); `MEMORY_GOVERNANCE_LIFECYCLE=enforce` + preview tenant in `MEMORY_GOVERNANCE_TENANTS` (preview task only); `PREVIEW_NATIVE_GETS_ENABLED=true`; KMS key ARNs for the signers (execution `MERI_EXECUTION_*`, routines firing `MERI_ROUTINE_FIRE_SIGNER_*`); the D016 profile in the template (Core 6249249387): `MERI_EXECUTION_MAX_TURNS=20`, `MERI_EXECUTION_MAX_RUNTIME_SECONDS=900`, `MERI_EXECUTION_MAX_COST_MICROUSD=2000000`, `MERI_ROUTINE_MAX_COST_MICROUSD=2000000`, `MERI_ROUTINE_MAX_RUNTIME_SECONDS=900` (turns/tool calls are enforced by the allocation); `MERI_TOOLS_REQUIRE_SERVICE_SECRET=true` with `NODE_ENV=production`. **`INTERNAL_SERVICE_SECRET` must carry no surrounding whitespace** (Core compares the exact header, Meri trims its file). Core packet migration `20281018050000` lifts `CHECK(unattended_enabled=false)` and adds consents, revocations and the firing-grant ledger; listener P3 second value `^/api/clio/(application-authority/artifact|routines/(policy/check|cancellation-proof|unattended-grant))$`. **No ordinary-bearer `create_task` fallback in `first-chat-preview`:** `features.intents.execution` is ON in the same activation window as Core rev 3 (§11).

## 6. Listener (coordinated action with dot)

- Core #86's binding v5 adds optional `signers.readDelegation`: a distinct Ed25519 KMS key with `MERI_READ_DELEGATION_SIGNER_{ISSUER,KID,KMS_KEY_ARN,PUBLIC_KEY_X}` and exact source/image pins. Core migration `20281018060000_meri_read_delegation` is required before Option B; the isolated draft `070000` is superseded. Keep `features.reads.delegation.enabled=false` until the key, migration, Meri facts grants, installer and Core/Meri images are qualified together.
- Core's compact option: P1 POST (3 values), P2 GET (3 values), one exact P3 rule for native ops (approvals, memory, artifact authority, routines, read delegation). Move the current host-only guard from P3 to a free priority verified by current listener readback before installing the P3 native rule; never assume P4. Exact values come from `first-chat-core-routes.json` at the freeze.
- Readback recorded before and after.

## 7. Runtime deploy

- Normal cycle (`n<N>-cycle.sh` pattern): scale control/worker to 0, render with `features`, deploy the three stacks, rescale; fresh archive name; supervisor patch included; the diag9 entrypoint **removed** (the runner now self-reports `RUNNER_STARTUP_FAILED stage=… code=…`).
- New service: `meri-product-preview-schedule-worker` (D016-A #5), same image, role `schedule-worker`, its own DB role and grants (B2).

## 8. Frontend

- `fe-build-271a267d.sh` → scan → change set (template AllowedValues include contracts 0.1.10) → deploy; `CHANGE-SET.md` appended.

## 9. Rollback

- Runtime/Core/frontend: redeploy the previous pinned images (N17 `4172e474` runtime, Core rev 2 `ade7fc88`, frontend rev 17 `4ea553fe`); the render without `features` is byte-identical to today's.
- Database: logical rollback drops only the new schemas (`meri_settings`, `meri_intents`, `meri_commands`, `meri_schedules`, `meri_task_lookup`, `meri_objective_source`, `meri_artifacts`, `meri_memory`, read-delegation facts) and their ledger rows; the snapshot is for disaster recovery only.
- Listener: restore the recorded pre-change rules.

## 10. Observability and backups

- Runner stage/code on stderr (D14), control `runtime.reads.unavailable` / `runtime.documents.unavailable` events, product readiness endpoint, Temporal visibility, CloudWatch logs per task family; Aurora 14-day PITR plus the manual snapshot.

## 11. Activation map

| Family | Activates when | Decision |
|---|---|---|
| Conversations, budget | deploy | — |
| Preferences, tenant settings | settings 0001 + render keys | D016 #1 |
| Reads (A now, B when Core lands) | reads keys + P1/P2/P3 producers + Core W1 | D016 #2, D016-A #4 |
| Intents, tasks | intents/commands migrations + Core P-INT-10/execution receiver + KMS key + the admission snapshot function; **`intents.execution` ON together with Core rev 3 (no fallback)** | D016 #9 |
| Routines (attended, then unattended) | schedules migrations + Core routes + schedule worker + consent migration | D016-A #5 |
| Documents | artifacts migrations + bucket + Core authority receiver + lane X owners | D016 #10 |
| Memory | `meri_memory` 0001 + Core M2 + governance flags | D016 #6 |
| Objective | Core phases + D7-2/3 | D016-A #8 |
| Browser/Bash | D005 host qualification | D015 #8 |
