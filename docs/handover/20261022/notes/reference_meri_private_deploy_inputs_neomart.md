---
name: meri-private-deploy-inputs-neomart
description: Where Meri's private deployment inputs live on neomart (paths only), what is public vs private, and the Stage 3 hold/prep state as of 2026-10-19
metadata:
  type: reference
---

Private Meri deployment inputs exist ONLY on machine **neomart** (Windows, user neoma), outside every Git repo; never copy, print or commit contents:
- render working dir (historical): `C:\dev\fable\meri-stage3-20261017T182918Z` (core.json, stage3.json, attempt1..17, core-column-overrides.json)
- PKI: `C:\dev\fable\meri-preview-private-pki` (incl. `db-logins.json`, `db-logins-structured.json`, pins.json); written 2026-10-17 10:23
- historical core.json is NOT proof of current membership/credential; Neo personally does credential-bearing steps (bearer, membership POST, PKI/DB-login checks, render, upload). Fable must not mint/store credentials.
- Fable's prep (no secrets): `C:\dev\fable\meri-stage3-prep-20261018` (NEO-LOCAL-STEPS.md + cert-expiry/bearer-exp/membership-summary/verify-rendered helpers); verified checkouts `C:\dev\fable\wt-meri-34851020` (source) and `C:\dev\fable\wt-meri-1666b46b` (public render inputs).

**Why:** dot works from the cloud and sees only GitHub; Neo asked where the private inputs are kept.
**How to apply:** answer with paths only. As of 2026-10-19 the render/deploy is on HOLD until dot delivers the replacement scan-evidence file; never use the checkout's historical `image-scans.json`. See [[meri-greenfield-fable-shipping]].

**Render prerequisites learned 2026-10-19:** root `npm ci` alone cannot run `render-material.mjs` (missing `@aws-sdk/client-ecs`, `@capiro/meri-contracts`); use the Dockerfile layout via `C:\dev\fable\meri-stage3-prep-20261018\install-render-deps.sh <checkout>` (tested). Latest verified public packet checkout: `C:\dev\fable\wt-meri-60754f81` (branch handoff/source348-public-render-inputs-20261019). A throwaway-input dry run of the render passed. PR #121 watcher = scratchpad `pr121-watch.mjs` (60 s).
