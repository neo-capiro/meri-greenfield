# Disabled Meri product preview manifest

`synthesizeProductPreview(binding)` is a pure, offline CDK template builder. It does not query AWS, create resources, read files, or deploy. The binding must name exact reviewed resources in account `967807252336`, region `us-east-1`; there are no default cluster, image, network, role, log, or ingress values. Synthetic binding values appear only in `manifest.test.mjs`.

The cluster, ECR repository, log group and roles must use the `meri-greenfield-product` namespace. This excludes the observed qualification and legacy Capiro resources at the source boundary. Names alone do not prove resource isolation; deployment review must verify actual VPC, IAM, image and network ownership before using a template.

The template contains three digest-pinned Linux Fargate task definitions, two ECS services with `DesiredCount: 0`, and no other resources. Control listens on port 8080, the Temporal worker on 8081, and the fresh conversation runner on private port 8080. The runner has one container named `worker`, matching the existing native candidate's `taskRequest` container binding, and no service. The services use an existing cluster, one supplied subnet and role-specific existing security groups with public IP disabled. An existing control target group may be named explicitly; none is inferred or created. No task can be started by synthesis. `enabled` must be `false` and `materialDelivery` must be `unmounted`.

The role commands match the image's `node apps/runtime/cli.mjs` entrypoint:

| Role | Command |
| --- | --- |
| Control | `control --config /run/meri/control.json` |
| Temporal worker | `temporal-worker --config /run/meri/worker.json` |
| One-run task | `conversation-runner --config /run/meri/task.json` |

The builder requires these non-secret binding fields: `account`, `region`, `clusterArn`, digest-pinned `imageUri`, `logGroupName`, `executionRoleArn`, `controlTaskRoleArn`, verified non-root `runtimeUser`, `runnerSha256`, role-specific Fargate `sizing`, and `network` with `privateSubnetId`, `controlSecurityGroupId`, `workerSecurityGroupId`, and one to five `runnerSecurityGroupIds`. `controlTargetGroupArn` is optional. It emits runner task ARN, cluster, subnet and security-group outputs for later comparison with the existing `task-allocator.mjs` request; these outputs are not admission authority. The builder checks reference format and account/region, but cannot prove a subnet is private, a role is least-privileged, the target group is routed safely, or a digest contains the reviewed runtime. Deployment review must read those actual resources back.

**Activation remains blocked.** The image reads role-specific configuration and credential files as owner-only, regular, non-symlink files. ECS environment and Secrets injection do not satisfy this contract. The tested `runner-bootstrap-files.mjs` materializer has no production caller, and the CLI loads its config before running. No task definition here mounts or manufactures material. Review and compose a bounded file-delivery owner for control, worker, and each task before changing the zero service counts or invoking RunTask. The runner must receive only its admitted per-run task capability; it has no task role in this template. The Temporal worker likewise has no task role. The control task uses only a separately reviewed existing role reference.

The current generic control `/health/ready` remains unavailable while product owners are uncomposed. ECS liveness checks use `/health/live`; they are process checks, not permission to route traffic. Review an existing private/public ingress and an actual target-group health path before attaching any control target group. Current read-only inventory has no named product target group or product image repository, so these bindings are pending. Also verify the exact Core origin, approved database schema/application role, Temporal namespace/TLS, model proxy and budget, current identity/client pins, runtime image/executable measurement, old-pin rollback, and one-run physical-stop custody. This manifest creates no IAM, VPC, security group, database, secret, ECR, load balancer, ingress, or migration resource.

Focused source check: run `node --test infra/product-preview/manifest.test.mjs` with the pinned Node 24 binary. Synthesis/test success is not a live deployment or first-chat acceptance receipt.
