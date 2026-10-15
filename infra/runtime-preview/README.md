# Isolated Meri preview source

Pure CloudFormation builders and offline review-packet validation. P0 approves only the disclosed24h Single-AZ database/one-Temporal topology and25USD AWS allocation. Every P1-P8 action remains separately gated. This directory has no deployment executor, custom resource, SQL initializer, image builder or credential lookup.

Run from repository root:

```powershell
node --test infra/runtime-preview/security.test.mjs
node infra/runtime-preview/app.mjs --help
node infra/runtime-preview/app.mjs --output C:/absolute/existing-parent/new-exclusive-directory
```

Synthesis emits three compact template files and a SHA256 manifest into a new directory. It refuses existing output and retains any partial output. `buildActionBundle` is a library producing a review packet, never an authorization or command. Keep resolved parameter sets, existing policy baselines/proposals, account identifiers and credential references outside Git. Public output must redact them.

The [implementation review](../../docs/deployment/runtime-preview-20261015/IMPLEMENTATION-REVIEW.md) explains the cross-stack action coupling, fresh pricing, image/bootstrap/volume/issuer/Temporal/TLS dependencies and stop/retention gates. Zero desired tasks do not prevent charges for ALB/endpoints/RDS if someone later deploys these templates. They are not ready for cloud execution.
