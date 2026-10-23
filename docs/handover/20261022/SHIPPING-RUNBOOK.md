# Meri, Core and frontend preview shipping

Root Codex on **EC2AMAZ-M7CDRPT** owns qualification, integration, AWS operations
and live acceptance. Implementation and independent review use Astra 6 Ultra.
Apply [standing requirements](STANDING-REQUIREMENTS.md), the
[Wave 2 handover](WAVE-2-HANDOVER.md) and
[current validation workflow](CODEX-VALIDATION-AND-SHIPPING.md).

## Environment and release prerequisites

- AWS profile `default`, account `967807252336`, region `us-east-1`. Verify the
  caller before shipping; an explicit old `--profile capiro-dev` overrides an
  environment setting and must be corrected in a regenerated recipe.
- Local gates use WSL `Codex-Gates`, Ubuntu 24.04 and native Docker. Meri uses
  Node 24; Core and frontend use their own current locked image recipes.
- Every candidate needs independent exact-head review, required passing gates,
  an ARM64 image bound to its source, and exact-digest security scans with
  zero HIGH/CRITICAL findings. Record decisions for other findings.
- Current source, tests or a built image are not a shipping approval. Verify
  the final candidate after integration, then acquire the preview deploy lock
  on issue202. Never deploy during live acceptance.

## Meri runtime

The canonical image entrypoints are
[`image-buildspec.yml`](../../../infra/product-preview/image-buildspec.yml),
[`image-build.sh`](../../../infra/product-preview/image-build.sh) and the offline
source verifier. Follow the exact source, S3 version, CodeBuild and scan commands
in [`image-buildspec-design.md`](../../../infra/product-preview/image-buildspec-design.md).
Image checks run the real non-root/read-only runtime, native dependencies and
artifact generators. Database gates use disposable local PostgreSQL16; model
and service acceptance are separate gates.

After qualification, use the current modules under
[`infra/product-preview/first-chat/`](../../../infra/product-preview/first-chat/):
`render-material.mjs`, `stage3-deploy.mjs`, `stage3-bindings.mjs` and
`ship-packet.mjs`. Read their current CLI/contracts and fresh live outputs before
constructing a release. Source and exact image digest bind the rendered tasks;
the removed launch-measurement producer, model owner/proxy and five-role kit
steps are not dependencies of the direct SDK release.

Keep the runtime image source and operator source distinct. Assemble runtime
values from a clean checkout at the qualified image commit; the renderer reads
the runner blob at that commit. Run `ship-packet.mjs` from a separate clean,
reviewed operator checkout: the packet records its commit/tree alongside the
unchanged image source, image digest and raw input hashes. A packet-only change
does not rebuild or relabel the runtime image.

The ordinary packet permits only image changes. Its first native SDK transition
requires exactly the 21 retired model/owner/proxy paths listed in
`ship-packet.mjs` to disappear and the canonical
`foundation.RunnerTaskRoleArn` to be added; every retained non-image value must
match. The six owner/proxy discovery, log and security-group outputs stay equal
in this first cut. Other drift needs a separate reviewed change, never editing
previous inputs to make them look current.

The original per-release05 input archive was not handed over. If it cannot be
recovered, freeze a reviewed **reconstructed previous state**, explicitly labeled
as such with live template/task-definition/secret-version metadata, historical
source, evidence hashes and field lineage in private release scratch. Do not
claim it is the original archive or substitute the older repository example.
The packet hashes the supplied previous file; that hash binds bytes, not their
historical authenticity. Root verifies the reconstruction before using it.

Before the first native render, apply a reviewed **additive** foundation change
from the fresh live template: canonical runner task IAM/Bedrock permissions,
control PassRole and runner egress. Retain old model resources unchanged while
they are still referenced, check actual SG rules before adopting them, and take
fresh outputs including `RunnerTaskRoleArn`. Do not apply the full current
foundation deletion set while the old model stack still runs.

