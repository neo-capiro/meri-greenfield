# Operational scripts Fable used for the Meri preview (reference copies, 2026-10-18)

These are the exact scripts Fable ran from a Windows host (Git Bash) against `capiro-dev` / us-east-1 for the first-chat preview cycles N8–N21 and the frontend rev 17 line. They are committed so that the procedure is in GitHub; **they are not runnable as-is elsewhere**: the `S=` / `W=` / `R=` variables point at Fable's local scratchpad and worktrees, and every AWS call assumes the `capiro-dev` profile with its existing authority. No credentials, tokens or secret values are embedded (they read nothing but resource names, ARNs and build ids).

| Script | What it does |
|---|---|
| `n17-cycle.sh` | One runtime deploy cycle: wait for the CodeBuild, pin the image, commit the pins, re-render with `features`, deploy the three stacks, rescale every role, report control/worker/public health. The packet §7 "normal cycle" is this script with N22 substituted. |
| `redeploy-cycle.sh` | Same cycle without an image change (re-render + deploy + rescale). |
| `measure-candidate.sh` | In-image launch measurement for a built candidate: registers a migrator (`d2-migrate`) task-definition revision on the new image, runs `runtime-values.mjs measurement-override --shipped` there, saves the receipt JSON. No network or AWS calls inside the task. |
| `remeasure.sh` | Re-run the measurement on an already-registered revision after a policy/allocation (B1) change. |
| `measure-n21.sh` | The N21 G3 verification: measurement without a profile and with the proposed 14-skill capability profile (`--shipped`). |
| `qualify-restart.sh` | Restart one product-image qualification for an already-sealed source under a fresh attempt id. |
| `fe-build-271a267d.sh` | Frontend preview image build for capiro-frontend #92 `271a267d` (tree-equivalent archive, exact-version S3 upload, one CodeBuild start). Staged, never run. |
| `fe-deploy.sh` | Wait for a frontend CodeBuild, require a clean ECR scan, deploy as the next preview task-definition revision through the reviewed template (only `ImageUri` changes). |

Authority: running any of these is an AWS mutation on a live account; the deployment packet (`../DEPLOYMENT-PACKET-20261018.md` §0) is the request, and one operator acts at a time (dot: shared listener, Core activation, DNS; Fable: Meri stacks).
