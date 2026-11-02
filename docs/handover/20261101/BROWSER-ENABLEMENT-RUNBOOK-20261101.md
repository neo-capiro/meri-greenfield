# Browser enablement runbook (1 November 2026)

Owner of this document: Fable (browser enablement lane, PR `fable/browser-enablement-20261101`). Executor: the Sonnet shipping executor, one live effect at a time with receipts, coordinated through the orchestrator session. AWS reads use IAM user `jump-cli` (account 967807252336, us-east-1, `MSYS_NO_PATHCONV=1` in Git Bash). Release remains the sole shared AWS/migration/deployment operator. Nothing in this document was executed live by its author.

## 0. Where the browser stands after the PR

The PR makes the browser gate a **configuration record owned by control** instead of a source literal:

| Piece | Before the PR | After the PR |
| --- | --- | --- |
| Activation record | `BROWSER_ACTIVATION={state:'held'}` literal in `apps/worker/conversation/browser/activation.mjs`, read in five processes | `features.browserActivation` in the deployment inputs, rendered to control's `browserActivation`, compiled by `compileBrowserActivation`; absent or `{state:'held'}` is the same held record (`BROWSER_EGRESS_UNQUALIFIED`) |
| What opens it | A reviewed source change | A reviewed deployment-input change citing the evidence record path, its SHA-256 and `EGRESS_REQUIREMENTS_SHA256` of the exact source being deployed; the renderer reads the evidence file from the source root, refuses a hash mismatch or a missing file, and attaches a verification receipt (`renderVerification`) that control checks against the record; both refuse any other shape, and refuse an open record without the browser-host router. Only the renderer, run by the release executor from reviewed inputs, produces the control configuration |
| Who enforces it | Each process re-read the literal | Control: host currentness answers `browserAdmitted:false` while held (every host browser read refuses: `host/control/postgres-store.mjs`, `browser-host-run-facts.mjs`), and the AgentCore invocation settings carry `browser.enabled` (`agentcore-candidate.mjs`), which alone mounts the runtime's browser port (`agentcore-query.mjs`) |
| Destination policy | `browserPlatform` existed in control configuration only; nothing rendered it; default empty (nothing opened) | `features.browserPlatform` rendered and validated. Since 2 November 2026 (Neo, 1 November: "make it feel like Claude") the committed record is `destinations:'public-web'` with `deniedHosts` for Meri's own application hosts (`infra/product-preview/first-chat/deployment-inputs.json`); private, link-local and metadata ranges, credential URLs and non-web schemes stay refused by the platform limits; tenants may narrow to a list or add denied hosts |
| Control-to-host router | `browserHosts` never rendered | Rendered whenever `features.nativeProcessing` is enabled, pinning the same control client leaf, key and issuer root the native inspection host already uses (`/run/meri/native-control-client.pem`, `.key`, `/run/meri/native-issuer-ca.pem`) |

Requirement digest at the PR head (recompute at the deployed commit; see step 6):

```text
EGRESS_REQUIREMENTS_SHA256 = 606f476adfd9d872eec797e67be3a3419dd755b59a04373f99fd888ea6ed0ec1
```

**What does not exist yet, anywhere (source or live).** Shipping the browser is gated on these, in this order. None of them is a deployment-input flip, and none can be measured before the previous one exists.

