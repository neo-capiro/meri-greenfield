# Fable session status — 17 October 2026

Status record of the first Fable session after the portable handoff (`72fe5aec`). It covers what was done, what was verified, what changed in AWS and GitHub, and what still waits on a decision. Nothing here grants activation authority. Neo's rule for live changes is unchanged: **one concrete change set with costs and rollback, approved before any AWS or database write**. Image builds are the exception.

## Neo's decisions recorded this session

1. **Placement:** separate Meri services in the existing `capiro-dev` VPC. Reuse the existing Aurora cluster where compatible, with Meri-owned schemas and roles. No new VPC for the first preview. Temporal persistence compatibility must be verified.
2. **Clerk:** align frontend, Core and Meri to one *verified* Clerk application. Check the actual issuer, key pairing and session claims rather than trusting labels.
3. **Live changes:** present one change set with costs and rollback for approval. Preserve Core's guard and routes (listener priorities 1–3).
4. **Coordination with dot:** GitHub PR comments, each naming the exact commit, files or resources, the proposed change and the required response. Core activation stays coordinated with dot.

## Image remediation: done

| Item | Value |
|---|---|
| Source | `f005f77316bb8735e60f16c3ac99a5c8e3d71a34` on `fable/meri-runtime-retained-packages-20261017`, draft PR #114 |
| Build | `meri-greenfield-qualification-build:d67fec63-5238-49b7-b95c-e96021bef3c9`, **SUCCEEDED**, one start, retry 0 |
| Input objects | ZIP sha256 `b8db9a28137a817f6bcc4373d612dde8bc3dfa414ce9858fc7e152bc14addfb7`, VersionId `Oh_tRCG.VnamSEO.ylvOoP.KbA2kM2b4`; manifest sha256 `d43dd1d167ff7a9a3dbe5e4ca267311d29dd791f930282b09c7c7949c636d437` |
| Image | `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:6a03d5367c22a95db1fbc95a08b2bb1237164bfdf3b6f215f076a38833fffb8d`, tag `product-f005f773…-10b6877b4e3bf053a2bf1a7e92636cf6` |
| Gates | Wolfi base `cgr.dev/chainguard/wolfi-base@sha256:030e45cb…`, glibc 2.44, Node v24.21.0, installed package set `bb951812…`, SWC GNU and Temporal 1.24.0 native loaded, runner `b7c29dcb…`, user 1000:1000, B6/R6/W12 24/24 |
| ECR scan | COMPLETE, **zero findings** at every severity (the failed 38f image had HIGH 3 / MEDIUM 9 / LOW 3) |
| Receipt | `results/product-image/f005…/10b6877b…/product-image-receipt.json`, VersionId `F2eLdV8pN.rg44VeD.Sx_OHNwmjTyyZb`, SSE-KMS `1cca74fc-d9ae-43a6-8bfd-b93107e90042` |

Two source fixes on top of candidate `31edd91`:

- **`9217319`:** the upstream Wolfi `APKINDEX.tar.gz` rotated at 02:25 UTC (now 10,635,594 bytes, sha256 `2a28dd6d…`), so the pinned fetch would refuse. `runtime-packages.mjs fetch --from DIR` stages the retained snapshot (`infra/product-preview/runtime-packages/x86_64`) through the unchanged size, sha256 and cleanup path, with no network. apk still authenticates the signed index.
- **`f005f77`:** current AWS CLI v2 writes `aws: [ERROR]: An error occurred (ScanNotFoundException) …`, and the PR101 matcher rejected that prefix. Build `63c305c4` (source `9217319`) failed at ECR_SCAN for this reason only, 0.7 s after a successful push. Its digest `sha256:f00872df…6f15` later scanned zero findings but has no success receipt, so it is **not selected**.

Paid operations: two CodeBuild starts (`63c305c4` FAILED, `d67fec63` SUCCEEDED). Both are terminal, and no build is active. [`scripts/qualify-start.sh`](scripts/qualify-start.sh) is the exact upload → request → verify → recipe → single-start sequence used, and is reusable for the next sealed commit.

## Verified findings (read-only)

**Clerk: one application.**

