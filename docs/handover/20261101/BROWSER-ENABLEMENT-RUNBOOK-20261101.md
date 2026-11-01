# Browser enablement runbook (1 November 2026)

Owner of this document: Fable (browser enablement lane, PR `fable/browser-enablement-20261101`). Executor: the Sonnet shipping executor, one live effect at a time with receipts, coordinated through the orchestrator session. AWS reads use IAM user `jump-cli` (account 967807252336, us-east-1, `MSYS_NO_PATHCONV=1` in Git Bash). Release remains the sole shared AWS/migration/deployment operator. Nothing in this document was executed live by its author.

## 0. Where the browser stands after the PR

The PR makes the browser gate a **configuration record owned by control** instead of a source literal:

| Piece | Before the PR | After the PR |
| --- | --- | --- |
| Activation record | `BROWSER_ACTIVATION={state:'held'}` literal in `apps/worker/conversation/browser/activation.mjs`, read in five processes | `features.browserActivation` in the deployment inputs, rendered to control's `browserActivation`, compiled by `compileBrowserActivation`; absent or `{state:'held'}` is the same held record (`BROWSER_EGRESS_UNQUALIFIED`) |
| What opens it | A reviewed source change | A reviewed deployment-input change citing the evidence record path, its SHA-256 and `EGRESS_REQUIREMENTS_SHA256` of the exact source being deployed; the renderer and control startup refuse any other shape, and refuse an open record without the browser-host router |
| Who enforces it | Each process re-read the literal | Control: host currentness answers `browserAdmitted:false` while held (every host browser read refuses: `host/control/postgres-store.mjs`, `browser-host-run-facts.mjs`), and the AgentCore invocation settings carry `browser.enabled` (`agentcore-candidate.mjs`), which alone mounts the runtime's browser port (`agentcore-query.mjs`) |
| Destination allowlist | `browserPlatform` existed in control configuration only; nothing rendered it; default empty | `features.browserPlatform` rendered and validated; committed default list in `infra/product-preview/first-chat/deployment-inputs.json` (section 5, decision 1) |
| Control-to-host router | `browserHosts` never rendered | Rendered whenever `features.nativeProcessing` is enabled, pinning the same control client leaf, key and issuer root the native inspection host already uses (`/run/meri/native-control-client.pem`, `.key`, `/run/meri/native-issuer-ca.pem`) |

Requirement digest at the PR head (recompute at the deployed commit; see step 6):

```text
EGRESS_REQUIREMENTS_SHA256 = 3fb9c99619a78021205c5fc3708230ec9f4fd5d0a5618515baeba07a8aa65e13
```

**What does not exist yet, anywhere (source or live).** Shipping the browser is gated on these, in this order. None of them is a deployment-input flip, and none can be measured before the previous one exists.

1. **A browser host image.** `apps/runtime/Dockerfile` carries no Chromium and no `@playwright/mcp`; the package is not in any lockfile (checklist P2 in `apps/worker/conversation/browser/ACTIVATION-CHECKLIST.md`). The browser-only host service (`apps/runtime/browser-host-service/`) has no image, no production launcher and no `ENTRYPOINT`.
2. **A browser-only host provisioner.** `apps/runtime/native-host-provisioning.mjs` and `native-host-lifecycle.mjs` provision `hostMode:'native-processing'` only. The allocation writer (`apps/control/browser-hosts/postgres-allocations.mjs`, `createPostgresHostAllocationWriter`) is bound in production only by the native-processing owners (`native-worker-owners.mjs`, `native-observer-runtime.mjs`), which admit `hostMode:'native-processing'` records; no production path admits a `browser-only` allocation, and the conversation lifecycle has no browser-need signal comparable to `nativeNeed` for uploads.
3. **The host-to-control currentness path.** Hosts (native and browser alike) read currentness from control's mTLS listener (`createHostCurrentnessServer`, mounted only with `browserHosts.tls.hostServer` + `browserHosts.bind`). The renderer does not emit that listener: its server material is the `control-private` leaf and key (the renderer reads no server key today, only Temporal client keys), and a client-certificate TLS session cannot traverse the private ALB (`control.meri-preview.internal`, target group `meri-preview-control-8082`). The native bootstrap spec requires `control.endpoint = {address:<private IP>, port:443, serverName:control.meri-preview.internal}`. This is a **native-processing prerequisite as much as a browser one**; see step 3.
4. **Native processing itself is not live.** `deployment-inputs.json` has no `features.nativeProcessing`; no observer Lambda, watchdog state machine, native worker database role, issuer CA or control client leaf exists live. The browser router is rendered from that material, so native processing ships first.
5. **The egress measurements.** Every item in the checklist (A1 to F1, and each `EGRESS_REQUIREMENTS` entry) must be measured on the real host from the real non-root sandboxed browser. Source tests and local fixtures do not count.