1. **A browser host image.** `apps/runtime/Dockerfile` carries no Chromium and no `@playwright/mcp`; the package is not in any lockfile (checklist P2 in `apps/worker/conversation/browser/ACTIVATION-CHECKLIST.md`). The browser-only host service (`apps/runtime/browser-host-service/`) has no image, no production launcher and no `ENTRYPOINT`.
2. **A browser-only host provisioner.** `apps/runtime/native-host-provisioning.mjs` and `native-host-lifecycle.mjs` provision `hostMode:'native-processing'` only. The allocation writer (`apps/control/browser-hosts/postgres-allocations.mjs`, `createPostgresHostAllocationWriter`) is bound in production only by the native-processing owners (`native-worker-owners.mjs`, `native-observer-runtime.mjs`), which admit `hostMode:'native-processing'` records; no production path admits a `browser-only` allocation, and the conversation lifecycle has no browser-need signal comparable to `nativeNeed` for uploads.
3. **The host-to-control currentness path.** Hosts (native and browser alike) read currentness from control's mTLS listener (`createHostCurrentnessServer`, mounted with `browserHosts.tls.hostServer` + `browserHosts.bind`). Since 2 November 2026 the renderer emits it and the host listener NLB is live (step 3a); what remains is the control deploy. A client-certificate TLS session cannot traverse the private ALB, so the native bootstrap spec's `control.endpoint = {address:<NLB static private IP>, port:443, serverName:control.meri-preview.internal}`. This is a **native-processing prerequisite as much as a browser one**; see step 3.
4. **Native processing itself is not live.** `deployment-inputs.json` has no `features.nativeProcessing`; no observer Lambda, watchdog state machine, native worker database role, issuer CA or control client leaf exists live. The browser router is rendered from that material, so native processing ships first.
5. **The egress measurements.** Every item in the checklist (A1 to F1, and each `EGRESS_REQUIREMENTS` entry) must be measured on the real host from the real non-root sandboxed browser. Source tests and local fixtures do not count.

## 1. Decisions (confirmed by Neo, 1 November 2026: "for browser host just make it feel like Claude")

1. **Destinations: the open public web.** `features.browserPlatform` is `destinations:'public-web'` with `deniedHosts:['capiro.ai']` (the whole Capiro zone; identity providers are not denied, sign-in happens through takeover) on `maximum`, `defaults` and every role ceiling. No origin allowlist is maintained. What is refused by policy, not by a list: private, loopback, link-local, carrier-grade NAT, multicast and metadata address ranges, `localhost`/`.local`/`.internal`/`.test`/`.onion` names, non-web schemes, credential-bearing URLs (platform limits in `public-web.mjs`); Meri's own application hosts and every name below them (`deniedHosts`, enforced in the pre-execution URL check and in the host egress grant on every connection kind and redirect hop); non-web ports and unresolved or rebinding addresses (egress control). Tenants may narrow to a list (`browserPolicy.browser.allowedOrigins`) or add denied hosts; neither can reopen the web under a list or remove a platform denial. Per-site approval remains only for consequential interactions: typing into a credential field is refused outright (sign-in only through user takeover), submitting a form or accepting a dialog asks the user, routine clicks and typing run (`permissions.mjs`, `session/interaction-classifier.mjs`). Since 2 November (Neo: submits need human approval) a second, network-level layer closes what the classifier cannot see (script-driven submits, prototype tampering): during an agent action every request the page sends with a method other than GET, HEAD or OPTIONS is held in the browser (`session/submission-gate.mjs`, a context route below page script) until the user approves it through the same canonical approval owner, once per method and destination host in that action and at most three questions per action; the card reads "Send data to <host> (<METHOD>)" on the page's site and only POST, PUT, PATCH and DELETE are ever asked about (other methods are refused by policy without a question, and the model is told "refused by policy, not sent"). A refused or expired approval aborts the request (the model is told the user did not approve it and it was not sent); outside an agent action such requests are aborted; while the user holds the browser their own submissions go through; a structurally approved submission covers its own page host for that one SDK tool use until the approval expires. A 307/308 redirect of a sending request to another host is failed before the browser follows it (browser-level DevTools response watch, covers fetch, form navigation, workers, iframes and popups). GET requests are not held, including a GET form submitted by script; the classifier still asks before any click on a submit control, whatever the form's method.
2. **Host.** `c7g.large` ARM64, one isolated browser context per conversation, the Playwright MCP 0.0.83 + Chromium image, the browser-only provisioner, launcher and currentness listener as designed in step 3; non-root sandbox and the measured egress evidence of `ACTIVATION-CHECKLIST.md` remain the gate. The D005 `t3.large` binding is superseded.
3. **Viewer.** Live screenshot/stream viewer with takeover control in chat, in Meri's visual language (the frontend browser panel and the viewer relay).
4. **Selected-tab extension: deferred.** Not built in this window; `apps/browser-extension/selected-tab/` stays as is.