| Check | Result |
|---|---|
| References | Frontend PR64 `service.yml` uses `/capiro/dev/clerk/publishable-key-rAfesC` and `/capiro/dev/clerk/secret-key-FT67tM`. Core task definition `capiro-preview-first-chat-core:1` uses the same secret ARN and `CLERK_JWT_ISSUER=https://clerk.app.capiro.ai` |
| Publishable key | `pk_live`, Frontend API `clerk.app.capiro.ai` |
| Issuer and signing key | OpenID issuer `https://clerk.app.capiro.ai`; JWKS kid `ins_3CPnW3zHGlQuLXj2bJpDpmo9fVB` (RS256) |
| Secret-key pairing | Clerk Backend API `/v1/jwks` returns the same kid. The secret was read in-process only and never printed |
| Test Clerk | No `/capiro/preview/clerk/*` secrets exist in the account |
| Still unproven | Session-token claims (`sid`, `sub`, `exp`, active organization), `capiro-internal` membership and a non-archived configured client. These need a real sign-in (dot's step 3) |

**Temporal on existing Aurora 16.11: source-compatible.** Temporal 1.32.1 uses the `postgres12` plugin with schema primary 1.19 and visibility 1.14. The visibility schema runs `CREATE EXTENSION btree_gin`, which Aurora PostgreSQL 16 supports and which is trusted, so the database owner can create it. A live apply will confirm it. `temporal-binding.mjs` still refuses the `capiro-dev` VPC for Temporal and needs a source change for decision 1.

**Listener (about 03:20 UTC):**
- Priorities 1–3 belong to Core on `first-chat-preview.app-dev.capiro.ai`.
- **4 is the only free priority below the host-agnostic `/api/*` forward at 10.**
- Occupied: 5–15, 20, 50 and the default rule.
- A Meri same-host deny placed after 10 would let Meri-host `/api/*` misses reach production Core. The plan is therefore one host-only rule at 4, with the path allowlist enforced by `apps/runtime/control-route-boundary.mjs`: the public listener returns 404 for everything except `/api/conversations*` and `/api/action-followthrough/session`.

**Core:** service `capiro-preview-first-chat-core` is 0/0/0 on task definition `:1`, and its target group is empty.

## Frontend change

`capiro-frontend` draft PR #70 (`31a140cd`, stacked on #67 `77d3fdd`) adds the archived-client guard requested in `PR64-NATIVE-SESSION-COORDINATION-20261017.md`. `MeriConversationHost` stops for `status === "archived"` (Core's exact rule) before any Core bootstrap or Meri session dispatch. web vitest 200 files / 2767 tests pass; tsc and eslint are clean.

## Requests open with dot

- capiro-frontend #64: Clerk evidence. Asks dot to lift the issuer and pairing hold for `/capiro/dev/clerk/*`, drop Test Clerk from the plan, and include #67 and #70 in the next frontend image.
- capiro-backend #48: asks dot to reserve listener priority 4 for one host-only Meri rule, and to own Core's desired-one activation window alongside the Meri smoke.

## Remaining runtime work and the open decision

A read-only source survey found that control, routes, the Temporal worker, runner launch and poststart, material delivery and migrations exist as code. **Nothing can return a model answer yet**:

- **Model proxy process:** `resolve_bearer_sha256` and `resolve_session` are missing, as are the `__main__` entrypoint and a Dockerfile. `service_entrypoint.py` returns the disabled proxy.
- **:8444 budget-owner service:** not implemented. It needs two mutually authenticated mTLS channels, owner-initiated capture and its own certificate issuer (`OWNER-BRIDGE-HTTPS-CONTRACT.md`).
- **Request envelope:** `apps/proxy/qualification/runtime/bedrock_body.py:30-37` caps a call at **8,192 input / 256 output tokens with no thinking**. The Claude Agent SDK's own prompt exceeds that, so real chat would be refused.
- **Temporal:** five roles with mTLS plus a JWT issuer. The issuer and token writer are unmounted contracts.
- **Smaller gaps:** a first-chat readiness profile, the real grants SQL (the current file is all comments), a budget seed row (`budget` id 1), a migration-apply job and proxy CA trust in the runner.

The design-faithful build is several days plus several paid qualification rounds. A narrower preview path is a proposed architecture departure that needs Neo's decision. It would:

- keep the bearer, ECS/ENI peer, canonical budget and Core-currentness checks;
- merge proxy and owner into one service that calls Bedrock directly;
- widen the envelope under per-run and per-day caps;
- run Temporal as one mTLS server task on Aurora without a JWT issuer.

**Undecided:** design versus simplified versus hybrid, and the per-call and per-day model caps. After that decision, the next deliverable is the code plus the single change set with costs and rollback.