## 1. Decisions Neo must confirm before step 5

1. **Origin allowlist** (`features.browserPlatform`, committed in the PR; trim or extend before rendering). Exact origins, one per line in the inputs; the policy matches exact origins, so `www.` and bare variants are both listed:
   congress.gov (www, bare, api), govinfo.gov (www, bare, api), federalregister.gov (www, bare), regulations.gov (www, bare), sam.gov, gao.gov (www, bare), cbo.gov (www, bare), whitehouse.gov (www, bare), house.gov (www, bare, xml), senate.gov (www, bare), flsenate.gov (www, bare), myfloridahouse.gov (www, bare). `defaults` and all three role ceilings equal `maximum`, so tenants start with the whole list and may only narrow it. The frontend's own origin is **not** listed: the selected-tab extension shares a tab from the user's device to the frontend and never needs the cloud browser to open the app.
2. **Host sizing and cost.** The D005 enabled binding pins one `t3.large` with a 30 GiB encrypted root and a 900 s lease per conversation (`infra/browser-host/enabled-binding.mjs`); the native fixture uses `c7g.large` (ARM64, matching the ARM64 image rule). Approximate on-demand us-east-1 prices, to be confirmed against the current price list before committing:

   | Instance | Approx. $/hour | Per 900 s lease |
   | --- | --- | --- |
   | t3.large (x86, D005 binding) | 0.0832 | 0.021 |
   | c7g.large (ARM64, native fixture) | 0.0725 | 0.018 |

   Plus EBS (30 GiB gp3, about 0.08 $/GiB-month, billed per second), the observer Lambda, the Standard state machine (per transition) and the internal NLB if chosen in step 3. Neo decides instance type, whether browser hosts reuse the native-processing AMI/image or get their own, and the per-tenant concurrency ceiling.
3. **Selected-tab extension now or later.** The extension (`apps/browser-extension/selected-tab/`) is independent of the cloud browser: it needs a Web Store or enterprise identity, the frontend `NEXT_PUBLIC_MERI_SELECTED_TAB_EXTENSION_ID` setting and the `https://app.capiro.ai/*` manifest match (`DISTRIBUTION.md`). It can ship before or after the browser; it adds no cloud host. Recommendation: ship it as its own frontend/distribution task and keep it out of the browser host window.

## 2. Step 1: merge the PR and keep the gate held (source only)

Live effect: none. Deploying the merged source with the current inputs changes nothing at runtime: `features.browserActivation` is absent (held), `features.nativeProcessing` is absent (no router), `features.browserPlatform` renders the allowlist into control, where it is inert until a host exists (the frontend hides the browser panel unless a run uses the browser).

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
| `--native-material` files | `controlClientCertificate`, `controlClientKey`, `issuerCaCertificate`, `issuerCaKey`, `observerKey`, `databaseConnection` (owner-only scratch, tracing off, removed after the render) | at issuance; the control client leaf lives at most 900 s and must have more than 87 s left at render |

3a. **Host-to-control listener (decision for the network and release owners; not rendered by source today).** Hosts verify the listener against the `control-private` leaf and `server-ca`. Two ways satisfy `bootstrapSpec.control.endpoint` as the validators stand: an **internal Network Load Balancer with static private IPs** in the three private subnets, TCP:443 passthrough to a new control container port (non-root, so not 443 in-container; the port is whatever `browserHosts.bind.port` is set to), or a **fixed ENI** for the control task. Either needs: a control task-definition port mapping and security-group rule from the host SG; delivery of the `control-private` leaf and its key to the control task (today the key is only at the private ALB listener); and a small source change so the renderer emits `browserHosts.tls.hostServer={serverName:control.meri-preview.internal,certFile,keyFile,clientCaFile:/run/meri/native-issuer-ca.pem}` and `browserHosts.bind`. Do not improvise this in a deploy; it is one bounded source PR plus one foundation change set.

3b. Render with `features.nativeProcessing` enabled (same render command as today, plus `--native-material`); the control material now also contains `browserHosts` (router). Ship through `ship-packet.mjs` and `stage3-deploy.mjs` as one deploy. Verify: control starts (a refused `BROWSER_HOST_CONFIGURATION` or `BROWSER_ACTIVATION_CONFIGURATION` at startup means the rendered material and the declaration disagree), the uploads native path completes one real inspection through a provisioned native host (this proves the host-to-control path), and the host is torn down with a verified receipt.