## 2. Step 1: merge the PR and keep the gate held (source only)

Live effect: none. Deploying the merged source with the current inputs changes nothing at runtime: `features.browserActivation` is absent (held), `features.nativeProcessing` is absent (no router), `features.browserPlatform` renders the open-web destination policy into control, where it is inert until a host exists (the frontend hides the browser panel unless a run uses the browser).

Receipts: PR URL, merge SHA, the test run recorded in the PR.

## 3. Step 2: native processing and the host-to-control path (Release, shared with uploads)

Follow `docs/qualification/native-release-composition-20261031.md` exactly; it is the existing recipe. Its outputs are the inputs the browser needs. Key names:

| Input key | Where it comes from | Known now? |
| --- | --- | --- |
| `deployment.database.roles.nativeWorker` | DB owner creates a distinct LOGIN role; central catalog ordinals 72 to 77 are applied history, 78 (host) and 79 (intent) are prepared SQL with pinned digests in that document | role name is chosen at creation |
| `deployment.foundation.WorkerTaskRoleArn` | a distinct worker task role (not `MeriPreview-control-task`), added to `foundation-binding.json` and the first-chat foundation stack | ARN after the stack update |
| `features.nativeProcessing.deployment.{accountId,region}` | `967807252336`, `us-east-1` | yes |
| `features.nativeProcessing.deployment.placement` | `vpcId: vpc-0ac26cfac7ed972be`, one of `subnet-0920665f91c905f01`, `subnet-0e38bd390f8961fef`, `subnet-06db79cd21239de19`, its `availabilityZone`, a new host security group, a new instance profile name | SG id, profile name and AZ after creation |
| `features.nativeProcessing.deployment.launch` | `ImageId` (ARM64 AMI carrying the qualified runtime image and `/opt/meri/native-bootstrap.mjs`), `InstanceType`, same subnet/SGs/profile, `MetadataOptions.HttpTokens: required` | AMI id after the image build |
| `features.nativeProcessing.deployment.{imageDigest,sourceCommit,bootstrapSha256}` | the qualified ARM64 runtime image digest from `meri-greenfield/qualification-worker` in ECR, its source commit, the SHA-256 of the fixed bootstrap program | after build |
| `features.nativeProcessing.deployment.physicalObserver.bridgeFunctionVersionArn` | the numeric version of the `NativeObserver` Lambda (`compileNativeObserverTemplate`) | after publish |
| `features.nativeProcessing.deployment.bootstrapSpec` | `hostEndpoint {port,serverName}`, `control {endpoint:{address,port:443,serverName:control.meri-preview.internal}, clientName, serverCertificate (control-private leaf), clientCertificate, caCertificate (server-ca), policySha256}`, `issuerCaCertificate` | address and client leaf after step 3b |
| `features.nativeProcessing.watchdog.stateMachineVersionArn` | the numeric version of `NativeWatchdog` (`compileNativeWatchdogTemplate`), `DescribeStateMachine` readback copied verbatim into `watchdog.definitionReadback` | after publish |
| `features.nativeProcessing.watchdog.qualificationEvidenceSha256` | the reviewed watchdog qualification receipt | after qualification |
| `features.nativeProcessing.{observerKeyId,maxRequestMs,materialSha256}` | observer key identity, 1 to 30000 ms, SHA-256 of the six `--native-material` files | at material issuance |
| `--native-material` files | `controlClientCertificate`, `controlClientKey`, `issuerCaCertificate`, `issuerCaKey`, `observerKey`, `databaseConnection` (owner-only scratch, tracing off, removed after the render) | at issuance; the control client leaf lives at most 31 days and must outlast the rendered material validity |

3a. **Host-to-control listener (source since 2 November 2026; infra executed by Release).** Hosts dial a literal private IPv4 address (no DNS) and run mutual TLS end to end with Control, verifying the `control-private` leaf by its pinned fingerprint and `server-ca`, so the path is an **internal Network Load Balancer with static private IPs** and TCP passthrough. Source now does all of this:

- The renderer (`render-material.mjs`) emits, whenever `features.nativeProcessing` is enabled, `browserHosts.tls.hostServer={serverName:<names.control_private>,certFile:/run/meri/control-host-server.pem,keyFile:/run/meri/control-host-server.key,clientCaFile:/run/meri/native-issuer-ca.pem}` and `browserHosts.bind={address:'0.0.0.0',port:8443}` (`CONTROL_HOST_LISTENER_PORT`, `apps/runtime/browser-host-configuration.mjs`), and delivers the `control-private` leaf and key (now read from the private PKI directory as `control-private.key.pem`, checked against the leaf) to control only. The material plan admits those two files.
- The listener accepts the fingerprint-pinned `control-private` leaf up to 398 days (`PINNED_CONTROL_LIFETIME_MS.server`; the pinned Control client leaf up to 31 days, `.client`; host leaves keep the 15-minute bound) and binds `0.0.0.0` (the awsvpc ENI and loopback are the task's only interfaces).
- `infra/browser-host/host-listener-stack.mjs` is the stack source (live since 2 November, receipt E3): internal NLB `meri-preview-host-control` with one static private address (10.40.7.250 in `subnet-0920665f91c905f01`), cross-zone on, its own security group admitting TCP 443 only from the browser host security group, TCP 443 → target group `meri-preview-host-control` (ip, TCP, client IP not preserved, port `CONTROL_HOST_LISTENER_PORT` 8443), and a control-SG ingress rule for 8443 from the NLB group. Outputs: `HostListenerAddress`, `HostListenerTargetGroupArn`, `HostListenerSecurityGroupId`, `HostListenerLoadBalancerArn`.
- `stage3-deploy.mjs bindings --host-listener-outputs <outputs.json>` (required exactly when the render carries the listener; `ship-packet.mjs` adds the readback, the flag and the target-health gate) maps container port 8443 and attaches the control service to that target group.
- The Control client leaf (router and lifecycle calls to hosts) is pinned by exact fingerprint in every bootstrap spec like the server leaf, so it now lives as long as the rendered material: at most 31 days and longer than the material validity (default 7 days); hosts accept pinned Control leaves up to 398 days while their own leaves keep 15 minutes. Rotation is a re-render and redeploy of control and the worker together.
- Browser-only provisioning needs no native-processing `deployment`: `features.nativeProcessing.browserDeployment` may stand alone. Upload inspection then stays on AgentCore (`uploads.native.agentcore` unchanged) and the provisioned-host block sits beside it (`uploads.native.host` with `browserDeployment` placement facts only). The worker policy template takes one `purposes` entry per provisioned host (`compileNativeRuntimePolicyTemplate({enabled,purposes:[{deployment,instanceRoleArn}],stateMachineVersionArn,controlRoleName,workerRoleName})`), so the browser AMI, its placement, instance role and the `meri-browser-host-bootstrap` document are allowed exactly.

Infra inputs (Release): `features.nativeProcessing.browserDeployment.bootstrapSpec.control.endpoint={address:'10.40.7.250',port:443,serverName:'control.meri-preview.internal'}`; render and deploy control and the worker with `--host-listener-outputs` set to the E3 stack outputs.

3b. Render with `features.nativeProcessing` enabled (same render command as today, plus `--native-material`); the control material now also contains `browserHosts` (router). Ship through `ship-packet.mjs` and `stage3-deploy.mjs` as one deploy. Verify: control starts (a refused `BROWSER_HOST_CONFIGURATION` or `BROWSER_ACTIVATION_CONFIGURATION` at startup means the rendered material and the declaration disagree), the uploads native path completes one real inspection through a provisioned native host (this proves the host-to-control path), and the host is torn down with a verified receipt.

Time: image/AMI build and scan 1 day; observer, watchdog and policy stacks 1 day; database roles and migrations 0.5 day; listener path (3a) 1 to 2 days including the source change; first native inspection acceptance 0.5 day. **About one working week**, assuming the isolated local environment is used for the source checks first.

## 4. Step 3: the browser host (new source, then one live host)

4a. **Image.** Source, 2 November 2026 (PR 3 of [BROWSER-HOST-PATH-20261102.md](../20261102/BROWSER-HOST-PATH-20261102.md)): `apps/runtime/Dockerfile.browser-host` (ARM64 Node 24 trixie-slim, Debian snapshot apt, `@playwright/mcp` 0.0.83 with its pinned `playwright-core` and Chromium from `apps/runtime/browser-host-service/image/package.json`, the two root-only helpers compiled from the tree, iproute2/nftables, four unprivileged identities, no SUID/SGID file). What remains is operational: the lockfile `image/package-lock.json` is committed (checklist P2), the image is built once for `linux/arm64`, pushed to `meri-greenfield/browser-host`, scanned (0 HIGH/CRITICAL) and baked into the browser host AMI with the native host AMI recipe; the reviewed `profile.json` with `layout.kind:'browser-host'` is written and hashed (brief §3 step 2). Time: 1 day.

4b. **Provisioner, launcher and host.** Source, 2 November 2026: PR 2 makes the browser-only host the second purpose of the existing native coordinator (`hostMode:'browser-only'`, migration 0008 at ordinal 86, `nativeProvisioning.browserDeployment`, the broker's `execution/browser/prerequisite`, control-side teardown dispatch); PR 3 is the host itself (`apps/runtime/browser-host-service/host.mjs` over the installed bundle, the lifecycle route on the one pinned listener, the viewer input adapter over the wire batch, host-owned takeover retirement, the measured browser confinement verifier, the host-local teardown) plus the static host infra template (`infra/browser-host/provisioned-stack.mjs`: security group, instance role/profile, log group). What remains is review and the release steps of the brief (§3 steps 1 to 5: migration 84, image and AMI, static stack, `browserDeployment` inputs, deploy order). Time: review 1 day, release 1 day.

4c. **One qualification host.** Provision exactly one browser-only host (public egress through the NAT route, the host nft guard on the proxy uid) for one synthetic conversation. Run the checklist: A1 to A5 (sandbox, metadata unreachability, per-conversation host, destruction receipt), B1 to B13 (every `EGRESS_REQUIREMENTS` entry, with the host proxy running `createEgressControl` and the browser launched with `--proxy-server`), C1 to C5 (approval round trip through Core), D1 to D4, E1 to E2, F1. Add the host probes: from the proxy uid, a TCP connect to 169.254.169.254:80, 10.0.0.1:443, the Control address and a public address on :22 must all fail at the nft guard; from the root supervisor, IMDS answers only with an IMDSv2 token (hop limit 1, no container hop); `memory.max`, `pids.max` and `cpu.max` on the run parent read back the profile limits; `DescribeInstances` reads back the metadata options the launch request sets (`HttpTokens required`, `HttpPutResponseHopLimit 1`, `HttpEndpoint enabled`) and the encrypted gp3 root volume the AMI promises; both network directions work and nothing wider: Control reaches the host listener on TCP 9444 (Control security group egress and the host group's ingress from Control only; a `browser-prepare` and a viewer frame succeed), the host reaches Control's host-currentness listener at 10.40.7.250:443 (a facts read succeeds), and from the proxy uid neither the listener address nor 9444 on another host is reachable. Record each probe, refusal code, control decision log and egress capture under `docs/qualification/browser-egress/BROWSER-EGRESS-EVIDENCE-<date>.md` with the host instance id, image digest, allocation id and source commit. Hermes performs the independent review. Time: 2 to 3 days of measurement, 1 day review.

Cannot be known until this host exists: instance id and private IP, host certificate fingerprint and expiry, allocation hostId/generation, actual Chromium process tree and seccomp readback, the egress capture, the evidence file bytes and therefore `evidenceSha256`.


4d. **Next for "feel like Claude" (not blocking activation).** The viewer is one PNG per frame request, mouse is move/down/up/wheel only (no hover stream, drag or right-click), and the session drops further input while one batch is pending. The next step is a fast frame stream (screencast or JPEG deltas at a fixed rate under the same lease) and client-side input batching that coalesces moves and queues keystrokes instead of dropping them.

## 5. Step 4: open the gate (one deploy)

5a. In the private copy of the deployment inputs set:

```json
"browserActivation": {
  "state": "open",
  "evidence": "docs/qualification/browser-egress/BROWSER-EGRESS-EVIDENCE-<date>.md",
  "evidenceSha256": "<sha256 of that file's bytes at the reviewed commit>",
  "requirementsSha256": "<EGRESS_REQUIREMENTS_SHA256 at the deployed source commit>"
}
```

Compute the requirement digest in the exact checkout of the deployed source commit (never copy it from this document):

```bash
node -e "import('./apps/worker/conversation/browser/activation.mjs').then(m=>console.log(m.EGRESS_REQUIREMENTS_SHA256))"
```

Keep `features.browserPlatform` as decided in section 1 (add denied hosts there if needed, nothing else). `features.nativeProcessing` must stay enabled: the renderer refuses an open record without it, and control refuses an open record without the `browserHosts` router.

5b. Render from the checkout of the reviewed commit (the CLI reads `evidence` from that checkout's root and refuses a missing file or a hash mismatch with `RENDER_INPUT_REFUSED`), ship-packet, stage3 deploy **control only** (worker and runtime bytes are unchanged by this flip). The rendered control record carries `renderVerification:{schema,sourceCommit,renderedAtMs,evidenceSha256,requirementsSha256}`, which startup checks against the record; `summary.json` records `features.browserActivation.evidenceVerified:true`. The receipt is a render marker, not a cryptographic binding: the real binding is that the control configuration is only ever produced by the renderer from reviewed inputs by the release executor, and anyone who can edit the published control configuration already controls the deployment. Expected startup: healthy; a `BROWSER_ACTIVATION_CONFIGURATION` refusal means the record is malformed, lacks the renderer's receipt or carries one that disagrees with it, its requirement digest belongs to another source commit, or the router block is missing.

5c. Verify the deployed behaviour, in this order, before declaring the capability on:

1. Control telemetry for a new run shows the AgentCore invocation with `browser.enabled: true` (the admission settings; see `agentcore-candidate.mjs`).
2. A chat that never browses allocates no browser host. On the first browser call the conversation shows "Starting a browser…", the run's browser-only host is allocated, its currentness read returns `browserAdmitted: true`, and the runtime's `browser-prepare` succeeds within the 90 s provisioning allowance (the frontend browser panel appears for that run).
3. `browser_navigate` to an ordinary public origin loads; to `https://app.capiro.ai/` refuses with `BROWSER_HOST_DENIED`; to a private address refuses with `BROWSER_URL_NOT_PUBLIC`; a click on a link runs without a prompt; a form submission waits for the Core approval round trip; a `type=button` that posts with script (fetch POST or requestSubmit) also waits, and a refused one never reaches the site; typing into a password field refuses with `BROWSER_CREDENTIAL_INPUT_REFUSED`.
4. The run ends; the host is destroyed with a verified teardown receipt; no browser state remains.
5. A tenant admin narrows `browserPolicy` in tenant settings (a list, or an added denied host) and the next run refuses accordingly (revocation path).

Time: render and deploy 2 hours; verification 2 to 4 hours.

## 6. Rollback

Fast rollback (minutes): set `features.browserActivation` to `{"state":"held"}` (or remove it), render and deploy control. Effect is immediate for new runs: the invocation settings carry `browser.enabled:false`, so the runtime mounts no browser port; hosts answer `browserAdmitted:false` to every browser read, so a host already allocated cannot continue browsing, and the run lifecycle tears it down. Nothing else in the material changes.

Full rollback: redeploy the previous control task-definition revision and material version recorded by `ship-packet.mjs`. Native processing and the listener are independent of the browser record and need no rollback for a browser-only problem.

## 7. What this runbook does not authorize

No AWS write from the authoring session. No `npm ci`, no worktree removal. No post on issue 202 without Neo. Every live step above is a separate effect with its own receipt (command, exit code, readback) handed to the orchestrator. The qualification host is destroyed after measurement; the evidence record, not the host, is what the gate cites.
