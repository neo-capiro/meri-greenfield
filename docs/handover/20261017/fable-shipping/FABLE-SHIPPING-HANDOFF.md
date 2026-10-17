# Fable shipping handoff: Capiro preview, 17 October 2026

## Current ownership: Meri resumed at 01:34:09 UTC

**Neo reversed only the Meri stop/handoff at 2026-10-17 01:34:09 UTC. Codex/dot retains Meri qualification and shipping preparation and continues without waiting for Fable. Codex/dot owns shipping coordination. The immutable frontend/Core handoffs remain technical checkpoints from their source owners; their Fable assignment is historical. Dot retains step 3: the real authenticated prompt, streamed answer, saved conversation and reload acceptance.**

The 01:19:23 UTC Meri stop and the later local-seal inventory below are historical pre-start checkpoints. Their no-upload/no-StartBuild and unused-reservation statements describe that cut, not current live operations. The root Meri thread and its exact later operation receipts are authoritative for subsequent attempt identity, upload, start, terminal result and budget consumption. This document update does not start or approve any operation.

## Current terminal checkpoint, 01:44 UTC

**The allocated Meri attempt is now consumed and terminal FAILED.** Exact build `5b67476a-5b30-43a7-9957-d83c72525aa2` reached ECR_SCAN and pushed digest `sha256:e318ab002a9f1dfb86245c352d2f521f09c66086f31d9ffd92f08cbf39f0b236`. CloudTrail proves an initial `ScanNotFoundException`; the later completed scan independently reports **3 HIGH findings**. Cleanup passed, but there is no success receipt and independent image acceptance is **HOLD**. No build remains active and no next build is allocated. Read [the exact current terminal record](MERI-TERMINAL-QUALIFICATION-20261017.md) and [machine-readable pins](MERI-CURRENT-QUALIFICATION.json).