Temporal is qualified and updated separately from the issuer/app deploy order.
Use its current source-based binding and qualified ARM digest, preserve the
selected issuer CA and current TLS/JWKS controls, and review actual live service
counts. Its raw stopped `DesiredCount: 0` template is not a ready live update.
After these prerequisites, use `stage3-input`, runtime-value assembly, render,
upload-plan and the packet; after upload regenerate bindings and the packet,
then review and execute issuer followed immediately by app. Verify outputs and
have root open Meri for live acceptance before retiring superseded resources.

The current material renderer retains control, worker and issuer bundles and
four task families while the separate Temporal-auth replacement is unfinished.
Use its generated deploy order and verify deployed outputs against the rendered
task definitions. Retaining this interim issuer is not completion of item0's
Temporal-auth or full cleanup requirements. Retire superseded live resources
only after the reviewed replacement passes its required preview acceptance.

Private inputs are fetched only when required by a current rendered role. The
existing `shipping/ship-kit/tools/fetch-private-pki.sh` requires explicit
`AWS_PROFILE=default` and `AWS_REGION=us-east-1`; inspect it before execution.
Fetch into owner-only scratch, with tracing disabled, set `MERI_PKI_DIR` to its
output and `MERI_PREP_DIR` to this checkout's `shipping/stage3-prep` when that
helper is actually used. Never print PKI, bearer or rendered bundle contents.
Runners receive neither Core's service secret nor database credentials. Remove
and verify removal of owned PKI/render scratch on success, failure and timeout.

Prepare rollback from the last accepted source/image/configuration inputs and
fresh live state. Do not assume a historical task revision remains registered:
CloudFormation may deregister it. Verify rollback targets remain on the one
preview clone and preserve live ALB rules.
For the first native transition, old05 images depend on the old model topology
and cannot be used with the native renderer. Retain the reviewed previous
configuration, compatible historical renderer and model resources until
acceptance; any rollback needs its own reviewed topology, migration
compatibility, fresh revisions and material. After those resources retire,
use only a separately proven native-compatible forward recovery.

## Core and frontend

Core integrates into `backend-import`; frontend integrates into `main`.
Regenerate release inputs from the exact reviewed head. The dated folders under
`shipping/core-kit/`, `shipping/ship-fe-kit/` and `shipping/neomart-kits/` provide
historical references, not authority to reuse old images, profiles, database
targets or rollback revisions.

Core requires its current production closure, native ARM image/import probes,
source gates and isolated PostgreSQL/migration rehearsals. Manifest, lockfile or
schema changes require the corresponding closure regeneration in source. Ship
paired API/frontend changes together when either side depends on the new shape.
Frontend additionally needs affected browser/accessibility and production-build
checks before its exact image and preview service update.

## Database, deployment and acceptance

Keep **one** persistent `capiro-newstack-preview-clone`. Never delete or re-clone
it and never migrate the shared live database. Before every forward migration,
take and verify a snapshot, inspect the clone's ledger and exact applied hashes,
and rehearse the intended chain in an isolated database. Applied SQL is immutable
history. Table drops retain their specific standing-requirement approval.

Prepare explicit source-bound preview changes and rollback, inspect their diff,
then deploy under the lock. Preserve live ALB rules; preview rules are host-scoped
and precede their catch-all. Read back task/image/config identity, stable services
and health. Run authenticated T3-T6, H1/H2 and the affected Core data/permission,
conversation, streaming and UI acceptance at the deployed pins. Report actual
results and unresolved cases; health alone is not chat acceptance.

Publish only scrubbed counts and booleans, never customer-linked identifiers.
Release the deploy lock after verification and owned resource cleanup. Use the
[handoff template](CODEX-HANDOFF-TEMPLATE.md) for exact evidence and remaining work.

## Historical evidence

The old active Meri kit generator, execution helper, pair repair, measurement
helper and P2 image verifier/launcher were deleted with their replaced pipeline.
Git history, dated `neomart-kits/` copies and phase validation reports preserve
their original receipts. Other proxy-specific historical harness scripts remain
subject to the separate proxy deletion audit. Do not use those scripts to
qualify the native SDK architecture or reinterpret old passes as current gates.