Time: image/AMI build and scan 1 day; observer, watchdog and policy stacks 1 day; database roles and migrations 0.5 day; listener path (3a) 1 to 2 days including the source change; first native inspection acceptance 0.5 day. **About one working week**, assuming the isolated local environment is used for the source checks first.

## 4. Step 3: the browser host (new source, then one live host)

4a. **Image.** Add `@playwright/mcp` 0.0.83 with its pinned `playwright-core` and Chromium through the lockfile owner (checklist P2), build the ARM64 browser-host image from the runtime image recipe, scan it (0 HIGH/CRITICAL), bind the digest. Time: 1 to 2 days.

4b. **Provisioner and launcher.** Extend the existing native coordinator so a browser-only host can be allocated and launched with `hostMode:'browser-only'` (the allocation writer, migrations 0001 to 0007 under `apps/control/browser-hosts/migrations/`, the teardown receipt and the host-only process scope already exist), start `composeBrowserOnlyHostService` from the native bootstrap, and give the conversation lifecycle its browser need (a run whose effective policy is enabled and whose activation is open allocates a host before the AgentCore invocation; the AgentCore side already does `browser-prepare` against control, which routes to that allocation). This is the largest remaining source item and must not invent a second coordinator: reuse `native-host-provisioning.mjs` with a browser-only declaration. Time: 3 to 5 days plus review.

4c. **One qualification host.** Provision exactly one browser-only host in the closed network for one synthetic conversation. Run the checklist: A1 to A5 (sandbox, metadata unreachability, per-conversation host, destruction receipt), B1 to B13 (every `EGRESS_REQUIREMENTS` entry, with the host proxy running `createEgressControl` and the browser launched with `--proxy-server`), C1 to C5 (approval round trip through Core), D1 to D4, E1 to E2, F1. Record each probe, refusal code, control decision log and egress capture under `docs/qualification/browser-egress/BROWSER-EGRESS-EVIDENCE-<date>.md` with the host instance id, image digest, allocation id and source commit. Hermes performs the independent review. Time: 2 to 3 days of measurement, 1 day review.

Cannot be known until this host exists: instance id and private IP, host certificate fingerprint and expiry, allocation hostId/generation, actual Chromium process tree and seccomp readback, the egress capture, the evidence file bytes and therefore `evidenceSha256`.

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

Keep `features.browserPlatform` as decided in section 1 (edit origins there, nothing else). `features.nativeProcessing` must stay enabled: the renderer refuses an open record without it, and control refuses an open record without the `browserHosts` router.

5b. Render, ship-packet, stage3 deploy **control only** (worker and runtime bytes are unchanged by this flip). Expected startup: healthy; a `BROWSER_ACTIVATION_CONFIGURATION` refusal means the record is malformed, its requirement digest belongs to another source commit, or the router block is missing.

5c. Verify the deployed behaviour, in this order, before declaring the capability on:

1. Control telemetry for a new run shows the AgentCore invocation with `browser.enabled: true` (the admission settings; see `agentcore-candidate.mjs`).
2. The run's browser-only host is allocated, its currentness read returns `browserAdmitted: true`, and the runtime's `browser-prepare` succeeds (the frontend browser panel appears for that run).
3. `browser_navigate` to an allowlisted origin loads; to an unlisted public origin refuses with `BROWSER_ORIGIN_NOT_ALLOWED`; to a private address refuses with `BROWSER_URL_NOT_PUBLIC`; an interaction tool waits for the Core approval round trip.
4. The run ends; the host is destroyed with a verified teardown receipt; no browser state remains.
5. A tenant admin narrows `browserPolicy` in tenant settings and the next run's effective list shrinks (revocation path).

Time: render and deploy 2 hours; verification 2 to 4 hours.

## 6. Rollback

Fast rollback (minutes): set `features.browserActivation` to `{"state":"held"}` (or remove it), render and deploy control. Effect is immediate for new runs: the invocation settings carry `browser.enabled:false`, so the runtime mounts no browser port; hosts answer `browserAdmitted:false` to every browser read, so a host already allocated cannot continue browsing, and the run lifecycle tears it down. Nothing else in the material changes.

Full rollback: redeploy the previous control task-definition revision and material version recorded by `ship-packet.mjs`. Native processing and the listener are independent of the browser record and need no rollback for a browser-only problem.

## 7. What this runbook does not authorize

No AWS write from the authoring session. No `npm ci`, no worktree removal. No post on issue 202 without Neo. Every live step above is a separate effect with its own receipt (command, exit code, readback) handed to the orchestrator. The qualification host is destroyed after measurement; the evidence record, not the host, is what the gate cites.