The [frontend owner's current binding plan](https://github.com/neo-capiro/capiro-frontend/blob/6d796834aab693e90a3a052548c4c51a03ebe3c3/docs/non-meri-continuation-20261016/FIRST-CHAT-PREVIEW-BINDING-PLAN-20261017.md) defines 0.1.8 as the **frontend consumer distribution**. Meri's producer package remains 0.1.7; private initial-input protocol is 0.1.8. [Exact source/schema comparison](MERI-CONTRACT-COMPATIBILITY.md) found no wire mismatch. Do not relabel either artifact or require equality merely to satisfy a literal. Image, mounted native authentication/allocation/admission and recovery remain unproved.

## Historical handoff request, 01:19:23 UTC

Neo requested this safe checkpoint at **2026-10-17 01:19:23 UTC**: “find a stoping point for 1 and 2” and provide detailed instructions for Fable to finish shipping, then return step 3 to dot. The numbered scope was:

1. Finish the frontend image and pass Meri's Linux image qualification.
2. Activate and connect Core, Meri and the preview UI with the required runtime bindings.
3. Verify a real authenticated prompt, streamed response, saved history and reload.

**At that historical checkpoint, Fable was to take steps 1 and 2 and dot retained step 3. Neo reversed the Meri portion at 01:34:09 UTC; the current ownership block above controls.** The immutable frontend/Core handoffs remain technical checkpoints; their dated Fable ownership wording is historical, and [AGENTS.md](../../../../AGENTS.md) records the lane split. It does not change the product's Claude Agent SDK orchestration, AI SDK transport, canonical owners, dedicated conversation isolation or deployment plan. Separate product source lanes keep their owners.

### Historical pre-start cut: preserved safe stop

| Lane | Final checkpoint | Paid operation still running? |
| --- | --- | --- |
| Meri | Reviewed code `38f52df94b1738649776792b2a28aac743801c19` is published and sealed locally. It has **not** been uploaded or built. No fresh attempt UUID, upload intent or StartBuild request exists. The latest three product-image builds are terminal FAILED. A fresh read of the latest five project builds found all terminal. | **No.** |
| Frontend | Owner reports the allocated continuation `capiro-portfolio-preview-build:f9c07a42-6404-4e6d-9a5c-dca834d42de4` terminal SUCCEEDED at 01:21:55 UTC, immutable image pushed and exact-digest scan COMPLETE with zero findings. No service change. | **No.** |
| Core | Qualified image, retained guard, receipt-only migration, app-role postcheck and private process startup passed. All one-shot tasks stopped; standing service desired/running/pending **0/0/0**, target group empty. Public target health and authenticated HTTP remain unproved. | **No.** |

At this preserved cut there was no outgoing build to resume, retry or orphan. The unused Meri allocation was a reservation, not a started operation. Later Meri operations are owned by Codex/dot and recorded in the root thread and exact operation receipts. This checkpoint does not claim a live model response, accepted live chat, public API readiness, Meri deployment or broad release acceptance.

## Canonical owner handoffs and exact pins

- **Core:** [immutable Core shipping handoff](https://github.com/neo-capiro/capiro-backend/blob/635486fd21f0fb0f6893241f47dbfef7d343d849/docs/core-first-chat-fable-shipping-handoff-20261017.md). It supersedes dated Core origin/image and service proposals in Meri documents.
- **Frontend:** [immutable frontend shipping handoff](https://github.com/neo-capiro/capiro-frontend/blob/aae57e924e5812f331c76557f2b7ccaddd4ba0f9/docs/non-meri-continuation-20261016/FABLE-FRONTEND-SHIPPING-HANDOFF-20261017.md) and [dot's live acceptance checklist](https://github.com/neo-capiro/capiro-frontend/blob/aae57e924e5812f331c76557f2b7ccaddd4ba0f9/docs/non-meri-continuation-20261016/DOT-LIVE-ACCEPTANCE-20261017.md). Read both before changing the preview service or first-chat flags. The machine-readable links are in [OWNER-HANDOFF-LINKS.json](OWNER-HANDOFF-LINKS.json).
- **Meri:** this primary document, [source/PR stack and context index](MERI-SOURCE-AND-CONTEXT.md), [qualification checkpoint and private evidence references](MERI-QUALIFICATION-CHECKPOINT.md), [binding inventory](ACTIVATION-BINDINGS.md), and [exact qualification resume procedure](RESUME-QUALIFICATION.md).

| Repository | Shipping product source | Branch and PR | Image state |
| --- | --- | --- | --- |
| [`neo-capiro/capiro-frontend`](https://github.com/neo-capiro/capiro-frontend) | `e0b47a34d00b8c181420188ed39a1d849e25ec0a`, tree `a774141d541ae051d1eafe6d50c46215c2ff1ebe` | `feat/meri-first-chat-bootstrap-preview-20261016`, draft [PR #60](https://github.com/neo-capiro/capiro-frontend/pull/60). Documentation-only head `aae57e924e5812f331c76557f2b7ccaddd4ba0f9` does not replace the image source pin. | `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview@sha256:185d6ab9f7a8a6395546be4ac2374de2e329ab6182627de18e1fca9732220bcc`, immutable tag `e0b47a34d00b8c181420188ed39a1d849e25ec0a`. |
| [`neo-capiro/capiro-backend`](https://github.com/neo-capiro/capiro-backend) | `6542f5b089656b6d255465edd464d06c2a0b408f` | `feat/core-preview-alpine-amd64-qualification-20261016`, draft [PR #48](https://github.com/neo-capiro/capiro-backend/pull/48) | `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/preview-core@sha256:722a483259ebb5e9162b9294c26895bafa890fcfee45dc927ff1d2ec35fa071b`; scan COMPLETE, zero findings. |
| [`neo-capiro/meri-greenfield`](https://github.com/neo-capiro/meri-greenfield) | `38f52df94b1738649776792b2a28aac743801c19`, tree `7980fe7530d6623a2de9a788e150a377aca8201b` | `codex/meri-image-diagnostics-20261016`, draft [PR #101](https://github.com/neo-capiro/meri-greenfield/pull/101) | **Built and pushed; qualification HOLD after ECR_SCAN failure and 3 HIGH findings. No accepted digest.** Do not substitute an older successful project's image. |

Meri's selected stack is **PR89 -> 90 -> 91 -> 92 -> 93 -> 94 -> 97 -> 98 -> 101**. Full branches and 40-character heads are in the source/context index. Every selected recent head is an ancestor of the image code pin. PR96's isolated PG test was already ported byte-for-byte; do not apply it again. Older history is shallow, and absent side-branch content is not assumed equivalent. Recovered local-only NEOMART work is in this selected line; remote main is not the completed source.

Frontend's selected continuation is PR56 `3ef15d9a8ae6a27a9c2f39ccd923b5e2e07797cd` -> PR57 `d7b6d182356649214e956707e72672464320d699` -> PR59 `2a6b817fb27aa9524ab5036a5b8e1bf0955a26c8` -> PR60's qualified product pin above. PR59 includes the selected Meri frontend `51bde17a` merge parent and owns its locked-contract/type and saved-transcript test corrections. Preserve them in future refreshes. The earlier phone-parity PR43 is a distinct lineage; its old carousel was superseded, and mobile behavior must be judged against the final frontend handoff rather than blindly cherry-picked.

Core image stack is PR43 `13d12a7d7bdbe0be021cb218dd4cf7690cc4420b` -> PR45 `5baef67a0ce7d67ae96255022ec7c5beb5364f8a` -> PR48 `6542f5b089656b6d255465edd464d06c2a0b408f`. Later published guard/service source is `8ea7acc85793402984a59a308100d64b88b5876b` on `feat/core-preview-held-pr48-20261017`; receipt runner source is `a93a4a4040c780fb8751948273cc94c9a9086523` on `feat/core-preview-receipt-only-runner-20261017`. Those infrastructure/runner records do not change the qualified image digest. Do not restore obsolete PR43 images or reapply a whole migration tree.

The dated [open PR inventory](open-pr-inventory.json) is reference metadata, **not an integration allowlist**. Source and documentation heads are distinct; retain the exact product pins even when owner handoff documentation advances a branch.

## Historical W08 failure and corrected source

The earlier W08 image build was `meri-greenfield-qualification-build:8ac10ea2-a7c3-4420-bdb4-c39b359918d2`, source `3b75f33ab5a13264bdd6a52115f97d832773909b`, immutable source VersionId `dlRui9s0N4oEIKK5_DCANdyiJX0ZbVQH`. It ended FAILED/COMPLETED at **00:37:11 UTC** in `LINUX_TESTS`: **12/24 known cases observed, W08 failed, one unknown outcome, cleanup OK**. Its exact ECR tag was absent. The remote failing assertion and unknown import/file error were not captured; do not retrospectively claim a specific remote cause.

The source corrections through `38f52df` are concrete:

1. Fix the positive TLS fixture while preserving the production origin-equality guard and explicit denials.
2. Supply ten exact digest-verified read-only test fixtures; seven required B/R closure files were excluded by the unchanged `.dockerignore`. Preflight target presence and hashes inside the same sandbox before Node test selection.
3. Preserve all 24 B6/R6/W12 cases and deny unknown, skipped, duplicate, missing or truncated success evidence before registry authentication.
4. Give W08 a reserved failure-detail slot, [30 exact check IDs](W08-CHECK-MAP.md), fixed exception class/code, callback capture before production sanitization and independent annotations for both cleanup hooks. Retain those through reporter, strict producer/bootstrap decoders and one conditional encrypted failure artifact. Raw messages, stack, token and actual/expected values do not leave that channel.
5. Correct two expected nested `.token` properties. The old equality assertions compared a returned token string to the entire delivery envelope. A portable proof invoked the byte-identical real normalization function twice and demonstrated that mismatch, with expiry cap and claims preserved. That proves the visible source defect if reached; it does not identify the earlier remote assertion.

Final source checks: **Node 33/33**, **Python 14/14**, independent exact six-file review **ACCEPT**, clean Git tree and matching reviewed Git blobs. The [source review](w08-independent-source-review.json), [source qualification](w08-source-qualification.json), [event proof](w08-local-proof.json) and [normalization proof](w08-token-expectation-proof.json) are included without raw logs. The later current attempt reached ECR_SCAN after the required Linux gate; its distinct scan failures are recorded above.

The local ZIP is **138,070,049 bytes**, SHA-256 `64e499360f5df74d2544922890c1cc1fe787d651f8acb30bfb2860b076cc1e69`; manifest **3,781,316 bytes**, SHA-256 `d0c5cea1b61c2e4053db1fa64e73f010d237d9b1dbc38162a3cc87ae7ba93939`, **18,395 members**. These exact bytes were subsequently uploaded and consumed once: ZIP VersionId `ZoCyjIswQjO0iWjwM8Hm3E6uo6Fzrws1`, manifest VersionId `Jn0nOAeAbGkgnMMWGpERe5r7OLk15y8Q`, attempt `f238e6f45da84885bd2e3c0b6a0fa92f`. Earlier immutable source objects, build IDs and exact retained receipt versions are in the qualification checkpoint. The earlier W08 565-byte failure receipt and 22,793-byte operator receipt are verified encrypted private evidence; their references, not private logs or scan payloads, are in Git.

## Core checkpoint: do not undo the completed work

Core build `capiro-preview-first-chat-core-alpine-amd64-build:7d652626-deff-4f1d-b48f-96ecf04eddeb` succeeded at 00:14:56 UTC. Native gates passed 40/40 and 44/44, and the exact image's scan completed with zero findings. Its 42,487,422-byte ZIP SHA-256 is `f1a7b01085d0c0606abd49718d0fa5231c290d8f0be207debf6c933abc90d748`, source VersionId `4TS.qMOfnUS8HO9YGSSv_VtQRNuXUJns`.

The later approved retained-guard bundle completed:

- Independent stack `Capiro-Preview-First-Chat-Core-Guard`, with retained host-wide JSON 404 guard on `first-chat-preview.app-dev.capiro.ai`.
- Exactly receipt migration `20281016020000_clio_conversation_bootstrap_receipts/migration.sql`, LF SHA-256 `31a1dac55108a3f1300e4e6533e4f7f7be738438a89715179ee695f38928b211`; ledger advanced **646 to 647**, one finished row and no unfinished row. Twelve other pending migrations were not exposed. **Do not rerun this receipt migration.**
- App-role postcheck of TLS, `capiro`/`public`, receipt columns/constraints/indexes, tenant policy, immutable trigger and FORCE RLS. App SELECT/INSERT passed; mutation/ownership/bypass privileges remained denied as specified in the Core record.
- Private PR48 process startup became HEALTHY through loopback `/health:4000`, then the single task was intentionally stopped. This is not public target health or authenticated HTTP.

The Core standing service is `capiro-preview-first-chat-core` in cluster `capiro-dev`, task definition `capiro-preview-first-chat-core:1`, final desired/running/pending **0/0/0**, target group empty. All migration, reader and private startup tasks are stopped. Core's proposed desired-one action and **additional $1 cap are not approved**. Use the exact ARN, task and rollback details from the immutable Core handoff.

### Critical listener collision

The old Meri `CAPIRO-DEV-CHANGE-SET-20261016.md` proposes public priorities **3 and 4**. **Priority 3 is now occupied by Core's retained guard. Do not apply that proposal unchanged, overwrite the guard, or delete its independent stack.** Core priorities 1 and 2 route the narrow native POST contracts; priority 3 prevents misses from falling through to the production ALB's host-agnostic priority-10 `/api/*` rule.

Before any future listener change, inventory rules read-only, reconcile physical owners and reserve distinct unused Meri priorities in the reviewed change set. This query omits authentication configuration:

```sh
aws --profile default --region us-east-1 elbv2 describe-rules \
  --listener-arn arn:aws:elasticloadbalancing:us-east-1:967807252336:listener/app/capiro-prod-alb/7a4acb332b261724/e2d19b3dd47fc440 \
  --query 'Rules[].{priority:Priority,arn:RuleArn,hosts:Conditions[].HostHeaderConfig.Values,paths:Conditions[].PathPatternConfig.Values,methods:Conditions[].HttpRequestMethodConfig.Values,actions:Actions[].{type:Type,targetGroupArn:TargetGroupArn,fixedResponse:FixedResponseConfig}}'
```

## Contracts that must meet at one integration pin

**Current Core origin:** Meri `identity.origin` must be `https://first-chat-preview.app-dev.capiro.ai` with **no `/api`**. Frontend `CAPIRO_PREVIEW_FIRST_CHAT_API_BASE_URL` must be `https://first-chat-preview.app-dev.capiro.ai/api`. Old `https://app.capiro.ai` and old PR43 image references are historical proposals, not shipping inputs.

Core contracts use the original native Clerk standard-user bearer and `Cache-Control: no-store`:

- `POST /api/clio/conversations/bootstrap` accepts exactly `{schemaVersion:1,requestId:<canonical UUID stable for one New Chat intent>,clientId:<UUID>}`. It returns `{schemaVersion,requestId,conversationId,tenantId,actorId,clientId}`. Exact replay rechecks active ownership and client visibility. Core creates a conversation and receipt, not a Meri run.
- `POST /api/clio/application-authority/identity` accepts `{}`.
- `POST /api/clio/application-authority/context` accepts exactly `{identitySha256:<64 lowercase hex>,conversationId:<UUID>,clientId:<UUID>}`.
- `POST /api/clio/application-authority/membership` accepts `{}` and returns the current native membership/client roster receipt.

Meri trusts only the candidate conversation UUID from bootstrap and independently joins fresh identity/context to configured client and tenant/actor before immutable writer-fence-1 initial admission. The original native delegation must remain available through that check. Do not invent authority from browser receipt fields or use legacy non-idempotent conversation creation. Frontend persists one scoped retry-intent ID before its first POST and must reuse it through uncertain navigation/retry; preserve the corrected real retry behavior and exact raw identity assertions from PR60.

The Core guard deliberately denies CORS OPTIONS. Use the reviewed same-origin frontend/server gateway, not a direct cross-origin browser bearer call. Keep `CAPIRO_PREVIEW_READ_ONLY=true`; only the reviewed, enabled, empty-query bootstrap operation may pass the narrow write exception. `MERI_FIRST_CHAT_BOOTSTRAP_ENABLED`, the authorized selected client and exact fixed Core API target remain runtime bindings, not evidence that they are enabled. Follow the frontend handoff for exact flags and service revision. Other writes stay denied.

### Frontend integration gaps that must be reconciled

1. **Bootstrap source marker is exact.** The qualified frontend requires `CAPIRO_PREVIEW_FIRST_CHAT_BACKEND_SOURCE=c64f0005cf14d69683aabafa11def4964d766832`. It rejects the later PR43 head and PR48 image commit as that marker. Verify the served bootstrap contract's ancestry; either retain this reviewed contract-source marker after proving compatibility, or review a source change and qualify a new frontend image. Do not mechanically set this variable to `6542f5b0`.
2. **Selected-client reads have no qualified target yet.** The current Core host forwards only the named POST paths. Its guard returns 404 for frontend upstream GET `/api/me`, `/api/clients` and `/api/clients/<id>`. The separate `CAPIRO_PREVIEW_READ_API_BASE_URL` and `CAPIRO_PREVIEW_READ_BACKEND_SOURCE=111f269d749cae0249c2141779bd6d7deb93f45c` gate must reach a separately qualified authorized preview read target, or a narrow owner-reviewed Core listener/service extension that preserves the guard. Do not point the read gate at the current Core host and assume it works, or fall back to `os.capiro.ai`.
3. **Meri runtime and contract binding are held.** Frontend conversation routes require `MERI_CONVERSATION_WORKFLOW_ENABLED=true`, `CAPIRO_PREVIEW_MERI_CONVERSATION_ROUTES_ENABLED=true`, canonical `MERI_API_BASE_URL` equal to `CAPIRO_PREVIEW_MERI_RUNTIME_ORIGIN`, nonzero exact runtime source/image digest, and `CAPIRO_PREVIEW_MERI_CONTRACT_PACKAGE_VERSION=0.1.8`. The selected Meri source inventory records `packages/contracts/package.json` version `0.1.7`. The immutable frontend binding plan defines 0.1.8 as its consumer package, distinct from Meri's producer 0.1.7 manifest and private 0.1.8 protocol. Exact source/schema comparison found no wire mismatch; retain both facts and require actual image/mounted authenticated allocate-admit/recovery proof. Version equality alone does not require a package bump or rebuild.
4. **Live frontend configuration is not the checked-in proposal.** Owner readback found rollback baseline `Capiro-Portfolio-Preview-Service` UPDATE_COMPLETE, service/task `capiro-portfolio-preview:11` at 1/1, old image digest `sha256:93b27c3bf8e13bbb860113ada74a7524803a77e5cf1681d05aa1bfcdf98dc0ea`. Its current Core/Strategy/Workspace/Intelligence/existing-app URLs point at `os.capiro.ai`, with no new Meri opt-ins. The source service template lacks those opt-ins and does not accept that live parameter set. Prepare a reviewed complete template/parameter reconciliation; never preserve production-bound URLs through `UsePreviousValue` or blindly apply the proposal. Refresh this rollback readback before use.

## Ordered work by the current lane owners

1. **Reconcile custody and facts.** Codex/dot owns Meri qualification and shipping coordination; retain the immutable frontend/Core technical checkpoints and source-owner receipts. Fetch the immutable owner handoffs and exact code pins. Read the source/context index, selected plan, architecture decisions, current manifests and contracts. Preserve all existing checkouts and local evidence. Confirm the live AWS state and central budget, rather than replaying old intents or substituting main. Read the [setup snapshot](jump-box-setup-snapshot.json); a protected memory query was denied and no permission bypass was attempted.
2. **Codex/dot: finish Meri image qualification.** Follow [RESUME-QUALIFICATION.md](RESUME-QUALIFICATION.md). The previous allocation is consumed. Diagnose and independently review the exact scan-pending correction and base remediation before obtaining any further allocation; do not replay the consumed attempt. Seal exact final reviewed source, verify all members, upload two conditional versioned KMS/checksummed objects, independently review the exact buildspec/API request and persist the unique start intent. Require every Linux/source/image/runner/user/cleanup/scan gate. Retain a useful W08 diagnostic on failure. Fix source when needed, but obtain another allocation before another build.
3. **Codex/dot: freeze one combined integration plan.** Reuse the qualified frontend and Core immutable digests after fresh readback. Select the qualified Meri digest only after step 2. Bind source/image/configuration hashes together. Inspect shared ALB owners and reserve new Meri priorities while retaining the Core guard. Do not merge optional product lanes to make the initial chat work.
4. **Close the missing authorities and runtime bindings.** The [binding inventory](ACTIVATION-BINDINGS.md) is the exact source-backed checklist: Meri placement approval, private/public ingress, existing Aurora application schema and grants, Temporal server image/VPC/stores/schema/namespace/queue/JWKS/mTLS/token renewal, native Core target/delegation, private proxy image/TLS/peer/grant/provider and canonical budget owner, exact-version task material and signing custody, checkpoint object/KMS grants and original-run stop ownership. Most are unbound or disabled source. A successful Core API does not provide them automatically.
5. **Qualify data and stopped infrastructure before activation.** Meri journal 0017 has a committed isolated Windows PG16.15 **9/9** audit; Unix profile and target Aurora16.11 apply/grants are not proved by it. Preserve ordered migrations `0001–0011,0013,0015,0016,0017`, held gaps 0012/0014 and central ownership. Review an exact target manifest, backup/restore and narrow runtime lock privileges before live SQL. The SQL grants no role itself. Product/Temporal templates use zero counts; the proxy template is false-conditioned. Applying even stopped templates can create resources or change Aurora SG ingress, so inspect exact change sets and approvals. Do not flip a generic flag to invent a complete proxy/issuer deployment.
6. **Activate under the reviewed action approvals.** First qualify private network, exact material ownership, Temporal authentication/replay/failover, model proxy native handlers and Bedrock path, owner-budget capture, control's private listener before public, and one task/original with physical-stop custody. Preserve nonroot/readonly/capability/network and per-conversation isolation. Start Core's standing service only under its separately approved desired-one plan; pass target health and authenticated narrow native contracts. Then mount the reviewed Meri composition and frontend gateway/server configuration. Liveness alone is insufficient; missing model-grant owners keep product readiness held.
7. **Return the qualified lane receipts for dot's step 3.** Publish the source/image/config/release receipts and exact preview entry point without credentials. Dot must perform the real authenticated prompt, streamed answer, saved conversation and reload acceptance below. Do not announce shipping acceptance before that result.

Ordinary first chat is independent of unmounted Objective generation. Keep Objective request-bound RS256 workload evidence, result transport and Planner continuation disabled unless separately allocated and qualified; do not replace ordinary native chat authentication with a generic OIDC token or caller-added authority claims.

## Approval and budget boundaries

| Already granted or completed | Still required or unproved |
| --- | --- |
| Neo's 01:34:09 UTC Meri resumption: Codex/dot retains Meri; frontend/Core handoffs remain technical checkpoints and the Fable assignment is historical; dot retains step 3. Reviewed source publication for the selected stacks. | Each lane owner must reconcile its current state, exact authority and ledger before external actions. |
| One consumed Meri $4 qualification allocation, rebound to `38f52df`; one 30/5-minute attempt, automatic retry zero. Its exact immutable identity and terminal failure are recorded above. | A further build needs a new allocation after the exact corrective delta is accepted. Current corrected Meri source has no accepted Linux image. |
| Qualified frontend/Core image builds and scans. Core's exact retained-guard/receipt-only/private-startup bundle completed. | Core desired-one proposal and its additional $1 cap are **not approved**. Meri live SQL, IAM/network/resource, service/material/issuer/proxy activation require the specific missing approvals recorded in their plans; a build reservation does not grant them. |
| Central reservations **$335/$400**, including the consumed Meri $4, Core's included $5 bundle and the frontend continuation. | Actual billed spend is unknown. Planning headroom is $65 against reservations, not proof of available billed spend. Do not reserve included amounts twice or exceed the ceiling. |

The historical 01:19:23 UTC stop withdrew execution at that time. Neo reversed only the Meri stop at 01:34:09 UTC, so Codex/dot continues Meri under the allocated action boundaries. The immutable frontend/Core handoffs remain technical checkpoints; the Fable assignment is historical. The $335/$400 reservation includes the now-consumed $4; no next Meri allocation is included. Reconcile the root ledger before further paid action. No secret transfer, credential creation, permission bypass or broadened architecture is authorized by these notes. User instructions override stale documents; departures from the approved deployment plan still require the human's explicit decision.

## Rollback and old-pin custody

Before changing service counts, DNS/rules, material versions or SQL, record the old task definitions, image digests, configuration hashes, secret **reference/version IDs only**, deployment/change-set identifiers, snapshots and rollback owner.

On a failed integration smoke, fence new admissions/kickoffs, settle in-flight requests and revert the frontend narrow-write/routing revision. Return new service counts to the reviewed stopped state and stop/reconcile all original **and successor** runs using journal, runs, allocations, issuance, Temporal and ECS tags. Require physical-stop proof and zero UNKNOWN custody before disposing old access. Keep Core's independent retained host guard; do not let preview misses reach production `/api/*`. Do not rerun the already completed Core receipt migration or drop/reset unrelated `capiro` data.

The initial journal identifies only writer-fence-1. It is not an inventory of every successor task. Changing Meri configuration also changes the immutable configuration join: even after old tasks drain, old saved conversations may reject config B. Retain pin-routing/controller/config A for continued chat, or explicitly close those conversations read-only before decommission. A stop-only capsule alone would not solve conversation continuity. No live old-task inventory or cross-config continuation pass is claimed by this handoff.

## Separate ongoing lanes: do not silently include

- Meri read stack **PR99/103/104/105/106/107** is separate. PR107 exact `526b6be7c906c15298f13430fe5dd5a9db458e03`, tree `fe07e12c2539b39604317c7f48b670e8e5818849`, base PR106 `382f45ae695e271bf7433343d31486ac0d57184a`. [Immutable checkpoint](https://github.com/neo-capiro/meri-greenfield/blob/526b6be7c906c15298f13430fe5dd5a9db458e03/docs/coordination/reports/CODEX-READ-RESOLUTION-IMPLEMENTED-20261017.md): independent ACCEPT_SOURCE, 1108/1108 source checks, 56 complete / 10 partial / 16 absent, 58 SDK operations across 35 families, 41 constructors, **live 0**. A later funding adapter/DTO is separately ongoing and SDK-held pending Core; it is not an activation prerequisite here.
- Task updates: Meri PR100 `78fbd3ae813fcf3fe286969e76102353c3a2eed2` -> PR102 `cc43d0004be59f315658207405ff1aea126adad5`, frontend PR61 `bd9e0d03c54ef4fbb57010c3b97cfb3d77bdf2b9`. Source reviewed, unactivated, outside these shipping pins.
- Planner: backend PR49 -> PR50, latest captured PR50 `5591eac08428635bf911a0aa32acea859e2a5d95` on `feat/objective-planner-runtime-composition-20261016`, separately ongoing. The earlier parent-reported `a2b35fb64548caa5f96f25c97bda6d2f5055be93` is historical. Objective retained-result PR42 and Meri PR95 remain separate from ordinary first-chat activation.
- Backend cleanup/report lanes PR46/47 and later `chore/backend-report-amendment-content-20261017` commit `4ff3a3366633cb9473e31d43cab88e5a7461fb7c` are separate. The complete dated inventory is metadata only. Deliberate integration changes the candidate and requires review/requalification; do not overwrite other owners' work.

## Required step-3 return package for dot

Codex/dot should assemble the frontend/Core technical checkpoints, current source-owner receipts and Meri receipts in one immutable release note with:

1. Full source commits/branches/PR bases for all three repos; image repositories/digests, source object versions/checksums, build IDs, complete scan status/counts and accepted qualification receipts. Distinguish product source from documentation-only heads.
2. Exact deployed task definitions, service counts, configuration digests, change sets, listener rule ownership/priorities, target health and preview URL. List material/issuer/database/namespace/proxy/provider reference IDs and versions without values, plus the original-run stop and rollback owner.
3. Verified current Core bootstrap/identity/context/membership contracts; frontend same-origin native Clerk gateway and scoped retry identity; Meri journal and currentness mount; real model/provider path, streaming and durable event/history composition. Include private readiness/negative receipts and applied migration hashes.
4. All paid operations terminal or explicitly handed over with an accountable active owner; actual usage if known, reservation reconciliation, remaining ceiling and no automatic retries.
5. A private validation entry point for dot, an authorized selected client, expected admission behavior, and a clean run/cost boundary. Do not send passwords, session cookies, bearer tokens, keys, connection URLs with credentials or raw private scan logs in Git/chat.

Dot's acceptance must use a **real authenticated session and real provider response**: select the current client, invoke one New Chat intent with stable replay identity, submit the agreed prompt, observe streamed answer completion, save the conversation under the correct scope, navigate away and reload it, and verify the same prompt/answer/history from durable server state. Capture conversation/run/attempt and current identity/custody joins in approved private evidence, along with source/image/configuration hashes and costs. Check uncertain-submit/retry does not create duplicate work and cancellation/terminal paths leave no orphan original or successor task. A synthetic answer, a browser fixture, private process liveness or a successful image build is not this acceptance. Dot reports ACCEPT or the exact remaining gate after those steps.

## Private evidence and continuity limits

The nonsecret object/build/image identities and source proof are in Git. Raw AWS responses, scan pages, task logs, test captures and private runtime records remain in the approved local/S3 evidence locations referenced by the owner handoffs and qualification checkpoint. Access them through an already authorized environment; request an approved evidence transfer if those paths are unavailable. Never transfer a credentials directory or weaken denied access to obtain them.

The outgoing Meri packet is `C:\Users\Administrator\Documents\Codex\2026-10-16\task\meri-image-w08-qualification-20261017`; the primary handoff assembly packet is `...\task\fable-shipping-handoff-20261017`. At the historical safe-stop cut the prepared operational helpers had not run end to end. After resumption, the exact reviewed upload/start/monitor/readback helpers ran once and retained the terminal failure described above. They are evidence and examples, not an instruction to replay consumed intents. Source/context pointers and unknowns are fully indexed in the companion documents so the current lane owners can resume without depending on this chat's memory.

Fresh listener inventory at 01:43:59 UTC confirmed Core priorities 1/2/3 intact; occupied numeric priorities were 1,2,3,5,6,7,8,9,10,11,12,13,14,15,20,50. Priority 4 was free at that instant, not reserved. No rule changed. Re-read and centrally reserve suitable priorities before any reviewed action; a free number alone is not a routing plan.
