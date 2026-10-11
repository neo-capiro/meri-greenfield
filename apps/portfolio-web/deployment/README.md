# Portfolio preview AWS CLI deployment

This directory owns only the isolated Portfolio frontend preview. Its templates
do not modify the existing `capiro-dev` cluster, Capiro ALB/listener, or
`os.capiro.ai` record. `ecr.yml` and `certificate.yml` were deployed through
CloudFormation on 11 October 2026. `service.yml` is validated but **not deployed**.
`build.yml` defines an isolated CodeBuild project with permissions limited to
logs and pushing this preview repository; it cannot change ECS, DNS or Capiro
services. Its `buildspec.yml` requires an exact source SHA, runs the full checks,
and pushes an immutable image only after every check succeeds.

## Existing foundation

- `Capiro-Portfolio-Preview-Registry`: immutable, scan-on-push ECR repository
  `967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview`.
- `Capiro-Portfolio-Preview-Certificate`: ISSUED ACM certificate
  `arn:aws:acm:us-east-1:967807252336:certificate/179a4c08-7745-45f9-b4be-7ddae9d36729`.
  CloudFormation created its Route 53 validation CNAME. No service A/AAAA alias
  exists.

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
   command line, image or Git. Confirm the Bill Tracker backend owner.
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
6. After the owner confirms the production Clerk subdomain/origin rule, add
   `portfolio-preview.capiro.ai` A alias to this preview ALB only. Read back DNS
   and HTTPS, then begin the separately bounded signed-in read-only test.

Rollback starts by removing the preview A alias, then scaling/deleting only the
preview service stack after recording its exact resource IDs. Preserve
diagnostic logs and image digest. Keep the ECR/certificate foundations if another
reviewed preview attempt is planned; otherwise remove only their named stacks.
