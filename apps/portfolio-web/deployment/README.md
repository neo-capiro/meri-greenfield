# Portfolio preview AWS CLI deployment

This directory owns only the isolated Portfolio frontend preview. Its templates
do not modify the existing `capiro-dev` cluster, Capiro ALB/listener, or
`os.capiro.ai` record. `ecr.yml` and `certificate.yml` were deployed through
CloudFormation on 11 October 2026. `service.yml` is validated but **not deployed**.
`build.yml` defines an isolated CodeBuild project with permissions limited to
reading a versioned private source ZIP, logs and pushing this preview repository;
it cannot change ECS, DNS or Capiro services. Its `buildspec.yml` checks the
archive's exact source SHA and S3 version, runs the full checks, and pushes an
immutable image only after every check succeeds. The first GitHub-source attempt
failed in `DOWNLOAD_SOURCE` because the account's CodeBuild credential lacked
authorization for this private repository; it ran no source command or test.
The S3-source run on `dacd184` completed 728 unit, 459 browser, Next production
and Linux image build/push commands, then its final ECR read-back failed because
the build role lacked `ecr:DescribeImages`. The digest was independently read
back by the owner. The image scan reported one HIGH zlib finding, so the image
is not admitted for ECS. The permission is corrected in `build.yml`. A rerun
on `4f2a082` passed the full tests and image build, then failed a smoke check
that called `/api/core/clients` instead of the actual proxy route
`/api/backend/core/clients`; that run did not push an image. Separate diagnostic
jobs confirmed the image starts as UID 1000, `/healthz` returns 200, and the
setup/sign-in pages render. Source `8a41286` corrected the smoke URL. Its full
CodeBuild job `322ee417-3874-4c38-85a6-948f2c90ff45` SUCCEEDED: 728 unit,
459 browser, production and Linux builds, container smoke and ECR read-back.
The immutable digest is
`sha256:9d9dfee999cb8586cf8e5cc0b74875f1152cfd2f390256b1cb4baab55a4970c3`.
The completed scan again reports one HIGH `CVE-2026-85091` zlib finding.
That Debian image remains ineligible for ECS. Runtime source
`a1a1c09016f4c778b2c39dc4b0cfbb3f139a465d` instead pins the
Node 24.21.0 Alpine 3.23 image and upgrades zlib to vendor-fixed `1.3.2-r1`.
Its exact-source CodeBuild job
`capiro-portfolio-preview-build:288c6d1d-30d3-4ff7-8378-7d76c1117b91`
SUCCEEDED with 728 unit and 459 browser tests, production and Linux image
builds, non-root container smoke, push and digest read-back. ECR digest
`sha256:7c1b10100a566fb6ce179ec480ea73e833e2c71c8af64db11439b3099f55e4aa`
has scan status COMPLETE and zero findings. The merged-source release and
reviewed service-change gates remain before ECS.

## Existing foundation

- `Capiro-Portfolio-Preview-Registry`: immutable, scan-on-push ECR repository
  `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview`.
- `Capiro-Portfolio-Preview-Certificate`: UPDATE_COMPLETE; ISSUED ACM
  certificate `arn:aws:acm:us-east-1:967807252336:certificate/edcc6113-12f5-4154-bfdf-64c7da1037cd`
  covers `portfolio-preview.app.capiro.ai`, with DNS validation SUCCESS. It
  replaced the unused first certificate for `portfolio-preview.capiro.ai`.
  Clerk's production primary domain is `app.capiro.ai`, with allowed subdomains
  enabled. No service A/AAAA alias exists.

## Gate before `service.yml`

1. Record clean exact source SHA and run the full current-head unit, browser,
   type, lint, format, architecture and Next production-build gates. The
   bounded CodeBuild project can run these independently of the local Cleanup
   resource reservation. Review the visual output. Build the Linux image from
   `apps/portfolio-web` on that SHA; run `/healthz`, setup/auth and anonymous
   proxy checks in the container.
2. Push the image to this repository by a source SHA tag. Read back its ECR
   `sha256:` image digest and scan findings. Deploy by digest, never by tag.
3. Confirm the designated production Clerk publishable/secret key references
   match each other and backend issuer/JWT trust. Pass their Secrets Manager ARNs
   and protecting KMS key ARN as parameters; never put values in the template,
   command line, image or Git. The owner selected the Intelligence service for
   Bill Tracker on 11 October 2026. Pass `TrackerBackend=intelligence` explicitly
   when creating the service change set; the template has no backend default.
   Read-only metadata shows the existing `web-vnext` and core API reference a
   matching `live` pair under one KMS key; preview-origin and signed-in behavior
   still require actual validation.
4. Confirm the owner's browser IPv4 `/32` for `AllowedIngressCidr`. The preview
   ALB accepts HTTPS only from that address. Tasks accept port 5188 only from
   the preview ALB and send HTTPS requests to Clerk, ECR, logs and existing
   backend APIs. Review the exact CloudFormation change set and cost before
   execution.
5. Deploy `service.yml` as `Capiro-Portfolio-Preview-Service` with
   `CAPABILITY_IAM` and the recorded parameter values. Wait for stack complete,
   ECS steady state and a healthy `/healthz` target. Inspect task logs without
   printing credentials or customer data.
6. Add `portfolio-preview.app.capiro.ai` to the production Clerk instance's
   allowed subdomains after the production auth access change is reviewed. The
   domain input accepts this exact hostname. Do not add a paid Clerk satellite
   domain. Then add a Route 53 A alias for this hostname to the healthy preview
   ALB only. Read back DNS and HTTPS before bounded signed-in testing.

Rollback starts by removing the preview A alias, then scaling/deleting only the
preview service stack after recording its exact resource IDs. Preserve
diagnostic logs and image digest. Keep the ECR/certificate foundations if another
reviewed preview attempt is planned; otherwise remove only their named stacks.
