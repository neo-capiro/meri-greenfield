# W02 corrected Fargate baseline 3

Codex integration owner, 9 October 2026. **Five of six required probes passed. Chromium sandbox failed. G1 does not pass.** The single task is stopped; there is no running or pending qualification task. Current Meri and Capiro remain untouched, source connectivity is disabled, and paid Bedrock inference spend is $0.

## Exact build and deployment

- Source: `8785118bff574e2cf3f520a542f6a7b56e075f9e`.
- CodeBuild: `meri-greenfield-qualification-build:55c89c64-547f-41ff-8a8b-3120e25d8b39`.
- Image: `967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-greenfield/qualification-worker@sha256:7327f04575b09a633730b0ffe4b5fdeeeffe151a5c0db6dc027cc6edb8960d75`.
- Runtime stack: `MeriGreenfield-QualificationRuntime`; task definition `meri-greenfield-qualification:2`.
- Task: `arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/4a9c2d40f4094c8f88705108fdd11f2e`.

The image-only CloudFormation change set `image-8785118-20261009` used the previous template. Independent review confirmed the previous, synthesized and prior DNS-repair templates were canonically identical (28 resources; template SHA256 `02b48df80076849e47cedfb2f0fd6fce2703d0c1f4dfc8069081deb1989b31d7`). Exactly one task-definition replacement changed the immutable image parameter. No IAM or network change was included. Fresh exact STS identity preceded execution; UPDATE_COMPLETE and a full old/new task-definition comparison confirmed that only the image changed and other stack outputs were retained.

Before RunTask, independent readbacks verified the empty worker role, DNS fail-open DISABLED, completed firewall association, six exact AWS allow names with redirected-domain inspection, wildcard NXDOMAIN block, and no active tasks. The first baseline3 preflight rejected AWS domain strings with canonical trailing dots; it made **no RunTask call**. Evidence is preserved separately. Normalizing one trailing dot retained exact names/count validation before the actual launch.

The actual task used Fargate Linux/amd64 platform1.4.0 in the new private VPC, no public IP or exec, UID/GID10001, read-only root, writable workspace/tmp, dropALL capabilities, no privilege escalation configuration changes, and no provider/source credentials. Scan findings remain **2 CRITICAL / 13 HIGH / 23 MEDIUM / 7 LOW / 3 UNDEFINED**. Admission covered this one closed-network synthetic probe only, not security or application acceptance.

## Lifecycle and results

AWS timestamps, UTC: created **21:56:37.439**, image pull **21:56:52.471–21:57:20.241**, started **21:57:30.008**, application execution stopped **21:57:41.526**, task STOPPED **21:58:08.400**. This is before the **22:08:36.094** stop deadline. Container exit1, `EssentialContainerExited`. No deadline stop was needed. Fresh list-tasks checks after evidence collection found zero RUNNING/PENDING tasks.

| Probe | Result | Measured evidence |
| --- | --- | --- |
| Identity and mounts | PASS | UID/GID10001; workspace/tmp mkdir, write and read succeeded |
| Read-only root | PASS | Root mount ro; write rejected with EROFS |
| SDK static | PASS | Installed SDK0.3.295 and bundled CLI2.1.295; options/store reference only |
| Network denial controls | PASS | example.com and api.anthropic.com DNS denied; Logs resolved to10.80.0.141 and connected; direct1.1.1.1:443 timed out |
| Chromium sandbox | FAIL | Verified helper; real launch failed namespace creation with EPERM |
| Office artifacts | PASS mechanically | Native generation, inspection, recalculation, PDF conversion and PNG rendering children succeeded |

These network attempts are bounded positive/negative controls, not complete provider/source egress qualification. No real SDK model query occurred.

## Browser evidence and host decision

The exact Chromium155.0.8059.12 executable was root-owned0755 with SHA256 `adf078f8f80eb9e980a07b4418af23b0f4008a83bc5756d5588055bc4d76c5a0`. Both original `chrome_sandbox` and adjacent `chrome-sandbox` were root-owned04755 with SHA256 `be9f5d4be90fa60b985ad3069812b144ba7331fed0c3f980c6d9399d37d60314`. The diagnostic helper verdict passed. Relevant mounts were read-only without reported nosuid, NoNewPrivs0, TracerPid0, Seccomp2; all inheritable/permitted/effective/bounding/ambient capability sets were zero.

A simple user-namespace diagnostic exited3 with `unshare_ret=-1 errno=1`. One actual MCP navigation launched Chrome PID38 with the sandbox enabled and no disabling flags. It reached namespace creation and reported `Operation not permitted`, then the zygote host fatal at line228 and exit1. The driver stopped after that first failed navigation; all later steps and absent configuration inspection were correctly not run. There was no surviving identified browser/renderer or chrome://sandbox evidence.

Independent Codex review rejoined the raw logs and confirmed the summary, hashes, modes, launch count, task identity and stop. Chromium's pinned [SUID helper source](https://github.com/chromium/chromium/blob/384c82079f60e0b79cdca6e49efd5cfceefa5b74/sandbox/linux/suid/sandbox.c#L243), [Linux capability rules](https://man7.org/linux/man-pages/man7/capabilities.7.html), and [AWS Fargate restrictions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html) support a concrete host-capability blocker for this tested Chromium/dropALL configuration. Fargate does not support privileged mode or custom Docker security options and permits adding only SYS_PTRACE. The precise host filter producing EPERM is unknown; this is not proof that every possible Chromium configuration is impossible on Fargate.

After this measured failure, the human owner explicitly approved qualifying a **new dedicated isolated browser host**, keeping application/control on Fargate (D005). Host design/qualification follows separately; no weakened sandbox or passing gate is implied.

## Office evidence and limits

- DOCX SHA256 `e34b173e32a073cae405d5a0da83dabc5dc9f151f3f8d3154ad0b16642a678a3`: headings/table inspected, one PDF page and one PNG rendered.
- Generated XLSX SHA256 `af899c4ef410335c1e590e56b9556fba5d8ccf700783ab881329a6fb0df668d2`: inputs1/2/3 and formula `=SUM(A1:A3)` preserved; initial cached result was blank. LibreOffice recalculation produced numeric6 with explicit OOXML formula/value evidence; one PDF page/PNG.
- PPTX SHA256 `108a66212bc0f71d88ace55a50a3faca1e7c6de5f253fcd179e40848653518c7`: two slides and two notes inspected, two PDF pages/PNGs.

Native/PDF/PNG bytes were not exported before the ephemeral task stopped. Logs preserve hashes, structural/text/page/image facts and child results; they do **not** establish human visual quality or deliver native files. Bounded export and visual review remain required, along with revisions, recovery, skills/session behavior, live proxy/budget/SDK compatibility and remaining security disposition.

Ignored private evidence: `W02-runtime-image-8785118`, aborted `W02-fargate-baseline-3`, and actual `W02-fargate-baseline-3-run` under `docs/coordination/private-evidence/`. Prior failed probes/reviews remain preserved. W03/G2 and production cutover remain unpromoted.
